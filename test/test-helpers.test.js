import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { stopChildProcess, waitForChildExit } from './helpers/child-process.js';
import { installBlockedTool, installExecutable } from './helpers/executables.js';
import { fetchWithTimeout, waitForHttpServer } from './helpers/http.js';
import { waitForCondition, withTimeout } from './helpers/timing.js';

test('condition waits return evidence and fail with bounded diagnostics', async () => {
  let attempts = 0;
  const evidence = await waitForCondition(() => {
    attempts += 1;
    return attempts === 3 ? { status: 'ready' } : null;
  }, { intervalMs: 1, timeoutMs: 100, label: 'synthetic readiness' });

  assert.deepEqual(evidence, { status: 'ready' });
  assert.equal(attempts, 3);
  await assert.rejects(
    waitForCondition(() => false, { intervalMs: 1, timeoutMs: 5, label: 'never-ready fixture' }),
    /Timed out waiting for never-ready fixture after 5ms/
  );
  await assert.rejects(
    waitForCondition(() => true, { intervalMs: 0 }),
    /intervalMs must be a positive finite number/
  );

  assert.equal(
    await withTimeout(() => Promise.resolve('complete'), { timeoutMs: 100, label: 'quick operation' }),
    'complete'
  );
  await assert.rejects(
    withTimeout(() => new Promise(() => {}), { timeoutMs: 5, label: 'stalled stream read' }),
    /Timed out waiting for stalled stream read after 5ms/
  );
  await assert.rejects(
    withTimeout(null),
    /Timed operation must be a function/
  );
});

test('child exit waits report completion and bound stuck fixtures', async () => {
  const completed = spawn(process.execPath, ['-e', 'process.exit(7)'], { stdio: 'ignore' });
  assert.deepEqual(
    await waitForChildExit(completed, { timeoutMs: 1000, label: 'completed fixture' }),
    [7, null]
  );

  const stuck = spawn(process.execPath, ['-e', 'setInterval(() => {}, 60000)'], { stdio: 'ignore' });
  try {
    await assert.rejects(
      waitForChildExit(stuck, { timeoutMs: 20, label: 'stuck fixture' }),
      /Timed out waiting for stuck fixture exit after 20ms/
    );
  } finally {
    await stopChildProcess(stuck);
  }
});

test('HTTP readiness reports early child exit and bounded listener diagnostics', async () => {
  await assert.rejects(
    waitForHttpServer({
      baseUrl: 'http://127.0.0.1:1',
      child: { exitCode: 3, signalCode: null },
      output: () => 'synthetic early-exit output',
      label: 'failed fixture',
      timeoutMs: 50
    }),
    /failed fixture exited early \(3\)\nsynthetic early-exit output/
  );

  await assert.rejects(
    waitForHttpServer({
      baseUrl: 'http://127.0.0.1:1',
      child: { exitCode: null, signalCode: null },
      output: () => 'synthetic readiness output',
      label: 'stalled fixture',
      timeoutMs: 10
    }),
    /stalled fixture did not become ready\nsynthetic readiness output/
  );
});

test('HTTP timeout remains active alongside caller cancellation', async () => {
  const server = createServer(() => {
    // Deliberately leave the response open so only cancellation can settle fetch.
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/stalled`;

  try {
    const externalSignal = new AbortController();
    await assert.rejects(
      fetchWithTimeout(url, { signal: externalSignal.signal }, 20),
      (error) => error?.name === 'TimeoutError'
    );

    const canceled = new AbortController();
    setTimeout(() => canceled.abort(new Error('synthetic caller cancellation')), 5);
    await assert.rejects(
      fetchWithTimeout(url, { signal: canceled.signal }, 1000),
      /synthetic caller cancellation/
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('test executable helpers confine tools and preserve blocked-command evidence', () => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'panefleet-executables-'));
  const toolLogPath = path.join(fixtureDir, 'tool.log');
  try {
    const executable = installBlockedTool(fixtureDir, 'safe-tool');
    const result = spawnSync(executable, [], {
      encoding: 'utf8',
      env: { ...process.env, ORCH_TOOL_LOG: toolLogPath }
    });

    assert.equal(result.status, 97);
    assert.equal(readFileSync(toolLogPath, 'utf8'), 'safe-tool\n');
    assert.equal(statSync(executable).mode & 0o777, 0o755);
    assert.throws(
      () => installExecutable(fixtureDir, '../outside', '#!/bin/sh\nexit 0\n'),
      /Unsafe test executable name/
    );
    assert.throws(
      () => installExecutable('relative-bin', 'tool', '#!/bin/sh\nexit 0\n'),
      /directory must be absolute/
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
