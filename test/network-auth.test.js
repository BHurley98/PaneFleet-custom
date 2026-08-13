import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stopChildProcess } from './helpers/child-process.js';
import { installBlockedTool } from './helpers/executables.js';
import { fetchWithTimeout, waitForHttpServer } from './helpers/http.js';
import { unusedLoopbackPort } from './helpers/unused-loopback-port.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, '..');
async function request(baseUrl, pathname, options = {}) {
  return fetchWithTimeout(`${baseUrl}${pathname}`, options, 3000);
}

test('non-loopback access defaults to operator auth and trusted-network mode remains cookie-gated', async (t) => {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), 'host-control-network-auth-'));
  const homeDir = path.join(fixtureDir, 'home');
  const projectsRoot = path.join(homeDir, 'projects');
  const agentWorkspacesRoot = path.join(projectsRoot, 'agent-workspaces');
  const codexHome = path.join(homeDir, '.codex');
  const binDir = path.join(fixtureDir, 'isolated-bin');
  const publicDir = path.join(fixtureDir, 'public');
  const tmpDir = path.join(fixtureDir, 'tmp');
  const toolLogPath = path.join(fixtureDir, 'host-command-attempts.log');
  let child;
  let childOutput = '';

  try {
    for (const directory of [homeDir, projectsRoot, agentWorkspacesRoot, codexHome, binDir, publicDir, tmpDir]) {
      mkdirSync(directory, { recursive: true });
    }
    writeFileSync(path.join(fixtureDir, 'package.json'), '{"type":"module"}\n');
    writeFileSync(path.join(fixtureDir, 'services.json'), '[]\n');
    writeFileSync(path.join(fixtureDir, 'host-config.json'), '{}\n');
    writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>Network Auth Test</title>\n');
    writeFileSync(path.join(codexHome, 'models_cache.json'), '{"models":[]}\n');

    // PATH contains only failing fixtures. A regression cannot fall through to
    // tmux, AWS, metadata, Git, or host process tools installed on the machine.
    for (const name of ['aws', 'bash', 'curl', 'git', 'ps', 'ss', 'tmux']) {
      installBlockedTool(binDir, name);
    }

    const baseEnvironment = {
      HOME: homeDir,
      HOST: '0.0.0.0',
      PATH: binDir,
      TMPDIR: tmpDir,
      NODE_ENV: 'test',
      CODEX_HOME: codexHome,
      ORCHESTRATOR_RUNTIME_ROOT: fixtureDir,
      ...(process.env.NODE_V8_COVERAGE ? { NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE } : {}),
      ORCH_CONTROL_PLANE_MODE: 'foreground',
      ORCH_TOOL_LOG: toolLogPath,
      ORCHESTRATOR_SECURE_COOKIE: '1',
      ORCHESTRATOR_HOST_CONFIG: path.join(fixtureDir, 'host-config.json'),
      ORCHESTRATOR_PROJECTS_ROOT: projectsRoot,
      ORCHESTRATOR_AGENT_WORKSPACES_ROOT: agentWorkspacesRoot,
      AWS_EC2_METADATA_DISABLED: 'true',
      SNAPSHOT_EVENT_MS: '3600000',
      SSH_RESCUE_MONITOR_MS: '3600000'
    };
    const startFixtureServer = async (environment = {}) => {
      const fixturePort = await unusedLoopbackPort();
      const fixtureBaseUrl = `http://127.0.0.1:${fixturePort}`;
      childOutput = '';
      child = spawn(process.execPath, [path.join(projectDir, 'server.js')], {
        cwd: fixtureDir,
        env: { ...baseEnvironment, ...environment, PORT: String(fixturePort) },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', (chunk) => { childOutput += chunk; });
      child.stderr.on('data', (chunk) => { childOutput += chunk; });
      await waitForHttpServer({ baseUrl: fixtureBaseUrl, child, output: () => childOutput });
      return fixtureBaseUrl;
    };
    const baseUrl = await startFixtureServer();

    const accessTokenPath = path.join(fixtureDir, 'data', 'access-token');
    const operatorToken = readFileSync(accessTokenPath, 'utf8').trim();
    const operatorAuthorization = `Basic ${Buffer.from(`host-control:${operatorToken}`).toString('base64')}`;
    assert.match(operatorToken, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(statSync(accessTokenPath).mode & 0o777, 0o600);

    await t.test('anonymous static and API requests receive a Basic challenge', async () => {
      for (const pathname of ['/', '/api/options']) {
        const response = await request(baseUrl, pathname);
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('www-authenticate'), 'Basic realm="PaneFleet", charset="UTF-8"');
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(await response.text(), 'Operator authentication required.\n');
      }
    });

    await t.test('malformed and same-length incorrect Basic credentials never issue a control cookie', async () => {
      const replacement = operatorToken.endsWith('A') ? 'B' : 'A';
      const wrongToken = operatorToken.slice(0, -1) + replacement;
      const authorizations = [
        'Basic ' + Buffer.from('host-control-without-password').toString('base64'),
        'Basic ' + Buffer.from('host-control:' + wrongToken).toString('base64')
      ];
      for (const authorization of authorizations) {
        const response = await request(baseUrl, '/', { headers: { authorization } });
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(response.headers.get('www-authenticate'), 'Basic realm="PaneFleet", charset="UTF-8"');
      }
    });

    await t.test('health remains minimal and public', async () => {
      const response = await request(baseUrl, '/healthz');
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /^text\/plain\b/);
      assert.equal(response.headers.get('www-authenticate'), null);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(await response.text(), 'ok\n');
    });

    let controlCookie = '';
    await t.test('the generated operator credential allows the index to issue a secure control cookie', async () => {
      const response = await request(baseUrl, '/', {
        headers: { authorization: operatorAuthorization }
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /^text\/html\b/);
      assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000');
      const setCookie = response.headers.get('set-cookie') || '';
      assert.match(setCookie, /^host_control_session=[^;]+;/);
      assert.match(setCookie, /\bHttpOnly\b/i);
      assert.match(setCookie, /\bSameSite=Strict\b/i);
      assert.match(setCookie, /\bSecure\b/i);
      controlCookie = setCookie.split(';', 1)[0];
    });

    await t.test('an authenticated operator still needs the control cookie for APIs', async () => {
      const withoutCookie = await request(baseUrl, '/api/options', {
        headers: { authorization: operatorAuthorization }
      });
      assert.equal(withoutCookie.status, 401);
      assert.equal(withoutCookie.headers.get('www-authenticate'), null);
      assert.deepEqual(await withoutCookie.json(), { error: 'control_session_required' });

      const withCookie = await request(baseUrl, '/api/options', {
        headers: {
          authorization: operatorAuthorization,
          cookie: controlCookie
        }
      });
      assert.equal(withCookie.status, 200);
      const options = await withCookie.json();
      assert.equal(Array.isArray(options.workspaces), true);
      assert.equal(Array.isArray(options.models), true);
    });

    await t.test('a valid configured token authenticates without creating a token file', async () => {
      await stopChildProcess(child);
      child = null;
      rmSync(accessTokenPath, { force: true });
      const configuredToken = 'configured-access-token-1234';
      const configuredBaseUrl = await startFixtureServer({ ORCHESTRATOR_ACCESS_TOKEN: configuredToken });
      const configuredAuthorization = `Basic ${Buffer.from(`host-control:${configuredToken}`).toString('base64')}`;
      const response = await request(configuredBaseUrl, '/', {
        headers: { authorization: configuredAuthorization }
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie') || '', /^host_control_session=/);
      assert.equal(existsSync(accessTokenPath), false);
    });

    await t.test('trusted-network mode removes Basic but retains the same-page API cookie', async () => {
      await stopChildProcess(child);
      child = null;
      rmSync(accessTokenPath, { force: true });
      const trustedBaseUrl = await startFixtureServer({ ORCHESTRATOR_ACCESS_MODE: 'trusted-network' });

      const indexResponse = await request(trustedBaseUrl, '/');
      assert.equal(indexResponse.status, 200);
      assert.equal(indexResponse.headers.get('www-authenticate'), null);
      const setCookie = indexResponse.headers.get('set-cookie') || '';
      assert.match(setCookie, /^host_control_session=[^;]+;/);
      const trustedCookie = setCookie.split(';', 1)[0];
      assert.equal(existsSync(accessTokenPath), false);

      const withoutCookie = await request(trustedBaseUrl, '/api/options');
      assert.equal(withoutCookie.status, 401);
      assert.deepEqual(await withoutCookie.json(), { error: 'control_session_required' });

      const withCookie = await request(trustedBaseUrl, '/api/options', {
        headers: { cookie: trustedCookie }
      });
      assert.equal(withCookie.status, 200);
      const options = await withCookie.json();
      assert.equal(Array.isArray(options.workspaces), true);
      assert.equal(Array.isArray(options.models), true);
    });

    assert.equal(existsSync(toolLogPath) ? readFileSync(toolLogPath, 'utf8') : '', '');
  } finally {
    await stopChildProcess(child);
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
