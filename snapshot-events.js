const FORBIDDEN_SNAPSHOT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function snapshotFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('snapshot_event_value_invalid');
  }
  const fields = new Map();
  for (const [key, value] of Object.entries(snapshot)) {
    if (FORBIDDEN_SNAPSHOT_KEYS.has(key)) throw new TypeError('snapshot_event_key_invalid');
    const serialized = JSON.stringify(value);
    if (serialized !== undefined) fields.set(key, serialized);
  }
  return fields;
}

function nextSequence(previous) {
  const current = Number(previous?.sequence);
  if (!Number.isSafeInteger(current) || current < 1) return 1;
  return current === Number.MAX_SAFE_INTEGER ? 1 : current + 1;
}

export function buildSnapshotEventUpdate(snapshot, previous = null) {
  const fields = snapshotFields(snapshot);
  const sequence = nextSequence(previous);
  const fullPayload = `{${[...fields]
    .map(([key, serialized]) => `${JSON.stringify(key)}:${serialized}`)
    .join(',')}}`;
  let broadcastEvent = 'snapshot';
  let broadcastPayload = fullPayload;

  if (previous?.fields instanceof Map && Number.isSafeInteger(previous.sequence) && previous.sequence > 0) {
    const changes = {};
    const removed = [];
    for (const [key, serialized] of fields) {
      if (previous.fields.get(key) !== serialized) changes[key] = snapshot[key];
    }
    for (const key of previous.fields.keys()) {
      if (!fields.has(key)) removed.push(key);
    }
    const patchPayload = JSON.stringify({
      baseSequence: previous.sequence,
      sequence,
      changes,
      removed
    });
    if (Buffer.byteLength(patchPayload) < Buffer.byteLength(fullPayload)) {
      broadcastEvent = 'snapshot-patch';
      broadcastPayload = patchPayload;
    }
  }

  return {
    state: { sequence, fields },
    fullPayload,
    broadcastEvent,
    broadcastPayload
  };
}
