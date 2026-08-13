import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  inspectTestTempBase,
  MIN_TEST_TEMP_BYTES,
  runTestSuiteSequence,
  selectTestSuites,
  selectTestTempBase
} from '../scripts/run-tests.mjs';

test('test temp inspection accepts directories and rejects files or missing paths', async () => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'panefleet-test-root-'));
  const filePath = path.join(fixtureDir, 'not-a-directory');
  const missingPath = path.join(fixtureDir, 'missing');
  writeFileSync(filePath, 'fixture\n');
  try {
    const directory = await inspectTestTempBase(fixtureDir);
    assert.equal(directory.path, fixtureDir);
    assert.equal(directory.writable, true);
    assert.ok(directory.availableBytes > 0);
    assert.deepEqual(await inspectTestTempBase(filePath), {
      path: filePath,
      writable: false,
      availableBytes: 0
    });
    assert.deepEqual(await inspectTestTempBase(missingPath), {
      path: missingPath,
      writable: false,
      availableBytes: 0
    });
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test('test runner skips constrained or unwritable temp roots before starting fixtures', () => {
  const constrained = MIN_TEST_TEMP_BYTES - 1;
  const roomy = MIN_TEST_TEMP_BYTES * 2;
  assert.equal(selectTestTempBase([
    { path: '/tmp', writable: true, availableBytes: constrained },
    { path: '/var/tmp', writable: true, availableBytes: roomy }
  ]), '/var/tmp');
  assert.equal(selectTestTempBase([
    { path: '/preferred', writable: false, availableBytes: roomy },
    { path: '/fallback', writable: true, availableBytes: roomy }
  ]), '/fallback');
  assert.throws(
    () => selectTestTempBase([{ path: '/tmp', writable: true, availableBytes: constrained }]),
    /No writable test temp directory/
  );
  assert.throws(() => selectTestTempBase([], -1), /must be nonnegative/);
});

test('all-suite runs report every suite before returning a failed status', async () => {
  assert.deepEqual(selectTestSuites('all'), ['core', 'features']);
  assert.deepEqual(selectTestSuites('core'), ['core']);
  assert.throws(() => selectTestSuites('missing'), /Unknown test suite: missing/);

  const executed = [];
  const status = await runTestSuiteSequence(['core', 'features'], async (suite) => {
    executed.push(suite);
    return { code: suite === 'core' ? 1 : 0, signal: null };
  });
  assert.equal(status, 1);
  assert.deepEqual(executed, ['core', 'features']);

  await assert.rejects(
    runTestSuiteSequence(['core'], async () => ({ code: null, signal: 'SIGTERM' })),
    /Test suite core stopped by SIGTERM/
  );
});
