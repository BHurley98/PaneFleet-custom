function validateIntegerBounds({ fallback, min, max }) {
  if (![fallback, min, max].every(Number.isInteger) || min > fallback || fallback > max) {
    throw new TypeError('integer setting bounds must satisfy min <= fallback <= max');
  }
}

function normalizedSetting(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  return normalized === undefined || normalized === null || normalized === '' ? fallback : normalized;
}

export function boundedIntegerSetting(value, bounds) {
  validateIntegerBounds(bounds);
  const { fallback, min, max } = bounds;
  const configured = Number(normalizedSetting(value, fallback));
  if (!Number.isFinite(configured)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(configured)));
}

export function strictIntegerSetting(value, bounds, name = 'integer setting') {
  validateIntegerBounds(bounds);
  const { fallback, min, max } = bounds;
  const normalized = normalizedSetting(value, fallback);
  const decimalInteger = typeof normalized !== 'string' || /^[+-]?\d+$/.test(normalized);
  const configured = Number(normalized);
  if (!decimalInteger || !Number.isSafeInteger(configured) || configured < min || configured > max) {
    throw new TypeError(`${name} must be an integer from ${min} to ${max}`);
  }
  return configured;
}
