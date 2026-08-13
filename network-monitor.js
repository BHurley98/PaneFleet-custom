import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const STORE_VERSION = 1;
const MAX_ACTIVE_CONNECTIONS = 500;
const MAX_RECENT_CONNECTIONS = 500;
const MAX_SSH_EVENTS = 500;
const MAX_FLAGS = 200;
const MAX_KNOWN_PEERS = 100;
const PUBLIC_HISTORY_LIMIT = 12;
const SSH_FLAG_WINDOW_MS = 24 * 60 * 60 * 1000;
const COMMON_OUTBOUND_PORTS = new Set([53, 80, 123, 443]);
const TOPOLOGY_FLAG_KINDS = new Set([
  'unknown_inbound_peer',
  'unregistered_public_listener',
  'unusual_outbound_port'
]);

function isoTimestamp(value) {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) return '';
  return new Date(value).toISOString();
}

function boundedText(value, maximum = 160) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maximum);
}

function stableId(prefix, value) {
  return `${prefix}-${createHash('sha256').update(String(value)).digest('hex').slice(0, 20)}`;
}

function isLoopbackSocketAddress(value) {
  const address = String(value || '').replace(/^::ffff:/, '').split('%', 1)[0].toLowerCase();
  return !address
    || address === '*'
    || address === '0.0.0.0'
    || address === '::'
    || address === 'localhost'
    || address === '::1'
    || (isIP(address) === 4 && Number(address.split('.')[0]) === 127);
}

export function parseSocketEndpoint(value) {
  const text = String(value || '').trim();
  const separator = text.lastIndexOf(':');
  if (separator < 0) return null;
  let address = text.slice(0, separator).replace(/^\[|\]$/g, '').replace(/^::ffff:/, '');
  const portText = text.slice(separator + 1);
  if (address === '*') address = '0.0.0.0';
  const port = portText === '*' ? null : Number(portText);
  if (port !== null && (!Number.isInteger(port) || port < 0 || port > 65535)) return null;
  return { address: boundedText(address, 80), port };
}

