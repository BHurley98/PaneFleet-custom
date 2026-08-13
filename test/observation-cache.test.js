import test from 'node:test';
import assert from 'node:assert/strict';

import { createObservationCache } from '../observation-cache.js';

test('observation cache reuses values only within its bounded TTL', async () => {
  let now = 100;
  let calls = 0;
  const cache = createObservationCache({ ttlMs: 20, clock: () => now });
  const load = async () => ++calls;

  assert.equal(await cache.get('agent', load), 1);
  now = 119;
  assert.equal(await cache.get('agent', load), 1);
  now = 120;
  assert.equal(await cache.get('agent', load), 2);
  assert.equal(await cache.get('agent', load, { fresh: true }), 3);
});

test('observation cache shares in-flight work and retries after failure', async () => {
  const cache = createObservationCache({ ttlMs: 10 });
  let resolveLoad;
  let calls = 0;
  const load = () => {
    calls += 1;
    return new Promise((resolve) => { resolveLoad = resolve; });
  };
  const first = cache.get('shared', load);
  const second = cache.get('shared', load, { fresh: true });
  await Promise.resolve();
  assert.equal(calls, 1);
  resolveLoad('ready');
  assert.deepEqual(await Promise.all([first, second]), ['ready', 'ready']);

  await assert.rejects(cache.get('failure', async () => { throw new Error('temporary'); }), /temporary/);
  assert.equal(await cache.get('failure', async () => 'recovered'), 'recovered');
});

test('observation cache evicts least-recent entries and exposes explicit invalidation', async () => {
  const cache = createObservationCache({ ttlMs: 100, maxEntries: 2 });
  await cache.get('one', async () => 1);
  await cache.get('two', async () => 2);
  await cache.get('one', async () => 10);
  await cache.get('three', async () => 3);
  assert.equal(cache.size, 2);
  assert.equal(cache.delete('one'), true);
  assert.equal(cache.size, 1);
  cache.clear();
  assert.equal(cache.size, 0);
});

test('observation cache rejects unsafe configuration and calls', async () => {
  assert.throws(() => createObservationCache(), /observation_cache_ttl_invalid/);
  assert.throws(() => createObservationCache({ ttlMs: -1 }), /observation_cache_ttl_invalid/);
  assert.throws(() => createObservationCache({ ttlMs: 1, maxEntries: 0 }), /observation_cache_limit_invalid/);
  assert.throws(() => createObservationCache({ ttlMs: 1, clock: null }), /observation_cache_clock_invalid/);
  const cache = createObservationCache({ ttlMs: 1 });
  await assert.rejects(cache.get('', async () => null), /observation_cache_key_invalid/);
  await assert.rejects(cache.get('key', null), /observation_cache_loader_invalid/);
});
