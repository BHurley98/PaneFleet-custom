import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import {
  applySnapshotPatch,
  attentionForSession,
  codexCompactTelemetryPresentation,
  codexTelemetryPresentation,
  codexTelemetryFreshness,
  codexTokenBreakdown,
  connectionStatePresentation,
  cycledItemIndex,
  dashboardDocumentTitle,
  dashboardSectionDecisionCount,
  dashboardShortcut,
  dashboardThemePresentation,
  exactPaneIdentityQuery,
  exactIpv4Input,
  filterPromptHistory,
  hasActiveTextSelection,
  horizontalRevealScrollLeft,
  ideaGenerationPrompt,
  ideaQueueLinkedPrompt,
  ideaRefinementTargetSession,
  ideaWorkTargetSession,
  isNewAgentSubmitShortcut,
  isPromptQueueSubmitShortcut,
  isTerminalFindShortcut,
  listenerExposure,
  matchingCodexAccountReport,
  modalIsolationTargetSafe,
  modalFocusIndex,
  nextDrawer,
  noticeAutoDismissMs,
  normalizedExactPaneIdentity,
  normalizedPromptQueueDraft,
  normalizedTicketRefinerState,
  normalizedTerminalRestoreState,
  preferredDashboardView,
  preferredScrollBehavior,
  projectContextCacheFresh,
  promptHistoryOrigin,
  promptQueueCancelPresentation,
  promptQueueComposerPresentation,
  promptQueueManualIdeaImportPresentation,
  promptQueueManualSubmitWaitPresentation,
  promptQueueReplacementRequeuePresentation,
  promptQueueReviewDismissPresentation,
  promptQueueSectionTarget,
  promptQueueMultipleAllowed,
  promptQueueTargetSelection,
  promptTextSafety,
  promptScheduleGroups,
  runtimeVersionPresentation,
  sessionFilterCategory,
  sessionFilterMatches,
  sessionPinPresentation,
  sessionResultCountPresentation,
  sessionSearchKeyAction,
  sessionStatusPresentation,
  serviceToolsPresentation,
  shouldStickTerminalOutput,
  terminalAgentResumePresentation,
  terminalChromeCollapseAfterLayoutChange,
  terminalComposerTextareaHeight,
  terminalComposerPresentation,
  terminalCaptureFailureTransition,
  terminalDraftPresentation,
  terminalDesktopLayout,
  terminalFindOffsets,
  terminalFocusKind,
  terminalLatestPresentation,
  terminalLayoutSlots,
  terminalModalActive,
  terminalPointerInteractionAllowed,
  terminalPickerAvailability,
  terminalRefreshPresentation,
  terminalRailEntries,
  terminalSwitcherLabel,
  terminalTabKeyIndex,
  terminalWorkspaceFrame,
  ticketRefinerPreview,
  ticketRefinerReadiness,
  ticketRefinerTargetMatch,
  verifiedIdeaGenerationConversations,
  workspaceFocusApplies,
  workspaceFocusPresentation
} from '../public/ui-state.js';

const publicIpv4 = [8, 8, 8, 8].join('.');
const alternatePublicIpv4 = [8, 8, 4, 4].join('.');
const unspecifiedIpv4 = [0, 0, 0, 0].join('.');
const loopbackIpv4 = [127, 0, 0, 1].join('.');
const interfaceIpv4 = [172, 31, 0, 5].join('.');

test('live snapshot patches merge only at the exact expected sequence', () => {
  const current = {
    host: { time: 'first' },
    promptQueue: { items: [{ id: 'stable' }] },
    security: { recent: ['remove-me'] }
  };
  const applied = applySnapshotPatch(current, 4, {
    baseSequence: 4,
    sequence: 5,
    changes: { host: { time: 'second' }, agents: [{ session: 'codex' }] },
    removed: ['security']
  });

  assert.equal(applied.ok, true);
  assert.equal(applied.sequence, 5);
  assert.deepEqual(applied.snapshot, {
    host: { time: 'second' },
    promptQueue: current.promptQueue,
    agents: [{ session: 'codex' }]
  });
  assert.deepEqual(current.security, { recent: ['remove-me'] });
});

test('live snapshot patches reject missing state, bad shapes, unsafe keys, and sequence gaps', () => {
  const current = { host: {} };
  const valid = { baseSequence: 1, sequence: 2, changes: {}, removed: [] };
  assert.deepEqual(applySnapshotPatch(null, 1, valid), { ok: false, error: 'snapshot_missing' });
  assert.deepEqual(applySnapshotPatch(current, 1, null), { ok: false, error: 'patch_invalid' });
  assert.deepEqual(applySnapshotPatch(current, 0, valid), { ok: false, error: 'sequence_mismatch' });
  assert.deepEqual(
    applySnapshotPatch(current, 1, { ...valid, baseSequence: '1' }),
    { ok: false, error: 'sequence_mismatch' }
  );
  assert.deepEqual(
    applySnapshotPatch(current, 1, { ...valid, changes: [], removed: [] }),
    { ok: false, error: 'patch_shape_invalid' }
  );
  assert.deepEqual(
    applySnapshotPatch(current, 1, { ...valid, changes: JSON.parse('{"__proto__":true}'), removed: [] }),
    { ok: false, error: 'patch_key_invalid' }
  );
  assert.deepEqual(
    applySnapshotPatch(current, 1, { ...valid, changes: {}, removed: ['constructor'] }),
    { ok: false, error: 'patch_key_invalid' }
  );
});

