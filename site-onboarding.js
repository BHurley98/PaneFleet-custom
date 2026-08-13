import { isIP } from 'node:net';

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTED_ZONE_ID = /^Z[A-Z0-9]{4,31}$/;

function invalid(field, message) {
  throw new Error(`${field}: ${message}`);
}

function normalizedDomain(value, field) {
  const domain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!domain || domain.length > 253) invalid(field, 'must be a valid DNS name');
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !HOST_LABEL.test(label))) {
    invalid(field, 'must be a valid DNS name');
  }
  return domain;
}

function normalizedChildHostname(value, baseDomain) {
  const hostname = normalizedDomain(value, 'hostname');
  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix)) invalid('hostname', `must be one child label beneath ${baseDomain}`);
  const child = hostname.slice(0, -suffix.length);
  if (!HOST_LABEL.test(child)) invalid('hostname', `must be one child label beneath ${baseDomain}`);
  return hostname;
}

function normalizedPort(value, field = 'port') {
  const port = typeof value === 'number' ? value : Number(String(value || '').trim());
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    invalid(field, 'must be an integer from 1024 through 65535');
  }
  return port;
}

function publicIpv4(value) {
  const address = String(value || '').trim();
  if (isIP(address) !== 4) invalid('publicIpv4', 'must be one IPv4 address');
  const [a, b, c] = address.split('.').map(Number);
  const nonPublic = a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
  if (nonPublic) invalid('publicIpv4', 'must be a routable public IPv4 address');
  return address;
}

function selectedService(services, serviceId, requestedPort) {
  if (!Array.isArray(services)) invalid('services', 'must be an array');
  const id = String(serviceId || '').trim();
  if (!id) invalid('serviceId', 'is required');
  const matches = services.filter((service) => service?.id === id);
  if (matches.length !== 1) invalid('serviceId', 'must identify one registered service');
  const service = matches[0];
  const declaredPorts = new Set((Array.isArray(service.ports) ? service.ports : [])
    .filter((port) => Number.isInteger(port) && port >= 1024 && port <= 65535));
  const httpPorts = [...new Set((Array.isArray(service.links) ? service.links : [])
    .filter((link) => !link?.protocol || link.protocol === 'http')
    .map((link) => link?.port)
    .filter((port) => declaredPorts.has(port)))];
  if (!httpPorts.length) invalid('serviceId', 'must expose a registered HTTP link');

  let port;
  if (requestedPort === undefined || requestedPort === null || requestedPort === '') {
    if (httpPorts.length !== 1) invalid('port', 'is required when the service has multiple HTTP ports');
    [port] = httpPorts;
  } else {
    port = normalizedPort(requestedPort);
    if (!httpPorts.includes(port)) invalid('port', 'must match a registered HTTP link for the service');
  }
  return {
    id,
    label: String(service.label || id),
    port
  };
}

function caddySiteBlock(hostname, port) {
  return `${hostname} {
\timport route53_tls
\timport private_response_headers
\treverse_proxy 127.0.0.1:${port} {
\t\timport trusted_backend_headers
\t}
}`;
}

export function planPrivateSite({
  hostname,
  baseDomain,
  serviceId,
  port,
  publicIpv4: requestedPublicIpv4,
  hostedZoneId,
  services,
  existingHosts = [],
  ttl = 60
} = {}) {
  const domain = normalizedDomain(baseDomain, 'baseDomain');
  const normalizedHostname = normalizedChildHostname(hostname, domain);
  const zoneId = String(hostedZoneId || '').trim().toUpperCase();
  if (!HOSTED_ZONE_ID.test(zoneId)) invalid('hostedZoneId', 'must be a Route 53 hosted-zone identifier');
  const address = publicIpv4(requestedPublicIpv4);
  const selected = selectedService(services, serviceId, port);
  const normalizedTtl = Number(ttl);
  if (!Number.isInteger(normalizedTtl) || normalizedTtl < 30 || normalizedTtl > 86400) {
    invalid('ttl', 'must be an integer from 30 through 86400');
  }
  if (!Array.isArray(existingHosts)) invalid('existingHosts', 'must be an array');
  const occupied = new Set(existingHosts.map((entry) => normalizedDomain(entry, 'existingHosts')));
  if (occupied.has(normalizedHostname)) invalid('hostname', 'is already configured');

  return {
    version: 1,
    site: {
      hostname: normalizedHostname,
      baseDomain: domain,
      serviceId: selected.id,
      serviceLabel: selected.label,
      port: selected.port,
      upstream: `127.0.0.1:${selected.port}`
    },
    route53: {
      hostedZoneId: zoneId,
      changeBatch: {
        Comment: `PaneFleet private site ${normalizedHostname}`,
        Changes: [{
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: `${normalizedHostname}.`,
            Type: 'A',
            TTL: normalizedTtl,
            ResourceRecords: [{ Value: address }]
          }
        }]
      }
    },
    acme: {
      recordName: `_acme-challenge.${normalizedHostname}`,
      recordType: 'TXT',
      allowedActions: ['UPSERT', 'DELETE']
    },
    caddyfile: caddySiteBlock(normalizedHostname, selected.port),
    verification: [
      `confirm ${selected.port} listens only on loopback`,
      `confirm ${normalizedHostname} resolves only to ${address}`,
      'validate the complete Caddy configuration before reload',
      `confirm trusted HTTPS reaches only 127.0.0.1:${selected.port}`,
      'confirm security-group ingress remains restricted to the approved exact source'
    ]
  };
}
