import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createNetworkMonitorStore,
  inferOutboundAttribution,
  journalSinceArgument,
  networkMonitorSnapshot,
  parseSocketEndpoint,
  parseSshJournal,
  parseSsRecords,
  reconcileNetworkMonitor,
  validateNetworkMonitorStore
} from '../network-monitor.js';

const firstAt = '2026-07-18T12:00:00.000Z';
const secondAt = '2026-07-18T12:05:00.000Z';

function socketFixtures() {
  return parseSsRecords([
    'ESTAB 0 0 192.0.2.10:8787 198.51.100.10:52000 users:(("node",pid=900,fd=20))',
    'ESTAB 0 0 192.0.2.10:45100 192.0.2.44:443 users:(("codex",pid=901,fd=21))',
    'ESTAB 0 0 192.0.2.10:45101 203.0.113.77:8443 users:(("worker",pid=902,fd=22))',
    'ESTAB 0 0 127.0.0.1:46000 127.0.0.1:5432 users:(("node",pid=903,fd=23))'
  ].join('\n'));
}

function listenerFixtures() {
  return parseSsRecords([
    'LISTEN 0 511 0.0.0.0:8787 0.0.0.0:* users:(("node",pid=900,fd=18))',
    'LISTEN 0 511 0.0.0.0:8098 0.0.0.0:* users:(("python",pid=904,fd=8))',
    'LISTEN 0 511 0.0.0.0:9999 0.0.0.0:* users:(("mystery",pid=905,fd=9))',
    'LISTEN 0 511 127.0.0.1:3000 0.0.0.0:* users:(("local-dev",pid=906,fd=10))'
  ].join('\n'));
}

function sshFixture(lines) {
  return parseSshJournal(lines.join('\n'));
}

test('socket and SSH parsers retain bounded connection metadata without raw logs', () => {
  assert.equal(journalSinceArgument(null), '24 hours ago');
  assert.equal(journalSinceArgument('invalid'), '24 hours ago');
  assert.equal(journalSinceArgument(firstAt), `@${Math.floor((Date.parse(firstAt) - 2000) / 1000)}`);
  assert.equal(journalSinceArgument(firstAt, Number.NaN), `@${Math.floor((Date.parse(firstAt) - 2000) / 1000)}`);
  assert.equal(journalSinceArgument(firstAt, -100), `@${Math.floor(Date.parse(firstAt) / 1000)}`);
  assert.deepEqual(parseSocketEndpoint('127.0.0.1:8787'), { address: '127.0.0.1', port: 8787 });
  assert.deepEqual(parseSocketEndpoint('[2001:db8::1]:443'), { address: '2001:db8::1', port: 443 });
  assert.deepEqual(parseSocketEndpoint('*:*'), { address: '0.0.0.0', port: null });
  assert.equal(parseSocketEndpoint('missing-port'), null);
  assert.equal(parseSocketEndpoint('127.0.0.1:not-a-port'), null);

  const sockets = parseSsRecords([
    'State Recv-Q Send-Q Local Address:Port Peer Address:Port Process',
    'LISTEN 0 511 0.0.0.0:8787 0.0.0.0:* users:(("node",pid=900,fd=18))',
    'ESTAB 1 2 [2001:db8::2]:443 [2001:db8::3]:51000 users:(("proxy",pid=901,fd=9))',
    'malformed fixture line'
  ].join('\n'));
  assert.equal(sockets.length, 2);
  assert.deepEqual(sockets[0].processes, [{ name: 'node', pid: 900, fd: 18 }]);
  assert.equal(sockets[1].recvQ, 1);
  assert.equal(sockets[1].sendQ, 2);
  assert.equal(sockets[1].remote.address, '2001:db8::3');

  const events = sshFixture([
    '2026-07-18T11:00:00+0000 host sshd[1]: Accepted publickey for ec2-user from 198.51.100.10 port 55000 ssh2',
    '2026-07-18T11:01:00+0000 host sshd[2]: Failed password for invalid user admin from 203.0.113.55 port 55001 ssh2',
    '2026-07-18T11:02:00+0000 host sshd[3]: Invalid user oracle from 203.0.113.56 port 55002',
    '2026-07-18T11:03:00+0000 host sshd[4]: Accepted publickey for root from not-an-ip port 55003',
    'unrelated journal line'
  ]);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.kind), ['accepted', 'failed', 'invalid_user']);
  assert.equal(events[0].user, 'ec2-user');
  assert.equal(events[1].method, 'password');
  assert.equal(events[2].method, 'unknown');
  assert.equal(Object.hasOwn(events[0], 'raw'), false);

  assert.deepEqual(inferOutboundAttribution('codex', 443), {
    service: 'OpenAI Codex',
    provider: 'OpenAI',
    confidence: 'high',
    basis: 'The owning socket process is codex; the remote IP may be a shared edge address.'
  });
  assert.equal(inferOutboundAttribution('ssh', 22).service, 'SSH');
  assert.equal(inferOutboundAttribution('node', 443).service, 'HTTPS endpoint');
  assert.equal(inferOutboundAttribution('worker', 8443).service, 'TCP 8443 endpoint');
  assert.equal(inferOutboundAttribution('worker', null).service, 'TCP unknown endpoint');
});

