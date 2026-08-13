import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  chmodSync,
  copyFileSync,
  cpSync,
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
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { stopChildProcess } from './helpers/child-process.js';
import { installBlockedTool } from './helpers/executables.js';
import { fetchWithTimeout, responseJson as jsonResponse, waitForHttpServer } from './helpers/http.js';
import { waitForCondition } from './helpers/timing.js';
import { unusedLoopbackPort } from './helpers/unused-loopback-port.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, '..');
const loopbackHost = [127, 0, 0, 1].join('.');
const unspecifiedIpv4 = [0, 0, 0, 0].join('.');
const documentationIpv4 = [203, 0, 113, 10].join('.');
const publicIpv4 = [8, 8, 8, 8].join('.');
let fixtureDir;
let codexHome;
let additionalWorkspaceRoot;
let configuredWorkspaceEntry;
let toolLogPath;
let child;
let childOutput = '';
let baseUrl;
let controlCookie;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const dynamicModelCache = {
  models: [
    {
      slug: 'gpt-test-alpha',
      display_name: 'GPT Test Alpha',
      description: 'Synthetic visible model',
      visibility: 'list',
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [
        { effort: 'low' },
        { effort: 'medium' },
        { effort: 'high' },
        { effort: 'xhigh' },
        { effort: 'max' },
        { effort: 'ultra' }
      ]
    },
    {
      slug: 'gpt-test-beta',
      display_name: 'GPT Test Beta',
      description: 'Second synthetic visible model',
      visibility: 'list',
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [
        { effort: 'low' },
        { effort: 'medium' },
        { effort: 'high' },
        { effort: 'xhigh' },
        { effort: 'max' }
      ]
    },
    {
      slug: 'codex-auto-review',
      display_name: 'Codex Auto Review',
      description: 'Hidden test-only model',
      visibility: 'hide',
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [
        { effort: 'low' },
        { effort: 'medium' },
        { effort: 'high' },
        { effort: 'xhigh' }
      ]
    }
  ]
};

function installDynamicModelFixture() {
  writeFileSync(path.join(codexHome, 'models_cache.json'), `${JSON.stringify(dynamicModelCache)}\n`);
  writeFileSync(
    path.join(codexHome, 'config.toml'),
    'model = "gpt-test-alpha"\nmodel_reasoning_effort = "ultra"\n'
  );
}

function resetDynamicModelFixture() {
  writeFileSync(path.join(codexHome, 'models_cache.json'), '{"models":[]}\n');
  rmSync(path.join(codexHome, 'config.toml'), { force: true });
}

async function request(pathname, options = {}) {
  return fetchWithTimeout(`${baseUrl}${pathname}`, options, 3000);
}

function toolLog() {
  return existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '';
}

function toolInvocationCount(name) {
  return toolLog().split('\n').filter((line) => line === name).length;
}

