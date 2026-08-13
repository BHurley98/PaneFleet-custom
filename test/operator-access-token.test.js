import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { loadOperatorAccessToken, validOperatorAccessToken } from '../operator-access-token.js';

test('operator access-token validation enforces printable bounded credentials', () => {
  assert.equal(validOperatorAccessToken('a'.repeat(24)), true);
  assert.equal(validOperatorAccessToken('~'.repeat(512)), true);
  for (const invalid of ['', 'a'.repeat(23), 'a'.repeat(513), `a${' '.repeat(23)}`, `${'a'.repeat(24)}\n`]) {
    assert.equal(validOperatorAccessToken(invalid), false);
  }
});

test('configured operator tokens bypass the filesystem only when valid', async () => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'panefleet-configured-token-'));
  const tokenPath = path.join(fixtureDir, 'access-token');
  try {
    const configuredToken = 'configured-access-token-1234';
    assert.equal(
      await loadOperatorAccessToken({ accessTokenPath: tokenPath, configuredToken }),
      configuredToken
    );
    assert.equal(existsSync(tokenPath), false);
    await assert.rejects(
      loadOperatorAccessToken({ accessTokenPath: tokenPath, configuredToken: 'too-short' }),
      /orchestrator_access_token_invalid/
    );
    await assert.rejects(loadOperatorAccessToken(), /accessTokenPath is required/);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('operator tokens are generated with canonical permissions and securely reused', async () => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'panefleet-generated-token-'));
  const tokenPath = path.join(fixtureDir, 'access-token');
  try {
    const generated = await loadOperatorAccessToken({ accessTokenPath: tokenPath });
    assert.equal(validOperatorAccessToken(generated), true);
    assert.equal(readFileSync(tokenPath, 'utf8'), `${generated}\n`);
    assert.equal(statSync(tokenPath).mode & 0o777, 0o600);

    chmodSync(tokenPath, 0o400);
    assert.equal(await loadOperatorAccessToken({ accessTokenPath: tokenPath }), generated);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('unsafe token-file sources fail closed', async (t) => {
  const validToken = 'v'.repeat(32);
  const cases = [
    {
      name: 'broad permissions',
      setup(tokenPath) {
        writeFileSync(tokenPath, `${validToken}\n`, { mode: 0o644 });
        chmodSync(tokenPath, 0o644);
      },
      error: /orchestrator_access_token_file_permissions_invalid/
    },
    {
      name: 'owner-executable permissions',
      setup(tokenPath) {
        writeFileSync(tokenPath, `${validToken}\n`, { mode: 0o700 });
      },
      error: /orchestrator_access_token_file_permissions_invalid/
    },
    {
      name: 'owner-write-only permissions',
      setup(tokenPath) {
        writeFileSync(tokenPath, `${validToken}\n`, { mode: 0o200 });
      },
      error: /orchestrator_access_token_file_permissions_invalid/
    },
    {
      name: 'symlink',
      setup(tokenPath, fixtureDir) {
        const targetPath = path.join(fixtureDir, 'target');
        writeFileSync(targetPath, `${validToken}\n`, { mode: 0o600 });
        symlinkSync(targetPath, tokenPath);
      },
      error: /orchestrator_access_token_file_permissions_invalid/
    },
    {
      name: 'non-regular path',
      setup(tokenPath) {
        mkdirSync(tokenPath);
      },
      error: /orchestrator_access_token_file_permissions_invalid/
    },
    {
      name: 'invalid contents',
      setup(tokenPath) {
        writeFileSync(tokenPath, 'too-short\n', { mode: 0o600 });
      },
      error: /orchestrator_access_token_file_invalid/
    }
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'panefleet-unsafe-token-'));
      const tokenPath = path.join(fixtureDir, 'access-token');
      try {
        testCase.setup(tokenPath, fixtureDir);
        await assert.rejects(loadOperatorAccessToken({ accessTokenPath: tokenPath }), testCase.error);
      } finally {
        rmSync(fixtureDir, { recursive: true, force: true });
      }
    });
  }
});
