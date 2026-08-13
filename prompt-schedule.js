const MAX_DAYS_BY_MONTH = Object.freeze([0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
// Leap days can be eight years apart when a century year is not divisible by 400.
const MAX_CRON_SEARCH_MINUTES = 8 * 366 * 24 * 60;

function parseCronField(source, minimum, maximum, { sundaySeven = false } = {}) {
  const values = new Set();
  const text = String(source || '').trim();
  if (!text) throw new Error('prompt_schedule_cron_invalid');
  for (const segment of text.split(',')) {
    if (!segment) throw new Error('prompt_schedule_cron_invalid');
    const [base, stepText, ...extra] = segment.split('/');
    if (extra.length || !base) throw new Error('prompt_schedule_cron_invalid');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1 || step > maximum - minimum + 1) {
      throw new Error('prompt_schedule_cron_invalid');
    }

    let start;
    let end;
    if (base === '*') {
      start = minimum;
      end = maximum;
    } else if (/^\d+-\d+$/.test(base)) {
      [start, end] = base.split('-').map(Number);
    } else if (/^\d+$/.test(base)) {
      start = Number(base);
      end = stepText === undefined ? start : maximum;
    } else {
      throw new Error('prompt_schedule_cron_invalid');
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < minimum || end > maximum || start > end) {
      throw new Error('prompt_schedule_cron_invalid');
    }
    for (let value = start; value <= end; value += step) values.add(sundaySeven && value === 7 ? 0 : value);
  }
  return values;
}

export function parsePromptCron(value) {
  const cron = String(value || '').trim().replace(/\s+/g, ' ');
  const parts = cron.split(' ');
  if (parts.length !== 5 || cron.length > 80) throw new Error('prompt_schedule_cron_invalid');
  const days = parseCronField(parts[2], 1, 31);
  const weekdays = parseCronField(parts[4], 0, 7, { sundaySeven: true });
  const parsed = {
    cron,
    minutes: parseCronField(parts[0], 0, 59),
    hours: parseCronField(parts[1], 0, 23),
    days,
    months: parseCronField(parts[3], 1, 12),
    weekdays,
    dayWildcard: days.size === 31,
    weekdayWildcard: weekdays.size === 7
  };
  if (!hasPossibleCalendarMatch(parsed)) throw new Error('prompt_schedule_has_no_run');
  return parsed;
}

function cronMatches(parsed, date) {
  if (!parsed.minutes.has(date.getUTCMinutes()) || !parsed.hours.has(date.getUTCHours()) || !parsed.months.has(date.getUTCMonth() + 1)) return false;
  const dayMatch = parsed.days.has(date.getUTCDate());
  const weekdayMatch = parsed.weekdays.has(date.getUTCDay());
  if (parsed.dayWildcard && parsed.weekdayWildcard) return true;
  if (parsed.dayWildcard) return weekdayMatch;
  if (parsed.weekdayWildcard) return dayMatch;
  return dayMatch || weekdayMatch;
}

export function promptCronMatchesAt(cron, atMs) {
  const timestamp = Number(atMs);
  if (!Number.isFinite(timestamp)) throw new TypeError('atMs must be finite');
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new TypeError('atMs must identify a valid date');
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return false;
  return cronMatches(parsePromptCron(cron), date);
}

function hasPossibleCalendarMatch(parsed) {
  if (parsed.dayWildcard || !parsed.weekdayWildcard) return true;
  return [...parsed.months].some((month) => (
    [...parsed.days].some((day) => day <= MAX_DAYS_BY_MONTH[month])
  ));
}

export function nextPromptCronAt(cron, afterMs = Date.now()) {
  const timestamp = Number(afterMs);
  if (!Number.isFinite(timestamp)) throw new TypeError('afterMs must be finite');
  const parsed = parsePromptCron(cron);
  const candidate = new Date(Math.floor(timestamp / 60_000) * 60_000 + 60_000);
  if (!Number.isFinite(candidate.getTime())) throw new TypeError('afterMs must identify a valid date');
  for (let offset = 0; offset < MAX_CRON_SEARCH_MINUTES; offset += 1) {
    if (cronMatches(parsed, candidate)) return candidate.toISOString();
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error('prompt_schedule_has_no_run');
}