test('monitor learns bootstrap SSH peers and flags only unusual live behavior', () => {
  const initialSsh = sshFixture([
    '2026-07-18T11:55:00+0000 host sshd[1]: Accepted publickey for ec2-user from 198.51.100.10 port 55000 ssh2',
    '2026-07-18T11:56:00+0000 host sshd[2]: Failed password for root from 203.0.113.55 port 55001 ssh2'
  ]);
  const first = reconcileNetworkMonitor(createNetworkMonitorStore(firstAt), {
    at: firstAt,
    bootstrap: true,
    dashboardPort: 8787,
    services: [{ id: 'prep', label: 'Prep page', ports: [8098] }],
    connections: socketFixtures(),
    listeners: listenerFixtures(),
    sshEvents: initialSsh,
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  const snapshot = networkMonitorSnapshot(first);

  assert.equal(snapshot.status, 'monitoring');
  assert.deepEqual(snapshot.counts, {
    active: 4,
    inbound: 1,
    outbound: 2,
    local: 1,
    knownInboundPeers: 1,
    activeFlags: 3,
    sshFailures24h: 1,
    recentClosed: 0,
    sshEvents: 2
  });
  assert.equal(snapshot.flags.some((flag) => flag.kind === 'unknown_inbound_peer'), false);
  assert.equal(snapshot.flags.find((flag) => flag.kind === 'unregistered_public_listener').detail.includes(':9999'), true);
  assert.equal(snapshot.flags.find((flag) => flag.kind === 'unusual_outbound_port').detail.includes(':8443'), true);
  assert.equal(snapshot.flags.find((flag) => flag.kind === 'ssh_auth_failure').tone, 'bad');
  assert.equal(snapshot.activeConnections.find((connection) => connection.direction === 'inbound').destination, 'PaneFleet :8787');
  assert.equal(snapshot.activeConnections.find((connection) => connection.process === 'codex').destination, '192.0.2.44:443');
  assert.equal(snapshot.activeConnections.find((connection) => connection.process === 'codex').attribution.provider, 'OpenAI');
  assert.equal(first.recentConnections.length, 4);
  assert.equal(first.lastSshScanAt, firstAt);
});

test('registered observation-only edge ports do not hide unrelated public listeners', () => {
  const listeners = parseSsRecords([
    'LISTEN 0 511 0.0.0.0:80 0.0.0.0:*',
    'LISTEN 0 511 0.0.0.0:443 0.0.0.0:*',
    'LISTEN 0 511 0.0.0.0:9999 0.0.0.0:* users:(("mystery",pid=905,fd=9))'
  ].join('\n'));
  const snapshot = networkMonitorSnapshot(reconcileNetworkMonitor(createNetworkMonitorStore(firstAt), {
    at: firstAt,
    dashboardPort: 8787,
    services: [{ id: 'host-https-edge', label: 'Host HTTPS Edge', ports: [80, 443] }],
    connections: [],
    listeners,
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  }));

  const activeListenerFlags = snapshot.flags.filter((flag) =>
    flag.kind === 'unregistered_public_listener' && flag.active
  );
  assert.equal(activeListenerFlags.length, 1);
  assert.equal(activeListenerFlags[0].detail.includes(':9999'), true);
  assert.equal(snapshot.flags.some((flag) => flag.detail.includes(':80,') || flag.detail.includes(':443,')), false);
});

test('public snapshot bounds display history without trimming durable retention or total counts', () => {
  const store = createNetworkMonitorStore(firstAt);
  store.recentConnections = [
    { id: 'still-active', lastSeenAt: secondAt },
    ...Array.from({ length: 25 }, (_, index) => ({
      id: `closed-${index}`,
      lastSeenAt: secondAt,
      endedAt: secondAt
    }))
  ];
  store.sshEvents = Array.from({ length: 18 }, (_, index) => ({ id: `ssh-${index}`, at: secondAt }));

  const snapshot = networkMonitorSnapshot(store);

  assert.equal(snapshot.counts.recentClosed, 25);
  assert.equal(snapshot.counts.sshEvents, 18);
  assert.equal(snapshot.recentConnections.length, 12);
  assert.equal(snapshot.recentConnections.every((connection) => connection.endedAt), true);
  assert.equal(snapshot.sshEvents.length, 12);
  assert.equal(store.recentConnections.length, 26);
  assert.equal(store.sshEvents.length, 18);
});

test('private VPC peers and interface binds remain visible as inbound exposure', () => {
  const privatePeer = ['10', '20', '30', '40'].join('.');
  const privateInterface = ['172', '31', '5', '9'].join('.');
  const connections = parseSsRecords(`ESTAB 0 0 ${privateInterface}:8787 ${privatePeer}:52000 users:(("node",pid=900,fd=20))`);
  const listeners = parseSsRecords([
    `LISTEN 0 511 ${privateInterface}:8787 0.0.0.0:* users:(("node",pid=900,fd=18))`,
    `LISTEN 0 511 ${privateInterface}:9900 0.0.0.0:* users:(("internal-tool",pid=901,fd=19))`
  ].join('\n'));
  const snapshot = networkMonitorSnapshot(reconcileNetworkMonitor(createNetworkMonitorStore(firstAt), {
    at: firstAt,
    dashboardPort: 8787,
    connections,
    listeners,
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  }));

  assert.equal(snapshot.counts.inbound, 1);
  assert.equal(snapshot.counts.local, 0);
  assert.equal(snapshot.flags.some((flag) => flag.kind === 'unknown_inbound_peer' && flag.active), true);
  assert.equal(snapshot.flags.some((flag) => flag.kind === 'unregistered_public_listener' && flag.active), true);
});

test('stable sockets refresh recent history and missing history is recreated on disconnect', () => {
  const connection = socketFixtures().slice(0, 1);
  const first = reconcileNetworkMonitor(createNetworkMonitorStore(firstAt), {
    at: firstAt,
    dashboardPort: 8787,
    connections: connection,
    listeners: listenerFixtures().slice(0, 1),
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  const refreshed = reconcileNetworkMonitor(first, {
    at: secondAt,
    dashboardPort: 8787,
    connections: connection,
    listeners: listenerFixtures().slice(0, 1),
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  assert.equal(refreshed.recentConnections[0].lastSeenAt, secondAt);
  assert.equal(refreshed.recentConnections.length, 1);

  refreshed.recentConnections = [];
  const disconnectedAt = '2026-07-18T12:06:00.000Z';
  const disconnected = reconcileNetworkMonitor(refreshed, {
    at: disconnectedAt,
    dashboardPort: 8787,
    connections: [],
    listeners: listenerFixtures().slice(0, 1),
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  assert.equal(disconnected.recentConnections.length, 1);
  assert.equal(disconnected.recentConnections[0].endedAt, disconnectedAt);
});

test('monitor detects new peers, deduplicates journal overlap, preserves outages, and resolves stale flags', () => {
  const initial = reconcileNetworkMonitor(createNetworkMonitorStore(firstAt), {
    at: firstAt,
    bootstrap: true,
    dashboardPort: 8787,
    services: [],
    connections: socketFixtures().slice(0, 1),
    listeners: listenerFixtures().slice(0, 1),
    sshEvents: sshFixture([
      '2026-07-18T11:55:00+0000 host sshd[1]: Accepted publickey for ec2-user from 198.51.100.10 port 55000 ssh2'
    ]),
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  const newEvents = sshFixture([
    '2026-07-18T12:04:00+0000 host sshd[3]: Accepted publickey for deploy from 203.0.113.80 port 56000 ssh2',
    '2026-07-18T12:04:30+0000 host sshd[4]: Failed password for root from 203.0.113.55 port 56001 ssh2',
    '2026-07-18T12:04:30+0000 host sshd[4]: Failed password for root from 203.0.113.55 port 56001 ssh2'
  ]);
  const incoming = parseSsRecords('ESTAB 0 0 192.0.2.10:8787 203.0.113.80:53000 users:(("node",pid=900,fd=20))');
  const second = reconcileNetworkMonitor(initial, {
    at: secondAt,
    bootstrap: false,
    dashboardPort: 8787,
    services: [],
    connections: incoming,
    listeners: listenerFixtures().slice(0, 1),
    sshEvents: newEvents,
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });

  assert.equal(second.sshEvents.length, 3);
  assert.equal(second.knownInboundPeers.length, 2);
  assert.equal(second.flags.some((flag) => flag.kind === 'new_ssh_peer' && flag.active), true);
  assert.equal(second.flags.some((flag) => flag.kind === 'unknown_inbound_peer' && flag.active), true);
  assert.equal(second.flags.find((flag) => flag.kind === 'ssh_auth_failure').occurrences, 1);
  assert.equal(second.recentConnections.some((connection) => connection.endedAt === secondAt), true);

  const degraded = reconcileNetworkMonitor(second, {
    at: '2026-07-18T12:06:00.000Z',
    connections: null,
    listeners: null,
    sshEvents: null,
    socketCollection: { ok: false, error: 'connection_inventory_failed' },
    sshCollection: { ok: false, error: 'ssh_journal_failed' }
  });
  assert.equal(degraded.activeConnections.length, second.activeConnections.length);
  assert.equal(degraded.lastSshScanAt, second.lastSshScanAt);
  assert.equal(networkMonitorSnapshot(degraded).status, 'degraded');

  const expired = reconcileNetworkMonitor(degraded, {
    at: '2026-07-19T13:06:00.000Z',
    dashboardPort: 8787,
    connections: [],
    listeners: [],
    sshEvents: [],
    socketCollection: { ok: true },
    sshCollection: { ok: true }
  });
  assert.equal(expired.activeConnections.length, 0);
  assert.equal(expired.flags.every((flag) => flag.active === false), true);
  assert.equal(networkMonitorSnapshot(expired).counts.activeFlags, 0);
});

test('persisted network state validation is fail-closed and disabled status is explicit', () => {
  const valid = createNetworkMonitorStore(firstAt);
  assert.equal(validateNetworkMonitorStore(valid), valid);

  for (const invalid of [
    null,
    { ...valid, version: 2 },
    { ...valid, revision: -1 },
    { ...valid, initializedAt: 'invalid' },
    { ...valid, lastSshScanAt: 'invalid' },
    { ...valid, flags: null },
    { ...valid, knownInboundPeers: [{ address: 'not-an-ip', firstAcceptedAt: firstAt, lastAcceptedAt: firstAt }] },
    { ...valid, collection: { ...valid.collection, sockets: { status: 'wat', checkedAt: null, error: '' } } }
  ]) {
    assert.throws(() => validateNetworkMonitorStore(invalid), /network_monitor_state_invalid/);
  }

  valid.collection.sockets = { status: 'disabled', checkedAt: firstAt, error: '' };
  valid.collection.ssh = { status: 'disabled', checkedAt: firstAt, error: '' };
  assert.equal(networkMonitorSnapshot(valid).status, 'disabled');
});