before(async () => {
  fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'agent-orchestrator-test-'));
  mkdirSync(path.join(fixtureDir, 'data'));
  chmodSync(path.join(fixtureDir, 'data'), 0o755);
  codexHome = path.join(fixtureDir, 'codex-home');
  const binDir = path.join(fixtureDir, 'blocked-bin');
  const projectsRoot = path.join(fixtureDir, 'projects');
  additionalWorkspaceRoot = path.join(fixtureDir, 'shared-workspaces');
  configuredWorkspaceEntry = path.join(additionalWorkspaceRoot, 'example-tooling');
  toolLogPath = path.join(fixtureDir, 'external-tools.log');
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(projectsRoot, { recursive: true });
  mkdirSync(path.join(projectsRoot, 'reference'), { recursive: true });
  mkdirSync(configuredWorkspaceEntry, { recursive: true });

  copyFileSync(path.join(projectDir, 'test', 'services.fixture.json'), path.join(fixtureDir, 'services.json'));
  cpSync(path.join(projectDir, 'public'), path.join(fixtureDir, 'public'), { recursive: true });
  writeFileSync(path.join(fixtureDir, 'package.json'), '{"type":"module"}\n');
  writeFileSync(path.join(fixtureDir, 'host-config.json'), JSON.stringify({
    additionalWorkspaceRoots: [{ path: additionalWorkspaceRoot, label: 'Shared workspaces', group: 'Additional roots' }],
    workspaceEntries: [{ path: configuredWorkspaceEntry, label: 'Example tooling', group: 'Project tools' }],
    directoryGroups: { reference: 'Supporting folders' },
    areaAliases: [{ path: configuredWorkspaceEntry, label: 'Example Tooling' }],
    artifactDirectories: ['releases']
  }));
  writeFileSync(path.join(codexHome, 'models_cache.json'), '{"models":[]}\n');

  // Any accidental command execution is contained and recorded. These tests must
  // never inspect tmux, contact instance metadata/AWS, or query host processes.
  for (const name of ['aws', 'curl', 'journalctl', 'ps', 'ss', 'tmux']) installBlockedTool(binDir, name);

  const port = await unusedLoopbackPort();
  baseUrl = `http://${loopbackHost}:${port}`;
  child = spawn(process.execPath, [path.join(projectDir, 'server.js')], {
    cwd: fixtureDir,
    env: {
      HOME: fixtureDir,
      NODE_ENV: 'test',
      HOST: loopbackHost,
      PORT: String(port),
      ORCHESTRATOR_RUNTIME_ROOT: fixtureDir,
      CODEX_HOME: codexHome,
      PATH: `${binDir}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
      ORCH_TOOL_LOG: toolLogPath,
      ORCH_CONTROL_PLANE_MODE: 'foreground',
      ORCHESTRATOR_PROJECTS_ROOT: projectsRoot,
      ORCHESTRATOR_AGENT_WORKSPACES_ROOT: path.join(projectsRoot, 'agent-workspaces'),
      ORCHESTRATOR_HOST_CONFIG: path.join(fixtureDir, 'host-config.json'),
      ...(process.env.NODE_V8_COVERAGE ? { NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE } : {}),
      AWS_EC2_METADATA_DISABLED: 'true',
      SNAPSHOT_EVENT_MS: '60000',
      SSH_RESCUE_MONITOR_MS: '50',
      NETWORK_MONITOR_TEST: '1',
      NETWORK_MONITOR_MS: '5000',
      CODEX_USAGE_MONITOR_TEST: '1',
      CODEX_USAGE_MONITOR_MS: '5000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { childOutput += chunk; });
  child.stderr.on('data', (chunk) => { childOutput += chunk; });
  await waitForHttpServer({ baseUrl, child, output: () => childOutput });

  const index = await request('/');
  const setCookie = index.headers.get('set-cookie') || '';
  controlCookie = setCookie.split(';', 1)[0];
});

after(async () => {
  await stopChildProcess(child);
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true });
});

test('startup narrows an existing private state directory to owner-only', () => {
  assert.equal(statSync(path.join(fixtureDir, 'data')).mode & 0o777, 0o700);
});

test('health and index responses carry defensive headers and a control cookie', async () => {
  const health = await request('/healthz');
  assert.equal(health.status, 200);
  assert.equal(await health.text(), 'ok\n');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-frame-options'), 'DENY');
  assert.equal(health.headers.get('referrer-policy'), 'no-referrer');

  const index = await request('/');
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type') || '', /^text\/html\b/);
  assert.equal(index.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(index.headers.get('permissions-policy') || '', /camera=\(\)/);
  assert.match(index.headers.get('content-security-policy') || '', /default-src 'self'/);

  const setCookie = index.headers.get('set-cookie') || '';
  assert.match(setCookie, /^host_control_session=[^;]+;/);
  assert.match(setCookie, /\bHttpOnly\b/i);
  assert.match(setCookie, /\bSameSite=Strict\b/i);
  controlCookie = setCookie.split(';', 1)[0];
});

test('static files cannot escape the public root through a symlink', async () => {
  const outsideFile = path.join(fixtureDir, 'outside-static.txt');
  const symlink = path.join(fixtureDir, 'public', 'outside-static.txt');
  writeFileSync(outsideFile, 'must not be served\n');
  symlinkSync(outsideFile, symlink);
  try {
    const response = await request('/outside-static.txt');
    assert.equal(response.status, 404);
    assert.equal((await response.text()).includes('must not be served'), false);
  } finally {
    rmSync(symlink, { force: true });
    rmSync(outsideFile, { force: true });
  }
});

test('read-only operator APIs expose bounded state and retired paths stay closed', async () => {
  const headers = { cookie: controlCookie };

  const snapshotResponse = await request('/api/snapshot', { headers });
  assert.equal(snapshotResponse.status, 200);
  const snapshot = await jsonResponse(snapshotResponse);
  assert.equal(snapshot.host.totalMem > 0, true);
  assert.equal(snapshot.host.availableMem > 0, true);
  assert.equal(snapshot.host.availableMem <= snapshot.host.totalMem, true);
  assert.equal(snapshot.host.swapTotal >= snapshot.host.swapFree, true);
  assert.equal(snapshot.host.rootFs.totalBytes > 0, true);
  assert.equal(snapshot.host.rootFs.availableBytes >= 0, true);
  assert.equal(snapshot.host.rootFs.usedPercent >= 0 && snapshot.host.rootFs.usedPercent <= 100, true);
  assert.equal(snapshot.codexStats.retentionDays, 90);
  assert.deepEqual(snapshot.codexStats.methodology, {
    scope: 'host-local',
    measurement: 'replayed-rollout-events',
    dayBoundary: 'UTC',
    includesCachedInput: true,
    firstSampleIsBaseline: false,
    accountUsageEquivalent: false,
    perTicket: true,
    coverage: 'complete'
  });
  assert.deepEqual(snapshot.codexStats.tickets, []);
  assert.deepEqual(snapshot.codexStats.today.agents, []);
  assert.equal(snapshot.review.session, 'codex-orchestrator-review');
  assert.equal(snapshot.review.running, false);
  assert.deepEqual(Object.keys(snapshot.review).sort(), [
    'agentStatus',
    'generatedAt',
    'running',
    'session',
    'sourceCounts'
  ]);
  assert.equal(snapshot.review.agentStatus, null);
  assert.deepEqual(snapshot.promptQueue.items, []);
  assert.deepEqual(snapshot.promptQueue.schedules, []);
  assert.equal(snapshot.promptQueue.counts.pending, 0);
  assert.equal(snapshot.security.sshRescue.active, false);
  assert.equal(Number.isInteger(snapshot.security.sshRescue.dashboardPort), true);
  assert.equal(snapshot.security.sshRescue.ports.includes(snapshot.security.sshRescue.dashboardPort), true);
  assert.equal(Array.isArray(snapshot.security.sshRescue.peerCidrs), true);

  for (const pathname of ['/api/audit', '/api/prompt-queue', '/api/missions', '/api/review/latest', '/api/security/ssh-rescue']) {
    const retiredApi = await request(pathname, { headers });
    assert.equal(retiredApi.status, 404);
    assert.deepEqual(await jsonResponse(retiredApi), { error: 'not_found' });
  }

  const missingStatic = await request('/missing-static.css');
  assert.equal(missingStatic.status, 404);
  assert.deepEqual(await jsonResponse(missingStatic), { error: 'not_found' });
});

test('inactive SSH rescue monitoring remains a local no-op', async () => {
  const before = toolLog();
  await delay(120);
  assert.equal(toolLog(), before);
});

test('periodic network and Codex monitor failures stay redacted without stopping the server', async () => {
  const servicesPath = path.join(fixtureDir, 'services.json');
  const original = readFileSync(servicesPath, 'utf8');
  const privateMarker = 'synthetic-private-monitor-config';
  const outputStart = childOutput.length;
  try {
    writeFileSync(servicesPath, `{ "${privateMarker}":`);
    const monitorOutput = await waitForCondition(() => {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`isolated server exited before scheduled monitors ran (${child.exitCode ?? child.signalCode})`);
      }
      const observed = childOutput.slice(outputStart);
      return (
        observed.includes('PaneFleet network monitor failed') &&
        observed.includes('PaneFleet Codex usage monitor failed')
      ) ? observed : null;
    }, { intervalMs: 50, timeoutMs: 6500, label: 'scheduled monitor failures' });
    assert.match(monitorOutput, /PaneFleet network monitor failed: services\.json invalid JSON/);
    assert.match(monitorOutput, /PaneFleet Codex usage monitor failed: services\.json invalid JSON/);
    assert.doesNotMatch(monitorOutput, new RegExp(privateMarker));
    assert.equal(child.exitCode, null);
  } finally {
    writeFileSync(servicesPath, original);
  }
  const health = await request('/healthz');
  assert.equal(health.status, 200);
});

test('mutating API requests require the same-page control session', async () => {
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ session: 'codex-smoke', key: 'up' })
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await jsonResponse(response), { error: 'control_session_required' });
});

test('mutating API requests require JSON', async () => {
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'text/plain' },
    body: '{}'
  });
  assert.equal(response.status, 415);
  assert.deepEqual(await jsonResponse(response), { error: 'application_json_required' });
});

test('mutating API requests reject a mismatched browser origin', async () => {
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: {
      cookie: controlCookie,
      'content-type': 'application/json',
      origin: 'https://untrusted.example'
    },
    body: '{}'
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await jsonResponse(response), { error: 'origin_mismatch' });
});

test('mutating API requests reject cross-site metadata and malformed origins before routing', async () => {
  const before = existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '';
  const cases = [
    {
      headers: { 'sec-fetch-site': 'cross-site' },
      error: 'cross_site_request_rejected'
    },
    {
      headers: { origin: 'not a valid origin' },
      error: 'invalid_origin'
    }
  ];
  for (const testCase of cases) {
    const response = await request('/api/agent/ui-key', {
      method: 'POST',
      headers: {
        cookie: controlCookie,
        'content-type': 'application/json',
        ...testCase.headers
      },
      body: '{}'
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await jsonResponse(response), { error: testCase.error });
  }
  assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', before);
});

test('malformed JSON is a client error', async () => {
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: '{'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'invalid_json' });
});

test('oversized JSON is rejected before parsing or host command execution', async () => {
  const before = existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '';
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      session: 'codex-smoke',
      key: 'up',
      padding: 'x'.repeat(1024 * 1024)
    })
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await jsonResponse(response), { error: 'request_body_too_large' });
  assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', before);
});

test('picker key input is allowlisted before tmux is consulted', async () => {
  const before = toolLog();
  const response = await request('/api/agent/ui-key', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ session: 'codex-smoke', key: 'C-c' })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'invalid_agent_ui_key' });
  assert.equal(toolLog(), before);
});

test('agent interaction touch rejects invalid sessions before tmux is consulted', async () => {
  const before = toolLog();
  const response = await request('/api/agent/touch', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ session: '../not-an-agent' })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'invalid_agent_session' });
  assert.equal(toolLog(), before);
});

test('IP rule inventory requires the same-page control session before AWS', async () => {
  const before = toolLog();
  const response = await request('/api/security/ssh-rescue/plan');
  assert.equal(response.status, 401);
  assert.deepEqual(await jsonResponse(response), { error: 'control_session_required' });
  assert.equal(toolLog(), before);
});

test('managed IP cleanup refuses a non-public requester before AWS', async () => {
  const before = toolLog();
  const response = await request('/api/security/ssh-rescue/cleanup', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dryRun: true, currentOnly: true })
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await jsonResponse(response), { error: 'current_public_ipv4_unavailable' });
  assert.equal(toolLog(), before);
});

test('managed IP cleanup requires current-only semantics before AWS', async () => {
  const before = toolLog();
  const response = await request('/api/security/ssh-rescue/cleanup', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ dryRun: true })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'current_only_required' });
  assert.equal(toolLog(), before);
});

test('unknown models are rejected before workspace or tmux mutation', async () => {
  const before = toolLog();
  const response = await request('/api/agent/create', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'smoke-never-created', model: 'not-in-isolated-model-cache' })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'invalid_model' });
  assert.equal(toolLog(), before);
});

test('model options project visible cache entries and exclude hidden models', async () => {
  installDynamicModelFixture();
  try {
    const response = await request('/api/options', { headers: { cookie: controlCookie } });
    assert.equal(response.status, 200);
    const options = await jsonResponse(response);

    assert.deepEqual(
      options.models.map(({ id, label, defaultReasoning, reasoningEfforts }) => ({
        id,
        label,
        defaultReasoning,
        reasoningEfforts
      })),
      [
        {
          id: 'gpt-test-alpha',
          label: 'GPT Test Alpha',
          defaultReasoning: 'medium',
          reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']
        },
        {
          id: 'gpt-test-beta',
          label: 'GPT Test Beta',
          defaultReasoning: 'medium',
          reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max']
        }
      ]
    );
    assert.equal(options.models.some((model) => model.id === 'codex-auto-review'), false);
    assert.equal(options.configuredDefault.model, 'gpt-test-alpha');
    assert.equal(options.configuredDefault.modelLabel, 'GPT Test Alpha');
    assert.equal(options.configuredDefault.reasoning, 'ultra');
    assert.deepEqual(
      options.configuredDefault.reasoningEfforts,
      ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']
    );
    assert.equal(options.reasoningEfforts.includes('max'), true);
    assert.equal(options.reasoningEfforts.includes('ultra'), true);
    assert.deepEqual(
      options.workspaces
        .filter((item) => [additionalWorkspaceRoot, configuredWorkspaceEntry].includes(item.path))
        .map(({ path: workspacePath, label, group }) => ({ path: workspacePath, label, group }))
        .sort((left, right) => left.path.localeCompare(right.path)),
      [
        { path: additionalWorkspaceRoot, label: 'Shared workspaces', group: 'Additional roots' },
        { path: configuredWorkspaceEntry, label: 'Example tooling', group: 'Project tools' }
      ].sort((left, right) => left.path.localeCompare(right.path))
    );
    assert.equal(options.workspaces.some((item) => item.path.endsWith('/reference') && item.group === 'Supporting folders'), true);
  } finally {
    resetDynamicModelFixture();
  }
});

test('the alpha fixture accepts ultra reasoning before any tmux mutation', async () => {
  installDynamicModelFixture();
  rmSync(toolLogPath, { force: true });
  try {
    const response = await request('/api/agent/create', {
      method: 'POST',
      headers: { cookie: controlCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-test-alpha', reasoning: 'ultra' })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonResponse(response), { error: 'missing_name_or_directory' });
    assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', '');
  } finally {
    resetDynamicModelFixture();
    rmSync(toolLogPath, { force: true });
  }
});

test('the beta fixture rejects unsupported ultra reasoning before any tmux mutation', async () => {
  installDynamicModelFixture();
  rmSync(toolLogPath, { force: true });
  try {
    const response = await request('/api/agent/create', {
      method: 'POST',
      headers: { cookie: controlCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-test-beta', reasoning: 'ultra' })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonResponse(response), { error: 'invalid_reasoning_effort' });
    assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', '');
  } finally {
    resetDynamicModelFixture();
    rmSync(toolLogPath, { force: true });
  }
});

test('the configured fixture default accepts ultra reasoning without a model override', async () => {
  installDynamicModelFixture();
  rmSync(toolLogPath, { force: true });
  try {
    const response = await request('/api/agent/create', {
      method: 'POST',
      headers: { cookie: controlCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ model: '', reasoning: 'ultra' })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonResponse(response), { error: 'missing_name_or_directory' });
    assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', '');
  } finally {
    resetDynamicModelFixture();
    rmSync(toolLogPath, { force: true });
  }
});

test('the unspecified IPv4 address is rejected as a rescue address without consulting AWS', async () => {
  const awsBefore = toolInvocationCount('aws');
  const response = await request('/api/security/ssh-rescue/open', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'authorize', ip: unspecifiedIpv4 })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'exact_public_ipv4_required' });
  assert.equal(toolInvocationCount('aws'), awsBefore);
});

test('non-routable documentation addresses are rejected before AWS', async () => {
  const awsBefore = toolInvocationCount('aws');
  const response = await request('/api/security/ssh-rescue/open', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'authorize', ip: documentationIpv4 })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'exact_public_ipv4_required' });
  assert.equal(toolInvocationCount('aws'), awsBefore);
});

test('security mutations require exact action-specific confirmation before AWS', async () => {
  const awsBefore = toolInvocationCount('aws');
  const attempts = [
    ['/api/security/ssh-rescue/open', { confirm: 'open', ip: publicIpv4 }],
    ['/api/security/ssh-rescue/open', { confirm: true, ip: publicIpv4 }],
    ['/api/security/ssh-rescue/lock', { confirm: true }],
    ['/api/security/ssh-rescue/cleanup', { confirm: true, currentOnly: true, planToken: 'legacy-confirmation' }]
  ];
  for (const [pathname, body] of attempts) {
    const response = await request(pathname, {
      method: 'POST',
      headers: { cookie: controlCookie, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await jsonResponse(response), { error: 'confirmation_required' });
  }

  const retiredClose = await request('/api/security/ssh-rescue/close', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'close' })
  });
  assert.equal(retiredClose.status, 404);
  assert.deepEqual(await jsonResponse(retiredClose), { error: 'not_found' });
  assert.equal(toolInvocationCount('aws'), awsBefore);
});

test('hidden characters in a pasted rescue address are rejected before AWS', async () => {
  const awsBefore = toolInvocationCount('aws');
  const response = await request('/api/security/ssh-rescue/open', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'authorize', ip: `${publicIpv4}\u200b` })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'unsafe_public_ipv4_characters' });
  assert.equal(toolInvocationCount('aws'), awsBefore);
});

test('public-IP service actions cannot fall back to a broad default', async () => {
  const before = toolLog();
  const response = await request('/api/service/public_ip_workflow/action/start', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'start' })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await jsonResponse(response), { error: 'exact_public_ipv4_required' });
  assert.equal(toolLog(), before);
});

test('dashboard tmux sessions are protected before tmux is consulted', async () => {
  const tmuxBefore = toolInvocationCount('tmux');
  const response = await request('/api/session/agent-orchestrator/stop', {
    method: 'POST',
    headers: { cookie: controlCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: 'stop' })
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await jsonResponse(response), { error: 'protected_session' });
  assert.equal(toolInvocationCount('tmux'), tmuxBefore);
});
