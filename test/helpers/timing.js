const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function positiveDuration(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive finite number`);
  }
  return value;
}

export async function withTimeout(operation, {
  timeoutMs = 5000,
  label = 'operation'
} = {}) {
  if (typeof operation !== 'function') throw new TypeError('Timed operation must be a function');
  const timeout = positiveDuration(timeoutMs, 'timeoutMs');
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label} after ${timeout}ms`)), timeout);
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), expired]);
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForCondition(check, {
  timeoutMs = 5000,
  intervalMs = 25,
  label = 'condition'
} = {}) {
  if (typeof check !== 'function') throw new TypeError('Condition check must be a function');
  const timeout = positiveDuration(timeoutMs, 'timeoutMs');
  const interval = positiveDuration(intervalMs, 'intervalMs');
  const deadline = Date.now() + timeout;

  while (true) {
    const value = await check();
    if (value) return value;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`Timed out waiting for ${label} after ${timeout}ms`);
    await delay(Math.min(interval, remaining));
  }
}
