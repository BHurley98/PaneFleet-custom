import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  auditArchivesToRemove,
  nextAvailableArchivePath,
  pruneAgentSampleStore
} from '../runtime-retention.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const nowMs = Date.parse('2026-07-29T12:00:00.000Z');

function history(updatedAt) {
  return { updatedAt, samples: [{ sampledAt: updatedAt }] };
}

test('archive allocation advances past every existing numeric suffix', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'panefleet-audit-archive-'));
  const basePath = path.join(directory, 'actions.jsonl');
  try {
    assert.equal(await nextAvailableArchivePath(basePath, nowMs), `${basePath}.${nowMs}`);
    await writeFile(`${basePath}.${nowMs}`, 'first\n');
    await writeFile(`${basePath}.${nowMs + 1}`, 'second\n');
    assert.equal(await nextAvailableArchivePath(basePath, nowMs), `${basePath}.${nowMs + 2}`);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('archive allocation rejects invalid clocks and propagates filesystem errors', async () => {
  await assert.rejects(
    nextAvailableArchivePath('/unused/archive', Number.NaN),
    /nowMs must be finite/
  );

  const directory = await mkdtemp(path.join(os.tmpdir(), 'panefleet-audit-error-'));
  const nonDirectory = path.join(directory, 'not-a-directory');
  try {
    await writeFile(nonDirectory, 'fixture\n');
    await assert.rejects(
      nextAvailableArchivePath(path.join(nonDirectory, 'actions.jsonl'), nowMs),
      (error) => error?.code === 'ENOTDIR'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('agent sample retention preserves active sessions and removes expired inactive histories', () => {
  const store = {
    version: 1,
    agents: {
      active_old: history('2026-06-01T00:00:00.000Z'),
      inactive_recent: history('2026-07-28T00:00:00.000Z'),
      inactive_expired: history('2026-07-01T00:00:00.000Z'),
      inactive_invalid: history('')
    }
  };

  const result = pruneAgentSampleStore(store, {
    activeSessions: ['active_old'],
    nowMs,
    retentionMs: 14 * DAY_MS,
    maxSessions: 100
  });

  assert.equal(result.changed, true);
  assert.equal(result.removedCount, 2);
  assert.deepEqual(Object.keys(result.store.agents).sort(), ['active_old', 'inactive_recent']);
  assert.equal(Object.keys(store.agents).length, 4);
});

test('agent sample retention enforces a total limit using the oldest inactive histories', () => {
  const store = {
    version: 1,
    agents: {
      active_a: history('2026-07-01T00:00:00.000Z'),
      active_b: history('2026-07-02T00:00:00.000Z'),
      inactive_new: history('2026-07-29T00:00:00.000Z'),
      inactive_middle: history('2026-07-28T00:00:00.000Z'),
      inactive_old: history('2026-07-27T00:00:00.000Z')
    }
  };

  const result = pruneAgentSampleStore(store, {
    activeSessions: ['active_a', 'active_b'],
    nowMs,
    retentionMs: 365 * DAY_MS,
    maxSessions: 3
  });

  assert.deepEqual(Object.keys(result.store.agents).sort(), ['active_a', 'active_b', 'inactive_new']);
  assert.equal(result.removedCount, 2);
});

test('agent sample age and count limits compose without double-counting removals', () => {
  const store = {
    version: 1,
    agents: {
      active: history('2026-06-01T00:00:00.000Z'),
      inactive_new: history('2026-07-29T00:00:00.000Z'),
      inactive_old: history('2026-07-28T00:00:00.000Z'),
      inactive_expired: history('2026-07-01T00:00:00.000Z')
    }
  };

  const result = pruneAgentSampleStore(store, {
    activeSessions: ['active'],
    nowMs,
    retentionMs: 14 * DAY_MS,
    maxSessions: 2
  });

  assert.deepEqual(Object.keys(result.store.agents).sort(), ['active', 'inactive_new']);
  assert.equal(result.removedCount, 2);
});

test('agent sample retention returns the original store when no cleanup is needed', () => {
  const store = {
    version: 1,
    agents: { active: history('2026-07-29T00:00:00.000Z') }
  };
  const result = pruneAgentSampleStore(store, {
    activeSessions: ['active'],
    nowMs,
    retentionMs: DAY_MS,
    maxSessions: 1
  });
  assert.equal(result.changed, false);
  assert.equal(result.store, store);
});

test('audit retention ignores unrelated files and removes expired or excess archives', () => {
  const entries = [
    { name: 'actions.jsonl', isFile: true, mtimeMs: nowMs },
    { name: `actions.jsonl.${nowMs - DAY_MS}`, isFile: true, mtimeMs: nowMs - DAY_MS },
    { name: `actions.jsonl.${nowMs - 2 * DAY_MS}`, isFile: true, mtimeMs: nowMs - 2 * DAY_MS },
    { name: `actions.jsonl.${nowMs - 20 * DAY_MS}`, isFile: true, mtimeMs: nowMs - 20 * DAY_MS },
    { name: `actions.jsonl.${nowMs - 40 * DAY_MS}`, isFile: true, mtimeMs: nowMs - 40 * DAY_MS },
    { name: `actions.jsonl.${nowMs - 50 * DAY_MS}`, isFile: false, mtimeMs: nowMs - 50 * DAY_MS },
    { name: `other.jsonl.${nowMs - 50 * DAY_MS}`, isFile: true, mtimeMs: nowMs - 50 * DAY_MS }
  ];

  assert.deepEqual(auditArchivesToRemove(entries, {
    nowMs,
    retentionMs: 30 * DAY_MS,
    maxArchives: 2
  }).sort(), [
    `actions.jsonl.${nowMs - 20 * DAY_MS}`,
    `actions.jsonl.${nowMs - 40 * DAY_MS}`
  ].sort());
});

test('zero audit retention removes every matching regular archive', () => {
  const entries = [
    { name: `actions.jsonl.${nowMs}`, isFile: true, mtimeMs: nowMs },
    { name: `actions.jsonl.${nowMs - 1}`, isFile: true, mtimeMs: nowMs - 1 }
  ];
  assert.deepEqual(auditArchivesToRemove(entries, {
    nowMs,
    retentionMs: 0,
    maxArchives: 0
  }), entries.map((entry) => entry.name));
});