test('the live stream applies sequenced patches and reconnects for a complete snapshot on uncertainty', async () => {
  const app = await uiSource('app.js');

  assert.match(app, /state\.eventSource\.addEventListener\('snapshot-patch'/);
  assert.match(app, /applySnapshotPatch\(state\.snapshot, state\.snapshotSequence, JSON\.parse\(event\.data\)\)/);
  assert.match(app, /state\.snapshot = result\.snapshot;\s*state\.snapshotSequence = result\.sequence/);
  assert.match(app, /function reconnectForCompleteSnapshot\(message\)[\s\S]*state\.snapshotSequence = 0[\s\S]*connectEvents\(\)/);
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

async function uiSource(name) {
  return readFile(path.join(publicDir, name), 'utf8');
}

test('live entrypoint loads the terminal-first shell', async () => {
  const index = await uiSource('index.html');

  assert.match(index, /<title>PaneFleet — Terminal Workspace<\/title>/);
  assert.match(index, /<span class="brand-mark" aria-hidden="true">PF<\/span>/);
  assert.match(index, /<div><h1>PaneFleet<\/h1><p>Terminal workspace<\/p><\/div>/);
  assert.match(index, /id="agents-tab" class="tab active"[^>]*><span>Terminals<\/span>/);
  assert.match(index, /href="\/styles\.css"/);
  assert.match(index, /src="\/app\.js"/);
  assert.match(index, /id="queue-tab" class="tab" data-view="queue"[^>]*aria-controls="queue-view"/);
  assert.match(index, /id="queue-view" class="view queue-workspace-view"[^>]*hidden/);
  assert.match(index, /id="notice" class="notice notice-toast hidden"[^>]*><span id="notice-message"[^>]*><\/span><button class="notice-dismiss" data-action="notice-dismiss"/);
  assert.match(index, /id="runtime-drift" class="notice runtime-drift hidden" role="alert"/);
  assert.match(index, /id="runtime-drift-title">Dashboard backend restart required/);
  assert.match(index, /id="runtime-restart"[^>]*data-action="runtime-restart"[^>]*>Restart dashboard<\/button>/);
  assert.match(index, /data-action="new-agent-open"[^>]*aria-keyshortcuts="Alt\+N"[^>]*title="Create new agent \(Alt\+N\)"/);
  assert.match(index, /class="[^"]*\bicon-button\b[^"]*"[^>]*data-action="shortcut-help-open"[^>]*aria-keyshortcuts="Shift\+\/"/);
  assert.match(index, /id="shortcut-help" class="shortcut-help hidden" role="dialog" aria-modal="true"/);
  assert.match(index, /id="shortcut-help-backdrop" class="shortcut-help-backdrop hidden" data-action="shortcut-help-close"/);
  assert.match(index, /id="shortcut-help-title">Keyboard shortcuts/);
  assert.match(index, /data-action="close-finished-terminals"[^>]*aria-label="Close inactive terminal views; agents keep running"/);
  assert.match(index, /class="terminal-cycle-controls"[^>]*aria-label="Switch open terminal"/);
  assert.match(index, /data-action="terminal-cycle-active" data-direction="-1"[^>]*aria-keyshortcuts="Alt\+\["/);
  assert.match(index, /data-action="terminal-cycle-active" data-direction="1"[^>]*aria-keyshortcuts="Alt\+\]"/);
  assert.match(index, /id="terminal-jump-select" aria-label="Jump to open terminal" disabled/);
  assert.match(index, /id="workspace-focus-toggle"[^>]*data-action="workspace-focus-toggle"[^>]*aria-keyshortcuts="Alt\+0"/);
  assert.match(index, /id="session-panel-toggle"[^>]*data-action="workspace-panel-toggle"[^>]*data-panel="sessions"[^>]*aria-controls="session-rail"/);
  assert.match(index, /id="inspector-panel-toggle"[^>]*data-action="workspace-panel-toggle"[^>]*data-panel="inspector"[^>]*aria-controls="terminal-inspector"/);
  assert.doesNotMatch(index, /id="queue-drawer"/);
  assert.match(index, /id="tools-drawer"[^>]*class="control-drawer tools-drawer hidden"/);
  assert.match(index, /id="terminal-stage"/);
  assert.match(index, /id="session-list"/);
  assert.match(index, /<span class="eyebrow">Tmux<\/span><h2>Sessions<\/h2>/);
  assert.match(index, /id="terminal-inspector" class="terminal-inspector" aria-label="Selected session summary"/);
  assert.match(index, /id="session-search"[^>]*aria-keyshortcuts="Control\+K Meta\+K \/"/);
  assert.match(index, /id="session-search"[^>]*enterkeyhint="go"[^>]*aria-controls="session-list"[^>]*aria-describedby="session-search-help"/);
  assert.match(index, /id="session-search-help"[^>]*>Enter opens the first matching session\./);
  assert.match(index, /class="session-search-shortcut"[^>]*>Ctrl K<\/kbd>/);
  assert.match(index, /class="session-filters"[^>]*aria-label="Filter sessions by status"/);
  assert.match(index, /id="session-count" aria-label="0 sessions" title="0 sessions">0<\/strong>/);
  assert.match(index, /data-action="session-filter" data-filter="needs"/);
  assert.match(index, /id="agents-tab"[^>]*aria-keyshortcuts="Alt\+1"/);
  assert.match(index, /id="queue-tab"[^>]*aria-keyshortcuts="Alt\+2"/);
  assert.match(index, /id="usage-tab"[^>]*data-view="usage"[^>]*aria-keyshortcuts="Alt\+3"/);
  assert.match(index, /id="tools-tab"[^>]*aria-keyshortcuts="Alt\+4"/);
  assert.match(index, /id="workspace-eyebrow" class="eyebrow">Terminal-first control/);
  assert.match(index, /id="workspace-title">Agent workspace/);
  assert.match(index, /id="connection-pill"[^>]*data-state="init"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(index, /id="connection-label">Connecting<\/strong>/);
  assert.match(index, /id="refresh-button"[^>]*aria-busy="false"/);
  assert.match(index, /class="action-button new-agent-action"[^>]*data-action="new-agent-open"[^>]*aria-label="Create new agent"/);
  assert.match(index, /class="new-agent-label-short" aria-hidden="true">New<\/span>/);
  assert.match(index, /id="terminal-tabs" class="terminal-tabs hidden" role="tablist" aria-label="Open terminal tabs"/);
  assert.match(index, /data-layout="free"/);
  assert.match(index, /data-layout="focus"/);
  assert.match(index, /data-layout="split"/);
  assert.match(index, /data-layout="grid"/);
  assert.match(index, /data-layout="free"[^>]*aria-label="Freeform terminal windows"[\s\S]*class="layout-label-full">Freeform/);
  assert.match(index, /data-layout="focus"[^>]*aria-label="Focus one terminal"[\s\S]*class="layout-label-full">Focus/);
  assert.match(index, /data-layout="split"[^>]*aria-label="Split two terminals"[\s\S]*class="layout-label-full">Split/);
  assert.match(index, /data-layout="grid"[^>]*aria-label="Grid four terminals"[\s\S]*class="layout-label-full">Grid/);
  assert.match(index, /data-action="terminal-full-height"[^>]*aria-pressed="false"/);
  assert.match(index, /id="project-desk" class="project-desk hidden"/);
  assert.match(index, /data-action="project-new-agent"[^>]*>New Codex here<\/button>/);
  assert.match(index, /id="project-notes"/);
  assert.match(index, /id="project-artifacts"/);
  assert.match(index, /id="project-artifact-count"/);
  assert.match(index, /Downloadable PDF, HTML, and current-session Markdown outputs/);
  assert.match(index, /id="scratchpad-text"[^>]*maxlength="4000"/);
  assert.match(index, /id="scratchpad-review-panel" class="scratchpad-review-panel hidden"/);
  assert.match(index, /data-action="scratchpad-send-confirm"/);

  const workspaceIndex = index.indexOf('id="terminal-stage"');
  const mainEndIndex = index.indexOf('</main>');
  const layerIndex = index.indexOf('id="terminal-layer"');
  assert.ok(workspaceIndex < mainEndIndex && mainEndIndex < layerIndex);
});

test('night mode has accessible reversible presentation state', () => {
  assert.deepEqual(dashboardThemePresentation('light'), {
    theme: 'light',
    nextTheme: 'night',
    icon: '☾',
    label: 'Use night mode',
    themeColor: '#edf2f8'
  });
  assert.deepEqual(dashboardThemePresentation('night'), {
    theme: 'night',
    nextTheme: 'light',
    icon: '☀',
    label: 'Use light mode',
    themeColor: '#08111b'
  });
  assert.equal(dashboardThemePresentation('unknown').theme, 'light');
});

test('modal isolation refuses the protected surface and every ancestor around it', () => {
  const protectedSurface = {};
  assert.equal(modalIsolationTargetSafe(null, protectedSurface), false);
  assert.equal(modalIsolationTargetSafe({}, null), false);
  assert.equal(modalIsolationTargetSafe(protectedSurface, protectedSurface), false);
  assert.equal(modalIsolationTargetSafe({}, protectedSurface), false);
  assert.equal(modalIsolationTargetSafe({ contains: () => true }, protectedSurface), false);
  assert.equal(modalIsolationTargetSafe({ contains: () => false }, protectedSurface), true);
});

test('night mode initializes before CSS, persists locally, and remains keyboard accessible', async () => {
  const [index, bootstrap, app, styles] = await Promise.all([
    uiSource('index.html'),
    uiSource('theme-bootstrap.js'),
    uiSource('app.js'),
    uiSource('styles.css')
  ]);
  assert.ok(index.indexOf('src="/theme-bootstrap.js"') < index.indexOf('href="/styles.css"'));
  assert.match(bootstrap, /window\.localStorage\.getItem\('host-control:theme'\) === 'night'/);
  assert.doesNotMatch(index, /<script>(?!\s*<\/script>)/);
  assert.match(index, /id="theme-toggle"[^>]*data-action="theme-toggle"[^>]*aria-label="Use night mode"[^>]*aria-pressed="false"/);
  assert.match(app, /const THEME_STORAGE_KEY = 'host-control:theme'/);
  assert.match(app, /function syncDashboardTheme\(\{ persist = false \} = \{\}\)/);
  assert.match(app, /case 'theme-toggle':\s*toggleDashboardTheme\(\)/);
  assert.match(styles, /:root\[data-theme="night"\]\s*\{[\s\S]*color-scheme: dark/);
  assert.match(styles, /:root\[data-theme="night"\] \.prompt-queue-stats \.digest-metric/);
  assert.match(styles, /:root\[data-theme="night"\] \.session-signal\.needs/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.connection-pill strong/);
});

test('night mode bootstrap fails safely before CSS when browser storage is unavailable', async () => {
  const bootstrap = await uiSource('theme-bootstrap.js');
  const runBootstrap = (getItem) => {
    const document = { documentElement: { dataset: {} } };
    runInNewContext(bootstrap, { document, window: { localStorage: { getItem } } });
    return document.documentElement.dataset.theme;
  };

  assert.equal(runBootstrap(() => 'night'), 'night');
  assert.equal(runBootstrap(() => 'light'), 'light');
  assert.equal(runBootstrap(() => 'unexpected'), 'light');
  assert.equal(runBootstrap(() => { throw new Error('storage unavailable'); }), 'light');
});

test('terminal rail includes each live non-Codex tmux session once without granting prompt controls', () => {
  const agent = { session: 'codex-work', id: 'codex-work:0.0' };
  const watcherPane = {
    session: 'staging-watch',
    id: 'staging-watch:0.0',
    active: true,
    currentPath: '/workspace',
    sessionCreated: 1700000000
  };
  const settlementPane = { ...watcherPane, id: 'staging-watch:1.0', active: false };
  const firstDiscoveredRecord = {
    id: 'tmux:staging-watch',
    session: 'staging-watch',
    label: 'Staging watch',
    running: true,
    discovered: true,
    pane: watcherPane,
    panes: [watcherPane]
  };
  const secondDiscoveredRecord = {
    ...firstDiscoveredRecord,
    pane: settlementPane,
    panes: [settlementPane]
  };
  const agentShadowService = {
    ...firstDiscoveredRecord,
    id: 'tmux:codex-work',
    session: 'codex-work',
    pane: { ...watcherPane, session: 'codex-work', id: 'codex-work:0.0' }
  };
  const entries = terminalRailEntries([agent], [agentShadowService, firstDiscoveredRecord, secondDiscoveredRecord]);

  assert.deepEqual(entries.map((entry) => entry.session), ['codex-work', 'staging-watch']);
  assert.equal(entries[1].terminalKind, 'service');
  assert.equal(entries[1].servicePaneCount, 2);
  assert.equal(entries[1].canSend, undefined);
  assert.match(entries[1].agentStatus.reason, /prompt controls are disabled/i);
});

test('exact IPv4 paste parsing canonicalizes safe clipboard padding and rejects hidden characters', async () => {
  assert.deepEqual(exactIpv4Input(publicIpv4), {
    ok: true,
    ip: publicIpv4,
    cidr: `${publicIpv4}/32`,
    normalized: false,
    hadCidrSuffix: false
  });
  assert.deepEqual(exactIpv4Input(` \t${alternatePublicIpv4}/32\r\n`), {
    ok: true,
    ip: alternatePublicIpv4,
    cidr: `${alternatePublicIpv4}/32`,
    normalized: true,
    hadCidrSuffix: true
  });
  assert.deepEqual(exactIpv4Input(`${publicIpv4}\u200b`), { ok: false, error: 'unsafe_characters' });
  assert.deepEqual(exactIpv4Input(`\u00a0${publicIpv4}`), { ok: false, error: 'unsafe_characters' });
  assert.deepEqual(exactIpv4Input(`${[8, 8].join('.')}.\n${[8, 8].join('.')}`), { ok: false, error: 'unsafe_characters' });
  assert.deepEqual(exactIpv4Input([256, 8, 8, 8].join('.')), { ok: false, error: 'invalid_format' });
  assert.deepEqual(exactIpv4Input(['008', 8, 8, 8].join('.')), { ok: false, error: 'invalid_format' });
  assert.deepEqual(exactIpv4Input(`${publicIpv4}/24`), { ok: false, error: 'invalid_format' });
  assert.deepEqual(exactIpv4Input('   '), { ok: false, error: 'invalid_format' });
  assert.deepEqual(exactIpv4Input(null), { ok: false, error: 'invalid_format' });

  const app = await uiSource('app.js');
  assert.match(app, /const parsedIp = exactPublicIpv4Input\(entered\)/);
  assert.match(app, /hidden or non-ASCII characters were detected/);
  assert.match(app, /if \(entered === null\) return/);
  assert.match(app, /if \(!window\.confirm[\s\S]*IP authorization canceled/);
});

test('terminal-first shell removes legacy command-center renderers without losing Codex restart recovery', async () => {
  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);

  assert.doesNotMatch(app, /function (?:orchestrationBrief|workerRow|attentionItem|firstSummaryLine)\b/);
  assert.doesNotMatch(app, /resumePreferences|rememberResumeSettings|case 'switch-review':/);
  assert.doesNotMatch(styles, /\.(?:ops-console|overview-panel|workers-panel|worker-row|agent-card|resume-config)\b/);
  assert.match(app, /const canResume = agent\.canResume \|\| brief\.canResume;/);
  assert.match(app, /canResume \? `<button class="action-button primary" data-action="agent-resume"[^>]*>Restart Codex/);
});

test('Codex context stays exact-session while account usage stays shared and passive', async () => {
  const [index, app, styles] = await Promise.all([uiSource('index.html'), uiSource('app.js'), uiSource('styles.css')]);
  const pending = codexTelemetryPresentation(null);
  assert.equal(pending.available, false);
  assert.equal(pending.badge, 'Usage pending');

  const observedAt = '2026-07-29T12:00:00.000Z';
  const now = Date.parse('2026-07-29T12:10:00.000Z');
  assert.deepEqual(codexTelemetryFreshness(observedAt, now), {
    available: true,
    stale: false,
    ageMs: 10 * 60_000
  });
  assert.deepEqual(codexTelemetryFreshness(observedAt, now + 6 * 60_000), {
    available: true,
    stale: true,
    ageMs: 16 * 60_000
  });
  assert.deepEqual(codexTelemetryFreshness('invalid', now), {
    available: false,
    stale: true,
    ageMs: null
  });

  assert.deepEqual(codexTokenBreakdown({
    inputTokens: 1000,
    cachedInputTokens: 700,
    outputTokens: 80,
    totalTokens: 1080
  }), {
    available: true,
    totalTokens: 1080,
    inputTokens: 1000,
    cachedInputTokens: 700,
    uncachedInputTokens: 300,
    outputTokens: 80
  });
  assert.deepEqual(codexTokenBreakdown({
    inputTokens: 100,
    cachedInputTokens: 500,
    outputTokens: 20
  }), {
    available: true,
    totalTokens: 120,
    inputTokens: 100,
    cachedInputTokens: 100,
    uncachedInputTokens: 0,
    outputTokens: 20
  });
  assert.equal(codexTokenBreakdown(null).available, false);

  const healthy = codexTelemetryPresentation({
    source: 'codex-session-log',
    context: { usedPercent: 35, remainingPercent: 65 },
    account: { primary: { usedPercent: 10 } }
  });
  assert.equal(healthy.available, true);
  assert.equal(healthy.badge, 'Ctx 65%');
  assert.equal(healthy.tone, 'good');
  assert.equal(healthy.limitUsedPercent, 10);

  const warning = codexTelemetryPresentation({
    source: 'codex-session-log',
    context: { usedPercent: 80, remainingPercent: 20 },
    account: { secondary: { usedPercent: 30 } }
  });
  assert.equal(warning.tone, 'warn');
  assert.equal(warning.limit.usedPercent, 30);

  const danger = codexTelemetryPresentation({
    source: 'codex-session-log',
    context: { usedPercent: 10, remainingPercent: 90 },
    account: { primary: { usedPercent: 98 } }
  });
  assert.equal(danger.tone, 'good');
  assert.equal(danger.limitTone, 'bad');
  assert.equal(codexTelemetryPresentation({
    source: 'codex-session-log',
    account: { primary: { usedPercent: 98 } }
  }).tone, 'bad');

  assert.deepEqual(codexCompactTelemetryPresentation({
    telemetry: {
      source: 'codex-session-log',
      model: 'gpt-test',
      observedAt: '2026-07-18T12:00:00.000Z',
      context: { remainingPercent: 34.6 },
      sessionTokens: { totalTokens: 123456 }
    },
    account: { primary: { usedPercent: 12 } },
    status: { state: 'busy', tone: 'good', reason: 'working now' }
  }), {
    telemetryAvailable: true,
    statusLabel: 'Working',
    statusTone: 'working',
    statusDescription: 'working now',
    contextRemainingPercent: 34.6,
    usageUsedPercent: 12,
    sessionTokens: 123456,
    model: 'gpt-test',
    observedAt: '2026-07-18T12:00:00.000Z'
  });
  assert.deepEqual(codexCompactTelemetryPresentation({
    telemetry: { context: { remainingPercent: 120 }, sessionTokens: { totalTokens: -1 } },
    account: { secondary: { usedPercent: -5 } },
    status: null
  }), {
    telemetryAvailable: false,
    statusLabel: 'Unknown',
    statusTone: 'neutral',
    statusDescription: 'Session state: Unknown.',
    contextRemainingPercent: 100,
    usageUsedPercent: 0,
    sessionTokens: null,
    model: null,
    observedAt: null
  });

  const sparkAccount = { limitId: 'spark', limitName: 'Spark', primary: { usedPercent: 2 } };
  const mainAccount = { limitId: 'codex', primary: { usedPercent: 12 } };
  assert.deepEqual(matchingCodexAccountReport(
    { observedAt: 'session-time', account: sparkAccount },
    {
      observedAt: 'main-time',
      account: mainAccount,
      pools: [
        { observedAt: 'spark-time', account: sparkAccount },
        { observedAt: 'main-time', account: mainAccount }
      ]
    }
  ), {
    account: sparkAccount,
    observedAt: 'spark-time',
    pools: [
      { observedAt: 'spark-time', account: sparkAccount },
      { observedAt: 'main-time', account: mainAccount }
    ]
  });
  assert.deepEqual(matchingCodexAccountReport(
    { observedAt: 'session-time', account: mainAccount },
    { observedAt: 'main-time', account: mainAccount }
  ), { account: mainAccount, observedAt: 'main-time', pools: [] });
  assert.deepEqual(matchingCodexAccountReport(
    { observedAt: 'session-time', account: sparkAccount },
    null
  ), { account: sparkAccount, observedAt: 'session-time', pools: [] });

  assert.match(app, /function codexTelemetryPanel\(agent\)/);
  assert.match(app, /function codexAccountReport\(telemetry\)[\s\S]*matchingCodexAccountReport/);
  assert.match(app, /Codex session &amp; account/);
  assert.match(app, /Cumulative processed tokens/);
  assert.match(app, /cached input · \$\{formatTokenCount\(breakdown\.uncachedInputTokens\)\} uncached input/);
  assert.match(app, /Context and cumulative processed-token totals belong only to this exact session/);
  assert.match(app, /Cumulative processing includes cached input repeated across turns/);
  assert.match(app, /Stale values are last-known snapshots/);
  assert.match(app, /Passive telemetry may omit pools that Codex shows in <code>\/status<\/code>/i);
  assert.match(app, /class="terminal-header-usage neutral hidden"/);
  assert.match(app, /class="terminal-mobile-telemetry hidden" data-action="terminal-telemetry-toggle"/);
  assert.match(app, /function terminalMobileTelemetryContent\(agent\)[\s\S]*<small>Status<\/small>[\s\S]*<small>CTX<\/small>[\s\S]*<small>Account<\/small>[\s\S]*<small>Processed<\/small>/);
  assert.match(app, /data-action="terminal-telemetry-toggle"[^>]*aria-controls="\$\{id\}-telemetry"/);
  assert.match(app, /class="terminal-telemetry-panel hidden" aria-label="Codex status and usage"/);
  assert.match(app, /state\.snapshot\?\.codexUsage/);
  assert.match(app, /Additional account-wide pools reported passively/);
  assert.match(styles, /\.inspector-usage-grid\s*\{/);
  assert.match(styles, /\.inspector-usage-pools\s*\{/);
  assert.match(styles, /\.terminal-telemetry-grid\s*\{/);
  assert.match(styles, /\.terminal-header-usage\.warn\s*\{/);
  assert.match(styles, /\.terminal-mobile-telemetry:not\(\.hidden\)\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-header-usage/);
  assert.match(index, /data-tool-view="usage"[^>]*>Usage<\/button>/);
  assert.match(index, /id="usage-view" class="tool-view" hidden/);
  assert.match(app, /function renderCodexUsageTools\(snapshot\)/);
  assert.match(app, /Context comes from the current exact rollout\. Processed deltas are grouped by tmux session name across tracked rollouts; account limits do not/);
  assert.match(app, /Session histories[\s\S]*ledger updated \$\{escapeHtml\(missionTimeLabel\(stats\.updatedAt\)\)\}/);
  assert.match(app, /mission\.priority[\s\S]*shortPath\(mission\.workspace\)[\s\S]*updated \$\{escapeHtml\(missionTimeLabel\(mission\.updatedAt\)\)\}/);
  assert.match(app, /Host-local today · UTC[\s\S]*observed rollout deltas/);
  assert.match(app, /const days = Array\.isArray\(stats\.days\) \? stats\.days\.slice\(0, 30\) : \[\]/);
  assert.match(app, /Host-local tracked period/);
  assert.doesNotMatch(app, /Processed since tracking/);
  assert.match(app, /rolloutCount[\s\S]*tracked rollout\$\{rolloutCount === 1 \? '' : 's'\}/);
  assert.match(app, /Only pools present in live structured telemetry appear here/);
  assert.match(app, /Account-wide weekly snapshot/);
  assert.match(app, /These are last-known passive snapshots, not continuous polling/);
  assert.match(app, /retained for \$\{escapeHtml\(stats\.retentionDays\)\} days/);
  assert.match(app, /ledger stores bounded numeric counters and queue identifiers only/i);
  assert.match(app, /data-tool-view="usage"[\s\S]*Local throughput today[\s\S]*Replayed rollout events[\s\S]*Partial observed deltas/);
  assert.match(app, /Different from Codex <code>\/usage<\/code>/);
  assert.match(app, /neither complete account activity nor account-limit consumption/);
  assert.match(app, /<h2>Per-ticket usage<\/h2>/);
  assert.match(app, /Token-event deltas are assigned only when exactly one queued ticket owns that agent and timestamp/);
  assert.match(app, /function promptTicketUsageLabel\(ticketUsage\)/);
  assert.match(styles, /\.prompt-ticket-usage\s*\{/);
  assert.doesNotMatch(app, /<span>Processed today<\/span>/);
  assert.match(styles, /\.usage-summary-grid\s*\{/);
  assert.match(styles, /\.usage-agent-row\s*\{/);
  assert.match(styles, /\.usage-day-row progress\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.usage-agent-row\s*\{[\s\S]*grid-template-columns: repeat\(2/);
});

test('Security tools show connection actors, destinations, timing, SSH events, and anomaly totals', async () => {
  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);

  assert.match(app, /<h2>Connection monitor<\/h2>/);
  assert.match(app, /Who connected, when, and which local service or remote endpoint was reached/);
  assert.match(app, /<h3>Inbound now<\/h3>/);
  assert.match(app, /<h3>Outbound now<\/h3>/);
  assert.match(app, /attribution\.service/);
  assert.match(app, /attribution\.basis/);
  assert.match(app, /observed endpoint/);
  assert.match(app, /Recent SSH activity/);
  assert.match(app, /Recently closed connections/);
  assert.match(app, /SSH failures · 24h/);
  assert.match(app, /unusual activity is flagged but never blocked automatically/);
  assert.match(app, /connection\.remoteAddress/);
  assert.match(app, /connection\.destination/);
  assert.match(app, /networkEventTime\(connection\.firstSeenAt\)/);
  assert.match(styles, /\.network-event-list\s*\{/);
  assert.match(styles, /\.network-event\.inbound/);
  assert.match(styles, /\.network-event\.failed/);
});

test('drawer state is exclusive and exact-session attention never leaks across workers', () => {
  assert.equal(nextDrawer(null, 'queue'), null);
  assert.equal(nextDrawer(null, 'tools'), 'tools');
  assert.equal(nextDrawer('tools', 'tools'), null);
  assert.equal(nextDrawer('tools', 'invalid'), null);

  const items = [
    { id: 'one', session: 'codex' },
    { id: 'two', session: 'codex2' },
    { id: 'host-only' }
  ];
  assert.deepEqual(attentionForSession(items, 'codex').map((item) => item.id), ['one']);
  assert.deepEqual(attentionForSession(items, 'codex2').map((item) => item.id), ['two']);
  assert.deepEqual(attentionForSession(items, ''), []);
  assert.deepEqual(attentionForSession(null, 'codex'), []);
});

test('Project Desk cache freshness is bounded and rejects missing, expired, or future entries', () => {
  const entry = { context: { artifacts: [{ name: 'fresh.pdf' }] }, fetchedAt: 10_000 };
  assert.equal(projectContextCacheFresh(entry, 10_000, 15_000), true);
  assert.equal(projectContextCacheFresh(entry, 24_999, 15_000), true);
  assert.equal(projectContextCacheFresh(entry, 25_000, 15_000), false);
  assert.equal(projectContextCacheFresh(entry, 9_999, 15_000), false);
  assert.equal(projectContextCacheFresh({ fetchedAt: 10_000 }, 10_001, 15_000), false);
  assert.equal(projectContextCacheFresh(entry, 10_001, 0), false);
  assert.equal(projectContextCacheFresh(entry, Number.NaN, 15_000), false);
});

test('dashboard shortcuts stay out of editors and map only deliberate navigation chords', () => {
  assert.equal(dashboardShortcut({ key: 'k' }, true), null);
  assert.equal(dashboardShortcut({ key: 'k', isComposing: true }, false), null);
  assert.equal(dashboardShortcut({ key: 'k', ctrlKey: true }, false), 'search');
  assert.equal(dashboardShortcut({ key: 'K', metaKey: true }, false), 'search');
  assert.equal(dashboardShortcut({ key: 'k', ctrlKey: true, altKey: true }, false), null);
  assert.equal(dashboardShortcut({ key: 'x', ctrlKey: true }, false), null);
  assert.equal(dashboardShortcut({ key: '1', altKey: true }, false), 'agents');
  assert.equal(dashboardShortcut({ key: '2', altKey: true }, false), 'queue');
  assert.equal(dashboardShortcut({ key: '3', altKey: true }, false), 'tools');
  assert.equal(dashboardShortcut({ key: 'n', altKey: true }, false), 'new-agent');
  assert.equal(dashboardShortcut({ key: 'N', altKey: true }, false), 'new-agent');
  assert.equal(dashboardShortcut({ key: '0', altKey: true }, false), 'workspace-focus');
  assert.equal(dashboardShortcut({ key: '[', altKey: true }, false), 'terminal-previous');
  assert.equal(dashboardShortcut({ key: ']', altKey: true }, false), 'terminal-next');
  assert.equal(dashboardShortcut({ key: '[', altKey: true }, true), null);
  assert.equal(dashboardShortcut({ key: ']', altKey: true, ctrlKey: true }, false), null);
  assert.equal(dashboardShortcut({ key: '9', altKey: true }, false), null);
  assert.equal(dashboardShortcut({ key: '?' }, false), 'shortcuts');
  assert.equal(dashboardShortcut({ key: '?' }, true), null);
  assert.equal(dashboardShortcut({ key: '/', altKey: true }, false), null);
  assert.equal(dashboardShortcut({ key: '/' }, false), 'search');
  assert.equal(dashboardShortcut({ key: 'x' }, false), null);
  assert.equal(dashboardShortcut({}, false), null);
});

test('terminal workspace restore keeps only bounded exact pane identities', () => {
  const value = {
    version: 1,
    active: {
      session: 'codex-beta',
      sessionCreatedAt: '2026-07-17T12:01:00.000Z',
      paneId: 'codex-beta:0.0',
      tmuxPaneId: '%12',
      panePid: 1200
    },
    terminals: [
      null,
      { session: 'bad-date', sessionCreatedAt: 'not-a-date', paneId: 'bad-date:0.0', tmuxPaneId: '%9', panePid: 900 },
      { session: 'codex-alpha', sessionCreatedAt: '2026-07-17T12:00:00.000Z', paneId: 'codex-alpha:0.0', tmuxPaneId: '%11', panePid: 1100, freeBounds: { left: 24, top: 80, width: 720, height: 540 } },
      { session: 'codex-alpha', sessionCreatedAt: '2026-07-17T12:00:00.000Z', paneId: 'codex-alpha:0.0', tmuxPaneId: '%11', panePid: 1100, minimized: true },
      { session: 'codex-beta', sessionCreatedAt: '2026-07-17T12:01:00.000Z', paneId: 'codex-beta:0.0', tmuxPaneId: '%12', panePid: 1200, minimized: true, refreshPaused: true, freeBounds: { left: 0, top: 0, width: 12, height: 12 } },
      { session: 'codex-gamma', sessionCreatedAt: '2026-07-17T12:02:00.000Z', paneId: 'codex-gamma:0.0', tmuxPaneId: '%13', panePid: 1300 }
    ]
  };

  assert.deepEqual(normalizedTerminalRestoreState(null), []);
  assert.deepEqual(normalizedTerminalRestoreState({ version: 2, terminals: [] }), []);
  assert.deepEqual(normalizedTerminalRestoreState(value, 2), [
    {
      session: 'codex-alpha',
      sessionCreatedAt: '2026-07-17T12:00:00.000Z',
      paneId: 'codex-alpha:0.0',
      tmuxPaneId: '%11',
      panePid: 1100,
      minimized: false,
      refreshPaused: false,
      freeBounds: { left: 24, top: 80, width: 720, height: 540 },
      active: false
    },
    {
      session: 'codex-beta',
      sessionCreatedAt: '2026-07-17T12:01:00.000Z',
      paneId: 'codex-beta:0.0',
      tmuxPaneId: '%12',
      panePid: 1200,
      minimized: true,
      refreshPaused: true,
      freeBounds: null,
      active: true
    }
  ]);
});

test('exact pane identity normalization rejects cross-wired targets and builds one canonical query', () => {
  const identity = {
    session: 'codex-safe',
    sessionCreatedAt: '2026-07-17T12:00:00.000Z',
    paneId: 'codex-safe:0.0',
    tmuxPaneId: '%21',
    panePid: 2100
  };
  assert.deepEqual(normalizedExactPaneIdentity(identity), identity);
  assert.equal(
    exactPaneIdentityQuery(identity),
    'sessionCreatedAt=2026-07-17T12%3A00%3A00.000Z&paneId=codex-safe%3A0.0&tmuxPaneId=%2521&panePid=2100'
  );
  for (const invalid of [
    null,
    [],
    { ...identity, session: 'not-codex', paneId: 'not-codex:0.0' },
    { ...identity, session: 'codex.invalid', paneId: 'codex.invalid:0.0' },
    { ...identity, session: 'codex-other' },
    { ...identity, paneId: 'codex-safe:not-a-coordinate' },
    { ...identity, sessionCreatedAt: 'not-a-date' },
    { ...identity, tmuxPaneId: '21' },
    { ...identity, panePid: 0 }
  ]) {
    assert.equal(normalizedExactPaneIdentity(invalid), null);
    assert.equal(exactPaneIdentityQuery(invalid), '');
  }
});

test('terminal workspace restore rejects malformed identities and unsafe window geometry', () => {
  const valid = {
    session: 'codex-safe',
    sessionCreatedAt: '2026-07-17T12:00:00.000Z',
    paneId: 'codex-safe:0.0',
    tmuxPaneId: '%21',
    panePid: 2100
  };
  const invalidIdentities = [
    { session: '' },
    { session: 'x'.repeat(161) },
    { sessionCreatedAt: '' },
    { sessionCreatedAt: 'not-a-date' },
    { paneId: '' },
    { paneId: 'x'.repeat(241) },
    { paneId: 'codex-other:0.0' },
    { paneId: 'codex-safe:not-a-coordinate' },
    { tmuxPaneId: '21' },
    { tmuxPaneId: null },
    { panePid: 21.5 },
    { panePid: 0 }
  ].map((override) => ({ ...valid, ...override }));
  assert.deepEqual(normalizedTerminalRestoreState({
    version: 1,
    active: 'not-an-identity',
    terminals: invalidIdentities
  }, 0), []);

  const unsafeBounds = [
    'not-an-object',
    { left: Number.NaN, top: 0, width: 720, height: 540 },
    { left: 50_001, top: 0, width: 720, height: 540 },
    { left: 0, top: -50_001, width: 720, height: 540 },
    { left: 0, top: 0, width: 319, height: 540 },
    { left: 0, top: 0, width: 10_001, height: 540 },
    { left: 0, top: 0, width: 720, height: 219 },
    { left: 0, top: 0, width: 720, height: 10_001 }
  ];
  for (const freeBounds of unsafeBounds) {
    const [restored] = normalizedTerminalRestoreState({
      version: 1,
      terminals: [{ ...valid, freeBounds }]
    });
    assert.equal(restored.freeBounds, null);
    assert.equal(restored.active, false);
  }

  for (const active of [
    { session: valid.session },
    { session: valid.session, sessionCreatedAt: valid.sessionCreatedAt },
    { session: valid.session, sessionCreatedAt: valid.sessionCreatedAt, paneId: valid.paneId }
  ]) {
    const [restored] = normalizedTerminalRestoreState({ version: 1, active, terminals: [valid] });
    assert.equal(restored.active, false);
  }
});

test('workspace focus mode keeps its restore action explicit', () => {
  assert.equal(workspaceFocusApplies(true, 'agents'), true);
  assert.equal(workspaceFocusApplies(true, 'queue'), false);
  assert.equal(workspaceFocusApplies(false, 'agents'), false);
  assert.equal(workspaceFocusApplies(true, 'unknown'), false);
  assert.deepEqual(workspaceFocusPresentation(false), {
    label: 'Focus canvas',
    shortLabel: 'Canvas',
    description: 'Hide side panels and expand the terminal canvas'
  });
  assert.deepEqual(workspaceFocusPresentation(true), {
    label: 'Show panels',
    shortLabel: 'Panels',
    description: 'Restore navigation, sessions, and the selected-agent inspector'
  });
});

test('automatic interface scrolling honors reduced motion without moving fixed launchers', async () => {
  assert.equal(preferredScrollBehavior(true), 'auto');
  assert.equal(preferredScrollBehavior(false), 'smooth');
  assert.equal(preferredScrollBehavior(undefined), 'smooth');

  const app = await uiSource('app.js');
  assert.match(app, /function motionAwareScrollBehavior\(\)[\s\S]*preferredScrollBehavior\(window\.matchMedia\?\./);
  assert.doesNotMatch(app, /scrollIntoView\(\{ behavior: 'smooth'/);
  assert.doesNotMatch(app, /behavior:\s*window\.matchMedia/);
  const launcherStart = app.indexOf('function openNewAgentLauncher(requestedWorkspace');
  const launcherEnd = app.indexOf('function closeNewAgentLauncher', launcherStart);
  const launcherSource = app.slice(launcherStart, launcherEnd);
  assert.ok(launcherStart >= 0 && launcherEnd > launcherStart);
  assert.doesNotMatch(launcherSource, /scrollIntoView/);
  assert.match(launcherSource, /focus\(\{ preventScroll: true \}\)/);
});

test('New Agent keyboard controls submit deliberately and keep focus inside the modal', () => {
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter', ctrlKey: true }), true);
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter', metaKey: true }), true);
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter' }), false);
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter', ctrlKey: true, shiftKey: true }), false);
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter', metaKey: true, altKey: true }), false);
  assert.equal(isNewAgentSubmitShortcut({ key: 'Enter', ctrlKey: true, isComposing: true }), false);
  assert.equal(isNewAgentSubmitShortcut(null), false);

  assert.equal(modalFocusIndex({ key: 'Tab' }, 2, 3), 0);
  assert.equal(modalFocusIndex({ key: 'Tab', shiftKey: true }, 0, 3), 2);
  assert.equal(modalFocusIndex({ key: 'Tab' }, 1, 3), -1);
  assert.equal(modalFocusIndex({ key: 'Tab' }, -1, 3), 0);
  assert.equal(modalFocusIndex({ key: 'Tab', shiftKey: true }, -1, 3), 2);
  assert.equal(modalFocusIndex({ key: 'Tab', ctrlKey: true }, 2, 3), -1);
  assert.equal(modalFocusIndex({ key: 'Escape' }, 2, 3), -1);
  assert.equal(modalFocusIndex({ key: 'Tab' }, 0, 0), -1);
});

test('Tools traps modal focus and Escape restores the opening control', async () => {
  const [index, app] = await Promise.all([uiSource('index.html'), uiSource('app.js')]);

  assert.match(index, /id="tools-drawer"[^>]*role="dialog" aria-modal="true"[^>]*tabindex="-1"/);
  const focusStart = app.indexOf('function modalFocusableElements(container)');
  const focusEnd = app.indexOf('function toggleDrawer', focusStart);
  const focusSource = app.slice(focusStart, focusEnd);
  assert.ok(focusStart >= 0 && focusEnd > focusStart);
  assert.match(focusSource, /querySelectorAll\('summary, button:not\(\[disabled\]\)[\s\S]*\[tabindex\]:not\(\[tabindex="-1"\]\)'\)/);
  assert.match(focusSource, /filter\(\(element\) => !element\.hidden && element\.getClientRects\(\)\.length\)/);
  assert.match(focusSource, /function handleDrawerKeydown\(event\)/);
  assert.match(focusSource, /event\.key === 'Escape'[\s\S]*setOpenDrawer\(null\)/);
  assert.match(focusSource, /modalFocusableElements\(drawer\)[\s\S]*modalFocusIndex\(event, focusable\.indexOf\(document\.activeElement\), focusable\.length\)/);
  assert.match(app, /document\.addEventListener\('keydown',[\s\S]*handleShortcutHelpKeydown\(event\)[\s\S]*handleDrawerKeydown\(event\)/);
  assert.match(app, /state\.drawerReturnFocus\?\.isConnected[\s\S]*state\.drawerReturnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(app, /event\.key === 'Escape' && state\.openDrawer/);
});

test('dashboard view preference honors deep links before durable local selection', () => {
  assert.equal(preferredDashboardView('#queue', 'agents'), 'queue');
  assert.equal(preferredDashboardView('#usage', 'agents'), 'usage');
  assert.equal(preferredDashboardView('#terminals', 'queue'), 'agents');
  assert.equal(preferredDashboardView('#agents', 'queue'), 'agents');
  assert.equal(preferredDashboardView('#unknown', 'queue'), 'queue');
  assert.equal(preferredDashboardView('', 'usage'), 'usage');
  assert.equal(preferredDashboardView('', 'agents'), 'agents');
  assert.equal(preferredDashboardView(null, 'invalid'), 'agents');
});

test('usage navigation selects the workspace Usage panel, not the Tools drawer panel', async () => {
  const app = await uiSource('app.js');
  assert.match(app, /const selectedViewId = view === 'usage' \? 'usage-workspace-view' : `\$\{view\}-view`/);
});

test('Tools classifies apps and listener exposure from live state instead of static labels', () => {
  assert.deepEqual(serviceToolsPresentation({ running: true, portStates: [{ port: 8787, listening: true }] }), {
    group: 'live', tone: 'good', fault: false, running: true, openPorts: [8787], closedPorts: []
  });
  assert.deepEqual(serviceToolsPresentation({ running: true, portStates: [{ port: 8787, listening: false }] }), {
    group: 'attention', tone: 'bad', fault: true, running: true, openPorts: [], closedPorts: [8787]
  });
  assert.deepEqual(serviceToolsPresentation({ running: false, external: true, portStates: [] }), {
    group: 'available', tone: 'warn', fault: false, running: false, openPorts: [], closedPorts: []
  });
  assert.deepEqual(serviceToolsPresentation({ running: true, discovered: true, portStates: [] }), {
    group: 'discovered', tone: 'good', fault: false, running: true, openPorts: [], closedPorts: []
  });
  assert.equal(serviceToolsPresentation({ health: { ok: false } }).group, 'attention');
  assert.deepEqual(serviceToolsPresentation({
    running: true,
    healthy: false,
    portStates: [null, { port: 'bad', listening: true }, { port: 70000, listening: false }]
  }), {
    group: 'attention', tone: 'bad', fault: true, running: true, openPorts: [], closedPorts: []
  });
  assert.deepEqual(serviceToolsPresentation(null), {
    group: 'available', tone: 'neutral', fault: false, running: false, openPorts: [], closedPorts: []
  });

  assert.equal(listenerExposure(unspecifiedIpv4), 'all-interfaces');
  assert.equal(listenerExposure('[::]'), 'all-interfaces');
  assert.equal(listenerExposure(loopbackIpv4), 'loopback');
  assert.equal(listenerExposure('::1'), 'loopback');
  assert.equal(listenerExposure(interfaceIpv4), 'interface');
  assert.equal(listenerExposure(), 'interface');
});

test('Tools presents task-focused Pulse, Apps, Security, and Host tabs', async () => {
  const [index, app, styles] = await Promise.all([
    uiSource('index.html'),
    uiSource('app.js'),
    uiSource('styles.css')
  ]);

  assert.match(index, /data-tool-view="overview"[^>]*>Pulse</);
  assert.match(index, /data-tool-view="services"[^>]*>Apps</);
  assert.match(index, /data-tool-view="security"[^>]*>Security</);
  assert.match(index, /data-tool-view="system"[^>]*>Host</);
  assert.doesNotMatch(index, /Current listeners|Host activity|Recent controls<\/p>/);

  assert.match(app, /function renderToolsOverview[\s\S]*Needs action[\s\S]*Open a live app/);
  assert.match(app, /function renderServices[\s\S]*Ready when needed[\s\S]*Other live sessions/);
  assert.match(app, /function serviceCardMarkup[\s\S]*<details class="app-card-details">[\s\S]*Recent output/);
  assert.match(app, /function renderHostTools[\s\S]*Host health[\s\S]*Listening ports[\s\S]*Resource pressure[\s\S]*Recent controls/);
  assert.match(app, /function hostMemoryStats[\s\S]*availableMem/);
  assert.match(app, /function hostStorageStats[\s\S]*rootFs/);
  assert.match(app, /Root disk used/);
  assert.match(app, /digestMetric\('Root disk'/);
  assert.match(app, /digestMetric\('Swap'/);
  assert.doesNotMatch(app, /function render(?:Ports|Processes|Audit)\(/);
  assert.match(styles, /Task-focused Tools:[\s\S]*\.app-grid[\s\S]*\.host-section-grid/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.app-grid,[\s\S]*\.host-section-grid/);
});

test('browser title prioritizes connection and decision status without losing section context', () => {
  assert.equal(dashboardDocumentTitle(), 'Terminals — PaneFleet');
  assert.equal(dashboardDocumentTitle({ connection: 'error', decisionCount: 3 }), 'Offline · Terminals — PaneFleet');
  assert.equal(dashboardDocumentTitle({ connection: 'poll', decisionCount: 3 }), 'Polling · Terminals — PaneFleet');
  assert.equal(dashboardDocumentTitle({ decisionCount: 2.9, workingCount: 4 }), 'Needs you: 2 · Terminals — PaneFleet');
  assert.equal(dashboardDocumentTitle({ view: 'queue', queuedCount: 5, workingCount: 4 }), 'Queued: 5 · Queue — PaneFleet');
  assert.equal(dashboardDocumentTitle({ workingCount: 3 }), 'Working: 3 · Terminals — PaneFleet');
  assert.equal(dashboardDocumentTitle({ drawer: 'tools' }), 'Tools — PaneFleet');
});

test('browser title decisions stay scoped to the current dashboard section', () => {
  const attentionItems = [
    { id: 'live-agent', session: 'codex', kind: 'agent', requiresDecision: true },
    { id: 'live-mission', missionId: 'mission-live', kind: 'mission', requiresDecision: true },
    { id: 'old-mission', missionId: 'mission-old', kind: 'mission', requiresDecision: true },
    { id: 'security', kind: 'security', requiresDecision: true },
    { id: 'informational', session: 'codex', kind: 'agent', requiresDecision: false }
  ];
  const missions = [
    { id: 'mission-live', assignedSession: 'codex' },
    { id: 'mission-old', assignedSession: 'missing-agent' }
  ];
  const agents = [{ session: 'codex' }];

  assert.equal(dashboardSectionDecisionCount({ attentionItems, missions, agents }), 2);
  assert.equal(dashboardSectionDecisionCount({
    view: 'queue', attentionItems, missions, agents, promptQueueNeedsReview: 3.8
  }), 3);
  assert.equal(dashboardSectionDecisionCount({ drawer: 'tools', attentionItems, missions, agents }), 1);
  assert.equal(dashboardSectionDecisionCount({
    attentionItems: attentionItems.filter((item) => item.id === 'old-mission'), missions, agents
  }), 0);
  assert.equal(dashboardSectionDecisionCount(), 0);
  assert.equal(dashboardSectionDecisionCount({ attentionItems: null, missions: null, agents: null }), 0);
  assert.equal(dashboardSectionDecisionCount({ view: 'queue', promptQueueNeedsReview: 'invalid' }), 0);
  assert.equal(dashboardSectionDecisionCount({ view: 'queue', promptQueueNeedsReview: -4 }), 0);
  assert.equal(dashboardSectionDecisionCount({ drawer: 'tools', attentionItems: {} }), 0);
  assert.equal(dashboardSectionDecisionCount({
    drawer: 'tools', attentionItems: [{ kind: null, requiresDecision: true }]
  }), 0);
  assert.equal(dashboardSectionDecisionCount({
    attentionItems: [{ missionId: 'missing', requiresDecision: true }],
    missions: {},
    agents: {}
  }), 0);
  assert.equal(dashboardSectionDecisionCount({
    attentionItems: [{ missionId: 'missing', requiresDecision: true }],
    missions: [null],
    agents: [null]
  }), 0);
  assert.equal(dashboardSectionDecisionCount({
    drawer: 'tools',
    attentionItems: [
      { serviceId: 'api', kind: 'agent', requiresDecision: true },
      { kind: 'system', requiresDecision: true },
      { kind: 'security', requiresDecision: false },
      null
    ]
  }), 2);
});

test('picker controls stay visible on live terminals before PaneFleet opens a picker', () => {
  assert.deepEqual(terminalPickerAvailability({
    mode: 'agent', session: 'codex-worker', capabilityAvailable: true
  }), { visible: true, enabled: true });
  assert.deepEqual(terminalPickerAvailability({
    mode: 'agent', session: 'codex-worker', capabilityAvailable: false
  }), { visible: true, enabled: false });
  assert.deepEqual(terminalPickerAvailability({
    mode: 'agent', session: 'codex-worker', capabilityAvailable: true, busy: true
  }), { visible: true, enabled: false });
  assert.deepEqual(terminalPickerAvailability({
    mode: 'static', session: 'codex-worker', capabilityAvailable: true
  }), { visible: false, enabled: false });
  assert.deepEqual(terminalPickerAvailability({
    mode: 'agent', session: '  ', capabilityAvailable: true
  }), { visible: false, enabled: false });
  assert.deepEqual(terminalPickerAvailability({
    mode: 'agent', session: null, capabilityAvailable: true
  }), { visible: false, enabled: false });
});

test('connection state presentation keeps compact labels tied to explicit operational meaning', () => {
  assert.deepEqual(connectionStatePresentation('live'), {
    label: 'Live', tone: 'good', description: 'Live updates connected'
  });
  assert.deepEqual(connectionStatePresentation('poll'), {
    label: 'Polling', tone: 'warn', description: 'Live stream unavailable; snapshot polling is active'
  });
  assert.deepEqual(connectionStatePresentation('error'), {
    label: 'Offline', tone: 'bad', description: 'Dashboard updates are unavailable'
  });
  assert.deepEqual(connectionStatePresentation('init'), {
    label: 'Connecting', tone: 'neutral', description: 'Connecting to dashboard updates'
  });
  assert.deepEqual(connectionStatePresentation('unknown'), connectionStatePresentation());
});

test('text-selection detection defers only a real non-collapsed browser range', () => {
  assert.equal(hasActiveTextSelection(null), false);
  assert.equal(hasActiveTextSelection({ isCollapsed: true, rangeCount: 1, toString: () => 'selected' }), false);
  assert.equal(hasActiveTextSelection({ isCollapsed: false, rangeCount: 0, toString: () => 'selected' }), false);
  assert.equal(hasActiveTextSelection({ isCollapsed: false, rangeCount: 1, toString: () => '' }), false);
  assert.equal(hasActiveTextSelection({ isCollapsed: false, rangeCount: 1, toString: () => 'selected text' }), true);
  assert.equal(hasActiveTextSelection({ isCollapsed: false, rangeCount: 1, toString: () => { throw new Error('detached selection'); } }), false);
});

test('runtime version presentation fails visibly closed for stale or unverifiable backends', () => {
  assert.deepEqual(runtimeVersionPresentation(null, 2), {
    restartRequired: true,
    tone: 'warning',
    title: 'Dashboard backend restart required',
    detail: 'The browser interface and running backend are from different PaneFleet versions.'
  });
  assert.equal(runtimeVersionPresentation({ protocolVersion: 1, status: 'current' }, 2).restartRequired, true);
  assert.match(runtimeVersionPresentation({
    protocolVersion: 2,
    status: 'restart_required',
    restartRequired: true
  }, 2).detail, /changed after this backend process started/);
  assert.match(runtimeVersionPresentation({
    protocolVersion: 2,
    status: 'source_unavailable',
    restartRequired: true
  }, 2).detail, /cannot verify/);
  assert.deepEqual(runtimeVersionPresentation({
    protocolVersion: 2,
    status: 'current',
    restartRequired: false,
    processBuildId: 'abc123'
  }, 2), {
    restartRequired: false,
    tone: 'good',
    title: 'Dashboard backend is current',
    detail: 'Backend abc123 matches its runtime sources on disk.'
  });
});

test('operational notices auto-dismiss only when they are routine', () => {
  assert.equal(noticeAutoDismissMs('info'), 8000);
  assert.equal(noticeAutoDismissMs('success'), 6000);
  assert.equal(noticeAutoDismissMs('warning'), 0);
  assert.equal(noticeAutoDismissMs('error'), 0);
  assert.equal(noticeAutoDismissMs('ERROR'), 0);
  assert.equal(noticeAutoDismissMs('unknown'), 8000);
  assert.equal(noticeAutoDismissMs(null), 8000);
});

test('mobile terminal cycling wraps predictably and rejects an empty terminal set', () => {
  assert.equal(cycledItemIndex(0, 0, 1), -1);
  assert.equal(cycledItemIndex(0, 3, 1), 1);
  assert.equal(cycledItemIndex(2, 3, 1), 0);
  assert.equal(cycledItemIndex(1, 3, -1), 0);
  assert.equal(cycledItemIndex(0, 3, -1), 2);
  assert.equal(cycledItemIndex(-1, 3, 1), 1);
  assert.equal(cycledItemIndex(4, 3, -1), 2);
});

test('terminal output find is case-insensitive, non-overlapping, and safely bounded', () => {
  assert.deepEqual(terminalFindOffsets('Alpha beta ALPHA', 'alpha'), [0, 11]);
  assert.deepEqual(terminalFindOffsets('aaaa', 'aa'), [0, 2]);
  assert.deepEqual(terminalFindOffsets('one one one', 'one', 2), [0, 4]);
  assert.deepEqual(terminalFindOffsets('one one', 'one', 'invalid'), [0, 4]);
  assert.deepEqual(terminalFindOffsets('text', ''), []);
  assert.deepEqual(terminalFindOffsets('', 'text'), []);
});

test('terminal find shortcut is deliberate and stays out of editors', () => {
  assert.equal(isTerminalFindShortcut({ key: 'f', ctrlKey: true }), true);
  assert.equal(isTerminalFindShortcut({ key: 'F', metaKey: true }), true);
  assert.equal(isTerminalFindShortcut({ key: 'f', ctrlKey: true }, true), false);
  assert.equal(isTerminalFindShortcut({ key: 'f', ctrlKey: true, shiftKey: true }), false);
  assert.equal(isTerminalFindShortcut({ key: 'f' }), false);
  assert.equal(isTerminalFindShortcut(null), false);
});

test('terminal capture pause messaging stays explicit that the agent keeps running', () => {
  assert.deepEqual(terminalRefreshPresentation(false), {
    label: 'Pause',
    pressed: false,
    description: 'Pause live terminal capture while the agent keeps running',
    notice: 'Live capture resumed. The agent was never paused.'
  });
  assert.deepEqual(terminalRefreshPresentation(true), {
    label: 'Resume',
    pressed: true,
    description: 'Resume live terminal capture',
    notice: 'Live capture paused. The agent keeps running.'
  });
  assert.deepEqual(terminalRefreshPresentation(false, true), {
    label: 'Retry',
    pressed: true,
    description: 'Retry capture for this unavailable exact terminal',
    notice: 'Live capture stopped after the exact terminal disappeared. The agent was not stopped.'
  });
  assert.deepEqual(terminalCaptureFailureTransition(0, 'pane_not_found', 1000), {
    failureCount: 1,
    unavailable: false,
    retryDelayMs: 2000
  });
  assert.deepEqual(terminalCaptureFailureTransition(1, 'pane_not_found', 1000), {
    failureCount: 2,
    unavailable: false,
    retryDelayMs: 4000
  });
  assert.deepEqual(terminalCaptureFailureTransition(2, 'pane_not_found', 1000), {
    failureCount: 3,
    unavailable: true,
    retryDelayMs: null
  });
  assert.deepEqual(terminalCaptureFailureTransition(8, 'capture_failed', 1000), {
    failureCount: 0,
    unavailable: false,
    retryDelayMs: 1000
  });
});

test('an exact live shell gets an explicit Codex restart action inside its terminal', () => {
  const item = { mode: 'agent', paneId: 'codex-kronos:1.1' };
  const agent = { id: 'codex-kronos:1.1', canResume: true };
  assert.deepEqual(terminalAgentResumePresentation(item, agent), {
    label: 'Restart Codex',
    title: 'Codex exited; tmux is still running',
    description: 'Restart Codex in this exact terminal and resume its last session.'
  });
  assert.equal(terminalAgentResumePresentation({ ...item, mode: 'static' }, agent), null);
  assert.equal(terminalAgentResumePresentation(item, { ...agent, canResume: false }), null);
  assert.equal(terminalAgentResumePresentation(item, { ...agent, id: 'codex-kronos:2.1' }), null);
  assert.deepEqual(terminalAgentResumePresentation({ mode: 'agent', paneId: '' }, agent), {
    label: 'Restart Codex',
    title: 'Codex exited; tmux is still running',
    description: 'Restart Codex in this exact terminal and resume its last session.'
  });
});

test('terminal tab keys wrap predictably and mobile switcher labels include the target name', () => {
  assert.equal(terminalTabKeyIndex('ArrowRight', 2, 3), 0);
  assert.equal(terminalTabKeyIndex('ArrowLeft', 0, 3), 2);
  assert.equal(terminalTabKeyIndex('Home', 2, 3), 0);
  assert.equal(terminalTabKeyIndex('End', 0, 3), 2);
  assert.equal(terminalTabKeyIndex('Enter', 1, 3), -1);
  assert.equal(terminalTabKeyIndex('ArrowRight', 0, 0), -1);

  assert.equal(terminalSwitcherLabel(1, 4, 'API worker'), '2 of 4 · API worker');
  assert.equal(terminalSwitcherLabel(1, 4, 'API worker', 'Working'), '2 of 4 · API worker · Working');
  assert.equal(terminalSwitcherLabel(0, 1, 'API worker', '  '), '1 of 1 · API worker');
  assert.equal(terminalSwitcherLabel(0, 1, '  '), '1 of 1 · Terminal');
  assert.equal(terminalSwitcherLabel(0, 1, null), '1 of 1 · Terminal');
  assert.equal(terminalSwitcherLabel(-1, 3, 'API worker'), 'Minimized terminal');
  assert.equal(terminalSwitcherLabel(4, 3, 'API worker'), 'Minimized terminal');
  assert.equal(terminalSwitcherLabel(Number.NaN, Number.NaN, null), 'Minimized terminal');
});

test('terminal view controls clearly avoid agent lifecycle actions', async () => {
  const app = await uiSource('app.js');
  const closeStart = app.indexOf('function closeTerminalWindow(item, { announce = false } = {})');
  const closeEnd = app.indexOf('function minimizeTerminalWindow(item)', closeStart);
  const minimizeEnd = app.indexOf('function restoreTerminalWindow(item)', closeEnd);
  assert.ok(closeStart >= 0 && closeEnd > closeStart && minimizeEnd > closeEnd);

  const closeSource = app.slice(closeStart, closeEnd);
  const minimizeSource = app.slice(closeEnd, minimizeEnd);
  assert.doesNotMatch(closeSource, /api\(|sessionAction|\/stop|\/interrupt/);
  assert.doesNotMatch(minimizeSource, /api\(|sessionAction|\/stop|\/interrupt/);
  assert.match(closeSource, /The agent keeps running; reopen it from Sessions/);
  assert.match(minimizeSource, /The agent and your draft stay active/);
  assert.match(app, /terminal-control-label-mobile" aria-hidden="true">Back<\/span>/);
  assert.match(app, /terminal-control-label-desktop" aria-hidden="true">Dock<\/span>/);
  assert.match(app, /const closeViewLabel = mode === 'static' \? 'Close terminal view' : 'Close terminal view; agent keeps running'/);
  assert.match(app, /title="\$\{closeViewLabel\}" aria-label="\$\{closeViewLabel\}"/);
  assert.match(app, /case 'terminal-close':[\s\S]*closeTerminalWindow\(terminalItem, \{ announce: true \}\)/);
});

test('session status filters classify operational states and compose with text search', () => {
  assert.equal(sessionFilterCategory({ state: 'waiting', tone: 'warn' }), 'needs');
  assert.equal(sessionFilterCategory({ state: 'stopped', tone: 'bad' }), 'needs');
  assert.equal(sessionFilterCategory({ state: 'busy', tone: 'good' }, 2), 'needs');
  assert.equal(sessionFilterCategory({ state: 'busy', tone: 'good' }), 'active');
  assert.equal(sessionFilterCategory({ state: 'idle', tone: 'good' }), 'idle');
  assert.equal(sessionFilterCategory({ state: 'unknown', tone: 'warn' }), 'other');
  assert.equal(sessionFilterCategory(null), 'other');

  assert.equal(sessionFilterMatches('all', 'other', 'Codex Client', ''), true);
  assert.equal(sessionFilterMatches('active', 'active', 'Codex Client', ' client '), true);
  assert.equal(sessionFilterMatches('active', 'idle', 'Codex Client', ' client'), false);
  assert.equal(sessionFilterMatches('needs', 'needs', 'Codex Client', 'missing'), false);
  assert.equal(sessionFilterMatches('invalid', 'other', 'Codex Client', 'CODEX'), true);
  assert.equal(sessionFilterMatches('idle', 'idle', null, null), true);
  assert.equal(sessionFilterMatches('idle', 'idle', null, 'missing'), false);
});

test('session cards spell out live state without relying on color', () => {
  assert.deepEqual(sessionStatusPresentation({ state: 'busy', tone: 'good' }), {
    label: 'Working',
    tone: 'working',
    description: 'This session is actively working.'
  });
  assert.deepEqual(sessionStatusPresentation({ state: 'idle', tone: 'good', reason: 'Composer is ready' }), {
    label: 'Ready',
    tone: 'ready',
    description: 'Composer is ready'
  });
  assert.equal(sessionStatusPresentation({ state: 'busy', tone: 'good' }, 1).label, 'Needs you');
  assert.equal(sessionStatusPresentation({ state: 'waiting', tone: 'warn' }).tone, 'needs');
  assert.equal(sessionStatusPresentation({ state: 'stopped', tone: 'bad' }).label, 'Stopped');
  assert.equal(sessionStatusPresentation({ state: 'idle', tone: 'bad' }).label, 'Check');
  assert.equal(sessionStatusPresentation({ state: 'goal-achieved', tone: 'good' }).label, 'Goal Achieved');
  assert.equal(sessionStatusPresentation({ state: '   ', tone: ' ' }).label, 'Unknown');
  assert.deepEqual(sessionStatusPresentation(null), {
    label: 'Unknown',
    tone: 'neutral',
    description: 'Session state: Unknown.'
  });
});

test('session pin controls explain ordering instead of relying on ambiguous dots', () => {
  assert.deepEqual(sessionPinPresentation(false, 'API worker'), {
    symbol: '☆',
    visibleLabel: 'Pin',
    actionLabel: 'Pin API worker to top',
    title: 'Pin this session to the top.'
  });
  assert.deepEqual(sessionPinPresentation(true, 'API worker'), {
    symbol: '★',
    visibleLabel: 'Pinned',
    actionLabel: 'Unpin API worker',
    title: 'Pinned to top. Activate to return this session to recent order.'
  });
  assert.equal(sessionPinPresentation(false, '  ').actionLabel, 'Pin session to top');
  assert.equal(sessionPinPresentation(true, null).actionLabel, 'Unpin session');
});

test('session search keys only target visible results and stay clear of modified input', () => {
  assert.equal(sessionSearchKeyAction({ key: 'Enter' }, 2, 'codex'), 'open-first');
  assert.equal(sessionSearchKeyAction({ key: 'ArrowDown' }, 2, 'codex'), 'focus-first');
  assert.equal(sessionSearchKeyAction({ key: 'ArrowUp' }, 2, 'codex'), 'focus-last');
  assert.equal(sessionSearchKeyAction({ key: 'Escape' }, 2, 'codex'), 'clear');
  assert.equal(sessionSearchKeyAction({ key: 'Enter' }, 0, 'codex'), null);
  assert.equal(sessionSearchKeyAction({ key: 'Escape' }, 2, ''), null);
  assert.equal(sessionSearchKeyAction({ key: 'Enter', ctrlKey: true }, 2, 'codex'), null);
  assert.equal(sessionSearchKeyAction({ key: 'ArrowDown', altKey: true }, 2, 'codex'), null);
  assert.equal(sessionSearchKeyAction({ key: 'ArrowDown', shiftKey: true }, 2, 'codex'), null);
  assert.equal(sessionSearchKeyAction({ key: 'Enter', isComposing: true }, 2, 'codex'), null);
  assert.equal(sessionSearchKeyAction(null, Number.NaN, null), null);
});

test('session result counts distinguish the full rail from a constrained result set', () => {
  assert.deepEqual(sessionResultCountPresentation(12, 12, false), {
    label: '12',
    description: '12 sessions'
  });
  assert.deepEqual(sessionResultCountPresentation(1, 1, false), {
    label: '1',
    description: '1 session'
  });
  assert.deepEqual(sessionResultCountPresentation(3, 12, true), {
    label: '3/12',
    description: '3 of 12 sessions visible'
  });
  assert.deepEqual(sessionResultCountPresentation(20, 12, true), {
    label: '12/12',
    description: '12 of 12 sessions visible'
  });
  assert.deepEqual(sessionResultCountPresentation(-2, Number.NaN, true), {
    label: '0/0',
    description: '0 of 0 sessions visible'
  });
  assert.deepEqual(sessionResultCountPresentation(Number.NaN, 5, true), {
    label: '0/5',
    description: '0 of 5 sessions visible'
  });
});

test('new terminal output starts at the newest line without overriding later manual scroll', () => {
  assert.equal(shouldStickTerminalOutput({ scrollToBottomOnNextOutput: true, forceScrollUntil: 0 }, false, 100), true);
  assert.equal(shouldStickTerminalOutput({ scrollToBottomOnNextOutput: false, forceScrollUntil: 101 }, false, 100), true);
  assert.equal(shouldStickTerminalOutput({ scrollToBottomOnNextOutput: false, forceScrollUntil: 0 }, true, 100), true);
  assert.equal(shouldStickTerminalOutput({ scrollToBottomOnNextOutput: false, forceScrollUntil: 100 }, false, 100), false);
  assert.equal(shouldStickTerminalOutput(null, false, Number.NaN), false);
});

test('horizontal strips reveal an off-screen active item without moving an already visible item', () => {
  assert.equal(horizontalRevealScrollLeft(300, 120, 30, 90), 30);
  assert.equal(horizontalRevealScrollLeft(300, 120, -6, 40), 0);
  assert.equal(horizontalRevealScrollLeft(300, 120, 240, 460), 160);
  assert.equal(horizontalRevealScrollLeft(300, 120, 180, 260), 120);
});

test('terminal latest control distinguishes reading history from unseen output', () => {
  assert.deepEqual(terminalLatestPresentation(true, false), {
    hidden: true,
    label: 'Latest ↓',
    description: 'Showing latest terminal output'
  });
  assert.deepEqual(terminalLatestPresentation(false, false), {
    hidden: false,
    label: 'Latest ↓',
    description: 'Jump to latest terminal output'
  });
  assert.deepEqual(terminalLatestPresentation(false, true), {
    hidden: false,
    label: 'New output ↓',
    description: 'New terminal output available; jump to latest'
  });
});

test('terminal focus is inspection-first on phones and typing-first on desktop', () => {
  assert.equal(terminalFocusKind(false, true), 'output');
  assert.equal(terminalFocusKind(false, false), 'output');
  assert.equal(terminalFocusKind(true, false), 'output');
  assert.equal(terminalFocusKind(true, true), 'editor');
});

test('terminal desktop layout excludes compact phone viewports even when they are wide', () => {
  assert.equal(terminalDesktopLayout(true, false), true);
  assert.equal(terminalDesktopLayout(true, true), false);
  assert.equal(terminalDesktopLayout(false, true), false);
  assert.equal(terminalDesktopLayout(false, false), false);
});

test('only the active, visible, unobscured phone terminal owns mobile modal state', () => {
  assert.equal(terminalModalActive(false, false, true, false), true);
  assert.equal(terminalModalActive(false, false, false, false), false);
  assert.equal(terminalModalActive(false, false, true, true), false);
  assert.equal(terminalModalActive(false, true, true, false), false);
  assert.equal(terminalModalActive(true, false, true, false), false);
});

test('terminal chrome resets only when crossing the desktop and phone layout boundary', () => {
  assert.equal(terminalChromeCollapseAfterLayoutChange(true, false), true);
  assert.equal(terminalChromeCollapseAfterLayoutChange(false, true), false);
  assert.equal(terminalChromeCollapseAfterLayoutChange(true, true), null);
  assert.equal(terminalChromeCollapseAfterLayoutChange(false, false), null);
  assert.equal(terminalChromeCollapseAfterLayoutChange(null, false), null);
});

test('terminal composer height follows visual phone space without crowding short keyboards', () => {
  assert.equal(terminalComposerTextareaHeight(844, 500, true), 202);
  assert.equal(terminalComposerTextareaHeight(390, 500, true), 70);
  assert.equal(terminalComposerTextareaHeight(280, 500, true), 56);
  assert.equal(terminalComposerTextareaHeight(900, 80, false), 80);
  assert.equal(terminalComposerTextareaHeight(900, 500, false), 198);
  assert.equal(terminalComposerTextareaHeight(undefined, undefined, true), 88);
});

test('terminal window dragging stays mouse-and-pen only in free desktop layouts', () => {
  const ready = {
    desktop: true,
    layout: 'free',
    maximized: false,
    button: 0
  };
  assert.equal(terminalPointerInteractionAllowed({ ...ready, pointerType: 'mouse' }), true);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, pointerType: 'pen' }), true);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, pointerType: 'touch' }), false);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, desktop: false, pointerType: 'mouse' }), false);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, layout: 'focus', pointerType: 'mouse' }), false);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, maximized: true, pointerType: 'mouse' }), false);
  assert.equal(terminalPointerInteractionAllowed({ ...ready, button: 1, pointerType: 'mouse' }), false);
});

test('terminal composer presentation keeps reading mode explicit and preserves draft visibility', () => {
  assert.deepEqual(terminalComposerPresentation(true, false), {
    label: 'Reply',
    description: 'Expand terminal reply composer'
  });
  assert.deepEqual(terminalComposerPresentation(true, true), {
    label: 'Reply · draft',
    description: 'Expand terminal reply composer; draft saved'
  });
  assert.deepEqual(terminalComposerPresentation(false, false), {
    label: 'Hide',
    description: 'Collapse terminal reply composer'
  });
  assert.deepEqual(terminalComposerPresentation(false, true), {
    label: 'Hide',
    description: 'Collapse terminal reply composer; draft saved'
  });
  assert.deepEqual(terminalComposerPresentation(true, true, false), {
    label: 'Reply · draft',
    description: 'Expand terminal reply composer; draft not saved'
  });

  assert.deepEqual(terminalDraftPresentation('', false, false, true), {
    label: 'No draft',
    tone: 'neutral',
    description: 'No terminal reply draft.'
  });
  assert.equal(terminalDraftPresentation('hello').label, 'Draft saved');
  assert.equal(terminalDraftPresentation('hello', false, false, false).label, 'Draft not saved');
  assert.equal(terminalDraftPresentation('', true).label, 'Paste awaiting review');
  assert.equal(terminalDraftPresentation('hello', true, true, false).label, 'Sending...');
});

test('finished prompt origin filters use durable schedule metadata', () => {
  const mine = { id: 'mine', session: 'codex-client', text: 'Review mobile layout', target: { displayName: 'Client app' } };
  const automated = { id: 'auto', scheduleId: 'schedule-nightly-12345678', text: 'Nightly checks', completionSnapshot: 'All tests passed', summaryState: 'captured' };
  const items = [mine, automated];
  assert.equal(promptHistoryOrigin(mine), 'mine');
  assert.equal(promptHistoryOrigin(automated), 'automated');
  assert.equal(promptHistoryOrigin(null), 'mine');
  assert.deepEqual(filterPromptHistory(items, 'all'), items);
  assert.deepEqual(filterPromptHistory(items, 'mine'), [mine]);
  assert.deepEqual(filterPromptHistory(items, 'automated'), [automated]);
  assert.deepEqual(filterPromptHistory(items, 'all', ' CLIENT '), [mine]);
  assert.deepEqual(filterPromptHistory(items, 'automated', 'tests passed'), [automated]);
  assert.deepEqual(filterPromptHistory(items, 'mine', 'nightly'), []);
  assert.deepEqual(filterPromptHistory(items, 'all', '   '), items);
  assert.deepEqual(filterPromptHistory(items, 'invalid'), items);
  assert.deepEqual(filterPromptHistory(null, 'mine'), []);
});

test('Prompt Queue section navigation is allowlisted to stable in-view targets', () => {
  assert.equal(promptQueueSectionTarget('compose'), '#prompt-queue-compose');
  assert.equal(promptQueueSectionTarget('ideas'), '#prompt-queue-ideas');
  assert.equal(promptQueueSectionTarget('ACTIVE'), '#prompt-queue-active');
  assert.equal(promptQueueSectionTarget('schedules'), '#prompt-queue-schedules');
  assert.equal(promptQueueSectionTarget('history'), '#prompt-queue-history');
  assert.equal(promptQueueSectionTarget('tools'), null);
  assert.equal(promptQueueSectionTarget(''), null);
  assert.equal(promptQueueSectionTarget(null), null);
});

test('Prompt Queue composer exposes honest readiness and deliberate desktop submit shortcuts', () => {
  assert.deepEqual(promptQueueComposerPresentation({ session: 'codex', text: 'Next task', cron: '' }, true), {
    label: 'Add prompt', sendLabel: 'Send now', disabled: false, sendDisabled: false, selectedCount: 1, count: '9/4000', full: false, hasDraft: true, unsafeCharacterCount: 0
  });
  assert.deepEqual(promptQueueComposerPresentation({ session: 'codex', text: 'Next task', cron: '0 * * * *' }, true), {
    label: 'Create schedule', sendLabel: 'Send now', disabled: false, sendDisabled: true, selectedCount: 1, count: '9/4000', full: false, hasDraft: true, unsafeCharacterCount: 0
  });
  assert.equal(promptQueueComposerPresentation({ session: '', text: 'Next task' }, true).disabled, true);
  assert.equal(promptQueueComposerPresentation({ session: 'codex', text: '   ' }, true).disabled, true);
  assert.deepEqual(promptQueueComposerPresentation({ session: 'codex', text: '', cron: '0 * * * *' }, true), {
    label: 'Create schedule', sendLabel: 'Send now', disabled: true, sendDisabled: true, selectedCount: 1, count: '0/4000', full: false, hasDraft: true, unsafeCharacterCount: 0
  });
  assert.equal(promptQueueComposerPresentation({ session: 'codex', text: 'Next task' }, false).disabled, true);
  assert.deepEqual(promptQueueComposerPresentation({ session: 'codex', text: 'x'.repeat(4000) }, true), {
    label: 'Add prompt', sendLabel: 'Send now', disabled: false, sendDisabled: false, selectedCount: 1, count: '4000/4000', full: true, hasDraft: true, unsafeCharacterCount: 0
  });
  assert.deepEqual(promptQueueComposerPresentation(null, true), {
    label: 'Add prompt', sendLabel: 'Send now', disabled: true, sendDisabled: true, selectedCount: 0, count: '0/4000', full: false, hasDraft: false, unsafeCharacterCount: 0
  });
  assert.deepEqual(promptQueueComposerPresentation({ sessions: ['codex', 'codex2'], text: 'Fan out', cron: '' }, true), {
    label: 'Queue for 2', sendLabel: 'Send now to 2', disabled: false, sendDisabled: false, selectedCount: 2, count: '7/4000', full: false, hasDraft: true, unsafeCharacterCount: 0
  });
  assert.equal(promptQueueComposerPresentation({ sessions: ['codex', 'codex2'], text: 'Fan out', cron: '0 * * * *' }, true).disabled, true);

  const ordinaryPaste = 'Review the copied notes\n\tKeep emoji 🧑‍💻 and normal punctuation.';
  assert.deepEqual(promptTextSafety(ordinaryPaste), { safe: true, issueCount: 0, cleanedText: ordinaryPaste });
  const suspiciousPaste = `Review\u202ethis\u200bnow\u2060please\u{e0061}`;
  assert.deepEqual(promptTextSafety(suspiciousPaste), {
    safe: false,
    issueCount: 4,
    cleanedText: 'Reviewthisnowplease'
  });
  const blockedPresentation = promptQueueComposerPresentation({ session: 'codex', text: suspiciousPaste, cron: '' }, true);
  assert.equal(blockedPresentation.disabled, true);
  assert.equal(blockedPresentation.sendDisabled, true);
  assert.equal(blockedPresentation.unsafeCharacterCount, 4);

  assert.deepEqual(normalizedPromptQueueDraft({ session: 'codex', text: 'hello', cron: ' 0 * * * * ' }), {
    session: 'codex', sessions: ['codex'], text: 'hello', cron: '0 * * * *'
  });
  assert.deepEqual(normalizedPromptQueueDraft({ session: 's'.repeat(140), text: 'x'.repeat(4010), cron: ` ${'c'.repeat(90)} ` }), {
    session: 's'.repeat(128), sessions: ['s'.repeat(128)], text: 'x'.repeat(4000), cron: 'c'.repeat(80)
  });
  assert.deepEqual(normalizedPromptQueueDraft({ sessions: ['codex', 'codex2', 'codex'], text: 'same' }), {
    session: 'codex', sessions: ['codex', 'codex2'], text: 'same', cron: ''
  });
  assert.deepEqual(normalizedPromptQueueDraft({ sessions: [null, 'codex'] }), {
    session: 'codex', sessions: ['codex'], text: '', cron: ''
  });
  assert.deepEqual(normalizedPromptQueueDraft(null), { session: '', sessions: [], text: '', cron: '' });
  assert.deepEqual(normalizedPromptQueueDraft('invalid'), { session: '', sessions: [], text: '', cron: '' });

  assert.equal(isPromptQueueSubmitShortcut({ key: 'Enter', ctrlKey: true }), true);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'ENTER', metaKey: true }), true);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'Enter', ctrlKey: true, isComposing: true }), false);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'Enter', ctrlKey: true, shiftKey: true }), false);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'Enter', metaKey: true, altKey: true }), false);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'Enter' }), false);
  assert.equal(isPromptQueueSubmitShortcut({ key: 'x', ctrlKey: true }), false);
  assert.equal(isPromptQueueSubmitShortcut(null), false);
});

test('Ticket Refiner preserves detailed prompts and guides rough requests without inventing content', () => {
  const rough = ticketRefinerReadiness('fix login');
  assert.equal(rough.ready, false);
  assert.deepEqual(rough.present, ['outcome']);
  assert.ok(rough.missing.includes('verification'));

  const detailedText = [
    'Outcome:',
    'Make login retry behavior reliable.',
    '',
    'Context:',
    'Intermittent retries currently lose the pending request.',
    '',
    'Scope:',
    'Change only retry state handling.',
    '',
    'Non-goals:',
    'Do not replace the authentication provider.',
    '',
    'Verification:',
    'Test success, timeout, cancellation, and duplicate completion.',
    '',
    'Safety and risks:',
    'Preserve stored credentials and fail closed.'
  ].join('\n');
  assert.equal(ticketRefinerReadiness(detailedText).ready, true);
  assert.deepEqual(ticketRefinerPreview({ originalText: detailedText }).text, detailedText);

  const guided = ticketRefinerPreview({
    originalText: 'fix login',
    fields: {
      outcome: 'Make login retry behavior reliable.',
      context: 'Intermittent retries lose the pending request.',
      scope: 'Change only retry state handling.',
      nonGoals: 'Do not replace the authentication provider.',
      verification: 'Test success, timeout, cancellation, and duplicate completion.',
      safety: 'Preserve stored credentials and fail closed.'
    }
  });
  assert.equal(guided.changed, true);
  assert.equal(guided.tooLong, false);
  assert.equal(guided.readiness.ready, true);
  assert.match(guided.text, /^Outcome:\nMake login retry behavior reliable\./);
  assert.match(guided.text, /\n\nNon-goals:\nDo not replace/);
  assert.match(guided.text, /\n\nSafety and risks:\nPreserve stored credentials/);
  assert.doesNotMatch(guided.text, /undefined|null|TBD/i);
});

test('Ticket Refiner target binding fails closed on changed or replaced exact panes', () => {
  const first = {
    session: 'codex-docs',
    sessionCreatedAt: '2026-08-09T10:00:00.000Z',
    paneId: 'codex-docs:0.0',
    tmuxPaneId: '%3',
    panePid: 1234
  };
  const second = {
    session: 'codex-client',
    sessionCreatedAt: '2026-08-09T10:01:00.000Z',
    paneId: 'codex-client:0.0',
    tmuxPaneId: '%4',
    panePid: 2345
  };
  const state = normalizedTicketRefinerState({
    open: true,
    originalText: 'fix login',
    targetBindings: [first, second],
    fields: { outcome: 'Fix login.' }
  });
  assert.equal(state.open, true);
  assert.deepEqual(ticketRefinerTargetMatch(state, [second, first]), { ok: true, error: '' });
  assert.deepEqual(ticketRefinerTargetMatch(state, [first]), { ok: false, error: 'target_count_changed' });
  assert.deepEqual(
    ticketRefinerTargetMatch(state, [first, { ...second, panePid: 9999 }]),
    { ok: false, error: 'target_replaced' }
  );
  assert.deepEqual(ticketRefinerTargetMatch(null, [first]), { ok: false, error: 'binding_missing' });
});

test('Prompt Queue mobile target picking replaces one recipient unless multi-select is explicit', async () => {
  assert.equal(promptQueueMultipleAllowed(false, false), true);
  assert.equal(promptQueueMultipleAllowed(true, false), false);
  assert.equal(promptQueueMultipleAllowed(true, true), true);
  assert.equal(promptQueueMultipleAllowed(false, true, true), false);
  assert.equal(promptQueueMultipleAllowed(true, true, true), false);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha'], 'codex-beta'), ['codex-beta']);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha', 'codex-beta'], 'codex-gamma'), ['codex-gamma']);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha'], 'codex-beta', true), ['codex-alpha', 'codex-beta']);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha', 'codex-beta'], 'codex-alpha', true), ['codex-beta']);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha'], 'codex-alpha', true), ['codex-alpha']);
  assert.deepEqual(promptQueueTargetSelection(['codex-alpha', 'codex-alpha', ''], ''), ['codex-alpha']);
  assert.deepEqual(
    promptQueueTargetSelection(Array.from({ length: 12 }, (_, index) => `codex-${index}`), 'codex-overflow', true),
    Array.from({ length: 12 }, (_, index) => `codex-${index}`)
  );

  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);
  assert.match(app, /class="prompt-target-mobile-select"/);
  assert.match(app, /Tap another agent to switch immediately/);
  assert.match(app, /data-action="prompt-queue-mobile-multi"/);
  assert.match(app, /const PHONE_LAYOUT_QUERY = '\(max-width: 759px\), \(max-width: 900px\) and \(max-height: 620px\) and \(pointer: coarse\)'/);
  assert.match(app, /const multiple = promptQueueMultipleAllowed\(isPhoneLayoutMode\(\), state\.promptQueueMultiSelect, forceSingle\)/);
  assert.match(app, /promptQueueTargetSelection\(selected, session, multiple\)/);
  assert.match(app, /selectPromptQueueTarget\(event\.target, \{ forceSingle: true, restoreCardFocus: false \}\)/);
  assert.match(styles, /\.prompt-target-mobile-picker:not\(\.hidden\) \{ display: grid; \}/);
  assert.match(styles, /\.prompt-target-desktop-actions \{ display: none; \}/);
});

test('paused recurring prompts can collapse as one persistent group without hiding active schedules', async () => {
  const active = { id: 'schedule-active', enabled: true };
  const pausedOne = { id: 'schedule-paused-1', enabled: false };
  const pausedTwo = { id: 'schedule-paused-2', enabled: false };
  assert.deepEqual(promptScheduleGroups([pausedOne, active, pausedTwo]), {
    active: [active],
    paused: [pausedOne, pausedTwo]
  });
  assert.deepEqual(promptScheduleGroups(null), { active: [], paused: [] });

  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);
  assert.match(app, /const PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY = 'host-control:prompt-paused-schedules-collapsed'/);
  assert.match(app, /const \{ active: activeSchedules, paused: pausedSchedules \} = promptScheduleGroups\(orderedSchedules\)/);
  assert.match(app, /state\.promptPausedSchedulesCollapsed = window\.localStorage\.getItem\(PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY\) === 'true'/);
  assert.match(app, /data-action="prompt-schedule-paused-toggle"[^>]*aria-expanded="\$\{pausedCollapsed \? 'false' : 'true'\}"[^>]*aria-controls="prompt-schedule-paused-list"/);
  assert.match(app, /id="prompt-schedule-paused-list"[^>]*\$\{pausedCollapsed \? ' hidden' : ''\}/);
  assert.match(app, /safeStorageSet\(\s*PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY,\s*state\.promptPausedSchedulesCollapsed \? 'true' : 'false'/);
  assert.match(app, /case 'prompt-schedule-paused-toggle':\s*togglePausedPromptSchedules\(\)/);
  assert.match(styles, /\.prompt-schedule-paused-grid\[hidden\] \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-schedule-paused-toggle \{ width: 100%; min-height: 44px; \}/);
});

test('Prompt Queue exposes Leave queue only before dispatch claims an item', () => {
  assert.deepEqual(promptQueueCancelPresentation({ status: 'queued' }), {
    kind: 'queued', label: 'Leave queue', tone: 'danger', confirmation: 'leave-queue'
  });
  assert.equal(promptQueueCancelPresentation({ status: 'needs_review' }), null);
  assert.equal(promptQueueCancelPresentation({ status: 'sent', summaryState: 'pending' }), null);
  assert.equal(promptQueueCancelPresentation({ status: 'sent', summaryState: 'captured' }), null);
  assert.equal(promptQueueCancelPresentation({ status: 'dispatching', summaryState: 'pending' }), null);
  assert.equal(promptQueueCancelPresentation(null), null);
});

test('Idea Queue links each lifecycle state to the ticket that currently owns it', () => {
  const source = { id: 'prompt-source', status: 'sent' };
  const refinement = { id: 'prompt-refinement', status: 'sent' };
  const implementation = { id: 'prompt-implementation', status: 'queued' };
  const items = [source, refinement, implementation];
  const links = {
    sourcePromptId: source.id,
    refinementPromptId: refinement.id,
    approvedPromptId: implementation.id
  };

  assert.equal(ideaQueueLinkedPrompt({ ...links, status: 'approved' }, items), implementation);
  assert.equal(ideaQueueLinkedPrompt({ ...links, status: 'refining' }, items), refinement);
  assert.equal(ideaQueueLinkedPrompt({ ...links, status: 'proposed' }, items), refinement);
  assert.equal(ideaQueueLinkedPrompt({ ...links, status: 'rejected' }, items), refinement);
  assert.equal(ideaQueueLinkedPrompt({ ...links, status: 'approved' }, [source, refinement]), null);
  assert.equal(ideaQueueLinkedPrompt({ ...links, refinementPromptId: 'prompt-pruned', status: 'proposed' }, [source]), source);
  assert.equal(ideaQueueLinkedPrompt(null, items), null);
  assert.equal(ideaQueueLinkedPrompt({ status: 'proposed' }, null), null);
});

test('Idea Queue sends agent-proposed work and refinements back to their live source project', () => {
  const available = ['codex', 'codex-docs'];
  assert.equal(ideaWorkTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs'
  }, available, 'codex'), 'codex-docs');
  assert.equal(ideaWorkTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs-idea-scout',
    workSession: 'codex-docs'
  }, available, 'codex'), 'codex-docs');
  assert.equal(ideaWorkTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs'
  }, ['codex'], 'codex'), '');
  assert.equal(ideaWorkTargetSession({ source: 'operator' }, available, 'codex'), 'codex');
  assert.equal(ideaRefinementTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs'
  }, available, 'codex'), 'codex-docs');
  assert.equal(ideaRefinementTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs-idea-scout',
    workSession: 'codex-docs'
  }, available, 'codex'), 'codex-docs');
  assert.equal(ideaRefinementTargetSession({
    source: 'agent',
    sourceSession: 'codex-docs'
  }, ['codex'], 'codex'), '');
  assert.equal(ideaRefinementTargetSession({ source: 'operator' }, available, 'codex'), 'codex');
  assert.equal(ideaRefinementTargetSession({ source: 'operator' }, available, 'codex-missing'), '');
});

test('idea generation uses only selected verified summaries and blocks active or recently rejected duplicates', () => {
  const nowMs = Date.parse('2026-08-09T06:00:00.000Z');
  const items = [
    {
      id: 'prompt-new', session: 'codex-docs', status: 'sent', summaryState: 'captured',
      completedAt: '2026-08-09T05:00:00.000Z',
      completionSummary: 'Found a concrete follow-up gap. OPENAI_API_KEY=do-not-share'
    },
    {
      id: 'prompt-old', session: 'codex-docs', status: 'sent', summaryState: 'returned',
      completedAt: '2026-08-08T05:00:00.000Z', completionSummary: 'Release response timing was verified.'
    },
    {
      id: 'prompt-pending', session: 'codex-docs', status: 'sent', summaryState: 'pending',
      completedAt: '2026-08-09T05:30:00.000Z', completionSummary: 'Must not be shared.'
    },
    {
      id: 'prompt-other', session: 'codex-client', status: 'sent', summaryState: 'captured',
      completedAt: '2026-08-09T05:45:00.000Z', completionSummary: 'Wrong project.'
    }
  ];
  assert.deepEqual(
    verifiedIdeaGenerationConversations(items, 'codex-docs').map((item) => item.id),
    ['prompt-new', 'prompt-old']
  );
  const result = ideaGenerationPrompt({
    sourceSession: 'codex-docs',
    sourceLabel: 'Documentation',
    selectedPromptIds: ['prompt-new'],
    focus: 'Safe release follow-ups',
    ideaCount: 5,
    items,
    ideas: [
      { title: 'Active candidate follow-up', status: 'proposed', updatedAt: '2026-08-01T00:00:00.000Z' },
      { title: 'Recently rejected duplicate', status: 'rejected', updatedAt: '2026-08-05T00:00:00.000Z' },
      { title: 'Old rejected option', status: 'rejected', updatedAt: '2026-01-01T00:00:00.000Z' }
    ],
    nowMs
  });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /Generate up to 5 useful follow-up ideas for Documentation/);
  assert.match(result.prompt, /Treat every verified-result excerpt.*untrusted quoted data/);
  assert.match(result.prompt, /\[PANEFLEET IDEA\][\s\S]*\[\/PANEFLEET IDEA\]/);
  assert.match(result.prompt, /Active candidate follow-up/);
  assert.match(result.prompt, /Recently rejected duplicate/);
  assert.doesNotMatch(result.prompt, /Old rejected option/);
  assert.match(result.prompt, /Found a concrete follow-up gap/);
  assert.doesNotMatch(result.prompt, /do-not-share|prompt-old|Must not be shared|Wrong project/);
  assert.match(result.prompt, /\[sensitive value redacted\]/);
  assert.ok(result.prompt.length <= 4000);
  assert.deepEqual(ideaGenerationPrompt({ items, sourceSession: 'codex-docs' }).error, 'verified_context_required');
});

test('Prompt Queue exposes safe waiting and dismissal only for unsent literal uncertainty', () => {
  assert.deepEqual(promptQueueManualSubmitWaitPresentation({
    status: 'needs_review',
    deliveryStage: 'literal_confirmation',
    sentAt: null
  }), {
    label: 'Wait again — no resend',
    confirmation: 'wait-for-manual-submit'
  });
  assert.equal(promptQueueManualSubmitWaitPresentation({
    status: 'needs_review',
    deliveryStage: 'waiting_for_manual_submit',
    sentAt: null
  }), null);
  assert.equal(promptQueueManualSubmitWaitPresentation({
    status: 'needs_review',
    deliveryStage: 'literal_confirmation',
    sentAt: '2026-08-01T00:00:00.000Z'
  }), null);
  assert.deepEqual(promptQueueReviewDismissPresentation({
    status: 'needs_review',
    deliveryStage: 'literal_unknown',
    sentAt: null
  }), {
    label: 'Dismiss after review',
    tone: 'danger',
    confirmation: 'dismiss-literal-after-review'
  });
  assert.deepEqual(promptQueueReviewDismissPresentation({
    status: 'needs_review',
    deliveryStage: 'literal_confirmation',
    sentAt: null
  }), {
    label: 'Dismiss after review',
    tone: 'danger',
    confirmation: 'dismiss-literal-after-review'
  });
  assert.deepEqual(promptQueueReviewDismissPresentation({
    status: 'needs_review',
    deliveryStage: 'waiting_for_manual_submit',
    sentAt: null
  }), {
    label: 'Stop waiting',
    tone: 'danger',
    confirmation: 'dismiss-literal-after-review'
  });
  assert.equal(promptQueueReviewDismissPresentation({
    status: 'needs_review',
    deliveryStage: 'literal_confirmation',
    sentAt: '2026-08-01T00:00:00.000Z'
  }), null);
  assert.equal(promptQueueReviewDismissPresentation({
    status: 'needs_review',
    deliveryStage: 'final_boundary_missing',
    sentAt: null
  }), null);
  assert.equal(promptQueueReviewDismissPresentation({
    status: 'queued',
    deliveryStage: '',
    sentAt: null
  }), null);
});

test('Prompt Queue offers a Proposed-only idea import for a dismissed manual generator result', () => {
  const item = {
    status: 'canceled',
    deliveryStage: 'literal_review_dismissed',
    sentAt: null,
    ideaProposalCount: null,
    ideaPurpose: null,
    text: 'Return only [PANEFLEET IDEA] blocks for review.'
  };
  assert.deepEqual(promptQueueManualIdeaImportPresentation(item), {
    label: 'Import visible ideas',
    confirmation: 'import-visible-ideas-after-review'
  });
  assert.equal(promptQueueManualIdeaImportPresentation({ ...item, ideaProposalCount: 1 }), null);
  assert.equal(promptQueueManualIdeaImportPresentation({ ...item, deliveryStage: 'canceled' }), null);
  assert.equal(promptQueueManualIdeaImportPresentation({ ...item, status: 'sent' }), null);
  assert.equal(promptQueueManualIdeaImportPresentation({ ...item, ideaPurpose: 'refinement' }), null);
  assert.equal(promptQueueManualIdeaImportPresentation({ ...item, text: 'No idea markers.' }), null);
});

test('Prompt Queue offers one explicit requeue only for a delivered terminal-replacement review', () => {
  const item = {
    status: 'needs_review',
    summaryState: 'unavailable',
    deliveryStage: 'completion_target_replaced',
    sentAt: '2026-08-06T15:20:48.263Z'
  };
  assert.deepEqual(promptQueueReplacementRequeuePresentation(item, true), {
    label: 'Requeue once',
    confirmation: 'requeue-on-replacement'
  });
  assert.equal(promptQueueReplacementRequeuePresentation(item, false), null);
  assert.equal(promptQueueReplacementRequeuePresentation({ ...item, sentAt: null }, true), null);
  assert.equal(promptQueueReplacementRequeuePresentation({ ...item, status: 'queued' }, true), null);
  assert.equal(promptQueueReplacementRequeuePresentation({ ...item, deliveryStage: 'completion_timeout' }, true), null);
});

test('Project Desk keeps stale content visible while automatically revalidating its bounded cache', async () => {
  const app = await uiSource('app.js');
  assert.match(app, /const PROJECT_CONTEXT_CACHE_MS = 5_000/);
  assert.match(app, /projectContextCacheFresh\(cached, Date\.now\(\), PROJECT_CONTEXT_CACHE_MS\)/);
  assert.match(app, /contextCache\.set\(target\.key, \{ context, fetchedAt: Date\.now\(\) \}\)/);
  assert.match(app, /const fallbackContext = cached\?\.context \|\| null/);
  assert.match(app, /state\.projectDesk\.context = fallbackContext/);
  assert.doesNotMatch(app, /contextCache\.delete\(nextTarget\.key\)/);
});

test('terminal layouts produce bounded 1, 2, and 4 pane slots', () => {
  assert.deepEqual(terminalLayoutSlots('free', 4, 1000, 700), []);
  assert.equal(terminalLayoutSlots('focus', 4, 1000, 700).length, 1);

  const split = terminalLayoutSlots('split', 4, 1000, 700, 10);
  assert.equal(split.length, 2);
  assert.deepEqual(split[0], { left: 0, top: 0, width: 495, height: 700 });
  assert.deepEqual(split[1], { left: 505, top: 0, width: 495, height: 700 });

  const grid = terminalLayoutSlots('grid', 8, 1000, 700, 10);
  assert.equal(grid.length, 4);
  assert.deepEqual(grid[3], { left: 505, top: 355, width: 495, height: 345 });

  assert.deepEqual(terminalLayoutSlots('unknown', 4, -1, 'invalid'), []);
  assert.deepEqual(terminalLayoutSlots('grid', 0, 1000, 700), []);
  assert.deepEqual(terminalLayoutSlots('focus', 1, undefined, undefined), [{
    left: 0,
    top: 0,
    width: 0,
    height: 0
  }]);
});

test('desktop terminal frames preserve shell context while phones retain the full screen', () => {
  const layer = { left: 0, top: 0, width: 1920, height: 1080 };
  const fallback = { left: 220, top: 82 };
  const stage = { left: 500, top: 112, right: 1400, bottom: 932, width: 900, height: 820 };

  assert.deepEqual(terminalWorkspaceFrame(layer, stage, fallback, true), {
    left: 500,
    top: 112,
    width: 1420,
    height: 968
  });
  assert.deepEqual(terminalWorkspaceFrame(layer, stage, fallback, true, true), {
    left: 500,
    top: 112,
    width: 900,
    height: 820
  });
  assert.deepEqual(terminalWorkspaceFrame(layer, { left: 0, top: 0, width: 0, height: 820 }, fallback, true), {
    left: 220,
    top: 82,
    width: 1700,
    height: 998
  });
  assert.deepEqual(terminalWorkspaceFrame(layer, { left: 0, top: 0, width: 900, height: 0 }, fallback, true), {
    left: 220,
    top: 82,
    width: 1700,
    height: 998
  });
  assert.deepEqual(terminalWorkspaceFrame(layer, { left: 0, top: 0, width: 0, height: 0 }, fallback, true, true), {
    left: 220,
    top: 82,
    width: 1700,
    height: 998
  });
  assert.deepEqual(terminalWorkspaceFrame({ left: 7, top: 9, width: 390, height: 844 }, { left: 80, top: 100, width: 200, height: 600 }, fallback, false), {
    left: 0,
    top: 0,
    width: 390,
    height: 844
  });
});

test('live UI keeps terminal controls and literal-send safety paths while adding terminal workflow features', async () => {
  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);

  assert.doesNotMatch(app, /if \(missionCapability\) switchView\('queue'\)/);
  assert.match(app, /switchView\('agents'\)/);
  assert.match(app, /data-action="terminal-minimize"/);
  assert.match(app, /data-action="terminal-maximize"/);
  assert.match(app, /data-action="terminal-close"/);
  assert.match(app, /data-terminal-resize="nw"/);
  assert.match(app, /class="terminal-send-text"/);
  assert.match(app, /data-command="\/model"/);
  assert.match(app, /aria-label="Persistent interactive picker navigation"/);
  assert.match(app, /data-action="terminal-ui-key" data-key="select"/);
  assert.match(app, /item\.pickerBar\.classList\.toggle\('hidden', !pickerAvailability\.visible\)/);
  assert.doesNotMatch(
    app,
    /async function sendTerminalUiKey[\s\S]{0,500}!item\.pickerActive/
  );
  assert.match(app, /sendAgentInputWithQueueConfirmation\('\/api\/agent\/send'/);
  assert.match(app, /sendAgentInputWithQueueConfirmation\('\/api\/agent\/send-batch'/);
  assert.match(app, /api\('\/api\/agent\/ui-key'/);
  assert.match(app, /api\('\/api\/prompt-queue\/batch'/);
  assert.match(app, /confirm: 'send-multiple'/);
  assert.match(app, /confirm: 'queue-multiple'/);
  assert.match(app, /data-action="prompt-queue-cancel"/);
  assert.match(app, /data-action="prompt-schedule-toggle"/);
  assert.match(app, /data-action="prompt-schedule-queue-now"/);
  assert.match(app, /data-action="prompt-schedule-delete"/);
  assert.match(app, /data-action="prompt-schedule-retarget"/);
  assert.match(app, /\/api\/prompt-schedules\/\$\{encodeURIComponent\(schedule\.id\)\}\/queue-now/);
  assert.match(app, /confirm: 'queue-schedule-now'/);
  assert.match(app, /One occurrence is already open for this schedule/);
  assert.match(app, /The cron and paused state are unchanged\./);
  assert.match(app, /Retarget required/);
  assert.match(app, /Retarget this schedule before resuming it/);
  assert.match(app, /data-action="prompt-queue-retarget"/);
  assert.match(app, /confirm: 'retarget-schedule'/);
  assert.match(app, /confirm: 'retarget-queued-prompt'/);
  assert.match(app, /Nothing was sent during recovery/);
  assert.match(app, /const exactTerminalAvailable = item\.target\?\.identityMatches === true/);
  assert.match(app, /exactTerminalAvailable[\s\S]*Open exact terminal[\s\S]*retargetable[\s\S]*Open replacement[\s\S]*Exact terminal unavailable/);
  assert.doesNotMatch(app, /const openPaneId = replacement\?\.id \|\| item\.paneId/);
  assert.match(app, /name="cron"[^>]*list="prompt-cron-presets"/);
  assert.match(app, /0 9 \* \* 1-5/);
  assert.match(app, /Recurring prompts/);
  assert.match(app, /coalesces that occurrence/);
  assert.match(app, /function promptScheduleDisplayOrder\(left, right\)/);
  assert.match(app, /const enabledDelta = Number\(right\.enabled\) - Number\(left\.enabled\)/);
  assert.match(app, /const orderedSchedules = \[\.\.\.schedules\]\.sort\(promptScheduleDisplayOrder\)/);
  assert.match(app, /activeSchedules\.map\(\(schedule\) => promptScheduleCard\(schedule, items\)\)/);
  assert.match(app, /pausedSchedules\.map\(\(schedule\) => promptScheduleCard\(schedule, items\)\)/);
  assert.match(app, /function promptScheduleAbsoluteLabel\(value\)/);
  assert.match(app, /timeZoneName: 'short'/);
  assert.match(app, /prompt_schedule_has_no_run: 'That calendar combination can never run\.'/);
  assert.match(app, /prompt_schedule_duplicate: 'An identical recurring schedule already exists\. Review or resume that schedule instead\.'/);
  assert.match(app, /skipped_text_too_long: 'Prompt exceeds safe limit'/);
  assert.match(app, /const nextRunTitle = promptScheduleAbsoluteLabel\(schedule\.nextRunAt\)/);
  assert.match(app, /<b>Occurrences<\/b>/);
  assert.match(app, /<b>Coalesced<\/b>/);
  assert.match(app, /One occurrence is already in the queue/);
  assert.match(styles, /\.prompt-schedule-pending\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-schedule-actions \.action-button \{ min-height: 44px; \}/);
  assert.match(app, /class="prompt-target-board"/);
  assert.match(app, /data-action="prompt-queue-select-target"/);
  assert.match(app, /data-action="prompt-queue-select-all"/);
  assert.match(app, /Queue delivery still uses each terminal's independent readiness gate/);
  assert.match(app, /waitingQueueCount/);
  assert.match(app, /finishingCount/);
  assert.match(app, /<\/strong> waiting<\/span>/);
  assert.match(app, /<\/strong> finishing<\/span>/);
  assert.match(app, /class="prompt-queue-stats"/);
  assert.match(app, /const waitingNow = items\.filter\(\(item\) => item\.status === 'queued'\)\.length/);
  assert.match(app, /const finishingNow = items\.filter\(promptQueueAwaitingFinish\)\.length/);
  assert.match(app, /digestMetric\('Waiting now', waitingNow/);
  assert.match(app, /digestMetric\('Finishing now', finishingNow/);
  assert.doesNotMatch(app, /digestMetric\('Ready terminals'/);
  assert.match(app, /Finished queue turns/);
  assert.match(app, /never claims the underlying project task is Done/);
  const promptQueueFinishedStart = app.indexOf('function promptQueueFinished(item)');
  const promptQueueFinishedEnd = app.indexOf('function promptQueueTerminalBoard', promptQueueFinishedStart);
  const promptQueueFinishedSource = app.slice(promptQueueFinishedStart, promptQueueFinishedEnd);
  assert.ok(promptQueueFinishedStart >= 0 && promptQueueFinishedEnd > promptQueueFinishedStart);
  assert.doesNotMatch(promptQueueFinishedSource, /command_submitted/);
  assert.match(app, /const historyStateLabel = !delivered[\s\S]*\? 'Delivered'/);
  assert.match(app, /const visibleFinished = finished\.slice\(0, 12\)/);
  assert.match(app, /const olderFinished = finished\.slice\(12\)/);
  assert.match(app, /class="prompt-canceled-history" data-queue-detail="older"/);
  assert.match(app, /older finished turn/);
  assert.match(app, /Accepted turns/);
  assert.match(app, /Blue · agent working/);
  assert.match(app, /Green · verifying return/);
  assert.match(app, /promptQueueAwaitingFinish/);
  assert.match(app, /delivered without a confirmed final response/);
  assert.match(app, /item\.completionSnapshot/);
  assert.match(app, /item\.completionSummary/);
  const promptQueueRenderStart = app.indexOf('function renderPromptQueue(promptQueue, agents)');
  const promptQueueRenderEnd = app.indexOf('function renderMissionQueue', promptQueueRenderStart);
  const promptQueueRenderSource = app.slice(promptQueueRenderStart, promptQueueRenderEnd);
  assert.ok(promptQueueRenderStart >= 0 && promptQueueRenderEnd > promptQueueRenderStart);
  assert.match(promptQueueRenderSource, /const activeQueueSection =/);
  assert.match(promptQueueRenderSource, /\$\{activeLanes\.length \? activeQueueSection : ''\}[\s\S]*class="mission-hero prompt-queue-hero"/);
  assert.match(promptQueueRenderSource, /promptSchedulePanel\(schedules, items\)[\s\S]*\$\{activeLanes\.length \? '' : activeQueueSection\}/);
  assert.match(app, /if \(!\['agents', 'queue'\]\.includes\(view\)\) return/);
  assert.doesNotMatch(app, /setOpenDrawer\('queue'/);
  assert.match(app, /Queue creates one independent FIFO item per terminal/);
  assert.match(app, /agent\.queueReady === true/);
  assert.match(app, /persistTerminalDraft/);
  assert.match(app, /navigateTerminalHistory/);
  assert.match(app, /previewTerminalPaste/);
  assert.match(app, /terminalWorkspace\.classList\.toggle\('has-open-terminals', count > 0\)/);
  assert.match(app, /syncProjectDesk\(\)/);
  assert.match(app, /function launcherWorkspaceForProject\(requestedWorkspace\)/);
  assert.match(app, /function nextAgentNameForWorkspace\(workspace\)/);
  assert.match(app, /case 'project-new-agent':[\s\S]*projectContextWorkspace\(state\.projectDesk\.context, state\.projectDesk\.target\)/);
  assert.match(app, /\/api\/project-desk\/\$\{encodeURIComponent\(target\.session\)\}/);
  assert.match(app, /\/artifacts\/\$\{encodeURIComponent\(artifact\.id\)\}/);
  assert.match(app, /class="project-artifact-row"/);
  assert.match(app, /data-action="project-artifact-download"/);
  assert.match(app, /function projectArtifactPreviewUrl\(artifact, target, previewAvailable\)/);
  assert.match(app, /class="action-button project-artifact-preview"/);
  assert.match(app, /\/preview\$\{url\.slice\(separator\)\}/);
  assert.match(app, /target="_blank" rel="noopener noreferrer">Preview<\/a>/);
  assert.match(app, /data-artifact-url="\$\{escapeHtml\(url\)\}"/);
  assert.match(app, /data-artifact-name="\$\{escapeHtml\(artifact\.name\)\}"/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.projectArtifacts === true/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.projectArtifactPreviews === true/);
  assert.match(app, /function projectArtifactTimestamp\(value\)/);
  assert.match(app, /modified \? `Modified \$\{modified\}` : ''/);
  assert.match(app, /async function projectArtifactDownload\(button\)/);
  assert.match(app, /response\.headers\.get\('content-type'\)/);
  assert.match(app, /PROJECT_ARTIFACT_CONTENT_TYPES\.has\(contentType\)/);
  assert.match(app, /markdown: '\.md'/);
  assert.match(app, /html: '\.html'/);
  assert.match(app, /URL\.createObjectURL\(blob\)/);
  assert.match(app, /URL\.revokeObjectURL\(objectUrl\)/);
  const artifactDownloadStart = app.indexOf('async function projectArtifactDownload(button)');
  const artifactDownloadEnd = app.indexOf('function renderProjectMission', artifactDownloadStart);
  const artifactDownloadSource = app.slice(artifactDownloadStart, artifactDownloadEnd);
  assert.ok(artifactDownloadStart >= 0 && artifactDownloadEnd > artifactDownloadStart);
  assert.match(artifactDownloadSource, /data\.error === 'control_session_required' && attempt === 0/);
  assert.match(artifactDownloadSource, /await refreshControlSession\(controller\.signal\)/);
  assert.match(artifactDownloadSource, /credentials: 'same-origin'/);
  assert.match(artifactDownloadSource, /headers: \{ accept: 'application\/pdf, text\/markdown, text\/html' \}/);
  assert.doesNotMatch(app, /file:\/\//);
  assert.match(app, /scratchpadDraftKey/);
  assert.match(app, /SCRATCHPAD_SNIPPETS_KEY/);
  assert.match(app, /sameExactTarget/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.projectDesk === true/);
  assert.match(app, /restart PaneFleet to enable exact-target Review and Send/);
  assert.match(app, /const identity = normalizedExactPaneIdentity\(target\)/);
  assert.match(app, /sessionCreatedAt: identity\.sessionCreatedAt/);
  assert.match(app, /paneId: identity\.paneId/);
  assert.match(app, /tmuxPaneId: identity\.tmuxPaneId/);
  assert.match(app, /panePid: identity\.panePid/);
  assert.match(app, /const identityQuery = exactPaneIdentityQuery\(target\)/);
  assert.match(app, /case 'terminal-layout'/);
  assert.match(app, /case 'workspace-focus-toggle'/);
  assert.match(app, /shortcut === 'workspace-focus'/);
  assert.match(app, /classList\.toggle\('is-canvas-focused', workspaceFocusApplies\(state\.workspaceFocus, state\.activeView\)\)/);
  assert.match(app, /state\.activeView = view;\s*syncWorkspaceFocus\(\);/);
  assert.match(app, /safeStorageSet\(WORKSPACE_FOCUS_STORAGE_KEY, state\.workspaceFocus \? 'true' : 'false'\)/);
  assert.match(styles, /\.app-shell\.is-canvas-focused \.terminal-home\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.session-list\s*\{[\s\S]*max-height: min\(46dvh, 420px\)/);
  assert.match(app, /case 'terminal-full-height'/);
  assert.match(app, /function setTerminalFullHeight/);
  assert.match(app, /terminalFullHeightBounds/);
  assert.match(app, /terminalWorkspaceFrame/);
  assert.match(app, /window\.matchMedia\(TERMINAL_ULTRAWIDE_QUERY\)\.matches/);
  assert.match(app, /dashboardShortcut\(event, editableTarget\)/);
  assert.match(app, /case 'terminal-cycle-active':[\s\S]*cycleActiveTerminal\(Number\(target\.dataset\.direction\)\)/);
  assert.match(app, /shortcut === 'terminal-previous' \|\| shortcut === 'terminal-next'/);
  assert.match(app, /button\.disabled = switchableItems\.length < 2/);
  assert.match(app, /openToolView\(state\.activeToolView\)/);
  assert.match(app, /if \(next === 'tools'\)[\s\S]*openToolView\(state\.activeToolView\)/);
  assert.match(app, /preferredDashboardView\(window\.location\.hash, safeStorageGet\(ACTIVE_VIEW_STORAGE_KEY, 'agents'\)\)/);
  assert.match(app, /safeStorageSet\(ACTIVE_VIEW_STORAGE_KEY, view\)/);
  assert.match(app, /window\.history\.replaceState\(null, '', nextHash\)/);
  assert.match(app, /window\.addEventListener\('hashchange'/);
  assert.match(app, /els\.workspaceTitle\.textContent = queueActive \? 'Prompt Queue' : 'Agent workspace'/);
  assert.match(app, /const presentation = connectionStatePresentation\(value\)/);
  assert.match(app, /els\.connectionPill\.setAttribute\('aria-label', presentation\.description\)/);
  assert.match(app, /runtimeVersionPresentation\(runtimeVersion, DASHBOARD_PROTOCOL_VERSION\)/);
  assert.match(app, /function dashboardRestartActionAvailable\(snapshot = state\.snapshot\)/);
  assert.match(app, /dashboard\?\.actions\?\.some\(\(action\) => action\.id === 'restart-dashboard'\) === true/);
  assert.match(app, /syncRuntimeVersion\(data\.runtimeVersion\)/);
  assert.match(app, /els\.runtimeDrift\.classList\.toggle\('hidden', !presentation\.restartRequired\)/);
  assert.match(app, /async function restartDashboardFromMismatch\(\)/);
  assert.match(app, /api\('\/api\/service\/agent-orchestrator\/action\/restart-dashboard'/);
  assert.match(app, /JSON\.stringify\(\{ confirm: 'restart-dashboard' \}\)/);
  assert.match(app, /async function waitForCurrentDashboardRuntime\(timeoutMs = 45_000\)/);
  assert.match(app, /runtimeVersionPresentation\(snapshot\.runtimeVersion, DASHBOARD_PROTOCOL_VERSION\)/);
  assert.match(app, /window\.location\.reload\(\)/);
  assert.match(app, /case 'runtime-restart':/);
  assert.match(styles, /\.runtime-drift-copy\s*\{[\s\S]*display: flex/);
  assert.match(styles, /\.runtime-drift > button\s*\{[\s\S]*flex: 0 0 auto/);
  assert.match(app, /els\.refresh\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(app, /function dismissNotice\(\)/);
  assert.match(app, /els\.noticeMessage\.textContent = message/);
  assert.match(app, /noticeAutoDismissMs\(kind\)/);
  assert.match(app, /revision === noticeRevision/);
  assert.match(app, /case 'notice-dismiss':/);
  assert.match(app, /function openShortcutHelp\(trigger = document\.activeElement\)/);
  assert.match(app, /function closeShortcutHelp/);
  assert.match(app, /function handleShortcutHelpKeydown/);
  assert.match(app, /case 'shortcut-help-open':/);
  assert.match(app, /case 'shortcut-help-close':/);
  assert.match(app, /if \(handleShortcutHelpKeydown\(event\)\) return/);
  assert.match(app, /shortcut === 'shortcuts'/);
  assert.match(app, /function syncDecisionAppBadge\(decisionCount\)/);
  assert.match(app, /globalThis\.navigator\?\.setAppBadge\?\.\(count\)/);
  assert.match(app, /globalThis\.navigator\?\.clearAppBadge\?\.\(\)/);
  assert.match(app, /document\.title = dashboardDocumentTitle\(\{/);
  assert.match(app, /connection: els\.liveState\?\.dataset\.state \|\| 'init'/);
  assert.match(app, /const TERMINAL_RESTORE_STORAGE_KEY = 'host-control:open-terminals:v1'/);
  assert.match(app, /function persistTerminalWorkspace\(\)/);
  assert.match(app, /function restoreTerminalWorkspace\(\)/);
  assert.match(app, /candidate\.session === record\.session[\s\S]*candidate\.sessionCreatedAt[\s\S]*candidate\.id/);
  assert.match(app, /refreshPaused: record\.refreshPaused,[\s\S]*restoredFreeBounds: record\.freeBounds/);
  assert.match(app, /if \(!item\.refreshPaused\) refreshTerminalWindow\(item\)/);
  assert.match(app, /terminalCaptureFailureTransition\(/);
  assert.match(app, /item\.captureUnavailable = transition\.unavailable/);
  assert.match(app, /capture stopped after three failed checks/i);
  assert.match(app, /class="terminal-resume-panel hidden"/);
  assert.match(app, /data-action="terminal-resume-agent"[^>]*>Restart Codex/);
  assert.match(app, /terminalAgentResumePresentation\(item, currentAgent\(item\.session\)\)/);
  assert.match(app, /case 'terminal-resume-agent':/);
  assert.match(app, /normalizedExactPaneIdentity\(\{ \.\.\.agent, paneId: agent\?\.id \}\)/);
  assert.match(app, /JSON\.stringify\(\{ \.\.\.identity, model, reasoning \}\)/);
  assert.match(styles, /\.terminal-resume-panel\s*\{[\s\S]*grid-area: send/);
  assert.match(app, /sendAgentInputWithQueueConfirmation/);
  assert.match(app, /active queue ticket/);
  assert.match(app, /allowAnswerContinuation/);
  assert.match(app, /resolution: 'answer-current-turn'/);
  assert.match(app, /waiting for input during an accepted queue turn/);
  assert.match(app, /PaneFleet is monitoring the same accepted turn/);
  assert.match(app, /could not link its queue record[\s\S]*do not resend/);
  assert.match(app, /const applyRestoredFreeBounds = \(\) =>/);
  assert.match(app, /captureTerminalFreeBounds\(item\);[\s\S]*persistTerminalWorkspace\(\);/);
  assert.match(app, /guardedDashboardRender\('Terminal restore', \(\) => restoreTerminalWorkspace\(\)\);[\s\S]*guardedDashboardRender\('Terminal workspace', \(\) => syncOpenTerminalWindows/);
  assert.match(app, /persistTerminalWorkspace\(\);/);
  assert.match(app, /class="terminal-mobile-switcher hidden"[^>]*aria-label="Switch open terminal"/);
  assert.match(app, /class="terminal-mobile-select" aria-label="Choose open terminal"/);
  assert.match(app, /data-action="terminal-cycle-prev"/);
  assert.match(app, /data-action="terminal-cycle-next"/);
  assert.match(app, /const nextIndex = cycledItemIndex\(items\.indexOf\(item\), items\.length, direction\)/);
  assert.match(app, /switchableItems\.length > 1 && position >= 0/);
  assert.match(app, /const switcherLabel = terminalSwitcherLabel\(position, switchableItems\.length, displayName, signal\.label\)/);
  assert.match(app, /function terminalSelectorOptions\(items\)/);
  assert.match(app, /function syncTerminalSelector\(select, items, selectedId = ''\)/);
  assert.match(app, /item\.mobileSwitcher\.setAttribute\('aria-label', `Switch open terminal\. Current: \$\{switcherLabel\}\. Choose a named terminal or use previous and next\.`\)/);
  assert.match(app, /event\.target === els\.terminalJumpSelect \|\| event\.target\?\.classList\?\.contains\('terminal-mobile-select'\)/);
  assert.match(app, /activateTerminalWindow\(state\.terminalWindows\.get\(event\.target\.value\)\)/);
  assert.match(app, /role="tab" aria-selected="\$\{active \? 'true' : 'false'\}"[^>]*aria-controls="\$\{escapeHtml\(item\.id\)\}"[^>]*aria-keyshortcuts="ArrowLeft ArrowRight Home End"/);
  assert.match(app, /class="terminal-tab-copy"><strong>\$\{escapeHtml\(displayName\)\}<\/strong><span class="terminal-tab-status \$\{escapeHtml\(signal\.tone\)\}">/);
  assert.match(app, /const focusLabel = `\$\{active \? 'Current' : 'Focus'\} \$\{displayName\} terminal\. \$\{signal\.label\}\.`/);
  assert.match(app, /function terminalSignal\(item\)/);
  assert.match(app, /function syncTerminalHeaderStatus\(item\)/);
  assert.match(app, /item\.headerStatus\.setAttribute\('aria-label', `Agent state: \$\{signal\.label\}\. \$\{signal\.description\}`\)/);
  assert.match(app, /class="terminal-heading-row"><h2 id="\$\{id\}-title" class="terminal-title"><\/h2><span class="terminal-header-status neutral"/);
  assert.match(app, /headerStatus: element\.querySelector\('\.terminal-header-status'\)/);
  assert.match(app, /item\.element\.classList\.toggle\('is-active',[\s\S]*syncTerminalHeaderStatus\(item\)/);
  assert.match(app, /function handleTerminalTabKeydown\(event\)/);
  assert.match(app, /terminalTabKeyIndex\(event\.key, currentIndex, buttons\.length\)/);
  assert.match(app, /if \(handleTerminalTabKeydown\(event\)\) return/);
  assert.match(app, /element\.id = id/);
  assert.match(app, /const previousScrollLeft = els\.terminalTabs\.scrollLeft/);
  assert.match(app, /els\.terminalTabs\.scrollLeft = previousScrollLeft;[\s\S]*if \(!activeChanged\)/);
  assert.match(app, /horizontalRevealScrollLeft\(stripRect\.width, currentScrollLeft, itemStart, itemEnd\)/);
  assert.match(app, /closeIdleButton\.disabled = !count/);
  assert.match(app, /data-session-filter="\$\{escapeHtml\(filterCategory\)\}"/);
  assert.match(app, /sessionFilterMatches\(state\.sessionFilter, item\.dataset\.sessionFilter, item\.dataset\.sessionSearch, normalized\)/);
  assert.match(app, /safeStorageSet\(SESSION_FILTER_STORAGE_KEY, next\)/);
  assert.match(app, /case 'session-filter':/);
  assert.match(app, /sessionPinPresentation\(pinned, displayName\)/);
  assert.match(app, /sessionStatusPresentation\(status, attention\.length\)/);
  assert.match(app, /class="session-signal \$\{escapeHtml\(signal\.tone\)\}"/);
  assert.match(app, /aria-label="Open \$\{escapeHtml\(displayName\)\} terminal\. \$\{escapeHtml\(signal\.label\)\}/);
  assert.match(app, /class="session-task" title="\$\{escapeHtml\(taskPreview\)\}"/);
  assert.match(app, /class="session-item[^"`]*\$\{pinned \? 'is-pinned' : ''\}/);
  assert.match(app, /<span aria-hidden="true">\$\{pin\.symbol\}<\/span>/);
  assert.match(app, /function togglePinnedSession\(session, source = null\)/);
  assert.match(app, /nextButton\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /pinned to the top/);
  assert.match(app, /class="session-no-results" data-action="session-filters-reset"/);
  assert.match(app, /const countPresentation = sessionResultCountPresentation\(visible, items\.length, Boolean\(normalized\) \|\| filtered\)/);
  assert.match(app, /function resetSessionFilters\(\)/);
  assert.match(app, /case 'session-filters-reset':/);
  assert.match(app, /function visibleSessionItems\(\)/);
  assert.match(app, /filter\(\(item\) => !item\.hidden\)/);
  assert.match(app, /function handleSessionSearchKeydown\(event\)/);
  assert.match(app, /sessionSearchKeyAction\(event, items\.length, els\.sessionSearch\.value\)/);
  assert.match(app, /items\[0\]\?\.querySelector\('\.session-open'\)\?\.click\(\)/);
  assert.match(app, /function handleSessionResultKeydown\(event\)/);
  assert.match(app, /cycledItemIndex\(currentIndex, items\.length, event\.key === 'ArrowUp' \? -1 : 1\)/);
  assert.match(app, /scrollToBottomOnNextOutput: true/);
  assert.match(app, /existing\.scrollToBottomOnNextOutput = true/);
  assert.match(app, /shouldStickTerminalOutput\(item, isTerminalAtBottom\(item\), Date\.now\(\)\)/);
  assert.match(app, /item\.scrollToBottomOnNextOutput = false/);
  assert.match(app, /class="terminal-jump-latest hidden" data-action="terminal-jump-latest"/);
  assert.match(app, /function syncTerminalLatestControl/);
  assert.match(app, /newOutput: changed && !shouldStickToBottom/);
  assert.match(app, /case 'terminal-jump-latest':/);
  assert.match(app, /classList\.toggle\('is-active', !item\.minimized && item\.id === state\.activeTerminalId\)/);
  assert.match(app, /function terminalFocusTarget\(item\)/);
  assert.match(app, /!item\.sendForm\.classList\.contains\('hidden'\) && !item\.composerCollapsed/);
  assert.match(app, /terminalFocusKind\(isDesktopTerminalMode\(\), editorAvailable\)/);
  assert.match(app, /data-action="terminal-composer-toggle"[^>]*aria-expanded="true"[^>]*aria-controls="\$\{id\}-composer-body"/);
  assert.match(app, /composerCollapsed: !isDesktopTerminalMode\(\)/);
  assert.match(app, /const collapseChrome = terminalChromeCollapseAfterLayoutChange\(previousTerminalDesktopMode, desktopMode\)/);
  assert.match(app, /if \(collapseChrome !== null\) \{[\s\S]*item\.toolsCollapsed = collapseChrome;[\s\S]*item\.composerCollapsed = collapseChrome;/);
  assert.match(app, /const viewportHeight = window\.visualViewport\?\.height \?\? window\.innerHeight;/);
  assert.match(app, /terminalComposerTextareaHeight\(viewportHeight, item\.sendText\.scrollHeight, isPhoneLayoutMode\(\)\)/);
  assert.match(app, /function scheduleTerminalViewportResize\(\)[\s\S]*if \(terminalViewportResizeFrame\) return;[\s\S]*window\.requestAnimationFrame/);
  assert.match(app, /window\.addEventListener\('resize', scheduleTerminalViewportResize\);/);
  assert.match(app, /window\.visualViewport\?\.addEventListener\('resize', scheduleTerminalViewportResize\);/);
  assert.match(app, /function setTerminalComposerCollapsed\(item, collapsed/);
  assert.match(app, /terminalComposerPresentation\(collapsed, hasDraft, draftSaved\)/);
  assert.match(app, /terminalDraftPresentation\(item\.sendText\.value, Boolean\(item\.pendingPaste\), Boolean\(item\.sendInFlight\), item\.draftStorageAvailable !== false\)/);
  assert.match(app, /class="terminal-composer-label"><label for="\$\{id\}-send-text">Reply to terminal<\/label><span class="terminal-draft-state neutral" role="status">No draft<\/span><\/div>/);
  assert.match(app, /item\.draftStorageAvailable = safeStorageSet\(terminalDraftKey\(item\.session\), item\.sendText\.value\)/);
  assert.match(app, /draftStorageAvailable: true/);
  assert.match(app, /case 'terminal-composer-toggle':/);
  assert.match(app, /class="terminal-control terminal-tools-toggle hidden"[^>]*data-action="terminal-tools-toggle"[^>]*aria-controls="\$\{id\}-commands"/);
  assert.match(app, /toolsCollapsed: !isDesktopTerminalMode\(\)/);
  assert.match(app, /function syncTerminalTools\(item, commandsAvailable/);
  assert.match(app, /case 'terminal-tools-toggle':/);
  assert.match(app, /class="terminal-text-size-controls"[^>]*aria-label="Terminal text size"/);
  assert.match(app, /data-action="terminal-font-scale" data-delta="-\$\{TERMINAL_FONT_SCALE_STEP\}"/);
  assert.match(app, /const TERMINAL_FONT_SCALE_STORAGE_KEY = 'host-control:terminal-font-scale'/);
  assert.match(app, /function syncTerminalFontScale\(\)/);
  assert.match(app, /document\.documentElement\.style\.setProperty\('--terminal-font-size'/);
  assert.match(app, /case 'terminal-font-scale':/);
  assert.match(app, /class="terminal-wrap-control" data-action="terminal-wrap-toggle"[^>]*aria-pressed="true"/);
  assert.match(app, /const TERMINAL_WRAP_STORAGE_KEY = 'host-control:terminal-wrap'/);
  assert.match(app, /function syncTerminalWrap\(\)/);
  assert.match(app, /document\.documentElement\.classList\.toggle\('is-terminal-nowrap'/);
  assert.match(app, /case 'terminal-wrap-toggle':/);
  assert.match(app, /class="terminal-copy-output" data-action="terminal-copy-output"/);
  assert.match(app, /async function copyTextToClipboard\(value\)/);
  assert.match(app, /navigator\.clipboard\?\.writeText/);
  assert.match(app, /document\.execCommand\?\.\('copy'\)/);
  assert.match(app, /async function copyTerminalOutput\(item, button\)/);
  assert.match(app, /case 'terminal-copy-output':/);
  assert.match(app, /class="terminal-find-toggle" data-action="terminal-find-toggle"[^>]*aria-controls="\$\{id\}-find"/);
  assert.match(app, /aria-keyshortcuts="Control\+F Meta\+F" title="Find text in terminal output/);
  assert.match(app, /class="terminal-find-bar hidden" role="search"/);
  assert.match(app, /class="terminal-find-input" type="search"/);
  assert.match(app, /function renderTerminalFindHighlights\(item/);
  assert.match(app, /terminalFindOffsets\(content, query\)/);
  assert.match(app, /function setTerminalFindOpen\(item, open\)/);
  assert.match(app, /function stepTerminalFind\(item, direction\)/);
  assert.match(app, /case 'terminal-find-toggle':/);
  assert.match(app, /isTerminalFindShortcut\(event, editableTarget\)/);
  assert.match(app, /event\.target\?\.classList\?\.contains\('terminal-find-bar'\)/);
  assert.match(app, /event\.target\?\.classList\?\.contains\('terminal-find-input'\)/);
  assert.match(app, /class="terminal-refresh-toggle" data-action="terminal-refresh-toggle"[^>]*aria-pressed="false"/);
  assert.match(app, /class="terminal-tool-group terminal-reading-tools"[^>]*aria-label="Reading tools"/);
  assert.match(app, /class="terminal-tool-group terminal-agent-tools"[^>]*aria-label="Agent commands"/);
  assert.match(app, /class="terminal-tool-group terminal-recovery-tools"[^>]*aria-label="Session recovery"/);
  assert.match(app, /class="terminal-interrupt-control" data-action="session-interrupt"[^>]*>Send Ctrl-C<\/button>/);
  assert.match(app, /class="terminal-stop-control" data-action="session-stop"[^>]*>Stop session<\/button>/);
  assert.match(app, /agentTools: element\.querySelector\('\.terminal-agent-tools'\)/);
  assert.match(app, /recoveryTools: element\.querySelector\('\.terminal-recovery-tools'\)/);
  assert.match(app, /item\.agentTools\.classList\.toggle\('hidden', !commandsAvailable\)/);
  assert.match(app, /item\.recoveryTools\.classList\.toggle\('hidden', item\.mode === 'static' \|\| !item\.session\)/);
  assert.match(app, /RECOVERY ONLY: stop tmux session \$\{session\}\?\\n\\nThis ends the agent or process in that session and cannot be undone\./);
  assert.match(app, /class="terminal-capture-paused hidden" role="status">Capture paused/);
  assert.match(app, /refreshPaused: Boolean\(refreshPaused\)/);
  assert.match(app, /function syncTerminalRefreshState\(item\)/);
  assert.match(app, /function setTerminalRefreshPaused\(item, paused\)/);
  assert.match(app, /case 'terminal-refresh-toggle':/);
  assert.match(app, /class="terminal-text-size-value" data-action="terminal-font-reset"[^>]*disabled>100%/);
  assert.match(app, /function resetTerminalFontScale\(\)/);
  assert.match(app, /case 'terminal-font-reset':/);
  assert.match(app, /item\.mode === 'static' \|\| item\.minimized \|\| item\.refreshPaused \|\| item\.captureUnavailable/);
  assert.match(app, /item\.minimized \|\| item\.refreshPaused \|\| item\.captureUnavailable \|\| document\.hidden/);
  assert.match(app, /data-action="new-agent-cancel" type="button">Cancel<\/button>/);
  assert.match(app, /type="submit" aria-describedby="new-agent-launcher-safety new-agent-launcher-shortcut">Start Agent<\/button>/);
  assert.match(app, /function closeNewAgentLauncher\(launcher = document\.querySelector\('\.new-agent-panel\[open\]'\), focus = true\)/);
  assert.match(app, /function handleNewAgentLauncherKeydown\(event, launcher\)/);
  assert.match(app, /form\?\.contains\(event\.target\) && isNewAgentSubmitShortcut\(event\)/);
  assert.match(app, /form\.requestSubmit\(\)/);
  assert.match(app, /modalFocusIndex\(event, focusable\.indexOf\(document\.activeElement\), focusable\.length\)/);
  assert.match(app, /case 'new-agent-cancel':/);
  assert.match(app, /event\.target\.setAttribute\('role', 'dialog'\)/);
  assert.match(app, /const openLauncher = document\.querySelector\('\.new-agent-panel\[open\]'\)/);
  assert.match(app, /openLauncher && handleNewAgentLauncherKeydown\(event, openLauncher\)/);
  assert.match(app, /class="prompt-history-filter-bar"[^>]*aria-label="Filter finished prompts by origin"/);
  assert.match(app, /data-action="prompt-history-origin" data-origin="mine"/);
  assert.match(app, /data-action="prompt-history-origin" data-origin="automated"/);
  assert.match(app, /safeStorageSet\(PROMPT_HISTORY_ORIGIN_STORAGE_KEY, next\)/);
  assert.match(app, /case 'prompt-history-origin':/);
  assert.match(app, /id="prompt-history-search-form" class="prompt-history-search-form" role="search"/);
  assert.match(app, /id="prompt-history-search" name="query" type="search" maxlength="200"[^>]*enterkeyhint="search"/);
  assert.match(app, /data-action="prompt-history-search-clear"/);
  assert.match(app, /filterPromptHistory\(allFinished, state\.promptHistoryOriginFilter, state\.promptHistoryQuery\)/);
  assert.match(app, /function setPromptHistoryQuery\(value\)/);
  assert.match(app, /event\.target\?\.id === 'prompt-history-search-form'/);
  assert.match(app, /setPromptHistoryQuery\(new FormData\(event\.target\)\.get\('query'\)\)/);
  assert.match(app, /case 'prompt-history-search-clear':/);
  assert.match(app, /class="prompt-queue-jump-nav"[^>]*aria-label="Jump to Prompt Queue section"/);
  assert.match(app, /data-action="prompt-queue-jump" data-queue-section="compose"[^>]*aria-controls="prompt-queue-compose"/);
  assert.match(app, /data-action="prompt-queue-jump" data-queue-section="history"[^>]*aria-controls="prompt-queue-history"/);
  assert.match(app, /function jumpToPromptQueueSection\(section\)/);
  assert.match(app, /const selector = promptQueueSectionTarget\(section\)/);
  assert.match(app, /case 'prompt-queue-jump':/);
  assert.match(app, /class="prompt-queue-counter" data-full="\$\{presentation\.full\}" aria-label="\$\{state\.promptQueueDraft\.text\.length\} of 4000 characters used"/);
  assert.match(app, /aria-keyshortcuts="Control\+Enter Meta\+Enter"/);
  assert.match(app, /id="prompt-queue-text-safety"[^>]*role="status"[^>]*aria-live="assertive"/);
  assert.match(app, /data-action="prompt-queue-remove-hidden"[^>]*>Remove hidden characters<\/button>/);
  assert.match(app, /function removePromptQueueHiddenCharacters\(form\)/);
  assert.match(app, /Prompt blocked: found \$\{textSafety\.issueCount\} hidden or control character/);
  assert.match(app, /promptQueueComposerPresentation\(state\.promptQueueDraft, targetsAvailable\)/);
  assert.match(app, /isPromptQueueSubmitShortcut\(event\)/);
  assert.match(app, /form\.requestSubmit\(queueButton\)/);
  assert.match(app, /const PROMPT_QUEUE_DRAFT_STORAGE_KEY = 'host-control:prompt-queue-draft:v1'/);
  assert.match(app, /normalizedPromptQueueDraft\(JSON\.parse\(storedPromptQueueDraft\)\)/);
  assert.match(app, /function persistPromptQueueDraft\(\)/);
  assert.match(app, /safeStorageSet\(PROMPT_QUEUE_DRAFT_STORAGE_KEY, value\)/);
  assert.match(app, /class="prompt-queue-draft-state \$\{presentation\.hasDraft \? 'has-draft' : ''\}" role="status"/);
  assert.match(app, /state\.promptQueueDraftStorageAvailable = safeStorageSet\(PROMPT_QUEUE_DRAFT_STORAGE_KEY, ''\)/);
  assert.match(app, /class="prompt-queue-draft-row"/);
  assert.match(app, /data-action="prompt-queue-draft-clear"[^>]*>Clear draft<\/button>/);
  assert.match(app, /data-action="prompt-queue-draft-undo"[^>]*>Undo clear<\/button>/);
  assert.match(app, /function clearPromptQueueDraft\(form\)/);
  assert.match(app, /state\.promptQueueDraftUndo = normalizedPromptQueueDraft\(state\.promptQueueDraft\)/);
  assert.match(app, /function undoPromptQueueDraftClear\(form\)/);
  assert.match(app, /state\.promptQueueDraftUndo = null;[\s\S]*readPromptQueueDraft\(form\)/);
  assert.match(app, /case 'prompt-queue-draft-clear':/);
  assert.match(app, /case 'prompt-queue-draft-undo':/);
  assert.match(app, /id="ticket-refiner-panel" class="ticket-refiner-panel/);
  assert.match(app, /data-action="ticket-refiner-open" type="button"/);
  assert.match(app, /data-action="ticket-refiner-keep-original" type="button">Keep original<\/button>/);
  assert.match(app, /data-action="ticket-refiner-use" type="button"[^>]*>Use refined draft<\/button>/);
  assert.match(app, /Nothing is sent while you refine/);
  assert.match(app, /Original request · always recoverable/);
  assert.match(app, /const TICKET_REFINER_STORAGE_KEY = 'host-control:ticket-refiner:v1'/);
  assert.match(app, /state\.ticketRefinerUndo = normalizedTicketRefinerState\(state\.ticketRefiner\)/);
  assert.match(app, /state\.ticketRefiner = normalizedTicketRefinerState\(state\.ticketRefinerUndo\)/);
  assert.match(app, /ticketRefinerTargetMatch\(state\.ticketRefiner, ticketRefinerCurrentTargets\(targets\)\)/);
  assert.match(app, /Finish Ticket Refiner with Use refined draft or Keep original before queueing or sending/);
  assert.match(app, /Dispatch blocked: this refined draft is bound to a different or replaced exact terminal/);
  assert.match(app, /setNotice\('Refined draft applied locally\. Review it, then queue or send separately\.'\)/);
  const ticketRefinerUseStart = app.indexOf('function useTicketRefinedDraft(form)');
  const ticketRefinerUseEnd = app.indexOf('\nfunction clearPromptQueueDraft', ticketRefinerUseStart);
  const ticketRefinerUseSource = app.slice(ticketRefinerUseStart, ticketRefinerUseEnd);
  assert.ok(ticketRefinerUseStart >= 0 && ticketRefinerUseEnd > ticketRefinerUseStart);
  assert.doesNotMatch(ticketRefinerUseSource, /api\(/);
  assert.ok(ticketRefinerUseSource.indexOf('ticketRefinerTargetMatch') < ticketRefinerUseSource.indexOf("textarea[name=\"text\"]"));
  assert.match(app, /class="prompt-history-origin \$\{escapeHtml\(origin\)\}"/);
  assert.match(app, /data-queue-detail="older"[\s\S]*state\.openPromptQueueDetails\.has\('older'\)/);
  assert.match(app, /data-queue-detail="unconfirmed"[\s\S]*state\.openPromptQueueDetails\.has\('unconfirmed'\)/);
  assert.match(app, /data-queue-detail="canceled"[\s\S]*state\.openPromptQueueDetails\.has\('canceled'\)/);
  assert.match(app, /event\.target\?\.matches\?\.\('\[data-queue-detail\]'\)/);

  const sessionRenderStart = app.indexOf('function renderAgents(agents, orchestration)');
  const sessionRenderEnd = app.indexOf('function sessionAttentionItems', sessionRenderStart);
  const sessionRenderSource = app.slice(sessionRenderStart, sessionRenderEnd);
  assert.ok(sessionRenderStart >= 0 && sessionRenderEnd > sessionRenderStart);
  assert.ok(sessionRenderSource.indexOf('captureScrollPositions(els.sessionList') < sessionRenderSource.indexOf('els.sessionList.innerHTML'));
  assert.ok(sessionRenderSource.indexOf('els.sessionList.innerHTML') < sessionRenderSource.indexOf('restoreScrollPositions(els.sessionList'));

  assert.ok(promptQueueRenderSource.indexOf('captureScrollPositions(els.queue') < promptQueueRenderSource.indexOf('els.queue.innerHTML'));
  assert.ok(promptQueueRenderSource.indexOf('els.queue.innerHTML') < promptQueueRenderSource.indexOf('restoreScrollPositions(els.queue'));
  assert.match(app, /bounds\.left \+ slot\.left \+ inset/);
  assert.match(app, /bounds\.top \+ slot\.top \+ inset/);
  assert.match(app, /case 'drawer-toggle'/);
  assert.match(app, /const SESSION_PANEL_STORAGE_KEY = 'host-control:session-panel-visible'/);
  assert.match(app, /const INSPECTOR_PANEL_STORAGE_KEY = 'host-control:inspector-panel-visible'/);
  assert.match(app, /function syncWorkspacePanels\(\)/);
  assert.match(app, /case 'workspace-panel-toggle':/);
  assert.match(app, /class="tool-panel tools-notifications"/);
  assert.match(app, /event\.isComposing/);
  assert.match(app, /event\.shiftKey \|\| event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey/);

  const reviewStart = app.indexOf('function openScratchpadReview()');
  const reviewEnd = app.indexOf('function togglePinnedSession', reviewStart);
  const reviewSource = app.slice(reviewStart, reviewEnd);
  assert.ok(reviewStart >= 0 && reviewEnd > reviewStart);
  assert.doesNotMatch(reviewSource, /api\('/);
  assert.match(app, /async function confirmScratchpadSend\(\)[\s\S]*sendTerminalTextValue\(item, review\.text/);
  assert.match(app, /data-action="prompt-queue-clear-history"/);
  assert.match(app, /async function clearPromptQueueHistoryClient/);
  assert.match(app, /confirm: 'clear-history'/);
  assert.match(app, /Finished today/);
  assert.match(app, /Average queue wait/);
  assert.match(app, /item\.completedAt \|\| item\.sentAt/);
  assert.match(app, /active · \$\{waiting\} waiting/);
  assert.match(app, /Final response missing/);
  assert.match(app, /Capture boundary expired/);
  assert.match(app, /counts\.sshEvents \?\? sshEvents\.length/);
  assert.match(app, /counts\.recentClosed \?\? recentlyClosed\.length/);
  assert.match(app, /Goal completion needs review/);
  assert.match(app, /Newer activity detected/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.promptQueueContinueMonitoring === true/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.promptQueueManualSubmitWait === true/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.promptQueueReplacementRequeue === true/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.promptQueueReviewDismissal === true/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.promptQueueManualIdeaImport === true/);
  assert.match(app, /data-action="prompt-queue-continue-monitoring"/);
  assert.match(app, />Keep monitoring<\/button>/);
  assert.match(app, /async function continuePromptQueueMonitoringClient/);
  assert.match(app, /confirm: 'continue-monitoring'/);
  assert.match(app, /any later manual send or interrupt will pause it again/);
  assert.match(app, /data-action="prompt-queue-wait-manual-submit"/);
  assert.match(app, /async function waitForPromptQueueManualSubmitClient/);
  assert.match(app, /\/wait-for-manual-submit/);
  assert.match(app, /PaneFleet will not retype the prompt or press Enter/);
  assert.match(app, /data-action="prompt-queue-requeue-replacement"/);
  assert.match(app, /async function requeuePromptQueueReplacementClient/);
  assert.match(app, /\/requeue-on-replacement/);
  assert.match(app, /confirm: recovery\.confirmation/);
  assert.match(app, /this could duplicate work/);
  assert.match(app, /state\.snapshot\?\.capabilities\?\.ideaQueue !== true/);
  assert.match(app, /id="idea-queue-form"/);
  assert.match(app, /id="idea-generator-form"/);
  assert.match(app, />Queue behind project owner</);
  assert.match(app, />Use read-only scout</);
  assert.match(app, />Draft prompt only</);
  assert.match(app, /async function generateIdeasFromForm/);
  assert.match(app, /\/api\/idea-scout/);
  assert.match(app, /exactAgentIdentityForMutation\(view\.source\.live\), text: prompt/);
  assert.match(app, /if \(!result\.item\)[\s\S]*exactAgentIdentityForMutation\(result\.agent\), text: prompt/);
  assert.match(app, /openAgentDetail\(liveScout\.session, liveScout\.id\)/);
  assert.match(app, /Idea Scout · \$\{displayName\}/);
  assert.match(app, /Valid results will return here as Proposed only/);
  assert.match(app, /data-action="idea-approve"/);
  assert.match(app, /data-action="idea-approve"[^>]*data-target-session="\$\{escapeHtml\(workTarget\?\.session \|\| ''\)\}"/);
  assert.match(app, /data-action="idea-refine"/);
  assert.match(app, /data-target-session="\$\{escapeHtml\(refinementTarget\?\.session \|\| ''\)\}"/);
  assert.match(app, /Work: \$\{escapeHtml\(targetLabel\)\} · Refine: \$\{escapeHtml\(refinementTargetLabel\)\}/);
  assert.match(app, /data-action="idea-reject"/);
  assert.match(app, /async function createIdeaFromForm/);
  assert.match(app, /async function approveIdeaClient/);
  assert.match(app, /async function approveIdeaClient[\s\S]*candidate\.session === button\.dataset\.targetSession/);
  assert.match(app, /async function refineIdeaClient/);
  assert.match(app, /candidate\.session === button\.dataset\.targetSession/);
  assert.match(app, /async function rejectIdeaClient/);
  assert.match(app, /confirm: 'approve-idea'/);
  assert.match(app, /confirm: 'refine-idea'/);
  assert.match(app, /confirm: 'reject-idea'/);
  assert.match(app, /Only approval creates an implementation ticket/);
  assert.match(app, /Leaving it before dispatch or resolving an unverified review returns this idea unchanged/);
  assert.match(app, /\[PANEFLEET IDEA\]/);
  assert.match(app, /data-action="prompt-queue-release"/);
  assert.match(app, /async function releasePromptQueueClient/);
  assert.match(app, /confirm: 'release-after-review'/);
  assert.match(app, /result\.outcome === 'captured'/);
  assert.match(app, /final response arrived during review and was captured from the exact terminal/i);
  assert.match(app, /data-action="prompt-queue-dismiss-review"/);
  assert.match(app, /async function dismissPromptQueueReviewClient/);
  assert.match(app, /\/dismiss-review/);
  assert.match(app, /confirm: dismissal\.confirmation/);
  assert.match(app, /data-action="prompt-queue-import-visible-ideas"/);
  assert.match(app, /async function importPromptQueueVisibleIdeasClient/);
  assert.match(app, /\/import-visible-ideas/);
  assert.match(app, /Valid results are saved as Proposed only/);
  assert.match(app, /'goal_completion_review'/);
  assert.match(app, /Returned to ready · no footer/);
  assert.match(app, /Slash command submitted/);
  assert.match(app, /Operator released after review/);
  assert.match(app, /Operator confirmed after review/);
});

test('idea generator verified-conversation renderer executes without missing browser helpers', async () => {
  const app = await uiSource('app.js');
  const formatClockStart = app.indexOf('function formatClock(value)');
  const formatClockEnd = app.indexOf('function checkedLabel(value)', formatClockStart);
  const launcherStart = app.indexOf('function ideaGeneratorLauncher(agents, items, ideas)');
  const launcherEnd = app.indexOf('function ideaQueueSection(data, agents, items)', launcherStart);

  assert.ok(formatClockStart >= 0 && formatClockEnd > formatClockStart);
  assert.ok(launcherStart >= 0 && launcherEnd > launcherStart);

  const context = {
    state: {
      ideaGeneratorDraft: {
        open: true,
        sourceSession: 'codex',
        selectedPromptIds: ['prompt-finished'],
        focus: '',
        ideaCount: '3',
        execution: 'draft'
      }
    },
    ideaGeneratorPresentation: () => ({
      sources: [{ session: 'codex', displayName: 'PaneFleet Worker', stateLabel: 'live', live: {} }],
      source: { session: 'codex', displayName: 'PaneFleet Worker', live: {} },
      conversations: [{
        id: 'prompt-finished',
        completedAt: '2026-08-09T12:34:56.000Z',
        label: 'Verified completed result'
      }],
      generated: { ok: true, prompt: 'Generate one follow-up idea.' }
    }),
    escapeHtml: (value) => String(value)
  };
  const source = [
    app.slice(formatClockStart, formatClockEnd),
    app.slice(launcherStart, launcherEnd),
    'result = ideaGeneratorLauncher([], [], []);'
  ].join('\n');

  assert.doesNotThrow(() => runInNewContext(source, context));
  assert.match(context.result, /Verified completed result/);
  assert.match(context.result, /12:34/);
});

test('idea generator lists every live exact project owner before history-only sources', async () => {
  const app = await uiSource('app.js');
  const targetsStart = app.indexOf('function promptQueueTargets(agents)');
  const targetsEnd = app.indexOf('function preferredPromptQueueSessions(targets)', targetsStart);
  const sourcesStart = app.indexOf('function ideaGeneratorSources(agents, items)');
  const sourcesEnd = app.indexOf('function ideaGeneratorPresentation(agents, items, ideas)', sourcesStart);
  const liveAgent = (session, displayName) => ({
    session,
    displayName,
    canSend: true,
    sessionCreatedAt: '2026-08-09T00:00:00.000Z',
    id: `${session}:0.0`,
    tmuxPaneId: '%1',
    panePid: 100
  });
  const agents = [liveAgent('codex-docs', 'Documentation'), liveAgent('codex-client', 'Client')];
  const items = [{
    id: 'prompt-client',
    session: 'codex-client',
    status: 'sent',
    summaryState: 'captured',
    completionSummary: 'Verified client result',
    target: { identityMatches: true }
  }, {
    id: 'prompt-offline',
    session: 'codex-offline',
    status: 'sent',
    summaryState: 'returned',
    completionSummary: 'Verified prior result',
    target: { identityMatches: false }
  }];
  const context = {
    agents,
    items,
    displayNameForSession: (session) => session,
    verifiedIdeaGenerationConversations: (allItems, session) => allItems.filter((item) => (
      item.session === session && item.status === 'sent' && ['captured', 'returned'].includes(item.summaryState)
    )),
    result: null
  };

  assert.ok(targetsStart >= 0 && targetsEnd > targetsStart);
  assert.ok(sourcesStart >= 0 && sourcesEnd > sourcesStart);
  runInNewContext([
    app.slice(targetsStart, targetsEnd),
    app.slice(sourcesStart, sourcesEnd),
    'result = ideaGeneratorSources(agents, items);'
  ].join('\n'), context);

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.result.map(({ session, stateLabel }) => ({ session, stateLabel })))),
    [
      { session: 'codex-docs', stateLabel: 'live · no verified results' },
      { session: 'codex-client', stateLabel: 'live · verified context' },
      { session: 'codex-offline', stateLabel: 'unavailable · prior context' }
    ]
  );
});

test('idea generator keeps a live project visible while verified context is unavailable', async () => {
  const app = await uiSource('app.js');
  const launcherStart = app.indexOf('function ideaGeneratorLauncher(agents, items, ideas)');
  const launcherEnd = app.indexOf('function ideaQueueSection(data, agents, items)', launcherStart);
  const context = {
    state: { ideaGeneratorDraft: { open: true, selectedPromptIds: [], execution: 'owner' } },
    ideaGeneratorPresentation: () => ({
      sources: [{ session: 'codex-docs', displayName: 'Documentation', stateLabel: 'live · no verified results', live: {} }],
      source: { session: 'codex-docs', displayName: 'Documentation', live: {} },
      conversations: [],
      generated: { ok: false, prompt: '' }
    }),
    escapeHtml: (value) => String(value),
    result: null
  };

  assert.ok(launcherStart >= 0 && launcherEnd > launcherStart);
  runInNewContext([
    app.slice(launcherStart, launcherEnd),
    'result = ideaGeneratorLauncher([], [], []);'
  ].join('\n'), context);

  assert.match(context.result, /Documentation · live · no verified results/);
  assert.match(context.result, /No verified completed queue results are retained/);
  assert.match(context.result, /generation remains disabled/);
  assert.match(context.result, /<button class="primary-button" type="submit" disabled>/);
});

test('dashboard renderer isolates a failed panel and keeps later controls rendering', async () => {
  const app = await uiSource('app.js');
  const guardStart = app.indexOf('function guardedDashboardRender(label, renderSection)');
  const guardEnd = app.indexOf('function render({ preserveActiveEditor = false } = {})', guardStart);
  const renderStart = guardEnd;
  const renderEnd = app.indexOf('function sortSessionAgents(agents)', renderStart);
  const context = {
    state: { clientRenderError: '' },
    console: { error() {} },
    failedResult: null,
    laterResult: null,
    laterRan: false
  };

  assert.ok(guardStart >= 0 && guardEnd > guardStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart);
  runInNewContext([
    app.slice(guardStart, guardEnd),
    "failedResult = guardedDashboardRender('Queue panel', () => { throw new Error('missing helper'); });",
    "laterResult = guardedDashboardRender('Sessions panel', () => { laterRan = true; });"
  ].join('\n'), context);

  assert.equal(context.failedResult, false);
  assert.equal(context.laterResult, true);
  assert.equal(context.laterRan, true);
  assert.match(context.state.clientRenderError, /Queue panel failed: missing helper/);
  const renderSource = app.slice(renderStart, renderEnd);
  for (const label of ['Queue panel', 'Sessions panel', 'Apps panel', 'Usage panel', 'Security panel', 'Host panel', 'Pulse panel', 'Terminal workspace']) {
    assert.match(renderSource, new RegExp(`guardedDashboardRender\\('${label}'`));
  }
  assert.match(renderSource, /setSnapshotError\(state\.clientRenderError \|\| state\.snapshot\?\.errors\?\.\[0\] \|\| ''\)/);
});

test('transient dialogs close one another before taking mobile focus', async () => {
  const app = await uiSource('app.js');
  const drawerStart = app.indexOf('function setOpenDrawer(drawer');
  const drawerEnd = app.indexOf('function openShortcutHelp', drawerStart);
  const shortcutStart = drawerEnd;
  const shortcutEnd = app.indexOf('function closeShortcutHelp', shortcutStart);
  const launcherStart = app.indexOf('function openNewAgentLauncher(requestedWorkspace');
  const launcherEnd = app.indexOf('function closeNewAgentLauncher', launcherStart);
  const closeLauncherEnd = app.indexOf('function handleNewAgentLauncherKeydown', launcherEnd);

  assert.ok(drawerStart >= 0 && drawerEnd > drawerStart);
  assert.ok(shortcutStart >= 0 && shortcutEnd > shortcutStart);
  assert.ok(launcherStart >= 0 && launcherEnd > launcherStart && closeLauncherEnd > launcherEnd);
  assert.match(app.slice(drawerStart, drawerEnd), /if \(next\) \{[\s\S]*closeShortcutHelp\(\{ focus: false \}\);[\s\S]*closeNewAgentLauncher\([^;]*, false\);/);
  assert.match(app.slice(shortcutStart, shortcutEnd), /closeNewAgentLauncher\([^;]*, false\);[\s\S]*setOpenDrawer\(null, \{ focus: false \}\);/);
  assert.match(app.slice(launcherStart, launcherEnd), /closeShortcutHelp\(\{ focus: false \}\);[\s\S]*setOpenDrawer\(null, \{ focus: false \}\);/);
  assert.match(app.slice(launcherEnd, closeLauncherEnd), /focus = true\)[\s\S]*if \(focus\) launcher\.querySelector\('summary'\)\?\.focus/);
  assert.match(app, /function transientDialogOpen\(\)[\s\S]*state\.openDrawer[\s\S]*state\.agentDraft\.open[\s\S]*els\.shortcutHelp/);
  assert.match(app, /function syncTerminalModalState\(desktopMode = isDesktopTerminalMode\(\)\)[\s\S]*item\.id === state\.activeTerminalId,[\s\S]*item\.minimized/);
  assert.match(app, /function applyTerminalLayout\(\) \{[\s\S]*syncTerminalModalState\(desktopMode\);/);
  assert.match(app, /element\.setAttribute\('aria-modal', 'false'\);/);
  assert.match(app, /function setOpenDrawer[\s\S]*syncTerminalModalState\(\);/);
  assert.match(app, /function openShortcutHelp[\s\S]*syncTerminalModalState\(\);/);
  assert.match(app, /function closeShortcutHelp[\s\S]*syncTerminalModalState\(\);/);
  assert.match(app, /function openNewAgentLauncher[\s\S]*render\(\);\s*syncTerminalModalState\(\);/);
  assert.match(app, /function closeNewAgentLauncher[\s\S]*launcher\.removeAttribute\('aria-modal'\);\s*syncTerminalModalState\(\);/);
});

test('the active phone terminal traps focus without making its ancestor inert', async () => {
  const app = await uiSource('app.js');
  const index = await uiSource('index.html');
  const modalStart = app.indexOf('function syncTerminalModalState(desktopMode = isDesktopTerminalMode())');
  const modalEnd = app.indexOf('function currentAgent(session)', modalStart);
  const focusStart = app.indexOf('function handleTerminalModalKeydown(event)');
  const focusEnd = app.indexOf('function handleShortcutHelpKeydown(event)', focusStart);
  const keydownStart = app.indexOf("document.addEventListener('keydown', (event) => {");

  assert.ok(modalStart >= 0 && modalEnd > modalStart);
  const modalSource = app.slice(modalStart, modalEnd);
  assert.match(modalSource, /mobileModalActive \|\|= modalActive/);
  assert.match(modalSource, /toggleTerminalBackgroundInert\(els\.sidebar, mobileModalActive\)/);
  assert.match(modalSource, /toggleTerminalBackgroundInert\(els\.workspace, mobileModalActive\)/);
  assert.match(modalSource, /toggleTerminalBackgroundInert\(els\.terminalDock, mobileModalActive\)/);
  assert.doesNotMatch(modalSource, /els\.appShell\.toggleAttribute\('inert'/);
  assert.match(app, /function toggleTerminalBackgroundInert\(element, active\)[\s\S]*modalIsolationTargetSafe\(element, els\.terminalLayer\)[\s\S]*Boolean\(active && safe\)/);
  const appStart = index.indexOf('id="app"');
  const appEnd = index.lastIndexOf('</div>');
  const terminalLayer = index.indexOf('id="terminal-layer"');
  assert.ok(appStart >= 0 && terminalLayer > appStart && terminalLayer < appEnd, 'terminal layer must remain inside the non-inert app shell');
  assert.ok(focusStart >= 0 && focusEnd > focusStart);
  assert.match(app.slice(focusStart, focusEnd), /item\.element\.getAttribute\('aria-modal'\) !== 'true'/);
  assert.match(app.slice(focusStart, focusEnd), /modalFocusableElements\(item\.element\)[\s\S]*modalFocusIndex\(event, focusable\.indexOf\(document\.activeElement\), focusable\.length\)/);
  assert.ok(keydownStart >= 0);
  assert.match(app.slice(keydownStart), /handleTerminalTabKeydown\(event\)[\s\S]*handleTerminalModalKeydown\(event\)[\s\S]*terminal-find-input/);
});

test('live responsive CSS anchors desktop windows to the workspace and shows only one phone terminal', async () => {
  const styles = await uiSource('styles.css');
  assert.match(styles, /\.terminal-home\s*\{[\s\S]*grid-template-columns: 230px minmax\(520px, 1fr\) 300px/);
  assert.match(styles, /\.terminal-layer\s*\{\s*position: fixed/);
  assert.match(styles, /\.terminal-window\s*\{\s*position: fixed/);
  assert.match(styles, /\.terminal-workspace\.has-open-terminals\s*\{[\s\S]*align-self: stretch/);
  assert.match(styles, /\.terminal-workspace\.has-open-terminals \.terminal-stage\s*\{[\s\S]*display: block/);
  assert.match(styles, /\.terminal-window\.is-full-height :is\([\s\S]*\.resize-n/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-full-height-button\s*\{\s*display: none/);
  assert.match(styles, /\.project-desk\s*\{[\s\S]*min-height: 100%/);
  assert.match(styles, /\.project-desk-actions\s*\{[\s\S]*display: flex/);
  assert.match(styles, /\.project-artifact-row\s*\{/);
  assert.match(styles, /\.project-artifact-item\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styles, /\.project-artifact-preview\s*\{[\s\S]*min-width: 68px/);
  assert.match(styles, /\.project-artifact-row\s*\{[\s\S]*cursor: pointer/);
  assert.match(styles, /\.project-artifact-row\[aria-busy="true"\]/);
  assert.match(styles, /\.scratchpad-review-panel\s*\{[\s\S]*border: 2px solid/);
  assert.match(styles, /\.prompt-queue-form\s*\{/);
  assert.match(styles, /\.idea-queue-panel\s*\{/);
  assert.match(styles, /\.idea-queue-form\s*\{/);
  assert.match(styles, /\.idea-card\s*\{/);
  assert.match(styles, /\.prompt-schedule-grid\s*\{/);
  assert.match(styles, /\.prompt-schedule-card\s*\{/);
  assert.match(styles, /\.prompt-schedule-cron\s*\{/);
  assert.match(styles, /\.prompt-history-finish\.returned/);
  assert.match(styles, /\.prompt-queue-legend \.good/);
  assert.match(styles, /\.prompt-target-grid\s*\{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(210px, 1fr\)\)/);
  assert.match(styles, /\.prompt-target-card\.selected\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-target-grid\s*\{[\s\S]*grid-auto-flow: column/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-target-grid\s*\{[\s\S]*grid-auto-columns: clamp\(240px, 82vw, 300px\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-target-grid\s*\{[\s\S]*scroll-snap-type: inline proximity/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-target-card\s*\{[\s\S]*scroll-snap-align: start/);
  assert.match(styles, /#queue-view\.active\.queue-workspace-view\s*\{[\s\S]*overflow-y: auto/);
  assert.match(styles, /\.prompt-queue-stats\s*\{[\s\S]*grid-template-columns: repeat\(6/);
  assert.match(styles, /\.prompt-history-row\s*\{/);
  assert.match(styles, /\.prompt-history-filter-bar\s*\{/);
  assert.match(styles, /\.prompt-history-origin-filter\.active\s*\{/);
  assert.match(styles, /\.prompt-history-origin\.automated\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-history-filter-bar\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.prompt-history-finish\s*\{/);
  assert.match(styles, /\.prompt-history-finish pre\s*\{/);
  assert.match(styles, /\.terminal-stage\s*\{[\s\S]*grid-row: 3/);
  assert.match(styles, /\.terminal-window\.is-layout-hidden\s*\{\s*display: none/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-window\s*\{\s*position: fixed/);
  assert.match(styles, /\.control-drawer\s*\{[\s\S]*position: fixed/);
  assert.match(styles, /\/\* Mobile and widescreen usability refinement\. \*\//);
  assert.match(styles, /@media \(min-width: 2200px\)/);
  assert.match(styles, /\/\* High-frequency workspace modes\. \*\/[\s\S]*\.app-shell\.is-canvas-focused > \.sidebar,[\s\S]*display: none/);
  assert.match(styles, /@media \(min-width: 760px\) and \(max-width: 1100px\)[\s\S]*\.app-shell\.is-canvas-focused \.terminal-home\s*\{[\s\S]*height: calc\(100dvh - 94px\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.session-task\s*\{[\s\S]*-webkit-line-clamp: 2/);
  assert.match(styles, /\.session-filters\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.session-filter\.active\s*\{[\s\S]*background: #eaf3ff/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-command-bar\s*\{[\s\S]*overflow-x: auto/);
  assert.match(styles, /\/\* Independent workspace panels and compact phone tools\. \*\//);
  assert.match(styles, /\.app-shell\.is-session-panel-hidden \.session-rail,[\s\S]*\.app-shell\.is-inspector-panel-hidden \.terminal-inspector\s*\{\s*display: none/);
  assert.match(styles, /@media \(min-width: 2200px\)[\s\S]*\.app-shell\.is-session-panel-hidden \.terminal-home\s*\{[\s\S]*grid-template-columns: minmax\(920px, 1fr\) 380px/);
  assert.match(styles, /\.terminal-window\.is-tools-collapsed \.terminal-command-bar\s*\{\s*display: none/);
  assert.match(styles, /\/\* Persistent terminal readability controls\. \*\//);
  assert.match(styles, /\.terminal-output\s*\{\s*font-size: var\(--terminal-font-size, 12px\)/);
  assert.match(styles, /\.terminal-text-size-controls\s*\{[\s\S]*font-variant-numeric: tabular-nums/);
  assert.match(styles, /@media \(max-width: 759px\), \(pointer: coarse\)[\s\S]*\.terminal-command-bar \.terminal-text-size-controls button\s*\{[\s\S]*min-width: 44px/);
  assert.match(styles, /\/\* Operator-controlled terminal line wrapping\. \*\//);
  assert.match(styles, /html\.is-terminal-nowrap \.terminal-output\s*\{[\s\S]*white-space: pre;[\s\S]*overflow-wrap: normal/);
  assert.match(styles, /\.terminal-command-bar \.terminal-wrap-control\.active\s*\{[\s\S]*background: rgba\(37, 99, 235, 0\.24\)/);
  assert.match(styles, /\/\* Fast extraction of the currently visible terminal capture\. \*\//);
  assert.match(styles, /\.terminal-command-bar \.terminal-copy-output\.copied\s*\{[\s\S]*color: #bbf7d0/);
  assert.match(styles, /\.terminal-find-bar\s*\{[\s\S]*grid-area: find/);
  assert.match(styles, /\.terminal-find-match\.current\s*\{[\s\S]*background: #facc15/);
  assert.match(styles, /\.terminal-command-bar > span:not\(\.terminal-text-size-controls\)/);
  assert.match(styles, /\.terminal-capture-paused\s*\{[\s\S]*color: #ffd27d/);
  assert.match(styles, /\.terminal-command-bar \.terminal-refresh-toggle\.active\s*\{[\s\S]*color: #fde68a/);
  assert.match(styles, /\/\* Group high-frequency read tools separately from terminal-input commands\. \*\//);
  assert.match(styles, /\.terminal-command-bar > span\.terminal-tool-group\s*\{[\s\S]*display: flex/);
  assert.match(styles, /\.terminal-command-bar \.terminal-interrupt-control\s*\{[\s\S]*color: #fde68a/);
  assert.match(styles, /\.terminal-command-bar \.terminal-stop-control\s*\{[\s\S]*color: #fecaca/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-command-bar > span\.terminal-tool-group\s*\{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-command-bar > span\.terminal-recovery-tools\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-tool-group-label\s*\{[\s\S]*display: block/);
  assert.match(styles, /\.terminal-command-bar \.terminal-text-size-controls \.terminal-text-size-value\.can-reset\s*\{[\s\S]*cursor: pointer/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\/\* Reading-first terminal composer\. \*\//);
  assert.match(styles, /\.terminal-composer-body\s*\{[\s\S]*display: grid/);
  assert.match(styles, /\.send-form\.is-collapsed \.terminal-composer-body\s*\{\s*display: none/);
  assert.match(styles, /@media \(max-width: 759px\), \(pointer: coarse\)[\s\S]*\.terminal-composer-toggle\s*\{[\s\S]*min-height: 44px/);
  assert.match(styles, /\/\* Honest terminal draft and send readiness\. \*\//);
  assert.match(styles, /\.terminal-draft-state\.good\s*\{[\s\S]*color: #95e9b7/);
  assert.match(styles, /\.terminal-draft-state\.warn\s*\{[\s\S]*color: #ffd27d/);
  assert.match(styles, /\/\* Prompt Queue section navigation\. \*\//);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.prompt-queue-jump-nav\s*\{[^}]*grid-row: 3/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-queue-jump-nav\s*\{[\s\S]*safe-area-inset-top/);
  assert.match(styles, /\/\* Prompt Queue composer feedback\. \*\//);
  assert.match(styles, /\.prompt-queue-counter\[data-full="true"\]\s*\{[\s\S]*color: var\(--bad\)/);
  assert.match(styles, /\.prompt-queue-form button\[type="submit"\]:disabled\s*\{/);
  assert.match(styles, /\.prompt-target-bulk-actions\s*\{/);
  assert.match(styles, /\.prompt-queue-selected-targets\s*\{/);
  assert.match(styles, /\.prompt-queue-submit-actions\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-queue-input-meta kbd\s*\{\s*display: none/);
  assert.match(styles, /\.prompt-queue-draft-state\.has-draft\s*\{[\s\S]*color: var\(--good\)/);
  assert.match(styles, /\.prompt-queue-draft-state\.storage-unavailable\s*\{[\s\S]*color: var\(--warn\)/);
  assert.match(styles, /\.prompt-queue-draft-row\s*\{[\s\S]*grid-column: 1 \/ -1/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-queue-draft-actions \.action-button\s*\{[\s\S]*min-height: 44px/);
  assert.match(styles, /\/\* Second-pass workflow refinement for high-frequency use\. \*\//);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.prompt-queue-console\s*\{[\s\S]*grid-template-columns: minmax\(760px, 1\.45fr\) minmax\(500px, 0\.85fr\)/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.control-drawer\s*\{[\s\S]*width: min\(1080px, 72vw\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.prompt-queue-stats\s*\{[\s\S]*scroll-snap-type: inline proximity/);
  assert.match(styles, /\/\* Persistent operational feedback\. \*\//);
  assert.match(styles, /\.connection-pill\[data-state="live"\]/);
  assert.match(styles, /\.connection-pill\[data-state="poll"\]/);
  assert.match(styles, /\.connection-pill\[data-state="error"\]/);
  assert.match(styles, /#refresh-button\[aria-busy="true"\][\s\S]*animation: panefleet-refresh-spin/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.connection-pill strong\s*\{[\s\S]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(styles, /\/\* Live refresh stability\. \*\//);
  assert.match(styles, /\.session-list,[\s\S]*\.prompt-queue-stats,[\s\S]*\.prompt-target-grid\s*\{[\s\S]*overflow-anchor: none/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.terminal-jump-field\s*\{[\s\S]*display: inline-flex/);
  assert.match(styles, /\.terminal-tab > button:first-child:focus-visible\s*\{[\s\S]*outline: 2px solid #93c5fd/);
  assert.match(styles, /@media \(min-width: 1200px\)[\s\S]*\.layout-label-full\s*\{[\s\S]*display: inline/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.layout-button\[data-action="terminal-layout"\],[\s\S]*\.terminal-full-height-button\s*\{[\s\S]*display: none/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.session-item\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 44px/);
  assert.match(styles, /@media \(min-width: 1200px\)[\s\S]*\.terminal-control-label-desktop\s*\{\s*display: inline/);
  assert.match(styles, /\/\* Terminal focus clarity and live-edge navigation\. \*\//);
  assert.match(styles, /@media \(min-width: 760px\)[\s\S]*\.terminal-window\.is-active\s*\{[\s\S]*border-color: rgba\(96, 165, 250, 0\.88\)/);
  assert.match(styles, /\.terminal-window\.is-active \.terminal-header\s*\{[\s\S]*box-shadow: inset 4px 0 0 #60a5fa/);
  assert.match(styles, /\.terminal-jump-latest\s*\{[\s\S]*grid-area: output/);
  assert.match(styles, /\.terminal-jump-latest\.has-new-output\s*\{/);
  assert.match(styles, /@media \(max-width: 759px\), \(pointer: coarse\)[\s\S]*\.terminal-jump-latest\s*\{[\s\S]*min-height: 44px/);
  assert.match(styles, /\/\* Ultrawide context preservation\. \*\//);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.terminal-inspector\s*\{[\s\S]*scrollbar-gutter: stable/);
  assert.match(styles, /\/\* Stable high-frequency navigation actions\. \*\//);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.topbar-actions \.action-button\.new-agent-action\s*\{[\s\S]*display: inline-flex/);
  assert.match(styles, /\/\* Session filter feedback and recovery\. \*\//);
  assert.match(styles, /\.hidden,\s*\[hidden\]\s*\{\s*display: none !important/);
  assert.match(styles, /\.session-list\.has-no-results \.session-no-results\s*\{\s*display: grid/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.session-no-results\s*\{[\s\S]*flex: 1 0 min\(82vw, 280px\)/);
  assert.match(styles, /\.session-item\.is-pinned\s*\{[\s\S]*border-color: var\(--info-border\)/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.session-pin-label\s*\{\s*display: inline/);
  assert.match(styles, /\/\* Explicit session state for fast, color-independent scanning\. \*\//);
  assert.match(styles, /\.session-signal\.working\s*\{[\s\S]*color: #0b579f/);
  assert.match(styles, /\.session-signal\.ready\s*\{[\s\S]*color: #12633e/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.session-task\s*\{\s*display: block/);
  assert.match(styles, /\/\* State-aware switching for open terminals\. \*\//);
  assert.match(styles, /\.terminal-tab-status\.working\s*\{\s*color: #8fc2ff/);
  assert.match(styles, /\.terminal-tab-status\.ready\s*\{\s*color: #77d7a6/);
  assert.match(styles, /@media \(min-width: 1800px\)[\s\S]*\.terminal-tab\s*\{[\s\S]*max-width: 260px/);
  assert.match(styles, /\/\* Persistent terminal identity and live agent state\. \*\//);
  assert.match(styles, /\.terminal-header-status\.working\s*\{[\s\S]*color: #a9d0ff/);
  assert.match(styles, /\.terminal-header-status\.ready\s*\{[\s\S]*color: #95e9b7/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-meta\s*\{[\s\S]*text-overflow: ellipsis/);
  assert.match(styles, /\/\* Finished prompt history search\. \*\//);
  assert.match(styles, /\.prompt-history-search-form\s*\{[\s\S]*grid-template-columns: minmax\(220px, 360px\) auto auto/);
  assert.match(styles, /\/\* New Agent launcher sheet controls\. \*\//);
  assert.match(styles, /body:has\(\.new-agent-panel\[open\]\)\s*\{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.new-agent-panel\[open\] \+ \.new-agent-backdrop\s*\{[\s\S]*position: fixed[\s\S]*inset: 0/);
  assert.match(styles, /\.new-agent-container \.new-agent-panel\[open\] > summary\s*\{[\s\S]*position: sticky[\s\S]*top: 0/);
  assert.match(styles, /\.new-agent-container \.new-agent-panel\[open\] \.launcher-actions\s*\{[\s\S]*position: sticky[\s\S]*bottom: 0/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.new-agent-container \.new-agent-panel\[open\] \.launcher-actions\s*\{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.new-agent-container \.launcher-shortcut\s*\{\s*display: none/);
  assert.match(styles, /\/\* Non-disruptive operational feedback\. \*\//);
  assert.match(styles, /#notice\.notice-toast\s*\{[\s\S]*position: fixed[\s\S]*z-index: 22050/);
  assert.match(styles, /#notice\.notice-toast\[data-kind="success"\]/);
  assert.match(styles, /#notice\.notice-toast\[data-kind="warning"\]/);
  assert.match(styles, /#notice\.notice-toast\[data-kind="error"\]/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*#notice\.notice-toast\s*\{[\s\S]*safe-area-inset-top/);
  assert.match(styles, /\/\* Discoverable keyboard shortcut guide\. \*\//);
  assert.match(styles, /\.shortcut-help\s*\{[\s\S]*position: fixed/);
  assert.match(styles, /\.shortcut-help-backdrop\s*\{[\s\S]*position: fixed/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.shortcut-help\s*\{[\s\S]*bottom: max\(7px, env\(safe-area-inset-bottom\)\)/);
});

test('night mode overrides the high-specificity toast palette for every message kind', async () => {
  const styles = await uiSource('styles.css');
  const lightToastIndex = styles.indexOf('#notice.notice-toast {');
  const nightToastIndex = styles.indexOf(':root[data-theme="night"] #notice.notice-toast {');

  assert.ok(lightToastIndex >= 0);
  assert.ok(nightToastIndex > lightToastIndex, 'night toast overrides must follow the light toast palette');
  assert.match(styles, /:root\[data-theme="night"\] #notice\.notice-toast\s*\{[^}]*background: rgba\(18, 40, 61, 0\.97\)[^}]*color: #c7e1fb/);
  assert.match(styles, /:root\[data-theme="night"\] #notice\.notice-toast\[data-kind="success"\]\s*\{[^}]*background: rgba\(16, 45, 34, 0\.97\)[^}]*color: #71dfa4/);
  assert.match(styles, /:root\[data-theme="night"\] #notice\.notice-toast\[data-kind="warning"\]\s*\{[^}]*background: rgba\(48, 36, 20, 0\.97\)[^}]*color: #f1c77e/);
  assert.match(styles, /:root\[data-theme="night"\] #notice\.notice-toast\[data-kind="error"\]\s*\{[^}]*background: rgba\(53, 27, 29, 0\.97\)[^}]*color: #ff9b94/);
});

test('rendered components cannot introduce an uncovered light-only palette', async () => {
  const styles = (await uiSource('styles.css')).replace(/\/\*[\s\S]*?\*\//g, '');
  const nightStart = styles.indexOf(':root[data-theme="night"]');
  const lightStyles = styles.slice(0, nightStart);
  const nightStyles = styles.slice(nightStart);
  const intentionallyDark = /(?:terminal|send-|picker|paste-preview|code-section|tool-button|layout-button|prompt-queue-page-head|prompt-queue-page-rule|ansi)/;
  const decorativePalette = new Set(['.prompt-queue-stats .digest-metric:nth-child(5)::before']);
  const uncovered = [];
  const channelMean = (hex) => {
    const expanded = hex.length === 4
      ? `#${[...hex.slice(1)].map((channel) => channel + channel).join('')}`
      : hex;
    const value = Number.parseInt(expanded.slice(1), 16);
    return (((value >> 16) & 255) + ((value >> 8) & 255) + (value & 255)) / 3;
  };

  assert.ok(nightStart > 0);
  for (const match of lightStyles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectorList = match[1].trim().replace(/\s+/g, ' ');
    if (!selectorList || selectorList.startsWith('@')) continue;

    const declarations = [...match[2].matchAll(/(?:^|;)\s*(background(?:-color)?|color|border(?:-[a-z]+)?-color|border)\s*:\s*([^;]+)/g)]
      .map((declaration) => ({ property: declaration[1], value: declaration[2].trim() }));
    for (const selector of selectorList.split(',').map((part) => part.trim())) {
      if (intentionallyDark.test(selector) || decorativePalette.has(selector)) continue;

      const themeSensitive = declarations.filter(({ property, value }) => {
        const means = [...value.matchAll(/#[0-9a-f]{3,6}\b/ig)].map((color) => channelMean(color[0]));
        if (property.startsWith('background')) return means.some((mean) => mean > 175);
        if (property === 'color') return means.some((mean) => mean < 175);
        return means.some((mean) => mean > 150);
      });
      if (!themeSensitive.length) continue;

      const formElement = selector.match(/(?:^|[ >])(input|textarea|select)(?=[:.\[]|$)/)?.[1];
      const coveredByGlobalFormRule = formElement && nightStyles.includes(`] ${formElement}`);
      const coveredByRootRule = selector === 'html';
      if (!nightStyles.includes(selector) && !coveredByGlobalFormRule && !coveredByRootRule) {
        uncovered.push(selector);
      }
    }
  }

  assert.deepEqual([...new Set(uncovered)].sort(), []);
});

test('semantic component states use theme tokens in both palettes', async () => {
  const styles = await uiSource('styles.css');

  for (const token of ['info', 'busy', 'idle', 'good', 'warn', 'bad']) {
    assert.equal([...styles.matchAll(new RegExp(`--${token}-ink:`, 'g'))].length, 2, `${token} ink must exist in both themes`);
    assert.equal([...styles.matchAll(new RegExp(`--${token}-border:`, 'g'))].length, 2, `${token} border must exist in both themes`);
  }
  assert.match(styles, /\.action-button\.good\s*\{[^}]*var\(--good-border\)[^}]*var\(--good-soft\)[^}]*var\(--good-ink\)/);
  assert.match(styles, /:root\[data-theme="night"\] \.action-button:not\(\.primary\):not\(\.good\):not\(\.warn\):not\(\.danger\)/);
  assert.match(styles, /:root\[data-theme="night"\] \.notice\[data-kind="error"\]\s*\{[^}]*var\(--bad-border\)[^}]*var\(--bad-soft\)[^}]*var\(--bad-ink\)/);
});

test('every stylesheet class is referenced by the live UI or synthetic screenshot fixture', async () => {
  const [styles, app, index, demo] = await Promise.all([
    uiSource('styles.css'),
    uiSource('app.js'),
    uiSource('index.html'),
    readFile(path.join(root, 'docs', 'readme-demo.html'), 'utf8')
  ]);
  const selectors = [...new Set([...styles.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)]
    .map((match) => match[1]))].sort();
  const sources = `${app}\n${index}\n${demo}`;
  assert.deepEqual(selectors.filter((selector) => !sources.includes(selector)), []);
});

test('stylesheet rules do not silently override their own declarations', async () => {
  const styles = await uiSource('styles.css');
  const viewportFallbacks = [];

  for (const match of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;

    const declarations = new Map();
    for (const declaration of match[2].split(';')) {
      const separator = declaration.indexOf(':');
      if (separator < 0) continue;

      const property = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      if (!property || !value) continue;

      const previous = declarations.get(property);
      if (previous !== undefined) {
        const isViewportFallback = previous.includes('vh')
          && value === previous.replace(/vh\b/g, 'dvh');
        assert.equal(
          isViewportFallback,
          true,
          `${selector} overrides ${property}: ${previous} -> ${value}`
        );
        viewportFallbacks.push(`${selector}:${property}`);
      }
      declarations.set(property, value);
    }
  }

  assert.ok(viewportFallbacks.length > 0, 'expected the intentional vh to dvh fallbacks');
});

test('mobile terminal typing is protected from focus-destroying dashboard renders', async () => {
  const [app, styles] = await Promise.all([uiSource('app.js'), uiSource('styles.css')]);

  assert.match(app, /const protectedTerminalEditor = preserveActiveEditor[\s\S]*\.terminal-window textarea/);
  assert.match(app, /syncOpenTerminalWindows\(\{ protectedEditor: protectedTerminalEditor \}\)/);
  assert.match(app, /item\.sendText !== protectedEditor\) updateTerminalSendForm\(item\)/);
  assert.match(app, /if \(protectedEditor\?\.isConnected\) return/);
  assert.match(app, /const alreadyActive = state\.activeTerminalId === item\.id[\s\S]*if \(alreadyActive\) return/);
  assert.match(app, /const terminalEditor = event\.target\.closest\('\.terminal-send-form, input, textarea, select, \[contenteditable="true"\]'\)/);
  assert.match(app, /if \(item\.sendText\.readOnly !== promptDisabled\) item\.sendText\.readOnly = promptDisabled/);
  assert.match(styles, /@media \(max-width: 759px\) \{\s*\.terminal-layer \{\s*z-index: 1000/);
  assert.match(styles, /@media \(max-width: 759px\)[\s\S]*\.terminal-dock \{\s*z-index: 1001/);
});

test('background DOM updates defer snapshot, terminal, and async panel replacement until selected text is released', async () => {
  const app = await uiSource('app.js');

  assert.match(app, /if \(background\) applySnapshotDomUpdate\(source, \{ preserveActiveEditor: true \}\)/);
  assert.match(app, /applySnapshotDomUpdate\('live', \{ preserveActiveEditor: true \}\)/);
  assert.match(app, /function applyBackgroundDomUpdate\(key, update\) \{[\s\S]*if \(activePageTextSelection\(\)\)[\s\S]*state\.selectionDeferredDomUpdates\.set\(key, update\)[\s\S]*update\(\)/);
  assert.match(app, /function applySnapshotDomUpdate\(source, options = \{\}\) \{\s*return applyBackgroundDomUpdate\('snapshot', \(\) => \{[\s\S]*render\(options\)/);
  assert.match(app, /applyBackgroundDomUpdate\(`terminal:\$\{item\.id\}`, \(\) => \{/);
  assert.match(app, /applyBackgroundDomUpdate\('project-context', \(\) => \{/);
  assert.match(app, /applyBackgroundDomUpdate\(`health:\$\{key\}`, \(\) => \{/);
  assert.match(app, /applyBackgroundDomUpdate\('live-state', \(\) => \{/);
  assert.match(app, /applyBackgroundDomUpdate\('snapshot-error', \(\) => \{/);
  assert.match(app, /applyBackgroundDomUpdate\('options', \(\) => render\(\)\)/);
  assert.match(app, /document\.addEventListener\('selectionchange',[\s\S]*state\.selectionResumeFrame = window\.requestAnimationFrame/);
  assert.match(app, /const updates = \[\.\.\.state\.selectionDeferredDomUpdates\.values\(\)\];\s*state\.selectionDeferredDomUpdates\.clear\(\);\s*for \(const update of updates\) update\(\)/);
});
