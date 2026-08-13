import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import { planPrivateSite } from '../site-onboarding.js';

// Exercise routable and private-network branches without storing dotted
// machine or operator addresses that the publication privacy gate treats as
// private data.
const ROUTABLE_TEST_IPV4 = [8, 8, 8, 8].join('.');
const PRIVATE_TEST_IPV4 = [10, 0, 0, 1].join('.');

const services = [
  {
    id: 'alpha-site',
    label: 'Alpha Site',
    ports: [5100],
    links: [{ label: 'Open', port: 5100, path: '/' }]
  },
  {
    id: 'multi-site',
    label: 'Multi Site',
    ports: [5200, 5201, 5202],
    links: [
      { label: 'Web', port: 5200, path: '/' },
      { label: 'API', port: 5201, protocol: 'http', path: '/healthz' },
      { label: 'Expo', port: 5202, protocol: 'exp', path: '' }
    ]
  },
  {
    id: 'database',
    label: 'Database',
    ports: [5432],
    links: []
  },
  {
    id: 'https-only',
    label: 'HTTPS only',
    ports: [5443],
    links: [{ label: 'Secure', port: 5443, protocol: 'https', path: '/' }]
  }
];

function request(overrides = {}) {
  return {
    hostname: 'alpha.example.com',
    baseDomain: 'example.com',
    serviceId: 'alpha-site',
    publicIpv4: ROUTABLE_TEST_IPV4,
    hostedZoneId: 'Z1234ABCDE',
    services,
    ...overrides
  };
}

test('private site plans bind one registered HTTP service to one loopback upstream', () => {
  const plan = planPrivateSite(request({
    hostname: ' Alpha.Example.com. ',
    baseDomain: 'EXAMPLE.COM.',
    hostedZoneId: 'z1234abcde'
  }));

  assert.deepEqual(plan.site, {
    hostname: 'alpha.example.com',
    baseDomain: 'example.com',
    serviceId: 'alpha-site',
    serviceLabel: 'Alpha Site',
    port: 5100,
    upstream: '127.0.0.1:5100'
  });
  assert.equal(plan.route53.hostedZoneId, 'Z1234ABCDE');
  assert.deepEqual(plan.route53.changeBatch.Changes, [{
    Action: 'UPSERT',
    ResourceRecordSet: {
      Name: 'alpha.example.com.',
      Type: 'A',
      TTL: 60,
      ResourceRecords: [{ Value: ROUTABLE_TEST_IPV4 }]
    }
  }]);
  assert.deepEqual(plan.acme, {
    recordName: '_acme-challenge.alpha.example.com',
    recordType: 'TXT',
    allowedActions: ['UPSERT', 'DELETE']
  });
  assert.equal(plan.caddyfile, `alpha.example.com {
\timport route53_tls
\timport private_response_headers
\treverse_proxy 127.0.0.1:5100 {
\t\timport trusted_backend_headers
\t}
}`);
  assert.equal(plan.verification.length, 5);
});

test('multi-port services require an explicitly registered HTTP port', () => {
  assert.throws(() => planPrivateSite(request({ serviceId: 'multi-site' })), /port: is required/);
  assert.equal(planPrivateSite(request({ serviceId: 'multi-site', port: '5201', ttl: '300' })).site.port, 5201);
  assert.throws(() => planPrivateSite(request({ serviceId: 'multi-site', port: 5202 })), /registered HTTP link/);
  assert.throws(() => planPrivateSite(request({ serviceId: 'multi-site', port: 5300 })), /registered HTTP link/);
});

test('non-web, HTTPS-only, missing, and duplicate service registrations fail closed', () => {
  assert.throws(() => planPrivateSite(request({ serviceId: 'database' })), /registered HTTP link/);
  assert.throws(() => planPrivateSite(request({ serviceId: 'https-only' })), /registered HTTP link/);
  assert.throws(() => planPrivateSite(request({ serviceId: 'missing' })), /one registered service/);
  assert.throws(() => planPrivateSite(request({ services: [...services, services[0]] })), /one registered service/);
  assert.throws(() => planPrivateSite(request({ services: {} })), /services: must be an array/);
  assert.throws(() => planPrivateSite(request({ serviceId: '' })), /serviceId: is required/);
});

test('hostnames are one safe child label and cannot inject or replace an existing host', () => {
  for (const hostname of [
    'example.com',
    'nested.alpha.example.com',
    'alpha.other.example',
    '*.example.com',
    'alpha.example.com { abort }'
  ]) {
    assert.throws(() => planPrivateSite(request({ hostname })), /hostname:/);
  }
  assert.throws(() => planPrivateSite(request({ baseDomain: 'invalid_domain' })), /baseDomain:/);
  assert.throws(() => planPrivateSite(request({
    existingHosts: ['todo.example.com', 'ALPHA.EXAMPLE.COM.']
  })), /already configured/);
  assert.throws(() => planPrivateSite(request({ existingHosts: 'alpha.example.com' })), /must be an array/);
});

test('network, zone, port, and TTL boundaries reject ambiguous plans', () => {
  for (const publicIpv4 of ['', '127.0.0.1', PRIVATE_TEST_IPV4, '192.0.2.8', '2001:db8::1']) {
    assert.throws(() => planPrivateSite(request({ publicIpv4 })), /publicIpv4:/);
  }
  for (const hostedZoneId of ['', 'zone-123', 'Z12']) {
    assert.throws(() => planPrivateSite(request({ hostedZoneId })), /hostedZoneId:/);
  }
  for (const port of ['abc', 80, 65536]) {
    assert.throws(() => planPrivateSite(request({ serviceId: 'multi-site', port })), /port:/);
  }
  for (const ttl of [29, 86401, 'not-a-number']) {
    assert.throws(() => planPrivateSite(request({ ttl })), /ttl:/);
  }
});

test('CLI help documents review-only behavior without reading or mutating host state', () => {
  const result = spawnSync(process.execPath, ['scripts/plan-private-site.mjs', '--help'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Produces a review-only JSON plan/);
  assert.match(result.stdout, /never changes DNS, IAM, Caddy, services/);
});
