import { stat } from 'node:fs/promises';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function nextAvailableArchivePath(basePath, nowMs = Date.now()) {
  const timestamp = Number(nowMs);
  if (!Number.isFinite(timestamp)) throw new TypeError('nowMs must be finite');
  let suffix = Math.max(0, Math.floor(timestamp));
  while (true) {
    const candidate = `${basePath}.${suffix}`;
    try {
      await stat(candidate);
      suffix += 1;
    } catch (error) {
      if (error?.code === 'ENOENT') return candidate;
      throw error;
    }
  }
}

function finiteTimestamp(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function pruneAgentSampleStore(store, {
  activeSessions = [],
  nowMs = Date.now(),
  retentionMs = 14 * DAY_MS,
  maxSessions = 100
} = {}) {
  const agents = store.agents;
  const active = new Set(activeSessions);
  const retentionCutoff = nowMs - Math.max(0, retentionMs);
  const sessionLimit = Math.max(0, Math.floor(maxSessions));
  const inactive = Object.entries(agents)
    .filter(([session]) => !active.has(session))
    .map(([session, history]) => ({
      session,
      updatedAtMs: finiteTimestamp(history.updatedAt)
    }))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs || left.session.localeCompare(right.session));
  const remove = new Set(
    inactive
      .filter((entry) => entry.updatedAtMs < retentionCutoff)
      .map((entry) => entry.session)
  );
  const retainedCount = Object.keys(agents).length - remove.size;
  let overflow = Math.max(0, retainedCount - sessionLimit);
  for (const entry of inactive.slice().reverse()) {
    if (!overflow) break;
    if (remove.has(entry.session)) continue;
    remove.add(entry.session);
    overflow -= 1;
  }
  if (!remove.size) return { store, changed: false, removedCount: 0 };
  const nextAgents = { ...agents };
  for (const session of remove) delete nextAgents[session];
  return {
    store: { ...store, agents: nextAgents },
    changed: true,
    removedCount: remove.size
  };
}

export function auditArchivesToRemove(entries, {
  basename = 'actions.jsonl',
  nowMs = Date.now(),
  retentionMs = 30 * DAY_MS,
  maxArchives = 4
} = {}) {
  const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const archivePattern = new RegExp(`^${escapedBasename}\\.(\\d+)$`);
  const cutoff = nowMs - Math.max(0, retentionMs);
  const limit = Math.max(0, Math.floor(maxArchives));
  const archives = entries
    .filter((entry) => entry.isFile === true && archivePattern.test(entry.name))
    .map((entry) => {
      const createdAtMs = Number(entry.name.match(archivePattern)[1]);
      const modifiedAtMs = entry.mtimeMs;
      return { ...entry, archiveAtMs: Math.max(createdAtMs, modifiedAtMs) };
    })
    .sort((left, right) => right.archiveAtMs - left.archiveAtMs || left.name.localeCompare(right.name));
  return archives
    .filter((entry, index) => index >= limit || entry.archiveAtMs < cutoff)
    .map((entry) => entry.name);
}
