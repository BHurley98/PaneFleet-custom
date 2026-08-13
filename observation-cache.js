export function createObservationCache({ ttlMs, maxEntries = 100, clock = Date.now } = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 0) throw new TypeError('observation_cache_ttl_invalid');
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new TypeError('observation_cache_limit_invalid');
  if (typeof clock !== 'function') throw new TypeError('observation_cache_clock_invalid');
  const entries = new Map();

  function trim() {
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  }

  async function get(key, loader, { fresh = false } = {}) {
    if (typeof key !== 'string' || !key) throw new TypeError('observation_cache_key_invalid');
    if (typeof loader !== 'function') throw new TypeError('observation_cache_loader_invalid');
    const current = entries.get(key);
    if (current?.pending) return current.pending;
    if (!fresh && current && current.expiresAt > clock()) {
      entries.delete(key);
      entries.set(key, current);
      return current.value;
    }

    const entry = { value: undefined, expiresAt: 0, pending: null };
    const pending = Promise.resolve().then(loader);
    entry.pending = pending;
    entries.delete(key);
    entries.set(key, entry);
    trim();
    try {
      const value = await pending;
      if (entries.get(key) === entry) {
        entry.value = value;
        entry.expiresAt = clock() + ttlMs;
        entry.pending = null;
      }
      return value;
    } catch (error) {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    }
  }

  return {
    get,
    delete(key) { return entries.delete(key); },
    clear() { entries.clear(); },
    get size() { return entries.size; }
  };
}