function socketProcesses(processText) {
  return [...String(processText || '').matchAll(/\("([^"]+)",pid=(\d+)(?:,fd=(\d+))?/g)]
    .slice(0, 8)
    .map((match) => ({
      name: boundedText(match[1], 80),
      pid: Number(match[2]),
      ...(match[3] ? { fd: Number(match[3]) } : {})
    }));
}

export function parseSsRecords(output) {
  const records = [];
  for (const rawLine of String(output || '').split('\n')) {
    const line = rawLine.trim();
    if (!line || /^State\s+Recv-Q\b/i.test(line)) continue;
    const fields = line.split(/\s+/);
    const state = /^[A-Z][A-Z0-9-]+$/.test(fields[0] || '') ? fields.shift() : '';
    if (fields.length < 4) continue;
    const recvQ = Number(fields.shift());
    const sendQ = Number(fields.shift());
    const local = parseSocketEndpoint(fields.shift());
    const remote = parseSocketEndpoint(fields.shift());
    if (!local || !remote) continue;
    records.push({
      state,
      recvQ: Number.isFinite(recvQ) ? recvQ : 0,
      sendQ: Number.isFinite(sendQ) ? sendQ : 0,
      local,
      remote,
      processes: socketProcesses(fields.join(' '))
    });
  }
  return records;
}

function journalTimestamp(value) {
  const normalized = String(value || '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  return isoTimestamp(normalized);
}

export function parseSshJournal(output) {
  const events = [];
  for (const rawLine of String(output || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const timestampText = line.split(/\s+/, 1)[0];
    const at = journalTimestamp(timestampText);
    const accepted = line.match(/Accepted\s+(publickey|password|keyboard-interactive)\s+for\s+(\S+)\s+from\s+(\S+)\s+port\s+(\d+)/i);
    const failed = line.match(/Failed\s+(publickey|password|keyboard-interactive)\s+for\s+(?:invalid user\s+)?(\S+)\s+from\s+(\S+)\s+port\s+(\d+)/i);
    const invalid = line.match(/Invalid user\s+(\S+)\s+from\s+(\S+)\s+port\s+(\d+)/i);
    const match = accepted || failed || invalid;
    if (!at || !match) continue;
    const kind = accepted ? 'accepted' : failed ? 'failed' : 'invalid_user';
    const invalidOnly = !accepted && !failed;
    const method = invalidOnly ? 'unknown' : String(match[1]).toLowerCase();
    const userIndex = invalidOnly ? 1 : 2;
    const addressIndex = invalidOnly ? 2 : 3;
    const portIndex = invalidOnly ? 3 : 4;
    const remoteAddress = boundedText(match[addressIndex], 80).replace(/^::ffff:/, '');
    if (!isIP(remoteAddress)) continue;
    events.push({
      id: stableId('ssh', `${kind}|${at}|${line}`),
      kind,
      at,
      method,
      user: boundedText(match[userIndex], 80),
      remoteAddress,
      remotePort: Number(match[portIndex]),
      destination: 'SSH :22'
    });
  }
  return events;
}

export function journalSinceArgument(lastScanAt, overlapMs = 2000) {
  const parsed = Date.parse(String(lastScanAt || ''));
  if (!Number.isFinite(parsed)) return '24 hours ago';
  const overlap = Number.isFinite(Number(overlapMs)) ? Math.max(0, Number(overlapMs)) : 2000;
  return `@${Math.max(0, Math.floor((parsed - overlap) / 1000))}`;
}

export function createNetworkMonitorStore(at = new Date().toISOString()) {
  const timestamp = isoTimestamp(at) || new Date().toISOString();
  return {
    version: STORE_VERSION,
    revision: 0,
    initializedAt: timestamp,
    updatedAt: timestamp,
    lastSshScanAt: null,
    knownInboundPeers: [],
    activeConnections: [],
    recentConnections: [],
    sshEvents: [],
    flags: [],
    collection: {
      sockets: { status: 'starting', checkedAt: null, error: '' },
      ssh: { status: 'starting', checkedAt: null, error: '' }
    }
  };
}

function validCollectionItem(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && ['starting', 'ok', 'error', 'disabled'].includes(value.status)
    && (value.checkedAt === null || Boolean(isoTimestamp(value.checkedAt)))
    && typeof value.error === 'string' && value.error.length <= 160;
}

export function validateNetworkMonitorStore(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store) || store.version !== STORE_VERSION) {
    throw new Error('network_monitor_state_invalid');
  }
  if (!Number.isInteger(store.revision) || store.revision < 0 || !isoTimestamp(store.initializedAt) || !isoTimestamp(store.updatedAt)) {
    throw new Error('network_monitor_state_invalid');
  }
  if (store.lastSshScanAt !== null && !isoTimestamp(store.lastSshScanAt)) throw new Error('network_monitor_state_invalid');
  const limits = [
    ['knownInboundPeers', MAX_KNOWN_PEERS],
    ['activeConnections', MAX_ACTIVE_CONNECTIONS],
    ['recentConnections', MAX_RECENT_CONNECTIONS],
    ['sshEvents', MAX_SSH_EVENTS],
    ['flags', MAX_FLAGS]
  ];
  for (const [key, limit] of limits) {
    if (!Array.isArray(store[key]) || store[key].length > limit || store[key].some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw new Error('network_monitor_state_invalid');
    }
  }
  if (store.knownInboundPeers.some((peer) => !isIP(String(peer.address || '')) || !isoTimestamp(peer.firstAcceptedAt) || !isoTimestamp(peer.lastAcceptedAt))) {
    throw new Error('network_monitor_state_invalid');
  }
  if (!store.collection || !validCollectionItem(store.collection.sockets) || !validCollectionItem(store.collection.ssh)) {
    throw new Error('network_monitor_state_invalid');
  }
  return store;
}

function publicListener(record) {
  const address = record.local.address.toLowerCase();
  return ['0.0.0.0', '::'].includes(address) || !isLoopbackSocketAddress(address);
}

function connectionIdentity(connection) {
  const processes = connection.processes.map((process) => `${process.name}:${process.pid}`).join(',');
  return `${connection.state}|${connection.local.address}:${connection.local.port}|${connection.remote.address}:${connection.remote.port}|${processes}`;
}

function servicePortMap(services, dashboardPort) {
  const ports = new Map([[22, 'SSH'], [Number(dashboardPort), 'PaneFleet']]);
  for (const service of services || []) {
    for (const value of service.ports || []) {
      const port = Number(value);
      if (Number.isInteger(port) && port > 0 && port <= 65535 && !ports.has(port)) {
        ports.set(port, boundedText(service.label || service.id || `TCP ${port}`, 100));
      }
    }
  }
  return ports;
}

export function inferOutboundAttribution(processName, remotePort) {
  const process = boundedText(processName || 'unknown', 80);
  const port = remotePort === null || remotePort === undefined || remotePort === '' ? Number.NaN : Number(remotePort);
  if (/^codex(?:[.-]|$)/i.test(process)) {
    return {
      service: 'OpenAI Codex',
      provider: 'OpenAI',
      confidence: 'high',
      basis: 'The owning socket process is codex; the remote IP may be a shared edge address.'
    };
  }
  if (/^ssh$/i.test(process) && port === 22) {
    return {
      service: 'SSH',
      provider: 'Unknown remote host',
      confidence: 'high',
      basis: 'The owning process and destination port identify SSH, but not the remote organization.'
    };
  }
  const protocol = ({ 53: 'DNS', 80: 'HTTP', 123: 'NTP', 443: 'HTTPS' })[port] || `TCP ${Number.isInteger(port) ? port : 'unknown'}`;
  return {
    service: `${protocol} endpoint`,
    provider: 'Unidentified',
    confidence: 'low',
    basis: `The destination port indicates ${protocol}; the provider is not proven.`
  };
}

function connectionRecord(record, listeners, ports, at, prior) {
  const listenerPorts = new Set(listeners.map((listener) => listener.local.port));
  const localPeer = isLoopbackSocketAddress(record.remote.address);
  const direction = localPeer ? 'local' : listenerPorts.has(record.local.port) ? 'inbound' : 'outbound';
  const process = record.processes[0] || (record.local.port === 22 ? { name: 'sshd', pid: null } : { name: 'unknown', pid: null });
  const destination = direction === 'inbound'
    ? `${ports.get(record.local.port) || 'Unregistered TCP'} :${record.local.port}`
    : direction === 'outbound'
      ? `${record.remote.address}:${record.remote.port}`
      : `local ${record.remote.address}:${record.remote.port}`;
  return {
    id: prior?.id || stableId('connection', `${connectionIdentity(record)}|${at}`),
    key: stableId('socket', connectionIdentity(record)),
    state: record.state || 'ESTAB',
    direction,
    localAddress: record.local.address,
    localPort: record.local.port,
    remoteAddress: record.remote.address,
    remotePort: record.remote.port,
    process: process.name,
    pid: process.pid,
    destination,
    attribution: direction === 'outbound' ? inferOutboundAttribution(process.name, record.remote.port) : null,
    firstSeenAt: prior?.firstSeenAt || at,
    lastSeenAt: at,
    endedAt: null
  };
}

function upsertFlag(flags, candidate) {
  const prior = flags.find((flag) => flag.id === candidate.id);
  if (prior) Object.assign(prior, candidate, { firstSeenAt: prior.firstSeenAt });
  else flags.push(candidate);
}

function anomalyFlag(kind, key, title, detail, at, extra = {}) {
  return {
    id: stableId('network-flag', `${kind}|${key}`),
    kind,
    title,
    detail,
    status: 'unusual',
    tone: extra.tone || 'warn',
    requiresDecision: extra.requiresDecision !== false,
    active: true,
    occurrences: Number(extra.occurrences || 1),
    firstSeenAt: at,
    updatedAt: at
  };
}

function updateKnownPeer(peers, address, at) {
  const prior = peers.find((peer) => peer.address === address);
  if (prior) prior.lastAcceptedAt = at;
  else peers.push({ address, firstAcceptedAt: at, lastAcceptedAt: at });
}

function currentCollection(prior, update, at) {
  if (!update) return prior;
  return {
    status: update.ok ? 'ok' : 'error',
    checkedAt: at,
    error: update.ok ? '' : boundedText(update.error || 'collection_failed', 160)
  };
}

export function reconcileNetworkMonitor(store, input = {}) {
  validateNetworkMonitorStore(store);
  const at = isoTimestamp(input.at) || new Date().toISOString();
  const next = structuredClone(store);
  const ports = servicePortMap(input.services || [], input.dashboardPort);
  const socketRecords = Array.isArray(input.connections) ? input.connections.filter((record) => ['ESTAB', 'ESTABLISHED', ''].includes(record.state)) : null;
  const listenerRecords = Array.isArray(input.listeners) ? input.listeners.filter((record) => record.state === 'LISTEN' || !record.state) : null;
  const listeners = listenerRecords || [];
  const topologyFlags = [];

  if (input.bootstrap) {
    for (const event of Array.isArray(input.sshEvents) ? input.sshEvents : []) {
      if (event.kind === 'accepted') updateKnownPeer(next.knownInboundPeers, event.remoteAddress, event.at);
    }
  }

  if (socketRecords) {
    const priorByKey = new Map(next.activeConnections.map((connection) => [connection.key, connection]));
    const current = socketRecords.slice(0, MAX_ACTIVE_CONNECTIONS).map((record) => {
      const key = stableId('socket', connectionIdentity(record));
      return connectionRecord(record, listeners, ports, at, priorByKey.get(key));
    });
    const currentKeys = new Set(current.map((connection) => connection.key));
    for (const prior of next.activeConnections) {
      if (currentKeys.has(prior.key)) continue;
      const recent = next.recentConnections.find((connection) => connection.id === prior.id);
      if (recent) Object.assign(recent, { lastSeenAt: prior.lastSeenAt, endedAt: at });
      else next.recentConnections.push({ ...prior, endedAt: at });
    }
    for (const connection of current) {
      if (!next.recentConnections.some((recent) => recent.id === connection.id)) next.recentConnections.push({ ...connection });
      else Object.assign(next.recentConnections.find((recent) => recent.id === connection.id), connection);
      if (connection.direction === 'inbound'
        && !isLoopbackSocketAddress(connection.remoteAddress)
        && !next.knownInboundPeers.some((peer) => peer.address === connection.remoteAddress)) {
        topologyFlags.push(anomalyFlag(
          'unknown_inbound_peer',
          `${connection.remoteAddress}|${connection.localPort}`,
          'Inbound connection from an unknown peer',
          `${connection.remoteAddress} is connected to ${connection.destination}.`,
          at
        ));
      }
      if (connection.direction === 'outbound' && !COMMON_OUTBOUND_PORTS.has(connection.remotePort)) {
        topologyFlags.push(anomalyFlag(
          'unusual_outbound_port',
          `${connection.process}|${connection.remoteAddress}|${connection.remotePort}`,
          'Outbound connection uses an unusual port',
          `${connection.process} is connected to ${connection.remoteAddress}:${connection.remotePort}.`,
          at
        ));
      }
    }
    next.activeConnections = current;
  }

  if (listenerRecords) {
    for (const listener of listeners) {
      if (!publicListener(listener) || ports.has(listener.local.port)) continue;
      const process = listener.processes[0]?.name || 'unknown process';
      topologyFlags.push(anomalyFlag(
        'unregistered_public_listener',
        `${listener.local.address}|${listener.local.port}|${process}`,
        'Public listener is not registered',
        `${process} is listening on ${listener.local.address}:${listener.local.port}, outside services.json.`,
        at
      ));
    }
  }

  const seenSshIds = new Set(next.sshEvents.map((event) => event.id));
  for (const event of Array.isArray(input.sshEvents) ? input.sshEvents : []) {
    if (seenSshIds.has(event.id)) continue;
    seenSshIds.add(event.id);
    next.sshEvents.push(event);
    const known = next.knownInboundPeers.some((peer) => peer.address === event.remoteAddress);
    if (event.kind === 'accepted') {
      if (!input.bootstrap && !known) {
        upsertFlag(next.flags, anomalyFlag(
          'new_ssh_peer',
          event.remoteAddress,
          'SSH login from a new peer',
          `${event.user} authenticated from ${event.remoteAddress}.`,
          event.at
        ));
      }
      updateKnownPeer(next.knownInboundPeers, event.remoteAddress, event.at);
    } else {
      const id = stableId('network-flag', `ssh_auth_failure|${event.remoteAddress}`);
      const prior = next.flags.find((flag) => flag.id === id);
      upsertFlag(next.flags, anomalyFlag(
        'ssh_auth_failure',
        event.remoteAddress,
        'SSH authentication failed',
        `${event.remoteAddress} attempted ${event.kind === 'invalid_user' ? 'an invalid user' : `the ${event.user} account`}.`,
        event.at,
        { tone: 'bad', occurrences: Number(prior?.occurrences || 0) + 1 }
      ));
    }
  }

  for (const flag of next.flags) {
    if (TOPOLOGY_FLAG_KINDS.has(flag.kind)) flag.active = false;
    else if (['new_ssh_peer', 'ssh_auth_failure'].includes(flag.kind)) {
      flag.active = Date.parse(at) - Date.parse(flag.updatedAt) < SSH_FLAG_WINDOW_MS;
    }
  }
  for (const flag of topologyFlags) upsertFlag(next.flags, flag);

  next.activeConnections = next.activeConnections.slice(0, MAX_ACTIVE_CONNECTIONS);
  next.recentConnections = next.recentConnections
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_RECENT_CONNECTIONS);
  next.sshEvents = next.sshEvents.sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, MAX_SSH_EVENTS);
  next.knownInboundPeers = next.knownInboundPeers.sort((left, right) => Date.parse(right.lastAcceptedAt) - Date.parse(left.lastAcceptedAt)).slice(0, MAX_KNOWN_PEERS);
  next.flags = next.flags.sort((left, right) => Number(right.active) - Number(left.active) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, MAX_FLAGS);
  next.collection = {
    sockets: currentCollection(next.collection.sockets, input.socketCollection, at),
    ssh: currentCollection(next.collection.ssh, input.sshCollection, at)
  };
  next.lastSshScanAt = input.sshCollection?.ok ? at : next.lastSshScanAt;
  next.updatedAt = at;
  next.revision += 1;
  return validateNetworkMonitorStore(next);
}

