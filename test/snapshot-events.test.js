import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnapshotEventUpdate } from '../snapshot-events.js';

test('the first live snapshot is complete and sequenced', () => {
  const snapshot = { host: { time: 'first' }, promptQueue: { items: [{ id: 'one' }] } };
  const update = buildSnapshotEventUpdate(snapshot);

  assert.equal(update.state.sequence, 1);
  assert.equal(update.broadcastEvent, 'snapshot');
  assert.deepEqual(JSON.parse(update.fullPayload), snapshot);
  assert.equal(update.broadcastPayload, update.fullPayload);
});

test('recurring updates carry only changed and removed top-level domains', () => {
  const first = buildSnapshotEventUpdate({
    host: { time: 'first' },
    promptQueue: { items: Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}`, status: 'sent' })) },
    security: { recent: ['stable'] }
  });
  const secondSnapshot = {
    host: { time: 'second' },
    promptQueue: JSON.parse(first.fullPayload).promptQueue,
    agents: [{ session: 'codex' }]
  };
  const second = buildSnapshotEventUpdate(secondSnapshot, first.state);
  const patch = JSON.parse(second.broadcastPayload);

  assert.equal(second.state.sequence, 2);
  assert.equal(second.broadcastEvent, 'snapshot-patch');
  assert.deepEqual(patch, {
    baseSequence: 1,
    sequence: 2,
    changes: {
      host: { time: 'second' },
      agents: [{ session: 'codex' }]
    },
    removed: ['security']
  });
  assert.deepEqual(JSON.parse(second.fullPayload), secondSnapshot);
});

test('a patch never replaces a smaller complete snapshot', () => {
  const first = buildSnapshotEventUpdate({ value: 1 });
  const second = buildSnapshotEventUpdate({ value: 2 }, first.state);

  assert.equal(second.broadcastEvent, 'snapshot');
  assert.equal(second.broadcastPayload, second.fullPayload);
});

test('snapshot event state rejects invalid values and unsafe keys', () => {
  assert.throws(() => buildSnapshotEventUpdate(null), /snapshot_event_value_invalid/);
  assert.throws(() => buildSnapshotEventUpdate([]), /snapshot_event_value_invalid/);
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}');
  assert.throws(() => buildSnapshotEventUpdate(unsafe), /snapshot_event_key_invalid/);
});

test('undefined fields are omitted and the sequence rolls over safely', () => {
  const first = buildSnapshotEventUpdate({ stable: 'x'.repeat(200), omitted: undefined, tick: 1 });
  first.state.sequence = Number.MAX_SAFE_INTEGER;
  const second = buildSnapshotEventUpdate({ stable: 'x'.repeat(200), tick: 2 }, first.state);
  const patch = JSON.parse(second.broadcastPayload);

  assert.equal(first.state.fields.has('omitted'), false);
  assert.equal(second.broadcastEvent, 'snapshot-patch');
  assert.equal(second.state.sequence, 1);
  assert.equal(patch.baseSequence, Number.MAX_SAFE_INTEGER);
  assert.equal(patch.sequence, 1);
});
