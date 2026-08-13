#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { planPrivateSite } from '../site-onboarding.js';

const usage = `usage: node scripts/plan-private-site.mjs \\
  --hostname <site.example.com> --base-domain <example.com> \\
  --service-id <registered-service> [--port <http-port>] \\
  --public-ip <public-ipv4> --hosted-zone-id <route53-zone-id> \\
  [--existing-hosts <comma-separated-hosts>] [--ttl <seconds>]

Produces a review-only JSON plan. It never changes DNS, IAM, Caddy, services,
ingress, queues, or agents.
`;

try {
  const { values } = parseArgs({
    strict: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      hostname: { type: 'string' },
      'base-domain': { type: 'string' },
      'service-id': { type: 'string' },
      port: { type: 'string' },
      'public-ip': { type: 'string' },
      'hosted-zone-id': { type: 'string' },
      'existing-hosts': { type: 'string' },
      ttl: { type: 'string' }
    }
  });
  if (values.help) {
    process.stdout.write(usage);
    process.exit(0);
  }
  const services = JSON.parse(await readFile(new URL('../services.json', import.meta.url), 'utf8'));
  const existingHosts = String(values['existing-hosts'] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const plan = planPrivateSite({
    hostname: values.hostname,
    baseDomain: values['base-domain'],
    serviceId: values['service-id'],
    port: values.port,
    publicIpv4: values['public-ip'],
    hostedZoneId: values['hosted-zone-id'],
    existingHosts,
    ttl: values.ttl === undefined ? 60 : values.ttl,
    services
  });
  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`private site plan failed: ${error.message}\n`);
  process.stderr.write(usage);
  process.exitCode = 1;
}
