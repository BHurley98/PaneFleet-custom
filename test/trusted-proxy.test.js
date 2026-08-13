import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trustedLoopbackProxyIpv4 } from '../trusted-proxy.js';

test('loopback proxy trust is explicit and accepts one exact IPv4 value', () => {
  assert.equal(trustedLoopbackProxyIpv4({
    remoteAddress: '127.0.0.1',
    forwardedFor: '192.0.2.10',
    enabled: true
  }), '192.0.2.10');
  assert.equal(trustedLoopbackProxyIpv4({
    remoteAddress: '::ffff:127.0.0.1',
    forwardedFor: '198.51.100.8',
    enabled: true
  }), '198.51.100.8');
  assert.equal(trustedLoopbackProxyIpv4({
    remoteAddress: '::1',
    forwardedFor: '203.0.113.11',
    enabled: true
  }), '203.0.113.11');
});

test('disabled or non-loopback peers can never supply the requester address', () => {
  assert.equal(trustedLoopbackProxyIpv4({
    remoteAddress: '127.0.0.1',
    forwardedFor: '192.0.2.10'
  }), '');
  assert.equal(trustedLoopbackProxyIpv4({
    remoteAddress: '192.0.2.200',
    forwardedFor: '192.0.2.10',
    enabled: true
  }), '');
});

test('ambiguous, malformed, and non-IPv4 forwarding values fail closed', () => {
  for (const forwardedFor of [
    '',
    '192.0.2.10, 127.0.0.1',
    'unknown',
    '2001:db8::1',
    ['192.0.2.10']
  ]) {
    assert.equal(trustedLoopbackProxyIpv4({
      remoteAddress: '127.0.0.1',
      forwardedFor,
      enabled: true
    }), '');
  }
});
