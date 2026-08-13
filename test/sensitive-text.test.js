import assert from 'node:assert/strict';
import { test } from 'node:test';

import { redactSensitive, redactionCount } from '../sensitive-text.js';

test('redaction replaces unprefixed credentials without leaking match offsets', () => {
  const joined = (...parts) => parts.join('');
  const credentialHost = joined('example', '.invalid');
  const cases = [
    joined('AK', 'IA', '1234567890ABCDEF'),
    joined('sk', '-proj-', 'abcdefghijklmnopqrstuvwx'),
    joined('gh', 'p_', 'abcdefghijklmnopqrstuvwx'),
    joined('-----BEGIN ', 'PRIVATE', ' KEY-----'),
    joined('postgresql', '://', 'user', ':', 'pass', '@', credentialHost, '/db'),
    joined('mysql', '://', 'user', ':', 'pass', '@', credentialHost, '/db'),
    joined('redis', '://', 'user', ':', 'pass', '@', credentialHost, '/0'),
    joined('https', '://', 'user', ':', 'pass', '@', credentialHost, '/private'),
    joined('abcdefghijklmnopqrstuvwx', '.', 'abcdef', '.', 'abcdefghijklmnopqrstuvwx')
  ];
  for (const secret of cases) {
    assert.equal(redactSensitive(`before ${secret} after`), 'before [REDACTED] after');
  }
});

test('redaction preserves only intentional credential-label prefixes', () => {
  assert.equal(
    redactSensitive('auth Bearer abcdefghijklmnopqrstuvwxyz'),
    'auth Bearer [REDACTED]'
  );
  assert.equal(
    redactSensitive('value OPENAI_API_KEY=synthetic-value'),
    'value OPENAI_API_KEY[REDACTED]'
  );
  assert.equal(redactSensitive(null), '');
});

test('redaction counts only tags introduced by sanitization', () => {
  const original = 'existing [REDACTED], plus token=synthetic-value';
  const redacted = redactSensitive(original);
  assert.equal(redacted, 'existing [REDACTED], plus token[REDACTED]');
  assert.equal(redactionCount(original, redacted), 1);
});
