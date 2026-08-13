import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextPromptCronAt, parsePromptCron, promptCronMatchesAt } from '../prompt-schedule.js';

test('prompt cron parsing normalizes whitespace, ranges, steps, lists, and Sunday aliases', () => {
  const parsed = parsePromptCron('  0-45/15   8,12   1,15   *   0,7  ');
  assert.equal(parsed.cron, '0-45/15 8,12 1,15 * 0,7');
  assert.deepEqual([...parsed.minutes], [0, 15, 30, 45]);
  assert.deepEqual([...parsed.hours], [8, 12]);
  assert.deepEqual([...parsed.days], [1, 15]);
  assert.deepEqual([...parsed.weekdays], [0]);
  assert.equal(parsed.dayWildcard, false);
  assert.equal(parsed.weekdayWildcard, false);
});

test('numeric cron step bases expand through the end of their field', () => {
  const parsed = parsePromptCron('5/10 * * * *');
  assert.deepEqual([...parsed.minutes], [5, 15, 25, 35, 45, 55]);
  assert.equal(
    nextPromptCronAt(parsed.cron, Date.UTC(2026, 7, 3, 10, 5)),
    '2026-08-03T10:15:00.000Z'
  );
});

test('cron timestamp matching requires an exact scheduled minute', () => {
  assert.equal(promptCronMatchesAt('*/5 * * * *', Date.UTC(2026, 7, 3, 10, 15)), true);
  assert.equal(promptCronMatchesAt('*/5 * * * *', Date.UTC(2026, 7, 3, 10, 16)), false);
  assert.equal(promptCronMatchesAt('*/5 * * * *', Date.UTC(2026, 7, 3, 10, 15, 1)), false);
  assert.throws(() => promptCronMatchesAt('* * * * *', Number.NaN), /atMs must be finite/);
  assert.throws(() => promptCronMatchesAt('* * * * *', Number.MAX_VALUE), /valid date/);
});

test('next prompt time is UTC, minute-aligned, and applies cron day-or-weekday semantics', () => {
  assert.equal(
    nextPromptCronAt('* * * * *', Date.UTC(2026, 7, 2, 10, 11, 59, 999)),
    '2026-08-02T10:12:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 * * 7', Date.UTC(2026, 7, 2, 0, 0)),
    '2026-08-09T00:00:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 13 * 1', Date.UTC(2026, 7, 2, 0, 0)),
    '2026-08-03T00:00:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 13 * *', Date.UTC(2026, 7, 2, 0, 0)),
    '2026-08-13T00:00:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 */1 * 1', Date.UTC(2026, 7, 3, 0, 0)),
    '2026-08-10T00:00:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 13 * */1', Date.UTC(2026, 7, 2, 0, 0)),
    '2026-08-13T00:00:00.000Z'
  );
});

test('calendar scheduling supports leap-day gaps and rejects impossible dates directly', () => {
  assert.equal(
    nextPromptCronAt('0 0 29 2 *', Date.UTC(2025, 2, 1)),
    '2028-02-29T00:00:00.000Z'
  );
  assert.equal(
    nextPromptCronAt('0 0 30 2 1', Date.UTC(2026, 0, 1)),
    '2026-02-02T00:00:00.000Z'
  );
  assert.throws(
    () => nextPromptCronAt('0 0 30 2 *', Date.UTC(2026, 0, 1)),
    /prompt_schedule_has_no_run/
  );
  assert.throws(() => parsePromptCron('0 0 30 2 *'), /prompt_schedule_has_no_run/);
});

test('prompt cron rejects malformed fields and non-finite scheduling anchors', () => {
  for (const cron of [
    '',
    '* * * *',
    '* * * * * *',
    '60 * * * *',
    '*/0 * * * *',
    '*/61 * * * *',
    '10-5 * * * *',
    '1//2 * * * *',
    'a * * * *',
    '* 24 * * *',
    '* * 0 * *',
    '* * * 13 *',
    '* * * * 8'
  ]) {
    assert.throws(() => parsePromptCron(cron), /prompt_schedule_cron_invalid/, cron);
  }
  assert.throws(() => nextPromptCronAt('* * * * *', Number.NaN), /afterMs must be finite/);
  assert.throws(() => nextPromptCronAt('* * * * *', Number.MAX_VALUE), /valid date/);
});