export function networkMonitorSnapshot(store) {
  validateNetworkMonitorStore(store);
  const activeFlags = store.flags.filter((flag) => flag.active);
  const recentClosedConnections = store.recentConnections.filter((connection) => connection.endedAt);
  const collectionStatuses = Object.values(store.collection).map((item) => item.status);
  return {
    status: collectionStatuses.every((status) => status === 'disabled')
      ? 'disabled'
      : collectionStatuses.some((status) => status === 'error')
        ? 'degraded'
        : collectionStatuses.some((status) => status === 'starting') ? 'starting' : 'monitoring',
    initializedAt: store.initializedAt,
    updatedAt: store.updatedAt,
    collection: structuredClone(store.collection),
    counts: {
      active: store.activeConnections.length,
      inbound: store.activeConnections.filter((connection) => connection.direction === 'inbound').length,
      outbound: store.activeConnections.filter((connection) => connection.direction === 'outbound').length,
      local: store.activeConnections.filter((connection) => connection.direction === 'local').length,
      knownInboundPeers: store.knownInboundPeers.length,
      activeFlags: activeFlags.length,
      sshFailures24h: activeFlags.filter((flag) => flag.kind === 'ssh_auth_failure').reduce((total, flag) => total + flag.occurrences, 0),
      recentClosed: recentClosedConnections.length,
      sshEvents: store.sshEvents.length
    },
    activeConnections: structuredClone(store.activeConnections),
    recentConnections: structuredClone(recentClosedConnections.slice(0, PUBLIC_HISTORY_LIMIT)),
    sshEvents: structuredClone(store.sshEvents.slice(0, PUBLIC_HISTORY_LIMIT)),
    flags: structuredClone(store.flags.slice(0, 100))
  };
}
