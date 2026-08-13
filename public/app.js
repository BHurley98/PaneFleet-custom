import {
  agentCreateOutcome,
  agentDraftSignature,
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
  normalizedExactPaneIdentity,
  normalizedPromptQueueDraft,
  normalizedTicketRefinerState,
  normalizedTerminalRestoreState,
  noticeAutoDismissMs,
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
  terminalComposerPresentation,
  terminalComposerTextareaHeight,
  terminalCaptureFailureTransition,
  terminalChromeCollapseAfterLayoutChange,
  terminalDraftPresentation,
  terminalDesktopLayout,
  terminalFindOffsets,
  terminalFocusKind,
  terminalFullHeightBounds,
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
} from './ui-state.js';

const DASHBOARD_PROTOCOL_VERSION = 3;
const PROJECT_CONTEXT_CACHE_MS = 5_000;
const PROJECT_ARTIFACT_TYPES = Object.freeze({
  pdf: '.pdf',
  markdown: '.md',
  html: '.html'
});
const PROJECT_ARTIFACT_CONTENT_TYPES = new Set(['application/pdf', 'text/markdown', 'text/html']);

function motionAwareScrollBehavior() {
  return preferredScrollBehavior(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

const state = {
  snapshot: null,
  snapshotSequence: 0,
  clientRenderError: '',
  terminalWindows: new Map(),
  nextTerminalId: 1,
  topTerminalZ: 30,
  eventSource: null,
  eventRetryTimer: null,
  pollTimer: null,
  snapshotVersion: 0,
  snapshotRequestsInFlight: 0,
  selectionDeferredDomUpdates: new Map(),
  selectionResumeFrame: null,
  initialViewSelected: false,
  activeView: 'agents',
  openMissionDetails: new Set(),
  openPromptQueueDetails: new Set(),
  missionHistoryOpen: false,
  missionHistoryLimit: 24,
  activeTerminalId: null,
  selectedSession: null,
  openDrawer: null,
  drawerReturnFocus: null,
  shortcutHelpReturnFocus: null,
  activeToolView: 'overview',
  terminalLayout: 'free',
  terminalFullHeight: false,
  terminalFontScale: 1,
  terminalWrap: true,
  terminalRestoreRecords: [],
  terminalRestoreApplied: false,
  terminalRestoreInProgress: false,
  appBadgeCount: null,
  workspaceFocus: false,
  sessionPanelVisible: true,
  inspectorPanelVisible: true,
  theme: document.documentElement.dataset.theme === 'night' ? 'night' : 'light',
  agentFilter: '',
  sessionFilter: 'all',
  sessionFilterRevealKey: '',
  promptHistoryOriginFilter: 'all',
  promptHistoryQuery: '',
  pinnedSessions: new Set(),
  recentAgentSession: null,
  agentInteractions: new Map(),
  agentTouchSentAt: new Map(),
  projectDesk: {
    target: null,
    targetKey: '',
    context: null,
    contextCache: new Map(),
    contextLoading: false,
    contextError: '',
    contextRequestToken: 0,
    customSnippets: null,
    snippetSignature: '',
    review: null,
    notesScope: '',
    notesDirty: false,
    sending: false
  },
  options: { workspaces: [], promptPresets: [], models: [], configuredDefault: {}, reasoningEfforts: [], suggestedName: '' },
  agentDraft: {
    open: false,
    name: '',
    directoryName: '',
    workspace: '__new__',
    preset: '',
    model: '',
    reasoning: '',
    prompt: ''
  },
  missionDraft: {
    open: false,
    title: '',
    workspace: '',
    priority: 'normal',
    goal: '',
    verificationCriteria: 'Review the result and record the evidence that proves the requested outcome.'
  },
  promptQueueDraft: {
    session: '',
    sessions: [],
    text: '',
    cron: ''
  },
  promptQueueDraftStorageAvailable: true,
  promptQueueDraftUndo: null,
  ticketRefiner: normalizedTicketRefinerState(null),
  ticketRefinerUndo: null,
  promptQueueMultiSelect: false,
  promptPausedSchedulesCollapsed: false,
  ideaDraft: { title: '', details: '' },
  ideaGeneratorDraft: {
    open: false,
    sourceSession: '',
    selectedPromptIds: [],
    focus: '',
    ideaCount: '3',
    execution: 'owner'
  }
};

const DETAIL_REFRESH_MS = 2500;
const SEND_TEXT_MAX = 4000;
const PROJECT_NOTES_MAX = 8000;
const SCRATCHPAD_SNIPPETS_KEY = 'host-control:prompt-snippets:v1';
const SCRATCHPAD_SNIPPET_LIMIT = 50;
const ACTIVE_VIEW_STORAGE_KEY = 'host-control:active-view';
const ACTIVE_TOOL_VIEW_STORAGE_KEY = 'host-control:active-tool-view';
const THEME_STORAGE_KEY = 'host-control:theme';
const SESSION_FILTER_STORAGE_KEY = 'host-control:session-filter';
const PROMPT_HISTORY_ORIGIN_STORAGE_KEY = 'host-control:prompt-history-origin';
const PROMPT_QUEUE_DRAFT_STORAGE_KEY = 'host-control:prompt-queue-draft:v1';
const TICKET_REFINER_STORAGE_KEY = 'host-control:ticket-refiner:v1';
const IDEA_QUEUE_DRAFT_STORAGE_KEY = 'host-control:idea-queue-draft:v1';
const PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY = 'host-control:prompt-paused-schedules-collapsed';
const WORKSPACE_FOCUS_STORAGE_KEY = 'host-control:workspace-focus';
const SESSION_PANEL_STORAGE_KEY = 'host-control:session-panel-visible';
const INSPECTOR_PANEL_STORAGE_KEY = 'host-control:inspector-panel-visible';
const TERMINAL_FONT_SCALE_STORAGE_KEY = 'host-control:terminal-font-scale';
const TERMINAL_WRAP_STORAGE_KEY = 'host-control:terminal-wrap';
const TERMINAL_RESTORE_STORAGE_KEY = 'host-control:open-terminals:v1';
const TERMINAL_FONT_SCALE_MIN = 0.8;
const TERMINAL_FONT_SCALE_MAX = 1.4;
const TERMINAL_FONT_SCALE_STEP = 0.1;
const TERMINAL_SEND_HINT = 'Enter sends. Use ↵ or Tab while composing on mobile.';
const PHONE_LAYOUT_QUERY = '(max-width: 759px), (max-width: 900px) and (max-height: 620px) and (pointer: coarse)';
const TERMINAL_DESKTOP_QUERY = '(min-width: 760px)';
const TERMINAL_ULTRAWIDE_QUERY = '(min-width: 1800px)';
const TERMINAL_PICKER_KEY_MAP = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['Enter', 'select'],
  ['Escape', 'cancel']
]);
const NON_SERVICE_TMUX_SESSIONS = new Set(['agent-orchestrator-watchdog']);
const IDLE_SHELL_COMMANDS = new Set(['bash', 'sh', 'zsh']);
let controlSessionRefreshPromise = null;
let noticeDismissTimer = null;
let noticeRevision = 0;
let dashboardRestartInProgress = false;
let previousTerminalDesktopMode = null;
let terminalViewportResizeFrame = 0;

const els = {
  appShell: document.querySelector('#app'),
  sidebar: document.querySelector('.sidebar'),
  workspace: document.querySelector('.workspace'),
  topbar: document.querySelector('.topbar'),
  workspaceEyebrow: document.querySelector('#workspace-eyebrow'),
  workspaceTitle: document.querySelector('#workspace-title'),
  subtitle: document.querySelector('#host-subtitle'),
  refresh: document.querySelector('#refresh-button'),
  themeToggle: document.querySelector('#theme-toggle'),
  shortcutHelp: document.querySelector('#shortcut-help'),
  shortcutHelpBackdrop: document.querySelector('#shortcut-help-backdrop'),
  connectionPill: document.querySelector('#connection-pill'),
  connectionLabel: document.querySelector('#connection-label'),
  notice: document.querySelector('#notice'),
  noticeMessage: document.querySelector('#notice-message'),
  snapshotError: document.querySelector('#snapshot-error'),
  runtimeDrift: document.querySelector('#runtime-drift'),
  runtimeDriftTitle: document.querySelector('#runtime-drift-title'),
  runtimeDriftDetail: document.querySelector('#runtime-drift-detail'),
  runtimeRestart: document.querySelector('#runtime-restart'),
  agentCount: document.querySelector('#agent-count'),
  serviceCount: document.querySelector('#service-count'),
  portCount: document.querySelector('#port-count'),
  liveState: document.querySelector('#live-state'),
  queueBadge: document.querySelector('#queue-badge'),
  queue: document.querySelector('#queue-view'),
  services: document.querySelector('#services-view'),
  system: document.querySelector('#system-view'),
  tabs: [...document.querySelectorAll('.tab')],
  views: [...document.querySelectorAll('.view')],
  sessionCount: document.querySelector('#session-count'),
  sessionSearch: document.querySelector('#session-search'),
  sessionFilters: [...document.querySelectorAll('.session-filter')],
  sessionList: document.querySelector('#session-list'),
  newAgentContainer: document.querySelector('#new-agent-container'),
  openTerminalCount: document.querySelector('#open-terminal-count'),
  terminalWorkspace: document.querySelector('.terminal-workspace'),
  workspaceFocusToggle: document.querySelector('#workspace-focus-toggle'),
  sessionPanelToggle: document.querySelector('#session-panel-toggle'),
  inspectorPanelToggle: document.querySelector('#inspector-panel-toggle'),
  terminalJumpSelect: document.querySelector('#terminal-jump-select'),
  terminalTabs: document.querySelector('#terminal-tabs'),
  terminalStage: document.querySelector('#terminal-stage'),
  terminalEmpty: document.querySelector('#terminal-empty'),
  projectDesk: document.querySelector('#project-desk'),
  projectDeskTitle: document.querySelector('#project-desk-title'),
  projectDeskSubtitle: document.querySelector('#project-desk-subtitle'),
  projectDeskRefresh: document.querySelector('#project-desk-refresh'),
  projectContextState: document.querySelector('#project-context-state'),
  projectWorkspace: document.querySelector('#project-workspace'),
  projectBranch: document.querySelector('#project-branch'),
  projectChangeSummary: document.querySelector('#project-change-summary'),
  projectCheckSummary: document.querySelector('#project-check-summary'),
  projectChanges: document.querySelector('#project-changes'),
  projectChecks: document.querySelector('#project-checks'),
  projectMissionCard: document.querySelector('#project-mission-card'),
  projectMissionStatus: document.querySelector('#project-mission-status'),
  projectMissionDetail: document.querySelector('#project-mission-detail'),
  projectInstructionCount: document.querySelector('#project-instruction-count'),
  projectInstructions: document.querySelector('#project-instructions'),
  projectLinkCount: document.querySelector('#project-link-count'),
  projectLinks: document.querySelector('#project-links'),
  projectArtifactCount: document.querySelector('#project-artifact-count'),
  projectArtifacts: document.querySelector('#project-artifacts'),
  projectNotes: document.querySelector('#project-notes'),
  projectNotesState: document.querySelector('#project-notes-state'),
  scratchpadTarget: document.querySelector('#scratchpad-target'),
  scratchpadCounter: document.querySelector('#scratchpad-counter'),
  scratchpadSnippetSelect: document.querySelector('#scratchpad-snippet-select'),
  scratchpadSnippetName: document.querySelector('#scratchpad-snippet-name'),
  scratchpadSnippetDelete: document.querySelector('#scratchpad-snippet-delete'),
  scratchpadText: document.querySelector('#scratchpad-text'),
  scratchpadSafety: document.querySelector('#scratchpad-safety'),
  scratchpadReview: document.querySelector('#scratchpad-review'),
  scratchpadReviewPanel: document.querySelector('#scratchpad-review-panel'),
  scratchpadReviewTarget: document.querySelector('#scratchpad-review-target'),
  scratchpadReviewText: document.querySelector('#scratchpad-review-text'),
  scratchpadSendConfirm: document.querySelector('#scratchpad-send-confirm'),
  terminalInspector: document.querySelector('#terminal-inspector'),
  terminalLayer: document.querySelector('#terminal-layer'),
  terminalDock: document.querySelector('#terminal-dock'),
  drawerBackdrop: document.querySelector('#drawer-backdrop'),
  toolsDrawer: document.querySelector('#tools-drawer'),
  toolsOverview: document.querySelector('#tools-overview'),
  usage: document.querySelector('#usage-view'),
  security: document.querySelector('#security-view'),
  toolViews: [...document.querySelectorAll('.tool-view')],
  toolTabs: [...document.querySelectorAll('.tool-tab')]
};

try {
  const storedPins = JSON.parse(window.localStorage.getItem('host-control:pinned-sessions') || '[]');
  if (Array.isArray(storedPins)) state.pinnedSessions = new Set(storedPins.map(String));
  const storedLayout = window.localStorage.getItem('host-control:terminal-layout');
  if (['free', 'focus', 'split', 'grid'].includes(storedLayout)) state.terminalLayout = storedLayout;
  const storedToolView = window.localStorage.getItem(ACTIVE_TOOL_VIEW_STORAGE_KEY);
  if (['overview', 'usage', 'services', 'security', 'system'].includes(storedToolView)) state.activeToolView = storedToolView;
  const storedSessionFilter = window.localStorage.getItem(SESSION_FILTER_STORAGE_KEY);
  if (['all', 'needs', 'active', 'idle'].includes(storedSessionFilter)) state.sessionFilter = storedSessionFilter;
  const storedPromptHistoryOrigin = window.localStorage.getItem(PROMPT_HISTORY_ORIGIN_STORAGE_KEY);
  if (['all', 'mine', 'automated'].includes(storedPromptHistoryOrigin)) state.promptHistoryOriginFilter = storedPromptHistoryOrigin;
  state.promptPausedSchedulesCollapsed = window.localStorage.getItem(PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY) === 'true';
  state.workspaceFocus = window.localStorage.getItem(WORKSPACE_FOCUS_STORAGE_KEY) === 'true';
  state.sessionPanelVisible = window.localStorage.getItem(SESSION_PANEL_STORAGE_KEY) !== 'false';
  state.inspectorPanelVisible = window.localStorage.getItem(INSPECTOR_PANEL_STORAGE_KEY) !== 'false';
  const storedTerminalFontScale = Number(window.localStorage.getItem(TERMINAL_FONT_SCALE_STORAGE_KEY));
  if (Number.isFinite(storedTerminalFontScale)) {
    state.terminalFontScale = Math.min(TERMINAL_FONT_SCALE_MAX, Math.max(TERMINAL_FONT_SCALE_MIN, storedTerminalFontScale));
  }
  state.terminalWrap = window.localStorage.getItem(TERMINAL_WRAP_STORAGE_KEY) !== 'false';
} catch {
  // Storage is optional; the terminal remains fully usable without it.
}

try {
  state.terminalRestoreRecords = normalizedTerminalRestoreState(JSON.parse(window.localStorage.getItem(TERMINAL_RESTORE_STORAGE_KEY) || 'null'));
} catch {
  state.terminalRestoreRecords = [];
}

syncDashboardTheme();
syncWorkspaceFocus();
syncWorkspacePanels();
syncTerminalFontScale();
syncTerminalWrap();
previousTerminalDesktopMode = isDesktopTerminalMode();

const storedPromptQueueDraft = safeStorageGet(PROMPT_QUEUE_DRAFT_STORAGE_KEY);
if (storedPromptQueueDraft) {
  try {
    state.promptQueueDraft = normalizedPromptQueueDraft(JSON.parse(storedPromptQueueDraft));
    if (window.matchMedia(PHONE_LAYOUT_QUERY).matches && state.promptQueueDraft.sessions.length > 1) {
      state.promptQueueDraft.sessions = [state.promptQueueDraft.sessions[0]];
      state.promptQueueDraft.session = state.promptQueueDraft.sessions[0];
      persistPromptQueueDraft();
    }
  } catch {
    state.promptQueueDraftStorageAvailable = safeStorageSet(PROMPT_QUEUE_DRAFT_STORAGE_KEY, '');
  }
}

const storedTicketRefiner = safeStorageGet(TICKET_REFINER_STORAGE_KEY);
if (storedTicketRefiner) {
  try {
    state.ticketRefiner = normalizedTicketRefinerState(JSON.parse(storedTicketRefiner));
  } catch {
    safeStorageSet(TICKET_REFINER_STORAGE_KEY, '');
  }
}

const storedIdeaQueueDraft = safeStorageGet(IDEA_QUEUE_DRAFT_STORAGE_KEY);
if (storedIdeaQueueDraft) {
  try {
    const parsed = JSON.parse(storedIdeaQueueDraft);
    state.ideaDraft = {
      title: String(parsed?.title || '').slice(0, 160),
      details: String(parsed?.details || '').slice(0, 3000)
    };
  } catch {
    safeStorageSet(IDEA_QUEUE_DRAFT_STORAGE_KEY, '');
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatTokenCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 'n/a';
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(number >= 10_000_000_000 ? 0 : 1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(number));
}

function usageWindowLabel(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return 'window not reported';
  if (value % 10080 === 0) return `${value / 10080}w window`;
  if (value % 1440 === 0) return `${value / 1440}d window`;
  if (value % 60 === 0) return `${value / 60}h window`;
  return `${Math.round(value)}m window`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function shortPath(value) {
  return String(value || '').replace(/^\/home\/[^/]+(?=\/|$)/, '~');
}

function cpuMem(process) {
  if (!process) return 'n/a';
  return `${process.cpu?.toFixed?.(1) ?? process.cpu}% / ${process.mem?.toFixed?.(1) ?? process.mem}%`;
}

function stateClassName(value) {
  const normalized = String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `state-${normalized || 'unknown'}`;
}

function statusClassName(status) {
  return `${status?.tone || 'warn'} ${stateClassName(status?.state)}`;
}

function formatClock(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function checkedLabel(value) {
  const clock = formatClock(value);
  return clock === 'n/a' ? 'checked n/a' : `checked ${clock}`;
}

function timestampMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionCreatedMs(agent) {
  const seconds = Number(agent?.sessionCreated || 0);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return timestampMs(agent?.sessionCreatedAt);
}

function agentInteractionMs(agent) {
  const created = sessionCreatedMs(agent);
  const stored = timestampMs(agent?.lastInteractionAt);
  const local = timestampMs(state.agentInteractions.get(agent?.session)?.at);
  return Math.max(created, stored >= created ? stored : 0, local >= created ? local : 0);
}

function compareAgentInteraction(left, right) {
  return agentInteractionMs(right) - agentInteractionMs(left)
    || sessionCreatedMs(right) - sessionCreatedMs(left)
    || String(left.session || '').localeCompare(String(right.session || ''));
}

function markAgentInteraction(session, kind = 'interaction', at = new Date().toISOString(), { rerender = true } = {}) {
  const nextMs = timestampMs(at);
  if (!session || !nextMs) return;
  const previous = state.agentInteractions.get(session);
  if (timestampMs(previous?.at) > nextMs) return;
  state.agentInteractions.set(session, { at: new Date(nextMs).toISOString(), kind });
  if (rerender && state.snapshot) render({ preserveActiveEditor: true });
}

function lastUsedLabel(agent) {
  const usedAt = agentInteractionMs(agent);
  if (!usedAt) return 'Last used unknown';
  const elapsed = Math.max(0, Date.now() - usedAt);
  if (elapsed < 60_000) return 'Last used just now';
  if (elapsed < 60 * 60_000) return `Last used ${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000) return `Last used ${Math.floor(elapsed / (60 * 60_000))}h ago`;
  return `Last used ${new Date(usedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function shortDuration(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const seconds = Math.ceil(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)}m`;
}

function sampleMeta(brief) {
  if (!brief?.sampleCount) return '';
  const checked = formatClock(brief.lastSampledAt);
  return checked === 'n/a' ? `${brief.sampleCount} samples` : `${brief.sampleCount} samples · sampled ${checked}`;
}

function rescueRemainingLabel(rescue) {
  return shortDuration(rescue?.remainingMs) || '';
}

function sshRescueStatusLabel(rescue, exactPublicIpAccess) {
  if (!exactPublicIpAccess) return 'Restart required for exact IP access';
  if (rescue?.active) return `Legacy rescue needs locking ${rescueRemainingLabel(rescue) || 'now'}`;
  return 'Exact /32 access rules';
}

function sshRescueAction(rescue, exactPublicIpAccess) {
  if (!exactPublicIpAccess) {
    return {
      action: '',
      label: 'Restart required for exact IP access',
      tone: 'warn',
      title: 'The running dashboard backend does not yet advertise exact /32-only access controls.',
      disabled: true
    };
  }
  if (rescue?.active) {
    return {
      action: 'ssh-rescue-lock',
      label: 'Secure current IP',
      tone: 'primary',
      title: 'Replaces any legacy broad rescue rule with the detected public /32.'
    };
  }
  return {
    action: 'ssh-rescue-open',
    label: 'Allow current IP',
    tone: 'primary',
    title: 'Authorizes one exact public IPv4 /32 on the configured narrow ports.'
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dismissNotice() {
  noticeRevision += 1;
  if (noticeDismissTimer) window.clearTimeout(noticeDismissTimer);
  noticeDismissTimer = null;
  els.notice.classList.add('hidden');
  els.noticeMessage.textContent = '';
  delete els.notice.dataset.kind;
  els.notice.setAttribute('role', 'status');
}

function setNotice(message, kind = 'info') {
  if (!message) {
    dismissNotice();
    return;
  }
  const revision = ++noticeRevision;
  if (noticeDismissTimer) window.clearTimeout(noticeDismissTimer);
  noticeDismissTimer = null;
  els.noticeMessage.textContent = message;
  els.notice.classList.remove('hidden');
  els.notice.dataset.kind = kind;
  els.notice.setAttribute('role', kind === 'error' || kind === 'warning' ? 'alert' : 'status');
  const dismissAfter = noticeAutoDismissMs(kind);
  if (dismissAfter) {
    noticeDismissTimer = window.setTimeout(() => {
      if (revision === noticeRevision) dismissNotice();
    }, dismissAfter);
  }
}

function setSnapshotError(message) {
  applyBackgroundDomUpdate('snapshot-error', () => {
    if (!message) {
      els.snapshotError.classList.add('hidden');
      els.snapshotError.textContent = '';
      return;
    }
    els.snapshotError.textContent = message;
    els.snapshotError.classList.remove('hidden');
    els.snapshotError.dataset.kind = 'error';
  });
}

function dashboardRestartActionAvailable(snapshot = state.snapshot) {
  const dashboard = (snapshot?.services || []).find((service) => service.id === 'agent-orchestrator');
  return dashboard?.actions?.some((action) => action.id === 'restart-dashboard') === true;
}

function syncRuntimeVersion(runtimeVersion) {
  if (dashboardRestartInProgress) {
    els.runtimeDrift.classList.remove('hidden');
    els.runtimeDrift.dataset.kind = 'warning';
    els.runtimeDriftTitle.textContent = 'Restarting dashboard';
    els.runtimeDriftDetail.textContent = 'Agents keep running while PaneFleet waits for the replacement backend.';
    els.runtimeRestart.textContent = 'Restarting…';
    els.runtimeRestart.classList.remove('hidden');
    els.runtimeRestart.disabled = true;
    return;
  }
  const presentation = runtimeVersionPresentation(runtimeVersion, DASHBOARD_PROTOCOL_VERSION);
  els.runtimeDrift.classList.toggle('hidden', !presentation.restartRequired);
  els.runtimeDrift.dataset.kind = presentation.tone;
  els.runtimeDriftTitle.textContent = presentation.title;
  els.runtimeDriftDetail.textContent = presentation.detail;
  els.runtimeRestart.textContent = 'Restart dashboard';
  const restartAvailable = dashboardRestartActionAvailable();
  els.runtimeRestart.classList.toggle('hidden', !restartAvailable);
  els.runtimeRestart.disabled = !restartAvailable;
}

async function waitForCurrentDashboardRuntime(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await api('/', { timeoutMs: 3000 });
      const snapshot = await api('/api/snapshot', { timeoutMs: 5000 });
      const presentation = runtimeVersionPresentation(snapshot.runtimeVersion, DASHBOARD_PROTOCOL_VERSION);
      if (!presentation.restartRequired) return snapshot;
    } catch {
      // A brief disconnect is expected while systemd replaces the backend.
    }
    await sleep(750);
  }
  throw new Error('Dashboard restart was not confirmed within 45 seconds. Check Host status before retrying.');
}

async function restartDashboardFromMismatch() {
  if (dashboardRestartInProgress) return;
  const confirmed = window.confirm(
    'Restart only the PaneFleet dashboard now?\n\nAgents and workload tmux sessions keep running. This page will reconnect automatically.'
  );
  if (!confirmed) return;

  dashboardRestartInProgress = true;
  syncRuntimeVersion(state.snapshot?.runtimeVersion);
  try {
    await api('/api/service/agent-orchestrator/action/restart-dashboard', {
      method: 'POST',
      timeoutMs: 10_000,
      body: JSON.stringify({ confirm: 'restart-dashboard' })
    });
    els.runtimeDriftDetail.textContent = 'Restart scheduled. Waiting for a matching healthy PaneFleet backend…';
    state.snapshot = await waitForCurrentDashboardRuntime();
    window.location.reload();
  } catch (error) {
    dashboardRestartInProgress = false;
    syncRuntimeVersion(state.snapshot?.runtimeVersion);
    throw error;
  }
}

function runElementTask(element, task) {
  if (!element || element.dataset.pending === 'true') return;
  element.dataset.pending = 'true';
  element.setAttribute('aria-busy', 'true');
  if ('disabled' in element) element.disabled = true;
  Promise.resolve()
    .then(task)
    .catch((error) => setNotice(`Action failed: ${error.message}`, 'error'))
    .finally(() => {
      element.dataset.pending = 'false';
      element.removeAttribute('aria-busy');
      if ('disabled' in element) element.disabled = false;
    });
}

async function refreshControlSession(signal) {
  if (!controlSessionRefreshPromise) {
    controlSessionRefreshPromise = fetch('/', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal
    }).finally(() => { controlSessionRefreshPromise = null; });
  }
  const refreshed = await controlSessionRefreshPromise;
  if (!refreshed.ok) throw new Error('Dashboard session refresh failed. Reload this page and try again.');
}

async function api(path, options = {}) {
  const { timeoutMs = options.method === 'POST' ? 30000 : 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(path, {
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
        ...fetchOptions
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw || `HTTP ${response.status}` }; }
      if (response.ok) return data;

      // A rejected control-session check occurs before any mutation, so both a
      // protected read and a POST are safe to refresh and retry once.
      if (data.error === 'control_session_required' && attempt === 0) {
        await refreshControlSession(controller.signal);
        continue;
      }

      const error = new Error(data.detail || data.output || data.error || `HTTP ${response.status}`);
      error.data = data;
      throw error;
    }
    throw new Error('Dashboard session refresh failed. Reload this page and try again.');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Check dashboard health before retrying.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadSnapshot(source = 'manual') {
  const version = ++state.snapshotVersion;
  state.snapshotRequestsInFlight += 1;
  els.refresh.disabled = true;
  els.refresh.setAttribute('aria-busy', 'true');
  try {
    const snapshot = await api('/api/snapshot');
    if (version !== state.snapshotVersion) return;
    state.snapshot = snapshot;
    state.snapshotSequence = 0;
    const background = source !== 'manual';
    if (background) applySnapshotDomUpdate(source, { preserveActiveEditor: true });
    else applySnapshotDomUpdate(source);
  } catch (error) {
    if (version !== state.snapshotVersion) return;
    if (source !== 'manual') setLiveState('error');
    setSnapshotError(`Refresh failed: ${error.message}`);
  } finally {
    state.snapshotRequestsInFlight = Math.max(0, state.snapshotRequestsInFlight - 1);
    els.refresh.disabled = state.snapshotRequestsInFlight > 0;
    els.refresh.setAttribute('aria-busy', state.snapshotRequestsInFlight > 0 ? 'true' : 'false');
  }
}

async function loadOptions() {
  try {
    state.options = await api('/api/options');
    applyBackgroundDomUpdate('options', () => render());
  } catch (error) {
    setNotice(`Option load failed: ${error.message}`, 'error');
  }
}

function setLiveState(value) {
  applyBackgroundDomUpdate('live-state', () => {
    const presentation = connectionStatePresentation(value);
    els.liveState.textContent = value;
    els.liveState.dataset.state = value;
    els.connectionLabel.textContent = presentation.label;
    els.connectionPill.dataset.state = value;
    els.connectionPill.dataset.tone = presentation.tone;
    els.connectionPill.setAttribute('aria-label', presentation.description);
    els.connectionPill.title = presentation.description;
    syncWorkspaceHeading();
  });
}

function stopPolling() {
  if (!state.pollTimer) return;
  window.clearInterval(state.pollTimer);
  state.pollTimer = null;
}

function scheduleEventReconnect() {
  if (state.eventRetryTimer || !window.EventSource) return;
  state.eventRetryTimer = window.setTimeout(() => {
    state.eventRetryTimer = null;
    connectEvents();
  }, 15000);
}

function reconnectForCompleteSnapshot(message) {
  setLiveState('error');
  setSnapshotError(message);
  state.eventSource?.close();
  state.eventSource = null;
  state.snapshotSequence = 0;
  if (state.eventRetryTimer) window.clearTimeout(state.eventRetryTimer);
  state.eventRetryTimer = window.setTimeout(() => {
    state.eventRetryTimer = null;
    connectEvents();
  }, 0);
}

function connectEvents() {
  if (!window.EventSource) {
    startPolling();
    return;
  }
  state.eventSource?.close();
  state.snapshotSequence = 0;
  state.eventSource = new EventSource('/api/events');
  state.eventSource.addEventListener('open', () => {
    stopPolling();
    setLiveState('live');
  });
  state.eventSource.addEventListener('snapshot', (event) => {
    try {
      state.snapshotVersion += 1;
      state.snapshot = JSON.parse(event.data);
      const sequence = Number(event.lastEventId);
      state.snapshotSequence = Number.isSafeInteger(sequence) && sequence > 0 ? sequence : 0;
      applySnapshotDomUpdate('live', { preserveActiveEditor: true });
    } catch (error) {
      setLiveState('error');
      setSnapshotError(`Live update failed: ${error.message}`);
    }
  });
  state.eventSource.addEventListener('snapshot-patch', (event) => {
    try {
      const result = applySnapshotPatch(state.snapshot, state.snapshotSequence, JSON.parse(event.data));
      if (!result.ok) {
        reconnectForCompleteSnapshot('Live updates lost sequence. Reconnecting for a complete snapshot.');
        return;
      }
      state.snapshotVersion += 1;
      state.snapshot = result.snapshot;
      state.snapshotSequence = result.sequence;
      applySnapshotDomUpdate('live', { preserveActiveEditor: true });
    } catch (error) {
      reconnectForCompleteSnapshot(`Live patch failed: ${error.message}. Reconnecting for a complete snapshot.`);
    }
  });
  state.eventSource.addEventListener('error', () => {
    setLiveState('poll');
    setSnapshotError('Live updates were interrupted. Falling back to polling.');
    state.eventSource?.close();
    state.eventSource = null;
    startPolling();
    scheduleEventReconnect();
  });
}

function startPolling() {
  if (state.pollTimer) return;
  setLiveState('poll');
  loadSnapshot('poll');
  state.pollTimer = window.setInterval(() => loadSnapshot('poll'), 10000);
}

function activePageTextSelection() {
  try {
    return hasActiveTextSelection(window.getSelection?.());
  } catch {
    return false;
  }
}

function applyBackgroundDomUpdate(key, update) {
  if (activePageTextSelection()) {
    state.selectionDeferredDomUpdates.set(key, update);
    return false;
  }
  state.selectionDeferredDomUpdates.delete(key);
  update();
  return true;
}

function applySnapshotDomUpdate(source, options = {}) {
  return applyBackgroundDomUpdate('snapshot', () => {
    render(options);
    setSnapshotError(state.clientRenderError || state.snapshot?.errors?.[0] || '');
    if (source === 'live') setLiveState('live');
  });
}

function guardedDashboardRender(label, renderSection) {
  try {
    renderSection();
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error || 'unknown error');
    const message = `${label} failed: ${detail}. Other PaneFleet controls remain available.`;
    state.clientRenderError ||= message;
    console.error(message, error);
    return false;
  }
}

function render({ preserveActiveEditor = false } = {}) {
  const data = state.snapshot;
  if (!data) return;
  state.clientRenderError = '';
  syncRuntimeVersion(data.runtimeVersion);
  const activeElement = document.activeElement;
  const protectedTerminalEditor = preserveActiveEditor
    && activeElement?.matches?.('.terminal-window input, .terminal-window textarea, .terminal-window select')
    ? activeElement
    : null;
  const protectedViewId = protectedTerminalEditor
    ? 'agents-view'
    : preserveActiveEditor && activeElement?.matches?.('input, textarea, select')
      ? activeElement.closest('.view, .tool-view')?.id || ''
      : '';
  const workerAgents = sortSessionAgents(data.agents.filter((agent) => !isReviewAgent(agent)));
  const visibleServices = data.services.filter(isDisplayableService);
  const terminalSessions = sortSessionAgents(terminalRailEntries(workerAgents, visibleServices));
  const runningServices = visibleServices.filter((item) => item.running).length;
  const missionCapability = data.capabilities?.missionQueue === true;
  const promptQueueCapability = data.capabilities?.promptQueue === true;
  const attention = normalizedAttention(data);
  const decisionCount = attentionDecisionCount(data, attention);
  const promptQueueCount = Number(data.promptQueue?.counts?.pending || 0);
  const ideaQueueCount = data.capabilities?.ideaQueue === true ? Number(data.promptQueue?.ideaCounts?.pending || 0) : 0;
  els.subtitle.textContent = `${data.host.hostname} · up ${formatUptime(data.host.uptimeSeconds)} · ${new Date(data.host.time).toLocaleTimeString()}`;
  els.agentCount.textContent = workerAgents.length;
  els.serviceCount.textContent = `${runningServices}/${visibleServices.length}`;
  els.portCount.textContent = data.listeners.length;
  const queueBadgeCount = promptQueueCapability ? promptQueueCount + ideaQueueCount : decisionCount;
  els.queueBadge.textContent = String(queueBadgeCount);
  els.queueBadge.classList.toggle('hidden', !(promptQueueCapability || missionCapability) || queueBadgeCount === 0);
  els.queueBadge.setAttribute('aria-label', promptQueueCapability
    ? `${promptQueueCount} active work ticket${promptQueueCount === 1 ? '' : 's'} and ${ideaQueueCount} pending idea${ideaQueueCount === 1 ? '' : 's'}`
    : `${decisionCount} decision${decisionCount === 1 ? '' : 's'} needed`);
  syncWorkspaceHeading();
  if (!state.initialViewSelected) {
    state.initialViewSelected = true;
    switchView(preferredDashboardView(window.location.hash, safeStorageGet(ACTIVE_VIEW_STORAGE_KEY, 'agents')));
  }
  if (protectedViewId !== 'queue-view') {
    guardedDashboardRender('Queue panel', () => {
      if (promptQueueCapability) renderPromptQueue(data.promptQueue, workerAgents);
      else renderMissionQueue(data.missions, workerAgents, missionCapability, data);
    });
  }
  if (protectedViewId !== 'agents-view') {
    guardedDashboardRender('Sessions panel', () => {
      renderAgents(terminalSessions, data.orchestration);
      revealRecentAgentSession();
    });
  }
  if (protectedViewId !== 'services-view') {
    guardedDashboardRender('Apps panel', () => renderServices(visibleServices));
  }
  if (protectedViewId !== 'usage-view') {
    guardedDashboardRender('Usage panel', () => renderCodexUsageTools(data));
  }
  if (protectedViewId !== 'security-view') {
    guardedDashboardRender('Security panel', () => renderSecurityTools(data.security));
  }
  if (protectedViewId !== 'system-view') {
    guardedDashboardRender('Host panel', () => renderHostTools(data, visibleServices));
  }
  guardedDashboardRender('Pulse panel', () => renderToolsOverview(data, visibleServices, attention));
  guardedDashboardRender('Health checks', () => scheduleHealthChecks());
  guardedDashboardRender('Terminal restore', () => restoreTerminalWorkspace());
  guardedDashboardRender('Terminal workspace', () => syncOpenTerminalWindows({ protectedEditor: protectedTerminalEditor }));
  setSnapshotError(state.clientRenderError || state.snapshot?.errors?.[0] || '');
  return true;
}

function sortSessionAgents(agents) {
  return [...agents].sort((left, right) =>
    Number(state.pinnedSessions.has(right.session)) - Number(state.pinnedSessions.has(left.session))
      || compareAgentInteraction(left, right));
}

function isReviewAgent(agent) {
  return agent?.session === 'codex-orchestrator-review';
}

function isDisplayableService(service) {
  if (!service?.discovered) return true;
  if (NON_SERVICE_TMUX_SESSIONS.has(service.session)) return false;
  if ((service.portStates || []).some((port) => port.listening)) return true;
  const pane = service.pane;
  const currentCommand = String(pane?.currentCommand || '').toLowerCase();
  if (!IDLE_SHELL_COMMANDS.has(currentCommand)) return true;
  return (pane?.processes || []).some((process) => process.pid !== pane.panePid);
}

function revealRecentAgentSession() {
  const session = state.recentAgentSession;
  if (!session) return;
  window.requestAnimationFrame(() => {
    const item = [...els.sessionList.querySelectorAll('.session-item')]
      .find((candidate) => candidate.dataset.session === session);
    if (!item) return;
    state.recentAgentSession = null;
    item.classList.add('recently-started');
    item.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'center' });
  });
}

function missionStatusLabel(status) {
  return ({
    backlog: 'backlog',
    ready: 'ready',
    dispatching: 'dispatching',
    running: 'running',
    needs_you: 'needs you',
    verifying: 'verifying',
    reconcile_required: 'check dispatch',
    done: 'done',
    failed: 'failed',
    canceled: 'canceled'
  })[status] || status;
}

function missionTone(status) {
  if (status === 'done') return 'good';
  if (['needs_you', 'reconcile_required', 'failed'].includes(status)) return 'bad';
  if (['dispatching', 'running', 'verifying'].includes(status)) return 'busy';
  if (status === 'canceled') return 'warn';
  return 'neutral';
}

function missionTimeLabel(value) {
  const time = timestampMs(value);
  if (!time) return 'unknown';
  const elapsed = Math.max(0, Date.now() - time);
  if (elapsed < 60_000) return 'just now';
  if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))}h ago`;
  return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function attentionTone(value, fallback = 'warn') {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'error', 'failed', 'bad', 'danger'].includes(normalized)) return 'bad';
  if (['info', 'busy', 'working', 'verifying'].includes(normalized)) return 'busy';
  if (['good', 'healthy', 'resolved'].includes(normalized)) return 'good';
  if (['warning', 'warn', 'stale', 'waiting'].includes(normalized)) return 'warn';
  return fallback;
}

function normalizeAttentionItem(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  const target = item.target && typeof item.target === 'object' ? item.target : {};
  const kind = String(item.kind || item.category || item.type || target.type || 'attention').toLowerCase();
  const missionId = String(item.missionId || item.mission?.id || target.missionId || (kind === 'mission' ? target.id || item.entityId || '' : ''));
  const session = String(item.session || item.agent?.session || target.session || (kind === 'agent' ? target.id || item.entityId || '' : ''));
  const serviceId = String(item.serviceId || item.service?.id || target.serviceId || (kind === 'service' ? target.id || item.entityId || '' : ''));
  const id = String(item.id || item.key || item.dedupeKey || `${kind}:${missionId || session || serviceId || index}`);
  const status = String(item.status || item.state || item.transition || '');
  const decisionValue = item.requiresDecision ?? item.decision ?? item.actionRequired;
  const title = item.title || item.label || item.name
    || (missionId ? 'Mission needs review' : session ? session : serviceId ? serviceId : 'Host attention');
  const detail = item.detail || item.message || item.summary || item.nextAction || item.reason || status || 'Open for details.';
  return {
    ...item,
    id,
    kind,
    missionId,
    session,
    paneId: String(item.paneId || target.paneId || ''),
    serviceId,
    view: String(item.view || target.view || ''),
    title: String(title),
    detail: String(detail),
    status,
    tone: attentionTone(item.tone || item.severity || status),
    requiresDecision: decisionValue === true,
    updatedAt: item.updatedAt || item.createdAt || item.at || null
  };
}

function fallbackAttentionItems(snapshot) {
  const items = [];
  for (const mission of snapshot.missions?.jobs || []) {
    if (!['needs_you', 'reconcile_required', 'failed'].includes(mission.status)) continue;
    items.push(normalizeAttentionItem({
      id: `mission:${mission.id}:${mission.status}`,
      kind: 'mission',
      missionId: mission.id,
      title: mission.title,
      detail: mission.blocker || mission.resultSummary || `Mission is ${missionStatusLabel(mission.status)}.`,
      status: mission.status,
      tone: missionTone(mission.status),
      requiresDecision: true,
      updatedAt: mission.updatedAt
    }, items.length));
  }
  for (const agent of snapshot.orchestration?.agents || []) {
    const stateValue = String(agent.state || '').toLowerCase();
    const visible = agent.needsAttention || agent.tone === 'bad' || ['waiting', 'stopped', 'error', 'missing'].includes(stateValue);
    if (!visible) continue;
    items.push(normalizeAttentionItem({
      id: `agent:${agent.session}:${stateValue || agent.tone || 'attention'}`,
      kind: 'agent',
      session: agent.session,
      title: agent.displayName || agent.session,
      detail: agent.nextAction || agent.stateText || agent.reason || `Agent is ${stateValue || 'waiting'}.`,
      status: stateValue,
      tone: agent.tone,
      requiresDecision: stateValue === 'waiting',
      updatedAt: agent.checkedAt
    }, items.length));
  }
  for (const service of snapshot.services || []) {
    const missingPort = service.running && listValue(service.portStates).some((port) => port.listening === false);
    const unhealthy = service.healthy === false || service.health?.ok === false || service.status?.tone === 'bad'
      || missingPort || ((service.expectedRunning || service.required) && !service.running);
    if (!unhealthy) continue;
    items.push(normalizeAttentionItem({
      id: `service:${service.id}:unhealthy`,
      kind: 'service',
      serviceId: service.id,
      title: service.label || service.id,
      detail: service.health?.detail || (service.running ? 'A required listener or health check is failing.' : 'Expected service is stopped.'),
      status: service.running ? 'unhealthy' : 'stopped',
      tone: 'bad',
      requiresDecision: false,
      updatedAt: snapshot.host?.time
    }, items.length));
  }
  const securityWarnings = listValue(snapshot.security?.warnings);
  for (const warning of securityWarnings) {
    const value = typeof warning === 'string' ? { message: warning } : warning;
    items.push(normalizeAttentionItem({
      ...value,
      id: value.id || `security:${items.length}`,
      kind: 'security',
      title: value.title || 'Security warning',
      tone: value.tone || value.severity || 'warn'
    }, items.length));
  }
  if (snapshot.security?.sshRescue?.active) {
    items.push(normalizeAttentionItem({
      id: 'security:ssh-rescue',
      kind: 'security',
      title: 'Secure network access',
      detail: 'A legacy rescue rule needs to be replaced with the current exact /32 address.',
      tone: 'warn',
      requiresDecision: true,
      view: 'agents'
    }, items.length));
  }
  return items.filter(Boolean);
}

function normalizedAttention(snapshot) {
  const raw = snapshot.attention;
  const sectionValues = Array.isArray(raw?.sections)
    ? raw.sections
    : raw?.sections && typeof raw.sections === 'object'
      ? Object.values(raw.sections)
      : [];
  const explicitLists = [
    ...(Array.isArray(raw) ? [raw] : []),
    ...(raw && typeof raw === 'object' ? [raw.items, raw.feed, raw.needsYou] : []),
    ...sectionValues.map((section) => Array.isArray(section) ? section : section?.items)
  ].filter(Array.isArray);
  const sourceItems = explicitLists.flat();
  const explicitFeed = explicitLists.length > 0;
  const items = (explicitFeed ? sourceItems : fallbackAttentionItems(snapshot))
    .map(normalizeAttentionItem)
    .filter(Boolean);
  const unique = new Map();
  for (const item of items) {
    const key = item.dedupeKey || item.id;
    if (!unique.has(key)) unique.set(key, item);
  }
  const rank = { bad: 0, warn: 1, busy: 2, good: 3 };
  const sorted = [...unique.values()].sort((left, right) =>
    Number(right.requiresDecision) - Number(left.requiresDecision)
      || (rank[left.tone] ?? 4) - (rank[right.tone] ?? 4)
      || timestampMs(right.updatedAt) - timestampMs(left.updatedAt));
  const countValue = raw?.decisionCount ?? raw?.counts?.decisions;
  return {
    items: sorted,
    decisionCount: Number.isFinite(Number(countValue)) ? Math.max(0, Number(countValue)) : null
  };
}

function attentionDecisionCount(snapshot, attention = normalizedAttention(snapshot)) {
  if (attention.decisionCount !== null) return attention.decisionCount;
  return attention.items.filter((item) => item.requiresDecision).length;
}

function normalizedNotifications(snapshot) {
  const raw = snapshot.notifications;
  if (!raw) return [];
  const source = Array.isArray(raw) ? raw : listValue(raw.items).length ? raw.items : listValue(raw.outbox);
  const defaultSnoozeEndpoint = !Array.isArray(raw) ? raw.snoozeEndpoint || raw.links?.snooze || '' : '';
  const unique = new Map();
  source.forEach((item, index) => {
    if (!item || typeof item !== 'object' || ['snoozed', 'dismissed', 'closed'].includes(String(item.status || '').toLowerCase())) return;
    if (timestampMs(item.snoozedUntil) > Date.now()) return;
    const normalized = normalizeAttentionItem(item, index);
    if (!normalized) return;
    const id = String(item.id || item.notificationId || item.dedupeKey || normalized.id);
    unique.set(String(item.dedupeKey || id), {
      ...normalized,
      id,
      openEndpoint: String(item.openEndpoint || item.links?.open || ''),
      snoozeEndpoint: String(item.snoozeEndpoint || item.links?.snooze || defaultSnoozeEndpoint || '')
    });
  });
  return [...unique.values()].sort((left, right) => timestampMs(right.updatedAt) - timestampMs(left.updatedAt));
}

function agentMatchesMissionWorkspace(agent, mission) {
  const workerPath = String(agent?.currentPath || '').replace(/\/+$/, '');
  const missionPath = String(mission?.workspace || '').replace(/\/+$/, '');
  return Boolean(workerPath && missionPath && (workerPath === missionPath || workerPath.startsWith(`${missionPath}/`)));
}

function missionWorkspacesConflict(leftValue, rightValue) {
  const left = String(leftValue || '').replace(/\/+$/, '');
  const right = String(rightValue || '').replace(/\/+$/, '');
  return Boolean(left && right && (
    left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
  ));
}

function activeMissionJobs(excludeId = '') {
  return (state.snapshot?.missions?.jobs || []).filter((job) =>
    job.id !== excludeId && ['dispatching', 'running', 'needs_you', 'verifying', 'reconcile_required'].includes(job.status)
  );
}

function availableMissionWorkers(mission, agents) {
  const activeJobs = activeMissionJobs(mission.id);
  const maxActive = Number(state.snapshot?.missions?.maxActive || 3);
  if (activeJobs.length >= maxActive) return [];
  if (activeJobs.some((job) => missionWorkspacesConflict(job.workspace, mission.workspace))) return [];
  const lockedSessions = new Set(activeJobs
    .map((job) => job.assignedSession)
    .filter(Boolean));
  const candidates = agents.filter((agent) =>
    agent.canSend &&
    agent.agentStatus?.state === 'idle' &&
    !lockedSessions.has(agent.session) &&
    agentMatchesMissionWorkspace(agent, mission));
  return candidates.filter((candidate) => !agents.some((other) =>
    other.session !== candidate.session &&
    other.canSend &&
    missionWorkspacesConflict(other.currentPath, mission.workspace)
  ));
}

function missionDispatchBlockReason(mission, agents) {
  const activeJobs = activeMissionJobs(mission.id);
  const maxActive = Number(state.snapshot?.missions?.maxActive || 3);
  if (activeJobs.length >= maxActive) return `All ${maxActive} active slots are in use.`;
  const workspaceLock = activeJobs.find((job) => missionWorkspacesConflict(job.workspace, mission.workspace));
  if (workspaceLock) return `Workspace is locked by “${workspaceLock.title}”.`;
  const idleMatching = agents.filter((agent) =>
    agent.canSend && agent.agentStatus?.state === 'idle' && agentMatchesMissionWorkspace(agent, mission));
  if (!idleMatching.length) return 'Start or park an idle Codex agent in this project first.';
  if (!availableMissionWorkers(mission, agents).length) return 'Another promptable agent is already open in this workspace.';
  return '';
}

function missionWorkerSelect(mission, agents) {
  const workers = availableMissionWorkers(mission, agents);
  const selected = workers.some((agent) => agent.session === mission.assignedSession) ? mission.assignedSession : workers[0]?.session || '';
  const blockedReason = missionDispatchBlockReason(mission, agents);
  return `
    <label class="mission-worker-field">
      <span>Worker</span>
      <select data-mission-worker aria-label="Worker for ${escapeHtml(mission.title)}">
        <option value="">${workers.length ? 'Choose worker' : 'No idle matching agent'}</option>
        ${workers.map((agent) => `<option value="${escapeHtml(agent.session)}" ${agent.session === selected ? 'selected' : ''}>${escapeHtml(displayNameForSession(agent.session))} · ${escapeHtml(agent.session)}</option>`).join('')}
      </select>
    </label>
    ${blockedReason ? `<p class="mission-worker-hint">${escapeHtml(blockedReason)}</p>` : ''}
  `;
}

function availableMissionAdoptionWorkers(mission, agents) {
  if (!['ready', 'needs_you'].includes(mission.status)) return [];
  if (mission.status === 'needs_you' && mission.worker?.identityMatches) return [];
  const activeJobs = activeMissionJobs(mission.id);
  const maxActive = Number(state.snapshot?.missions?.maxActive || 3);
  if (mission.status === 'ready' && activeJobs.length >= maxActive) return [];
  if (activeJobs.some((job) => missionWorkspacesConflict(job.workspace, mission.workspace))) return [];
  const lockedSessions = new Set(activeJobs.map((job) => job.assignedSession).filter(Boolean));
  return agents.filter((agent) =>
    agent.canSend &&
    agent.agentStatus?.state !== 'stopped' &&
    agent.sessionCreatedAt &&
    agent.id &&
    /^%\d+$/.test(String(agent.tmuxPaneId || '')) &&
    Number.isInteger(agent.panePid) &&
    !lockedSessions.has(agent.session) &&
    agentMatchesMissionWorkspace(agent, mission)
  );
}

function missionAdoptionControl(mission, agents) {
  const workers = availableMissionAdoptionWorkers(mission, agents);
  if (!workers.length) return '';
  return `
    <div>
      <label class="mission-worker-field">
        <span>Existing work</span>
        <select data-mission-adopt-worker aria-label="Existing worker for ${escapeHtml(mission.title)}">
          ${workers.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(displayNameForSession(agent.session))} · ${escapeHtml(agent.session)} · ${escapeHtml(agent.agentStatus?.state || 'live')}</option>`).join('')}
        </select>
      </label>
      <div class="mission-actions">
        <button class="action-button warn" data-action="mission-adopt" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" type="button">Adopt Existing Work</button>
      </div>
      <p class="mission-worker-hint">Queue identity only. No prompt or terminal input will be sent.</p>
    </div>
  `;
}

function missionTransitionButton(mission, to, label, tone = '') {
  return `<button class="action-button ${escapeHtml(tone)}" data-action="mission-transition" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" data-to="${escapeHtml(to)}" type="button">${escapeHtml(label)}</button>`;
}

function missionCardActions(mission, agents, queueIndex = -1, queueLength = 0) {
  const workerIdentitySafe = Boolean(mission.worker?.present && mission.worker?.identityMatches);
  const openWorker = mission.assignedSession
    ? workerIdentitySafe
      ? `<button class="action-button" data-action="mission-open-agent" data-session="${escapeHtml(mission.assignedSession)}" data-pane-id="${escapeHtml(mission.assignedPaneId || '')}" type="button">Open Terminal</button>`
      : `<button class="action-button" disabled type="button">${mission.worker?.identityState === 'unavailable' ? 'Worker Identity Lost' : mission.worker?.present ? 'Worker Replaced' : 'Worker Missing'}</button>`
    : '';
  if (mission.status === 'ready') {
    const workers = availableMissionWorkers(mission, agents);
    return `
      ${missionWorkerSelect(mission, agents)}
      <div class="mission-actions">
        <button class="action-button primary" data-action="mission-run" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" ${workers.length ? '' : 'disabled'} type="button">Run Now</button>
        <button class="action-button" data-action="mission-move" data-direction="up" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" ${queueIndex <= 0 ? 'disabled' : ''} type="button" aria-label="Move mission up">↑</button>
        <button class="action-button" data-action="mission-move" data-direction="down" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" ${queueIndex < 0 || queueIndex >= queueLength - 1 ? 'disabled' : ''} type="button" aria-label="Move mission down">↓</button>
        ${missionTransitionButton(mission, 'backlog', 'Hold')}
      </div>
      ${missionAdoptionControl(mission, agents)}
    `;
  }
  if (mission.status === 'backlog') {
    return `<div class="mission-actions">${missionTransitionButton(mission, 'ready', 'Add to Up Next', 'primary')}</div>`;
  }
  if (mission.status === 'running') {
    return `<div class="mission-actions">${openWorker}${missionTransitionButton(mission, 'needs_you', 'Needs Me', 'warn')}${missionTransitionButton(mission, 'verifying', 'Verify', 'primary')}${missionTransitionButton(mission, 'failed', 'Mark Failed', 'danger')}</div>`;
  }
  if (mission.status === 'dispatching') {
    return `<div class="mission-actions">${openWorker}<button class="action-button" disabled type="button">Dispatching…</button>${missionTransitionButton(mission, 'reconcile_required', 'Inspect Dispatch', 'warn')}</div>`;
  }
  if (mission.status === 'verifying') {
    return `<div class="mission-actions">${openWorker}${missionTransitionButton(mission, 'done', 'Pass & Done', 'primary')}${missionTransitionButton(mission, 'running', 'Return to Work')}${missionTransitionButton(mission, 'failed', 'Mark Failed', 'danger')}</div>`;
  }
  if (mission.status === 'needs_you') {
    return `<div class="mission-actions">${openWorker}${missionTransitionButton(mission, 'running', 'Continue', 'primary')}${missionTransitionButton(mission, 'verifying', 'Verify')}${missionTransitionButton(mission, 'ready', 'Requeue')}${missionTransitionButton(mission, 'failed', 'Mark Failed', 'danger')}</div>${missionAdoptionControl(mission, agents)}`;
  }
  if (mission.status === 'reconcile_required') {
    const assumeRunning = workerIdentitySafe
      ? missionTransitionButton(mission, 'running', 'Assume Running', 'warn')
      : '<button class="action-button" disabled type="button">Cannot Assume Worker</button>';
    return `<div class="mission-actions">${openWorker}${assumeRunning}${missionTransitionButton(mission, 'ready', 'Requeue')}${missionTransitionButton(mission, 'failed', 'Mark Failed', 'danger')}</div>`;
  }
  if (mission.status === 'failed') {
    return `<div class="mission-actions"><button class="action-button" data-action="mission-result" data-mission-id="${escapeHtml(mission.id)}" type="button">View Failure</button>${missionTransitionButton(mission, 'ready', 'Requeue', 'primary')}</div>`;
  }
  if (mission.status === 'done' || mission.status === 'canceled') {
    return `<div class="mission-actions"><button class="action-button" data-action="mission-result" data-mission-id="${escapeHtml(mission.id)}" type="button">View Result</button>${missionTransitionButton(mission, 'ready', 'Requeue')}</div>`;
  }
  return '';
}

function missionCard(mission, agents, queueIndex = -1, queueLength = 0) {
  const attentionHint = mission.suggestedAttention && mission.status === 'running'
    ? '<p class="mission-alert">Agent activity suggests this may need your attention.</p>'
    : '';
  const blocker = mission.blocker ? `<p class="mission-alert">${escapeHtml(mission.blocker)}</p>` : '';
  return `
    <article class="mission-card ${escapeHtml(missionTone(mission.status))}" data-mission-id="${escapeHtml(mission.id)}">
      <div class="mission-card-head">
        <div>
          <h3>${escapeHtml(mission.title)}</h3>
          <p>${escapeHtml(mission.priority)} · ${escapeHtml(shortPath(mission.workspace))} · updated ${escapeHtml(missionTimeLabel(mission.updatedAt))}</p>
        </div>
        <span class="status ${escapeHtml(missionTone(mission.status))}">${escapeHtml(missionStatusLabel(mission.status))}</span>
      </div>
      ${blocker || attentionHint}
      <p class="mission-goal">${escapeHtml(mission.goal)}</p>
      ${missionCardActions(mission, agents, queueIndex, queueLength)}
      <details class="mission-details" ${state.openMissionDetails.has(mission.id) ? 'open' : ''}>
        <summary>Details</summary>
        <dl>
          <div><dt>Mission</dt><dd>${escapeHtml(mission.id)}</dd></div>
          <div><dt>Verification</dt><dd>${escapeHtml(mission.verificationCriteria)}</dd></div>
          <div><dt>Worker</dt><dd>${escapeHtml(mission.assignedSession || 'unassigned')}</dd></div>
          <div><dt>Attempts</dt><dd>${Number(mission.attempts?.length || 0)}</dd></div>
          ${mission.outcomes?.length ? `<div><dt>Last result</dt><dd>${escapeHtml(mission.outcomes.at(-1)?.note || '')}</dd></div>` : ''}
          <div><dt>Updated</dt><dd>${escapeHtml(missionTimeLabel(mission.updatedAt))}</dd></div>
        </dl>
        ${!['done', 'canceled', 'dispatching'].includes(mission.status) ? `<button class="action-button danger" data-action="mission-transition" data-mission-id="${escapeHtml(mission.id)}" data-revision="${mission.revision}" data-to="canceled" type="button">Cancel Mission</button>` : ''}
      </details>
    </article>
  `;
}

function missionLane(title, detail, jobs, agents, { queue = false } = {}) {
  if (!jobs.length) return '';
  return `
    <section class="mission-lane">
      <div class="mission-lane-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div><strong>${jobs.length}</strong></div>
      <div class="mission-list">${jobs.map((job, index) => missionCard(job, agents, queue ? index : -1, queue ? jobs.length : 0)).join('')}</div>
    </section>
  `;
}

function attentionKindLabel(item) {
  if (item.missionId || item.kind.includes('mission')) return 'Mission';
  if (item.session || item.kind.includes('agent')) return 'Agent';
  if (item.serviceId || item.kind.includes('service')) return 'Service';
  if (item.kind.includes('security')) return 'Security';
  return 'Host';
}

function attentionCanOpen(item) {
  return Boolean(item.missionId || item.session || item.serviceId || item.view || item.kind.includes('security'));
}

function attentionFeedCard(item, missions, agents) {
  const mission = item.missionId ? missions.find((job) => job.id === item.missionId) : null;
  if (mission) return missionCard(mission, agents);
  return `
    <article class="today-card ${escapeHtml(item.tone)}" data-attention-id="${escapeHtml(item.id)}">
      <div class="today-card-head">
        <span class="today-kind">${escapeHtml(attentionKindLabel(item))}</span>
        ${item.requiresDecision ? '<span class="today-decision">Decision</span>' : `<span class="today-time">${escapeHtml(missionTimeLabel(item.updatedAt))}</span>`}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.detail)}</p>
      ${attentionCanOpen(item) ? `<button class="action-button primary" data-action="attention-open" data-attention-id="${escapeHtml(item.id)}" type="button">Open</button>` : ''}
    </article>
  `;
}

function attentionLane(items, missions, agents) {
  if (!items.length) return '';
  const renderedMissionIds = new Set();
  const cards = items.filter((item) => {
    if (!item.missionId) return true;
    if (renderedMissionIds.has(item.missionId)) return false;
    renderedMissionIds.add(item.missionId);
    return true;
  });
  return `
    <section class="mission-lane today-attention-lane">
      <div class="mission-lane-head"><div><h2>Needs You</h2><p>Decisions and exceptions across this host</p></div><strong>${cards.length}</strong></div>
      <div class="mission-list">${cards.map((item) => attentionFeedCard(item, missions, agents)).join('')}</div>
    </section>
  `;
}

function notificationCard(notification) {
  return `
    <article class="notification-card ${escapeHtml(notification.tone)}" data-notification-id="${escapeHtml(notification.id)}">
      <div>
        <span class="today-kind">${escapeHtml(attentionKindLabel(notification))}</span>
        <span class="today-time">${escapeHtml(missionTimeLabel(notification.updatedAt))}</span>
      </div>
      <h3>${escapeHtml(notification.title)}</h3>
      <p>${escapeHtml(notification.detail)}</p>
      <div class="notification-actions">
        <button class="action-button primary" data-action="notification-open" data-notification-id="${escapeHtml(notification.id)}" ${notification.openEndpoint && attentionCanOpen(notification) ? '' : 'disabled'} type="button">Open</button>
        ${notification.snoozeEndpoint ? `<button class="action-button" data-action="notification-snooze" data-notification-id="${escapeHtml(notification.id)}" type="button">Snooze 15m</button>` : ''}
      </div>
    </article>
  `;
}

function notificationLane(notifications) {
  if (!notifications.length) return '';
  return `
    <section class="notification-outbox" aria-label="Notification outbox">
      <div class="mission-lane-head"><div><h2>Notifications</h2><p>New transitions, deduplicated</p></div><strong>${notifications.length}</strong></div>
      <div class="notification-list">${notifications.map(notificationCard).join('')}</div>
    </section>
  `;
}

function missionCreateForm() {
  const draft = state.missionDraft;
  return `
    <details class="mission-create-panel" ${draft.open ? 'open' : ''}>
      <summary>Create mission</summary>
      <form id="mission-create-form" class="mission-create-form">
        <label>Outcome<input name="title" maxlength="${160}" required autocomplete="off" placeholder="Fix login and prove it works" value="${escapeHtml(draft.title)}"></label>
        <label>Project<select name="workspace" required><option value="">Choose project</option>${workspaceSelectOptions(draft.workspace)}</select></label>
        <label>Priority<select name="priority"><option value="urgent" ${draft.priority === 'urgent' ? 'selected' : ''}>Urgent</option><option value="high" ${draft.priority === 'high' ? 'selected' : ''}>High</option><option value="normal" ${draft.priority === 'normal' ? 'selected' : ''}>Normal</option><option value="low" ${draft.priority === 'low' ? 'selected' : ''}>Low</option></select></label>
        <label class="mission-form-wide">Goal / instructions<textarea name="goal" rows="4" maxlength="2600" required placeholder="What should the agent accomplish?">${escapeHtml(draft.goal)}</textarea></label>
        <label class="mission-form-wide">Verification<textarea name="verificationCriteria" rows="2" maxlength="800" required>${escapeHtml(draft.verificationCriteria)}</textarea></label>
        <div class="mission-form-actions mission-form-wide"><button class="primary-button" type="submit">Add to Up Next</button><span>Saving never dispatches automatically. Do not include passwords, tokens, or secrets.</span></div>
      </form>
    </details>
  `;
}

function promptQueueTargets(agents) {
  return agents.filter((agent) =>
    agent.canSend &&
    agent.sessionCreatedAt &&
    agent.id &&
    /^%\d+$/.test(String(agent.tmuxPaneId || '')) &&
    Number.isInteger(agent.panePid)
  );
}

function preferredPromptQueueSessions(targets) {
  const available = new Set(targets.map((agent) => agent.session));
  const selected = (state.promptQueueDraft.sessions || [state.promptQueueDraft.session])
    .filter((session, index, sessions) => available.has(session) && sessions.indexOf(session) === index)
    .slice(0, 12);
  if (selected.length) return selected;
  if (available.has(state.selectedSession)) return [state.selectedSession];
  return targets[0]?.session ? [targets[0].session] : [];
}

function promptQueueAgentSignal(agent) {
  const status = agent.agentStatus || {};
  if (agent.queueReady === true) return { tone: 'good', label: 'Green · ready' };
  if (status.state === 'busy') return { tone: 'busy', label: 'Blue · working' };
  if (status.state === 'waiting') return { tone: 'warn', label: 'Orange · needs input' };
  if (status.tone === 'bad') return { tone: 'bad', label: 'Red · inspect' };
  return { tone: 'neutral', label: status.state ? `Gray · ${status.state}` : 'Gray · unavailable' };
}

function promptQueueAwaitingFinish(item) {
  return item.status === 'sent' && item.summaryState === 'pending';
}

function promptQueueFinished(item) {
  return item.status === 'sent' && ['captured', 'returned', 'operator_confirmed', 'operator_released'].includes(item.summaryState);
}

function promptQueueTerminalBoard(agents, items) {
  const targets = promptQueueTargets(agents);
  const selectedSessions = preferredPromptQueueSessions(targets);
  const selected = new Set(selectedSessions);
  const mobileSingleChoice = !promptQueueMultipleAllowed(isPhoneLayoutMode(), state.promptQueueMultiSelect);
  state.promptQueueDraft.sessions = selectedSessions;
  state.promptQueueDraft.session = selectedSessions[0] || '';
  const openItems = items.filter((item) => ['queued', 'dispatching', 'needs_review'].includes(item.status) || promptQueueAwaitingFinish(item));
  const waitingQueueCount = openItems.filter((item) => item.status === 'queued').length;
  const finishingCount = openItems.filter(promptQueueAwaitingFinish).length;
  const readyCount = targets.filter((agent) => agent.queueReady === true).length;
  const workingCount = targets.filter((agent) => agent.agentStatus?.state === 'busy').length;
  const attentionCount = targets.filter((agent) => agent.agentStatus?.state === 'waiting' || agent.agentStatus?.tone === 'bad').length;
  return `
    <section class="prompt-target-board" aria-labelledby="prompt-target-board-title">
      <div class="prompt-target-board-head">
        <div><span class="eyebrow">Live terminal board</span><h3 id="prompt-target-board-title">${mobileSingleChoice ? 'Pick one terminal' : 'Pick one or more terminals'}</h3><p>${mobileSingleChoice ? 'Tap another agent to switch immediately. Use Select multiple only for fan-out.' : "Every selected card is one exact tmux pane. Queue delivery still uses each terminal's independent readiness gate."}</p></div>
        <div class="prompt-target-metrics" aria-label="Terminal readiness summary">
          <span class="selected"><strong>${selectedSessions.length}</strong> selected</span>
          <span class="good"><strong>${readyCount}</strong> ready</span>
          <span class="busy"><strong>${workingCount}</strong> working</span>
          <span class="warn"><strong>${attentionCount}</strong> needs input</span>
          <span><strong>${waitingQueueCount}</strong> waiting</span>
          <span class="busy"><strong>${finishingCount}</strong> finishing</span>
        </div>
      </div>
      ${targets.length ? `
        <label class="prompt-target-mobile-picker ${state.promptQueueMultiSelect ? 'hidden' : ''}">
          <span>Send this prompt to</span>
          <select class="prompt-target-mobile-select" aria-label="Choose the agent that receives this prompt">
            ${targets.map((agent) => {
              const signal = promptQueueAgentSignal(agent);
              return `<option value="${escapeHtml(agent.session)}" ${selected.has(agent.session) ? 'selected' : ''}>${escapeHtml(displayNameForSession(agent.session))} · ${escapeHtml(signal.label)}</option>`;
            }).join('')}
          </select>
        </label>
      ` : ''}
      <div class="prompt-target-grid">
        ${targets.length ? targets.map((agent) => {
          const signal = promptQueueAgentSignal(agent);
          const line = openItems.filter((item) => item.session === agent.session);
          const next = line.find(promptQueueAwaitingFinish) || line.find((item) => item.status === 'needs_review') || line.find((item) => ['dispatching', 'queued'].includes(item.status));
          const active = line.filter((item) => item.status === 'dispatching' || promptQueueAwaitingFinish(item)).length;
          const blocked = line.filter((item) => item.status === 'needs_review').length;
          const waiting = line.filter((item) => item.status === 'queued').length;
          const lineSummary = blocked
            ? `Blocked · ${waiting} waiting`
            : active
              ? `${active} active · ${waiting} waiting`
              : waiting
                ? `${waiting} waiting`
                : 'Queue empty';
          const isSelected = selected.has(agent.session);
          return `
            <button class="prompt-target-card ${escapeHtml(signal.tone)} ${isSelected ? 'selected' : ''}" data-action="prompt-queue-select-target" data-session="${escapeHtml(agent.session)}" type="button" aria-pressed="${isSelected ? 'true' : 'false'}">
              <span class="prompt-target-card-head"><span class="prompt-target-dot" aria-hidden="true"></span><strong>${escapeHtml(displayNameForSession(agent.session))}</strong><em>${escapeHtml(signal.label)}</em></span>
              <span class="prompt-target-session">tmux ${escapeHtml(agent.session)} · ${escapeHtml(shortPath(agent.currentPath))}</span>
              <span class="prompt-target-reason">${escapeHtml(agent.agentStatus?.reason || 'No live state available')}</span>
              <span class="prompt-target-foot"><b>${escapeHtml(lineSummary)}</b><small>${next ? `Line head #${Number(next.linePosition || 1)}` : isSelected ? 'Selected' : mobileSingleChoice ? 'Tap to switch' : 'Tap to add'}</small></span>
            </button>
          `;
        }).join('') : '<div class="prompt-target-empty">No exact live Codex terminals are available.</div>'}
      </div>
      ${targets.length > 1 ? `
        <div class="prompt-target-bulk-actions">
          <span>${selectedSessions.length} of ${targets.length} selected</span>
          <div class="prompt-target-desktop-actions"><button class="action-button" data-action="prompt-queue-select-all" type="button" ${selectedSessions.length === targets.length ? 'disabled' : ''}>Select all live</button></div>
          <div class="prompt-target-mobile-actions">
            <button class="action-button" data-action="prompt-queue-mobile-multi" type="button" aria-pressed="${state.promptQueueMultiSelect ? 'true' : 'false'}">${state.promptQueueMultiSelect ? 'Done selecting' : 'Select multiple'}</button>
            ${state.promptQueueMultiSelect ? `<button class="action-button" data-action="prompt-queue-select-all" type="button" ${selectedSessions.length === targets.length ? 'disabled' : ''}>Select all</button>` : ''}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function promptQueueStateLabel(item) {
  if (item.status === 'dispatching') return 'Sending now';
  if (item.status === 'needs_review' && item.deliveryStage === 'literal_confirmation') return 'Pre-Enter delivery needs review';
  if (item.status === 'needs_review' && item.deliveryStage === 'waiting_for_manual_submit') return 'Waiting for manual submit';
  if (item.status === 'needs_review' && item.deliveryStage === 'final_boundary_missing') return 'Final response missing';
  if (item.status === 'needs_review' && item.deliveryStage === 'completion_marker_missing') return 'Capture boundary expired';
  if (item.status === 'needs_review' && item.deliveryStage === 'goal_completion_review') return 'Goal completion needs review';
  if (item.status === 'needs_review' && item.deliveryStage === 'completion_superseded') return 'Newer activity detected';
  if (item.status === 'needs_review' && item.deliveryStage === 'completion_timeout') return 'Completion timed out';
  if (item.status === 'needs_review' && item.deliveryStage === 'completion_target_replaced') return 'Terminal replaced';
  if (item.status === 'needs_review') return 'Inspect terminal';
  if (promptQueueAwaitingFinish(item) && item.target?.green) return 'Green · verifying return';
  if (promptQueueAwaitingFinish(item) && item.target?.state === 'busy') return 'Blue · agent working';
  if (promptQueueAwaitingFinish(item) && item.target?.state === 'waiting') return 'Orange · agent needs input';
  if (promptQueueAwaitingFinish(item) && item.target?.tone === 'bad') return 'Red · inspect agent';
  if (promptQueueAwaitingFinish(item)) return 'Waiting for turn to finish';
  if (item.status === 'sent') return 'Sent';
  if (item.status === 'canceled') return 'Canceled';
  if (item.target?.green) return 'Green confirmed once';
  if (!item.target?.identityMatches) return 'Exact terminal unavailable';
  if (item.target?.state === 'busy') return 'Blue · working';
  if (item.target?.state === 'waiting') return 'Waiting for input';
  return `Waiting · ${item.target?.state || 'unknown'}`;
}

function promptQueueTone(item) {
  if (item.status === 'needs_review' && item.deliveryStage === 'waiting_for_manual_submit') return 'warn';
  if (item.status === 'needs_review') return 'bad';
  if (item.status === 'dispatching') return 'busy';
  if (promptQueueAwaitingFinish(item) && item.target?.green) return 'good';
  if (promptQueueAwaitingFinish(item)) return item.target?.tone === 'bad' ? 'bad' : item.target?.state === 'waiting' ? 'warn' : 'busy';
  if (item.status === 'sent') return 'good';
  if (item.status === 'canceled') return 'warn';
  if (item.target?.green) return 'good';
  return item.target?.tone || 'neutral';
}

function promptQueueDurationLabel(value) {
  const milliseconds = Number(value || 0);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'unknown';
  if (milliseconds < 60_000) return `${Math.max(1, Math.round(milliseconds / 1000))}s`;
  if (milliseconds < 60 * 60_000) return `${Math.round(milliseconds / 60_000)}m`;
  return `${(milliseconds / (60 * 60_000)).toFixed(milliseconds < 10 * 60 * 60_000 ? 1 : 0)}h`;
}

function promptTicketUsageLabel(ticketUsage) {
  const total = Number(ticketUsage?.tokens?.totalTokens);
  if (!Number.isFinite(total) || total < 0) return '';
  const state = ticketUsage.state === 'complete'
    ? 'complete ticket'
    : ticketUsage.state === 'in_progress'
      ? 'so far'
      : ticketUsage.state === 'review'
        ? 'bounded at review'
        : 'unverified boundary';
  return `${formatTokenCount(total)} tokens ${state}`;
}

function promptQueueStats(data) {
  const items = data.items || [];
  const waitingNow = items.filter((item) => item.status === 'queued').length;
  const finishingNow = items.filter(promptQueueAwaitingFinish).length;
  const delivered = items.filter((item) => item.status === 'sent');
  const finished = delivered.filter(promptQueueFinished);
  const finishedToday = finished.filter((item) => {
    const finished = new Date(item.completedAt || item.updatedAt || 0);
    return !Number.isNaN(finished.getTime()) && finished.toDateString() === new Date().toDateString();
  }).length;
  const waits = delivered
    .map((item) => timestampMs(item.sentAt) - timestampMs(item.createdAt))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageWait = waits.length ? waits.reduce((sum, value) => sum + value, 0) / waits.length : null;
  const lastFinished = finished[0]?.completedAt || finished[0]?.updatedAt || null;
  const verified = finished.filter((item) => item.summaryState === 'captured').length;
  const returned = finished.filter((item) => item.summaryState === 'returned').length;
  return `
    <section class="prompt-queue-stats" aria-label="Prompt queue statistics">
      ${digestMetric('Waiting now', waitingNow, 'not yet sent', waitingNow ? 'busy' : 'good')}
      ${digestMetric('Finishing now', finishingNow, 'accepted turns awaiting capture', finishingNow ? 'busy' : 'good')}
      ${digestMetric('Finished turns', finished.length, `${verified} footer verified · ${returned} safely returned`, finished.length ? 'good' : 'neutral')}
      ${digestMetric('Finished today', finishedToday, lastFinished ? `last ${missionTimeLabel(lastFinished)}` : 'none yet', finishedToday ? 'good' : 'neutral')}
      ${digestMetric('Average queue wait', averageWait == null ? '—' : promptQueueDurationLabel(averageWait), 'queued to accepted delivery', 'neutral')}
      ${digestMetric('Needs review', Number(data.counts?.needsReview || 0), 'never automatically retried', Number(data.counts?.needsReview || 0) ? 'bad' : 'good')}
    </section>
  `;
}

function promptQueueHistoryRow(item) {
  const delivered = item.status === 'sent';
  const finishedAt = item.completedAt || item.sentAt || item.updatedAt;
  const elapsed = timestampMs(item.sentAt || item.updatedAt) - timestampMs(item.createdAt);
  const exactTerminalAvailable = item.target?.identityMatches === true;
  const summaryState = item.summaryState || 'unavailable';
  const finished = promptQueueFinished(item);
  const origin = promptHistoryOrigin(item);
  const manualIdeaImport = state.snapshot?.capabilities?.promptQueueManualIdeaImport === true
    ? promptQueueManualIdeaImportPresentation(item)
    : null;
  const originLabel = origin === 'automated' ? 'Automated' : 'I wrote';
  const finishLabel = summaryState === 'captured'
    ? 'Verified final response'
    : summaryState === 'returned'
      ? 'Returned to ready · no footer'
    : summaryState === 'command_submitted'
      ? 'Slash command submitted'
    : summaryState === 'operator_confirmed'
      ? 'Operator confirmed after review'
      : summaryState === 'operator_released'
        ? 'Operator released after review'
      : 'Final snapshot unavailable';
  const finishSnapshot = item.completionSnapshot || item.completionSummary || (summaryState === 'pending'
    ? 'Waiting for this exact terminal to return stably ready.'
    : 'Final terminal snapshot was not captured for this earlier delivery.');
  const historyStateLabel = !delivered
    ? 'Canceled'
    : !finished
      ? 'Delivered'
      : summaryState === 'returned'
        ? 'Returned'
        : summaryState === 'operator_released'
          ? 'Released'
          : 'Finished';
  return `
    <article class="prompt-history-row ${delivered ? 'good' : 'warn'}" data-prompt-queue-id="${escapeHtml(item.id)}">
      <div class="prompt-history-state"><span aria-hidden="true">${delivered ? '✓' : '—'}</span><strong>${historyStateLabel}</strong></div>
      <div class="prompt-history-copy">
        <div class="prompt-history-title"><h3>${escapeHtml(item.target?.displayName || displayNameForSession(item.session))}</h3><span class="prompt-history-origin ${escapeHtml(origin)}">${originLabel}</span></div>
        <p class="prompt-history-request"><b>Prompt</b> ${escapeHtml(item.text)}</p>
        ${delivered ? `<div class="prompt-history-finish ${escapeHtml(summaryState)}"><strong>${escapeHtml(finishLabel)}</strong><pre>${escapeHtml(finishSnapshot)}</pre></div>` : ''}
      </div>
      <div class="prompt-history-meta"><strong>${escapeHtml(missionTimeLabel(finishedAt))}</strong><small>${delivered ? `waited ${promptQueueDurationLabel(elapsed)}` : 'no terminal input'}</small>${item.ticketUsage ? `<small>${escapeHtml(promptTicketUsageLabel(item.ticketUsage))}</small>` : ''}</div>
      <div class="mission-actions">
        ${exactTerminalAvailable ? `<button class="action-button" data-action="prompt-queue-open-agent" data-session="${escapeHtml(item.session)}" data-pane-id="${escapeHtml(item.paneId)}" type="button">Open terminal</button>` : '<span class="prompt-history-unavailable">Previous terminal</span>'}
        ${manualIdeaImport && exactTerminalAvailable ? `<button class="action-button good" data-action="prompt-queue-import-visible-ideas" data-prompt-queue-id="${escapeHtml(item.id)}" type="button">${manualIdeaImport.label}</button>` : ''}
      </div>
    </article>
  `;
}

function promptQueueHistory(items, queueRevision) {
  const allFinished = items.filter(promptQueueFinished);
  const mineCount = allFinished.filter((item) => promptHistoryOrigin(item) === 'mine').length;
  const automatedCount = allFinished.length - mineCount;
  const originFinished = filterPromptHistory(allFinished, state.promptHistoryOriginFilter);
  const finished = filterPromptHistory(allFinished, state.promptHistoryOriginFilter, state.promptHistoryQuery);
  const visibleFinished = finished.slice(0, 12);
  const olderFinished = finished.slice(12);
  const unconfirmed = items.filter((item) => item.status === 'sent' && !promptQueueAwaitingFinish(item) && !promptQueueFinished(item));
  const canceled = items.filter((item) => item.status === 'canceled');
  const historyCount = allFinished.length + unconfirmed.length + canceled.length;
  const emptyTitle = state.promptHistoryQuery
    ? 'No finished turns match this search.'
    : state.promptHistoryOriginFilter === 'automated'
    ? 'No automated turns have finished yet.'
    : state.promptHistoryOriginFilter === 'mine'
      ? 'No prompts you wrote have finished yet.'
      : 'No finished turns yet.';
  const countLabel = state.promptHistoryQuery
    ? `${finished.length}/${originFinished.length}`
    : state.promptHistoryOriginFilter === 'all'
      ? String(allFinished.length)
      : `${originFinished.length}/${allFinished.length}`;
  return `
    <section id="prompt-queue-history" class="prompt-queue-history" aria-labelledby="prompt-queue-history-title" tabindex="-1">
      <div class="prompt-queue-history-head">
        <div><span class="eyebrow">Retained history</span><h2 id="prompt-queue-history-title">Finished queue turns</h2><p>A turn can have a verified footer, a safely bounded return to ready, or an operator release. This records terminal flow; it never claims the underlying project task is Done.</p></div>
        <div class="prompt-queue-history-actions">
          <strong title="${finished.length} shown of ${originFinished.length} in this origin · ${allFinished.length} total">${countLabel}</strong>
          ${historyCount ? `<button class="action-button danger" data-action="prompt-queue-clear-history" data-revision="${Number(queueRevision || 0)}" type="button">Clear history</button>` : ''}
        </div>
      </div>
      <div class="prompt-history-toolbar">
        <div class="prompt-history-filter-bar" role="group" aria-label="Filter finished prompts by origin">
          <button class="prompt-history-origin-filter ${state.promptHistoryOriginFilter === 'all' ? 'active' : ''}" data-action="prompt-history-origin" data-origin="all" type="button" aria-pressed="${state.promptHistoryOriginFilter === 'all'}"><span>All</span><em>${allFinished.length}</em></button>
          <button class="prompt-history-origin-filter ${state.promptHistoryOriginFilter === 'mine' ? 'active' : ''}" data-action="prompt-history-origin" data-origin="mine" type="button" aria-pressed="${state.promptHistoryOriginFilter === 'mine'}"><span>I wrote</span><em>${mineCount}</em></button>
          <button class="prompt-history-origin-filter ${state.promptHistoryOriginFilter === 'automated' ? 'active' : ''}" data-action="prompt-history-origin" data-origin="automated" type="button" aria-pressed="${state.promptHistoryOriginFilter === 'automated'}"><span>Automated</span><em>${automatedCount}</em></button>
        </div>
        <form id="prompt-history-search-form" class="prompt-history-search-form" role="search">
          <label class="sr-only" for="prompt-history-search">Search finished prompts</label>
          <input id="prompt-history-search" name="query" type="search" maxlength="200" autocomplete="off" enterkeyhint="search" value="${escapeHtml(state.promptHistoryQuery)}" placeholder="Search terminal, prompt, or result">
          <button class="action-button" type="submit">Search</button>
          <button class="action-button ${state.promptHistoryQuery ? '' : 'hidden'}" data-action="prompt-history-search-clear" type="button">Clear</button>
        </form>
      </div>
      <div class="prompt-history-list">${visibleFinished.length ? visibleFinished.map(promptQueueHistoryRow).join('') : `<div class="prompt-history-empty"><strong>${emptyTitle}</strong><span>${state.promptHistoryQuery ? 'Try another term or clear search.' : 'Choose another origin or wait for a queued turn to finish.'}</span></div>`}</div>
      ${olderFinished.length ? `<details class="prompt-canceled-history" data-queue-detail="older" ${state.openPromptQueueDetails.has('older') ? 'open' : ''}><summary>${olderFinished.length} older finished turn${olderFinished.length === 1 ? '' : 's'}</summary><div class="prompt-history-list">${olderFinished.map(promptQueueHistoryRow).join('')}</div></details>` : ''}
      ${unconfirmed.length ? `<details class="prompt-canceled-history" data-queue-detail="unconfirmed" ${state.openPromptQueueDetails.has('unconfirmed') ? 'open' : ''}><summary>${unconfirmed.length} delivered without a confirmed final response</summary><div class="prompt-history-list">${unconfirmed.map(promptQueueHistoryRow).join('')}</div></details>` : ''}
      ${canceled.length ? `<details class="prompt-canceled-history" data-queue-detail="canceled" ${state.openPromptQueueDetails.has('canceled') ? 'open' : ''}><summary>${canceled.length} canceled prompt${canceled.length === 1 ? '' : 's'}</summary><div class="prompt-history-list">${canceled.map(promptQueueHistoryRow).join('')}</div></details>` : ''}
    </section>
  `;
}

function setPromptHistoryOriginFilter(filter) {
  const next = ['all', 'mine', 'automated'].includes(filter) ? filter : 'all';
  state.promptHistoryOriginFilter = next;
  safeStorageSet(PROMPT_HISTORY_ORIGIN_STORAGE_KEY, next);
  render();
  window.requestAnimationFrame(() => {
    document.querySelector(`[data-action="prompt-history-origin"][data-origin="${next}"]`)?.focus({ preventScroll: true });
  });
}

function setPromptHistoryQuery(value) {
  state.promptHistoryQuery = String(value || '').slice(0, 200);
  render();
  window.requestAnimationFrame(() => {
    const input = document.querySelector('#prompt-history-search');
    input?.focus({ preventScroll: true });
    input?.select();
  });
}

const TICKET_REFINER_LABELS = Object.freeze({
  outcome: 'Outcome',
  context: 'Context',
  scope: 'Scope',
  nonGoals: 'Non-goals',
  verification: 'Verification',
  safety: 'Safety and risks'
});

function ticketRefinerCurrentTargets(selectedTargets) {
  return (Array.isArray(selectedTargets) ? selectedTargets : []).map(multiPromptTargetPayload);
}

function ticketRefinerTargetNames(refiner) {
  return refiner.targetBindings
    .map((identity) => displayNameForSession(identity.session))
    .join(' · ');
}

function ticketRefinerReadinessMarkup(readiness) {
  return Object.entries(TICKET_REFINER_LABELS).map(([name, label]) => {
    const present = readiness.present.includes(name);
    return `<span class="ticket-refiner-check ${present ? 'present' : 'missing'}">${present ? '✓' : '○'} ${escapeHtml(label)}</span>`;
  }).join('');
}

function ticketRefinerPanel(selectedTargets) {
  const refiner = normalizedTicketRefinerState(state.ticketRefiner);
  if (!refiner.open && !refiner.applied) return '';
  const targetMatch = ticketRefinerTargetMatch(refiner, ticketRefinerCurrentTargets(selectedTargets));
  const targetName = ticketRefinerTargetNames(refiner) || 'Unavailable terminal';
  if (refiner.applied && !refiner.open) {
    return `
      <section class="ticket-refiner-panel ticket-refiner-applied ${targetMatch.ok ? '' : 'stale'}" aria-label="Applied Ticket Refiner draft">
        <div>
          <span class="eyebrow">Refined draft</span>
          <strong>${targetMatch.ok ? `Bound to ${escapeHtml(targetName)}` : 'Target changed — dispatch is blocked'}</strong>
          <p>${targetMatch.ok ? 'The queue text was replaced only after your review. Sending remains a separate action.' : 'The selected or live pane no longer matches the exact terminal used during refinement.'}</p>
        </div>
        <div class="ticket-refiner-actions">
          <button class="action-button" data-action="ticket-refiner-open" type="button">${targetMatch.ok ? 'Review refinement' : 'Refine for current target'}</button>
          <button class="action-button" data-action="ticket-refiner-keep-original" type="button">Keep original</button>
        </div>
      </section>
    `;
  }
  const preview = ticketRefinerPreview(refiner);
  const readiness = preview.readiness;
  const outcome = refiner.fields.outcome;
  const useDisabled = !targetMatch.ok || !preview.text.trim() || preview.tooLong;
  return `
    <section id="ticket-refiner-panel" class="ticket-refiner-panel ${targetMatch.ok ? '' : 'stale'}" aria-labelledby="ticket-refiner-title">
      <div class="ticket-refiner-head">
        <div>
          <span class="eyebrow">Local drafting guide</span>
          <h3 id="ticket-refiner-title">Ticket Refiner</h3>
          <p>Nothing is sent while you refine. PaneFleet structures only what you enter and never invents missing facts.</p>
        </div>
        <strong>${targetMatch.ok ? `Bound to ${escapeHtml(targetName)}` : 'Exact target changed'}</strong>
      </div>
      <div class="ticket-refiner-original">
        <span>Original request · always recoverable</span>
        <pre>${escapeHtml(refiner.originalText)}</pre>
      </div>
      <div class="ticket-refiner-readiness" role="status" aria-live="polite">
        <strong>${readiness.ready ? 'Ready for review' : `${readiness.score}/${readiness.total} readiness signals`}</strong>
        <div>${ticketRefinerReadinessMarkup(readiness)}</div>
      </div>
      <div class="ticket-refiner-fields">
        <label>Outcome
          <textarea name="refinerOutcome" rows="2" maxlength="600" placeholder="What should be true when this is finished?">${escapeHtml(outcome)}</textarea>
        </label>
        <label>Context
          <textarea name="refinerContext" rows="2" maxlength="600" placeholder="What current behavior or evidence matters?">${escapeHtml(refiner.fields.context)}</textarea>
        </label>
        <label>Scope
          <textarea name="refinerScope" rows="3" maxlength="800" placeholder="What bounded work belongs in this ticket?">${escapeHtml(refiner.fields.scope)}</textarea>
        </label>
        <label>Non-goals
          <textarea name="refinerNonGoals" rows="2" maxlength="500" placeholder="What must remain unchanged or out of scope?">${escapeHtml(refiner.fields.nonGoals)}</textarea>
        </label>
        <label>Verification
          <textarea name="refinerVerification" rows="2" maxlength="600" placeholder="What evidence proves the outcome?">${escapeHtml(refiner.fields.verification)}</textarea>
        </label>
        <label>Safety and risks
          <textarea name="refinerSafety" rows="2" maxlength="500" placeholder="What could go wrong, and what requires approval?">${escapeHtml(refiner.fields.safety)}</textarea>
        </label>
      </div>
      <label class="ticket-refiner-preview">Editable refined preview
        <textarea name="refinerPreview" rows="9" maxlength="4000" aria-describedby="ticket-refiner-preview-note">${escapeHtml(preview.text)}</textarea>
        <small id="ticket-refiner-preview-note"><span class="ticket-refiner-preview-count">${preview.count}/4000</span> · Editing this preview never changes the original.</small>
      </label>
      ${targetMatch.ok ? '' : '<p class="ticket-refiner-blocker" role="alert">This refinement is stale. Keep the original or explicitly start a new refinement for the currently selected exact terminal.</p>'}
      ${preview.tooLong ? '<p class="ticket-refiner-blocker" role="alert">The structured preview exceeds 4000 characters. Shorten a section before using it.</p>' : ''}
      <div class="ticket-refiner-footer">
        <span>Using either choice changes only this browser draft. Queue and Send now remain separate.</span>
        <div class="ticket-refiner-actions">
          ${targetMatch.ok ? '' : '<button class="action-button" data-action="ticket-refiner-open" type="button">Start again for current target</button>'}
          <button class="action-button" data-action="ticket-refiner-keep-original" type="button">Keep original</button>
          <button class="primary-button" data-action="ticket-refiner-use" type="button" ${useDisabled ? 'disabled' : ''}>Use refined draft</button>
        </div>
      </div>
    </section>
  `;
}

function promptQueueComposer(agents) {
  const targets = promptQueueTargets(agents);
  const selectedSessions = preferredPromptQueueSessions(targets);
  const selectedTargets = targets.filter((agent) => selectedSessions.includes(agent.session));
  state.promptQueueDraft.sessions = selectedSessions;
  state.promptQueueDraft.session = selectedSessions[0] || '';
  const presentation = promptQueueComposerPresentation(state.promptQueueDraft, targets.length > 0);
  const undoAvailable = Boolean(state.promptQueueDraftUndo);
  const draftStatus = presentation.hasDraft ? 'Saved in this browser' : undoAvailable ? 'Draft cleared' : 'Draft stays in this browser';
  const refinerOpen = state.ticketRefiner.open === true;
  const unsafeText = presentation.unsafeCharacterCount > 0;
  return `
    <form id="prompt-queue-form" class="prompt-queue-form">
      <div class="prompt-queue-selected-targets" aria-live="polite">
        <span>Selected terminals</span>
        <strong>${selectedTargets.length ? `${selectedTargets.length} exact agent${selectedTargets.length === 1 ? '' : 's'}` : 'None available'}</strong>
        <p>${selectedTargets.length ? selectedTargets.map((agent) => escapeHtml(displayNameForSession(agent.session))).join(' · ') : 'Choose live terminals from the board above.'}</p>
      </div>
      <div class="prompt-queue-text-field">
        <label for="prompt-queue-text">
          <span class="prompt-queue-label-row"><span>Prompt</span><span class="prompt-queue-input-meta"><kbd aria-hidden="true">Ctrl/⌘ Enter</kbd><em class="prompt-queue-counter" data-full="${presentation.full}" aria-label="${state.promptQueueDraft.text.length} of 4000 characters used">${presentation.count}</em></span></span>
          <textarea id="prompt-queue-text" name="text" rows="5" maxlength="4000" required aria-keyshortcuts="Control+Enter Meta+Enter" aria-describedby="prompt-queue-text-safety" aria-invalid="${unsafeText ? 'true' : 'false'}" placeholder="This will wait for the exact terminal to turn green.">${escapeHtml(state.promptQueueDraft.text)}</textarea>
        </label>
        <div id="prompt-queue-text-safety" class="prompt-queue-text-safety ${unsafeText ? '' : 'hidden'}" role="status" aria-live="assertive">
          <span>${unsafeText ? `Blocked: found ${presentation.unsafeCharacterCount} hidden or control character${presentation.unsafeCharacterCount === 1 ? '' : 's'}. Review the source or remove them before adding this prompt.` : ''}</span>
          <button class="action-button" data-action="prompt-queue-remove-hidden" type="button">Remove hidden characters</button>
        </div>
      </div>
      <label class="prompt-queue-schedule-field">Repeat schedule <span>optional · UTC</span>
        <input name="cron" maxlength="80" list="prompt-cron-presets" inputmode="text" autocomplete="off" placeholder="0 * * * *  (every hour)" value="${escapeHtml(state.promptQueueDraft.cron || '')}">
        <small>${selectedTargets.length > 1 ? 'Recurring schedules require exactly one terminal. Clear this field to use multiple agents.' : 'Five fields: minute, hour, day, month, weekday. Leave empty to queue once.'}</small>
        <datalist id="prompt-cron-presets">
          <option value="*/15 * * * *">Every 15 minutes</option>
          <option value="0 * * * *">Every hour</option>
          <option value="0 */4 * * *">Every 4 hours</option>
          <option value="0 9 * * *">Daily at 09:00 UTC</option>
          <option value="0 9 * * 1-5">Weekdays at 09:00 UTC</option>
        </datalist>
      </label>
      <div class="prompt-queue-draft-row">
        <strong class="prompt-queue-draft-state ${presentation.hasDraft ? 'has-draft' : ''}" role="status">${draftStatus}</strong>
        <div class="prompt-queue-draft-actions">
          <button class="action-button" data-action="ticket-refiner-open" type="button" ${!presentation.hasDraft || !selectedTargets.length || refinerOpen || unsafeText ? 'disabled' : ''}>Refine ticket</button>
          <button class="action-button ${presentation.hasDraft ? '' : 'hidden'}" data-action="prompt-queue-draft-clear" type="button">Clear draft</button>
          <button class="action-button ${undoAvailable ? '' : 'hidden'}" data-action="prompt-queue-draft-undo" type="button">Undo clear</button>
        </div>
      </div>
      ${ticketRefinerPanel(selectedTargets)}
      <div class="prompt-queue-form-actions">
        <span>Queue creates one independent FIFO item per terminal · Send now cannot be rolled back · neither mode retries uncertain input</span>
        <div class="prompt-queue-submit-actions">
          <button class="action-button" name="mode" value="send" type="submit" ${presentation.sendDisabled || refinerOpen ? 'disabled' : ''}>${presentation.sendLabel}</button>
          <button class="primary-button" name="mode" value="queue" type="submit" ${presentation.disabled || refinerOpen ? 'disabled' : ''}>${presentation.label}</button>
        </div>
      </div>
    </form>
  `;
}

function promptScheduleTimeLabel(value) {
  const time = timestampMs(value);
  if (!time) return 'unknown';
  const delta = time - Date.now();
  if (delta <= 0) return 'due now';
  if (delta < 60 * 60_000) return `in ${Math.max(1, Math.ceil(delta / 60_000))}m`;
  if (delta < 24 * 60 * 60_000) return `in ${Math.ceil(delta / (60 * 60_000))}h`;
  return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function promptScheduleAbsoluteLabel(value) {
  const time = timestampMs(value);
  if (!time) return 'Unknown';
  const date = new Date(time);
  const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  const local = date.toLocaleString([], options);
  const utc = date.toLocaleString([], { ...options, timeZone: 'UTC' });
  return local === utc ? utc : `${local} · ${utc}`;
}

function promptScheduleOutcomeLabel(value) {
  return ({
    queued: 'Added to queue',
    coalesced_existing_pending: 'Skipped duplicate',
    skipped_target_unavailable: 'Exact terminal unavailable',
    skipped_queue_full: 'Queue was full',
    skipped_text_too_long: 'Prompt exceeds safe limit'
  })[value] || (value ? String(value).replaceAll('_', ' ') : 'Not run yet');
}

function promptScheduleErrorLabel(error) {
  return ({
    prompt_schedule_cron_invalid: 'Use five UTC cron fields, for example 0 * * * * for hourly.',
    prompt_schedule_has_no_run: 'That calendar combination can never run.',
    prompt_schedule_duplicate: 'An identical recurring schedule already exists. Review or resume that schedule instead.',
    prompt_schedule_target_missing_or_replaced: 'The selected exact terminal was replaced or closed. Select its current card and try again.',
    prompt_schedule_limit_reached: 'The recurring prompt limit has been reached. Delete an unused schedule first.',
    prompt_schedule_revision_conflict: 'This schedule changed in another window. The Queue page has been refreshed.',
    prompt_schedule_queue_now_confirmation_required: 'PaneFleet rejected an incomplete Queue now request.',
    prompt_queue_limit_reached: 'The prompt queue is full. Finish or clear older work before adding another occurrence.'
  })[error?.message] || error?.message || 'Unknown schedule error';
}

function replacementAgentForSession(session) {
  return (state.snapshot?.agents || []).find((agent) => (
    agent.session === session && agent.canSend && !isReviewAgent(agent)
  )) || null;
}

function promptScheduleCard(schedule, items = []) {
  const available = schedule.target?.identityMatches === true;
  const replacement = available ? null : replacementAgentForSession(schedule.session);
  const tone = !available ? 'bad' : schedule.enabled ? 'good' : 'neutral';
  const openOccurrence = items.find((item) => item.scheduleId === schedule.id && (
    ['queued', 'dispatching', 'needs_review'].includes(item.status) || promptQueueAwaitingFinish(item)
  ));
  const nextRunTitle = promptScheduleAbsoluteLabel(schedule.nextRunAt);
  return `
    <article class="prompt-schedule-card ${escapeHtml(tone)}" data-prompt-schedule-id="${escapeHtml(schedule.id)}">
      <div class="prompt-schedule-card-head">
        <div><span class="eyebrow">${schedule.enabled ? 'Active schedule' : 'Paused schedule'}</span><h3>${escapeHtml(schedule.target?.displayName || displayNameForSession(schedule.session))}</h3></div>
        <span class="status ${escapeHtml(tone)}">${available ? (schedule.enabled ? 'Scheduled' : 'Paused') : 'Retarget required'}</span>
      </div>
      <code class="prompt-schedule-cron">${escapeHtml(schedule.cron)} <small>UTC</small></code>
      <p class="prompt-schedule-text">${escapeHtml(schedule.text)}</p>
      <div class="prompt-schedule-facts">
        <span><b>Next</b> ${schedule.enabled ? escapeHtml(promptScheduleTimeLabel(schedule.nextRunAt)) : 'paused'}<small>${escapeHtml(nextRunTitle)}</small></span>
        <span><b>Occurrences</b> ${Number(schedule.occurrenceCount || 0)}<small>${schedule.lastRunAt ? `last ${escapeHtml(missionTimeLabel(schedule.lastRunAt))}` : 'not run yet'}</small></span>
        <span><b>Queued</b> ${Number(schedule.runCount || 0)}<small>${escapeHtml(promptScheduleOutcomeLabel(schedule.lastOutcome))}</small></span>
        <span><b>Coalesced</b> ${Number(schedule.coalescedCount || 0)}<small>${Number(schedule.skippedCount || 0)} skipped for other reasons</small></span>
      </div>
      ${openOccurrence ? `<p class="prompt-schedule-pending ${openOccurrence.status === 'needs_review' ? 'warn' : ''}"><strong>${openOccurrence.status === 'needs_review' ? 'Scheduled occurrence needs review' : 'One occurrence is already in the queue'}</strong><span>Line #${Number(openOccurrence.linePosition || 1)} · later occurrences coalesce until this one finishes or is reviewed.</span></p>` : ''}
      ${available ? '' : '<p class="mission-alert">This exact tmux pane was replaced or closed. Occurrences will be skipped, never retargeted.</p>'}
      <div class="mission-actions prompt-schedule-actions">
        ${available ? `<button class="action-button" data-action="prompt-queue-open-agent" data-session="${escapeHtml(schedule.session)}" data-pane-id="${escapeHtml(schedule.paneId)}" type="button">Open terminal</button>` : ''}
        <button class="action-button good" data-action="prompt-schedule-queue-now" data-prompt-schedule-id="${escapeHtml(schedule.id)}" type="button" ${available && !openOccurrence ? '' : `disabled title="${available ? 'One occurrence is already open for this schedule' : 'Retarget this schedule before adding it to the queue'}"`}>Queue now</button>
        ${replacement ? `<button class="action-button good" data-action="prompt-schedule-retarget" data-prompt-schedule-id="${escapeHtml(schedule.id)}" type="button">Retarget current session</button>` : ''}
        <button class="action-button ${schedule.enabled ? 'warn' : ''}" data-action="prompt-schedule-toggle" data-prompt-schedule-id="${escapeHtml(schedule.id)}" type="button" ${available ? '' : 'disabled title="Retarget this schedule before resuming it"'}>${schedule.enabled ? 'Pause' : 'Resume'}</button>
        <button class="action-button danger" data-action="prompt-schedule-delete" data-prompt-schedule-id="${escapeHtml(schedule.id)}" type="button">Delete</button>
      </div>
    </article>
  `;
}

function promptScheduleDisplayOrder(left, right) {
  const enabledDelta = Number(right.enabled) - Number(left.enabled);
  if (enabledDelta) return enabledDelta;
  if (left.enabled && right.enabled) {
    const nextRunDelta = timestampMs(left.nextRunAt) - timestampMs(right.nextRunAt);
    if (nextRunDelta) return nextRunDelta;
  }
  return timestampMs(right.updatedAt) - timestampMs(left.updatedAt) || String(left.id).localeCompare(String(right.id));
}

function promptSchedulePanel(schedules, items = []) {
  const orderedSchedules = [...schedules].sort(promptScheduleDisplayOrder);
  const { active: activeSchedules, paused: pausedSchedules } = promptScheduleGroups(orderedSchedules);
  const pausedCollapsed = pausedSchedules.length > 0 && state.promptPausedSchedulesCollapsed;
  const scheduleContent = orderedSchedules.length
    ? `
      ${activeSchedules.length ? `<div class="prompt-schedule-grid prompt-schedule-active-grid">${activeSchedules.map((schedule) => promptScheduleCard(schedule, items)).join('')}</div>` : ''}
      ${pausedSchedules.length ? `
        <section class="prompt-schedule-paused ${pausedCollapsed ? 'is-collapsed' : ''}" aria-labelledby="prompt-schedule-paused-title">
          <div class="prompt-schedule-paused-head">
            <div><span class="eyebrow" id="prompt-schedule-paused-title">Paused schedules</span><p>Saved but inactive. Resume or delete them whenever you need them again.</p></div>
            <button class="action-button prompt-schedule-paused-toggle" data-action="prompt-schedule-paused-toggle" type="button" aria-expanded="${pausedCollapsed ? 'false' : 'true'}" aria-controls="prompt-schedule-paused-list">${pausedCollapsed ? 'Show' : 'Hide'} ${pausedSchedules.length} paused</button>
          </div>
          <div id="prompt-schedule-paused-list" class="prompt-schedule-grid prompt-schedule-paused-grid"${pausedCollapsed ? ' hidden' : ''}>${pausedSchedules.map((schedule) => promptScheduleCard(schedule, items)).join('')}</div>
        </section>
      ` : ''}
    `
    : '<div class="prompt-history-empty"><strong>No recurring prompts.</strong><span>Add a UTC cron expression in the composer to create one.</span></div>';
  return `
    <section id="prompt-queue-schedules" class="prompt-schedule-panel" aria-labelledby="prompt-schedule-title" tabindex="-1">
      <div class="prompt-queue-section-head prompt-schedule-panel-head">
        <div><span class="eyebrow">Automatic queue intake</span><h2 id="prompt-schedule-title">Recurring prompts</h2><p>A due schedule adds one ordinary prompt to its exact terminal line. If one is already pending, PaneFleet coalesces that occurrence.</p></div>
        <strong>${activeSchedules.length}</strong>
      </div>
      ${scheduleContent}
    </section>
  `;
}

function togglePausedPromptSchedules() {
  state.promptPausedSchedulesCollapsed = !state.promptPausedSchedulesCollapsed;
  safeStorageSet(
    PROMPT_PAUSED_SCHEDULES_COLLAPSED_STORAGE_KEY,
    state.promptPausedSchedulesCollapsed ? 'true' : 'false'
  );
  render();
  window.requestAnimationFrame(() => {
    document.querySelector('[data-action="prompt-schedule-paused-toggle"]')?.focus({ preventScroll: true });
  });
}

function promptQueueCard(item) {
  const cancel = promptQueueCancelPresentation(item);
  const dismissReview = state.snapshot?.capabilities?.promptQueueReviewDismissal === true
    ? promptQueueReviewDismissPresentation(item)
    : null;
  const manualSubmitWait = state.snapshot?.capabilities?.promptQueueManualSubmitWait === true
    ? promptQueueManualSubmitWaitPresentation(item)
    : null;
  const exactTerminalAvailable = item.target?.identityMatches === true;
  const replacement = exactTerminalAvailable ? null : replacementAgentForSession(item.session);
  const retargetable = item.status === 'queued' && Boolean(replacement);
  const replacementRequeue = state.snapshot?.capabilities?.promptQueueReplacementRequeue === true
    ? promptQueueReplacementRequeuePresentation(item, Boolean(replacement))
    : null;
  const releasable = item.status === 'needs_review' &&
    ['final_boundary_missing', 'completion_marker_missing', 'goal_completion_review', 'completion_superseded', 'completion_timeout'].includes(item.deliveryStage) &&
    exactTerminalAvailable;
  const monitorable = state.snapshot?.capabilities?.promptQueueContinueMonitoring === true &&
    item.status === 'needs_review' &&
    item.deliveryStage === 'completion_superseded' &&
    exactTerminalAvailable;
  const terminalControl = exactTerminalAvailable
    ? `<button class="action-button" data-action="prompt-queue-open-agent" data-session="${escapeHtml(item.session)}" data-pane-id="${escapeHtml(item.paneId)}" type="button">Open exact terminal</button>`
    : retargetable || replacementRequeue
      ? `<button class="action-button" data-action="prompt-queue-open-agent" data-session="${escapeHtml(item.session)}" data-pane-id="${escapeHtml(replacement.id)}" type="button">Open replacement</button>`
      : '<button class="action-button" type="button" disabled title="The exact terminal for this ticket was replaced or closed">Exact terminal unavailable</button>';
  return `
    <article class="mission-card ${escapeHtml(promptQueueTone(item))}" data-prompt-queue-id="${escapeHtml(item.id)}">
      <div class="mission-card-head">
        <div><h3>${escapeHtml(item.target?.displayName || displayNameForSession(item.session))}</h3><p>#${Number(item.linePosition || 1)} for this terminal · ${escapeHtml(missionTimeLabel(item.createdAt))}</p></div>
        <span class="status ${escapeHtml(promptQueueTone(item))}">${escapeHtml(promptQueueStateLabel(item))}</span>
      </div>
      <p class="prompt-queue-text">${escapeHtml(item.text)}</p>
      ${item.ticketUsage ? `<p class="prompt-ticket-usage">${escapeHtml(promptTicketUsageLabel(item.ticketUsage))} · ${escapeHtml(usageTokenDetail(item.ticketUsage.tokens))}</p>` : ''}
      ${item.blocker ? `<p class="mission-alert">${escapeHtml(item.blocker)}</p>` : ''}
      <div class="mission-actions">
        ${terminalControl}
        ${retargetable ? `<button class="action-button good" data-action="prompt-queue-retarget" data-prompt-queue-id="${escapeHtml(item.id)}" type="button">Retarget queued prompt</button>` : ''}
        ${replacementRequeue ? `<button class="action-button good" data-action="prompt-queue-requeue-replacement" data-prompt-queue-id="${escapeHtml(item.id)}" type="button">${replacementRequeue.label}</button>` : ''}
        ${monitorable ? `<button class="action-button good" data-action="prompt-queue-continue-monitoring" data-prompt-queue-id="${escapeHtml(item.id)}" data-revision="${item.revision}" type="button">Keep monitoring</button>` : ''}
        ${manualSubmitWait && exactTerminalAvailable ? `<button class="action-button good" data-action="prompt-queue-wait-manual-submit" data-prompt-queue-id="${escapeHtml(item.id)}" data-revision="${item.revision}" type="button">${manualSubmitWait.label}</button>` : ''}
        ${releasable ? `<button class="action-button good" data-action="prompt-queue-release" data-prompt-queue-id="${escapeHtml(item.id)}" data-revision="${item.revision}" type="button">Release queue</button>` : ''}
        ${dismissReview && exactTerminalAvailable ? `<button class="action-button ${dismissReview.tone}" data-action="prompt-queue-dismiss-review" data-prompt-queue-id="${escapeHtml(item.id)}" data-revision="${item.revision}" type="button">${dismissReview.label}</button>` : ''}
        ${cancel ? `<button class="action-button ${cancel.tone}" data-action="prompt-queue-cancel" data-prompt-queue-id="${escapeHtml(item.id)}" data-revision="${item.revision}" data-cancel-kind="${cancel.kind}" type="button">${cancel.label}</button>` : ''}
      </div>
    </article>
  `;
}

function promptQueueLane(title, detail, items) {
  if (!items.length) return '';
  return `
    <section class="mission-lane">
      <div class="mission-lane-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></div><strong>${items.length}</strong></div>
      <div class="mission-list">${items.map(promptQueueCard).join('')}</div>
    </section>
  `;
}

function captureScrollPositions(root, selectors) {
  return selectors.map((selector) => {
    const element = selector === ':root' ? root : root.querySelector(selector);
    return element ? { selector, left: element.scrollLeft, top: element.scrollTop } : null;
  }).filter(Boolean);
}

function restoreScrollPositions(root, positions) {
  for (const position of positions) {
    const element = position.selector === ':root' ? root : root.querySelector(position.selector);
    if (!element) continue;
    element.scrollLeft = position.left;
    element.scrollTop = position.top;
  }
}

function ideaQueueTarget(agents) {
  const targets = promptQueueTargets(agents);
  const session = preferredPromptQueueSessions(targets)[0] || '';
  return targets.find((agent) => agent.session === session) || null;
}

function ideaQueueStatusLabel(idea) {
  if (idea.status === 'refining') return 'With agent for refinement';
  if (idea.status === 'approved') return 'Approved · added to work';
  if (idea.status === 'rejected') return 'Cancelled';
  return idea.refinedAt ? 'Refined · awaiting approval' : 'Awaiting approval';
}

function ideaQueueCard(idea, target, items, agents) {
  const linkedPrompt = ideaQueueLinkedPrompt(idea, items);
  const active = ['proposed', 'refining'].includes(idea.status);
  const targets = promptQueueTargets(agents);
  const availableSessions = targets.map((candidate) => candidate.session);
  const workSession = ideaWorkTargetSession(idea, availableSessions, target?.session || '');
  const workTarget = targets.find((candidate) => candidate.session === workSession) || null;
  const refinementSession = ideaRefinementTargetSession(
    idea,
    availableSessions,
    target?.session || ''
  );
  const refinementTarget = targets.find((candidate) => candidate.session === refinementSession) || null;
  const source = idea.source === 'agent'
    ? `Proposed by ${displayNameForSession(idea.sourceSession)}`
    : 'Added by you';
  const targetLabel = workTarget
    ? displayNameForSession(workTarget.session)
    : idea.source === 'agent'
      ? 'Original project worker unavailable'
      : 'Select a live terminal';
  const refinementTargetLabel = refinementTarget
    ? displayNameForSession(refinementTarget.session)
    : idea.source === 'agent'
      ? 'Original project worker unavailable'
      : targetLabel;
  return `
    <article class="idea-card ${active ? 'active' : 'resolved'}" data-idea-id="${escapeHtml(idea.id)}">
      <div class="idea-card-head">
        <div><span class="eyebrow">${escapeHtml(source)}</span><h3>${escapeHtml(idea.title)}</h3></div>
        <span class="status ${idea.status === 'approved' ? 'good' : idea.status === 'rejected' ? 'neutral' : idea.status === 'refining' ? 'busy' : 'warn'}">${escapeHtml(ideaQueueStatusLabel(idea))}</span>
      </div>
      <p class="idea-details">${escapeHtml(idea.details)}</p>
      ${idea.refinementResult ? `<section class="idea-refinement"><strong>Agent refinement</strong><p>${escapeHtml(idea.refinementResult)}</p></section>` : ''}
      ${linkedPrompt ? `<p class="idea-linked-ticket">Linked ticket · ${escapeHtml(promptQueueStateLabel(linkedPrompt))}</p>` : ''}
      ${idea.status === 'proposed' ? `
        <div class="idea-card-actions">
          <span>Work: ${escapeHtml(targetLabel)} · Refine: ${escapeHtml(refinementTargetLabel)}</span>
          <button class="action-button good" data-action="idea-approve" data-idea-id="${escapeHtml(idea.id)}" data-target-session="${escapeHtml(workTarget?.session || '')}" type="button" ${workTarget ? '' : 'disabled'}>Approve to work queue</button>
          <button class="action-button" data-action="idea-refine" data-idea-id="${escapeHtml(idea.id)}" data-target-session="${escapeHtml(refinementTarget?.session || '')}" type="button" ${refinementTarget ? '' : 'disabled'}>Send back to refine</button>
          <button class="action-button danger" data-action="idea-reject" data-idea-id="${escapeHtml(idea.id)}" type="button">Reject</button>
        </div>` : ''}
      ${idea.status === 'refining' ? '<p class="idea-refining-note">The linked refinement ticket follows the normal exact-terminal queue. Leaving it before dispatch or resolving an unverified review returns this idea unchanged.</p>' : ''}
    </article>
  `;
}

function ideaGeneratorSources(agents, items) {
  const liveTargets = promptQueueTargets(agents);
  const liveBySession = new Map(liveTargets.map((agent) => [agent.session, agent]));
  const sessions = liveTargets.map((agent) => agent.session);
  for (const item of items) {
    if (!item?.session || sessions.includes(item.session)) continue;
    if (!verifiedIdeaGenerationConversations(items, item.session).length) continue;
    sessions.push(item.session);
  }
  return sessions.map((session) => {
    const live = liveBySession.get(session) || null;
    const displayName = live?.displayName || displayNameForSession(session);
    const conversations = verifiedIdeaGenerationConversations(items, session);
    const exactSourceStillLive = items.some((item) => (
      item.session === session && item.target?.identityMatches === true &&
      ['captured', 'returned', 'operator_confirmed', 'operator_released'].includes(item.summaryState)
    ));
    return {
      session,
      displayName,
      live,
      stateLabel: live
        ? conversations.length
          ? (exactSourceStillLive ? 'live · verified context' : 'live replacement · prior context')
          : 'live · no verified results'
        : 'unavailable · prior context'
    };
  });
}

function ideaGeneratorPresentation(agents, items, ideas) {
  const sources = ideaGeneratorSources(agents, items);
  const sourceSessions = new Set(sources.map((source) => source.session));
  if (!sourceSessions.has(state.ideaGeneratorDraft.sourceSession)) {
    const preferred = sources.find((source) => source.session === state.selectedSession) || sources[0] || null;
    state.ideaGeneratorDraft.sourceSession = preferred?.session || '';
    state.ideaGeneratorDraft.selectedPromptIds = [];
  }
  const source = sources.find((candidate) => candidate.session === state.ideaGeneratorDraft.sourceSession) || null;
  const conversations = verifiedIdeaGenerationConversations(items, source?.session || '');
  const availableIds = new Set(conversations.map((conversation) => conversation.id));
  state.ideaGeneratorDraft.selectedPromptIds = state.ideaGeneratorDraft.selectedPromptIds.filter((id) => availableIds.has(id));
  if (!state.ideaGeneratorDraft.selectedPromptIds.length) {
    state.ideaGeneratorDraft.selectedPromptIds = conversations.slice(0, 3).map((conversation) => conversation.id);
  }
  const generated = ideaGenerationPrompt({
    sourceSession: source?.session || '',
    sourceLabel: source?.displayName || '',
    selectedPromptIds: state.ideaGeneratorDraft.selectedPromptIds,
    focus: state.ideaGeneratorDraft.focus,
    ideaCount: state.ideaGeneratorDraft.ideaCount,
    items,
    ideas
  });
  return { sources, source, conversations, generated };
}

function ideaGeneratorLauncher(agents, items, ideas) {
  const view = ideaGeneratorPresentation(agents, items, ideas);
  if (!view.sources.length) {
    return '<p class="idea-generator-empty muted">Generate Ideas becomes available after PaneFleet has one verified completed queue result.</p>';
  }
  const selected = new Set(state.ideaGeneratorDraft.selectedPromptIds);
  const executionNeedsLive = ['owner', 'scout'].includes(state.ideaGeneratorDraft.execution);
  const submitDisabled = !view.generated.ok || (executionNeedsLive && !view.source?.live);
  const executionHint = !view.source?.live
    ? 'The project terminal is unavailable or was not safely resolved. Draft mode remains available.'
    : state.ideaGeneratorDraft.execution === 'scout'
      ? 'Starts or reuses a separately visible, resource-gated read-only scout in this workspace.'
      : state.ideaGeneratorDraft.execution === 'draft'
        ? 'Copies the sanitized prompt into Compose without sending or queueing it.'
        : 'Queues behind the current project owner and never interrupts active work.';
  return `
    <details class="idea-generator-panel" ${state.ideaGeneratorDraft.open ? 'open' : ''}>
      <summary><span><strong>Generate ideas</strong><small>Use verified recent work without interrupting it</small></span><span class="summary-hint">${state.ideaGeneratorDraft.open ? 'Close' : 'Launcher'}</span></summary>
      <form id="idea-generator-form" class="idea-generator-form">
        <label>Project source<select name="sourceSession" required>${view.sources.map((source) => `<option value="${escapeHtml(source.session)}" ${source.session === view.source?.session ? 'selected' : ''}>${escapeHtml(source.displayName)} · ${escapeHtml(source.stateLabel)}</option>`).join('')}</select></label>
        <label>Focus<input name="focus" maxlength="400" autocomplete="off" placeholder="Examples: reliability, interview follow-up, mobile UX" value="${escapeHtml(state.ideaGeneratorDraft.focus)}"></label>
        <label>Idea count<select name="ideaCount">${[1, 3, 5, 8].map((count) => `<option value="${count}" ${String(count) === String(state.ideaGeneratorDraft.ideaCount) ? 'selected' : ''}>Up to ${count}</option>`).join('')}</select></label>
        <label>Execution<select name="execution">
          <option value="owner" ${state.ideaGeneratorDraft.execution === 'owner' ? 'selected' : ''}>Queue behind project owner</option>
          <option value="scout" ${state.ideaGeneratorDraft.execution === 'scout' ? 'selected' : ''}>Use read-only scout</option>
          <option value="draft" ${state.ideaGeneratorDraft.execution === 'draft' ? 'selected' : ''}>Draft prompt only</option>
        </select></label>
        <fieldset class="idea-generator-conversations">
          <legend>Verified conversations</legend>
          ${view.conversations.length
            ? view.conversations.map((conversation) => `<label><input type="checkbox" name="promptId" value="${escapeHtml(conversation.id)}" ${selected.has(conversation.id) ? 'checked' : ''}><span><strong>${escapeHtml(formatClock(conversation.completedAt))}</strong>${escapeHtml(conversation.label)}</span></label>`).join('')
            : '<p class="idea-generator-empty">No verified completed queue results are retained for this project yet.</p>'}
        </fieldset>
        <label class="idea-generator-preview">Sanitized prompt preview<textarea name="preview" rows="9" readonly>${escapeHtml(view.generated.prompt || '')}</textarea></label>
        <div class="idea-generator-actions">
          <button class="primary-button" type="submit" ${submitDisabled ? 'disabled' : ''}>Generate ideas</button>
          <span data-idea-generator-hint>${escapeHtml(view.generated.ok
            ? executionHint
            : view.conversations.length
              ? 'Select at least one verified conversation.'
              : 'This project is visible, but generation remains disabled until PaneFleet verifies one completed queue result.')}</span>
        </div>
      </form>
    </details>`;
}

function ideaQueueSection(data, agents, items) {
  if (state.snapshot?.capabilities?.ideaQueue !== true) {
    return `
      <section id="prompt-queue-ideas" class="idea-queue-panel" tabindex="-1">
        <div class="prompt-queue-section-head"><div><span class="eyebrow">Ideas</span><h2>Idea queue</h2></div><strong>Restart required</strong></div>
        <p class="muted">Restart the PaneFleet backend to activate durable idea approval and refinement.</p>
      </section>`;
  }
  const ideas = data.ideas || [];
  const active = ideas.filter((idea) => ['proposed', 'refining'].includes(idea.status));
  const resolved = ideas.filter((idea) => ['approved', 'rejected'].includes(idea.status));
  const target = ideaQueueTarget(agents);
  return `
    <section id="prompt-queue-ideas" class="idea-queue-panel" tabindex="-1" aria-labelledby="idea-queue-title">
      <div class="prompt-queue-section-head">
        <div><span class="eyebrow">Decision gate</span><h2 id="idea-queue-title">Idea queue</h2><p>Capture possibilities first. Only approval creates an implementation ticket; refinement creates a linked planning-only ticket.</p></div>
        <strong>${active.length}</strong>
      </div>
      <form id="idea-queue-form" class="idea-queue-form">
        <label>Idea title<input name="title" maxlength="160" required autocomplete="off" placeholder="A useful ticket worth considering" value="${escapeHtml(state.ideaDraft.title)}"></label>
        <label>Details<textarea name="details" rows="4" maxlength="3000" required placeholder="Outcome, reason, scope, or rough notes">${escapeHtml(state.ideaDraft.details)}</textarea></label>
        <div class="idea-form-actions"><button class="primary-button" type="submit">Add idea</button><span>Saves for review only · sends no terminal input</span></div>
      </form>
      ${ideaGeneratorLauncher(agents, items, ideas)}
      <div class="idea-queue-list">${active.length ? active.map((idea) => ideaQueueCard(idea, target, items, agents)).join('') : '<div class="today-clear"><strong>No ideas awaiting a decision.</strong><span>Add one here or let an agent propose one from a verified queued result.</span></div>'}</div>
      ${resolved.length ? `<details class="idea-resolved-history"><summary>${resolved.length} approved or cancelled idea${resolved.length === 1 ? '' : 's'}</summary><div class="idea-queue-list">${resolved.map((idea) => ideaQueueCard(idea, target, items, agents)).join('')}</div></details>` : ''}
      <p class="idea-agent-format">Agents can propose directly from a trustworthy captured queue result using repeated blocks of: <code>[PANEFLEET IDEA]</code>, <code>TITLE:</code>, <code>DETAILS:</code>, and <code>[/PANEFLEET IDEA]</code>.</p>
    </section>
  `;
}

function renderPromptQueue(promptQueue, agents) {
  const scrollPositions = captureScrollPositions(els.queue, [':root', '.prompt-queue-stats', '.prompt-target-grid']);
  const data = promptQueue || { counts: {}, items: [], schedules: [] };
  const items = data.items || [];
  const schedules = data.schedules || [];
  const ideaCount = Number(data.ideaCounts?.pending || 0);
  const needsReview = items.filter((item) => item.status === 'needs_review');
  const pending = items.filter((item) => ['queued', 'dispatching'].includes(item.status));
  const finishing = items.filter(promptQueueAwaitingFinish);
  const activeLanes = [
    promptQueueLane('Needs review', 'This terminal line is paused. Inspect the exact terminal, then keep monitoring eligible tickets, release the queue, or cancel. PaneFleet never resends.', needsReview),
    promptQueueLane('Accepted turns', 'Live badges distinguish blue agent work from green return verification. The line advances only after a stable exact-pane boundary.', finishing),
    promptQueueLane('Waiting to send', 'Each prompt stays bound to one exact tmux pane and waits for stable green readiness.', pending)
  ].filter(Boolean);
  const activeCount = needsReview.length + finishing.length + pending.length;
  const finishedCount = items.filter(promptQueueFinished).length;
  const activeQueueSection = `
    <section id="prompt-queue-active" class="prompt-queue-active" aria-labelledby="prompt-queue-active-title" tabindex="-1">
      <div class="prompt-queue-section-head"><div><span class="eyebrow">Current work</span><h2 id="prompt-queue-active-title">In the queue</h2></div><strong>${activeCount}</strong></div>
      <div class="mission-lanes">${activeLanes.length ? activeLanes.join('') : '<div class="today-clear"><strong>The active queue is clear.</strong><span>Choose a terminal above to add its next instruction.</span></div>'}</div>
    </section>
  `;
  els.queue.innerHTML = `
    <section class="mission-console prompt-queue-console">
      <header class="prompt-queue-page-head">
        <div><span class="eyebrow">Green-light delivery workspace</span><h1>Prompt Queue</h1><p>Plan work across exact terminals, follow live readiness, and review every completed delivery.</p></div>
        <span class="prompt-queue-page-rule">Stable green · literal text + Enter · one attempt</span>
      </header>
      ${promptQueueStats(data)}
      <nav class="prompt-queue-jump-nav" aria-label="Jump to Prompt Queue section">
        <button data-action="prompt-queue-jump" data-queue-section="compose" aria-controls="prompt-queue-compose" type="button"><span>Compose</span><em>New</em></button>
        <button data-action="prompt-queue-jump" data-queue-section="ideas" aria-controls="prompt-queue-ideas" type="button"><span>Ideas</span><em>${ideaCount}</em></button>
        <button data-action="prompt-queue-jump" data-queue-section="active" aria-controls="prompt-queue-active" type="button"><span>Active</span><em>${activeCount}</em></button>
        <button data-action="prompt-queue-jump" data-queue-section="schedules" aria-controls="prompt-queue-schedules" type="button"><span>Schedules</span><em>${schedules.length}</em></button>
        <button data-action="prompt-queue-jump" data-queue-section="history" aria-controls="prompt-queue-history" type="button"><span>Finished</span><em>${finishedCount}</em></button>
      </nav>
      ${activeLanes.length ? activeQueueSection : ''}
      <section id="prompt-queue-compose" class="mission-hero prompt-queue-hero" tabindex="-1">
        <div class="mission-hero-head"><div><span class="eyebrow">Compose</span><h2>Send when ready</h2><p>Add plain prompts to exact terminals. Blue keeps waiting; stable green releases one.</p></div></div>
        <div class="prompt-queue-legend"><span class="good">● Green · ready</span><span class="busy">● Blue · working</span><span class="warn">● Orange · needs input</span></div>
        ${promptQueueTerminalBoard(agents, items)}
        ${promptQueueComposer(agents)}
      </section>
      ${ideaQueueSection(data, agents, items)}
      ${promptSchedulePanel(schedules, items)}
      ${activeLanes.length ? '' : activeQueueSection}
      ${promptQueueHistory(items, data.revision)}
    </section>
  `;
  restoreScrollPositions(els.queue, scrollPositions);
}

function renderMissionQueue(missions, agents, available, snapshot = state.snapshot || {}) {
  if (!available) {
    els.queue.innerHTML = `<article class="row-card"><h2>Queue</h2><p class="muted">Restart the dashboard backend to activate the durable queue.</p></article>`;
    return;
  }
  const data = missions || { counts: {}, metrics: {}, jobs: [] };
  const jobs = data.jobs || [];
  const attention = normalizedAttention(snapshot);
  const notifications = normalizedNotifications(snapshot);
  const today = new Date().toISOString().slice(0, 10);
  const running = jobs.filter((job) =>
    ['dispatching', 'running', 'verifying'].includes(job.status)
      && !attention.items.some((item) => item.missionId === job.id)
  );
  const upNext = jobs.filter((job) => job.status === 'ready');
  const later = jobs.filter((job) => job.status === 'backlog');
  const doneToday = jobs.filter((job) => job.status === 'done' && String(job.finishedAt || '').startsWith(today));
  const visibleDoneToday = doneToday.slice(0, 12);
  const history = [
    ...doneToday.slice(12),
    ...jobs.filter((job) =>
      ['done', 'canceled'].includes(job.status) && !doneToday.some((item) => item.id === job.id)
    )
  ];
  const visibleHistory = history.slice(0, state.missionHistoryLimit);
  const counts = data.counts || {};
  const decisionCount = attentionDecisionCount(snapshot, attention);
  const activeCount = Number(counts.active || 0);
  const maxActive = Number(data.maxActive || 3);
  const visibleLanes = [
    attentionLane(attention.items, jobs, agents),
    missionLane('In Progress', 'Active work and verification', running, agents),
    missionLane('Up Next', 'Ready for manual dispatch—nothing starts by itself', upNext, agents, { queue: true }),
    missionLane('Later', 'Held work—promote it when you are ready', later, agents),
    missionLane('Done Today', `${data.metrics?.completed || 0} verified total`, visibleDoneToday, agents)
  ].filter(Boolean);
  els.queue.innerHTML = `
    <section class="mission-console">
      <section class="mission-hero">
        <div class="mission-hero-head">
          <div><span class="eyebrow">Exception-driven missions</span><h2>Work queue</h2><p>Decisions first, then active work and the next outcomes.</p></div>
          <button class="primary-button mission-add-button" data-action="mission-create-open" type="button">+ Job</button>
        </div>
        <div class="mission-metrics">
          ${digestMetric('Decisions', decisionCount, decisionCount ? 'needs you' : 'all clear', decisionCount ? 'bad' : 'good')}
          ${digestMetric('Active Slots', activeCount, `${Math.max(0, maxActive - activeCount)} of ${maxActive} free`, activeCount >= maxActive ? 'warn' : 'busy')}
          ${digestMetric('Up Next', counts.ready ?? counts.upNext ?? upNext.length, 'ready to dispatch', 'neutral')}
          ${digestMetric('Later', counts.backlog ?? later.length, 'held', 'neutral')}
          ${digestMetric('Done Today', counts.doneToday || 0, 'verified', 'good')}
        </div>
        ${missionCreateForm()}
      </section>
      <div class="mission-lanes">${visibleLanes.length ? visibleLanes.join('') : '<div class="today-clear"><strong>Nothing needs attention.</strong><span>Create a mission when you are ready for the next outcome.</span></div>'}</div>
      ${notificationLane(notifications)}
      ${history.length ? `<details class="mission-history" ${state.missionHistoryOpen ? 'open' : ''}><summary>History · ${history.length}</summary>${missionLane('Recent Results', 'Older completions and canceled missions', visibleHistory, agents)}${visibleHistory.length < history.length ? `<button class="action-button mission-history-more" data-action="mission-history-more" type="button">Load ${Math.min(24, history.length - visibleHistory.length)} more</button>` : ''}</details>` : ''}
    </section>
  `;
}

function renderAgents(agents, orchestration) {
  const sessionScrollPositions = captureScrollPositions(els.sessionList, [':root']);
  const draft = state.agentDraft;
  const workspaceMode = draft.workspace && draft.workspace !== '__new__' ? 'existing' : 'new';
  const model = draft.model || '';
  const reasoning = normalizedReasoning(model, draft.reasoning);
  const createCard = `
    <article class="row-card create-card">
      <details class="new-agent-panel" ${draft.open ? 'open role="dialog" aria-modal="true"' : ''} aria-label="New Agent launcher">
        <summary>
          <span>
            <strong>New Agent</strong>
            <small>${escapeHtml(draft.name || draft.directoryName || draft.preset || state.options.suggestedName || 'persistent tmux session')}</small>
          </span>
          <span class="summary-hint">${draft.open ? 'Close' : 'Launcher'}</span>
        </summary>
        <form id="new-agent-form" class="create-agent-form" data-workspace-mode="${workspaceMode}">
          <label>
            Workspace
            <select name="workspace">
              <option value="__new__" ${draft.workspace === '__new__' ? 'selected' : ''}>New folder under agent-workspaces</option>
              ${workspaceSelectOptions(draft.workspace)}
            </select>
            <span class="field-preview">${escapeHtml(workspacePreviewText(draft))}</span>
          </label>
          <label class="new-workspace-field">
            New folder
            <input name="directoryName" autocomplete="off" placeholder="mobile-ui-fix" value="${escapeHtml(draft.directoryName)}">
          </label>
          <label>
            Prompt preset
            <select name="preset">
              <option value="" ${draft.preset ? '' : 'selected'}>Custom prompt</option>
              ${presetSelectOptions(draft.preset)}
            </select>
          </label>
          <div class="model-settings">
            <label>
              Model
              <select name="model" data-model-select>
                ${modelSelectOptions(model)}
              </select>
            </label>
            <label>
              Reasoning
              <select name="reasoning" data-reasoning-select>
                ${reasoningSelectOptions(model, reasoning)}
              </select>
            </label>
          </div>
          <label>
            Agent role / session
            <input name="name" autocomplete="off" placeholder="${escapeHtml(state.options.suggestedName || 'mobile-ui-fix')}" value="${escapeHtml(draft.name)}">
          </label>
          <label class="form-wide">
            Initial prompt
            <textarea name="prompt" rows="3" maxlength="8000" placeholder="Tell the new agent what to work on">${escapeHtml(draft.prompt)}</textarea>
          </label>
          <div class="launcher-actions form-wide">
            <button class="action-button" data-action="new-agent-cancel" type="button">Cancel</button>
            <button class="primary-button" type="submit" aria-describedby="new-agent-launcher-safety new-agent-launcher-shortcut">Start Agent</button>
            <span id="new-agent-launcher-safety" class="muted">Starts in tmux and stays alive after you close this page. Closing this launcher keeps your draft.</span>
            <span id="new-agent-launcher-shortcut" class="launcher-shortcut"><kbd>Ctrl</kbd><span>/</span><kbd>⌘</kbd><span>+</span><kbd>Enter</kbd></span>
          </div>
        </form>
      </details>
      <div class="new-agent-backdrop" data-action="new-agent-cancel" aria-hidden="true"></div>
    </article>
  `;
  els.sessionList.innerHTML = agents.length
    ? `${agents.map((agent) => sessionRailItem(agent, orchestration)).join('')}<button class="session-no-results" data-action="session-filters-reset" type="button"><strong>No matching sessions</strong><span>Clear search and status filters</span></button>`
    : '<div class="session-empty">No tmux sessions are visible.</div>';
  els.newAgentContainer.innerHTML = createCard;
  if (els.sessionSearch.value !== state.agentFilter) els.sessionSearch.value = state.agentFilter;
  filterSessionRail(state.agentFilter);
  restoreScrollPositions(els.sessionList, sessionScrollPositions);

  const activeSession = state.terminalWindows.get(state.activeTerminalId)?.session;
  if (activeSession) state.selectedSession = activeSession;
  if (state.selectedSession && !agents.some((agent) => agent.session === state.selectedSession)) state.selectedSession = null;
  renderTerminalInspector(agents, orchestration);
  renderTerminalChrome();
}

function sessionAttentionItems(session) {
  const snapshot = state.snapshot || {};
  const direct = attentionForSession(normalizedAttention(snapshot).items, session);
  const missionItems = (snapshot.missions?.jobs || [])
    .filter((mission) => mission.assignedSession === session && ['needs_you', 'reconcile_required', 'failed'].includes(mission.status))
    .map((mission) => normalizeAttentionItem({
      id: `mission:${mission.id}:${mission.status}`,
      kind: 'mission',
      missionId: mission.id,
      session,
      title: mission.title,
      detail: mission.blocker || mission.resultSummary || `Mission is ${missionStatusLabel(mission.status)}.`,
      status: mission.status,
      tone: missionTone(mission.status),
      requiresDecision: true,
      updatedAt: mission.updatedAt
    }));
  const unique = new Map();
  [...direct, ...missionItems].filter(Boolean).forEach((item) => unique.set(item.id, item));
  return [...unique.values()];
}

function sessionRailItem(agent, orchestration) {
  const serviceSession = agent.terminalKind === 'service';
  const brief = orchestration?.agents?.find((item) => item.session === agent.session) || {};
  const status = agent.agentStatus || { state: 'unknown', tone: 'warn' };
  const statusClass = statusClassName(status);
  const displayName = serviceSession ? agent.serviceLabel || agent.session : brief.displayName || agent.session;
  const attention = sessionAttentionItems(agent.session);
  const decisions = attention.filter((item) => item.requiresDecision).length;
  const isOpen = [...state.terminalWindows.values()].some((item) => item.session === agent.session && item.mode !== 'static');
  const pinned = state.pinnedSessions.has(agent.session);
  const pin = sessionPinPresentation(pinned, displayName);
  const signal = serviceSession
    ? { label: 'Monitoring', tone: 'working', description: status.reason }
    : sessionStatusPresentation(status, attention.length);
  const lastUsed = lastUsedLabel(agent);
  const taskPreview = serviceSession
    ? `${agent.serviceDiscovered ? 'Auto-discovered' : 'Registered'} tmux session · ${agent.servicePaneCount || 1} ${agent.servicePaneCount === 1 ? 'pane' : 'panes'} · prompt input disabled`
    : String(brief.task || status.reason || '').trim();
  const searchValue = `${displayName} ${agent.session} ${agent.currentPath || ''} ${brief.task || ''}`.toLowerCase();
  const filterCategory = sessionFilterCategory(status, attention.length);
  return `
    <article class="session-item ${escapeHtml(statusClass)} ${isOpen ? 'is-open' : ''} ${pinned ? 'is-pinned' : ''}" data-session="${escapeHtml(agent.session)}" data-session-search="${escapeHtml(searchValue)}" data-session-filter="${escapeHtml(filterCategory)}">
      <button class="session-open" data-action="${serviceSession ? 'peek' : 'agent-detail'}" data-session="${escapeHtml(agent.session)}" type="button" aria-label="Open ${escapeHtml(displayName)} terminal. ${escapeHtml(signal.label)}. ${escapeHtml(lastUsed)}">
        <span class="session-state-dot" aria-hidden="true"></span>
        <span class="session-copy"><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(shortPath(agent.currentPath))}</small><span class="session-meta"><span class="session-signal ${escapeHtml(signal.tone)}" title="${escapeHtml(signal.description)}">${escapeHtml(signal.label)}</span><em>${escapeHtml(lastUsed)}</em></span>${taskPreview ? `<span class="session-task" title="${escapeHtml(taskPreview)}">${escapeHtml(taskPreview)}</span>` : ''}</span>
        ${attention.length ? `<span class="session-attention ${decisions ? 'decision' : ''}" title="${escapeHtml(`${attention.length} item${attention.length === 1 ? '' : 's'} need attention`)}">${decisions || attention.length}</span>` : ''}
      </button>
      <button class="session-pin ${pinned ? 'active' : ''}" data-action="session-pin" data-session="${escapeHtml(agent.session)}" type="button" aria-pressed="${pinned ? 'true' : 'false'}" aria-label="${escapeHtml(pin.actionLabel)}" title="${escapeHtml(pin.title)}"><span aria-hidden="true">${pin.symbol}</span><span class="session-pin-label" aria-hidden="true">${pin.visibleLabel}</span></button>
    </article>
  `;
}

function renderSessionFilterChrome() {
  const items = [...els.sessionList.querySelectorAll('.session-item')];
  const counts = { all: items.length, needs: 0, active: 0, idle: 0 };
  for (const item of items) {
    if (Object.hasOwn(counts, item.dataset.sessionFilter)) counts[item.dataset.sessionFilter] += 1;
  }
  for (const button of els.sessionFilters) {
    const filter = button.dataset.filter;
    const active = filter === state.sessionFilter;
    const count = counts[filter] || 0;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
    button.setAttribute('aria-label', `${button.querySelector('span')?.textContent || filter}, ${count} session${count === 1 ? '' : 's'}`);
    const counter = button.querySelector('em');
    if (counter) counter.textContent = String(count);
  }
}

function revealActiveSessionFilter() {
  const layout = window.matchMedia('(max-width: 759px)').matches ? 'compact' : 'wide';
  const revealKey = `${layout}:${state.sessionFilter}`;
  if (state.sessionFilterRevealKey === revealKey) return;
  state.sessionFilterRevealKey = revealKey;
  const activeFilter = els.sessionFilters.find((button) => button.dataset.filter === state.sessionFilter);
  revealHorizontalItem(activeFilter?.parentElement, activeFilter);
}

function filterSessionRail(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  state.agentFilter = value;
  let visible = 0;
  const items = [...els.sessionList.querySelectorAll('.session-item')];
  for (const item of items) {
    const matches = sessionFilterMatches(state.sessionFilter, item.dataset.sessionFilter, item.dataset.sessionSearch, normalized);
    item.hidden = !matches;
    if (matches) visible += 1;
  }
  const filtered = state.sessionFilter !== 'all';
  const label = els.sessionFilters.find((button) => button.dataset.filter === state.sessionFilter)?.querySelector('span')?.textContent || 'selected';
  const emptyMessage = normalized && filtered
    ? `No ${label.toLowerCase()} sessions match this search`
    : filtered ? `No ${label.toLowerCase()} sessions` : 'No matching sessions';
  els.sessionList.dataset.emptyMessage = emptyMessage;
  els.sessionList.classList.toggle('has-no-results', items.length > 0 && (Boolean(normalized) || filtered) && visible === 0);
  const emptyState = els.sessionList.querySelector('.session-no-results');
  if (emptyState) emptyState.querySelector('strong').textContent = emptyMessage;
  const countPresentation = sessionResultCountPresentation(visible, items.length, Boolean(normalized) || filtered);
  els.sessionCount.textContent = countPresentation.label;
  els.sessionCount.setAttribute('aria-label', countPresentation.description);
  els.sessionCount.title = countPresentation.description;
  renderSessionFilterChrome();
  revealActiveSessionFilter();
}

function visibleSessionItems() {
  return [...els.sessionList.querySelectorAll('.session-item')].filter((item) => !item.hidden);
}

function focusSessionResult(item) {
  const button = item?.querySelector('.session-open');
  if (!button) return;
  button.focus({ preventScroll: true });
  item.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
}

function handleSessionSearchKeydown(event) {
  const items = visibleSessionItems();
  const action = sessionSearchKeyAction(event, items.length, els.sessionSearch.value);
  if (!action) return false;
  event.preventDefault();
  if (action === 'clear') {
    els.sessionSearch.value = '';
    filterSessionRail('');
  } else if (action === 'open-first') {
    items[0]?.querySelector('.session-open')?.click();
  } else {
    focusSessionResult(action === 'focus-last' ? items.at(-1) : items[0]);
  }
  return true;
}

function handleSessionResultKeydown(event) {
  if (!event.target?.classList?.contains('session-open')) return false;
  const items = visibleSessionItems();
  const currentItem = event.target.closest('.session-item');
  const currentIndex = items.indexOf(currentItem);
  if (event.key === 'Escape') {
    event.preventDefault();
    els.sessionSearch.focus({ preventScroll: true });
    els.sessionSearch.select();
    return true;
  }
  if (
    !['ArrowDown', 'ArrowUp'].includes(event.key)
    || event.altKey
    || event.ctrlKey
    || event.metaKey
    || event.shiftKey
    || event.isComposing
  ) return false;
  event.preventDefault();
  const nextIndex = cycledItemIndex(currentIndex, items.length, event.key === 'ArrowUp' ? -1 : 1);
  focusSessionResult(items[nextIndex]);
  return true;
}

function setSessionFilter(filter) {
  const next = ['all', 'needs', 'active', 'idle'].includes(filter) ? filter : 'all';
  state.sessionFilter = next;
  safeStorageSet(SESSION_FILTER_STORAGE_KEY, next);
  filterSessionRail(state.agentFilter);
}

function resetSessionFilters() {
  state.sessionFilter = 'all';
  state.agentFilter = '';
  els.sessionSearch.value = '';
  safeStorageSet(SESSION_FILTER_STORAGE_KEY, 'all');
  filterSessionRail('');
  const firstItem = visibleSessionItems()[0];
  window.requestAnimationFrame(() => focusSessionResult(firstItem));
}

function selectedAgent(agents = state.snapshot?.agents || []) {
  const activeSession = state.terminalWindows.get(state.activeTerminalId)?.session;
  const session = activeSession || state.selectedSession;
  return agents.find((agent) => agent.session === session && !isReviewAgent(agent)) || null;
}

function codexAccountReport(telemetry) {
  return matchingCodexAccountReport(telemetry, state.snapshot?.codexUsage);
}

function telemetryValueLabel(value, freshness) {
  return freshness.stale ? `Last reported ${value}` : value;
}

function cumulativeTokenDetail(tokens) {
  const breakdown = codexTokenBreakdown(tokens);
  if (!breakdown.available) return 'Token composition not reported';
  return `${formatTokenCount(breakdown.cachedInputTokens)} cached input · ${formatTokenCount(breakdown.uncachedInputTokens)} uncached input · ${formatTokenCount(breakdown.outputTokens)} output`;
}

function accountLimitSnapshot(account, observedAt) {
  const limit = account?.primary || account?.secondary || null;
  const freshness = codexTelemetryFreshness(observedAt);
  const remainingPercent = limit ? Math.max(0, 100 - Number(limit.usedPercent || 0)) : null;
  return {
    limit,
    freshness,
    remainingPercent,
    value: limit
      ? telemetryValueLabel(`${remainingPercent}% left`, freshness)
      : 'Not reported',
    freshnessText: !freshness.available
      ? 'Observation time unavailable'
      : freshness.stale
        ? `Stale snapshot · tracked ${missionTimeLabel(observedAt)}`
        : `Current passive snapshot · tracked ${missionTimeLabel(observedAt)}`
  };
}

function codexTelemetryPanel(agent) {
  const telemetry = agent?.codexTelemetry;
  const presentation = codexTelemetryPresentation(telemetry);
  if (!presentation.available) {
    return `
      <section class="inspector-usage is-pending">
        <div class="inspector-section-head"><strong>Codex session &amp; account</strong><span>Passive</span></div>
        <p>Waiting for Codex to report its first token update. No terminal input is sent.</p>
      </section>
    `;
  }
  const context = telemetry.context;
  const sessionTokens = telemetry.sessionTokens;
  const lastTurnTokens = telemetry.lastTurnTokens;
  const sessionFreshness = codexTelemetryFreshness(telemetry.observedAt);
  const accountReport = codexAccountReport(telemetry);
  const account = accountReport.account;
  const accountSnapshot = accountLimitSnapshot(account, accountReport.observedAt);
  const limit = accountSnapshot.limit;
  const primaryPoolKey = account?.limitId || account?.limitName || 'codex';
  const extraPools = accountReport.pools.filter((pool) => (pool.account?.limitId || pool.account?.limitName || 'codex') !== primaryPoolKey);
  const resetAt = limit?.resetsAt ? new Date(limit.resetsAt) : null;
  const resetLabel = resetAt && Number.isFinite(resetAt.getTime())
    ? `resets ${resetAt.toLocaleString()}`
    : 'reset not reported';
  const configuration = [
    telemetry.model || 'model unavailable',
    telemetry.effort ? `${telemetry.effort} reasoning` : '',
    telemetry.sandbox || '',
    telemetry.approvalPolicy ? `approval ${telemetry.approvalPolicy}` : ''
  ].filter(Boolean).join(' · ');
  const accountName = account?.limitName || account?.limitId || 'Codex';
  return `
    <section class="inspector-usage ${escapeHtml(presentation.tone)}">
      <div class="inspector-section-head"><strong>Codex session &amp; account</strong><span class="status ${sessionFreshness.stale ? 'warn' : 'good'}" title="${escapeHtml(telemetry.observedAt ? new Date(telemetry.observedAt).toLocaleString() : 'Time unavailable')}">${escapeHtml(telemetry.observedAt ? `${sessionFreshness.stale ? 'stale · ' : ''}${missionTimeLabel(telemetry.observedAt)}` : 'time unavailable')}</span></div>
      <p class="inspector-usage-config">${escapeHtml(configuration)}</p>
      <div class="inspector-usage-grid">
        <div><span>Session context</span><strong>${context ? escapeHtml(telemetryValueLabel(`${context.remainingPercent}% left`, sessionFreshness)) : 'Not reported'}</strong><small>${context ? `${sessionFreshness.stale ? 'Stale session snapshot · ' : ''}${escapeHtml(formatTokenCount(context.remainingTokens))} left of ${escapeHtml(formatTokenCount(context.windowTokens))}` : 'Available after a token update'}</small>${context ? `<progress max="100" value="${escapeHtml(context.usedPercent)}" aria-label="Session context ${escapeHtml(context.usedPercent)} percent used"></progress>` : ''}</div>
        <div><span>Cumulative processed tokens</span><strong>${escapeHtml(telemetryValueLabel(formatTokenCount(sessionTokens?.totalTokens), sessionFreshness))}</strong><small>${escapeHtml(cumulativeTokenDetail(sessionTokens))}</small><small>${lastTurnTokens ? `Latest turn ${escapeHtml(formatTokenCount(lastTurnTokens.totalTokens))} processed · ${escapeHtml(formatTokenCount(lastTurnTokens.outputTokens))} output` : 'Latest turn not reported'}</small></div>
        <div><span>Account-wide ${escapeHtml(accountName)} limit</span><strong>${escapeHtml(accountSnapshot.value)}</strong><small>${limit ? `${escapeHtml(accountSnapshot.freshnessText)} · ${escapeHtml(limit.usedPercent)}% used · ${escapeHtml(usageWindowLabel(limit.windowMinutes))} · ${escapeHtml(resetLabel)}` : 'Open /status in Codex for a complete current account check'}</small></div>
        <div><span>Account plan</span><strong>${escapeHtml(account?.planType || 'Not reported')}</strong><small>Shared across every project and terminal in this account pool</small></div>
      </div>
      ${extraPools.length ? `<div class="inspector-usage-pools"><span>Additional account-wide pools reported passively</span>${extraPools.map((pool) => { const poolSnapshot = accountLimitSnapshot(pool.account, pool.observedAt); return `<div><strong>${escapeHtml(pool.account?.limitName || pool.account?.limitId || 'Codex pool')}</strong><small>${poolSnapshot.limit ? `${escapeHtml(poolSnapshot.value)} · ${escapeHtml(poolSnapshot.limit.usedPercent)}% used · ${escapeHtml(usageWindowLabel(poolSnapshot.limit.windowMinutes))} · ${escapeHtml(poolSnapshot.freshnessText)}` : 'Limit window not reported'}</small></div>`; }).join('')}</div>` : ''}
      <p class="inspector-usage-note">Context and cumulative processed-token totals belong only to this exact session. Cumulative processing includes cached input repeated across turns; it is not current context or account-limit consumption. Limits are shared by the signed-in account within each pool. Stale values are last-known snapshots, and passive telemetry may omit pools that Codex shows in <code>/status</code>; PaneFleet does not type <code>/status</code> or <code>/usage</code>.</p>
    </section>
  `;
}

function terminalTelemetryMarkup(agent) {
  const telemetry = agent?.codexTelemetry;
  const presentation = codexTelemetryPresentation(telemetry);
  if (!presentation.available) return '<p class="terminal-telemetry-pending">Waiting for Codex telemetry. No terminal input is sent.</p>';
  const accountReport = codexAccountReport(telemetry);
  const account = accountReport.account;
  const accountSnapshot = accountLimitSnapshot(account, accountReport.observedAt);
  const limit = accountSnapshot.limit;
  const sessionFreshness = codexTelemetryFreshness(telemetry.observedAt);
  const context = telemetry.context;
  const signal = sessionStatusPresentation(agent?.agentStatus);
  const accountName = account?.limitName || account?.limitId || 'Codex';
  return `
    <div class="terminal-telemetry-grid">
      <div><span>Status</span><strong>${escapeHtml(signal.label)}</strong><small>${escapeHtml(`${telemetry.model || 'model unknown'}${telemetry.effort ? ` · ${telemetry.effort}` : ''}`)}</small></div>
      <div><span>Session context</span><strong>${context ? escapeHtml(telemetryValueLabel(`${context.remainingPercent}% left`, sessionFreshness)) : 'Not reported'}</strong><small>${context ? `${sessionFreshness.stale ? 'Stale snapshot · ' : ''}${escapeHtml(formatTokenCount(context.remainingTokens))} of ${escapeHtml(formatTokenCount(context.windowTokens))}` : 'Waiting for token update'}</small></div>
      <div><span>Cumulative processed</span><strong>${escapeHtml(telemetryValueLabel(`${formatTokenCount(telemetry.sessionTokens?.totalTokens)} tokens`, sessionFreshness))}</strong><small>${escapeHtml(cumulativeTokenDetail(telemetry.sessionTokens))}</small></div>
      <div><span>Account-wide ${escapeHtml(accountName)}</span><strong>${escapeHtml(accountSnapshot.value)}</strong><small>${limit ? `${escapeHtml(accountSnapshot.freshnessText)} · ${escapeHtml(limit.usedPercent)}% used · ${escapeHtml(usageWindowLabel(limit.windowMinutes))}` : 'No account window reported'}</small></div>
    </div>
    <p class="terminal-telemetry-note">Context is exact-session state. Cumulative processing includes cached input repeated across turns and is not account-limit usage. Account values are pool-specific passive snapshots; stale values are last known.</p>
  `;
}

function terminalMobileTelemetryContent(agent) {
  const telemetry = agent?.codexTelemetry;
  const accountReport = codexAccountReport(telemetry);
  const summary = codexCompactTelemetryPresentation({ telemetry, account: accountReport.account, status: agent?.agentStatus });
  const sessionFreshness = codexTelemetryFreshness(summary.observedAt);
  const accountSnapshot = accountLimitSnapshot(accountReport.account, accountReport.observedAt);
  const context = summary.contextRemainingPercent === null
    ? 'Pending'
    : telemetryValueLabel(`${Math.round(summary.contextRemainingPercent)}% left`, sessionFreshness);
  const usage = accountSnapshot.limit
    ? telemetryValueLabel(`${Math.round(accountSnapshot.remainingPercent)}% left`, accountSnapshot.freshness)
    : 'Pending';
  const session = summary.sessionTokens === null
    ? 'Pending'
    : telemetryValueLabel(`${formatTokenCount(summary.sessionTokens)} processed`, sessionFreshness);
  const model = summary.model || 'Model pending';
  const sessionFreshnessLabel = summary.observedAt ? missionTimeLabel(summary.observedAt) : 'awaiting first report';
  const accountFreshnessLabel = accountReport.observedAt ? missionTimeLabel(accountReport.observedAt) : 'awaiting first report';
  return {
    tone: codexTelemetryPresentation(telemetry ? { ...telemetry, account: accountReport.account } : telemetry).tone,
    label: `Status ${summary.statusLabel}. Context ${context}. Account ${usage}. Cumulative session processing ${session}. Session tracked ${sessionFreshnessLabel}. Account tracked ${accountFreshnessLabel}.`,
    markup: `
      <span><small>Status</small><strong class="${escapeHtml(summary.statusTone)}">${escapeHtml(summary.statusLabel)}</strong></span>
      <span><small>CTX</small><strong>${escapeHtml(context)}</strong></span>
      <span><small>Account</small><strong>${escapeHtml(usage)}</strong></span>
      <span><small>Processed</small><strong>${escapeHtml(session)}</strong></span>
      <span class="terminal-mobile-telemetry-foot">${escapeHtml(model)} · session ${escapeHtml(sessionFreshnessLabel)} · account ${escapeHtml(accountFreshnessLabel)} · tap for details</span>
    `
  };
}

function renderTerminalInspector(agents, orchestration) {
  const agent = selectedAgent(agents);
  if (!agent) {
    els.terminalInspector.innerHTML = '<div class="inspector-empty"><span class="eyebrow">Inspector</span><h2>No session selected</h2><p>Open a terminal to see its task, mission, and anything that needs you.</p></div>';
    return;
  }
  if (agent.terminalKind === 'service') {
    const pinned = state.pinnedSessions.has(agent.session);
    const paneCount = Math.max(1, Number(agent.servicePaneCount) || 1);
    els.terminalInspector.innerHTML = `
      <div class="inspector-head"><div><span class="eyebrow">Selected session</span><h2>${escapeHtml(agent.serviceLabel || agent.session)}</h2><p>tmux ${escapeHtml(agent.session)} · ${escapeHtml(shortPath(agent.currentPath))}</p></div><span class="status busy">monitoring</span></div>
      <div class="inspector-actions"><button class="action-button primary" data-action="peek" data-session="${escapeHtml(agent.session)}" type="button">Open read-only</button><button class="action-button" data-action="session-pin" data-session="${escapeHtml(agent.session)}" type="button" aria-pressed="${pinned ? 'true' : 'false'}">${pinned ? 'Unpin' : 'Pin to top'}</button><button class="action-button" data-action="copy-attach" data-session="${escapeHtml(agent.session)}" type="button">Copy attach</button></div>
      <section class="inspector-summary"><div><span>Session type</span><p>${escapeHtml(agent.serviceDiscovered ? 'Auto-discovered tmux workload' : 'Registered tmux service')}</p></div><div><span>Panes</span><p>${paneCount} live ${paneCount === 1 ? 'pane' : 'panes'} grouped into this session.</p></div><div><span>Input boundary</span><p>Live output is available here. Prompt and queue controls remain limited to Codex agents.</p></div></section>
      <details class="inspector-recovery"><summary>Recovery controls</summary><div><button class="action-button warn" data-action="session-interrupt" data-session="${escapeHtml(agent.session)}" type="button">Send Ctrl-C</button><button class="action-button danger" data-action="session-stop" data-session="${escapeHtml(agent.session)}" type="button">Stop session</button></div></details>
    `;
    return;
  }
  const brief = orchestration?.agents?.find((item) => item.session === agent.session) || {};
  const status = agent.agentStatus || { state: 'unknown', tone: 'warn', reason: '' };
  const mission = activeMissionForAgentSession(agent.session);
  const attention = sessionAttentionItems(agent.session);
  const pinned = state.pinnedSessions.has(agent.session);
  const canResume = agent.canResume || brief.canResume;
  const task = brief.task || agent.lastLine || `Working in ${shortPath(agent.currentPath)}.`;
  const activity = brief.activity || agent.lastLine || 'No recent summarized signal.';
  const next = observationNextAction(brief, status, task);
  els.terminalInspector.innerHTML = `
    <div class="inspector-head"><div><span class="eyebrow">Selected agent</span><h2>${escapeHtml(brief.displayName || agent.session)}</h2><p>tmux ${escapeHtml(agent.session)} · ${escapeHtml(shortPath(agent.currentPath))}</p></div><span class="status ${escapeHtml(statusClassName(status))}">${escapeHtml(status.state)}</span></div>
    <div class="inspector-actions"><button class="action-button primary" data-action="agent-detail" data-session="${escapeHtml(agent.session)}" type="button">Open</button>${canResume ? `<button class="action-button primary" data-action="agent-resume" data-session="${escapeHtml(agent.session)}" type="button" title="Run codex resume --last in this live shell">Restart Codex</button>` : ''}<button class="action-button" data-action="session-pin" data-session="${escapeHtml(agent.session)}" type="button" aria-pressed="${pinned ? 'true' : 'false'}">${pinned ? 'Unpin' : 'Pin to top'}</button><button class="action-button" data-action="copy-attach" data-session="${escapeHtml(agent.session)}" type="button">Copy attach</button></div>
    ${attention.length ? `<section class="inspector-attention"><div class="inspector-section-head"><strong>Needs you</strong><span>${attention.length}</span></div>${attention.map((item) => `<button class="inspector-attention-item ${escapeHtml(item.tone)}" data-action="attention-open" data-attention-id="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join('')}</section>` : ''}
    <section class="inspector-summary"><div><span>Current task</span><p>${escapeHtml(task)}</p></div><div><span>Last signal</span><p>${escapeHtml(activity)}</p></div><div><span>Next</span><p>${escapeHtml(next)}</p></div></section>
    ${codexTelemetryPanel(agent)}
    ${mission ? `<section class="inspector-mission ${escapeHtml(missionTone(mission.status))}"><div class="inspector-section-head"><strong>Mission</strong><span>${escapeHtml(missionStatusLabel(mission.status))}</span></div><h3>${escapeHtml(mission.title)}</h3><p>${escapeHtml(mission.blocker || mission.goal)}</p><button class="action-button" data-action="mission-open-queue" data-mission-id="${escapeHtml(mission.id)}" type="button">Open in queue</button></section>` : ''}
    <details class="inspector-recovery"><summary>Recovery controls</summary><div><button class="action-button" data-action="peek" data-session="${escapeHtml(agent.session)}" type="button">Peek output</button><button class="action-button warn" data-action="interrupt-agent" data-session="${escapeHtml(agent.session)}" type="button">Send Ctrl-C</button><button class="action-button danger" data-action="session-stop" data-session="${escapeHtml(agent.session)}" type="button">Stop session</button></div></details>
  `;
}

function digestMetric(label, value, detail, tone = 'neutral') {
  return `
    <div class="digest-metric ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function serviceChip(service) {
  const presentation = serviceToolsPresentation(service);
  const ports = presentation.openPorts.length ? `open :${presentation.openPorts.join(', :')}` : service.running ? 'running' : 'ready to start';
  return `
    <button class="service-chip ${escapeHtml(presentation.tone)}" data-action="switch-services" data-service="${escapeHtml(service.id)}" type="button">
      <span>${escapeHtml(service.label || service.id)}</span>
      <em>${escapeHtml(`${service.discovered ? 'discovered · ' : ''}${ports}`)}</em>
    </button>
  `;
}

function serviceSortScore(service) {
  return ({ attention: 0, live: 1, available: 2, discovered: 3 })[serviceToolsPresentation(service).group] ?? 4;
}

function prioritizedServices(services = []) {
  return [...services].sort((left, right) => {
    const priority = serviceSortScore(left) - serviceSortScore(right);
    if (priority) return priority;
    return String(left.label || left.id).localeCompare(String(right.label || right.id));
  });
}

function hostMemoryStats(host = {}) {
  const total = Math.max(0, Number(host.totalMem) || 0);
  const available = Math.min(total, Math.max(0, Number(host.availableMem ?? host.freeMem) || 0));
  const used = Math.max(0, total - available);
  const percent = total ? Math.round((used / total) * 100) : 0;
  return { total, free: available, used, percent };
}

function hostStorageStats(host = {}) {
  const root = host.rootFs && typeof host.rootFs === 'object' ? host.rootFs : {};
  const total = Math.max(0, Number(root.totalBytes) || 0);
  const available = Math.min(total, Math.max(0, Number(root.availableBytes) || 0));
  const used = Math.min(total, Math.max(0, Number(root.usedBytes) || 0));
  const percent = total ? Math.min(100, Math.max(0, Number(root.usedPercent) || 0)) : 0;
  return { available: total > 0, total, free: available, used, percent };
}

function hostSwapStats(host = {}) {
  const total = Math.max(0, Number(host.swapTotal) || 0);
  const free = Math.min(total, Math.max(0, Number(host.swapFree) || 0));
  const used = Math.max(0, total - free);
  const percent = total ? Math.round((used / total) * 100) : 0;
  return { total, free, used, percent };
}

function uniqueLiveServices(services = []) {
  const seenPortSets = new Set();
  return prioritizedServices(services)
    .filter((service) => service.running)
    .filter((service) => {
      const portKey = serviceToolsPresentation(service).openPorts.sort((left, right) => left - right).join(',');
      if (!service.discovered || !portKey || !seenPortSets.has(portKey)) {
        if (portKey) seenPortSets.add(portKey);
        return true;
      }
      return false;
    });
}

function pulseServiceRow(service) {
  const liveLinks = normalizedLinks(service).filter((link) => link.listening);
  return `
    <article class="pulse-app-row">
      ${serviceChip(service)}
      ${liveLinks.length ? `<div class="link-row">${liveLinks.slice(0, 3).map((link, index) => serviceLinkButton(link, `pulse-${service.id}-${index}`)).join('')}</div>` : ''}
    </article>
  `;
}

function usageTokenDetail(tokens = {}) {
  return cumulativeTokenDetail(tokens);
}

function usageDateLabel(date, today) {
  if (date === today) return 'Today';
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function codexUsageAgentRow(agent, liveAgents) {
  const session = String(agent.session || 'unknown');
  const liveAgent = liveAgents.get(session);
  const context = liveAgent?.codexTelemetry?.context;
  const contextFreshness = codexTelemetryFreshness(liveAgent?.codexTelemetry?.observedAt);
  const project = liveAgent?.currentPath ? shortPath(liveAgent.currentPath) : 'closed session';
  const rolloutCount = Number(agent.rolloutCount);
  const rolloutDetail = Number.isInteger(rolloutCount) && rolloutCount > 0
    ? `${rolloutCount} tracked rollout${rolloutCount === 1 ? '' : 's'}`
    : 'tracked rollout deltas';
  return `
    <article class="usage-agent-row">
      <div><strong>${escapeHtml(displayNameForSession(session))}</strong><small>tmux ${escapeHtml(session)} · ${escapeHtml(project)} · ${escapeHtml(agent.lastObservedAt ? `seen ${missionTimeLabel(agent.lastObservedAt)}` : 'waiting for first token event')}</small></div>
      <div><span>Host-local today · UTC</span><strong>${escapeHtml(formatTokenCount(agent.todayTokens?.totalTokens))}</strong><small>observed rollout deltas</small></div>
      <div><span>Host-local tracked period</span><strong>${escapeHtml(formatTokenCount(agent.tokens?.totalTokens))}</strong><small>${escapeHtml(usageTokenDetail(agent.tokens))} · ${escapeHtml(rolloutDetail)}</small></div>
      <div><span>Session context</span><strong>${context ? escapeHtml(telemetryValueLabel(`${Math.round(context.remainingPercent)}% left`, contextFreshness)) : 'Not live'}</strong><small>${context ? `${contextFreshness.stale ? 'stale snapshot · ' : ''}exact session, not account-wide` : 'no current context report'}</small></div>
      ${liveAgent ? `<button class="action-button" data-action="agent-detail" data-session="${escapeHtml(session)}" type="button">Open</button>` : '<span class="status neutral">closed</span>'}
    </article>
  `;
}

function codexUsageTicketRow(ticket) {
  const state = ticket.state === 'complete'
    ? 'Complete'
    : ticket.state === 'in_progress'
      ? 'In progress'
      : ticket.state === 'review'
        ? 'Review boundary'
        : 'Unverified boundary';
  const observedAt = ticket.lastEventAt || ticket.endedAt || ticket.sentAt;
  return `
    <article class="usage-day-row">
      <div><strong>${escapeHtml(displayNameForSession(ticket.session))}</strong><small>${escapeHtml(state)} · ${escapeHtml(observedAt ? missionTimeLabel(observedAt) : 'no token event')}</small></div>
      <div><strong>${escapeHtml(formatTokenCount(ticket.tokens?.totalTokens))}</strong><small>${escapeHtml(usageTokenDetail(ticket.tokens))}</small></div>
      <div><strong>${escapeHtml(`${Number(ticket.eventCount || 0)} token event${Number(ticket.eventCount || 0) === 1 ? '' : 's'}`)}</strong><small>${escapeHtml(`${Number(ticket.sourceIds?.length || 0)} rollout${Number(ticket.sourceIds?.length || 0) === 1 ? '' : 's'}`)}</small></div>
    </article>
  `;
}

function renderCodexUsageTools(snapshot) {
  if (!els.usage) return;
  const stats = snapshot.codexStats;
  if (!stats?.trackingStartedAt) {
    els.usage.innerHTML = `
      <section class="tool-panel usage-empty">
        <div class="panel-head compact"><div><h2>Codex usage history</h2><p>Passive per-agent tracking; no terminal commands are sent.</p></div><span class="status neutral">pending</span></div>
        <p>Daily history starts after the dashboard backend loads usage-history support. Existing per-session totals remain visible in each terminal.</p>
      </section>
    `;
    return;
  }
  const today = stats.today || { date: new Date().toISOString().slice(0, 10), tokens: {}, agents: [] };
  const days = Array.isArray(stats.days) ? stats.days.slice(0, 30) : [];
  const agents = Array.isArray(stats.agents) ? stats.agents : [];
  const tickets = Array.isArray(stats.tickets) ? stats.tickets.slice(0, 20) : [];
  const liveAgents = new Map((snapshot.agents || []).map((agent) => [agent.session, agent]));
  const account = snapshot.codexUsage?.account || null;
  const accountObservedAt = snapshot.codexUsage?.observedAt || null;
  const accountSnapshot = accountLimitSnapshot(account, accountObservedAt);
  const accountLimit = accountSnapshot.limit;
  const accountResetAt = accountLimit?.resetsAt ? new Date(accountLimit.resetsAt) : null;
  const accountResetLabel = accountResetAt && Number.isFinite(accountResetAt.getTime())
    ? `resets ${accountResetAt.toLocaleString()}`
    : 'reset not reported';
  const accountPools = Array.isArray(snapshot.codexUsage?.pools) ? snapshot.codexUsage.pools : [];
  const maximumDailyTokens = Math.max(1, ...days.map((day) => Number(day.tokens?.totalTokens) || 0));
  els.usage.innerHTML = `
    <section class="usage-summary-grid">
      <div class="usage-summary-card"><span>Host-local throughput today · UTC</span><strong>${escapeHtml(formatTokenCount(today.tokens?.totalTokens))}</strong><small>${escapeHtml(usageTokenDetail(today.tokens))}</small></div>
      <div class="usage-summary-card"><span>Host-local throughput across ${escapeHtml(stats.periodDays)} tracked day${stats.periodDays === 1 ? '' : 's'}</span><strong>${escapeHtml(formatTokenCount(stats.tokens?.totalTokens))}</strong><small>${stats.methodology?.coverage === 'complete' ? 'replayed rollout events' : 'partial observed deltas'}, including cached input</small></div>
      <div class="usage-summary-card"><span>Session histories</span><strong>${escapeHtml(agents.length)}</strong><small>tmux names · ledger updated ${escapeHtml(missionTimeLabel(stats.updatedAt))}</small></div>
      <div class="usage-summary-card"><span>Account-wide weekly snapshot</span><strong>${escapeHtml(accountSnapshot.value === 'Not reported' ? 'Pending' : accountSnapshot.value)}</strong><small>${accountLimit ? `${escapeHtml(accountSnapshot.freshnessText)} · ${escapeHtml(Math.round(accountLimit.usedPercent))}% used · ${escapeHtml(accountResetLabel)}` : 'latest shared rate-limit report'}</small></div>
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Account-wide limit snapshots</h2><p>Shared by the signed-in Codex account within each reported pool.</p></div><span class="status ${accountLimit ? (accountSnapshot.freshness.stale ? 'warn' : 'good') : 'neutral'}">${accountObservedAt ? escapeHtml(`${accountSnapshot.freshness.stale ? 'stale · ' : ''}${missionTimeLabel(accountObservedAt)}`) : 'pending'}</span></div>
      <div class="inspector-usage-pools">${accountPools.length ? accountPools.map((pool) => { const poolSnapshot = accountLimitSnapshot(pool.account, pool.observedAt); return `<div><strong>${escapeHtml(pool.account?.limitName || (pool.account?.limitId === 'codex' ? 'Weekly limit' : pool.account?.limitId) || 'Codex limit')}</strong><small>${poolSnapshot.limit ? `${escapeHtml(poolSnapshot.value)} · ${escapeHtml(Math.round(poolSnapshot.limit.usedPercent))}% used · ${escapeHtml(usageWindowLabel(poolSnapshot.limit.windowMinutes))} · ${escapeHtml(poolSnapshot.freshnessText)}` : 'Limit window not reported'}</small></div>`; }).join('') : '<div><strong>Waiting for account telemetry</strong><small>No passive rate-limit event has been observed.</small></div>'}</div>
      <p class="usage-privacy-note">These are last-known passive snapshots, not continuous polling. Stale values remain visible but are labeled as last reported. Only pools present in live structured telemetry appear here; Codex <code>/status</code> can show additional model-specific pools.</p>
      <p class="usage-privacy-note"><strong>Different from Codex <code>/usage</code>:</strong> the local totals on this page measure observed processing by rollouts running on this host. Codex <code>/usage</code> reports account token activity across the signed-in account.</p>
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Per-session stats</h2><p>Context comes from the current exact rollout. Processed deltas are grouped by tmux session name across tracked rollouts; account limits do not.</p></div><strong>${escapeHtml(agents.length)}</strong></div>
      <div class="usage-agent-list">${agents.length ? agents.map((agent) => codexUsageAgentRow(agent, liveAgents)).join('') : '<div class="rail-empty">Waiting for the first structured token event from an agent.</div>'}</div>
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Per-ticket usage</h2><p>Token-event deltas are assigned only when exactly one queued ticket owns that agent and timestamp.</p></div><strong>${escapeHtml(tickets.length)}</strong></div>
      <div class="usage-day-list">${tickets.length ? tickets.map(codexUsageTicketRow).join('') : '<div class="rail-empty">No queued ticket has a replayed token event yet.</div>'}</div>
      <p class="usage-privacy-note">Manual work remains in the agent totals but is not falsely assigned to a ticket. Review and unverified boundaries stay labeled instead of being presented as exact completions.</p>
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Daily history</h2><p>Last ${escapeHtml(days.length)} tracked UTC day${days.length === 1 ? '' : 's'}; retained for ${escapeHtml(stats.retentionDays)} days.</p></div><span class="status good">numeric only</span></div>
      <div class="usage-day-list">${days.map((day) => `
        <article class="usage-day-row">
          <div><strong>${escapeHtml(usageDateLabel(day.date, today.date))}</strong><small>${escapeHtml(day.date)} · ${escapeHtml(day.agentCount)} tmux session${day.agentCount === 1 ? '' : 's'}</small></div>
          <progress max="${maximumDailyTokens}" value="${Math.max(0, Number(day.tokens?.totalTokens) || 0)}" aria-label="${escapeHtml(day.date)} ${escapeHtml(formatTokenCount(day.tokens?.totalTokens))} processed tokens"></progress>
          <div><strong>${escapeHtml(formatTokenCount(day.tokens?.totalTokens))}</strong><small>${escapeHtml(usageTokenDetail(day.tokens))}</small></div>
        </article>
      `).join('')}</div>
      <p class="usage-privacy-note">Tracking began ${escapeHtml(new Date(stats.trackingStartedAt).toLocaleString())}. ${stats.methodology?.coverage === 'complete' ? 'PaneFleet replays every available token event from each rollout already proven to belong to an agent, including the first event, then resumes incrementally from a durable byte offset.' : 'Historical replay is not complete yet, so these remain lower-bound observed deltas.'} Cached input is included. These are neither complete account activity nor account-limit consumption. The ledger stores bounded numeric counters and queue identifiers only—no prompt or response text—and never types <code>/status</code> or <code>/usage</code>.</p>
    </section>
  `;
}

function renderToolsOverview(snapshot, services, attention) {
  const runningServices = services.filter((service) => service.running).length;
  const unhealthyServices = services.filter((service) => serviceToolsPresentation(service).fault);
  const notifications = normalizedNotifications(snapshot);
  const queuedPrompts = Number(snapshot.promptQueue?.counts?.pending || 0);
  const workers = (snapshot.agents || []).filter((agent) => !isReviewAgent(agent));
  const workingAgents = workers.filter((agent) => agent.agentStatus?.state === 'busy').length;
  const waitingAgents = workers.filter((agent) => agent.agentStatus?.state === 'waiting').length;
  const memory = hostMemoryStats(snapshot.host);
  const storage = hostStorageStats(snapshot.host);
  const visibleAttention = attention.items.filter((item) => item.requiresDecision || ['bad', 'warn'].includes(item.tone));
  const attentionServiceIds = new Set(visibleAttention.map((item) => item.serviceId).filter(Boolean));
  const extraServiceFaults = unhealthyServices.filter((service) => !attentionServiceIds.has(service.id));
  const hostErrors = Array.isArray(snapshot.errors) ? snapshot.errors : [];
  const issueCount = visibleAttention.length + extraServiceFaults.length + hostErrors.length;
  const liveApps = uniqueLiveServices(services).slice(0, 6);
  const todayTokens = Number(snapshot.codexStats?.today?.tokens?.totalTokens) || 0;
  els.toolsOverview.innerHTML = `
    <section class="tools-overview-grid">
      <button class="tool-summary-card ${unhealthyServices.length ? 'bad' : 'good'}" data-action="tool-view" data-tool-view="services" type="button"><span>Apps live</span><strong>${runningServices}/${services.length}</strong><small>${unhealthyServices.length ? `${unhealthyServices.length} need attention` : 'All live apps look normal'}</small></button>
      <button class="tool-summary-card ${waitingAgents ? 'warn' : workingAgents ? 'busy' : 'good'}" data-action="open-terminals" type="button"><span>Agents</span><strong>${workingAgents}</strong><small>${waitingAgents ? `${waitingAgents} waiting for input` : `${workers.length} available terminals`}</small></button>
      <button class="tool-summary-card ${queuedPrompts ? 'busy' : 'good'}" data-action="open-queue" type="button"><span>Queue</span><strong>${queuedPrompts}</strong><small>${queuedPrompts ? 'waiting or in progress' : 'Nothing queued'}</small></button>
      <button class="tool-summary-card good" data-action="tool-view" data-tool-view="usage" type="button"><span>Local throughput today</span><strong>${escapeHtml(formatTokenCount(todayTokens))}</strong><small>${snapshot.codexStats?.methodology?.coverage === 'complete' ? 'Replayed rollout events' : 'Partial observed deltas'} · cached included</small></button>
      <button class="tool-summary-card ${memory.percent >= 90 ? 'bad' : memory.percent >= 80 ? 'warn' : 'good'}" data-action="tool-view" data-tool-view="system" type="button"><span>Memory used</span><strong>${memory.percent}%</strong><small>${escapeHtml(`${formatBytes(memory.free)} available`)}</small></button>
      <button class="tool-summary-card ${!storage.available || storage.percent >= 95 ? 'bad' : storage.percent >= 85 ? 'warn' : 'good'}" data-action="tool-view" data-tool-view="system" type="button"><span>Root disk used</span><strong>${storage.available ? `${storage.percent}%` : '—'}</strong><small>${escapeHtml(storage.available ? `${formatBytes(storage.free)} available` : 'Disk metric unavailable')}</small></button>
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Needs action</h2><p>Only exceptions and decisions are shown here.</p></div><strong>${issueCount}</strong></div>
      ${issueCount ? `<div class="attention-list">
        ${visibleAttention.slice(0, 8).map((item) => `<button class="attention-item ${escapeHtml(item.tone)}" data-action="attention-open" data-attention-id="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join('')}
        ${extraServiceFaults.slice(0, 4).map((service) => `<button class="attention-item bad" data-action="switch-services" data-service="${escapeHtml(service.id)}" type="button"><strong>${escapeHtml(service.label || service.id)}</strong><span>${escapeHtml(`${serviceToolsPresentation(service).closedPorts.length} expected port${serviceToolsPresentation(service).closedPorts.length === 1 ? '' : 's'} closed`)}</span></button>`).join('')}
        ${hostErrors.slice(0, 3).map((error) => `<article class="attention-item bad"><strong>Host snapshot error</strong><span>${escapeHtml(error?.message || error)}</span></article>`).join('')}
      </div>` : '<div class="pulse-clear"><strong>Nothing needs action</strong><span>Apps, queue signals, and host checks look normal.</span></div>'}
    </section>
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Open a live app</h2><p>Launch it here or open its controls in Apps.</p></div><button class="action-button" data-action="tool-view" data-tool-view="services" type="button">All apps</button></div>
      <div class="pulse-app-list">${liveApps.length ? liveApps.map(pulseServiceRow).join('') : '<div class="rail-empty">No live app links found.</div>'}</div>
    </section>
    ${notifications.length ? `
      <section class="tool-panel tools-notifications">
        <div class="panel-head compact"><div><h2>Notifications</h2><p>Open or snooze without leaving the terminal workspace.</p></div><strong>${notifications.length}</strong></div>
        <div class="notification-list">${notifications.slice(0, 4).map(notificationCard).join('')}</div>
        ${notifications.length > 4 ? `<button class="action-button" data-action="notifications-focus" type="button">Open all ${notifications.length}</button>` : ''}
      </section>
    ` : ''}
    <section class="tool-panel">
      <div class="panel-head compact"><div><h2>Snapshot</h2><p>Updated ${escapeHtml(snapshot.host?.time ? new Date(snapshot.host.time).toLocaleTimeString() : 'now')}</p></div><span class="status ${escapeHtml(hostErrors.length ? 'bad' : 'good')}">${hostErrors.length ? 'check host' : 'current'}</span></div>
      <div class="actions compact-actions"><button class="action-button" data-action="dashboard-refresh" type="button">Refresh now</button><button class="action-button" data-action="tool-view" data-tool-view="system" type="button">Open host health</button></div>
    </section>
  `;
}

function networkEventTime(value) {
  const timestamp = new Date(String(value || ''));
  return Number.isNaN(timestamp.getTime()) ? 'unknown time' : timestamp.toLocaleString();
}

function networkConnectionRow(connection, { recent = false } = {}) {
  const direction = String(connection.direction || 'unknown');
  const attribution = connection.attribution || {};
  const actor = direction === 'inbound'
    ? connection.remoteAddress
    : direction === 'outbound'
      ? attribution.service || connection.process || 'unidentified endpoint'
      : connection.process || connection.localAddress || 'unknown process';
  const target = connection.destination || `${connection.remoteAddress || '?'}:${connection.remotePort ?? '?'}`;
  const timing = recent && connection.endedAt
    ? `seen ${networkEventTime(connection.firstSeenAt)} · ended ${networkEventTime(connection.endedAt)}`
    : `since ${networkEventTime(connection.firstSeenAt)} · last seen ${networkEventTime(connection.lastSeenAt)}`;
  return `
    <article class="network-event ${escapeHtml(direction)}">
      <div class="network-event-head"><strong>${escapeHtml(actor)}</strong><span class="status ${direction === 'inbound' ? 'busy' : direction === 'outbound' ? 'good' : 'neutral'}">${escapeHtml(direction)}</span></div>
      <p>${escapeHtml(direction === 'outbound' ? `observed endpoint ${target}` : `connected to ${target}`)}</p>
      ${direction === 'outbound' && attribution.basis ? `<small class="network-attribution"><strong>${escapeHtml(`${attribution.provider || 'Unknown provider'} · ${attribution.confidence || 'unknown'} confidence`)}</strong>${escapeHtml(` — ${attribution.basis}`)}</small>` : ''}
      <small>${escapeHtml(connection.process || 'unknown process')}${connection.pid ? ` · pid ${escapeHtml(connection.pid)}` : ''} · ${escapeHtml(timing)}</small>
    </article>
  `;
}

function sshConnectionRow(event) {
  const accepted = event.kind === 'accepted';
  const label = accepted ? 'accepted' : event.kind === 'invalid_user' ? 'invalid user' : 'failed';
  return `
    <article class="network-event ssh ${accepted ? 'accepted' : 'failed'}">
      <div class="network-event-head"><strong>${escapeHtml(event.remoteAddress || 'unknown peer')}</strong><span class="status ${accepted ? 'good' : 'bad'}">${escapeHtml(label)}</span></div>
      <p>${escapeHtml(event.user || 'unknown user')} → ${escapeHtml(event.destination || 'SSH :22')}</p>
      <small>${escapeHtml(event.method || 'unknown method')} · ${escapeHtml(networkEventTime(event.at))}</small>
    </article>
  `;
}

function renderSecurityTools(security = {}) {
  const sshRescue = security?.sshRescue || {};
  const monitor = security?.networkMonitor || {};
  const counts = monitor.counts || {};
  const activeConnections = Array.isArray(monitor.activeConnections) ? monitor.activeConnections : [];
  const connectionSort = (left, right) => String(left.destination || '').localeCompare(String(right.destination || ''))
    || String(left.remoteAddress || '').localeCompare(String(right.remoteAddress || ''));
  const inboundConnections = activeConnections.filter((connection) => connection.direction === 'inbound').sort(connectionSort);
  const outboundConnections = activeConnections.filter((connection) => connection.direction === 'outbound').sort((left, right) =>
    String(left.attribution?.service || '').localeCompare(String(right.attribution?.service || '')) || connectionSort(left, right));
  const localConnections = activeConnections.filter((connection) => connection.direction === 'local').sort(connectionSort);
  const activeIds = new Set(activeConnections.map((connection) => connection.id));
  const recentlyClosed = (Array.isArray(monitor.recentConnections) ? monitor.recentConnections : [])
    .filter((connection) => connection.endedAt && !activeIds.has(connection.id));
  const sshEvents = Array.isArray(monitor.sshEvents) ? monitor.sshEvents : [];
  const exactPublicIpAccess = state.snapshot?.capabilities?.exactPublicIpAccess === true;
  const ipRuleManagement = state.snapshot?.capabilities?.ipRuleManagement === true;
  const safeIpRuleControls = exactPublicIpAccess && ipRuleManagement;
  const accessAction = sshRescueAction(sshRescue, safeIpRuleControls);
  const warnings = normalizedAttention(state.snapshot || {}).items.filter((item) => item.kind.includes('security'));
  els.security.innerHTML = `
    <section class="tool-panel network-monitor-panel">
      <div class="panel-head"><div><span class="eyebrow">Host network</span><h2>Connection monitor</h2><p>Who connected, when, and which local service or remote endpoint was reached.</p></div><span class="status ${monitor.status === 'monitoring' ? 'good' : monitor.status === 'disabled' ? 'neutral' : 'bad'}">${escapeHtml(monitor.status || 'unavailable')}</span></div>
      <div class="network-metrics">
        <div><span>Inbound</span><strong>${Number(counts.inbound || 0)}</strong></div>
        <div><span>Outbound</span><strong>${Number(counts.outbound || 0)}</strong></div>
        <div><span>SSH failures · 24h</span><strong>${Number(counts.sshFailures24h || 0)}</strong></div>
        <div><span>Active flags</span><strong>${Number(counts.activeFlags || 0)}</strong></div>
      </div>
      <p class="security-explainer">TCP sockets and SSH authentication events are retained as bounded metadata only. Registered ports, successful SSH peers, and common web/DNS/NTP egress form the baseline; unusual activity is flagged but never blocked automatically.</p>
      <div class="network-direction-grid">
        <div class="network-section"><div class="network-section-head"><h3>Inbound now</h3><span>${inboundConnections.length}</span></div><div class="network-event-list">${inboundConnections.length ? inboundConnections.slice(0, 20).map((connection) => networkConnectionRow(connection)).join('') : '<div class="rail-empty">No inbound TCP connections captured.</div>'}</div></div>
        <div class="network-section"><div class="network-section-head"><h3>Outbound now</h3><span>${outboundConnections.length}</span></div><div class="network-event-list">${outboundConnections.length ? outboundConnections.slice(0, 20).map((connection) => networkConnectionRow(connection)).join('') : '<div class="rail-empty">No outbound TCP connections captured.</div>'}</div></div>
      </div>
      ${localConnections.length ? `<div class="network-section"><div class="network-section-head"><h3>Local now</h3><span>${localConnections.length}</span></div><div class="network-event-list">${localConnections.slice(0, 20).map((connection) => networkConnectionRow(connection)).join('')}</div></div>` : ''}
      ${sshEvents.length ? `<div class="network-section"><div class="network-section-head"><h3>Recent SSH activity</h3><span>${Number(counts.sshEvents ?? sshEvents.length)}</span></div><div class="network-event-list">${sshEvents.map(sshConnectionRow).join('')}</div></div>` : ''}
      ${recentlyClosed.length ? `<details class="network-history"><summary>Recently closed connections (${Number(counts.recentClosed ?? recentlyClosed.length)})</summary><div class="network-event-list">${recentlyClosed.map((connection) => networkConnectionRow(connection, { recent: true })).join('')}</div></details>` : ''}
    </section>
    <section class="tool-panel">
      <div class="panel-head"><div><span class="eyebrow">Inbound access</span><h2>Exact IP rules</h2><p>${escapeHtml(sshRescueStatusLabel(sshRescue, safeIpRuleControls))}</p></div><span class="status ${warnings.length ? 'warn' : 'good'}">${warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'clear'}</span></div>
      <p class="security-explainer">PaneFleet only manages its allowlisted security-group rules. Current browser and active SSH addresses are protected during cleanup.</p>
      <div class="security-actions">
        <button class="action-button ${escapeHtml(accessAction.tone)}" data-action="${escapeHtml(accessAction.action)}" title="${escapeHtml(accessAction.title)}" ${accessAction.disabled ? 'disabled' : ''} type="button">${escapeHtml(accessAction.label)}</button>
        <button class="action-button" data-action="ip-rules-view" ${ipRuleManagement ? '' : 'disabled'} type="button">View inbound rules</button>
        <button class="action-button warn" data-action="ip-rules-cleanup" ${ipRuleManagement ? '' : 'disabled'} type="button">Clean managed IPs</button>
      </div>
    </section>
    ${warnings.length ? `<section class="tool-panel"><div class="panel-head compact"><div><h2>Warnings</h2><p>Open the exact source for context.</p></div></div><div class="attention-list">${warnings.map((item) => `<button class="attention-item ${escapeHtml(item.tone)}" data-action="attention-open" data-attention-id="${escapeHtml(item.id)}" type="button"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></button>`).join('')}</div></section>` : ''}
  `;
}

function hasUnresolvedPromptPlaceholder(value) {
  return /(^|\s)@(?:filename|file|path|todo|target)\b/i.test(String(value || ''));
}

function runtimeNextAction(status) {
  if (status?.state === 'waiting') return 'Open details and respond, or interrupt if it is stale.';
  if (status?.tone === 'bad') return 'Open details and inspect the recent output before giving it more work.';
  if (status?.state === 'busy') return 'Let it continue, but open details if the last signal does not change.';
  if (status?.state === 'idle') return 'Review output and either close it or send a new prompt.';
  return 'Keep monitoring.';
}

function observationNextAction(brief, status, focus) {
  if (hasUnresolvedPromptPlaceholder(focus)) {
    return 'Send a corrected prompt with the real file/path, or open the terminal to inspect what it did.';
  }
  const value = brief.nextAction || '';
  if (!value || /passive history/i.test(value)) return runtimeNextAction(status);
  return value;
}

function renderServices(services) {
  const groups = new Map(['attention', 'live', 'available', 'discovered'].map((group) => [group, []]));
  prioritizedServices(services).forEach((service) => groups.get(serviceToolsPresentation(service).group)?.push(service));
  const listeningPorts = new Set(services.flatMap((service) => serviceToolsPresentation(service).openPorts));
  const runningCount = services.filter((service) => service.running).length;
  const attentionCount = groups.get('attention').length;
  const availableCount = groups.get('available').length;
  const groupCopy = {
    attention: ['Needs attention', 'Live apps with a failed health check or an expected port closed.'],
    live: ['Live now', 'Registered apps you can open or control.'],
    available: ['Ready when needed', 'Known apps and workflows that are currently stopped.'],
    discovered: ['Other live sessions', 'Read-only discoveries with terminal recovery kept separate.']
  };
  const groupMarkup = [...groups.entries()].map(([group, items]) => {
    if (!items.length) return '';
    const [label, description] = groupCopy[group];
    return `
      <section class="tool-panel app-group ${escapeHtml(group)}">
        <div class="panel-head compact"><div><h2>${escapeHtml(label)}</h2><p>${escapeHtml(description)}</p></div><strong>${items.length}</strong></div>
        <div class="app-grid">${items.map(serviceCardMarkup).join('')}</div>
      </section>
    `;
  }).join('');
  els.services.innerHTML = `
    <section class="app-summary-grid" aria-label="App status summary">
      ${digestMetric('Live', `${runningCount}/${services.length}`, 'registered and discovered', attentionCount ? 'busy' : 'good')}
      ${digestMetric('Ready', availableCount, 'known stopped apps', 'neutral')}
      ${digestMetric('Attention', attentionCount, attentionCount ? 'open the first lane' : 'no app faults', attentionCount ? 'bad' : 'good')}
      ${digestMetric('Open ports', listeningPorts.size, 'unique app listeners', 'neutral')}
    </section>
    ${groupMarkup || '<div class="rail-empty">No registered or discovered apps.</div>'}
  `;
}

function serviceCardMarkup(service) {
  const presentation = serviceToolsPresentation(service);
  const portStates = Array.isArray(service.portStates) ? service.portStates : [];
  const liveLinks = normalizedLinks(service).filter((link) => link.listening);
  const builtInActions = service.command && service.session && !service.discovered ? builtinServiceActions(service) : '';
  const customActions = (service.actions || []).map((action) => `
    <button class="action-button ${action.confirm ? 'warn' : ''}" data-action="service-custom" data-service="${escapeHtml(service.id)}" data-custom-action="${escapeHtml(action.id)}" data-confirm="${action.confirm ? '1' : ''}" data-requires-public-ip="${action.requiresPublicIp ? '1' : ''}" type="button">${escapeHtml(action.label)}</button>
  `).join('');
  const peekAction = service.session && (service.managed || service.discovered)
    ? `<button class="action-button primary" data-action="peek" data-session="${escapeHtml(service.session)}" type="button">Peek output</button>`
    : '';
  const recoveryActions = service.discovered && service.session
    ? `<div class="app-recovery-actions"><button class="action-button" data-action="copy-attach" data-session="${escapeHtml(service.session)}" type="button">Copy attach command</button><button class="action-button warn" data-action="session-interrupt" data-session="${escapeHtml(service.session)}" type="button">Send Ctrl-C</button><button class="action-button danger" data-action="session-stop" data-session="${escapeHtml(service.session)}" type="button">Stop tmux session</button></div>`
    : '';
  const source = service.discovered ? 'auto discovery' : service.external ? 'registry / external' : 'registry';
  return `
    <article class="app-card ${escapeHtml(presentation.tone)}" data-service-id="${escapeHtml(service.id)}" tabindex="-1">
      <div class="app-card-head">
        <div><h3>${escapeHtml(service.label || service.id)}</h3><p>${escapeHtml(service.discovered ? 'Discovered tmux app' : shortPath(service.cwd) || 'Registered workflow')}</p></div>
        <span class="status ${escapeHtml(presentation.tone)}">${escapeHtml(service.stateLabel || (service.running ? 'running' : 'stopped'))}</span>
      </div>
      <div class="app-port-list">${portStates.length ? portStates.map((item) => `<span class="app-port ${item.listening ? 'open' : 'closed'}">:${escapeHtml(item.port)} ${item.listening ? 'open' : 'closed'}</span>`).join('') : '<span class="app-port neutral">No fixed port</span>'}</div>
      ${liveLinks.length ? `<div class="link-row">${liveLinks.map((link, index) => serviceLinkButton(link, `app-${service.id}-${index}`)).join('')}</div>` : ''}
      ${(peekAction || builtInActions || customActions) ? `<div class="app-card-actions">${peekAction}${builtInActions}${customActions}</div>` : '<p class="app-no-actions">Status only; no allowlisted control is configured.</p>'}
      <details class="app-card-details">
        <summary>Details</summary>
        <div class="meta-grid">
          ${meta('Terminal', service.session || service.sessionPrefixes?.join(', ') || 'none')}
          ${meta('Source', source)}
          ${meta('CPU / memory', cpuMem(service.pane?.primaryProcess))}
          ${meta('Port state', portStates.length ? portStates.map((item) => `${item.port}:${item.listening ? 'open' : 'closed'}`).join(' · ') : 'no fixed ports')}
        </div>
        ${outputBlock('Recent output', service.lastOutput || service.lastLine, service.redactedPreviewCount)}
        ${codeBlock('Command / start command', service.pane?.primaryProcess?.command || service.command || 'No command captured')}
        ${recoveryActions}
      </details>
    </article>
  `;
}

function reviewToolMarkup(review) {
  const sourceCounts = review?.sourceCounts || {};
  const sourceText = [
    `${sourceCounts.agents ?? 0} agents`,
    `${sourceCounts.services ?? 0} services`,
    `${sourceCounts.listeners ?? 0} ports`,
    `${sourceCounts.logs ?? 0} logs`
  ].join(' · ');
  const generated = review?.generatedAt ? new Date(review.generatedAt).toLocaleString() : 'not run yet';
  const inferred = review?.agentStatus;
  const statusClass = inferred ? statusClassName(inferred) : (review?.generatedAt ? 'warn' : 'bad');
  const statusText = inferred?.state
    ? `${inferred.state}${inferred.reason ? ` · ${inferred.reason}` : ''}`
    : review?.generatedAt ? 'context ready' : 'not started';
  return `
    <details id="review-view" class="tool-panel host-review-tool">
      <summary><span><strong>Diagnostic review</strong><small>Generate a fresh bounded host summary when troubleshooting.</small></span><span class="status ${statusClass}">${escapeHtml(statusText)}</span></summary>
      <article class="host-review-body">
      <div class="row-head">
        <div class="row-title">
          <h2>Review agent</h2>
          <p>${escapeHtml(review?.session || 'codex-orchestrator-review')}</p>
        </div>
      </div>
      <div class="meta-grid">
        ${meta('Last context', generated)}
        ${meta('Sources', sourceText)}
      </div>
      <div class="actions">
        <button class="action-button primary" data-action="review-start" type="button">Generate review</button>
        <button class="action-button" data-action="peek" data-session="${escapeHtml(review?.session || 'codex-orchestrator-review')}" ${review?.running ? '' : 'disabled'} type="button">Open review output</button>
        <button class="action-button" data-action="copy-attach" data-session="${escapeHtml(review?.session || 'codex-orchestrator-review')}" type="button">Copy attach command</button>
      </div>
      </article>
    </details>
  `;
}

function builtinServiceActions(service) {
  if (service.self) {
    return `<button class="action-button" data-action="service-start" data-service="${escapeHtml(service.id)}" ${service.running ? 'disabled' : ''} type="button">Start</button>`;
  }
  const unmanagedDisabled = !service.managed && service.running ? 'disabled title="Port is open but no managed tmux session was found"' : '';
  return `
    <button class="action-button" data-action="service-start" data-service="${escapeHtml(service.id)}" ${service.running ? 'disabled' : ''} type="button">Start</button>
    <button class="action-button warn" data-action="service-restart" data-service="${escapeHtml(service.id)}" ${unmanagedDisabled || (!service.running ? 'disabled' : '')} type="button">Restart</button>
    <button class="action-button danger" data-action="service-stop" data-service="${escapeHtml(service.id)}" ${unmanagedDisabled || (!service.running ? 'disabled' : '')} type="button">Stop</button>
  `;
}

function groupedHostListeners(listeners = [], services = []) {
  const groups = new Map();
  for (const listener of listeners) {
    const port = Number(listener?.port);
    if (!Number.isFinite(port)) continue;
    if (!groups.has(port)) groups.set(port, { port, addresses: new Set(), processes: new Set(), owners: new Set(), exposures: new Set(), pids: new Set() });
    const group = groups.get(port);
    group.addresses.add(String(listener.address || 'unknown'));
    group.exposures.add(listenerExposure(listener.address));
    for (const process of listener.processes || []) {
      if (process?.name) group.processes.add(process.name);
      if (Number.isFinite(Number(process?.pid))) group.pids.add(Number(process.pid));
    }
    for (const service of services) {
      if ((service.portStates || []).some((item) => Number(item.port) === port && item.listening)) group.owners.add(service.label || service.id);
    }
  }
  return [...groups.values()].sort((left, right) => {
    const exposureRank = (item) => item.exposures.has('all-interfaces') ? 0 : item.exposures.has('interface') ? 1 : 2;
    return exposureRank(left) - exposureRank(right) || left.port - right.port;
  });
}

function hostListenerMarkup(listener) {
  const exposure = listener.exposures.has('all-interfaces')
    ? { label: 'All interfaces', tone: 'warn' }
    : listener.exposures.has('interface')
      ? { label: 'One interface', tone: 'neutral' }
      : { label: 'This host only', tone: 'good' };
  const owner = [...listener.owners].join(' + ') || [...listener.processes].join(' + ') || 'Unattributed listener';
  const addresses = [...listener.addresses].join(' · ');
  const link = listener.port === 22 ? '' : serviceLinkButton({ label: 'Open', port: listener.port, path: '/', listening: true }, `host-port-${listener.port}`);
  return `
    <article class="host-listener-row">
      <div class="host-listener-port"><strong>:${escapeHtml(listener.port)}</strong><span class="status ${exposure.tone}">${escapeHtml(exposure.label)}</span></div>
      <div class="host-listener-copy"><strong>${escapeHtml(owner)}</strong><small>${escapeHtml(addresses)}</small></div>
      ${link ? `<div class="host-row-action">${link}</div>` : ''}
    </article>
  `;
}

function friendlyIdentifier(value) {
  const words = String(value || 'unknown action').replace(/[._-]+/g, ' ').trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Unknown action';
}

function processFallbackLabel(process) {
  const command = String(process?.command || process?.raw || '').trim();
  if (/codex-code-mode-host/.test(command)) return 'Codex tool host';
  if (/(?:^|\/)codex(?:\s|$)/.test(command)) return 'Codex agent';
  if (/(?:^|\/)tmux(?:\s|$)/.test(command)) return 'tmux server';
  const executable = command.split(/\s+/, 1)[0].split('/').pop();
  return executable ? friendlyIdentifier(executable) : 'Unknown process';
}

function hostProcessMarkup(process, pidOwners) {
  const label = pidOwners.get(Number(process.pid)) || processFallbackLabel(process);
  const memory = Number.isFinite(Number(process.rssKb)) ? formatBytes(Number(process.rssKb) * 1024) : 'n/a';
  return `
    <article class="host-process-row">
      <div><strong>${escapeHtml(label)}</strong><small>pid ${escapeHtml(process.pid || '?')} · ${escapeHtml(process.etime || 'runtime unknown')}</small></div>
      <div class="host-process-metrics"><span>CPU <strong>${escapeHtml(process.cpu ?? '?')}%</strong></span><span>Memory <strong>${escapeHtml(process.mem ?? '?')}%</strong></span><small>${escapeHtml(memory)}</small></div>
    </article>
  `;
}

function hostAuditMarkup(item) {
  return `
    <article class="host-audit-row">
      <div><strong>${escapeHtml(friendlyIdentifier(item.action))}</strong><small>${escapeHtml(item.target || 'host')} · ${escapeHtml(item.time ? new Date(item.time).toLocaleString() : 'time unavailable')}</small></div>
      <span class="status ${item.ok ? 'good' : 'bad'}">${item.ok ? 'ok' : 'failed'}</span>
      ${item.detail ? `<details><summary>Details</summary><p class="mono wrap">${escapeHtml(item.detail)}</p></details>` : ''}
    </article>
  `;
}

function renderHostTools(snapshot, services) {
  const host = snapshot.host || {};
  const memory = hostMemoryStats(host);
  const storage = hostStorageStats(host);
  const swap = hostSwapStats(host);
  const load = Array.isArray(host.loadavg) ? host.loadavg : [];
  const listeners = groupedHostListeners(snapshot.listeners, services);
  const publicListeners = listeners.filter((item) => item.exposures.has('all-interfaces'));
  const localListeners = listeners.filter((item) => !item.exposures.has('all-interfaces'));
  const pidOwners = new Map();
  listeners.forEach((listener) => {
    const owner = [...listener.owners].join(' + ');
    if (owner) listener.pids.forEach((pid) => pidOwners.set(pid, owner));
  });
  const processes = Array.isArray(snapshot.topProcesses) ? snapshot.topProcesses.slice(0, 8) : [];
  const audit = Array.isArray(snapshot.audit) ? snapshot.audit.slice(0, 10) : [];
  const auditFailures = audit.filter((item) => item.ok === false).length;
  const controlPlane = host.controlPlane || {};
  els.system.innerHTML = `
    <section class="tool-panel host-health-panel">
      <div class="panel-head"><div><span class="eyebrow">Host health</span><h2>${escapeHtml(host.hostname || 'This host')}</h2><p>Health first; raw diagnostics stay out of the way.</p></div><span class="status ${snapshot.errors?.length ? 'bad' : 'good'}">${snapshot.errors?.length ? 'check needed' : 'healthy'}</span></div>
      <div class="host-health-grid">
        ${digestMetric('Memory', `${memory.percent}%`, `${formatBytes(memory.free)} available`, memory.percent >= 90 ? 'bad' : memory.percent >= 80 ? 'busy' : 'good')}
        ${digestMetric('Root disk', storage.available ? `${storage.percent}%` : '—', storage.available ? `${formatBytes(storage.free)} available on /` : 'metric unavailable', !storage.available || storage.percent >= 95 ? 'bad' : storage.percent >= 85 ? 'busy' : 'good')}
        ${digestMetric('Swap', swap.total ? `${swap.percent}%` : 'Off', swap.total ? `${formatBytes(swap.used)} of ${formatBytes(swap.total)}` : 'no active swap reported', !swap.total || swap.percent >= 85 ? 'bad' : swap.percent >= 70 ? 'busy' : 'good')}
        ${digestMetric('Load · 1m', Number(load[0] || 0).toFixed(2), `5m ${Number(load[1] || 0).toFixed(2)} · 15m ${Number(load[2] || 0).toFixed(2)}`, 'neutral')}
        ${digestMetric('Uptime', formatUptime(host.uptimeSeconds || 0), host.platform || 'platform unavailable', 'neutral')}
        ${digestMetric('Control plane', controlPlane.supervised ? 'Supervised' : 'Check', controlPlane.isolatedFromWorkloadTmux ? 'isolated from workload tmux' : 'isolation not confirmed', controlPlane.supervised && controlPlane.isolatedFromWorkloadTmux ? 'good' : 'bad')}
      </div>
      <div class="actions compact-actions"><button class="action-button" data-action="dashboard-refresh" type="button">Refresh snapshot</button></div>
    </section>
    <div class="host-section-grid">
      <section id="ports-view" class="tool-panel">
        <div class="panel-head compact"><div><h2>Listening ports</h2><p>What is bound locally and which app owns it.</p></div><strong>${listeners.length}</strong></div>
        <p class="host-exposure-note"><strong>${publicListeners.length} all-interface</strong> · ${localListeners.length} local/interface. An all-interface bind is not proof of public reachability; Security shows actual connections and access rules.</p>
        <div class="host-list">${listeners.length ? listeners.map(hostListenerMarkup).join('') : '<div class="rail-empty">No TCP listeners found.</div>'}</div>
      </section>
      <section id="processes-view" class="tool-panel">
        <div class="panel-head compact"><div><h2>Resource pressure</h2><p>Highest memory consumers with recognizable names.</p></div><strong>${processes.length}</strong></div>
        <div class="host-list">${processes.length ? processes.map((process) => hostProcessMarkup(process, pidOwners)).join('') : '<div class="rail-empty">No process sample available.</div>'}</div>
      </section>
    </div>
    <section id="audit-view" class="tool-panel">
      <div class="panel-head compact"><div><h2>Recent controls</h2><p>What PaneFleet changed; failures stay visible.</p></div><span class="status ${auditFailures ? 'bad' : 'good'}">${auditFailures ? `${auditFailures} failed` : 'clear'}</span></div>
      <div class="host-audit-list">${audit.length ? audit.map(hostAuditMarkup).join('') : '<div class="rail-empty">No control actions have been audited yet.</div>'}</div>
    </section>
    ${reviewToolMarkup(snapshot.review)}
  `;
}

function meta(label, value, mono = false, large = false) {
  return `
    <div class="meta-item ${large ? 'meta-wide' : ''}">
      <span class="meta-label">${escapeHtml(label)}</span>
      <span class="meta-value ${mono ? 'mono' : ''}" title="${escapeHtml(value)}">${escapeHtml(value ?? 'n/a')}</span>
    </div>
  `;
}

function codeBlock(label, value) {
  return `
    <div class="code-section">
      <span class="meta-label">${escapeHtml(label)}</span>
      <pre>${escapeHtml(value || 'n/a')}</pre>
    </div>
  `;
}

function outputBlock(label, value, redactedCount = 0) {
  if (!value) return '';
  const suffix = redactedCount ? ` · redacted ${redactedCount}` : '';
  return `
    <div class="code-section output-section">
      <span class="meta-label">${escapeHtml(label)}${escapeHtml(suffix)}</span>
      <pre>${escapeHtml(value)}</pre>
    </div>
  `;
}

function workspacePreviewText(draft) {
  if (!draft.workspace || draft.workspace === '__new__') {
    return `New: ~/projects/agent-workspaces/${draft.directoryName || draft.name || state.options.suggestedName || 'agent'}`;
  }
  const match = (state.options.workspaces || []).find((item) => item.path === draft.workspace);
  return match?.label || shortPath(draft.workspace);
}

function workspaceSelectOptions(selected) {
  const groups = new Map();
  for (const item of state.options.workspaces || []) {
    const group = item.group || 'Projects';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  return [...groups.entries()].map(([group, items]) => `
    <optgroup label="${escapeHtml(group)}">
      ${items.map((item) => `<option value="${escapeHtml(item.path)}" ${selected === item.path ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
    </optgroup>
  `).join('');
}

function presetSelectOptions(selected) {
  return (state.options.promptPresets || []).map((preset) => `
    <option value="${escapeHtml(preset.id)}" ${selected === preset.id ? 'selected' : ''}>${escapeHtml(preset.label)}</option>
  `).join('');
}

function modelOption(modelId) {
  return (state.options.models || []).find((model) => model.id === modelId) || null;
}

function modelSelectOptions(selected = '') {
  const configured = state.options.configuredDefault || {};
  const configuredDetail = [configured.modelLabel || configured.model, configured.reasoning]
    .filter(Boolean)
    .join(' · ');
  const defaultLabel = configuredDetail ? `Codex config — ${configuredDetail}` : 'Codex config';
  const options = [
    `<option value="" ${selected ? '' : 'selected'}>${escapeHtml(defaultLabel)}</option>`,
    ...(state.options.models || []).map((model) => `
      <option value="${escapeHtml(model.id)}" ${selected === model.id ? 'selected' : ''}>${escapeHtml(model.label)}</option>
    `)
  ];
  return options.join('');
}

function reasoningEffortsFor(modelId = '') {
  const model = modelOption(modelId);
  const efforts = model?.reasoningEfforts?.length ? model.reasoningEfforts : state.options.reasoningEfforts;
  return efforts?.length ? efforts : ['low', 'medium', 'high', 'xhigh'];
}

function normalizedReasoning(modelId, requested) {
  const efforts = reasoningEffortsFor(modelId);
  if (efforts.includes(requested)) return requested;
  const modelDefault = modelId
    ? modelOption(modelId)?.defaultReasoning
    : state.options.configuredDefault?.reasoning;
  if (modelDefault && efforts.includes(modelDefault)) return modelDefault;
  return efforts.includes('xhigh') ? 'xhigh' : efforts[0];
}

function reasoningSelectOptions(modelId = '', selected = '') {
  const normalized = normalizedReasoning(modelId, selected);
  return reasoningEffortsFor(modelId).map((effort) => `
    <option value="${escapeHtml(effort)}" ${normalized === effort ? 'selected' : ''}>${escapeHtml(effort)}</option>
  `).join('');
}

function syncModelSettings(scope) {
  const modelSelect = scope?.querySelector?.('[data-model-select]');
  const reasoningSelect = scope?.querySelector?.('[data-reasoning-select]');
  if (!modelSelect || !reasoningSelect) return;
  const current = reasoningSelect.value;
  reasoningSelect.innerHTML = reasoningSelectOptions(modelSelect.value, current);
}

function normalizedLinks(service) {
  const portMap = new Map((service.portStates || []).map((item) => [Number(item.port), Boolean(item.listening)]));
  const explicit = (service.links || []).map((link) => ({ ...link, listening: portMap.get(Number(link.port)) ?? false }));
  const linkedPorts = new Set(explicit.map((link) => Number(link.port)).filter(Number.isFinite));
  for (const portState of service.portStates || []) {
    if (portState.port !== 22 && !linkedPorts.has(portState.port)) {
      explicit.push({ label: `Open ${portState.port}`, port: portState.port, path: '/', listening: Boolean(portState.listening) });
    }
  }
  return explicit.filter((link) => Number.isFinite(Number(link.port)));
}

function serviceLinkButton(link, key) {
  const requestedProtocol = String(link.protocol || '').toLowerCase().replace(/:$/, '');
  const pageProtocol = window.location.protocol.replace(':', '');
  const protocol = ['http', 'https', 'exp'].includes(requestedProtocol)
    ? requestedProtocol
    : ['http', 'https'].includes(pageProtocol) ? pageProtocol : 'http';
  const host = window.location.hostname;
  const rawPath = String(link.path ?? '/');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const url = `${protocol}://${host}:${Number(link.port)}${path}`;
  const healthKey = `${key}-${Number(link.port)}`;
  const canCheck = Boolean(link.listening) && (protocol === 'http' || protocol === 'https');
  const initialHealth = link.listening ? 'check' : 'closed';
  return `
    <a class="action-button link-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" data-health-key="${escapeHtml(healthKey)}" data-health-url="${canCheck ? escapeHtml(url) : ''}">
      ${escapeHtml(link.label || `Open ${link.port}`)}
      <span class="health-dot" data-health-dot="${escapeHtml(healthKey)}" data-health="${escapeHtml(initialHealth)}">${escapeHtml(initialHealth)}</span>
    </a>
  `;
}

function scheduleHealthChecks() {
  window.clearTimeout(scheduleHealthChecks.timer);
  scheduleHealthChecks.timer = window.setTimeout(() => {
    for (const link of document.querySelectorAll('[data-health-url]')) {
      const url = link.dataset.healthUrl;
      const key = link.dataset.healthKey;
      if (url && key) checkBrowserReachability(key, url);
    }
  }, 100);
}

async function checkBrowserReachability(key, url) {
  setHealth(key, 'checking');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal });
    setHealth(key, 'reachable');
  } catch {
    setHealth(key, 'blocked');
  } finally {
    window.clearTimeout(timeout);
  }
}

function setHealth(key, status) {
  applyBackgroundDomUpdate(`health:${key}`, () => {
    const escaped = window.CSS?.escape ? CSS.escape(key) : String(key).replaceAll('"', '\\"');
    for (const dot of document.querySelectorAll(`[data-health-dot="${escaped}"]`)) {
      dot.textContent = status;
      dot.dataset.health = status;
    }
  });
}

function safeStorageGet(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

function safeStorageSet(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
    return true;
  } catch {
    // Draft/history persistence is a convenience, never a send prerequisite.
    return false;
  }
}

function syncDashboardTheme({ persist = false } = {}) {
  const presentation = dashboardThemePresentation(state.theme);
  state.theme = presentation.theme;
  document.documentElement.dataset.theme = presentation.theme;
  if (els.themeToggle) {
    els.themeToggle.setAttribute('aria-pressed', String(presentation.theme === 'night'));
    els.themeToggle.setAttribute('aria-label', presentation.label);
    els.themeToggle.title = presentation.label;
    const icon = els.themeToggle.querySelector('[data-theme-icon]');
    if (icon) icon.textContent = presentation.icon;
  }
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = presentation.themeColor;
  if (persist) safeStorageSet(THEME_STORAGE_KEY, presentation.theme);
}

function toggleDashboardTheme() {
  state.theme = dashboardThemePresentation(state.theme).nextTheme;
  syncDashboardTheme({ persist: true });
}

function storageScope(value) {
  return encodeURIComponent(String(value || '').trim() || 'unknown');
}

function projectNotesKey(workspace) {
  return `host-control:project-notes:${storageScope(workspace)}`;
}

function projectNotesScope(target = state.projectDesk.target, context = state.projectDesk.context) {
  return String(context?.workspace?.key ? `project:${context.workspace.key}` : target?.workspace || target?.currentPath || '');
}

function adoptProjectNotesScope(target, context) {
  const nextScope = projectNotesScope(target, context);
  if (!target || !nextScope || nextScope === state.projectDesk.notesScope) return;
  const stored = safeStorageGet(projectNotesKey(nextScope));
  if (!state.projectDesk.notesDirty && stored) {
    els.projectNotes.value = stored.slice(0, PROJECT_NOTES_MAX);
  } else if (els.projectNotes.value) {
    safeStorageSet(projectNotesKey(nextScope), els.projectNotes.value.slice(0, PROJECT_NOTES_MAX));
  }
  state.projectDesk.notesScope = nextScope;
}

function scratchpadDraftKey(target) {
  return `host-control:prompt-scratchpad:${storageScope([
    target?.session,
    target?.sessionCreatedAt,
    target?.paneId,
    target?.tmuxPaneId,
    target?.panePid
  ].join('|'))}`;
}

function loadCustomPromptSnippets() {
  if (Array.isArray(state.projectDesk.customSnippets)) return state.projectDesk.customSnippets;
  try {
    const parsed = JSON.parse(safeStorageGet(SCRATCHPAD_SNIPPETS_KEY, '[]'));
    state.projectDesk.customSnippets = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.text === 'string')
        .map((item) => ({
          id: item.id.slice(0, 120),
          name: item.name.trim().slice(0, 80),
          text: item.text.slice(0, SEND_TEXT_MAX)
        }))
        .filter((item) => item.name && item.text.trim())
        .slice(-SCRATCHPAD_SNIPPET_LIMIT)
      : [];
  } catch {
    state.projectDesk.customSnippets = [];
  }
  return state.projectDesk.customSnippets;
}

function persistCustomPromptSnippets() {
  const snippets = loadCustomPromptSnippets().slice(-SCRATCHPAD_SNIPPET_LIMIT);
  state.projectDesk.customSnippets = snippets;
  safeStorageSet(SCRATCHPAD_SNIPPETS_KEY, JSON.stringify(snippets));
}

function promptSnippetCatalog() {
  const builtIns = (state.options.promptPresets || [])
    .filter((item) => item && typeof item.prompt === 'string' && item.prompt.trim())
    .map((item, index) => ({
      id: `preset:${String(item.id || index)}`,
      name: String(item.label || item.id || `Preset ${index + 1}`),
      text: item.prompt.slice(0, SEND_TEXT_MAX),
      builtIn: true
    }));
  const custom = loadCustomPromptSnippets().map((item) => ({ ...item, id: `custom:${item.id}`, builtIn: false }));
  return [...builtIns, ...custom];
}

function selectedPromptSnippet() {
  const selected = els.scratchpadSnippetSelect.value;
  return promptSnippetCatalog().find((item) => item.id === selected) || null;
}

function renderPromptSnippetOptions(preferred = '') {
  const catalog = promptSnippetCatalog();
  const signature = JSON.stringify(catalog.map((item) => [item.id, item.name, item.text]));
  const current = preferred || els.scratchpadSnippetSelect.value;
  if (signature !== state.projectDesk.snippetSignature) {
    const builtIns = catalog.filter((item) => item.builtIn);
    const custom = catalog.filter((item) => !item.builtIn);
    els.scratchpadSnippetSelect.innerHTML = [
      '<option value="">Choose a snippet</option>',
      builtIns.length ? `<optgroup label="Built in">${builtIns.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</optgroup>` : '',
      custom.length ? `<optgroup label="Saved by you">${custom.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</optgroup>` : ''
    ].join('');
    state.projectDesk.snippetSignature = signature;
  }
  if (catalog.some((item) => item.id === current)) els.scratchpadSnippetSelect.value = current;
  else els.scratchpadSnippetSelect.value = '';
}

function exactAgentForTerminal(item) {
  if (!item?.session || item.mode === 'static') return null;
  const agents = (state.snapshot?.agents || []).filter((agent) => agent.session === item.session && !isReviewAgent(agent));
  const missionPaneId = activeMissionForAgentSession(item.session)?.assignedPaneId || '';
  const expectedPaneId = item.paneId || missionPaneId;
  if (expectedPaneId) return agents.find((agent) => agent.id === expectedPaneId) || null;
  const promptable = agents.filter((agent) => agent.canSend);
  return promptable.length === 1 ? promptable[0] : agents.length === 1 ? agents[0] : null;
}

function terminalRestoreRecord(item) {
  if (!item || item.mode === 'static') return null;
  const agent = exactAgentForTerminal(item);
  const identity = normalizedExactPaneIdentity({
    session: agent?.session,
    sessionCreatedAt: agent?.sessionCreatedAt,
    paneId: agent?.id,
    tmuxPaneId: agent?.tmuxPaneId,
    panePid: agent?.panePid
  });
  if (!identity) return null;
  const bounds = item.maximized ? item.restoreBounds : item.fullHeightRestoreBounds || item.freeBounds;
  return {
    ...identity,
    minimized: Boolean(item.minimized),
    refreshPaused: Boolean(item.refreshPaused),
    freeBounds: bounds ? {
      left: Number(bounds.left),
      top: Number(bounds.top),
      width: Number(bounds.width),
      height: Number(bounds.height)
    } : null
  };
}

function persistTerminalWorkspace() {
  if (!state.terminalRestoreApplied || state.terminalRestoreInProgress) return;
  if (isDesktopTerminalMode() && state.terminalLayout === 'free') {
    for (const item of state.terminalWindows.values()) captureTerminalFreeBounds(item);
  }
  const terminals = [...state.terminalWindows.values()]
    .map((item) => ({ item, record: terminalRestoreRecord(item) }))
    .filter(({ record }) => record)
    .slice(0, 8);
  if (!terminals.length) {
    safeStorageSet(TERMINAL_RESTORE_STORAGE_KEY, '');
    return;
  }
  const active = terminals.find(({ item }) => item.id === state.activeTerminalId && !item.minimized)?.record || null;
  safeStorageSet(TERMINAL_RESTORE_STORAGE_KEY, JSON.stringify({
    version: 1,
    active: active ? {
      session: active.session,
      sessionCreatedAt: active.sessionCreatedAt,
      paneId: active.paneId,
      tmuxPaneId: active.tmuxPaneId,
      panePid: active.panePid
    } : null,
    terminals: terminals.map(({ record }) => record)
  }));
}

function restoreTerminalWorkspace() {
  if (state.terminalRestoreApplied || !state.snapshot) return;
  state.terminalRestoreApplied = true;
  state.terminalRestoreInProgress = true;
  const restored = [];
  try {
    for (const record of state.terminalRestoreRecords) {
      const agent = state.snapshot.agents.find((candidate) =>
        !isReviewAgent(candidate)
        && candidate.session === record.session
        && String(candidate.sessionCreatedAt || '') === record.sessionCreatedAt
        && String(candidate.id || '') === record.paneId
        && String(candidate.tmuxPaneId || '') === record.tmuxPaneId
        && Number(candidate.panePid) === record.panePid
      );
      if (!agent) continue;
      const item = startLiveDetail(agent.session, 'agent', 160, agent.id, {
        refreshPaused: record.refreshPaused,
        restoredFreeBounds: record.freeBounds
      });
      if (record.minimized) {
        if (item.timer) window.clearTimeout(item.timer);
        item.timer = null;
        item.minimized = true;
        item.element.classList.add('is-minimized');
      }
      restored.push({ item, record });
    }
    const active = restored.find(({ item, record }) => record.active && !item.minimized)?.item
      || restored.filter(({ item }) => !item.minimized).at(-1)?.item
      || null;
    state.activeTerminalId = active?.id || null;
    state.selectedSession = active?.session || null;
    renderTerminalDock();
    applyTerminalLayout();
    renderTerminalChrome();
    if (active) {
      window.requestAnimationFrame(() => {
        if (!active.element.isConnected) return;
        focusTerminalWindow(active);
        terminalFocusTarget(active).focus({ preventScroll: true });
      });
    }
  } finally {
    state.terminalRestoreRecords = [];
    state.terminalRestoreInProgress = false;
    persistTerminalWorkspace();
  }
}

function focusedLiveTerminal() {
  const active = state.terminalWindows.get(state.activeTerminalId);
  if (active?.session && active.mode !== 'static' && !active.minimized) return active;
  const candidates = [...state.terminalWindows.values()].filter((item) =>
    item.session && item.mode !== 'static' && !item.minimized && item.session === state.selectedSession
  );
  return candidates.at(-1) || null;
}

function projectDeskTargetForTerminal(item) {
  const agent = exactAgentForTerminal(item);
  if (!item || !agent) return null;
  const mission = activeMissionForAgentSession(agent.session);
  const target = {
    terminalId: item.id,
    session: agent.session,
    sessionCreatedAt: String(agent.sessionCreatedAt || ''),
    paneId: String(agent.id || ''),
    tmuxPaneId: String(agent.tmuxPaneId || ''),
    panePid: Number(agent.panePid),
    currentPath: String(agent.currentPath || ''),
    workspace: String(mission?.workspace || agent.currentPath || ''),
    displayName: displayNameForSession(agent.session)
  };
  target.key = [target.session, target.sessionCreatedAt, target.paneId, target.tmuxPaneId, target.panePid, target.currentPath].join('|');
  target.identityComplete = Boolean(normalizedExactPaneIdentity(target));
  return target;
}

function exactTargetIdentityPayload(target) {
  const identity = normalizedExactPaneIdentity(target);
  if (!identity) return {};
  return {
    sessionCreatedAt: identity.sessionCreatedAt,
    paneId: identity.paneId,
    tmuxPaneId: identity.tmuxPaneId,
    panePid: identity.panePid,
    expectedSessionCreatedAt: identity.sessionCreatedAt,
    expectedPaneId: identity.paneId,
    expectedTmuxPaneId: identity.tmuxPaneId,
    expectedPanePid: identity.panePid
  };
}

function projectDeskCapabilityAvailable() {
  return state.snapshot?.capabilities?.projectDesk === true;
}

function sameExactTarget(left, right) {
  return Boolean(left && right
    && left.session === right.session
    && left.sessionCreatedAt === right.sessionCreatedAt
    && left.paneId === right.paneId
    && left.tmuxPaneId === right.tmuxPaneId
    && Number(left.panePid) === Number(right.panePid));
}

function projectContextWorkspace(context, target = state.projectDesk.target) {
  const workspace = context?.workspace;
  if (typeof workspace === 'string') return workspace;
  return String(workspace?.projectPath || workspace?.displayPath || workspace?.root || workspace?.path || context?.repoRoot || context?.root || target?.workspace || target?.currentPath || '');
}

function projectContextBranch(context) {
  const git = context?.git || {};
  const revision = git.head || git.sha || '';
  return String(git.branch || git.ref || context?.branch || (revision ? `detached ${revision}` : 'Not a Git repository'));
}

function projectContextChanges(context) {
  const git = context?.git || {};
  const raw = git.changedFiles || git.changes || context?.changedFiles || context?.changes || [];
  return (Array.isArray(raw) ? raw : []).map((item) => typeof item === 'string'
    ? { path: item, status: '' }
    : { path: String(item?.path || item?.file || item?.name || ''), status: String(item?.status || item?.code || '') })
    .filter((item) => item.path);
}

function projectContextChecks(context) {
  const raw = context?.checks ?? context?.testStatus ?? context?.tests ?? null;
  if (Array.isArray(raw)) {
    return {
      summary: raw.length ? `${raw.length} recorded check${raw.length === 1 ? '' : 's'}` : 'Not recorded',
      items: raw
    };
  }
  if (raw && typeof raw === 'object') {
    const items = Array.isArray(raw.items) ? raw.items
      : Array.isArray(raw.results) ? raw.results
        : [];
    const scripts = Array.isArray(raw.scripts) ? raw.scripts
      : raw.scripts && typeof raw.scripts === 'object' ? Object.keys(raw.scripts)
        : Array.isArray(raw.availableScripts) ? raw.availableScripts : [];
    return {
      summary: String(raw.summary || raw.label || raw.status || (scripts.length ? `${scripts.length} available · not run` : 'Not recorded')),
      items: items.length ? items : scripts.map((script) => typeof script === 'string'
        ? { name: script, status: 'available', detail: 'Available; not run by PaneFleet.' }
        : {
            name: String(script?.name || script?.label || 'check'),
            status: String(script?.status || 'available'),
            detail: String(script?.detail || script?.command || 'Available; not run by PaneFleet.')
          })
    };
  }
  return { summary: raw ? String(raw) : 'Not recorded', items: [] };
}

function projectContextInstructions(context) {
  const raw = context?.instructions || context?.instructionFiles || [];
  return (Array.isArray(raw) ? raw : []).map((item) => typeof item === 'string'
    ? { name: item, path: item, summary: '' }
    : {
        name: String(item?.name || item?.filename || item?.label || item?.path || 'Instructions'),
        path: String(item?.path || ''),
        summary: String(item?.summary || item?.preview || item?.excerpt || item?.content || ''),
        scope: String(item?.scope || '')
      });
}

function safeProjectLinkUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.origin);
    return ['http:', 'https:', 'exp:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function projectContextLinks(context, target) {
  const links = [];
  const workspace = String(context?.workspace?.path || target?.currentPath || target?.workspace || '');
  for (const service of state.snapshot?.services || []) {
    if (!service.cwd || !missionWorkspacesConflict(service.cwd, workspace)) continue;
    for (const link of normalizedLinks(service)) links.push({ ...link, serviceLabel: service.label || service.id });
  }
  for (const link of Array.isArray(context?.links) ? context.links : []) links.push({ ...link });
  const unique = new Map();
  links.forEach((link, index) => {
    const key = String(link.url || link.href || `${link.protocol || ''}:${link.port || ''}:${link.path || ''}:${link.label || index}`);
    if (!unique.has(key)) unique.set(key, link);
  });
  return [...unique.values()];
}

function projectLinkMarkup(link, index) {
  if (Number.isFinite(Number(link?.port))) return serviceLinkButton(link, `project-desk-${index}`);
  const url = safeProjectLinkUrl(link?.url || link?.href);
  if (!url) return '';
  return `<a class="action-button link-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label || link.name || 'Open link')}</a>`;
}

function projectContextArtifacts(context) {
  return (Array.isArray(context?.artifacts) ? context.artifacts : []).filter((artifact) => (
    /^[a-f0-9]{32}$/.test(String(artifact?.id || '')) &&
    String(artifact?.name || '').toLowerCase().endsWith(
      PROJECT_ARTIFACT_TYPES[String(artifact?.type || '')] || '\0'
    )
  ));
}

function projectArtifactSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function projectArtifactTimestamp(value) {
  const timestamp = new Date(String(value || ''));
  if (Number.isNaN(timestamp.getTime())) return '';
  return timestamp.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function projectArtifactUrl(artifact, target) {
  const query = exactPaneIdentityQuery(target);
  if (!query || !/^[a-f0-9]{32}$/.test(String(artifact?.id || ''))) return '';
  return `/api/project-desk/${encodeURIComponent(target.session)}/artifacts/${encodeURIComponent(artifact.id)}?${query}`;
}

function projectArtifactPreviewUrl(artifact, target, previewAvailable) {
  if (!previewAvailable || artifact?.type !== 'html' || !String(artifact?.path || '').includes('/')) return '';
  const url = projectArtifactUrl(artifact, target);
  if (!url) return '';
  const separator = url.indexOf('?');
  if (separator < 0) return '';
  return `${url.slice(0, separator)}/preview${url.slice(separator)}`;
}

function projectArtifactMarkup(artifact, target, previewAvailable = false) {
  const url = projectArtifactUrl(artifact, target);
  if (!url) return '';
  const previewUrl = projectArtifactPreviewUrl(artifact, target, previewAvailable);
  const modified = projectArtifactTimestamp(artifact.updatedAt);
  const detail = [
    String(artifact.path || ''),
    projectArtifactSize(artifact.size),
    modified ? `Modified ${modified}` : ''
  ].filter(Boolean).join(' · ');
  return `
    <div class="project-artifact-item">
      <button class="project-artifact-row" data-action="project-artifact-download" data-artifact-url="${escapeHtml(url)}" data-artifact-name="${escapeHtml(artifact.name)}" type="button">
        <span><strong>${escapeHtml(artifact.name)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>
        <span class="project-artifact-action">Download</span>
      </button>
      ${previewUrl ? `<a class="action-button project-artifact-preview" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">Preview</a>` : ''}
    </div>
  `;
}

function projectArtifactDownloadRequest(button) {
  const rawUrl = String(button?.dataset?.artifactUrl || '');
  const url = new URL(rawUrl, window.location.origin);
  const exactArtifactPath = /^\/api\/project-desk\/[^/]+\/artifacts\/[a-f0-9]{32}$/;
  const exactIdentityFields = ['sessionCreatedAt', 'paneId', 'tmuxPaneId', 'panePid'];
  const queryFields = [...url.searchParams.keys()];
  if (
    !rawUrl.startsWith('/') ||
    url.origin !== window.location.origin ||
    url.hash ||
    !exactArtifactPath.test(url.pathname) ||
    queryFields.length !== exactIdentityFields.length ||
    !exactIdentityFields.every((field) => url.searchParams.getAll(field).length === 1 && url.searchParams.get(field))
  ) {
    throw new Error('This file link is no longer tied to an exact terminal. Refresh Project Desk and try again.');
  }
  return url.pathname + url.search;
}

function projectArtifactDownloadName(button) {
  const name = String(button?.dataset?.artifactName || '').trim();
  const supported = Object.values(PROJECT_ARTIFACT_TYPES).some((extension) => name.toLowerCase().endsWith(extension));
  if (!name || name !== name.split(/[\\/]/).pop() || !supported) return 'project-file';
  return name;
}

async function projectArtifactDownload(button) {
  const requestUrl = projectArtifactDownloadRequest(button);
  const filename = projectArtifactDownloadName(button);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(requestUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { accept: 'application/pdf, text/markdown, text/html' },
        signal: controller.signal
      });
      if (response.ok) {
        const contentType = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
        if (!PROJECT_ARTIFACT_CONTENT_TYPES.has(contentType)) throw new Error('The server did not return a supported project file. Refresh Project Desk and try again.');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        // Give mobile Safari enough time to hand the Blob to its viewer/share sheet.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        setNotice(`Downloading ${filename}.`, 'success');
        return;
      }

      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { detail: raw || `HTTP ${response.status}` }; }
      if (data.error === 'control_session_required' && attempt === 0) {
        await refreshControlSession(controller.signal);
        continue;
      }
      throw new Error(data.detail || data.error || `File download failed (HTTP ${response.status}).`);
    }
    throw new Error('Dashboard session refresh failed. Reload this page and try again.');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('File download timed out. Check dashboard health before retrying.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderProjectMission(target) {
  const mission = target ? activeMissionForAgentSession(target.session) : null;
  if (!mission) {
    els.projectMissionCard.className = 'project-card project-mission-card';
    els.projectMissionStatus.textContent = 'No mission';
    els.projectMissionDetail.innerHTML = '<p>No queued mission is linked to this terminal.</p>';
    return;
  }
  els.projectMissionCard.className = `project-card project-mission-card ${escapeHtml(missionTone(mission.status))}`;
  els.projectMissionStatus.textContent = missionStatusLabel(mission.status);
  els.projectMissionDetail.innerHTML = `
    <strong>${escapeHtml(mission.title)}</strong>
    <div><span>Verification required</span><p>${escapeHtml(mission.verificationCriteria || 'No verification criteria recorded.')}</p></div>
    ${mission.resultSummary ? `<div><span>Latest result</span><p>${escapeHtml(mission.resultSummary)}</p></div>` : ''}
    ${mission.blocker ? `<div><span>Needs you</span><p>${escapeHtml(mission.blocker)}</p></div>` : ''}
    <button class="action-button" data-action="mission-open-queue" data-mission-id="${escapeHtml(mission.id)}" type="button">Open in queue</button>
  `;
}

function renderProjectContext() {
  const { target, context, contextLoading, contextError } = state.projectDesk;
  if (!target) {
    els.projectDeskTitle.textContent = 'Project Desk';
    els.projectDeskSubtitle.textContent = 'Focus a live agent terminal to load its project.';
    els.projectContextState.textContent = 'Waiting';
    els.projectWorkspace.textContent = '—';
    els.projectBranch.textContent = '—';
    els.projectChangeSummary.textContent = '—';
    els.projectCheckSummary.textContent = 'Not recorded';
    els.projectChanges.innerHTML = '';
    els.projectChecks.innerHTML = '';
    els.projectInstructionCount.textContent = '0';
    els.projectInstructions.innerHTML = '<p class="project-empty-copy">Focus a live terminal to load instructions.</p>';
    els.projectLinkCount.textContent = '0';
    els.projectLinks.innerHTML = '<p class="project-empty-copy">Focus a live terminal to load useful links.</p>';
    els.projectArtifactCount.textContent = '0';
    els.projectArtifacts.innerHTML = '<p class="project-empty-copy">Focus a live terminal to load downloadable files.</p>';
    renderProjectMission(null);
    return;
  }

  els.projectDeskTitle.textContent = target.displayName || target.session;
  els.projectDeskSubtitle.textContent = `tmux ${target.session} · ${target.paneId} · ${shortPath(target.currentPath)}`;
  const capabilityAvailable = projectDeskCapabilityAvailable();
  els.projectContextState.textContent = !capabilityAvailable ? 'Restart required' : contextLoading ? 'Loading…' : contextError ? 'Unavailable' : 'Current';
  els.projectContextState.dataset.tone = !capabilityAvailable || contextLoading ? 'warn' : contextError ? 'bad' : 'good';
  els.projectWorkspace.textContent = shortPath(projectContextWorkspace(context, target));
  els.projectBranch.textContent = !capabilityAvailable ? 'Restart dashboard to load' : contextLoading && !context ? 'Loading…' : projectContextBranch(context);

  const changes = projectContextChanges(context);
  const git = context?.git || {};
  const changedCount = Number.isFinite(Number(git.changedCount ?? context?.changedCount))
    ? Number(git.changedCount ?? context.changedCount)
    : changes.length;
  els.projectChangeSummary.textContent = !capabilityAvailable
    ? 'Restart required'
    : contextLoading && !context
    ? 'Loading…'
    : changedCount ? `${changedCount} changed file${changedCount === 1 ? '' : 's'}` : git.clean === false ? 'Changes detected' : 'Clean or not recorded';
  els.projectChanges.innerHTML = changes.length
    ? changes.slice(0, 40).map((item) => `<div class="project-detail-row"><code>${escapeHtml(item.status || '•')}</code><span>${escapeHtml(item.path)}</span></div>`).join('')
    : '';

  const checks = projectContextChecks(context);
  els.projectCheckSummary.textContent = capabilityAvailable ? checks.summary : 'Restart required';
  els.projectChecks.innerHTML = checks.items.length
    ? checks.items.slice(0, 12).map((item) => typeof item === 'string'
      ? `<div class="project-detail-row"><span>${escapeHtml(item)}</span></div>`
      : `<div class="project-detail-row"><code>${escapeHtml(item.status || '•')}</code><span><strong>${escapeHtml(item.name || item.label || 'Check')}</strong>${item.detail || item.summary ? `<small>${escapeHtml(item.detail || item.summary)}</small>` : ''}</span></div>`).join('')
    : '';

  const instructions = projectContextInstructions(context);
  els.projectInstructionCount.textContent = String(instructions.length);
  els.projectInstructions.innerHTML = instructions.length
    ? instructions.map((item) => item.summary
      ? `<details class="project-instruction"><summary>${escapeHtml(item.name)}</summary>${item.path && item.path !== item.name ? `<code>${escapeHtml(shortPath(item.path))}</code>` : ''}<p>${escapeHtml(item.summary)}</p></details>`
      : `<div class="project-detail-row"><span><strong>${escapeHtml(item.name)}</strong>${item.path && item.path !== item.name ? `<small>${escapeHtml(shortPath(item.path))}</small>` : ''}</span></div>`).join('')
    : `<p class="project-empty-copy">${!capabilityAvailable ? 'Restart the dashboard to load bounded project instructions.' : contextError ? escapeHtml(contextError) : 'No project instruction files were found.'}</p>`;

  const links = projectContextLinks(context, target);
  const linkMarkup = links.map(projectLinkMarkup).filter(Boolean);
  els.projectLinkCount.textContent = String(linkMarkup.length);
  els.projectLinks.innerHTML = linkMarkup.length ? linkMarkup.join('') : `<p class="project-empty-copy">${capabilityAvailable ? 'No allowlisted project links.' : 'Restart the dashboard to load project links.'}</p>`;
  if (linkMarkup.length) scheduleHealthChecks();
  const artifacts = projectContextArtifacts(context);
  const artifactPreviewCapabilityAvailable = state.snapshot?.capabilities?.projectArtifactPreviews === true;
  const artifactMarkup = artifacts
    .map((artifact) => projectArtifactMarkup(artifact, target, artifactPreviewCapabilityAvailable))
    .filter(Boolean);
  const artifactCapabilityAvailable = state.snapshot?.capabilities?.projectArtifacts === true;
  els.projectArtifactCount.textContent = String(artifactCapabilityAvailable ? artifactMarkup.length : 0);
  els.projectArtifacts.innerHTML = artifactCapabilityAvailable && artifactMarkup.length
    ? artifactMarkup.join('')
    : `<p class="project-empty-copy">${artifactCapabilityAvailable ? 'No downloadable project outputs found yet.' : 'Restart the dashboard to load project files.'}</p>`;
  renderProjectMission(target);
}

function clearScratchpadReview() {
  state.projectDesk.review = null;
  els.scratchpadReviewPanel.classList.add('hidden');
  els.scratchpadReviewTarget.textContent = '';
  els.scratchpadReviewText.textContent = '';
}

function updateProjectComposerState() {
  const target = state.projectDesk.target;
  const canPrompt = target ? canPromptAgent(target.session) : { ok: false, reason: 'no focused terminal' };
  const capabilityAvailable = projectDeskCapabilityAvailable();
  const exactReady = Boolean(capabilityAvailable && target?.identityComplete && canPrompt.ok);
  const textLength = els.scratchpadText.value.length;
  const selectedSnippet = selectedPromptSnippet();
  els.scratchpadCounter.textContent = `${textLength}/${SEND_TEXT_MAX}`;
  els.scratchpadCounter.dataset.full = textLength >= SEND_TEXT_MAX ? 'true' : 'false';
  els.projectNotes.disabled = !target;
  els.scratchpadText.disabled = !target;
  els.scratchpadSnippetSelect.disabled = !target;
  els.scratchpadSnippetName.disabled = !target;
  document.querySelector('[data-action="scratchpad-snippet-insert"]').disabled = !target || !selectedSnippet;
  document.querySelector('[data-action="scratchpad-snippet-save"]').disabled = !target || !textLength || !els.scratchpadSnippetName.value.trim();
  els.scratchpadSnippetDelete.disabled = !selectedSnippet || selectedSnippet.builtIn;
  els.scratchpadReview.disabled = !exactReady || !els.scratchpadText.value.trim() || state.projectDesk.sending;
  els.projectDeskRefresh.disabled = !target || !capabilityAvailable || state.projectDesk.contextLoading;
  els.scratchpadSendConfirm.disabled = !capabilityAvailable || state.projectDesk.sending;
  els.scratchpadSendConfirm.textContent = state.projectDesk.sending ? 'Sending…' : `Send to ${target?.session || 'exact terminal'}`;
  els.scratchpadTarget.textContent = target
    ? `${target.displayName} · tmux ${target.session} · ${target.paneId}`
    : 'Focus a live terminal to choose an exact target.';
  els.scratchpadSafety.textContent = !target
    ? 'Draft only · no terminal selected'
    : !capabilityAvailable
      ? 'Draft saved · restart PaneFleet to enable exact-target Review and Send'
    : !target.identityComplete
      ? 'Send locked · durable pane identity unavailable'
      : !canPrompt.ok
        ? `Send locked · ${canPrompt.reason}`
        : 'Draft only · Review does not send · Confirm sends literal text plus Enter';
}

function loadProjectDeskContext(target, { force = false } = {}) {
  if (!target || !projectDeskCapabilityAvailable()) return;
  const identityQuery = exactPaneIdentityQuery(target);
  if (!identityQuery) {
    state.projectDesk.contextLoading = false;
    state.projectDesk.contextError = 'Exact pane identity unavailable.';
    renderProjectContext();
    updateProjectComposerState();
    return;
  }
  const cached = state.projectDesk.contextCache.get(target.key);
  if (!force && projectContextCacheFresh(cached, Date.now(), PROJECT_CONTEXT_CACHE_MS)) {
    state.projectDesk.context = cached.context;
    state.projectDesk.contextError = '';
    state.projectDesk.contextLoading = false;
    renderProjectContext();
    updateProjectComposerState();
    return;
  }
  const fallbackContext = cached?.context || null;
  if (fallbackContext) state.projectDesk.context = fallbackContext;
  const token = ++state.projectDesk.contextRequestToken;
  state.projectDesk.contextLoading = true;
  state.projectDesk.contextError = '';
  renderProjectContext();
  updateProjectComposerState();
  void api(`/api/project-desk/${encodeURIComponent(target.session)}?${identityQuery}`)
    .then((result) => {
      if (token !== state.projectDesk.contextRequestToken) return;
      const context = result?.project || result?.context || result;
      state.projectDesk.contextCache.set(target.key, { context, fetchedAt: Date.now() });
      state.projectDesk.context = context;
      state.projectDesk.contextError = '';
      adoptProjectNotesScope(target, context);
    })
    .catch((error) => {
      if (token !== state.projectDesk.contextRequestToken) return;
      state.projectDesk.context = fallbackContext;
      state.projectDesk.contextError = error.message;
    })
    .finally(() => {
      if (token !== state.projectDesk.contextRequestToken) return;
      applyBackgroundDomUpdate('project-context', () => {
        if (token !== state.projectDesk.contextRequestToken) return;
        state.projectDesk.contextLoading = false;
        renderProjectContext();
        updateProjectComposerState();
      });
    });
}

function syncProjectDesk({ refreshContext = false } = {}) {
  const visible = state.terminalWindows.size > 0;
  els.projectDesk.classList.toggle('hidden', !visible);
  if (!visible) {
    state.projectDesk.target = null;
    state.projectDesk.targetKey = '';
    clearScratchpadReview();
    return;
  }
  const nextTarget = projectDeskTargetForTerminal(focusedLiveTerminal());
  const nextKey = nextTarget?.key || '';
  const changed = nextKey !== state.projectDesk.targetKey;
  const cached = nextTarget ? state.projectDesk.contextCache.get(nextTarget.key) : null;
  if (changed) {
    state.projectDesk.contextRequestToken += 1;
    state.projectDesk.target = nextTarget;
    state.projectDesk.targetKey = nextKey;
    state.projectDesk.context = cached?.context || null;
    state.projectDesk.contextError = '';
    state.projectDesk.contextLoading = false;
    clearScratchpadReview();
    state.projectDesk.notesScope = nextTarget ? projectNotesScope(nextTarget, state.projectDesk.context) : '';
    state.projectDesk.notesDirty = false;
    els.projectNotes.value = nextTarget ? safeStorageGet(projectNotesKey(state.projectDesk.notesScope)).slice(0, PROJECT_NOTES_MAX) : '';
    els.scratchpadText.value = nextTarget ? safeStorageGet(scratchpadDraftKey(nextTarget)).slice(0, SEND_TEXT_MAX) : '';
    els.scratchpadSnippetName.value = '';
  } else {
    state.projectDesk.target = nextTarget;
  }
  renderPromptSnippetOptions();
  renderProjectContext();
  updateProjectComposerState();
  const cacheFresh = projectContextCacheFresh(cached, Date.now(), PROJECT_CONTEXT_CACHE_MS);
  if (nextTarget && projectDeskCapabilityAvailable() && !state.projectDesk.contextLoading && (
    refreshContext || (!cacheFresh && !state.projectDesk.contextError)
  )) {
    loadProjectDeskContext(nextTarget, { force: refreshContext });
  }
}

function insertScratchpadSnippet() {
  const target = state.projectDesk.target;
  const snippet = selectedPromptSnippet();
  if (!target || !snippet) return;
  const textarea = els.scratchpadText;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const prefix = start > 0 && !textarea.value.slice(0, start).endsWith('\n') ? '\n\n' : '';
  const available = SEND_TEXT_MAX - (textarea.value.length - (end - start));
  const inserted = `${prefix}${snippet.text}`.slice(0, Math.max(0, available));
  textarea.setRangeText(inserted, start, end, 'end');
  safeStorageSet(scratchpadDraftKey(target), textarea.value);
  clearScratchpadReview();
  updateProjectComposerState();
  textarea.focus({ preventScroll: true });
  if (inserted.length < prefix.length + snippet.text.length) setNotice(`Snippet was trimmed to the ${SEND_TEXT_MAX}-character prompt limit.`, 'error');
}

function saveScratchpadSnippet() {
  const name = els.scratchpadSnippetName.value.trim().slice(0, 80);
  const text = els.scratchpadText.value.slice(0, SEND_TEXT_MAX);
  if (!state.projectDesk.target || !name || !text.trim()) return;
  const snippets = loadCustomPromptSnippets();
  const existing = snippets.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.name = name;
    existing.text = text;
  } else {
    snippets.push({ id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, text });
  }
  persistCustomPromptSnippets();
  state.projectDesk.snippetSignature = '';
  const stored = loadCustomPromptSnippets().find((item) => item.name.toLowerCase() === name.toLowerCase());
  renderPromptSnippetOptions(stored ? `custom:${stored.id}` : '');
  updateProjectComposerState();
  setNotice(`Saved reusable snippet “${name}” in this browser.`);
}

function deleteScratchpadSnippet() {
  const selected = selectedPromptSnippet();
  if (!selected || selected.builtIn) return;
  const id = selected.id.replace(/^custom:/, '');
  state.projectDesk.customSnippets = loadCustomPromptSnippets().filter((item) => item.id !== id);
  persistCustomPromptSnippets();
  state.projectDesk.snippetSignature = '';
  renderPromptSnippetOptions();
  els.scratchpadSnippetName.value = '';
  updateProjectComposerState();
  setNotice(`Deleted reusable snippet “${selected.name}”.`);
}

function openScratchpadReview() {
  const target = state.projectDesk.target;
  const text = els.scratchpadText.value;
  if (!projectDeskCapabilityAvailable()) {
    setNotice('Exact-target Review and Send require a dashboard restart. Your draft remains saved.', 'error');
    return;
  }
  if (!target?.identityComplete || !text.trim()) return;
  const current = projectDeskTargetForTerminal(state.terminalWindows.get(target.terminalId));
  if (!sameExactTarget(target, current)) {
    setNotice('Review canceled: the focused terminal identity changed. Focus it again before sending.', 'error');
    syncProjectDesk();
    return;
  }
  const canPrompt = canPromptAgent(target.session);
  if (!canPrompt.ok) {
    setNotice(`Review unavailable: ${target.displayName} is ${canPrompt.reason}.`, 'error');
    return;
  }
  state.projectDesk.review = { ...target, text };
  els.scratchpadReviewTarget.textContent = `${target.displayName} · tmux ${target.session} · ${target.paneId} · ${shortPath(target.currentPath)}`;
  els.scratchpadReviewText.textContent = text;
  els.scratchpadReviewPanel.classList.remove('hidden');
  updateProjectComposerState();
  els.scratchpadSendConfirm.focus({ preventScroll: true });
}

function togglePinnedSession(session, source = null) {
  if (!session) return;
  const wasPinned = state.pinnedSessions.has(session);
  const fromInspector = Boolean(source?.closest?.('.terminal-inspector'));
  if (wasPinned) state.pinnedSessions.delete(session);
  else state.pinnedSessions.add(session);
  safeStorageSet('host-control:pinned-sessions', JSON.stringify([...state.pinnedSessions]));
  if (state.snapshot) render({ preserveActiveEditor: true });
  const buttons = fromInspector
    ? [...els.terminalInspector.querySelectorAll('[data-action="session-pin"]')]
    : [...els.sessionList.querySelectorAll('[data-action="session-pin"]')];
  const nextButton = buttons.find((button) => button.dataset.session === session);
  window.requestAnimationFrame(() => {
    if (!nextButton?.isConnected) return;
    nextButton.focus({ preventScroll: true });
    nextButton.closest('.session-item')?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  });
  setNotice(wasPinned
    ? `${displayNameForSession(session)} returned to recent session order.`
    : `${displayNameForSession(session)} pinned to the top.`);
}

function terminalDraftKey(session) {
  return `host-control:terminal-draft:${session || 'static'}`;
}

function terminalHistoryKey(session) {
  return `host-control:terminal-history:${session || 'static'}`;
}

function loadTerminalHistory(session) {
  try {
    const parsed = JSON.parse(safeStorageGet(terminalHistoryKey(session), '[]'));
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(-30) : [];
  } catch {
    return [];
  }
}

function persistTerminalDraft(item) {
  if (!item?.session || item.mode === 'static') return;
  item.draftStorageAvailable = safeStorageSet(terminalDraftKey(item.session), item.sendText.value);
}

function rememberTerminalHistory(item, text) {
  const value = String(text || '');
  if (!item?.session || !value.trim()) return;
  item.sendHistory = [...item.sendHistory.filter((entry) => entry !== value), value].slice(-30);
  item.sendHistoryIndex = item.sendHistory.length;
  safeStorageSet(terminalHistoryKey(item.session), JSON.stringify(item.sendHistory));
}

function navigateTerminalHistory(item, direction) {
  if (!item?.sendHistory?.length || item.sendInFlight || item.pickerActive) return;
  const next = clamp(item.sendHistoryIndex + direction, 0, item.sendHistory.length);
  item.sendHistoryIndex = next;
  item.sendText.value = next === item.sendHistory.length ? '' : item.sendHistory[next];
  item.sendUndoText = '';
  persistTerminalDraft(item);
  updateSendInputState(item);
  focusSendText(item);
}

function previewTerminalPaste(item, value) {
  const text = String(value || '');
  if (!item || !text) return;
  item.pendingPaste = text;
  const lineCount = text.split(/\r?\n/).length;
  item.pastePreviewMeta.textContent = `${text.length} characters · ${lineCount} line${lineCount === 1 ? '' : 's'}`;
  item.pastePreviewText.textContent = text.length > 500 ? `${text.slice(0, 500)}…` : text;
  item.pastePreview.classList.remove('hidden');
  syncTerminalComposer(item);
}

function clearPendingPaste(item) {
  if (!item) return;
  item.pendingPaste = '';
  item.pastePreview.classList.add('hidden');
  item.pastePreviewMeta.textContent = '';
  item.pastePreviewText.textContent = '';
  syncTerminalComposer(item);
  focusSendText(item);
}

function insertPendingPaste(item) {
  const value = item?.pendingPaste || '';
  if (!value) return;
  const selectedLength = Math.max(0, (item.sendText.selectionEnd || 0) - (item.sendText.selectionStart || 0));
  const capacity = Math.max(0, SEND_TEXT_MAX - (item.sendText.value.length - selectedLength));
  const inserted = value.slice(0, capacity);
  clearPendingPaste(item);
  insertSendText(item, inserted);
  if (inserted.length < value.length) setNotice(`Paste was trimmed to the ${SEND_TEXT_MAX}-character terminal input limit.`, 'error');
}

function terminalWorkspaceBounds() {
  const layerRect = els.terminalLayer.getBoundingClientRect();
  const width = Math.max(0, layerRect.width || els.terminalLayer.clientWidth || window.innerWidth);
  const height = Math.max(0, layerRect.height || els.terminalLayer.clientHeight || window.innerHeight);
  const stageRect = els.terminalStage.getBoundingClientRect();
  const workspaceRect = els.workspace.getBoundingClientRect();
  const topbarRect = els.topbar.getBoundingClientRect();
  return terminalWorkspaceFrame(
    { left: layerRect.left, top: layerRect.top, width, height },
    stageRect,
    { left: workspaceRect.left, top: topbarRect.bottom },
    isDesktopTerminalMode(),
    window.matchMedia(TERMINAL_ULTRAWIDE_QUERY).matches
  );
}

function captureTerminalFreeBounds(item) {
  if (!item || item.minimized || item.maximized || !isDesktopTerminalMode()) return;
  const layerRect = els.terminalLayer.getBoundingClientRect();
  const rect = item.element.getBoundingClientRect();
  item.freeBounds = {
    left: rect.left - layerRect.left,
    top: rect.top - layerRect.top,
    width: rect.width,
    height: rect.height
  };
}

function terminalLayoutItems() {
  const items = [...state.terminalWindows.values()].filter((item) => !item.minimized);
  const active = state.terminalWindows.get(state.activeTerminalId);
  return active && items.includes(active) ? [active, ...items.filter((item) => item !== active)] : items;
}

function applyTerminalLayout() {
  const desktopMode = isDesktopTerminalMode();
  const items = terminalLayoutItems();
  syncTerminalModalState(desktopMode);
  if (!desktopMode) {
    const active = state.terminalWindows.get(state.activeTerminalId) || items[0];
    items.forEach((item) => item.element.classList.toggle('is-layout-hidden', item !== active));
    return;
  }

  const mode = state.terminalLayout;
  if (mode === 'free') {
    for (const item of items) {
      item.element.classList.remove('is-layout-hidden', 'is-tiled');
      if (item.maximized) {
        const bounds = terminalWorkspaceBounds();
        item.element.style.left = `${bounds.left + 8}px`;
        item.element.style.top = `${bounds.top + 8}px`;
        item.element.style.width = `${bounds.width - 16}px`;
        item.element.style.height = `${bounds.height - 16}px`;
        continue;
      }
      if (item.freeBounds) {
        item.element.style.left = `${item.freeBounds.left}px`;
        item.element.style.top = `${item.freeBounds.top}px`;
        item.element.style.width = `${item.freeBounds.width}px`;
        item.element.style.height = `${item.freeBounds.height}px`;
      }
      if (state.terminalFullHeight) applyTerminalFullHeightToItem(item);
      else constrainTerminalWindow(item);
    }
    return;
  }

  const visibleLimit = mode === 'focus' ? 1 : mode === 'split' ? 2 : 4;
  const visible = items.slice(0, visibleLimit);
  const bounds = terminalWorkspaceBounds();
  const inset = 8;
  const slots = terminalLayoutSlots(mode, visible.length, bounds.width - inset * 2, bounds.height - inset * 2, 8);
  items.forEach((item) => item.element.classList.toggle('is-layout-hidden', !visible.includes(item)));
  visible.forEach((item, index) => {
    const slot = slots[index];
    item.element.classList.add('is-tiled');
    item.element.style.left = `${bounds.left + slot.left + inset}px`;
    item.element.style.top = `${bounds.top + slot.top + inset}px`;
    item.element.style.width = `${slot.width}px`;
    item.element.style.height = `${slot.height}px`;
  });
}

function setTerminalLayout(layout) {
  if (!['free', 'focus', 'split', 'grid'].includes(layout) || layout === state.terminalLayout) return;
  if (layout !== 'free' && state.terminalFullHeight) setTerminalFullHeight(false, { render: false });
  if (state.terminalLayout === 'free') terminalLayoutItems().forEach(captureTerminalFreeBounds);
  state.terminalLayout = layout;
  safeStorageSet('host-control:terminal-layout', layout);
  applyTerminalLayout();
  renderTerminalChrome();
  persistTerminalWorkspace();
}

function terminalSignal(item) {
  const agent = currentTerminalSession(item?.session);
  const status = agent?.agentStatus || {
    state: item?.mode === 'static' ? 'result' : 'unknown',
    tone: item?.mode === 'static' ? 'neutral' : 'warn'
  };
  const attentionCount = item?.session ? sessionAttentionItems(item.session).length : 0;
  return {
    status,
    signal: sessionStatusPresentation(status, attentionCount),
    attentionCount
  };
}

function syncTerminalHeaderStatus(item) {
  if (!item?.headerStatus) return;
  const { signal } = terminalSignal(item);
  item.headerStatus.className = `terminal-header-status ${signal.tone}`;
  item.headerStatus.textContent = signal.label;
  item.headerStatus.title = signal.description;
  item.headerStatus.setAttribute('aria-label', `Agent state: ${signal.label}. ${signal.description}`);
}

function syncTerminalHeaderUsage(item) {
  if (!item?.headerUsage) return;
  const agent = currentAgent(item.session);
  const telemetry = agent?.codexTelemetry;
  const accountReport = codexAccountReport(telemetry);
  const presentation = codexTelemetryPresentation(telemetry ? { ...telemetry, account: accountReport.account } : telemetry);
  item.headerUsage.className = `terminal-header-usage ${presentation.tone}`;
  item.headerUsage.classList.toggle('hidden', !presentation.available);
  item.headerUsage.textContent = presentation.badge;
  item.headerUsage.title = presentation.description;
  item.headerUsage.setAttribute('aria-label', `Codex usage: ${presentation.description}`);
  item.headerUsage.setAttribute('aria-expanded', item.telemetryOpen ? 'true' : 'false');
  if (item.mobileTelemetry) {
    const mobile = terminalMobileTelemetryContent(agent);
    item.mobileTelemetry.className = `terminal-mobile-telemetry ${mobile.tone}`;
    item.mobileTelemetry.classList.toggle('hidden', !agent);
    item.mobileTelemetry.innerHTML = mobile.markup;
    item.mobileTelemetry.setAttribute('aria-label', mobile.label);
    item.mobileTelemetry.setAttribute('aria-expanded', item.telemetryOpen ? 'true' : 'false');
  }
  if (item.telemetryPanel) item.telemetryPanel.innerHTML = terminalTelemetryMarkup(agent);
}

function renderTerminalTabs() {
  const windows = [...state.terminalWindows.values()];
  const previousActiveId = els.terminalTabs.dataset.activeTerminalId || '';
  const previousScrollLeft = els.terminalTabs.scrollLeft;
  const activeChanged = previousActiveId !== String(state.activeTerminalId || '');
  els.terminalTabs.classList.toggle('hidden', windows.length === 0);
  els.terminalTabs.innerHTML = windows.map((item) => {
    const brief = currentBrief(item.session);
    const { status, signal, attentionCount } = terminalSignal(item);
    const displayName = brief?.displayName || item.title.textContent || item.session || 'Result';
    const active = item.id === state.activeTerminalId;
    const closeLabel = item.mode === 'static'
      ? `Close ${item.title.textContent || 'terminal'} view`
      : `Close ${item.title.textContent || 'terminal'} view; agent keeps running`;
    const focusLabel = `${active ? 'Current' : 'Focus'} ${displayName} terminal. ${signal.label}.`;
    return `
      <div class="terminal-tab ${active ? 'active' : ''} ${item.minimized ? 'minimized' : ''} ${escapeHtml(statusClassName(status))}">
        <button data-action="terminal-tab" data-terminal-id="${escapeHtml(item.id)}" type="button" role="tab" aria-selected="${active ? 'true' : 'false'}" aria-controls="${escapeHtml(item.id)}" tabindex="${active ? '0' : '-1'}" aria-keyshortcuts="ArrowLeft ArrowRight Home End" aria-label="${escapeHtml(focusLabel)}" title="${escapeHtml(signal.description)}"><span class="terminal-tab-dot" aria-hidden="true"></span><span class="terminal-tab-copy"><strong>${escapeHtml(displayName)}</strong><span class="terminal-tab-status ${escapeHtml(signal.tone)}">${escapeHtml(signal.label)}</span></span>${attentionCount ? `<em>${attentionCount}</em>` : ''}</button>
        <button class="terminal-tab-close" data-action="terminal-close" data-terminal-id="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(closeLabel)}" title="${escapeHtml(closeLabel)}">×</button>
      </div>
    `;
  }).join('');
  els.terminalTabs.dataset.activeTerminalId = String(state.activeTerminalId || '');
  els.terminalTabs.scrollLeft = previousScrollLeft;
  if (!activeChanged) {
    return;
  }
  const activeTab = els.terminalTabs.querySelector('.terminal-tab.active');
  revealHorizontalItem(els.terminalTabs, activeTab);
}

function revealHorizontalItem(strip, item, padding = 6) {
  window.requestAnimationFrame(() => {
    if (!strip?.isConnected || !item?.isConnected) return;
    const stripRect = strip.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const currentScrollLeft = strip.scrollLeft;
    const itemStart = currentScrollLeft + itemRect.left - stripRect.left - padding;
    const itemEnd = currentScrollLeft + itemRect.right - stripRect.left + padding;
    const nextScrollLeft = horizontalRevealScrollLeft(stripRect.width, currentScrollLeft, itemStart, itemEnd);
    if (nextScrollLeft === currentScrollLeft) return;
    strip.scrollTo({
      left: nextScrollLeft,
      behavior: motionAwareScrollBehavior()
    });
  });
}

function handleTerminalTabKeydown(event) {
  const currentButton = event.target?.closest?.('[data-action="terminal-tab"]');
  if (!currentButton || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const buttons = [...els.terminalTabs.querySelectorAll('[data-action="terminal-tab"]')];
  const currentIndex = buttons.indexOf(currentButton);
  const nextIndex = terminalTabKeyIndex(event.key, currentIndex, buttons.length);
  if (nextIndex < 0) return false;
  event.preventDefault();
  if (nextIndex === currentIndex) return true;
  const nextId = buttons[nextIndex].dataset.terminalId;
  buttons[nextIndex].click();
  window.requestAnimationFrame(() => {
    [...els.terminalTabs.querySelectorAll('[data-action="terminal-tab"]')]
      .find((button) => button.dataset.terminalId === nextId)
      ?.focus({ preventScroll: true });
  });
  return true;
}

function renderTerminalChrome() {
  const count = state.terminalWindows.size;
  for (const item of state.terminalWindows.values()) {
    item.element.classList.toggle('is-active', !item.minimized && item.id === state.activeTerminalId);
    syncTerminalHeaderStatus(item);
    syncTerminalHeaderUsage(item);
  }
  els.openTerminalCount.textContent = count ? `${count} terminal${count === 1 ? '' : 's'} open` : 'No terminals open';
  els.terminalWorkspace.classList.toggle('has-open-terminals', count > 0);
  els.terminalEmpty.classList.toggle('hidden', count > 0);
  document.querySelectorAll('[data-action="terminal-layout"]').forEach((button) => {
    const active = button.dataset.layout === state.terminalLayout;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const fullHeightButton = document.querySelector('[data-action="terminal-full-height"]');
  if (fullHeightButton) {
    fullHeightButton.classList.toggle('active', state.terminalFullHeight);
    fullHeightButton.setAttribute('aria-pressed', state.terminalFullHeight ? 'true' : 'false');
    fullHeightButton.textContent = state.terminalFullHeight ? 'Restore height' : 'Full height';
    fullHeightButton.disabled = !count || !isDesktopTerminalMode();
  }
  const closeIdleButton = document.querySelector('[data-action="close-finished-terminals"]');
  if (closeIdleButton) closeIdleButton.disabled = !count;
  const terminalWindows = [...state.terminalWindows.values()];
  syncTerminalSelector(els.terminalJumpSelect, terminalWindows, state.activeTerminalId);
  renderTerminalTabs();
  const switchableItems = terminalWindows.filter((item) => !item.minimized);
  document.querySelectorAll('[data-action="terminal-cycle-active"]').forEach((button) => {
    button.disabled = switchableItems.length < 2;
  });
  for (const item of state.terminalWindows.values()) {
    const position = switchableItems.indexOf(item);
    const switchable = switchableItems.length > 1 && position >= 0;
    const displayName = currentBrief(item.session)?.displayName || item.title.textContent || item.session || 'Terminal';
    const { signal } = terminalSignal(item);
    const switcherLabel = terminalSwitcherLabel(position, switchableItems.length, displayName, signal.label);
    item.mobileSwitcher.classList.toggle('hidden', terminalWindows.length < 2 || position < 0);
    item.mobileSwitcher.setAttribute('aria-label', `Switch open terminal. Current: ${switcherLabel}. Choose a named terminal or use previous and next.`);
    syncTerminalSelector(item.mobileSelect, terminalWindows, item.id);
    item.mobileSelect.setAttribute('aria-label', `Choose open terminal. Current: ${switcherLabel}`);
    item.mobileSelect.title = switcherLabel;
    item.mobilePrevious.disabled = !switchable;
    item.mobileNext.disabled = !switchable;
  }
  if (state.snapshot) {
    const agents = sortSessionAgents(terminalRailEntries(
      state.snapshot.agents.filter((agent) => !isReviewAgent(agent)),
      state.snapshot.services.filter(isDisplayableService)
    ));
    renderTerminalInspector(agents, state.snapshot.orchestration);
    for (const item of els.sessionList.querySelectorAll('.session-item')) {
      const open = [...state.terminalWindows.values()].some((windowItem) => windowItem.session === item.dataset.session && windowItem.mode !== 'static');
      item.classList.toggle('is-open', open);
      item.classList.toggle('is-selected', item.dataset.session === state.selectedSession);
    }
  }
  syncProjectDesk();
}

function terminalSelectorOptions(items) {
  return items.map((item, index) => {
    const displayName = currentBrief(item.session)?.displayName || item.title.textContent || item.session || 'Terminal';
    const { signal } = terminalSignal(item);
    const label = terminalSwitcherLabel(index, items.length, displayName, signal.label);
    return {
      value: item.id,
      label: item.minimized ? `${label} · Docked` : label
    };
  });
}

function syncTerminalSelector(select, items, selectedId = '') {
  if (!select) return;
  const options = terminalSelectorOptions(items);
  const signature = JSON.stringify(options);
  if (select.dataset.optionsSignature !== signature && document.activeElement !== select) {
    select.replaceChildren();
    if (!options.length || !selectedId) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = options.length ? 'Choose terminal' : 'No terminals open';
      select.append(placeholder);
    }
    for (const optionValue of options) {
      const option = document.createElement('option');
      option.value = optionValue.value;
      option.textContent = optionValue.label;
      select.append(option);
    }
    select.dataset.optionsSignature = signature;
  }
  select.disabled = options.length === 0;
  select.value = options.some((option) => option.value === selectedId) ? selectedId : '';
}

function closeFinishedTerminals() {
  const finished = [...state.terminalWindows.values()].filter((item) => {
    const stateValue = currentAgent(item.session)?.agentStatus?.state;
    return item.mode !== 'static' && ['idle', 'stopped'].includes(stateValue);
  });
  finished.forEach((item) => closeTerminalWindow(item));
  setNotice(finished.length ? `Closed ${finished.length} inactive terminal view${finished.length === 1 ? '' : 's'}. No tmux session was stopped.` : 'No inactive terminal views to close.');
}

function openDetail(session) {
  startLiveDetail(session, 'pane', 120);
}

function openAgentDetail(session, paneId = '') {
  startLiveDetail(session, 'agent', 160, paneId);
}

async function touchOpenedAgent(session, { force = false } = {}) {
  if (!session || isReviewAgent(currentAgent(session))) return;
  markAgentInteraction(session, 'agent.open');
  if (state.snapshot?.capabilities?.agentInteractionOrdering !== true) return;
  const now = Date.now();
  if (!force && now - Number(state.agentTouchSentAt.get(session) || 0) < 5000) return;
  state.agentTouchSentAt.set(session, now);
  try {
    const result = await api('/api/agent/touch', {
      method: 'POST',
      body: JSON.stringify({ session })
    });
    markAgentInteraction(session, result.lastInteractionKind || 'agent.open', result.lastInteractionAt, { rerender: false });
  } catch (error) {
    // Opening the terminal still succeeded. A later snapshot can reconcile a
    // failed best-effort persistence call without blocking the user.
    console.warn('Agent interaction timestamp was not persisted:', error.message);
  }
}

function startLiveDetail(session, mode, lines, paneId = '', restoreOptions = {}) {
  const existing = [...state.terminalWindows.values()].find((item) => item.session === session && item.mode !== 'static');
  if (existing) {
    existing.mode = mode;
    existing.lines = lines;
    existing.paneId = paneId;
    existing.token += 1;
    existing.pollInFlight = false;
    existing.captureFailureCount = 0;
    existing.captureUnavailable = false;
    existing.nextRefreshDelay = DETAIL_REFRESH_MS;
    existing.element.dataset.live = 'true';
    existing.title.textContent = mode === 'agent' ? displayNameForSession(session) : session;
    existing.outputText = mode === 'agent' ? buildAgentDetailText(session) : 'Loading recent tmux pane output...';
    existing.output.textContent = existing.outputText;
    existing.scrollToBottomOnNextOutput = true;
    updateTerminalSendForm(existing);
    restoreTerminalWindow(existing);
    forceTerminalScrollBottom(existing);
    refreshTerminalWindow(existing);
    return existing;
  }

  return createTerminalWindow({
    session,
    mode,
    lines,
    paneId,
    title: mode === 'agent' ? displayNameForSession(session) : session,
    meta: 'starting pane capture...',
    output: mode === 'agent' ? buildAgentDetailText(session) : 'Loading recent tmux pane output...',
    ...restoreOptions
  });
}

function createTerminalWindow({ session = null, mode = 'static', lines = 120, paneId = '', title = 'Terminal', meta = '', output = '', refreshPaused = false, restoredFreeBounds = null }) {
  if (state.openDrawer) setOpenDrawer(null, { focus: false });
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const id = `terminal-${state.nextTerminalId++}`;
  const element = document.createElement('article');
  element.className = 'terminal-window';
  element.id = id;
  element.dataset.terminalId = id;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'false');
  element.setAttribute('aria-labelledby', `${id}-title`);
  if (mode !== 'static') element.dataset.live = 'true';
  const closeViewLabel = mode === 'static' ? 'Close terminal view' : 'Close terminal view; agent keeps running';
  element.innerHTML = `
    <div class="terminal-header" data-terminal-drag>
      <div class="terminal-heading">
        <div class="terminal-heading-row"><h2 id="${id}-title" class="terminal-title"></h2><span class="terminal-header-status neutral" aria-label="Agent state: Unknown">Unknown</span><button class="terminal-header-usage neutral hidden" data-action="terminal-telemetry-toggle" type="button" aria-controls="${id}-telemetry" aria-expanded="false" aria-label="Codex usage unavailable">Usage</button></div>
        <div class="terminal-meta-row"><span class="terminal-capture-paused hidden" role="status">Capture paused</span><p class="terminal-meta"></p></div>
      </div>
      <div class="terminal-window-actions" aria-label="Terminal window controls">
        <button class="terminal-model-control hidden" data-action="terminal-command" data-command="/model" type="button" title="Change model and reasoning">Model</button>
        <button class="terminal-control terminal-tools-toggle hidden" data-action="terminal-tools-toggle" type="button" aria-expanded="false" aria-controls="${id}-commands" title="Show quick terminal tools"><span class="terminal-control-icon" aria-hidden="true">•••</span><span class="terminal-control-label terminal-control-label-mobile" aria-hidden="true">Tools</span></button>
        <button class="terminal-control terminal-minimize" data-action="terminal-minimize" type="button" title="Dock view and return to the workspace; agent and draft stay active" aria-label="Dock terminal view and return to the workspace; agent and draft stay active"><span class="terminal-control-icon" aria-hidden="true">−</span><span class="terminal-control-label terminal-control-label-desktop" aria-hidden="true">Dock</span><span class="terminal-control-label terminal-control-label-mobile" aria-hidden="true">Back</span></button>
        <button class="terminal-control terminal-maximize" data-action="terminal-maximize" type="button" title="Maximize" aria-label="Maximize">□</button>
        <button class="terminal-control terminal-close" data-action="terminal-close" type="button" title="${closeViewLabel}" aria-label="${closeViewLabel}">×</button>
      </div>
    </div>
    <div class="terminal-mobile-switcher hidden" role="group" aria-label="Switch open terminal">
      <button class="terminal-mobile-previous" data-action="terminal-cycle-prev" type="button" aria-label="Previous terminal" title="Previous terminal">‹</button>
      <label class="terminal-mobile-picker"><span class="sr-only">Choose open terminal</span><select class="terminal-mobile-select" aria-label="Choose open terminal"></select></label>
      <button class="terminal-mobile-next" data-action="terminal-cycle-next" type="button" aria-label="Next terminal" title="Next terminal">›</button>
    </div>
    <button class="terminal-mobile-telemetry hidden" data-action="terminal-telemetry-toggle" type="button" aria-controls="${id}-telemetry" aria-expanded="false" aria-label="Codex status and usage pending"></button>
    <section id="${id}-telemetry" class="terminal-telemetry-panel hidden" aria-label="Codex status and usage"></section>
    <div id="${id}-commands" class="terminal-command-bar hidden" role="toolbar" aria-label="Terminal tools and Codex quick commands">
      <span class="terminal-tool-group terminal-reading-tools" role="group" aria-label="Reading tools">
        <span class="terminal-tool-group-label" aria-hidden="true">Read</span>
        <button class="terminal-copy-output" data-action="terminal-copy-output" type="button" title="Copy the currently captured terminal output">Copy</button>
        <button class="terminal-find-toggle" data-action="terminal-find-toggle" type="button" aria-expanded="false" aria-controls="${id}-find" aria-keyshortcuts="Control+F Meta+F" title="Find text in terminal output (Ctrl/⌘+F)">Find</button>
        <button class="terminal-refresh-toggle" data-action="terminal-refresh-toggle" type="button" aria-pressed="false" title="Pause live terminal capture while the agent keeps running">Pause</button>
        <span class="terminal-text-size-controls" role="group" aria-label="Terminal text size">
          <button data-action="terminal-font-scale" data-delta="-${TERMINAL_FONT_SCALE_STEP}" type="button" aria-label="Decrease terminal text size" title="Decrease terminal text size">A−</button>
          <button class="terminal-text-size-value" data-action="terminal-font-reset" type="button" aria-label="Terminal text size 100%. Reset to 100%" title="Reset terminal text size to 100%" disabled>100%</button>
          <button data-action="terminal-font-scale" data-delta="${TERMINAL_FONT_SCALE_STEP}" type="button" aria-label="Increase terminal text size" title="Increase terminal text size">A+</button>
        </span>
        <button class="terminal-wrap-control" data-action="terminal-wrap-toggle" type="button" aria-pressed="true" title="Keep long terminal lines wrapped">Wrap on</button>
      </span>
      <span class="terminal-tool-group terminal-agent-tools" role="group" aria-label="Agent commands">
        <span class="terminal-tool-group-label" aria-hidden="true">Agent</span>
        <button data-action="terminal-command" data-command="/model" type="button" title="Choose model and reasoning level">Model</button>
        <button data-action="terminal-command" data-command="/status" type="button">Status</button>
        <button data-action="terminal-command" data-command="/usage" type="button">Usage</button>
        <button data-action="terminal-command" data-command="/fast" type="button" title="Toggle fast mode">Fast</button>
        <button class="picker-toggle" data-action="terminal-picker-toggle" type="button" aria-expanded="false" title="Show controls for an already-open model picker">Picker</button>
      </span>
      <span class="terminal-tool-group terminal-recovery-tools" role="group" aria-label="Session recovery">
        <span class="terminal-tool-group-label" aria-hidden="true">Recovery</span>
        <button class="terminal-interrupt-control" data-action="session-interrupt" data-session="${escapeHtml(session || '')}" type="button" title="Recovery only: send Ctrl-C to this exact tmux session">Send Ctrl-C</button>
        <button class="terminal-stop-control" data-action="session-stop" data-session="${escapeHtml(session || '')}" type="button" title="Recovery only: stop this exact tmux session and end its agent">Stop session</button>
      </span>
    </div>
    <form id="${id}-find" class="terminal-find-bar hidden" role="search">
      <label><span class="sr-only">Find in terminal output</span><input class="terminal-find-input" type="search" autocomplete="off" enterkeyhint="search" spellcheck="false" placeholder="Find in output"></label>
      <span class="terminal-find-result" role="status" aria-live="polite">Type to find</span>
      <button data-action="terminal-find-prev" type="button" aria-label="Previous terminal output match" title="Previous match" disabled>↑</button>
      <button data-action="terminal-find-next" type="button" aria-label="Next terminal output match" title="Next match" disabled>↓</button>
      <button data-action="terminal-find-close" type="button" aria-label="Close terminal output find" title="Close find">×</button>
    </form>
    <div class="terminal-picker-bar hidden" role="toolbar" aria-label="Persistent interactive picker navigation">
      <span class="picker-status" aria-live="polite">Picker keys</span>
      <button data-action="terminal-ui-key" data-key="up" type="button" title="Move up" aria-label="Move up">↑</button>
      <button data-action="terminal-ui-key" data-key="down" type="button" title="Move down" aria-label="Move down">↓</button>
      <button data-action="terminal-ui-key" data-key="left" type="button" title="Move left" aria-label="Move left">←</button>
      <button data-action="terminal-ui-key" data-key="right" type="button" title="Move right" aria-label="Move right">→</button>
      <button class="picker-select" data-action="terminal-ui-key" data-key="select" type="button">Select</button>
      <button data-action="terminal-ui-key" data-key="cancel" type="button">Cancel</button>
    </div>
    <pre class="terminal-output" tabindex="0" aria-label="Recent terminal output"></pre>
    <button class="terminal-jump-latest hidden" data-action="terminal-jump-latest" type="button" aria-label="Jump to latest terminal output">Latest ↓</button>
    <section class="terminal-resume-panel hidden" aria-label="Restart exited Codex agent">
      <div><strong>Codex exited; tmux is still running</strong><span>Restart Codex here to resume the last session.</span></div>
      <button class="primary-button" data-action="terminal-resume-agent" type="button">Restart Codex</button>
    </section>
    <form class="send-form terminal-send-form hidden">
      <div class="terminal-composer-head">
        <div class="terminal-composer-label"><label for="${id}-send-text">Reply to terminal</label><span class="terminal-draft-state neutral" role="status">No draft</span></div>
        <button class="terminal-composer-toggle" data-action="terminal-composer-toggle" type="button" aria-expanded="true" aria-controls="${id}-composer-body">Hide</button>
      </div>
      <div id="${id}-composer-body" class="terminal-composer-body">
        <textarea id="${id}-send-text" class="terminal-send-text" rows="3" maxlength="${SEND_TEXT_MAX}" enterkeyhint="send" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Send text exactly like typing in this tmux pane"></textarea>
        <div class="paste-preview hidden" role="status">
          <div><strong>Review paste</strong><span class="paste-preview-meta"></span><pre class="paste-preview-text"></pre></div>
          <div><button class="tool-button tool-button-text" data-action="paste-insert" type="button">Insert</button><button class="tool-button tool-button-text" data-action="paste-cancel" type="button">Cancel</button></div>
        </div>
        <div class="send-toolbar" aria-label="Terminal input tools">
          <button class="tool-button" data-action="send-newline" type="button" title="Insert line break" aria-label="Insert line break">↵</button>
          <button class="tool-button tool-button-text" data-action="send-indent" type="button" title="Insert indentation" aria-label="Insert indentation">Tab</button>
          <button class="tool-button" data-action="send-history-prev" type="button" title="Previous sent input" aria-label="Previous sent input">↑</button>
          <button class="tool-button" data-action="send-history-next" type="button" title="Next sent input" aria-label="Next sent input">↓</button>
          <button class="tool-button" data-action="send-clear" type="button" title="Clear input" aria-label="Clear input">×</button>
          <button class="tool-button tool-button-text send-undo" data-action="send-undo" type="button" title="Restore cleared input" aria-label="Restore cleared input" disabled>Undo</button>
          <span class="send-counter">0/${SEND_TEXT_MAX}</span>
        </div>
        <div class="form-row">
          <span class="send-hint">${TERMINAL_SEND_HINT}</span>
          <button class="primary-button send-submit" type="submit">Send / Enter</button>
        </div>
      </div>
    </form>
    <span class="terminal-resize-handle resize-n" data-terminal-resize="n" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-e" data-terminal-resize="e" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-s" data-terminal-resize="s" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-w" data-terminal-resize="w" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-ne" data-terminal-resize="ne" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-se" data-terminal-resize="se" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-sw" data-terminal-resize="sw" aria-hidden="true"></span>
    <span class="terminal-resize-handle resize-nw" data-terminal-resize="nw" aria-hidden="true"></span>
  `;

  const item = {
    id,
    session,
    paneId,
    mode,
    lines,
    element,
    title: element.querySelector('.terminal-title'),
    headerStatus: element.querySelector('.terminal-header-status'),
    headerUsage: element.querySelector('.terminal-header-usage'),
    mobileTelemetry: element.querySelector('.terminal-mobile-telemetry'),
    telemetryPanel: element.querySelector('.terminal-telemetry-panel'),
    meta: element.querySelector('.terminal-meta'),
    capturePausedBadge: element.querySelector('.terminal-capture-paused'),
    output: element.querySelector('.terminal-output'),
    latestButton: element.querySelector('.terminal-jump-latest'),
    resumePanel: element.querySelector('.terminal-resume-panel'),
    resumeButton: element.querySelector('[data-action="terminal-resume-agent"]'),
    commandBar: element.querySelector('.terminal-command-bar'),
    agentTools: element.querySelector('.terminal-agent-tools'),
    recoveryTools: element.querySelector('.terminal-recovery-tools'),
    quickCommands: [...element.querySelectorAll('[data-action="terminal-command"], .picker-toggle')],
    findToggle: element.querySelector('.terminal-find-toggle'),
    findBar: element.querySelector('.terminal-find-bar'),
    findInput: element.querySelector('.terminal-find-input'),
    findResult: element.querySelector('.terminal-find-result'),
    findPrevious: element.querySelector('[data-action="terminal-find-prev"]'),
    findNext: element.querySelector('[data-action="terminal-find-next"]'),
    refreshToggle: element.querySelector('.terminal-refresh-toggle'),
    headerModel: element.querySelector('.terminal-model-control'),
    toolsToggle: element.querySelector('.terminal-tools-toggle'),
    mobileSwitcher: element.querySelector('.terminal-mobile-switcher'),
    mobileSelect: element.querySelector('.terminal-mobile-select'),
    mobilePrevious: element.querySelector('.terminal-mobile-previous'),
    mobileNext: element.querySelector('.terminal-mobile-next'),
    pickerBar: element.querySelector('.terminal-picker-bar'),
    pickerStatus: element.querySelector('.picker-status'),
    pickerToggle: element.querySelector('.picker-toggle'),
    pickerButtons: [...element.querySelectorAll('.terminal-picker-bar button')],
    sendForm: element.querySelector('.terminal-send-form'),
    composerToggle: element.querySelector('.terminal-composer-toggle'),
    draftState: element.querySelector('.terminal-draft-state'),
    sendText: element.querySelector('.terminal-send-text'),
    sendCounter: element.querySelector('.send-counter'),
    sendHint: element.querySelector('.send-hint'),
    sendSubmit: element.querySelector('.send-submit'),
    sendUndo: element.querySelector('.send-undo'),
    pastePreview: element.querySelector('.paste-preview'),
    pastePreviewMeta: element.querySelector('.paste-preview-meta'),
    pastePreviewText: element.querySelector('.paste-preview-text'),
    sendTools: [...element.querySelectorAll('.tool-button')],
    maximizeButton: element.querySelector('.terminal-maximize'),
    timer: null,
    pollInFlight: false,
    refreshPaused: Boolean(refreshPaused),
    captureFailureCount: 0,
    captureUnavailable: false,
    nextRefreshDelay: DETAIL_REFRESH_MS,
    token: 1,
    minimized: false,
    maximized: false,
    restoreBounds: null,
    sendInFlight: false,
    uiKeyInFlight: false,
    uiKeyQueue: [],
    pickerActive: false,
    pickerStage: 'closed',
    toolsCollapsed: !isDesktopTerminalMode(),
    telemetryOpen: false,
    composerCollapsed: !isDesktopTerminalMode(),
    draftStorageAvailable: true,
    forceScrollUntil: 0,
    scrollToBottomOnNextOutput: true,
    hasUnseenOutput: false,
    outputText: output || '(no output)',
    findOpen: false,
    findQuery: '',
    findMatches: [],
    findIndex: -1,
    sendUndoText: '',
    promptSubmitRequestedAt: 0,
    allowLineBreakUntil: 0,
    pendingPaste: '',
    sendHistory: loadTerminalHistory(session),
    sendHistoryIndex: 0,
    openedAt: Date.now(),
    focusedAt: Date.now(),
    freeBounds: null,
    fullHeightRestoreBounds: null,
    returnFocus
  };

  item.sendHistoryIndex = item.sendHistory.length;
  item.output.addEventListener('scroll', () => syncTerminalLatestControl(item));
  if (session && mode !== 'static') item.sendText.value = safeStorageGet(terminalDraftKey(session));

  item.title.textContent = title;
  item.meta.textContent = meta;
  item.output.textContent = item.outputText;
  state.terminalWindows.set(id, item);
  state.selectedSession = session || state.selectedSession;
  els.terminalLayer.append(element);
  syncTerminalFontScale();
  syncTerminalWrap();
  syncTerminalTools(item, false);
  placeTerminalWindow(item);
  const applyRestoredFreeBounds = () => {
    if (!restoredFreeBounds) return;
    item.freeBounds = { ...restoredFreeBounds };
    if (!isDesktopTerminalMode()) return;
    item.element.style.left = `${item.freeBounds.left}px`;
    item.element.style.top = `${item.freeBounds.top}px`;
    item.element.style.width = `${item.freeBounds.width}px`;
    item.element.style.height = `${item.freeBounds.height}px`;
    constrainTerminalWindow(item);
    captureTerminalFreeBounds(item);
  };
  applyRestoredFreeBounds();
  focusTerminalWindow(item);
  forceTerminalScrollBottom(item);

  if (mode !== 'static') {
    updateTerminalSendForm(item);
    if (!item.refreshPaused) refreshTerminalWindow(item);
  }
  renderTerminalChrome();
  window.requestAnimationFrame(() => {
    if (isDesktopTerminalMode() && state.terminalLayout === 'free' && state.terminalWindows.has(item.id)) {
      if (restoredFreeBounds) applyRestoredFreeBounds();
      else placeTerminalWindow(item);
      applyTerminalLayout();
    }
    forceTerminalScrollBottom(item);
    terminalFocusTarget(item).focus({ preventScroll: true });
  });
  return item;
}

function isDesktopTerminalMode() {
  return terminalDesktopLayout(window.matchMedia(TERMINAL_DESKTOP_QUERY).matches, isPhoneLayoutMode());
}

function isPhoneLayoutMode() {
  return window.matchMedia(PHONE_LAYOUT_QUERY).matches;
}

function terminalFocusTarget(item) {
  const editorAvailable = !item.sendForm.classList.contains('hidden') && !item.composerCollapsed;
  return terminalFocusKind(isDesktopTerminalMode(), editorAvailable) === 'editor' ? item.sendText : item.output;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function placeTerminalWindow(item) {
  if (!isDesktopTerminalMode()) return;
  const cascade = (state.terminalWindows.size - 1) % 8;
  const bounds = terminalWorkspaceBounds();
  const width = Math.max(420, Math.min(820, bounds.width - 24));
  const height = Math.max(280, Math.min(660, bounds.height - 24));
  item.element.style.width = `${width}px`;
  item.element.style.height = `${height}px`;
  item.element.style.left = `${bounds.left + 12 + cascade * 24}px`;
  item.element.style.top = `${bounds.top + 12 + cascade * 20}px`;
  constrainTerminalWindow(item);
  captureTerminalFreeBounds(item);
}

function constrainTerminalWindow(item) {
  if (!isDesktopTerminalMode() || item.minimized) return;
  const layerRect = els.terminalLayer.getBoundingClientRect();
  const rect = item.element.getBoundingClientRect();
  const bounds = terminalWorkspaceBounds();
  const width = Math.min(rect.width, bounds.width - 16);
  const height = Math.min(rect.height, bounds.height - 16);
  const localLeft = rect.left - layerRect.left;
  const localTop = rect.top - layerRect.top;
  const left = clamp(localLeft, bounds.left + 8, bounds.left + bounds.width - width - 8);
  const top = clamp(localTop, bounds.top + 8, bounds.top + bounds.height - height - 8);
  item.element.style.width = `${width}px`;
  item.element.style.height = `${height}px`;
  item.element.style.left = `${left}px`;
  item.element.style.top = `${top}px`;
}

function terminalRelativeBounds(item) {
  const layerRect = els.terminalLayer.getBoundingClientRect();
  const rect = item.element.getBoundingClientRect();
  return {
    left: rect.left - layerRect.left,
    top: rect.top - layerRect.top,
    width: rect.width,
    height: rect.height
  };
}

function applyTerminalFullHeightToItem(item) {
  if (!item || item.minimized || item.maximized || !isDesktopTerminalMode()) return;
  const current = terminalRelativeBounds(item);
  if (!item.fullHeightRestoreBounds) item.fullHeightRestoreBounds = { ...current };
  const bounds = terminalWorkspaceBounds();
  const fitted = terminalFullHeightBounds({
    ...current,
    left: current.left - bounds.left,
    top: current.top - bounds.top
  }, bounds.width, bounds.height);
  const workspaceFitted = {
    ...fitted,
    left: bounds.left + fitted.left,
    top: bounds.top + fitted.top
  };
  item.element.classList.add('is-full-height');
  item.element.style.left = `${workspaceFitted.left}px`;
  item.element.style.top = `${workspaceFitted.top}px`;
  item.element.style.width = `${workspaceFitted.width}px`;
  item.element.style.height = `${workspaceFitted.height}px`;
  item.freeBounds = { ...workspaceFitted };
}

function restoreTerminalFullHeightItem(item) {
  const restore = item?.fullHeightRestoreBounds;
  if (!item || !restore) return;
  item.element.classList.remove('is-full-height');
  item.fullHeightRestoreBounds = null;
  if (item.maximized) {
    item.restoreBounds = { ...restore };
    return;
  }
  item.element.style.left = `${restore.left}px`;
  item.element.style.top = `${restore.top}px`;
  item.element.style.width = `${restore.width}px`;
  item.element.style.height = `${restore.height}px`;
  constrainTerminalWindow(item);
  captureTerminalFreeBounds(item);
}

function setTerminalFullHeight(enabled = !state.terminalFullHeight, { render = true } = {}) {
  if (!isDesktopTerminalMode() && enabled) return;
  if (enabled && !state.terminalWindows.size) {
    setNotice('Open a terminal first, then use Full height.');
    return;
  }
  if (enabled && state.terminalLayout !== 'free') {
    state.terminalLayout = 'free';
    safeStorageSet('host-control:terminal-layout', 'free');
  }
  state.terminalFullHeight = Boolean(enabled);
  if (state.terminalFullHeight) {
    applyTerminalLayout();
  } else {
    for (const item of state.terminalWindows.values()) restoreTerminalFullHeightItem(item);
    applyTerminalLayout();
  }
  if (render) renderTerminalChrome();
  persistTerminalWorkspace();
}

function syncWorkspaceFocus() {
  const presentation = workspaceFocusPresentation(state.workspaceFocus);
  els.appShell.classList.toggle('is-canvas-focused', workspaceFocusApplies(state.workspaceFocus, state.activeView));
  els.workspaceFocusToggle.classList.toggle('active', state.workspaceFocus);
  els.workspaceFocusToggle.setAttribute('aria-pressed', state.workspaceFocus ? 'true' : 'false');
  els.workspaceFocusToggle.setAttribute('aria-label', `${presentation.description} (Alt+0)`);
  els.workspaceFocusToggle.title = `${presentation.description} (Alt+0)`;
  els.workspaceFocusToggle.querySelector('.layout-label-full').textContent = presentation.label;
  els.workspaceFocusToggle.querySelector('.layout-label-short').textContent = presentation.shortLabel;
}

function setWorkspaceFocus(enabled = !state.workspaceFocus) {
  state.workspaceFocus = Boolean(enabled);
  safeStorageSet(WORKSPACE_FOCUS_STORAGE_KEY, state.workspaceFocus ? 'true' : 'false');
  syncWorkspaceFocus();
  window.requestAnimationFrame(() => window.requestAnimationFrame(handleTerminalViewportResize));
}

function syncWorkspacePanels() {
  const panels = [
    {
      visible: state.sessionPanelVisible,
      button: els.sessionPanelToggle,
      className: 'is-session-panel-hidden',
      visibleTitle: 'Hide sessions panel',
      hiddenTitle: 'Show sessions panel'
    },
    {
      visible: state.inspectorPanelVisible,
      button: els.inspectorPanelToggle,
      className: 'is-inspector-panel-hidden',
      visibleTitle: 'Hide selected-agent details',
      hiddenTitle: 'Show selected-agent details'
    }
  ];
  for (const panel of panels) {
    els.appShell.classList.toggle(panel.className, !panel.visible);
    panel.button.classList.toggle('active', panel.visible);
    panel.button.setAttribute('aria-pressed', panel.visible ? 'true' : 'false');
    panel.button.setAttribute('aria-label', panel.visible ? panel.visibleTitle : panel.hiddenTitle);
    panel.button.title = panel.visible ? panel.visibleTitle : panel.hiddenTitle;
  }
}

function toggleWorkspacePanel(panel) {
  if (panel === 'sessions') {
    state.sessionPanelVisible = !state.sessionPanelVisible;
    safeStorageSet(SESSION_PANEL_STORAGE_KEY, state.sessionPanelVisible ? 'true' : 'false');
  } else if (panel === 'inspector') {
    state.inspectorPanelVisible = !state.inspectorPanelVisible;
    safeStorageSet(INSPECTOR_PANEL_STORAGE_KEY, state.inspectorPanelVisible ? 'true' : 'false');
  } else {
    return;
  }
  syncWorkspacePanels();
  window.requestAnimationFrame(() => window.requestAnimationFrame(handleTerminalViewportResize));
}

function terminalFontBaseSize() {
  if (window.innerWidth >= 2200) return 13;
  if (window.innerWidth >= 1600) return 12.5;
  return 12;
}

function syncTerminalFontScale() {
  const scale = Math.round(state.terminalFontScale * 10) / 10;
  const percentage = `${Math.round(scale * 100)}%`;
  const size = Math.round(terminalFontBaseSize() * scale * 10) / 10;
  document.documentElement.style.setProperty('--terminal-font-size', `${size}px`);
  document.querySelectorAll('.terminal-text-size-value').forEach((value) => {
    value.textContent = percentage;
    const resetAvailable = scale !== 1;
    value.disabled = !resetAvailable;
    value.classList.toggle('can-reset', resetAvailable);
    value.setAttribute('aria-label', resetAvailable
      ? `Terminal text size ${percentage}. Reset to 100%`
      : 'Terminal text size 100%');
  });
  document.querySelectorAll('[data-action="terminal-font-scale"]').forEach((button) => {
    const delta = Number(button.dataset.delta);
    button.disabled = delta < 0 ? scale <= TERMINAL_FONT_SCALE_MIN : scale >= TERMINAL_FONT_SCALE_MAX;
  });
}

function adjustTerminalFontScale(delta) {
  const next = clamp(state.terminalFontScale + Number(delta || 0), TERMINAL_FONT_SCALE_MIN, TERMINAL_FONT_SCALE_MAX);
  state.terminalFontScale = Math.round(next * 10) / 10;
  safeStorageSet(TERMINAL_FONT_SCALE_STORAGE_KEY, String(state.terminalFontScale));
  syncTerminalFontScale();
}

function resetTerminalFontScale() {
  if (state.terminalFontScale === 1) return;
  state.terminalFontScale = 1;
  safeStorageSet(TERMINAL_FONT_SCALE_STORAGE_KEY, '1');
  syncTerminalFontScale();
  setNotice('Terminal text reset to 100%.');
}

function syncTerminalWrap() {
  document.documentElement.classList.toggle('is-terminal-nowrap', !state.terminalWrap);
  document.querySelectorAll('[data-action="terminal-wrap-toggle"]').forEach((button) => {
    button.textContent = state.terminalWrap ? 'Wrap on' : 'No wrap';
    button.classList.toggle('active', state.terminalWrap);
    button.setAttribute('aria-pressed', state.terminalWrap ? 'true' : 'false');
    button.setAttribute('aria-label', state.terminalWrap ? 'Disable terminal line wrapping' : 'Enable terminal line wrapping');
    button.title = state.terminalWrap
      ? 'Disable wrapping and keep long lines horizontally scrollable'
      : 'Enable wrapping to fit long lines to the window width';
  });
}

function toggleTerminalWrap() {
  state.terminalWrap = !state.terminalWrap;
  safeStorageSet(TERMINAL_WRAP_STORAGE_KEY, state.terminalWrap ? 'true' : 'false');
  syncTerminalWrap();
}

function focusTerminalWindow(item) {
  if (!item || item.minimized) return;
  const alreadyActive = state.activeTerminalId === item.id;
  state.activeTerminalId = item.id;
  state.selectedSession = item.session || state.selectedSession;
  item.focusedAt = Date.now();
  if (alreadyActive) return;
  state.topTerminalZ += 1;
  item.element.style.zIndex = String(state.topTerminalZ);
  applyTerminalLayout();
  renderTerminalChrome();
  persistTerminalWorkspace();
}

function cycleTerminalWindow(item, direction) {
  if (!item) return;
  const items = [...state.terminalWindows.values()].filter((candidate) => !candidate.minimized);
  if (items.length < 2) return;
  const nextIndex = cycledItemIndex(items.indexOf(item), items.length, direction);
  const next = items[nextIndex];
  if (!next) return;
  focusTerminalWindow(next);
  next.output.focus({ preventScroll: true });
}

function cycleActiveTerminal(direction) {
  const items = [...state.terminalWindows.values()].filter((candidate) => !candidate.minimized);
  const active = state.terminalWindows.get(state.activeTerminalId);
  const current = active && items.includes(active) ? active : items.at(-1);
  cycleTerminalWindow(current, direction);
}

function activateTerminalWindow(item) {
  if (!item) return;
  if (item.minimized) restoreTerminalWindow(item);
  else {
    focusTerminalWindow(item);
    applyTerminalLayout();
    renderTerminalChrome();
  }
  item.output.focus({ preventScroll: true });
}

function terminalItemFromTarget(target) {
  const element = target?.closest?.('.terminal-window');
  if (element) return state.terminalWindows.get(element.dataset.terminalId) || null;
  const id = target?.dataset?.terminalId;
  return id ? state.terminalWindows.get(id) || null : null;
}

function closeTerminalWindow(item, { announce = false } = {}) {
  if (!item) return;
  const displayName = item.session ? displayNameForSession(item.session) : item.title.textContent || 'Terminal';
  if (item.timer) window.clearTimeout(item.timer);
  item.token += 1;
  state.terminalWindows.delete(item.id);
  if (!state.terminalWindows.size) state.terminalFullHeight = false;
  if (state.activeTerminalId === item.id) {
    const replacement = [...state.terminalWindows.values()].filter((candidate) => !candidate.minimized).at(-1) || null;
    state.activeTerminalId = replacement?.id || null;
    state.selectedSession = replacement?.session || null;
  }
  item.element.remove();
  renderTerminalDock();
  applyTerminalLayout();
  renderTerminalChrome();
  persistTerminalWorkspace();
  if (item.returnFocus?.isConnected) item.returnFocus.focus({ preventScroll: true });
  if (announce) setNotice(item.mode === 'static'
    ? `Closed the ${displayName} terminal view.`
    : `Closed the ${displayName} terminal view. The agent keeps running; reopen it from Sessions.`);
}

function minimizeTerminalWindow(item) {
  if (!item || item.minimized) return;
  if (item.timer) window.clearTimeout(item.timer);
  item.timer = null;
  item.minimized = true;
  item.element.classList.add('is-minimized');
  if (state.activeTerminalId === item.id) {
    const replacement = [...state.terminalWindows.values()].find((candidate) => !candidate.minimized && candidate !== item);
    state.activeTerminalId = replacement?.id || null;
    state.selectedSession = replacement?.session || null;
  }
  renderTerminalDock();
  applyTerminalLayout();
  renderTerminalChrome();
  persistTerminalWorkspace();
  els.terminalTabs.querySelector(`[data-terminal-id="${item.id}"]`)?.focus({ preventScroll: true });
  const displayName = item.session ? displayNameForSession(item.session) : item.title.textContent || 'Terminal';
  setNotice(item.mode === 'static'
    ? `Docked the ${displayName} terminal view.`
    : `Docked the ${displayName} terminal view. The agent and your draft stay active.`);
}

function restoreTerminalWindow(item) {
  if (!item) return;
  item.minimized = false;
  item.element.classList.remove('is-minimized');
  if (state.terminalFullHeight && !item.fullHeightRestoreBounds) applyTerminalFullHeightToItem(item);
  renderTerminalDock();
  focusTerminalWindow(item);
  terminalFocusTarget(item).focus({ preventScroll: true });
  if (item.mode !== 'static') scheduleTerminalRefresh(item, 0);
  renderTerminalChrome();
  persistTerminalWorkspace();
}

function renderTerminalDock() {
  els.terminalDock.replaceChildren();
  const minimized = [...state.terminalWindows.values()].filter((item) => item.minimized);
  els.terminalDock.classList.toggle('hidden', minimized.length === 0);
  for (const item of minimized) {
    const button = document.createElement('button');
    button.className = 'terminal-dock-button';
    button.type = 'button';
    button.dataset.action = 'terminal-restore';
    button.dataset.terminalId = item.id;
    button.textContent = item.title.textContent || item.session || 'Terminal';
    button.title = `Restore ${button.textContent}`;
    els.terminalDock.append(button);
  }
}

function toggleTerminalMaximize(item) {
  if (!item || !isDesktopTerminalMode()) return;
  if (state.terminalLayout !== 'free') {
    focusTerminalWindow(item);
    if (state.terminalLayout !== 'focus') setTerminalLayout('focus');
    return;
  }
  if (item.maximized) {
    const bounds = item.restoreBounds;
    item.maximized = false;
    item.element.classList.remove('is-maximized');
    item.maximizeButton.textContent = '□';
    item.maximizeButton.title = 'Maximize';
    item.maximizeButton.setAttribute('aria-label', 'Maximize');
    if (bounds) {
      item.element.style.left = `${bounds.left}px`;
      item.element.style.top = `${bounds.top}px`;
      item.element.style.width = `${bounds.width}px`;
      item.element.style.height = `${bounds.height}px`;
    }
    constrainTerminalWindow(item);
    captureTerminalFreeBounds(item);
    if (state.terminalFullHeight) applyTerminalFullHeightToItem(item);
    persistTerminalWorkspace();
    return;
  }

  const rect = item.element.getBoundingClientRect();
  const layerRect = els.terminalLayer.getBoundingClientRect();
  item.restoreBounds = { left: rect.left - layerRect.left, top: rect.top - layerRect.top, width: rect.width, height: rect.height };
  item.maximized = true;
  item.element.classList.add('is-maximized');
  item.maximizeButton.textContent = '❐';
  item.maximizeButton.title = 'Restore size';
  item.maximizeButton.setAttribute('aria-label', 'Restore size');
  const bounds = terminalWorkspaceBounds();
  item.element.style.left = `${bounds.left + 8}px`;
  item.element.style.top = `${bounds.top + 8}px`;
  item.element.style.width = `${bounds.width - 16}px`;
  item.element.style.height = `${bounds.height - 16}px`;
  focusTerminalWindow(item);
  persistTerminalWorkspace();
}

function beginTerminalPointerInteraction(event, item, resizeDirection = '') {
  if (
    !item ||
    !terminalPointerInteractionAllowed({
      desktop: isDesktopTerminalMode(),
      layout: state.terminalLayout,
      maximized: item.maximized,
      button: event.button,
      pointerType: event.pointerType
    })
  ) return;
  const heightLocked = Boolean(state.terminalFullHeight && item.fullHeightRestoreBounds);
  if (heightLocked && resizeDirection && !['e', 'w'].includes(resizeDirection)) return;
  event.preventDefault();
  focusTerminalWindow(item);
  const start = item.element.getBoundingClientRect();
  const layerRect = els.terminalLayer.getBoundingClientRect();
  const bounds = terminalWorkspaceBounds();
  const startLeft = start.left - layerRect.left;
  const startTop = start.top - layerRect.top;
  const startX = event.clientX;
  const startY = event.clientY;
  const minWidth = Math.min(420, bounds.width - 16);
  const minHeight = Math.min(280, bounds.height - 16);
  const minimumLeft = bounds.left + 8;
  const minimumTop = bounds.top + 8;
  const maximumRight = bounds.left + bounds.width - 8;
  const maximumBottom = bounds.top + bounds.height - 8;
  document.body.classList.add('terminal-moving');

  const move = (moveEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    let left = startLeft;
    let top = startTop;
    let width = start.width;
    let height = start.height;

    if (!resizeDirection) {
      left = clamp(startLeft + dx, minimumLeft, maximumRight - start.width);
      if (!heightLocked) top = clamp(startTop + dy, minimumTop, maximumBottom - start.height);
    } else {
      const right = startLeft + start.width;
      const bottom = startTop + start.height;
      if (resizeDirection.includes('e')) width = clamp(start.width + dx, minWidth, maximumRight - startLeft);
      if (resizeDirection.includes('s')) height = clamp(start.height + dy, minHeight, maximumBottom - startTop);
      if (resizeDirection.includes('w')) {
        left = clamp(startLeft + dx, minimumLeft, right - minWidth);
        width = right - left;
      }
      if (resizeDirection.includes('n')) {
        top = clamp(startTop + dy, minimumTop, bottom - minHeight);
        height = bottom - top;
      }
    }

    item.element.style.left = `${left}px`;
    item.element.style.top = `${top}px`;
    item.element.style.width = `${width}px`;
    item.element.style.height = `${height}px`;
  };

  const end = () => {
    document.body.classList.remove('terminal-moving');
    captureTerminalFreeBounds(item);
    persistTerminalWorkspace();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

function handleTerminalViewportResize() {
  const desktopMode = isDesktopTerminalMode();
  const collapseChrome = terminalChromeCollapseAfterLayoutChange(previousTerminalDesktopMode, desktopMode);
  previousTerminalDesktopMode = desktopMode;
  syncTerminalFontScale();
  for (const item of state.terminalWindows.values()) {
    if (collapseChrome !== null) {
      item.toolsCollapsed = collapseChrome;
      item.composerCollapsed = collapseChrome;
    }
    updateTerminalSendForm(item);
    if (!desktopMode) continue;
    if (item.maximized) {
      const bounds = terminalWorkspaceBounds();
      item.element.style.left = `${bounds.left + 8}px`;
      item.element.style.top = `${bounds.top + 8}px`;
      item.element.style.width = `${bounds.width - 16}px`;
      item.element.style.height = `${bounds.height - 16}px`;
    } else if (state.terminalFullHeight) {
      applyTerminalFullHeightToItem(item);
    } else {
      constrainTerminalWindow(item);
    }
  }
  applyTerminalLayout();
  renderTerminalChrome();
  revealActiveSessionFilter();
}

function scheduleTerminalViewportResize() {
  if (terminalViewportResizeFrame) return;
  terminalViewportResizeFrame = window.requestAnimationFrame(() => {
    terminalViewportResizeFrame = 0;
    handleTerminalViewportResize();
  });
}

function transientDialogOpen() {
  return Boolean(
    state.openDrawer
    || state.agentDraft.open
    || (els.shortcutHelp && !els.shortcutHelp.classList.contains('hidden'))
  );
}

function toggleTerminalBackgroundInert(element, active) {
  if (!element) return;
  const safe = modalIsolationTargetSafe(element, els.terminalLayer);
  element.toggleAttribute('inert', Boolean(active && safe));
}

function syncTerminalModalState(desktopMode = isDesktopTerminalMode()) {
  const blockingDialogOpen = transientDialogOpen();
  let mobileModalActive = false;
  for (const item of state.terminalWindows.values()) {
    const modalActive = terminalModalActive(
      desktopMode,
      blockingDialogOpen,
      item.id === state.activeTerminalId,
      item.minimized
    );
    item.element.setAttribute('aria-modal', modalActive ? 'true' : 'false');
    mobileModalActive ||= modalActive;
  }
  // The terminal layer lives inside #app, so making #app inert also disables
  // every control in the active phone terminal. Isolate only its background
  // siblings and leave the modal terminal itself interactive.
  els.appShell.removeAttribute('inert');
  toggleTerminalBackgroundInert(els.sidebar, mobileModalActive);
  toggleTerminalBackgroundInert(els.workspace, mobileModalActive);
  toggleTerminalBackgroundInert(els.terminalDock, mobileModalActive);
}

function currentAgent(session) {
  return state.snapshot?.agents.find((item) => item.session === session);
}

function currentTerminalSession(session) {
  const snapshot = state.snapshot || {};
  const services = (snapshot.services || []).filter(isDisplayableService);
  return terminalRailEntries(snapshot.agents || [], services).find((item) => item.session === session) || null;
}

function currentBrief(session) {
  return state.snapshot?.orchestration?.agents?.find((item) => item.session === session);
}

function displayNameForSession(session) {
  const displayName = currentBrief(session)?.displayName || session;
  return String(session || '').endsWith('-idea-scout') ? `Idea Scout · ${displayName}` : displayName;
}

function syncOpenTerminalWindows({ protectedEditor = null } = {}) {
  for (const item of state.terminalWindows.values()) {
    if (item.mode === 'agent') item.title.textContent = displayNameForSession(item.session);
    if (item.mode !== 'static' && item.sendText !== protectedEditor) updateTerminalSendForm(item);
  }
  if (protectedEditor?.isConnected) return;
  renderTerminalDock();
  applyTerminalLayout();
  renderTerminalChrome();
}

function agentDetailHeaderLines(session, data = null) {
  const agent = currentAgent(session);
  const brief = currentBrief(session);
  const canPrompt = canPromptAgent(session);
  return [
    `Role: ${displayNameForSession(session)}`,
    `Session: ${session}`,
    `Orchestrator checked: ${checkedLabel(brief?.checkedAt)}`,
    `History: ${sampleMeta(brief) || 'collecting samples'}`,
    `Status: ${brief?.state || agent?.agentStatus?.state || 'unknown'} (${brief?.reason || agent?.agentStatus?.reason || 'process alive'})`,
    `Prompt input: ${canPrompt.ok ? 'available' : canPrompt.reason}`,
    `Path: ${shortPath(data?.pane?.currentPath || agent?.currentPath || '')}`,
    `CPU / Mem: ${cpuMem(agent?.primaryProcess)}`
  ];
}

function buildAgentDetailText(session, data = null) {
  const agent = currentAgent(session);
  const brief = currentBrief(session);
  const lines = [
    ...agentDetailHeaderLines(session, data),
    '',
    'Orchestrator summary:',
    brief?.summary || agent?.lastLine || 'No recent visible output.',
    '',
    'Recommended next action:',
    brief?.nextAction || 'Keep monitoring.',
    ''
  ];
  if (data) {
    lines.push(`Recent output (live, refreshes every ${(DETAIL_REFRESH_MS / 1000).toFixed(1)}s):`, data.output || '(no recent output)');
  } else {
    lines.push('Loading live recent output...');
  }
  return lines.join('\n');
}

function updateTerminalSendForm(item) {
  const canPrompt = canPromptAgent(item.session);
  const resume = terminalAgentResumePresentation(item, currentAgent(item.session));
  item.sendForm.classList.toggle('hidden', !canPrompt.ok);
  item.resumePanel.classList.toggle('hidden', !resume);
  item.resumeButton.disabled = !resume;
  item.resumeButton.title = resume?.description || '';
  const commandsAvailable = item.mode === 'agent' && canPrompt.ok;
  syncTerminalTools(item, commandsAvailable);
  item.headerModel.classList.toggle('hidden', !commandsAvailable);
  if (!commandsAvailable) toggleTerminalPickerControls(item, false);
  updateSendInputState(item);
}

function syncTerminalTools(item, commandsAvailable = item.mode === 'agent' && canPromptAgent(item.session).ok) {
  const collapsed = !isDesktopTerminalMode() && item.toolsCollapsed;
  const expanded = !collapsed;
  item.element.classList.toggle('is-tools-collapsed', collapsed);
  item.commandBar.classList.toggle('hidden', !expanded);
  item.quickCommands.forEach((button) => button.classList.toggle('hidden', !commandsAvailable));
  item.agentTools.classList.toggle('hidden', !commandsAvailable);
  item.recoveryTools.classList.toggle('hidden', item.mode === 'static' || !item.session);
  item.refreshToggle.classList.toggle('hidden', item.mode === 'static');
  item.toolsToggle.classList.remove('hidden');
  item.toolsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  item.toolsToggle.setAttribute('aria-label', expanded ? 'Hide quick terminal tools' : 'Show quick terminal tools');
  item.toolsToggle.title = expanded ? 'Hide quick terminal tools' : 'Show quick terminal tools';
  syncTerminalRefreshState(item);
}

function setTerminalToolsCollapsed(item, collapsed) {
  if (!item) return;
  item.toolsCollapsed = Boolean(collapsed);
  syncTerminalTools(item);
  updateSendInputState(item);
  item.toolsToggle.focus({ preventScroll: true });
}

function setTerminalTelemetryOpen(item, open) {
  if (!item?.telemetryPanel || !item.headerUsage) return;
  item.telemetryOpen = Boolean(open);
  item.telemetryPanel.classList.toggle('hidden', !item.telemetryOpen);
  item.headerUsage.setAttribute('aria-expanded', item.telemetryOpen ? 'true' : 'false');
  item.mobileTelemetry?.setAttribute('aria-expanded', item.telemetryOpen ? 'true' : 'false');
  if (item.telemetryOpen) item.telemetryPanel.innerHTML = terminalTelemetryMarkup(currentAgent(item.session));
}

function syncTerminalComposer(item) {
  const collapsed = Boolean(item.composerCollapsed);
  const hasDraft = Boolean(item.sendText.value || item.pendingPaste);
  const draftSaved = item.draftStorageAvailable !== false && !item.pendingPaste;
  const presentation = terminalComposerPresentation(collapsed, hasDraft, draftSaved);
  const draftPresentation = terminalDraftPresentation(item.sendText.value, Boolean(item.pendingPaste), Boolean(item.sendInFlight), item.draftStorageAvailable !== false);
  item.sendForm.classList.toggle('is-collapsed', collapsed);
  item.composerToggle.textContent = presentation.label;
  item.composerToggle.setAttribute('aria-label', presentation.description);
  item.composerToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  item.draftState.className = `terminal-draft-state ${draftPresentation.tone}`;
  if (item.draftState.textContent !== draftPresentation.label) item.draftState.textContent = draftPresentation.label;
  item.draftState.title = draftPresentation.description;
}

function setTerminalComposerCollapsed(item, collapsed, { focus = true } = {}) {
  if (!item || item.sendForm.classList.contains('hidden')) return;
  item.composerCollapsed = Boolean(collapsed);
  syncTerminalComposer(item);
  if (!focus) return;
  window.requestAnimationFrame(() => {
    if (!state.terminalWindows.has(item.id)) return;
    if (item.composerCollapsed) item.composerToggle.focus({ preventScroll: true });
    else item.sendText.focus({ preventScroll: true });
  });
}

function canPromptAgent(session) {
  const mission = activeMissionForAgentSession(session);
  const pane = state.snapshot?.panes.find((item) =>
    item.session === session && (!mission?.assignedPaneId || item.id === mission.assignedPaneId)
  );
  const agent = state.snapshot?.agents.find((item) =>
    item.session === session && (!mission?.assignedPaneId || item.id === mission.assignedPaneId)
  );
  if (!(pane && pane.canSend && agent?.canSend)) return { ok: false, reason: 'unavailable' };
  if (mission && (!mission.worker?.present || !mission.worker?.identityMatches)) {
    return { ok: false, reason: 'assigned mission worker was replaced' };
  }
  if (mission?.status === 'dispatching') return { ok: false, reason: 'dispatching a mission' };
  if (mission?.status === 'reconcile_required') return { ok: false, reason: 'waiting for dispatch reconciliation' };
  return { ok: true, reason: 'available' };
}

function focusSendText(item) {
  item.sendText.focus({ preventScroll: true });
}

function resizeSendText(item) {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  item.sendText.style.height = 'auto';
  const nextHeight = terminalComposerTextareaHeight(viewportHeight, item.sendText.scrollHeight, isPhoneLayoutMode());
  item.sendText.style.height = `${nextHeight}px`;
  item.sendText.style.overflowY = item.sendText.scrollHeight > nextHeight + 1 ? 'auto' : 'hidden';
}

function updateSendInputState(item) {
  const length = item.sendText.value.length;
  const pickerUiAvailable = state.snapshot?.capabilities?.pickerUiKeys === true;
  const formUnavailable = item.sendForm.classList.contains('hidden');
  const interactionBusy = item.sendInFlight || item.uiKeyInFlight;
  const pickerAvailability = terminalPickerAvailability({
    mode: item.mode,
    session: item.session,
    capabilityAvailable: pickerUiAvailable,
    busy: item.sendInFlight
  });
  const promptDisabled = interactionBusy || item.pickerActive || formUnavailable;
  item.sendCounter.textContent = `${length}/${SEND_TEXT_MAX}`;
  item.sendCounter.dataset.full = length >= SEND_TEXT_MAX ? 'true' : 'false';
  item.sendForm.setAttribute('aria-busy', interactionBusy ? 'true' : 'false');
  if (item.sendText.readOnly !== promptDisabled) item.sendText.readOnly = promptDisabled;
  item.sendText.setAttribute('aria-readonly', promptDisabled ? 'true' : 'false');
  item.sendText.classList.toggle('is-picker-locked', item.pickerActive);
  const activeMission = activeMissionForAgentSession(item.session);
  item.sendHint.textContent = item.pickerActive
    ? 'Picker is controlling terminal input. Select a choice or Cancel Picker to return to typing.'
    : activeMission
      ? `Linked to mission: ${activeMission.title}. ${TERMINAL_SEND_HINT}`
      : TERMINAL_SEND_HINT;
  item.sendSubmit.disabled = promptDisabled || !item.sendText.value.trim();
  item.sendSubmit.textContent = item.sendInFlight ? 'Sending...' : 'Send / Enter';
  item.sendTools.forEach((button) => {
    button.disabled = promptDisabled;
  });
  item.quickCommands.forEach((button) => {
    const isPickerToggle = button === item.pickerToggle;
    const needsPickerUi = isPickerToggle || button.dataset.command === '/model';
    button.disabled = (needsPickerUi && !pickerUiAvailable)
      || item.commandBar.classList.contains('hidden') || item.sendInFlight || (isPickerToggle
      ? (!item.pickerActive && item.uiKeyInFlight)
      : (item.uiKeyInFlight || item.pickerActive));
    if (needsPickerUi) {
      button.title = pickerUiAvailable
        ? (isPickerToggle ? 'Recover navigation for an already-open picker' : 'Choose model and reasoning effort')
        : 'Restart the dashboard backend to enable safe picker navigation';
    }
  });
  item.pickerBar.classList.toggle('hidden', !pickerAvailability.visible);
  item.pickerButtons.forEach((button) => {
    button.disabled = !pickerAvailability.enabled;
  });
  item.sendUndo.disabled = promptDisabled || !item.sendUndoText;
  syncTerminalComposer(item);
  resizeSendText(item);
}

function toggleTerminalPickerControls(item, force = !item.pickerActive, stage = force ? 'effort' : 'closed', focusControls = false) {
  if (!item) return;
  item.pickerActive = Boolean(force);
  item.pickerStage = item.pickerActive ? stage : 'closed';
  if (!item.pickerActive) item.uiKeyQueue.length = 0;
  item.pickerToggle.setAttribute('aria-expanded', item.pickerActive ? 'true' : 'false');
  item.pickerToggle.classList.toggle('active', item.pickerActive);
  item.pickerToggle.textContent = item.pickerActive ? 'Cancel' : 'Picker';
  item.pickerStatus.textContent = item.pickerStage === 'model'
    ? 'Choose model'
    : item.pickerStage === 'effort' ? 'Choose reasoning effort' : 'Picker keys';
  updateSendInputState(item);
  if (item.pickerActive && focusControls) {
    window.requestAnimationFrame(() => {
      if (!state.terminalWindows.has(item.id) || !item.pickerActive) return;
      item.pickerBar.querySelector('[data-key="down"]')?.focus({ preventScroll: true });
    });
  }
}

function insertSendText(item, value) {
  const start = item.sendText.selectionStart ?? item.sendText.value.length;
  const end = item.sendText.selectionEnd ?? item.sendText.value.length;
  item.sendText.setRangeText(value, start, end, 'end');
  item.sendUndoText = '';
  persistTerminalDraft(item);
  updateSendInputState(item);
  focusSendText(item);
}

function clearSendText(item, { remember = true } = {}) {
  if (remember && item.sendText.value) {
    item.sendUndoText = item.sendText.value;
  } else if (!remember) {
    item.sendUndoText = '';
  }
  item.sendText.value = '';
  persistTerminalDraft(item);
  updateSendInputState(item);
  focusSendText(item);
}

function undoClearSendText(item) {
  if (!item.sendUndoText) return;
  item.sendText.value = item.sendUndoText;
  item.sendUndoText = '';
  persistTerminalDraft(item);
  updateSendInputState(item);
  focusSendText(item);
}

function isTerminalAtBottom(item) {
  return item.output.scrollHeight - item.output.scrollTop - item.output.clientHeight < 36;
}

function syncTerminalLatestControl(item, { newOutput = false } = {}) {
  if (!item?.latestButton) return;
  if (newOutput) item.hasUnseenOutput = true;
  const atBottom = isTerminalAtBottom(item);
  if (atBottom) item.hasUnseenOutput = false;
  const presentation = terminalLatestPresentation(atBottom, item.hasUnseenOutput);
  item.latestButton.classList.toggle('hidden', presentation.hidden);
  item.latestButton.classList.toggle('has-new-output', !presentation.hidden && item.hasUnseenOutput);
  item.latestButton.textContent = presentation.label;
  item.latestButton.setAttribute('aria-label', presentation.description);
}

function forceTerminalScrollBottom(item, durationMs = 1800) {
  item.forceScrollUntil = Math.max(item.forceScrollUntil, Date.now() + durationMs);
  item.output.scrollTop = item.output.scrollHeight;
  item.hasUnseenOutput = false;
  syncTerminalLatestControl(item);
}

function renderTerminalFindHighlights(item, { scroll = false } = {}) {
  if (!item?.output) return;
  const content = String(item.outputText || '(no output)');
  const query = String(item.findQuery || '');
  const matches = terminalFindOffsets(content, query);
  item.findMatches = matches;
  item.findPrevious.disabled = matches.length === 0;
  item.findNext.disabled = matches.length === 0;

  if (!query || !matches.length) {
    item.findIndex = -1;
    item.output.textContent = content;
    item.findResult.textContent = query ? 'No matches' : 'Type to find';
    return;
  }

  item.findIndex = clamp(item.findIndex < 0 ? 0 : item.findIndex, 0, matches.length - 1);
  item.findResult.textContent = `${item.findIndex + 1} / ${matches.length}`;
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let currentMatch = null;
  matches.forEach((offset, index) => {
    if (offset > cursor) fragment.append(document.createTextNode(content.slice(cursor, offset)));
    const mark = document.createElement('mark');
    mark.className = `terminal-find-match${index === item.findIndex ? ' current' : ''}`;
    mark.textContent = content.slice(offset, offset + query.length);
    fragment.append(mark);
    if (index === item.findIndex) currentMatch = mark;
    cursor = offset + query.length;
  });
  if (cursor < content.length) fragment.append(document.createTextNode(content.slice(cursor)));
  item.output.replaceChildren(fragment);

  if (scroll && currentMatch) {
    window.requestAnimationFrame(() => {
      if (!currentMatch.isConnected || !state.terminalWindows.has(item.id)) return;
      currentMatch.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
  }
}

function setTerminalFindOpen(item, open) {
  if (!item) return;
  item.findOpen = Boolean(open);
  item.findBar.classList.toggle('hidden', !item.findOpen);
  item.findToggle.classList.toggle('active', item.findOpen);
  item.findToggle.setAttribute('aria-expanded', item.findOpen ? 'true' : 'false');
  if (!item.findOpen) {
    item.findQuery = '';
    item.findInput.value = '';
    item.findIndex = -1;
    renderTerminalFindHighlights(item);
    item.findToggle.focus({ preventScroll: true });
    return;
  }
  renderTerminalFindHighlights(item, { scroll: Boolean(item.findQuery) });
  window.requestAnimationFrame(() => {
    if (!state.terminalWindows.has(item.id)) return;
    item.findInput.focus({ preventScroll: true });
    item.findInput.select();
  });
}

function stepTerminalFind(item, direction) {
  if (!item?.findMatches.length) return;
  item.findIndex = cycledItemIndex(item.findIndex, item.findMatches.length, direction);
  renderTerminalFindHighlights(item, { scroll: true });
}

function setTerminalOutput(item, value) {
  const shouldStickToBottom = shouldStickTerminalOutput(item, isTerminalAtBottom(item), Date.now());
  const previousTop = item.output.scrollTop;
  const content = value || '(no output)';
  const changed = item.outputText !== content;
  item.outputText = content;
  if (changed) renderTerminalFindHighlights(item);
  item.scrollToBottomOnNextOutput = false;
  if (shouldStickToBottom) {
    item.output.scrollTop = item.output.scrollHeight;
    item.hasUnseenOutput = false;
  } else {
    item.output.scrollTop = previousTop;
  }
  syncTerminalLatestControl(item, { newOutput: changed && !shouldStickToBottom });
}

function syncTerminalRefreshState(item) {
  if (!item?.refreshToggle) return;
  const presentation = terminalRefreshPresentation(item.refreshPaused, item.captureUnavailable);
  const paused = item.refreshPaused || item.captureUnavailable;
  item.element.classList.toggle('is-capture-paused', paused);
  item.capturePausedBadge.classList.toggle('hidden', !paused);
  item.capturePausedBadge.textContent = item.captureUnavailable ? 'Terminal unavailable' : 'Capture paused';
  item.refreshToggle.textContent = presentation.label;
  item.refreshToggle.classList.toggle('active', paused);
  item.refreshToggle.setAttribute('aria-pressed', presentation.pressed ? 'true' : 'false');
  item.refreshToggle.setAttribute('aria-label', presentation.description);
  item.refreshToggle.title = presentation.description;
}

function setTerminalRefreshPaused(item, paused) {
  if (!item || item.mode === 'static') return;
  const recoveringUnavailable = item.captureUnavailable && paused === false;
  if (!recoveringUnavailable && item.refreshPaused === Boolean(paused)) return;
  if (recoveringUnavailable) {
    item.captureUnavailable = false;
    item.captureFailureCount = 0;
    item.nextRefreshDelay = DETAIL_REFRESH_MS;
  }
  item.refreshPaused = Boolean(paused);
  if (item.refreshPaused) {
    if (item.timer) window.clearTimeout(item.timer);
    item.timer = null;
  }
  syncTerminalRefreshState(item);
  persistTerminalWorkspace();
  setNotice(terminalRefreshPresentation(item.refreshPaused, item.captureUnavailable).notice);
  if (!item.refreshPaused) refreshTerminalWindow(item);
}

function scheduleTerminalRefresh(item, delay = DETAIL_REFRESH_MS) {
  if (!state.terminalWindows.has(item.id) || item.mode === 'static' || item.minimized || item.refreshPaused || item.captureUnavailable) return;
  if (item.timer) window.clearTimeout(item.timer);
  item.timer = null;
  if (document.hidden) return;
  item.timer = window.setTimeout(() => refreshTerminalWindow(item), delay);
}

async function refreshTerminalWindow(item) {
  const { session, mode, lines, paneId, token } = item;
  if (!state.terminalWindows.has(item.id) || !session || mode === 'static' || item.pollInFlight || item.minimized || item.refreshPaused || item.captureUnavailable || document.hidden) return;
  item.pollInFlight = true;
  if (item.timer) window.clearTimeout(item.timer);
  item.timer = null;
  try {
    const paneQuery = paneId ? `&paneId=${encodeURIComponent(paneId)}` : '';
    const data = await api(`/api/pane/${encodeURIComponent(session)}/capture?lines=${lines}${paneQuery}`);
    applyBackgroundDomUpdate(`terminal:${item.id}`, () => {
      if (!state.terminalWindows.has(item.id) || token !== item.token || item.minimized || item.refreshPaused) return;
      updateTerminalSendForm(item);
      const refreshed = new Date().toLocaleTimeString();
      item.title.textContent = mode === 'agent' ? displayNameForSession(session) : session;
      item.meta.textContent = `tmux ${session} · ${shortPath(data.pane.currentPath)} · live ${refreshed} · recent ${data.lines} lines · redacted ${data.redactedCount || 0}`;
      setTerminalOutput(item, mode === 'agent' ? buildAgentDetailText(session, data) : data.output || '(no recent output)');
      item.captureFailureCount = 0;
      item.captureUnavailable = false;
      item.nextRefreshDelay = DETAIL_REFRESH_MS;
      syncTerminalRefreshState(item);
    });
  } catch (error) {
    if (state.terminalWindows.has(item.id) && token === item.token && !item.refreshPaused) {
      applyBackgroundDomUpdate(`terminal:${item.id}`, () => {
        if (!state.terminalWindows.has(item.id) || token !== item.token || item.refreshPaused) return;
        const transition = terminalCaptureFailureTransition(
          item.captureFailureCount,
          error.data?.error,
          DETAIL_REFRESH_MS
        );
        item.captureFailureCount = transition.failureCount;
        item.captureUnavailable = transition.unavailable;
        item.nextRefreshDelay = transition.retryDelayMs || DETAIL_REFRESH_MS;
        if (item.captureUnavailable) {
          item.meta.textContent = `exact terminal unavailable · capture stopped ${new Date().toLocaleTimeString()}`;
          setTerminalOutput(item, 'This exact tmux pane no longer exists. Capture stopped after three failed checks. Choose Retry to check this identity again, or reopen the current session from Sessions.');
          syncTerminalRefreshState(item);
        } else {
          item.meta.textContent = `live refresh failed · retrying · ${new Date().toLocaleTimeString()}`;
          setTerminalOutput(item, error.message);
        }
      });
    }
  } finally {
    if (state.terminalWindows.has(item.id) && token === item.token) {
      item.pollInFlight = false;
      scheduleTerminalRefresh(item, item.nextRefreshDelay || DETAIL_REFRESH_MS);
    }
  }
}

function showOutput(title, meta, output) {
  return createTerminalWindow({ mode: 'static', title, meta, output: output || '(no output)' });
}

async function serviceAction(service, action) {
  const needsConfirm = ['stop', 'restart'].includes(action);
  if (needsConfirm && !window.confirm(`${action.toUpperCase()} ${service}?`)) return;
  setNotice(`${action} requested for ${service}...`);
  try {
    await api(`/api/service/${encodeURIComponent(service)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ confirm: action })
    });
    if (action === 'start' || action === 'restart') await sleep(1800);
    setNotice(`${service} ${action} complete.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`${service} ${action} failed: ${error.message}`, 'error');
  }
}

async function runReview() {
  setNotice('Starting review agent pass...');
  try {
    const result = await api('/api/review/start', { method: 'POST', body: JSON.stringify({}) });
    setNotice(`Review started in ${result.session}.`);
    await sleep(1200);
    await loadSnapshot('manual');
    switchView('review');
  } catch (error) {
    setNotice(`Review start failed: ${error.message}`, 'error');
  }
}

function isPublicIpv4Address(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return false;
  const [a, b, c] = parts.map(Number);
  return a !== 0 && a !== 10 && a !== 127 && a < 224
    && !(a === 100 && b >= 64 && b <= 127)
    && !(a === 169 && b === 254)
    && !(a === 172 && b >= 16 && b <= 31)
    && !(a === 192 && b === 168)
    && !(a === 192 && b === 0 && (c === 0 || c === 2))
    && !(a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    && !(a === 203 && b === 0 && c === 113);
}

function exactPublicIpv4Input(value) {
  const parsed = exactIpv4Input(value);
  if (!parsed.ok || !isPublicIpv4Address(parsed.ip)) return parsed.ok
    ? { ok: false, error: 'not_public' }
    : parsed;
  return parsed;
}

function exactIpInputError(parsed) {
  return parsed?.error === 'unsafe_characters'
    ? 'Paste rejected: hidden or non-ASCII characters were detected. Copy the address again or type it manually.'
    : 'Enter one globally routable IPv4 address, optionally followed by /32.';
}

function exactIpNormalizationNote(parsed) {
  if (!parsed?.normalized) return '';
  return parsed.hadCidrSuffix
    ? '\n\nSafe normalization: verified /32 and will send only the canonical address.'
    : '\n\nSafe normalization: removed surrounding spaces or line breaks.';
}

async function customServiceAction(service, action, needsConfirm, requiresPublicIp = false) {
  let publicIp = '';
  let parsedPublicIp = null;
  if (requiresPublicIp) {
    const entered = window.prompt('Enter the exact public IPv4 address to authorize (address or /32):');
    if (entered === null) return;
    parsedPublicIp = exactPublicIpv4Input(entered);
    if (!parsedPublicIp.ok) {
      setNotice(`Action not started: ${exactIpInputError(parsedPublicIp)}`, 'error');
      return;
    }
    publicIp = parsedPublicIp.ip;
  }
  const target = publicIp ? `${service} for ${publicIp}` : service;
  if (needsConfirm && !window.confirm(`Run ${action} for ${target}?${exactIpNormalizationNote(parsedPublicIp)}`)) return;
  setNotice(`${action} requested for ${service}...`);
  try {
    const result = await api(`/api/service/${encodeURIComponent(service)}/action/${encodeURIComponent(action)}`, {
      method: 'POST',
      body: JSON.stringify({ confirm: action, ...(publicIp ? { publicIp } : {}) })
    });
    setNotice(`${service} ${action} started.`);
    showOutput(`${service}: ${action}`, result.session ? `tmux session ${result.session}` : 'command output', result.output || '');
    await loadSnapshot('manual');
  } catch (error) {
    showOutput(`${service}: ${action} failed`, 'error output', error.message);
    setNotice(`${service} ${action} failed: ${error.message}`, 'error');
  }
}

async function interruptAgent(session) {
  if (!window.confirm(`RECOVERY ONLY: send Ctrl-C to ${session}? Normal prompt sending never does this.`)) return;
  try {
    await api('/api/agent/interrupt', {
      method: 'POST',
      body: JSON.stringify({ session, confirm: 'interrupt' })
    });
    markAgentInteraction(session, 'agent.interrupt');
    setNotice(`${session} interrupted.`);
    await openDetail(session);
  } catch (error) {
    setNotice(`Interrupt failed: ${error.message}`, 'error');
  }
}

async function openSshRescue() {
  if (state.snapshot?.capabilities?.exactPublicIpAccess !== true || state.snapshot?.capabilities?.ipRuleManagement !== true) {
    setNotice('Exact IP access requires a dashboard backend restart before this control can run.', 'error');
    return;
  }
  const port = state.snapshot?.security?.sshRescue?.dashboardPort || 8787;
  const entered = window.prompt(`Enter the exact public IPv4 address to authorize for SSH 22 and dashboard ${port}. It will be added as a narrow /32 only.`);
  if (entered === null) return;
  const parsedIp = exactPublicIpv4Input(entered);
  if (!parsedIp.ok) {
    setNotice(`Access not changed: ${exactIpInputError(parsedIp)}`, 'error');
    return;
  }
  const ip = parsedIp.ip;
  setNotice(`Previewing ports for ${ip}/32...`);
  try {
    const preview = await api('/api/security/ssh-rescue/open', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true, ip })
    });
    if (!window.confirm(`Add ${ip}/32 to ports ${preview.ports?.join(', ') || `22 and ${port}`}?${exactIpNormalizationNote(parsedIp)}\n\nThis only adds access. It does not remove or replace any existing rule.`)) {
      setNotice('IP authorization canceled.');
      return;
    }
    setNotice(`Authorizing ${ip}/32...`);
    const result = await api('/api/security/ssh-rescue/open', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'authorize', ip })
    });
    setNotice(`Authorized ${result.cidrs?.join(', ') || `${ip}/32`} on ports ${result.ports?.join(', ') || `22 and ${port}`}.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`IP authorization failed: ${error.message}`, 'error');
  }
}

function ipRulePortLabel(rule) {
  if (rule.protocol === '-1') return 'all';
  if (rule.fromPort === null || rule.fromPort === undefined) return rule.protocol || 'unknown';
  return Number(rule.fromPort) === Number(rule.toPort)
    ? `${rule.protocol || 'tcp'} ${rule.fromPort}`
    : `${rule.protocol || 'tcp'} ${rule.fromPort}-${rule.toPort}`;
}

function ipRuleStatusLabel(rule) {
  if (rule.current) return rule.managed ? 'CURRENT · MANAGED · KEEP' : 'CURRENT · STATIC · PRESERVED';
  if (rule.activeSsh) return rule.managed ? 'ACTIVE SSH · MANAGED · KEEP' : 'ACTIVE SSH · STATIC · PRESERVED';
  if (rule.classification === 'dashboard-broad') return 'DASHBOARD BROAD RESCUE · REPLACE WITH CURRENT /32';
  if (rule.cleanupEligible) return 'STALE DASHBOARD IP · REMOVE';
  if (rule.broad) return 'BROAD UNMANAGED · PRESERVED';
  if (rule.managed) return 'DASHBOARD MANAGED · KEEP';
  return 'STATIC / UNMANAGED · PRESERVED';
}

function formatIpRulesPlan(plan) {
  const rows = plan.inboundRules || [];
  const relevantRows = rows.filter((rule) => rule.relevant);
  const otherRows = rows.filter((rule) => !rule.relevant);
  const formatRows = (items) => items.length
    ? items.map((rule) => [
        `[${ipRuleStatusLabel(rule)}]`,
        `${ipRulePortLabel(rule)} from ${rule.source}`,
        rule.description ? `  ${rule.description}` : ''
      ].filter(Boolean).join('\n')).join('\n\n')
    : '(none)';
  return [
    'CURRENT BROWSER CONNECTION',
    plan.requesterCidr || 'Unavailable (cleanup is disabled)',
    '',
    'HOST-CONTROL ACCESS PORTS',
    (plan.lteMirrorPorts || []).join(', ') || '(none)',
    '',
    'ACTIVE SSH CONNECTION IPS',
    (plan.currentPeerCidrs || []).join(', ') || '(none)',
    '',
    'CLEANUP SCOPE',
    `${plan.cleanup?.candidates?.length || 0} stale dashboard-managed rule(s) can be removed.`,
    'Current browser and active SSH IPs are kept. Static/manual, IPv6, source-group, range, and unmanaged broad rules are preserved.',
    'A legacy dashboard-owned broad rescue rule is removed only after current /32 coverage is verified on that port.',
    '',
    'ACCESS-PORT RULES',
    formatRows(relevantRows),
    '',
    'OTHER INBOUND RULES (VIEW ONLY)',
    formatRows(otherRows)
  ].join('\n');
}

async function viewIpRules() {
  if (state.snapshot?.capabilities?.ipRuleManagement !== true) {
    setNotice('IP rule inventory requires a dashboard backend restart.', 'error');
    return;
  }
  setNotice('Loading live inbound IP rules...');
  try {
    const { plan } = await api('/api/security/ssh-rescue/plan');
    showOutput(
      'Inbound IP Rules',
      `${plan.groupName || 'security group'} ${plan.groupId || ''} · current ${plan.requesterCidr || 'unavailable'}`.trim(),
      formatIpRulesPlan(plan)
    );
    setNotice(`Loaded ${plan.inboundRules?.length || 0} inbound rule${plan.inboundRules?.length === 1 ? '' : 's'}.`);
  } catch (error) {
    setNotice(`IP rule inventory failed: ${error.message}`, 'error');
  }
}

async function cleanupManagedIpRules() {
  if (state.snapshot?.capabilities?.ipRuleManagement !== true) {
    setNotice('Managed IP cleanup requires a dashboard backend restart.', 'error');
    return;
  }
  setNotice('Previewing managed IP cleanup...');
  try {
    const preview = await api('/api/security/ssh-rescue/cleanup', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true, currentOnly: true })
    });
    const candidates = preview.candidates || [];
    if (!candidates.length) {
      setNotice(`No stale dashboard-managed IP rules found. Current ${preview.requesterCidr} is kept.`);
      await viewIpRules();
      return;
    }
    const candidateText = candidates
      .slice(0, 24)
      .map((rule) => `${rule.cidr} · port ${Number(rule.fromPort) === Number(rule.toPort) ? rule.fromPort : `${rule.fromPort}-${rule.toPort}`}`)
      .join('\n');
    const overflow = candidates.length > 24 ? `\n...and ${candidates.length - 24} more rule(s)` : '';
    const confirmed = window.confirm([
      `Remove ${candidates.length} stale dashboard-managed IP rule(s)?`,
      '',
      `KEEP current browser: ${preview.requesterCidr}`,
      `KEEP active SSH: ${(preview.keepCidrs || []).filter((cidr) => cidr !== preview.requesterCidr).join(', ') || 'none'}`,
      'KEEP every static/manual and unmanaged broad rule.',
      'REPLACE any dashboard-owned broad rescue rule only after current /32 coverage is verified.',
      '',
      candidateText + overflow
    ].join('\n'));
    if (!confirmed) {
      setNotice('Managed IP cleanup canceled.');
      return;
    }
    setNotice(`Removing ${candidates.length} stale managed rule${candidates.length === 1 ? '' : 's'}...`);
    const result = await api('/api/security/ssh-rescue/cleanup', {
      method: 'POST',
      body: JSON.stringify({
        confirm: 'cleanup',
        currentOnly: true,
        planToken: preview.planToken
      })
    });
    const removed = result.removed || [];
    showOutput(
      'Managed IP Cleanup',
      `kept current ${result.requesterCidr}`,
      removed.length
        ? `Removed ${removed.length} rule(s):\n\n${removed.map((rule) => `${rule.cidr} · port ${rule.fromPort}`).join('\n')}`
        : 'No managed rules needed removal.'
    );
    setNotice(`Removed ${removed.length} stale dashboard-managed IP rule${removed.length === 1 ? '' : 's'}.`);
    await loadSnapshot('manual');
  } catch (error) {
    const suffix = error.data?.error === 'current_public_ipv4_unavailable'
      ? ' Open the dashboard through its public address, then try again.'
      : error.data?.error === 'cleanup_plan_changed' ? ' Rules changed after preview; run cleanup again.' : '';
    setNotice(`Managed IP cleanup failed: ${error.message}.${suffix}`, 'error');
  }
}

async function lockSshRescue() {
  if (state.snapshot?.capabilities?.exactPublicIpAccess !== true || state.snapshot?.capabilities?.ipRuleManagement !== true) {
    setNotice('Exact IP access requires a dashboard backend restart before this control can run.', 'error');
    return;
  }
  setNotice('Locking access to the detected public /32...');
  try {
    const result = await api('/api/security/ssh-rescue/lock', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'lock' })
    });
    setNotice(`Access locked to ${result.cidrs?.join(', ') || 'detected IP'}.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Lock failed: ${error.message}. Connect through the target public network first, then try again.`, 'error');
  }
}

async function resumeAgent(session, model = '', reasoning = '') {
  const targetLabel = displayNameForSession(session);
  const agent = currentAgent(session);
  const identity = normalizedExactPaneIdentity({ ...agent, paneId: agent?.id });
  if (!identity) {
    setNotice(`Restart failed: the exact ${targetLabel} terminal changed or is unavailable.`, 'error');
    return;
  }
  setNotice(`Restarting Codex for ${targetLabel} with ${model || 'Codex config'}...`);
  try {
    const result = await api('/api/agent/resume', {
      method: 'POST',
      body: JSON.stringify({ ...identity, model, reasoning })
    });
    markAgentInteraction(session, 'agent.resume');
    await sleep(1800);
    setNotice(`${targetLabel} restarted and resumed with ${result.model} · ${result.reasoning} reasoning.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Resume failed: ${error.message}`, 'error');
  }
}

async function sessionAction(session, action) {
  const label = action === 'interrupt'
    ? `RECOVERY ONLY: send Ctrl-C to ${session}? Normal prompt sending never does this.`
    : `RECOVERY ONLY: stop tmux session ${session}?\n\nThis ends the agent or process in that session and cannot be undone.`;
  if (!window.confirm(label)) return;
  try {
    await api(`/api/session/${encodeURIComponent(session)}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ confirm: action })
    });
    if (action === 'interrupt' && currentAgent(session)) markAgentInteraction(session, 'session.interrupt');
    setNotice(`${session} ${action} complete.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`${session} ${action} failed: ${error.message}`, 'error');
  }
}

async function copyAttach(session) {
  const quotedSession = `'${String(session || '').replaceAll("'", `'"'"'`)}'`;
  const command = `tmux attach-session -t ${quotedSession}`;
  if (await copyTextToClipboard(command)) {
    setNotice(`Copied: ${command}`);
  } else {
    setNotice(command);
  }
}

async function copyTextToClipboard(value) {
  const text = String(value || '');
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through for dashboards opened over HTTP, where Clipboard may be unavailable.
  }

  const activeElement = document.activeElement;
  const proxy = document.createElement('textarea');
  proxy.value = text;
  proxy.setAttribute('readonly', '');
  proxy.setAttribute('aria-hidden', 'true');
  proxy.style.position = 'fixed';
  proxy.style.inset = '-9999px auto auto -9999px';
  document.body.append(proxy);
  proxy.select();
  let copied = false;
  try {
    copied = document.execCommand?.('copy') === true;
  } catch {
    copied = false;
  } finally {
    proxy.remove();
    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      activeElement.focus({ preventScroll: true });
    }
  }
  return copied;
}

async function copyTerminalOutput(item, button) {
  const output = item?.output?.textContent || '';
  if (!output.trim()) throw new Error('No terminal output is available to copy.');
  if (!await copyTextToClipboard(output)) {
    throw new Error('Clipboard access is unavailable. Select the terminal output and copy it manually.');
  }
  if (button?.isConnected) {
    button.textContent = 'Copied';
    button.classList.add('copied');
    button.setAttribute('aria-label', 'Terminal output copied');
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = 'Copy';
      button.classList.remove('copied');
      button.setAttribute('aria-label', 'Copy currently captured terminal output');
    }, 1600);
  }
  setNotice(`Copied ${output.length.toLocaleString()} characters of terminal output.`);
}

function slugifyClient(value, fallback = 'agent') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

function basenameFromPath(value) {
  const parts = String(value || '').split('/').filter(Boolean);
  return parts.at(-1) || '';
}

function selectedPreset(id) {
  return (state.options.promptPresets || []).find((preset) => preset.id === id) || null;
}

function readAgentDraft(form) {
  const formData = new FormData(form);
  state.agentDraft = {
    ...state.agentDraft,
    open: form.closest('details')?.open ?? state.agentDraft.open,
    name: String(formData.get('name') || ''),
    directoryName: String(formData.get('directoryName') || ''),
    workspace: String(formData.get('workspace') || '__new__'),
    preset: String(formData.get('preset') || ''),
    model: String(formData.get('model') || ''),
    reasoning: String(formData.get('reasoning') || ''),
    prompt: String(formData.get('prompt') || '')
  };
  const preview = form.querySelector('.field-preview');
  if (preview) preview.textContent = workspacePreviewText(state.agentDraft);
}

function syncAgentLauncher(form) {
  const workspace = form.elements.workspace?.value || '__new__';
  const presetId = form.elements.preset?.value || '';
  form.dataset.workspaceMode = workspace === '__new__' ? 'new' : 'existing';

  const seed = workspace === '__new__'
    ? (presetId || form.elements.name?.value || state.options.suggestedName || 'agent')
    : basenameFromPath(workspace);
  if (!form.elements.name.value.trim()) form.elements.name.value = slugifyClient(seed);
  if (workspace === '__new__' && !form.elements.directoryName.value.trim()) {
    form.elements.directoryName.value = slugifyClient(form.elements.name.value || seed);
  }
  readAgentDraft(form);
}

function applyPresetToLauncher(form) {
  const preset = selectedPreset(form.elements.preset?.value);
  if (preset) form.elements.prompt.value = preset.prompt;
  syncAgentLauncher(form);
}

async function createAgent(form) {
  readAgentDraft(form);
  const submittedDraftSignature = agentDraftSignature(state.agentDraft);
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const directoryName = String(formData.get('directoryName') || '').trim();
  const workspace = String(formData.get('workspace') || '__new__').trim();
  const workspaceMode = workspace === '__new__' ? 'new' : 'existing';
  const model = String(formData.get('model') || '').trim();
  const reasoning = String(formData.get('reasoning') || '').trim();
  const prompt = String(formData.get('prompt') || '');
  if (workspaceMode === 'new' && !name && !directoryName) {
    setNotice('New agent needs a name or workspace folder.', 'error');
    return;
  }
  if (workspaceMode === 'existing' && !workspace) {
    setNotice('Choose an existing workspace.', 'error');
    return;
  }
  setNotice('Starting new persistent agent session...');
  try {
    const result = await api('/api/agent/create', {
      method: 'POST',
      timeoutMs: 45000,
      body: JSON.stringify({ name, directoryName, workspace, workspaceMode, model, reasoning, prompt })
    });
    const outcome = agentCreateOutcome(result, Boolean(prompt.trim()));
    markAgentInteraction(result.session, 'agent.create', new Date().toISOString(), { rerender: false });
    state.recentAgentSession = result.session;
    const draftChangedWhileStarting = agentDraftSignature(state.agentDraft) !== submittedDraftSignature;
    const preserveDraft = outcome.preserveDraft || draftChangedWhileStarting;
    if (!preserveDraft) {
      form.reset();
      state.agentDraft = { open: false, name: '', directoryName: '', workspace: '__new__', preset: '', model: '', reasoning: '', prompt: '' };
    } else {
      state.agentDraft.open = true;
    }
    const notice = draftChangedWhileStarting && outcome.accepted
      ? `${outcome.notice} Your newer launcher edits were kept.`
      : outcome.notice;
    setNotice(notice, outcome.tone);
    await sleep(1000);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`New agent failed: ${error.message}`, 'error');
  }
}

function currentMission(id) {
  return state.snapshot?.missions?.jobs?.find((mission) => mission.id === id) || null;
}

function currentPromptQueueItem(id) {
  return state.snapshot?.promptQueue?.items?.find((item) => item.id === id) || null;
}

function currentIdeaQueueItem(id) {
  return state.snapshot?.promptQueue?.ideas?.find((idea) => idea.id === id) || null;
}

function currentPromptSchedule(id) {
  return state.snapshot?.promptQueue?.schedules?.find((schedule) => schedule.id === id) || null;
}

function selectPromptQueueTarget(control, { forceSingle = false, restoreCardFocus = true } = {}) {
  const session = String(control.dataset.session || control.value || '');
  const targets = promptQueueTargets(state.snapshot?.agents || []);
  const target = targets.find((agent) => agent.session === session);
  if (!target) {
    setNotice('That exact terminal is no longer available.', 'error');
    return;
  }
  const form = document.querySelector('#prompt-queue-form');
  if (form) {
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    readPromptQueueDraft(form);
  }
  const selected = preferredPromptQueueSessions(targets);
  const alreadySelected = selected.includes(session);
  const multiple = promptQueueMultipleAllowed(isPhoneLayoutMode(), state.promptQueueMultiSelect, forceSingle);
  const next = promptQueueTargetSelection(selected, session, multiple);
  state.promptQueueDraft.sessions = next;
  state.promptQueueDraft.session = next[0] || '';
  persistPromptQueueDraft();
  render();
  window.requestAnimationFrame(() => {
    const card = [...document.querySelectorAll('[data-action="prompt-queue-select-target"]')]
      .find((candidate) => candidate.dataset.session === session);
    if (restoreCardFocus) {
      card?.focus({ preventScroll: true });
      return;
    }
    document.querySelector('.prompt-target-mobile-select')?.focus({ preventScroll: true });
    card?.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'nearest', inline: 'center' });
  });
  if (!multiple) {
    setNotice(alreadySelected && selected.length === 1
      ? `${displayNameForSession(session)} is already selected.`
      : `Switched this prompt to ${displayNameForSession(session)}.`);
    return;
  }
  setNotice(alreadySelected && next.length === selected.length
    ? 'Keep at least one exact terminal selected.'
    : `${displayNameForSession(session)} ${alreadySelected ? 'removed from' : 'added to'} this prompt.`);
}

function selectAllPromptQueueTargets() {
  const form = document.querySelector('#prompt-queue-form');
  if (form) {
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    readPromptQueueDraft(form);
  }
  const sessions = promptQueueTargets(state.snapshot?.agents || []).slice(0, 12).map((agent) => agent.session);
  state.promptQueueDraft.sessions = sessions;
  state.promptQueueDraft.session = sessions[0] || '';
  persistPromptQueueDraft();
  render();
  setNotice(`${sessions.length} exact terminals selected.`);
}

function togglePromptQueueMobileMultiSelect() {
  const form = document.querySelector('#prompt-queue-form');
  if (form) {
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    readPromptQueueDraft(form);
  }
  state.promptQueueMultiSelect = !state.promptQueueMultiSelect;
  if (!state.promptQueueMultiSelect) {
    const selected = preferredPromptQueueSessions(promptQueueTargets(state.snapshot?.agents || []));
    state.promptQueueDraft.sessions = selected.slice(0, 1);
    state.promptQueueDraft.session = state.promptQueueDraft.sessions[0] || '';
    persistPromptQueueDraft();
  }
  render();
  setNotice(state.promptQueueMultiSelect
    ? 'Multi-select is on. Tap agent cards to add or remove recipients.'
    : 'Single-agent selection restored. Tapping another agent now switches recipients.');
}

function persistPromptQueueDraft() {
  state.promptQueueDraft = normalizedPromptQueueDraft(state.promptQueueDraft);
  const value = state.promptQueueDraft.text || state.promptQueueDraft.cron
    ? JSON.stringify(state.promptQueueDraft)
    : '';
  state.promptQueueDraftStorageAvailable = safeStorageSet(PROMPT_QUEUE_DRAFT_STORAGE_KEY, value);
}

function persistTicketRefiner() {
  state.ticketRefiner = normalizedTicketRefinerState(state.ticketRefiner);
  const value = state.ticketRefiner.open || state.ticketRefiner.applied
    ? JSON.stringify(state.ticketRefiner)
    : '';
  safeStorageSet(TICKET_REFINER_STORAGE_KEY, value);
}

function resetTicketRefiner() {
  state.ticketRefiner = normalizedTicketRefinerState(null);
  safeStorageSet(TICKET_REFINER_STORAGE_KEY, '');
}

function selectedPromptQueueTargets() {
  const selected = new Set(state.promptQueueDraft.sessions || []);
  return promptQueueTargets(state.snapshot?.agents || []).filter((agent) => selected.has(agent.session));
}

function openTicketRefiner(form) {
  if (!form) return;
  readPromptQueueDraft(form);
  const targets = selectedPromptQueueTargets();
  if (!state.promptQueueDraft.text.trim()) {
    setNotice('Write a rough request before opening Ticket Refiner.', 'error');
    return;
  }
  if (!targets.length || targets.length !== state.promptQueueDraft.sessions.length) {
    setNotice('Ticket Refiner needs live exact terminals before it can bind this draft.', 'error');
    return;
  }
  const targetBindings = ticketRefinerCurrentTargets(targets)
    .map(normalizedExactPaneIdentity)
    .filter(Boolean);
  if (targetBindings.length !== targets.length) {
    setNotice('Ticket Refiner could not verify every exact terminal identity.', 'error');
    return;
  }
  const current = normalizedTicketRefinerState(state.ticketRefiner);
  const currentMatch = ticketRefinerTargetMatch(current, targetBindings);
  if (current.applied || current.open) {
    state.ticketRefiner = normalizedTicketRefinerState({
      ...current,
      open: true,
      applied: current.applied && currentMatch.ok,
      targetBindings
    });
  } else {
    const originalText = state.promptQueueDraft.text;
    const readiness = ticketRefinerReadiness(originalText);
    const candidate = normalizedTicketRefinerState({
      open: true,
      applied: false,
      originalText,
      targetBindings,
      fields: readiness.ready ? {} : { outcome: originalText },
      preview: '',
      previewEdited: false
    });
    state.ticketRefiner = normalizedTicketRefinerState({
      ...candidate,
      preview: ticketRefinerPreview(candidate).text
    });
  }
  persistTicketRefiner();
  render();
  window.requestAnimationFrame(() => {
    const panel = document.querySelector('#ticket-refiner-panel');
    const firstGap = state.ticketRefiner.fields.outcome
      ? panel?.querySelector('textarea[name="refinerContext"]')
      : panel?.querySelector('textarea[name="refinerOutcome"]');
    (firstGap || panel?.querySelector('textarea[name="refinerPreview"]'))?.focus({ preventScroll: true });
    panel?.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'nearest' });
  });
  setNotice('Ticket Refiner opened locally. No prompt was queued or sent.');
}

function readTicketRefinerForm(form, changedName = '') {
  if (!form || state.ticketRefiner.open !== true) return;
  const formData = new FormData(form);
  const candidate = normalizedTicketRefinerState({
    ...state.ticketRefiner,
    fields: {
      outcome: formData.get('refinerOutcome'),
      context: formData.get('refinerContext'),
      scope: formData.get('refinerScope'),
      nonGoals: formData.get('refinerNonGoals'),
      verification: formData.get('refinerVerification'),
      safety: formData.get('refinerSafety')
    },
    previewEdited: false,
    preview: ''
  });
  const generated = ticketRefinerPreview(candidate);
  const previewValue = String(formData.get('refinerPreview') || '').slice(0, 4000);
  const previewEdited = changedName === 'refinerPreview'
    || (changedName === 'capture' && previewValue !== generated.text);
  state.ticketRefiner = normalizedTicketRefinerState({
    ...candidate,
    preview: previewEdited ? previewValue : generated.text,
    previewEdited
  });
  persistTicketRefiner();

  const preview = ticketRefinerPreview(state.ticketRefiner);
  const previewInput = form.querySelector('textarea[name="refinerPreview"]');
  if (previewInput && changedName !== 'refinerPreview' && previewInput.value !== preview.text) {
    previewInput.value = preview.text;
  }
  const readiness = preview.readiness;
  const readinessStrong = form.querySelector('.ticket-refiner-readiness > strong');
  if (readinessStrong) readinessStrong.textContent = readiness.ready
    ? 'Ready for review'
    : `${readiness.score}/${readiness.total} readiness signals`;
  const readinessList = form.querySelector('.ticket-refiner-readiness > div');
  if (readinessList) readinessList.innerHTML = ticketRefinerReadinessMarkup(readiness);
  const counter = form.querySelector('.ticket-refiner-preview-count');
  if (counter) counter.textContent = `${preview.count}/4000`;
  const targets = selectedPromptQueueTargets();
  const targetMatch = ticketRefinerTargetMatch(state.ticketRefiner, ticketRefinerCurrentTargets(targets));
  const useButton = form.querySelector('[data-action="ticket-refiner-use"]');
  if (useButton) useButton.disabled = !targetMatch.ok || !preview.text.trim() || preview.tooLong;
}

function keepOriginalTicketDraft(form) {
  if (!form) return;
  const originalText = state.ticketRefiner.originalText;
  const textarea = form.querySelector('textarea[name="text"]');
  if (textarea) textarea.value = originalText;
  resetTicketRefiner();
  readPromptQueueDraft(form);
  render();
  window.requestAnimationFrame(() => document.querySelector('#prompt-queue-form textarea[name="text"]')?.focus({ preventScroll: true }));
  setNotice('Original ticket restored. Nothing was queued or sent.');
}

function useTicketRefinedDraft(form) {
  if (!form || state.ticketRefiner.open !== true) return;
  readTicketRefinerForm(form, 'capture');
  const targets = selectedPromptQueueTargets();
  const targetMatch = ticketRefinerTargetMatch(state.ticketRefiner, ticketRefinerCurrentTargets(targets));
  if (!targetMatch.ok) {
    setNotice('Refined draft was not applied because the exact target changed. Keep the original or refine again for the current target.', 'error');
    return;
  }
  const preview = ticketRefinerPreview(state.ticketRefiner);
  if (!preview.text.trim() || preview.tooLong) {
    setNotice('Refined preview must be non-empty and no longer than 4000 characters.', 'error');
    return;
  }
  const textarea = form.querySelector('textarea[name="text"]');
  if (textarea) textarea.value = preview.text;
  state.ticketRefiner = normalizedTicketRefinerState({
    ...state.ticketRefiner,
    open: false,
    applied: true,
    preview: preview.text
  });
  readPromptQueueDraft(form);
  persistTicketRefiner();
  render();
  window.requestAnimationFrame(() => document.querySelector('#prompt-queue-form textarea[name="text"]')?.focus({ preventScroll: true }));
  setNotice('Refined draft applied locally. Review it, then queue or send separately.');
}

function clearPromptQueueDraft(form) {
  if (!form) return;
  readPromptQueueDraft(form);
  const presentation = promptQueueComposerPresentation(state.promptQueueDraft, true);
  if (!presentation.hasDraft) return;
  state.promptQueueDraftUndo = normalizedPromptQueueDraft(state.promptQueueDraft);
  state.ticketRefinerUndo = normalizedTicketRefinerState(state.ticketRefiner);
  resetTicketRefiner();
  form.querySelector('textarea[name="text"]').value = '';
  form.querySelector('input[name="cron"]').value = '';
  readPromptQueueDraft(form);
  form.querySelector('[data-action="prompt-queue-draft-undo"]')?.focus({ preventScroll: true });
}

function undoPromptQueueDraftClear(form) {
  const draft = state.promptQueueDraftUndo;
  if (!form || !draft) return;
  state.promptQueueDraft.sessions = [...draft.sessions];
  state.promptQueueDraft.session = draft.session;
  form.querySelector('textarea[name="text"]').value = draft.text;
  form.querySelector('input[name="cron"]').value = draft.cron;
  state.ticketRefiner = normalizedTicketRefinerState(state.ticketRefinerUndo);
  persistTicketRefiner();
  state.promptQueueDraftUndo = null;
  state.ticketRefinerUndo = null;
  readPromptQueueDraft(form);
  form.querySelector('textarea[name="text"]').focus({ preventScroll: true });
}

function removePromptQueueHiddenCharacters(form) {
  const textarea = form?.querySelector('textarea[name="text"]');
  if (!textarea) return;
  const safety = promptTextSafety(textarea.value);
  if (safety.safe) return;
  textarea.value = safety.cleanedText;
  state.promptQueueDraftUndo = null;
  state.ticketRefinerUndo = null;
  resetTicketRefiner();
  readPromptQueueDraft(form);
  textarea.focus({ preventScroll: true });
  setNotice(`Removed ${safety.issueCount} hidden or control character${safety.issueCount === 1 ? '' : 's'}. Review the prompt before adding it.`);
}

function jumpToPromptQueueSection(section) {
  const selector = promptQueueSectionTarget(section);
  const target = selector ? els.queue.querySelector(selector) : null;
  if (!target) return;
  target.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'start' });
  target.focus({ preventScroll: true });
}

function readPromptQueueDraft(form) {
  const formData = new FormData(form);
  state.promptQueueDraft = normalizedPromptQueueDraft({
    session: state.promptQueueDraft.session,
    sessions: state.promptQueueDraft.sessions,
    text: String(formData.get('text') || ''),
    cron: String(formData.get('cron') || '').trim()
  });
  persistPromptQueueDraft();
  const targetsAvailable = promptQueueTargets(state.snapshot?.agents || []).length > 0;
  const presentation = promptQueueComposerPresentation(state.promptQueueDraft, targetsAvailable);
  const queueSubmit = form.querySelector('button[type="submit"][value="queue"]');
  if (queueSubmit) {
    queueSubmit.textContent = presentation.label;
    queueSubmit.disabled = presentation.disabled || state.ticketRefiner.open === true;
  }
  const sendSubmit = form.querySelector('button[type="submit"][value="send"]');
  if (sendSubmit) {
    sendSubmit.textContent = presentation.sendLabel;
    sendSubmit.disabled = presentation.sendDisabled || state.ticketRefiner.open === true;
  }
  const counter = form.querySelector('.prompt-queue-counter');
  if (counter) {
    counter.textContent = presentation.count;
    counter.dataset.full = presentation.full ? 'true' : 'false';
    counter.setAttribute('aria-label', `${state.promptQueueDraft.text.length} of 4000 characters used`);
  }
  const draftState = form.querySelector('.prompt-queue-draft-state');
  if (draftState) {
    const status = presentation.hasDraft
      ? (state.promptQueueDraftStorageAvailable ? 'Saved in this browser' : 'Draft kept in this tab')
      : state.promptQueueDraftUndo ? 'Draft cleared' : 'Draft stays in this browser';
    if (draftState.textContent !== status) draftState.textContent = status;
    draftState.classList.toggle('has-draft', presentation.hasDraft);
    draftState.classList.toggle('storage-unavailable', presentation.hasDraft && !state.promptQueueDraftStorageAvailable);
  }
  form.querySelector('[data-action="prompt-queue-draft-clear"]')?.classList.toggle('hidden', !presentation.hasDraft);
  form.querySelector('[data-action="prompt-queue-draft-undo"]')?.classList.toggle('hidden', !state.promptQueueDraftUndo);
  const refineButton = form.querySelector('[data-action="ticket-refiner-open"]');
  if (refineButton && !refineButton.closest('.ticket-refiner-panel')) {
    refineButton.disabled = !presentation.hasDraft || presentation.selectedCount < 1 || state.ticketRefiner.open === true || presentation.unsafeCharacterCount > 0;
  }
  const textSafety = form.querySelector('#prompt-queue-text-safety');
  const textSafetyMessage = textSafety?.querySelector('span');
  const unsafeText = presentation.unsafeCharacterCount > 0;
  if (textSafetyMessage) {
    textSafetyMessage.textContent = unsafeText
      ? `Blocked: found ${presentation.unsafeCharacterCount} hidden or control character${presentation.unsafeCharacterCount === 1 ? '' : 's'}. Review the source or remove them before adding this prompt.`
      : '';
  }
  textSafety?.classList.toggle('hidden', !unsafeText);
  form.querySelector('textarea[name="text"]')?.setAttribute('aria-invalid', unsafeText ? 'true' : 'false');
}

function readIdeaQueueDraft(form) {
  const formData = new FormData(form);
  state.ideaDraft = {
    title: String(formData.get('title') || '').slice(0, 160),
    details: String(formData.get('details') || '').slice(0, 3000)
  };
  safeStorageSet(IDEA_QUEUE_DRAFT_STORAGE_KEY, state.ideaDraft.title || state.ideaDraft.details
    ? JSON.stringify(state.ideaDraft)
    : '');
}

async function createIdeaFromForm(form) {
  if (state.snapshot?.capabilities?.ideaQueue !== true) {
    setNotice('Idea Queue requires a PaneFleet backend restart.', 'error');
    return;
  }
  readIdeaQueueDraft(form);
  const submitted = { ...state.ideaDraft };
  const result = await api('/api/ideas', {
    method: 'POST',
    body: JSON.stringify(submitted)
  });
  if (state.ideaDraft.title === submitted.title && state.ideaDraft.details === submitted.details) {
    state.ideaDraft = { title: '', details: '' };
    safeStorageSet(IDEA_QUEUE_DRAFT_STORAGE_KEY, '');
  }
  setNotice(`Idea added for approval. No work ticket was created and no input was sent.`);
  await loadSnapshot('manual');
  return result;
}

function readIdeaGeneratorDraft(form) {
  const formData = new FormData(form);
  state.ideaGeneratorDraft = {
    ...state.ideaGeneratorDraft,
    open: true,
    sourceSession: String(formData.get('sourceSession') || '').slice(0, 128),
    selectedPromptIds: formData.getAll('promptId').map(String).slice(0, 12),
    focus: String(formData.get('focus') || '').slice(0, 400),
    ideaCount: ['1', '3', '5', '8'].includes(String(formData.get('ideaCount'))) ? String(formData.get('ideaCount')) : '3',
    execution: ['owner', 'scout', 'draft'].includes(String(formData.get('execution'))) ? String(formData.get('execution')) : 'owner'
  };
  return state.ideaGeneratorDraft;
}

function updateIdeaGeneratorPreview(form) {
  readIdeaGeneratorDraft(form);
  const data = state.snapshot?.promptQueue || { items: [], ideas: [] };
  const view = ideaGeneratorPresentation(state.snapshot?.agents || [], data.items || [], data.ideas || []);
  const preview = form.querySelector('textarea[name="preview"]');
  if (preview) preview.value = view.generated.prompt || '';
  const executionNeedsLive = ['owner', 'scout'].includes(state.ideaGeneratorDraft.execution);
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = !view.generated.ok || (executionNeedsLive && !view.source?.live);
  const hint = form.querySelector('[data-idea-generator-hint]');
  if (hint) {
    hint.textContent = !view.generated.ok
      ? 'Select at least one verified conversation.'
      : !view.source?.live && executionNeedsLive
        ? 'The project terminal is unavailable. Choose Draft prompt only or restore the exact project terminal.'
        : state.ideaGeneratorDraft.execution === 'scout'
          ? 'Starts or reuses a separately visible, resource-gated read-only scout in this workspace.'
          : state.ideaGeneratorDraft.execution === 'draft'
            ? 'Copies the sanitized prompt into Compose without sending or queueing it.'
            : 'Queues behind the current project owner and never interrupts active work.';
  }
  return view;
}

async function generateIdeasFromForm(form) {
  if (state.snapshot?.capabilities?.ideaGenerator !== true) {
    setNotice('Generate Ideas requires a PaneFleet backend restart.', 'error');
    return;
  }
  const view = updateIdeaGeneratorPreview(form);
  if (!view.generated.ok) {
    setNotice('Choose at least one verified conversation before generating ideas.', 'error');
    return;
  }
  const prompt = view.generated.prompt;
  if (state.ideaGeneratorDraft.execution === 'draft') {
    const sourceSession = view.source?.live?.session || '';
    state.promptQueueDraft = normalizedPromptQueueDraft({
      session: sourceSession,
      sessions: sourceSession ? [sourceSession] : [],
      text: prompt,
      cron: ''
    });
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    resetTicketRefiner();
    persistPromptQueueDraft();
    render();
    requestAnimationFrame(() => {
      jumpToPromptQueueSection('compose');
      document.querySelector('#prompt-queue-form textarea[name="text"]')?.focus({ preventScroll: true });
    });
    setNotice('Idea-generation prompt drafted. No ticket was queued and no terminal input was sent.');
    return;
  }
  if (!view.source?.live) {
    setNotice('The selected project terminal is unavailable or replaced. Use Draft prompt only or restore it first.', 'error');
    return;
  }

  if (state.ideaGeneratorDraft.execution === 'scout') {
    setNotice(`Checking resources and preparing a read-only scout for ${view.source.displayName}...`);
    let result = await api('/api/idea-scout', {
      method: 'POST',
      body: JSON.stringify({ ...exactAgentIdentityForMutation(view.source.live), text: prompt })
    });
    if (!result.item) {
      const queued = await api('/api/prompt-queue', {
        method: 'POST',
        body: JSON.stringify({ ...exactAgentIdentityForMutation(result.agent), text: prompt })
      });
      result = { ...result, item: queued.item };
    }
    state.recentAgentSession = result.agent.session;
    await loadSnapshot('manual');
    const liveScout = currentAgent(result.agent.session);
    if (liveScout?.id === result.agent.id && liveScout.sessionCreatedAt === result.agent.sessionCreatedAt) {
      openAgentDetail(liveScout.session, liveScout.id);
      setNotice(`Idea request queued in the separate ${displayNameForSession(liveScout.session)} terminal. Valid results return here as Proposed only.`);
    } else {
      setNotice(`Idea request queued in the separate scout terminal. Open ${result.agent.session} from Sessions to inspect it.`, 'info');
    }
    return result;
  }
  const result = await api('/api/prompt-queue', {
    method: 'POST',
    body: JSON.stringify({ ...exactAgentIdentityForMutation(view.source.live), text: prompt })
  });
  setNotice(`Idea request queued behind ${view.source.displayName}. Valid results will return here as Proposed only.`);
  await loadSnapshot('manual');
  return result;
}

async function approveIdeaClient(button) {
  const idea = currentIdeaQueueItem(button.dataset.ideaId);
  const target = promptQueueTargets(state.snapshot?.agents || [])
    .find((candidate) => candidate.session === button.dataset.targetSession) || null;
  if (!idea || idea.status !== 'proposed' || !target) return;
  if (!window.confirm(`Approve “${idea.title}” into ${displayNameForSession(target.session)}'s current work queue? It will wait for stable green and use the normal one-attempt delivery rules.`)) return;
  await api(`/api/ideas/${encodeURIComponent(idea.id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      expectedRevision: idea.revision,
      confirm: 'approve-idea',
      ...exactAgentIdentityForMutation(target)
    })
  });
  setNotice(`Idea approved and added to ${displayNameForSession(target.session)}'s work queue.`);
  await loadSnapshot('manual');
}

async function refineIdeaClient(button) {
  const idea = currentIdeaQueueItem(button.dataset.ideaId);
  const target = promptQueueTargets(state.snapshot?.agents || [])
    .find((candidate) => candidate.session === button.dataset.targetSession) || null;
  if (!idea || idea.status !== 'proposed' || !target) return;
  const instructions = window.prompt(
    `Send “${idea.title}” to ${displayNameForSession(target.session)} for ticket refinement only? Add optional guidance below. The agent will be told not to implement it.`,
    ''
  );
  if (instructions === null) return;
  await api(`/api/ideas/${encodeURIComponent(idea.id)}/refine`, {
    method: 'POST',
    body: JSON.stringify({
      expectedRevision: idea.revision,
      confirm: 'refine-idea',
      instructions: instructions.slice(0, 600),
      ...exactAgentIdentityForMutation(target)
    })
  });
  setNotice(`Refinement ticket queued for ${displayNameForSession(target.session)}. The idea will return here after a verified result.`);
  await loadSnapshot('manual');
}

async function rejectIdeaClient(button) {
  const idea = currentIdeaQueueItem(button.dataset.ideaId);
  if (!idea || idea.status !== 'proposed') return;
  if (!window.confirm(`Reject and cancel “${idea.title}”? No work ticket will be created.`)) return;
  await api(`/api/ideas/${encodeURIComponent(idea.id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ expectedRevision: idea.revision, confirm: 'reject-idea' })
  });
  setNotice('Idea rejected and moved to cancelled history. No terminal input was sent.');
  await loadSnapshot('manual');
}

function multiPromptTargetPayload(target) {
  return {
    session: target.session,
    sessionCreatedAt: target.sessionCreatedAt,
    paneId: target.id,
    tmuxPaneId: target.tmuxPaneId,
    panePid: target.panePid,
    missionId: activeMissionForAgentSession(target.session)?.id || null
  };
}

function queueConflictsFromError(error) {
  if (error?.data?.error === 'active_prompt_queue_conflict' && error.data.queueConflict) {
    return [{ ...error.data.queueConflict }];
  }
  if (error?.data?.error === 'active_prompt_queue_conflicts' && Array.isArray(error.data.queueConflicts)) {
    return error.data.queueConflicts;
  }
  return [];
}

async function sendAgentInputWithQueueConfirmation(
  pathname,
  payload,
  fallbackSession = '',
  { allowAnswerContinuation = false } = {}
) {
  try {
    return await api(pathname, { method: 'POST', body: JSON.stringify(payload) });
  } catch (error) {
    const conflicts = queueConflictsFromError(error);
    if (!conflicts.length) throw error;
    const labels = conflicts.map((conflict) => displayNameForSession(conflict.session || fallbackSession));
    const targets = [...new Set(labels)].join(', ');
    const waitingAgent = conflicts.length === 1
      ? (state.snapshot?.agents || []).find((agent) => agent.session === (conflicts[0].session || fallbackSession))
      : null;
    const answerContinuation = Boolean(
      allowAnswerContinuation &&
      pathname === '/api/agent/send' &&
      conflicts.length === 1 &&
      conflicts[0].answerContinuationAllowed === true &&
      waitingAgent?.agentStatus?.state === 'waiting'
    );
    const accepted = window.confirm(answerContinuation
      ? `${targets} is waiting for input during an accepted queue turn. Send this as your answer and keep monitoring that same turn?\n\nPaneFleet will link the answer to the current ticket, never resend the ticket, and pause safely if another manual turn appears.`
      : `${targets} already ${conflicts.length === 1 ? 'has an active queue ticket' : 'have active queue tickets'}. Send now anyway?\n\nThis newer terminal input will supersede unresolved queue work and pause each affected line for review. Nothing will be retried automatically.`
    );
    if (!accepted) {
      const canceled = new Error('Send canceled; active queue work was left unchanged.');
      canceled.userCanceled = true;
      throw canceled;
    }
    const confirmedPayload = conflicts.length === 1 && pathname === '/api/agent/send'
      ? {
          ...payload,
          queueConflict: answerContinuation
            ? { ...conflicts[0], resolution: 'answer-current-turn' }
            : conflicts[0]
        }
      : { ...payload, queueConflicts: conflicts };
    return api(pathname, { method: 'POST', body: JSON.stringify(confirmedPayload) });
  }
}

async function createPromptQueueFromForm(form, mode = 'queue') {
  if (mode === 'queue' && state.snapshot?.capabilities?.promptQueue !== true) {
    setNotice('Prompt Queue requires a PaneFleet backend restart.', 'error');
    return;
  }
  readPromptQueueDraft(form);
  const textSafety = promptTextSafety(state.promptQueueDraft.text);
  if (!textSafety.safe) {
    setNotice(`Prompt blocked: found ${textSafety.issueCount} hidden or control character${textSafety.issueCount === 1 ? '' : 's'}. Review the source or remove them before continuing.`, 'error');
    form.querySelector('textarea[name="text"]')?.focus({ preventScroll: true });
    return;
  }
  if (state.ticketRefiner.open === true) {
    setNotice('Finish Ticket Refiner with Use refined draft or Keep original before queueing or sending.', 'error');
    return;
  }
  const selected = new Set(state.promptQueueDraft.sessions || []);
  const targets = promptQueueTargets(state.snapshot?.agents || []).filter((agent) => selected.has(agent.session));
  if (!targets.length || targets.length !== selected.size) {
    setNotice('Choose live exact terminals before sending or queueing the prompt.', 'error');
    return;
  }
  if (state.ticketRefiner.applied === true) {
    const targetMatch = ticketRefinerTargetMatch(state.ticketRefiner, ticketRefinerCurrentTargets(targets));
    if (!targetMatch.ok) {
      setNotice('Dispatch blocked: this refined draft is bound to a different or replaced exact terminal. Refine again for the current target or keep the original.', 'error');
      return;
    }
  }
  const recurring = Boolean(state.promptQueueDraft.cron);
  if (mode === 'send' && recurring) {
    setNotice('Send now cannot be combined with a recurring schedule.', 'error');
    return;
  }
  if (recurring && targets.length !== 1) {
    setNotice('Recurring schedules require exactly one selected terminal.', 'error');
    return;
  }
  if (targets.length > 1 && state.snapshot?.capabilities?.multiAgentPrompt !== true) {
    setNotice('Multi-agent prompts require a PaneFleet backend restart.', 'error');
    return;
  }
  if (targets.length > 1) {
    const action = mode === 'send'
      ? `Send this prompt now to ${targets.length} exact terminals?\n\nSuccessful sends cannot be rolled back. Every terminal reports its own result, and failures are never retried.`
      : `Queue this prompt for ${targets.length} exact terminals?\n\nEach terminal receives one independent FIFO item that waits for its own stable green state.`;
    if (!window.confirm(action)) return;
  }
  const targetLabel = targets.length === 1 ? displayNameForSession(targets[0].session) : `${targets.length} agents`;
  setNotice(mode === 'send'
    ? `Sending prompt to ${targetLabel}...`
    : `${recurring ? 'Creating schedule' : 'Queueing prompt'} for ${targetLabel}...`);
  try {
    const targetPayloads = targets.map(multiPromptTargetPayload);
    let result;
    if (mode === 'send') {
      result = targets.length > 1
        ? await sendAgentInputWithQueueConfirmation('/api/agent/send-batch', {
            confirm: 'send-multiple',
            targets: targetPayloads,
            text: state.promptQueueDraft.text
          })
        : await sendAgentInputWithQueueConfirmation(
            '/api/agent/send',
            { ...targetPayloads[0], text: state.promptQueueDraft.text },
            targetPayloads[0].session
          );
    } else if (recurring) {
      result = await api('/api/prompt-schedules', {
        method: 'POST',
        body: JSON.stringify({ ...targetPayloads[0], text: state.promptQueueDraft.text, cron: state.promptQueueDraft.cron })
      });
    } else if (targets.length > 1) {
      result = await api('/api/prompt-queue/batch', {
        method: 'POST',
        body: JSON.stringify({
          confirm: 'queue-multiple',
          targets: targetPayloads,
          text: state.promptQueueDraft.text
        })
      });
    } else {
      result = await api('/api/prompt-queue', {
        method: 'POST',
        body: JSON.stringify({ ...targetPayloads[0], text: state.promptQueueDraft.text })
      });
    }
    if (mode === 'send' && Number(result.failedCount || 0) > 0) {
      const failedTargets = (result.results || [])
        .filter((item) => !item.ok)
        .map((item) => displayNameForSession(item.session))
        .join(', ');
      setNotice(`Sent to ${result.successCount} agent${result.successCount === 1 ? '' : 's'}; failed: ${failedTargets || result.failedCount}. Draft kept for inspection—do not resend without checking each terminal.`, 'error');
      await loadSnapshot('manual');
      return;
    }
    state.promptQueueDraft = {
      session: targets[0].session,
      sessions: targets.map((target) => target.session),
      text: '',
      cron: ''
    };
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    state.promptQueueDraftStorageAvailable = safeStorageSet(PROMPT_QUEUE_DRAFT_STORAGE_KEY, '');
    resetTicketRefiner();
    setNotice(mode === 'send'
      ? `Sent to ${targets.length} exact terminal${targets.length === 1 ? '' : 's'}.`
      : recurring
        ? `Schedule created for ${displayNameForSession(targets[0].session)}. Next queue intake ${promptScheduleTimeLabel(result.schedule?.nextRunAt)}.`
        : `Queued one independent prompt for ${targets.length} exact terminal${targets.length === 1 ? '' : 's'}.`);
    await loadSnapshot('manual');
  } catch (error) {
    const label = mode === 'send' ? 'Prompt send' : recurring ? 'Prompt schedule' : 'Prompt queue';
    setNotice(
      error.userCanceled ? error.message : `${label} failed: ${recurring ? promptScheduleErrorLabel(error) : error.message}`,
      error.userCanceled ? 'info' : 'error'
    );
  }
}

async function togglePromptScheduleClient(button) {
  const schedule = currentPromptSchedule(button.dataset.promptScheduleId);
  if (!schedule) return;
  const enabled = !schedule.enabled;
  try {
    await api(`/api/prompt-schedules/${encodeURIComponent(schedule.id)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: schedule.revision, enabled })
    });
    setNotice(enabled
      ? `Recurring prompt resumed for ${displayNameForSession(schedule.session)}.`
      : `Recurring prompt paused. Already queued prompts were left unchanged.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Prompt schedule update failed: ${promptScheduleErrorLabel(error)}`, 'error');
    await loadSnapshot('manual');
  }
}

async function queuePromptScheduleNowClient(button) {
  const schedule = currentPromptSchedule(button.dataset.promptScheduleId);
  if (!schedule) return;
  try {
    const result = await api(`/api/prompt-schedules/${encodeURIComponent(schedule.id)}/queue-now`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: schedule.revision, confirm: 'queue-schedule-now' })
    });
    setNotice(result.outcome === 'coalesced_existing_pending'
      ? 'This schedule already has an open queue item. No duplicate was added.'
      : `Added one ${displayNameForSession(schedule.session)} occurrence to the queue. The cron and paused state are unchanged.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Queue now failed: ${promptScheduleErrorLabel(error)}`, 'error');
    await loadSnapshot('manual');
  }
}

async function deletePromptScheduleClient(button) {
  const schedule = currentPromptSchedule(button.dataset.promptScheduleId);
  if (!schedule) return;
  if (!window.confirm(`Delete this recurring prompt for ${displayNameForSession(schedule.session)}? Already queued prompts will stay in the queue.`)) return;
  try {
    await api(`/api/prompt-schedules/${encodeURIComponent(schedule.id)}/delete`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: schedule.revision, confirm: 'delete-schedule' })
    });
    setNotice('Recurring prompt deleted. Already queued prompts were left unchanged.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Prompt schedule delete failed: ${promptScheduleErrorLabel(error)}`, 'error');
    await loadSnapshot('manual');
  }
}

function exactAgentIdentityForMutation(agent) {
  return {
    session: agent.session,
    sessionCreatedAt: agent.sessionCreatedAt,
    paneId: agent.id,
    tmuxPaneId: agent.tmuxPaneId,
    panePid: agent.panePid
  };
}

async function retargetPromptScheduleClient(button) {
  const schedule = currentPromptSchedule(button.dataset.promptScheduleId);
  const replacement = schedule ? replacementAgentForSession(schedule.session) : null;
  if (!schedule || !replacement) return;
  if (!window.confirm('Bind this recurring prompt to the current ' + displayNameForSession(schedule.session) + ' pane? Counters and history stay; no prompt is sent now.')) return;
  try {
    await api('/api/prompt-schedules/' + encodeURIComponent(schedule.id) + '/retarget', {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: schedule.revision,
        confirm: 'retarget-schedule',
        ...exactAgentIdentityForMutation(replacement)
      })
    });
    setNotice('Recurring prompt retargeted. Its counters were preserved and no input was sent.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice('Prompt schedule retarget failed: ' + promptScheduleErrorLabel(error), 'error');
    await loadSnapshot('manual');
  }
}

async function retargetPromptQueueClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  const replacement = item ? replacementAgentForSession(item.session) : null;
  if (!item || !replacement || item.status !== 'queued') return;
  if (!window.confirm('Bind this never-sent prompt to the current ' + displayNameForSession(item.session) + ' pane? It will remain queued until that pane is stably green.')) return;
  try {
    await api('/api/prompt-queue/' + encodeURIComponent(item.id) + '/retarget', {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: 'retarget-queued-prompt',
        ...exactAgentIdentityForMutation(replacement)
      })
    });
    setNotice('Queued prompt retargeted. Nothing was sent during recovery.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice('Prompt queue retarget failed: ' + error.message, 'error');
    await loadSnapshot('manual');
  }
}

async function requeuePromptQueueReplacementClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  const replacement = item ? replacementAgentForSession(item.session) : null;
  const recovery = promptQueueReplacementRequeuePresentation(item, Boolean(replacement));
  if (!item || !replacement || !recovery) return;
  const terminalName = displayNameForSession(item.session);
  if (!window.confirm(`Requeue this unresolved delivery once on the current ${terminalName} terminal?\n\nPaneFleet will archive the old delivery without claiming it finished, create one fresh queue item with the same prompt, and send no input during this recovery action. If the old turn actually completed unseen, this could duplicate work.`)) return;
  try {
    const result = await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/requeue-on-replacement`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: recovery.confirmation,
        ...exactAgentIdentityForMutation(replacement)
      })
    });
    setNotice(`Old delivery archived; ${result.item?.target?.displayName || terminalName} now has one fresh queued copy.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Replacement requeue failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function cancelPromptQueueClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  if (!item) return;
  const cancel = promptQueueCancelPresentation(item);
  if (!cancel) return;
  const terminalName = displayNameForSession(item.session);
  const message = `Leave ${terminalName}'s queue before this prompt is dispatched? This is allowed only while the prompt is still queued.`;
  if (!window.confirm(message)) return;
  try {
    await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: cancel.confirmation
      })
    });
    setNotice('Prompt left the queue before dispatch. No terminal input was sent.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Prompt queue update failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function dismissPromptQueueReviewClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  const dismissal = promptQueueReviewDismissPresentation(item);
  if (!item || !dismissal || item.target?.identityMatches !== true) return;
  const terminalName = displayNameForSession(item.session);
  const wasWaiting = item.deliveryStage === 'waiting_for_manual_submit';
  const confirmation = wasWaiting
    ? `Stop waiting for manual submit on ${terminalName}? PaneFleet will send no input, cancel this ticket, and allow the next queued prompt to run when the terminal is ready.`
    : `Inspect ${terminalName} first. Dismiss this pre-Enter delivery uncertainty only if the composer is clear or you handled the visible text manually. PaneFleet will send no input, and the next queued prompt may then run.`;
  if (!window.confirm(confirmation)) return;
  try {
    await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/dismiss-review`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: dismissal.confirmation
      })
    });
    setNotice(wasWaiting
      ? 'Stopped waiting and canceled this ticket. No terminal input was sent.'
      : 'Pre-Enter review dismissed. No terminal input was sent; the queue may continue.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Review dismissal failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function importPromptQueueVisibleIdeasClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  const recovery = promptQueueManualIdeaImportPresentation(item);
  if (!item || !recovery || item.target?.identityMatches !== true) return;
  const terminalName = displayNameForSession(item.session);
  if (!window.confirm(`Import completed idea blocks currently visible on the exact ${terminalName} terminal? PaneFleet will send no input. Valid results are saved as Proposed only; the canceled ticket remains canceled.`)) return;
  try {
    const result = await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/import-visible-ideas`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: recovery.confirmation
      })
    });
    setNotice(result.added
      ? `Imported ${result.added} idea${result.added === 1 ? '' : 's'} as Proposed.`
      : `Reviewed ${result.found} visible idea${result.found === 1 ? '' : 's'}; all were already in the Idea Queue.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Visible idea import failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function waitForPromptQueueManualSubmitClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  const wait = promptQueueManualSubmitWaitPresentation(item);
  if (!item || !wait || item.target?.identityMatches !== true) return;
  const terminalName = displayNameForSession(item.session);
  if (!window.confirm(`Keep this ticket waiting on ${terminalName}? PaneFleet will not retype the prompt or press Enter. If the prompt is visible, submit it manually; PaneFleet will detect the accepted turn on this exact pane and resume completion monitoring.`)) return;
  try {
    await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/wait-for-manual-submit`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: wait.confirmation
      })
    });
    setNotice('Ticket is waiting for a manual submit on the exact terminal. PaneFleet sent no input.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Could not keep this ticket waiting: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function releasePromptQueueClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  if (!item) return;
  if (!window.confirm(`Release this queue after inspecting ${displayNameForSession(item.session)}? This does not mark the project task Done. No terminal input will be sent, and the next queued prompt may then run when green.`)) return;
  try {
    const result = await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/release`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: 'release-after-review'
      })
    });
    setNotice(result.outcome === 'captured'
      ? 'The final response arrived during review and was captured from the exact terminal. No input was sent.'
      : 'Queue released after review. No task completion was claimed and no input was sent.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Queue release failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function continuePromptQueueMonitoringClient(button) {
  const item = currentPromptQueueItem(button.dataset.promptQueueId);
  if (!item || item.status !== 'needs_review' || item.deliveryStage !== 'completion_superseded') return;
  const terminalName = displayNameForSession(item.session);
  if (!window.confirm(`Keep monitoring the original queued ticket in ${terminalName} after the newer activity you reviewed? PaneFleet will send nothing and will not resend the ticket. It will accept only a safely bounded result for the original ticket; any later manual send or interrupt will pause it again.`)) return;
  try {
    await api(`/api/prompt-queue/${encodeURIComponent(item.id)}/continue-monitoring`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: item.revision,
        confirm: 'continue-monitoring'
      })
    });
    setNotice('Warning dismissed. PaneFleet is monitoring the original ticket again; no input was sent.');
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Could not resume ticket monitoring: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function clearPromptQueueHistoryClient(button) {
  const history = (state.snapshot?.promptQueue?.items || []).filter((item) => (
    item.status === 'canceled' || (item.status === 'sent' && !promptQueueAwaitingFinish(item))
  ));
  if (!history.length) return;
  if (!window.confirm(`Clear ${history.length} finished history record${history.length === 1 ? '' : 's'}? Active and queued work plus recurring schedules will stay.`)) return;
  try {
    const result = await api('/api/prompt-queue/clear-history', {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: Number(button.dataset.revision),
        confirm: 'clear-history'
      })
    });
    setNotice(`${result.removed || 0} history record${result.removed === 1 ? '' : 's'} cleared. Active queue work and schedules were unchanged.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Queue-history cleanup failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

function currentAttentionItem(id) {
  return normalizedAttention(state.snapshot || {}).items.find((item) => item.id === id) || null;
}

function currentNotification(id) {
  return normalizedNotifications(state.snapshot || {}).find((item) => item.id === id) || null;
}

function revealMissionCard(missionId) {
  switchView('queue');
  window.requestAnimationFrame(() => {
    const card = [...els.queue.querySelectorAll('.mission-card')]
      .find((item) => item.dataset.missionId === missionId);
    card?.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'center' });
    card?.classList.add('attention-opened');
    window.setTimeout(() => card?.classList.remove('attention-opened'), 1800);
  });
}

function openAttentionTarget(item) {
  if (!item) return;
  if (item.missionId) {
    revealMissionCard(item.missionId);
    return;
  }
  if (item.session) {
    openAgentDetail(item.session, item.paneId || '');
    void touchOpenedAgent(item.session, { force: true });
    return;
  }
  if (item.serviceId) {
    openServiceDetail(item.serviceId);
    return;
  }
  if (item.view && ['agents', 'queue', 'services', 'security', 'review', 'ports', 'processes', 'audit', 'system'].includes(item.view)) {
    switchView(item.view);
    return;
  }
  if (item.kind.includes('security')) {
    openToolView('security');
  }
}

function notificationSnoozePath(notification) {
  const encodedId = encodeURIComponent(notification.id);
  const path = String(notification.snoozeEndpoint || '')
    .replaceAll('{id}', encodedId)
    .replaceAll(':id', encodedId);
  return path.startsWith('/api/') ? path : '';
}

function notificationOpenPath(notification) {
  const encodedId = encodeURIComponent(notification.id);
  const path = String(notification.openEndpoint || '')
    .replaceAll('{id}', encodedId)
    .replaceAll(':id', encodedId);
  return path.startsWith('/api/') ? path : '';
}

async function openNotification(button) {
  const notification = currentNotification(button.dataset.notificationId);
  if (!notification) return;
  const path = notificationOpenPath(notification);
  if (!path) {
    setNotice('This notification cannot be opened from the current dashboard version.', 'error');
    return;
  }
  await api(path, { method: 'POST', body: '{}' });
  openAttentionTarget(notification);
  await loadSnapshot('manual');
}

async function snoozeNotification(button) {
  const notification = currentNotification(button.dataset.notificationId);
  if (!notification) return;
  const path = notificationSnoozePath(notification);
  if (!path) {
    setNotice('This notification cannot be snoozed from the current dashboard version.', 'error');
    return;
  }
  await api(path, {
    method: 'POST',
    body: JSON.stringify({ minutes: 15 })
  });
  setNotice(`Snoozed “${notification.title}” for 15 minutes.`);
  await loadSnapshot('manual');
}

function activeMissionForAgentSession(session) {
  return state.snapshot?.missions?.jobs?.find((mission) =>
    mission.assignedSession === session && ['dispatching', 'running', 'needs_you', 'verifying', 'reconcile_required'].includes(mission.status)
  ) || null;
}

function readMissionDraft(form) {
  const formData = new FormData(form);
  state.missionDraft = {
    ...state.missionDraft,
    open: form.closest('details')?.open ?? state.missionDraft.open,
    title: String(formData.get('title') || ''),
    workspace: String(formData.get('workspace') || ''),
    priority: String(formData.get('priority') || 'normal'),
    goal: String(formData.get('goal') || ''),
    verificationCriteria: String(formData.get('verificationCriteria') || '')
  };
}

async function createMissionFromForm(form) {
  if (state.snapshot?.capabilities?.missionQueue !== true) {
    setNotice('Mission Queue requires a dashboard backend restart.', 'error');
    return;
  }
  readMissionDraft(form);
  const draft = state.missionDraft;
  setNotice('Adding mission to Up Next...');
  try {
    const result = await api('/api/missions/create', {
      method: 'POST',
      body: JSON.stringify({
        title: draft.title,
        workspace: draft.workspace,
        priority: draft.priority,
        goal: draft.goal,
        verificationCriteria: draft.verificationCriteria,
        status: 'ready'
      })
    });
    state.missionDraft = {
      open: false,
      title: '',
      workspace: draft.workspace,
      priority: 'normal',
      goal: '',
      verificationCriteria: 'Review the result and record the evidence that proves the requested outcome.'
    };
    form.reset();
    setNotice(`Queued: ${result.job.title}. Nothing was dispatched.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Mission create failed: ${error.message}`, 'error');
  }
}

async function dispatchMissionClient(button) {
  const mission = currentMission(button.dataset.missionId);
  if (!mission) return;
  const card = button.closest('.mission-card');
  const session = card?.querySelector('[data-mission-worker]')?.value || '';
  if (!session) {
    setNotice('Choose an idle agent already working in this project.', 'error');
    return;
  }
  if (!window.confirm(`Dispatch “${mission.title}” to ${displayNameForSession(session)}?`)) return;
  setNotice(`Dispatching ${mission.title}...`);
  try {
    const result = await api(`/api/missions/${encodeURIComponent(mission.id)}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: mission.revision, session })
    });
    markAgentInteraction(session, 'mission.dispatch', new Date().toISOString(), { rerender: false });
    setNotice(`Mission running in ${result.session}.`);
    await loadSnapshot('manual');
    openAgentDetail(result.session, result.job?.assignedPaneId || '');
  } catch (error) {
    const suffix = error.data?.error === 'mission_revision_conflict' ? ' Refreshing the latest mission state.' : '';
    setNotice(`Dispatch failed: ${error.message}.${suffix}`, 'error');
    await loadSnapshot('manual');
  }
}

async function adoptExistingMissionClient(button) {
  const mission = currentMission(button.dataset.missionId);
  if (!mission) return;
  const card = button.closest('.mission-card');
  const paneId = card?.querySelector('[data-mission-adopt-worker]')?.value || '';
  const worker = (state.snapshot?.agents || []).find((agent) => agent.id === paneId) || null;
  if (
    !worker ||
    !worker.sessionCreatedAt ||
    !/^%\d+$/.test(String(worker.tmuxPaneId || '')) ||
    !Number.isInteger(worker.panePid)
  ) {
    setNotice('That worker identity is incomplete or stale. Refresh and choose it again.', 'error');
    return;
  }
  const confirmed = window.confirm([
    `Adopt the work already running in ${displayNameForSession(worker.session)} for “${mission.title}”?`,
    '',
    'Confirm you inspected this terminal and it is doing this mission.',
    'PaneFleet will update queue ownership only. It will not send a prompt, Enter, or any terminal input.'
  ].join('\n'));
  if (!confirmed) return;

  setNotice(`Adopting existing work from ${worker.session}...`);
  try {
    const result = await api(`/api/missions/${encodeURIComponent(mission.id)}/adopt`, {
      method: 'POST',
      body: JSON.stringify({
        expectedRevision: mission.revision,
        confirm: 'adopt-existing',
        session: worker.session,
        sessionCreatedAt: worker.sessionCreatedAt,
        paneId: worker.id,
        tmuxPaneId: worker.tmuxPaneId,
        panePid: worker.panePid
      })
    });
    setNotice(`${result.job.title} adopted in ${result.session}. No terminal input was sent.`);
    await loadSnapshot('manual');
  } catch (error) {
    const suffix = error.data?.error === 'mission_revision_conflict'
      ? ' The queue changed; refreshed the latest state.'
      : '';
    setNotice(`Adoption failed: ${error.message}.${suffix}`, 'error');
    await loadSnapshot('manual');
  }
}

async function moveMissionClient(button) {
  const mission = currentMission(button.dataset.missionId);
  if (!mission) return;
  try {
    await api(`/api/missions/${encodeURIComponent(mission.id)}/move`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: mission.revision, direction: button.dataset.direction })
    });
    setNotice(`Moved ${mission.title} ${button.dataset.direction}.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Move failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

async function transitionMissionClient(button) {
  const mission = currentMission(button.dataset.missionId);
  if (!mission) return;
  const to = button.dataset.to;
  let note = '';
  let confirm = '';
  if (to === 'done') {
    const entered = window.prompt('Verification evidence required. What proves this mission is complete?', mission.verification?.note || '');
    if (entered === null) return;
    note = entered.trim();
    if (!note) {
      setNotice('Done was not recorded: verification evidence is required.', 'error');
      return;
    }
  } else if (to === 'failed') {
    const entered = window.prompt('What failed?');
    if (entered === null) return;
    note = entered.trim();
    if (!note) return;
    if (['dispatching', 'running', 'needs_you', 'verifying', 'reconcile_required'].includes(mission.status)) {
      if (!window.confirm('Marking Failed releases the worker and workspace locks but does not stop the tmux agent. Confirm you inspected that terminal.')) return;
      confirm = 'inspected-release';
    }
  } else if (to === 'needs_you') {
    const entered = window.prompt('What decision or input is needed?', mission.blocker || 'Operator review requested.');
    if (entered === null) return;
    note = entered.trim();
  } else if (to === 'canceled') {
    const releasesLock = ['dispatching', 'running', 'needs_you', 'verifying', 'reconcile_required'].includes(mission.status);
    const warning = releasesLock
      ? `Cancel “${mission.title}”? This releases its worker and workspace locks but does not stop the tmux agent. Confirm you inspected or parked that terminal.`
      : `Cancel “${mission.title}”?`;
    if (!window.confirm(warning)) return;
    note = 'Canceled by operator.';
    if (releasesLock) confirm = 'inspected-release';
  } else if (mission.status === 'dispatching' && to === 'reconcile_required') {
    if (!window.confirm('The durable dispatch outcome is incomplete. Inspect the assigned terminal before resolving this mission.')) return;
    confirm = 'inspect-dispatch';
  } else if (mission.status === 'reconcile_required' && to === 'running') {
    if (!mission.worker?.present || !mission.worker?.identityMatches) {
      setNotice('Cannot assume running: the original tmux worker is missing or was replaced.', 'error');
      return;
    }
    if (!window.confirm('Confirm the mission prompt was submitted and the assigned agent is working on it.')) return;
    confirm = 'assume-running';
  } else if (to === 'ready' && ['running', 'needs_you', 'verifying', 'reconcile_required'].includes(mission.status)) {
    if (!window.confirm('Requeue releases the workspace lock but does not stop the assigned agent. Confirm you inspected that terminal first.')) return;
    confirm = 'inspected-release';
  }

  try {
    const result = await api(`/api/missions/${encodeURIComponent(mission.id)}/transition`, {
      method: 'POST',
      body: JSON.stringify({ expectedRevision: mission.revision, to, note, confirm })
    });
    setNotice(`${mission.title}: ${missionStatusLabel(result.job.status)}.`);
    await loadSnapshot('manual');
  } catch (error) {
    setNotice(`Mission update failed: ${error.message}`, 'error');
    await loadSnapshot('manual');
  }
}

function showMissionResult(id) {
  const mission = currentMission(id);
  if (!mission) return;
  showOutput(
    mission.title,
    `${missionStatusLabel(mission.status)} · ${shortPath(mission.workspace)}`,
    [
      `Mission: ${mission.id}`,
      `Goal: ${mission.goal}`,
      `Verification required: ${mission.verificationCriteria}`,
      `Worker: ${mission.assignedSession || 'unassigned'}`,
      '',
      'Result / evidence:',
      mission.resultSummary || mission.blocker || 'No result recorded.'
    ].join('\n')
  );
}

function openMissionCreate() {
  state.missionDraft.open = true;
  switchView('queue');
  render();
  window.requestAnimationFrame(() => {
    const panel = document.querySelector('.mission-create-panel');
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'start' });
    panel.querySelector('input, select, textarea')?.focus({ preventScroll: true });
  });
}

function showMoreMissionHistory() {
  state.missionHistoryOpen = true;
  state.missionHistoryLimit += 24;
  render();
}

function setOpenDrawer(drawer, { returnFocus = null, focus = true } = {}) {
  const next = drawer === 'tools' ? drawer : null;
  const previous = state.openDrawer;
  if (next) {
    closeShortcutHelp({ focus: false });
    closeNewAgentLauncher(document.querySelector('.new-agent-panel[open]'), false);
  }
  if (next && !previous && returnFocus) state.drawerReturnFocus = returnFocus;
  state.openDrawer = next;
  const drawerElements = { tools: els.toolsDrawer };
  for (const [name, element] of Object.entries(drawerElements)) {
    const open = name === next;
    element.classList.toggle('hidden', !open);
    element.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  els.drawerBackdrop.classList.toggle('hidden', !next);
  els.drawerBackdrop.setAttribute('aria-hidden', next ? 'false' : 'true');
  document.body.classList.toggle('drawer-open', Boolean(next));
  syncTerminalModalState();
  syncWorkspaceHeading();
  for (const button of document.querySelectorAll('[data-action="drawer-toggle"][data-drawer]')) {
    const expanded = button.dataset.drawer === next;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (button.id === 'tools-tab') button.classList.toggle('active', expanded);
  }
  if (next && focus) {
    window.requestAnimationFrame(() => drawerElements[next]?.focus({ preventScroll: true }));
  } else if (!next && previous && focus && state.drawerReturnFocus?.isConnected) {
    state.drawerReturnFocus.focus({ preventScroll: true });
    state.drawerReturnFocus = null;
  } else if (!next && previous) {
    state.drawerReturnFocus = null;
  }
}

function openShortcutHelp(trigger = document.activeElement) {
  if (!els.shortcutHelp?.classList.contains('hidden')) return;
  closeNewAgentLauncher(document.querySelector('.new-agent-panel[open]'), false);
  setOpenDrawer(null, { focus: false });
  state.shortcutHelpReturnFocus = trigger instanceof HTMLElement ? trigger : null;
  els.shortcutHelp.classList.remove('hidden');
  els.shortcutHelpBackdrop.classList.remove('hidden');
  document.body.classList.add('shortcut-help-open');
  syncTerminalModalState();
  window.requestAnimationFrame(() => {
    els.shortcutHelp.querySelector('.shortcut-help-close')?.focus({ preventScroll: true });
  });
}

function closeShortcutHelp({ focus = true } = {}) {
  if (!els.shortcutHelp || els.shortcutHelp.classList.contains('hidden')) return;
  els.shortcutHelp.classList.add('hidden');
  els.shortcutHelpBackdrop.classList.add('hidden');
  document.body.classList.remove('shortcut-help-open');
  syncTerminalModalState();
  const returnFocus = state.shortcutHelpReturnFocus;
  state.shortcutHelpReturnFocus = null;
  if (focus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function modalFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll('summary, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getClientRects().length);
}

function handleTerminalModalKeydown(event) {
  const item = state.terminalWindows.get(state.activeTerminalId);
  if (!item || item.element.getAttribute('aria-modal') !== 'true' || event.isComposing) return false;
  const focusable = modalFocusableElements(item.element);
  const nextIndex = modalFocusIndex(event, focusable.indexOf(document.activeElement), focusable.length);
  if (nextIndex < 0) return false;
  event.preventDefault();
  focusable[nextIndex]?.focus({ preventScroll: true });
  return true;
}

function handleShortcutHelpKeydown(event) {
  if (!els.shortcutHelp || els.shortcutHelp.classList.contains('hidden')) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeShortcutHelp();
    return true;
  }
  const focusable = modalFocusableElements(els.shortcutHelp);
  const nextIndex = modalFocusIndex(event, focusable.indexOf(document.activeElement), focusable.length);
  if (nextIndex < 0) return false;
  event.preventDefault();
  focusable[nextIndex]?.focus({ preventScroll: true });
  return true;
}

function handleDrawerKeydown(event) {
  const drawer = state.openDrawer === 'tools' ? els.toolsDrawer : null;
  if (!drawer || drawer.classList.contains('hidden') || document.querySelector('.new-agent-panel[open]')) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    setOpenDrawer(null);
    return true;
  }
  const focusable = modalFocusableElements(drawer);
  const nextIndex = modalFocusIndex(event, focusable.indexOf(document.activeElement), focusable.length);
  if (nextIndex < 0) return false;
  event.preventDefault();
  focusable[nextIndex]?.focus({ preventScroll: true });
  return true;
}

function toggleDrawer(name, trigger = null) {
  const next = nextDrawer(state.openDrawer, name);
  if (next === 'tools') {
    openToolView(state.activeToolView);
    return;
  }
  setOpenDrawer(null, { returnFocus: trigger });
}

function openToolView(view = 'overview', { focus = true } = {}) {
  const allowed = new Set(['overview', 'usage', 'services', 'security', 'system']);
  const selected = allowed.has(view) ? view : 'overview';
  const activeTab = els.toolTabs.find((tab) => tab.dataset.toolView === selected);
  state.activeToolView = selected;
  safeStorageSet(ACTIVE_TOOL_VIEW_STORAGE_KEY, selected);
  els.toolTabs.forEach((tab) => {
    const active = tab.dataset.toolView === selected;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  els.toolViews.forEach((panel) => {
    const active = panel.id === (selected === 'overview' ? 'tools-overview' : `${selected}-view`);
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
  setOpenDrawer('tools', { returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null, focus });
  revealHorizontalItem(activeTab?.parentElement, activeTab);
}

function syncDecisionAppBadge(decisionCount) {
  const count = Math.max(0, Math.floor(Number(decisionCount) || 0));
  if (state.appBadgeCount === count) return;
  state.appBadgeCount = count;
  const task = count > 0
    ? globalThis.navigator?.setAppBadge?.(count)
    : globalThis.navigator?.clearAppBadge?.();
  task?.catch?.(() => {});
}

function syncWorkspaceHeading() {
  const queueActive = state.activeView === 'queue';
  els.workspaceEyebrow.textContent = queueActive ? 'Safe delivery queue' : 'Terminal-first control';
  els.workspaceTitle.textContent = queueActive ? 'Prompt Queue' : 'Agent workspace';
  const snapshot = state.snapshot;
  const attention = snapshot ? normalizedAttention(snapshot) : { items: [], decisionCount: 0 };
  const decisionCount = dashboardSectionDecisionCount({
    view: state.activeView,
    drawer: state.openDrawer,
    attentionItems: attention.items,
    missions: snapshot?.missions?.jobs,
    agents: snapshot?.agents,
    promptQueueNeedsReview: snapshot?.promptQueue?.counts?.needsReview
  });
  const globalDecisionCount = snapshot ? attentionDecisionCount(snapshot, attention) : 0;
  const queuedCount = Number(snapshot?.promptQueue?.counts?.pending || 0);
  const workingCount = (snapshot?.agents || []).filter((agent) => !isReviewAgent(agent) && agent.agentStatus?.state === 'busy').length;
  document.title = dashboardDocumentTitle({
    view: state.activeView,
    drawer: state.openDrawer,
    decisionCount,
    queuedCount,
    workingCount,
    connection: els.liveState?.dataset.state || 'init'
  });
  syncDecisionAppBadge(globalDecisionCount);
}

function switchView(view, { focusTab = false, persist = true } = {}) {
  if (view === 'services') {
    openToolView('services');
    return;
  }
  if (view === 'security') {
    openToolView('security');
    return;
  }
  if (['review', 'ports', 'processes', 'audit', 'system'].includes(view)) {
    openToolView('system');
    if (view !== 'system') window.requestAnimationFrame(() => document.querySelector(`#${view}-view`)?.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'start' }));
    return;
  }
  if (!['agents', 'queue'].includes(view)) return;
  setOpenDrawer(null);
  state.activeView = view;
  syncWorkspaceFocus();
  if (persist) safeStorageSet(ACTIVE_VIEW_STORAGE_KEY, view);
  const nextHash = view === 'queue' ? '#queue' : '#terminals';
  if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
  syncWorkspaceHeading();
  const selectedTab = document.querySelector(`#${view}-tab`);
  for (const tab of els.tabs.filter((item) => item.dataset.view)) {
    const selected = tab === selectedTab;
    tab.classList.toggle('active', selected);
    if (selected) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  for (const panel of els.views) {
    const selected = panel.id === `${view}-view`;
    panel.classList.toggle('active', selected);
    panel.hidden = !selected;
  }
  if (focusTab) selectedTab.focus({ preventScroll: true });
}

function openServiceDetail(serviceId) {
  switchView('services');
  window.requestAnimationFrame(() => {
    const card = [...els.services.querySelectorAll('[data-service-id]')]
      .find((item) => item.dataset.serviceId === serviceId);
    if (!card) return;
    card.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'start' });
    card.focus({ preventScroll: true });
  });
}

function launcherWorkspaceForProject(requestedWorkspace) {
  const requested = String(requestedWorkspace || '').replace(/\/+$/, '');
  if (!requested) return '';
  const options = state.options.workspaces || [];
  const exact = options.find((item) => String(item.path || '').replace(/\/+$/, '') === requested);
  if (exact) return exact.path;
  return options
    .filter((item) => {
      const candidate = String(item.path || '').replace(/\/+$/, '');
      return candidate && requested.startsWith(`${candidate}/`);
    })
    .sort((left, right) => String(right.path || '').length - String(left.path || '').length)[0]?.path || '';
}

function nextAgentNameForWorkspace(workspace) {
  const base = slugifyClient(basenameFromPath(workspace) || state.options.suggestedName || 'agent');
  const sessions = new Set((state.snapshot?.agents || []).map((agent) => String(agent.session || '')));
  if (!sessions.has(`codex-${base}`)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    if (!sessions.has(`codex-${base}-${suffix}`)) return `${base}-${suffix}`;
  }
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function openNewAgentLauncher(requestedWorkspace = '') {
  closeShortcutHelp({ focus: false });
  setOpenDrawer(null, { focus: false });
  const workspace = launcherWorkspaceForProject(requestedWorkspace);
  state.agentDraft = {
    ...state.agentDraft,
    open: true,
    ...(workspace ? {
      workspace,
      directoryName: '',
      name: nextAgentNameForWorkspace(workspace)
    } : {})
  };
  render();
  syncTerminalModalState();
  window.requestAnimationFrame(() => {
    const launcher = document.querySelector('.new-agent-panel');
    if (!launcher) return;
    launcher.open = true;
    launcher.querySelector('select, input, textarea')?.focus({ preventScroll: true });
  });
}

function closeNewAgentLauncher(launcher = document.querySelector('.new-agent-panel[open]'), focus = true) {
  if (!launcher) return;
  const form = launcher.querySelector('#new-agent-form');
  if (form) readAgentDraft(form);
  state.agentDraft.open = false;
  launcher.open = false;
  launcher.removeAttribute('role');
  launcher.removeAttribute('aria-modal');
  syncTerminalModalState();
  const hint = launcher.querySelector('.summary-hint');
  if (hint) hint.textContent = 'Launcher';
  if (focus) launcher.querySelector('summary')?.focus({ preventScroll: true });
}

function handleNewAgentLauncherKeydown(event, launcher) {
  if (!launcher || event.isComposing) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNewAgentLauncher(launcher);
    return true;
  }
  const form = launcher.querySelector('#new-agent-form');
  if (form?.contains(event.target) && isNewAgentSubmitShortcut(event)) {
    event.preventDefault();
    form.requestSubmit();
    return true;
  }
  const focusable = modalFocusableElements(launcher);
  const nextIndex = modalFocusIndex(event, focusable.indexOf(document.activeElement), focusable.length);
  if (nextIndex < 0) return false;
  event.preventDefault();
  focusable[nextIndex].focus({ preventScroll: true });
  return true;
}

function openActiveAgentWindows() {
  const briefs = state.snapshot?.orchestration?.agents || [];
  const activeSessions = briefs
    .filter((agent) => agent.state === 'busy' || agent.state === 'waiting' || agent.needsAttention)
    .map((agent) => agent.session)
    .filter(Boolean);
  const fallback = (state.snapshot?.agents || []).map((agent) => agent.session).filter(Boolean);
  const sessions = [...new Set(activeSessions.length ? activeSessions : fallback)].slice(0, 6);
  sessions.forEach((session, index) => {
    window.setTimeout(() => openAgentDetail(session), index * 120);
  });
  setNotice(sessions.length ? `Opened ${sessions.length} active terminal${sessions.length === 1 ? '' : 's'}.` : 'No agent terminals are available.');
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) {
    const focusedTerminal = terminalItemFromTarget(event.target);
    const terminalEditor = event.target.closest('.terminal-send-form, input, textarea, select, [contenteditable="true"]');
    if (!terminalEditor && focusedTerminal && currentAgent(focusedTerminal.session) && !isReviewAgent(currentAgent(focusedTerminal.session))) {
      void touchOpenedAgent(focusedTerminal.session);
    }
    return;
  }
  const action = target.dataset.action;
  const terminalItem = terminalItemFromTarget(target);
  if (terminalItem) focusTerminalWindow(terminalItem);
  switch (action) {
    case 'theme-toggle':
      toggleDashboardTheme();
      break;
    case 'shortcut-help-open':
      openShortcutHelp(target);
      break;
    case 'shortcut-help-close':
      closeShortcutHelp();
      break;
    case 'notice-dismiss':
      dismissNotice();
      break;
    case 'runtime-restart':
      runElementTask(target, restartDashboardFromMismatch);
      break;
    case 'drawer-toggle':
      toggleDrawer(target.dataset.drawer, target);
      break;
    case 'drawer-close':
      setOpenDrawer(null);
      break;
    case 'session-filter':
      setSessionFilter(target.dataset.filter);
      break;
    case 'prompt-history-origin':
      setPromptHistoryOriginFilter(target.dataset.origin);
      break;
    case 'prompt-history-search-clear':
      setPromptHistoryQuery('');
      break;
    case 'open-queue':
      switchView('queue');
      break;
    case 'open-terminals':
      switchView('agents');
      break;
    case 'notifications-focus':
      openToolView('overview', { focus: false });
      window.requestAnimationFrame(() => document.querySelector('.tools-notifications')?.scrollIntoView({ behavior: motionAwareScrollBehavior(), block: 'start' }));
      break;
    case 'tool-view':
      openToolView(target.dataset.toolView || 'overview', { focus: false });
      break;
    case 'attention-open':
      openAttentionTarget(currentAttentionItem(target.dataset.attentionId));
      break;
    case 'notification-open':
      runElementTask(target, () => openNotification(target));
      break;
    case 'notification-snooze':
      runElementTask(target, () => snoozeNotification(target));
      break;
    case 'prompt-queue-open-agent':
      openAgentDetail(target.dataset.session, target.dataset.paneId || '');
      void touchOpenedAgent(target.dataset.session, { force: true });
      break;
    case 'prompt-queue-select-target':
      selectPromptQueueTarget(target);
      break;
    case 'prompt-queue-select-all':
      selectAllPromptQueueTargets();
      break;
    case 'prompt-queue-mobile-multi':
      togglePromptQueueMobileMultiSelect();
      break;
    case 'prompt-queue-draft-clear':
      clearPromptQueueDraft(target.closest('#prompt-queue-form'));
      break;
    case 'prompt-queue-draft-undo':
      undoPromptQueueDraftClear(target.closest('#prompt-queue-form'));
      break;
    case 'prompt-queue-remove-hidden':
      removePromptQueueHiddenCharacters(target.closest('#prompt-queue-form'));
      break;
    case 'ticket-refiner-open':
      openTicketRefiner(target.closest('#prompt-queue-form'));
      break;
    case 'ticket-refiner-keep-original':
      keepOriginalTicketDraft(target.closest('#prompt-queue-form'));
      break;
    case 'ticket-refiner-use':
      useTicketRefinedDraft(target.closest('#prompt-queue-form'));
      break;
    case 'prompt-queue-jump':
      jumpToPromptQueueSection(target.dataset.queueSection);
      break;
    case 'prompt-queue-cancel':
      runElementTask(target, () => cancelPromptQueueClient(target));
      break;
    case 'prompt-queue-dismiss-review':
      runElementTask(target, () => dismissPromptQueueReviewClient(target));
      break;
    case 'prompt-queue-import-visible-ideas':
      runElementTask(target, () => importPromptQueueVisibleIdeasClient(target));
      break;
    case 'prompt-queue-wait-manual-submit':
      runElementTask(target, () => waitForPromptQueueManualSubmitClient(target));
      break;
    case 'prompt-queue-retarget':
      runElementTask(target, () => retargetPromptQueueClient(target));
      break;
    case 'prompt-queue-requeue-replacement':
      runElementTask(target, () => requeuePromptQueueReplacementClient(target));
      break;
    case 'prompt-queue-release':
      runElementTask(target, () => releasePromptQueueClient(target));
      break;
    case 'prompt-queue-continue-monitoring':
      runElementTask(target, () => continuePromptQueueMonitoringClient(target));
      break;
    case 'idea-approve':
      runElementTask(target, () => approveIdeaClient(target));
      break;
    case 'idea-refine':
      runElementTask(target, () => refineIdeaClient(target));
      break;
    case 'idea-reject':
      runElementTask(target, () => rejectIdeaClient(target));
      break;
    case 'prompt-queue-clear-history':
      runElementTask(target, () => clearPromptQueueHistoryClient(target));
      break;
    case 'prompt-schedule-toggle':
      runElementTask(target, () => togglePromptScheduleClient(target));
      break;
    case 'prompt-schedule-queue-now':
      runElementTask(target, () => queuePromptScheduleNowClient(target));
      break;
    case 'prompt-schedule-paused-toggle':
      togglePausedPromptSchedules();
      break;
    case 'prompt-schedule-retarget':
      runElementTask(target, () => retargetPromptScheduleClient(target));
      break;
    case 'prompt-schedule-delete':
      runElementTask(target, () => deletePromptScheduleClient(target));
      break;
    case 'mission-create-open':
      openMissionCreate();
      break;
    case 'mission-run':
      runElementTask(target, () => dispatchMissionClient(target));
      break;
    case 'mission-adopt':
      runElementTask(target, () => adoptExistingMissionClient(target));
      break;
    case 'mission-move':
      runElementTask(target, () => moveMissionClient(target));
      break;
    case 'mission-transition':
      runElementTask(target, () => transitionMissionClient(target));
      break;
    case 'mission-open-agent':
      openAgentDetail(target.dataset.session, target.dataset.paneId || '');
      void touchOpenedAgent(target.dataset.session, { force: true });
      break;
    case 'mission-result':
      showMissionResult(target.dataset.missionId);
      break;
    case 'mission-history-more':
      showMoreMissionHistory();
      break;
    case 'mission-open-queue':
      revealMissionCard(target.dataset.missionId);
      break;
    case 'peek':
      openDetail(target.dataset.session);
      if (currentAgent(target.dataset.session) && !isReviewAgent(currentAgent(target.dataset.session))) {
        void touchOpenedAgent(target.dataset.session, { force: true });
      }
      break;
    case 'agent-detail':
      openAgentDetail(target.dataset.session);
      void touchOpenedAgent(target.dataset.session, { force: true });
      break;
    case 'copy-attach':
      copyAttach(target.dataset.session);
      break;
    case 'session-pin':
      togglePinnedSession(target.dataset.session, target);
      break;
    case 'session-filters-reset':
      resetSessionFilters();
      break;
    case 'send-newline':
      if (terminalItem) insertSendText(terminalItem, '\n');
      break;
    case 'send-indent':
      if (terminalItem) insertSendText(terminalItem, '  ');
      break;
    case 'send-clear':
      if (terminalItem) clearSendText(terminalItem);
      break;
    case 'send-undo':
      if (terminalItem) undoClearSendText(terminalItem);
      break;
    case 'send-history-prev':
      if (terminalItem) navigateTerminalHistory(terminalItem, -1);
      break;
    case 'send-history-next':
      if (terminalItem) navigateTerminalHistory(terminalItem, 1);
      break;
    case 'paste-insert':
      if (terminalItem) insertPendingPaste(terminalItem);
      break;
    case 'paste-cancel':
      if (terminalItem) clearPendingPaste(terminalItem);
      break;
    case 'terminal-tab':
      if (terminalItem?.minimized) restoreTerminalWindow(terminalItem);
      else if (terminalItem) {
        focusTerminalWindow(terminalItem);
        applyTerminalLayout();
        renderTerminalChrome();
      }
      break;
    case 'terminal-cycle-prev':
      cycleTerminalWindow(terminalItem, -1);
      break;
    case 'terminal-cycle-next':
      cycleTerminalWindow(terminalItem, 1);
      break;
    case 'terminal-cycle-active':
      cycleActiveTerminal(Number(target.dataset.direction));
      break;
    case 'terminal-jump-latest':
      if (terminalItem) {
        forceTerminalScrollBottom(terminalItem);
        terminalItem.output.focus({ preventScroll: true });
      }
      break;
    case 'terminal-copy-output':
      if (terminalItem) runElementTask(target, () => copyTerminalOutput(terminalItem, target));
      break;
    case 'terminal-find-toggle':
      if (terminalItem) setTerminalFindOpen(terminalItem, !terminalItem.findOpen);
      break;
    case 'terminal-find-prev':
      stepTerminalFind(terminalItem, -1);
      break;
    case 'terminal-find-next':
      stepTerminalFind(terminalItem, 1);
      break;
    case 'terminal-find-close':
      setTerminalFindOpen(terminalItem, false);
      break;
    case 'terminal-refresh-toggle':
      if (terminalItem) setTerminalRefreshPaused(terminalItem, terminalItem.captureUnavailable ? false : !terminalItem.refreshPaused);
      break;
    case 'terminal-tools-toggle':
      if (terminalItem) setTerminalToolsCollapsed(terminalItem, !terminalItem.toolsCollapsed);
      break;
    case 'terminal-telemetry-toggle':
      if (terminalItem) setTerminalTelemetryOpen(terminalItem, !terminalItem.telemetryOpen);
      break;
    case 'terminal-font-scale':
      adjustTerminalFontScale(target.dataset.delta);
      break;
    case 'terminal-font-reset':
      resetTerminalFontScale();
      break;
    case 'terminal-wrap-toggle':
      toggleTerminalWrap();
      break;
    case 'terminal-composer-toggle':
      if (terminalItem) setTerminalComposerCollapsed(terminalItem, !terminalItem.composerCollapsed);
      break;
    case 'terminal-layout':
      setTerminalLayout(target.dataset.layout);
      break;
    case 'workspace-focus-toggle':
      setWorkspaceFocus();
      break;
    case 'workspace-panel-toggle':
      toggleWorkspacePanel(target.dataset.panel);
      break;
    case 'terminal-full-height':
      setTerminalFullHeight();
      break;
    case 'close-finished-terminals':
      closeFinishedTerminals();
      break;
    case 'project-desk-refresh':
      syncProjectDesk({ refreshContext: true });
      break;
    case 'project-new-agent':
      openNewAgentLauncher(projectContextWorkspace(state.projectDesk.context, state.projectDesk.target));
      break;
    case 'project-artifact-download':
      runElementTask(target, () => projectArtifactDownload(target));
      break;
    case 'scratchpad-snippet-insert':
      insertScratchpadSnippet();
      break;
    case 'scratchpad-snippet-save':
      saveScratchpadSnippet();
      break;
    case 'scratchpad-snippet-delete':
      deleteScratchpadSnippet();
      break;
    case 'scratchpad-review':
      openScratchpadReview();
      break;
    case 'scratchpad-review-cancel':
      clearScratchpadReview();
      updateProjectComposerState();
      els.scratchpadText.focus({ preventScroll: true });
      break;
    case 'scratchpad-send-confirm':
      runElementTask(target, confirmScratchpadSend);
      break;
    case 'terminal-minimize':
      minimizeTerminalWindow(terminalItem);
      break;
    case 'terminal-restore':
      restoreTerminalWindow(terminalItem);
      if (terminalItem && currentAgent(terminalItem.session) && !isReviewAgent(currentAgent(terminalItem.session))) {
        void touchOpenedAgent(terminalItem.session);
      }
      break;
    case 'terminal-maximize':
      toggleTerminalMaximize(terminalItem);
      break;
    case 'terminal-close':
      closeTerminalWindow(terminalItem, { announce: true });
      break;
    case 'terminal-command':
      if (terminalItem) sendTerminalCommand(terminalItem, target.dataset.command);
      break;
    case 'terminal-resume-agent':
      if (terminalItem) runElementTask(target, () => resumeAgent(terminalItem.session));
      break;
    case 'terminal-picker-toggle':
      if (state.snapshot?.capabilities?.pickerUiKeys !== true) {
        setNotice('Picker navigation requires a dashboard backend restart.', 'error');
      } else if (terminalItem?.pickerActive) {
        sendTerminalUiKey(terminalItem, 'cancel');
      } else if (terminalItem) {
        toggleTerminalPickerControls(terminalItem, true, 'effort', true);
        forceTerminalScrollBottom(terminalItem);
      }
      break;
    case 'terminal-ui-key':
      if (terminalItem) sendTerminalUiKey(terminalItem, target.dataset.key);
      break;
    case 'new-agent-open':
      openNewAgentLauncher();
      break;
    case 'new-agent-cancel':
      closeNewAgentLauncher(target.closest('.new-agent-panel') || document.querySelector('.new-agent-panel[open]'));
      break;
    case 'open-active-agents':
      openActiveAgentWindows();
      break;
    case 'dashboard-refresh':
      loadSnapshot('manual');
      break;
    case 'ssh-rescue-open':
      runElementTask(target, openSshRescue);
      break;
    case 'ssh-rescue-lock':
      runElementTask(target, lockSshRescue);
      break;
    case 'ip-rules-view':
      runElementTask(target, viewIpRules);
      break;
    case 'ip-rules-cleanup':
      runElementTask(target, cleanupManagedIpRules);
      break;
    case 'agent-resume':
      {
        const settings = target.closest('.model-settings');
        const model = settings?.querySelector('[data-model-select]')?.value || '';
        const reasoning = settings?.querySelector('[data-reasoning-select]')?.value || '';
        runElementTask(target, () => resumeAgent(target.dataset.session, model, reasoning));
      }
      break;
    case 'interrupt-agent':
      runElementTask(target, () => interruptAgent(target.dataset.session));
      break;
    case 'session-interrupt':
      runElementTask(target, () => sessionAction(target.dataset.session, 'interrupt'));
      break;
    case 'session-stop':
      runElementTask(target, () => sessionAction(target.dataset.session, 'stop'));
      break;
    case 'review-start':
      runElementTask(target, runReview);
      break;
    case 'switch-services':
      openServiceDetail(target.dataset.service);
      break;
    case 'service-start':
      runElementTask(target, () => serviceAction(target.dataset.service, 'start'));
      break;
    case 'service-stop':
      runElementTask(target, () => serviceAction(target.dataset.service, 'stop'));
      break;
    case 'service-restart':
      runElementTask(target, () => serviceAction(target.dataset.service, 'restart'));
      break;
    case 'service-custom':
      runElementTask(target, () => customServiceAction(
          target.dataset.service,
          target.dataset.customAction,
          target.dataset.confirm === '1',
          target.dataset.requiresPublicIp === '1'
        ));
      break;
  }
});

document.addEventListener('submit', (event) => {
  if (event.target?.classList?.contains('terminal-find-bar')) {
    event.preventDefault();
    stepTerminalFind(terminalItemFromTarget(event.target), 1);
    return;
  }
  if (event.target?.id === 'prompt-history-search-form') {
    event.preventDefault();
    setPromptHistoryQuery(new FormData(event.target).get('query'));
    return;
  }
  if (event.target?.id === 'prompt-queue-form') {
    event.preventDefault();
    const mode = event.submitter?.value === 'send' ? 'send' : 'queue';
    runElementTask(event.target, () => createPromptQueueFromForm(event.target, mode));
    return;
  }
  if (event.target?.id === 'idea-queue-form') {
    event.preventDefault();
    runElementTask(event.target, () => createIdeaFromForm(event.target));
    return;
  }
  if (event.target?.id === 'idea-generator-form') {
    event.preventDefault();
    runElementTask(event.target, () => generateIdeasFromForm(event.target));
    return;
  }
  if (event.target?.id === 'mission-create-form') {
    event.preventDefault();
    runElementTask(event.target, () => createMissionFromForm(event.target));
    return;
  }
  if (event.target?.id === 'new-agent-form') {
    event.preventDefault();
    runElementTask(event.target, () => createAgent(event.target));
    return;
  }
  const terminalItem = terminalItemFromTarget(event.target);
  if (terminalItem && event.target.classList.contains('terminal-send-form')) {
    event.preventDefault();
    sendTerminalText(terminalItem);
  }
});

document.addEventListener('input', (event) => {
  if (event.target === els.sessionSearch) {
    filterSessionRail(event.target.value);
    return;
  }
  if (event.target === els.projectNotes) {
    const target = state.projectDesk.target;
    if (target) {
      state.projectDesk.notesDirty = true;
      safeStorageSet(projectNotesKey(state.projectDesk.notesScope || target.workspace), event.target.value.slice(0, PROJECT_NOTES_MAX));
      els.projectNotesState.textContent = 'Saved locally';
    }
    return;
  }
  if (event.target === els.scratchpadText) {
    const target = state.projectDesk.target;
    if (target) safeStorageSet(scratchpadDraftKey(target), event.target.value.slice(0, SEND_TEXT_MAX));
    clearScratchpadReview();
    updateProjectComposerState();
    return;
  }
  if (event.target === els.scratchpadSnippetName) {
    updateProjectComposerState();
    return;
  }
  const promptQueueForm = event.target?.closest?.('#prompt-queue-form');
  if (promptQueueForm) {
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    readPromptQueueDraft(promptQueueForm);
    if (String(event.target?.name || '').startsWith('refiner')) {
      readTicketRefinerForm(promptQueueForm, event.target.name);
    }
  }
  const ideaQueueForm = event.target?.closest?.('#idea-queue-form');
  if (ideaQueueForm) readIdeaQueueDraft(ideaQueueForm);
  const ideaGeneratorForm = event.target?.closest?.('#idea-generator-form');
  if (ideaGeneratorForm) updateIdeaGeneratorPreview(ideaGeneratorForm);
  const missionForm = event.target?.closest?.('#mission-create-form');
  if (missionForm) readMissionDraft(missionForm);
  const form = event.target?.closest?.('#new-agent-form');
  if (form) readAgentDraft(form);
  const terminalItem = terminalItemFromTarget(event.target);
  if (terminalItem && event.target.classList.contains('terminal-find-input')) {
    terminalItem.findQuery = event.target.value;
    terminalItem.findIndex = 0;
    renderTerminalFindHighlights(terminalItem, { scroll: true });
    return;
  }
  if (terminalItem && event.target.classList.contains('terminal-send-text')) {
    handleTerminalTextInput(event, terminalItem);
  }
});

document.addEventListener('paste', (event) => {
  if (!event.target?.classList?.contains('terminal-send-text')) return;
  const item = terminalItemFromTarget(event.target);
  const value = event.clipboardData?.getData('text/plain') || '';
  const lineCount = value.split(/\r?\n/).length;
  if (!item || !value || (value.length <= 400 && lineCount <= 3)) return;
  event.preventDefault();
  previewTerminalPaste(item, value);
});

document.addEventListener('change', (event) => {
  if (event.target?.classList?.contains('prompt-target-mobile-select')) {
    selectPromptQueueTarget(event.target, { forceSingle: true, restoreCardFocus: false });
    return;
  }
  const ideaGeneratorForm = event.target?.closest?.('#idea-generator-form');
  if (ideaGeneratorForm) {
    const previousSource = state.ideaGeneratorDraft.sourceSession;
    readIdeaGeneratorDraft(ideaGeneratorForm);
    if (event.target.name === 'sourceSession' && state.ideaGeneratorDraft.sourceSession !== previousSource) {
      state.ideaGeneratorDraft.selectedPromptIds = [];
      render();
    } else {
      updateIdeaGeneratorPreview(ideaGeneratorForm);
    }
    return;
  }
  if (event.target === els.terminalJumpSelect || event.target?.classList?.contains('terminal-mobile-select')) {
    activateTerminalWindow(state.terminalWindows.get(event.target.value));
    return;
  }
  if (event.target === els.scratchpadSnippetSelect) {
    const snippet = selectedPromptSnippet();
    els.scratchpadSnippetName.value = snippet && !snippet.builtIn ? snippet.name : '';
    updateProjectComposerState();
    return;
  }
  const promptQueueForm = event.target?.closest?.('#prompt-queue-form');
  if (promptQueueForm) {
    state.promptQueueDraftUndo = null;
    state.ticketRefinerUndo = null;
    readPromptQueueDraft(promptQueueForm);
    return;
  }
  const missionForm = event.target?.closest?.('#mission-create-form');
  if (missionForm) {
    readMissionDraft(missionForm);
    return;
  }
  const form = event.target?.closest?.('#new-agent-form');
  if (event.target?.matches?.('[data-model-select]')) {
    const settings = event.target.closest('.model-settings');
    syncModelSettings(settings);
    if (form) readAgentDraft(form);
    return;
  }
  if (!form) return;
  if (event.target.name === 'preset') {
    applyPresetToLauncher(form);
    return;
  }
  if (event.target.name === 'workspace') {
    syncAgentLauncher(form);
    return;
  }
  readAgentDraft(form);
});

document.addEventListener('toggle', (event) => {
  if (event.target?.classList?.contains('mission-details')) {
    const missionId = event.target.closest('.mission-card')?.dataset.missionId;
    if (missionId) {
      if (event.target.open) state.openMissionDetails.add(missionId);
      else state.openMissionDetails.delete(missionId);
    }
  }
  if (event.target?.classList?.contains('mission-history')) {
    state.missionHistoryOpen = event.target.open;
  }
  if (event.target?.matches?.('[data-queue-detail]')) {
    const detail = event.target.dataset.queueDetail;
    if (event.target.open) state.openPromptQueueDetails.add(detail);
    else state.openPromptQueueDetails.delete(detail);
  }
  if (event.target?.classList?.contains('mission-create-panel')) {
    state.missionDraft.open = event.target.open;
  }
  if (event.target?.classList?.contains('idea-generator-panel')) {
    state.ideaGeneratorDraft.open = event.target.open;
    const hint = event.target.querySelector('.summary-hint');
    if (hint) hint.textContent = event.target.open ? 'Close' : 'Launcher';
  }
  if (event.target?.classList?.contains('new-agent-panel')) {
    state.agentDraft.open = event.target.open;
    const hint = event.target.querySelector('.summary-hint');
    if (hint) hint.textContent = event.target.open ? 'Close' : 'Launcher';
    if (event.target.open) {
      event.target.setAttribute('role', 'dialog');
      event.target.setAttribute('aria-modal', 'true');
    } else {
      event.target.removeAttribute('role');
      event.target.removeAttribute('aria-modal');
    }
    syncTerminalModalState();
  }
}, true);

function handleTabKeydown(event) {
  const currentIndex = els.tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % els.tabs.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + els.tabs.length) % els.tabs.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = els.tabs.length - 1;
  else return;
  event.preventDefault();
  const next = els.tabs[nextIndex];
  next.focus({ preventScroll: true });
  if (next.dataset.view) switchView(next.dataset.view);
  else next.click();
}

els.tabs.forEach((tab) => {
  if (tab.dataset.view) tab.addEventListener('click', () => switchView(tab.dataset.view));
  tab.addEventListener('keydown', handleTabKeydown);
});
els.refresh.addEventListener('click', () => Promise.all([
  loadSnapshot('manual'),
  loadOptions()
]));
window.addEventListener('resize', scheduleTerminalViewportResize);
window.visualViewport?.addEventListener('resize', scheduleTerminalViewportResize);
window.addEventListener('hashchange', () => {
  const view = preferredDashboardView(window.location.hash, state.activeView);
  if (view !== state.activeView) switchView(view, { persist: false });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const item of state.terminalWindows.values()) {
      if (item.timer) window.clearTimeout(item.timer);
      item.timer = null;
    }
    return;
  }
  for (const item of state.terminalWindows.values()) {
    if (item.mode !== 'static' && !item.minimized) scheduleTerminalRefresh(item, 0);
  }
});

async function sendTerminalCommand(item, command) {
  const labels = new Map([
    ['/model', 'Model picker'],
    ['/status', 'Status'],
    ['/usage', 'Usage'],
    ['/fast', 'Fast mode toggle']
  ]);
  if (!item || item.sendInFlight || item.uiKeyInFlight || item.pickerActive || !labels.has(command)) return;
  if (command === '/model' && state.snapshot?.capabilities?.pickerUiKeys !== true) {
    setNotice('Model picker requires a dashboard backend restart.', 'error');
    return;
  }
  const canPrompt = canPromptAgent(item.session);
  if (!canPrompt.ok) {
    setNotice(`${labels.get(command)} unavailable: ${displayNameForSession(item.session)} is not accepting input.`, 'error');
    return;
  }
  item.sendInFlight = true;
  updateSendInputState(item);
  try {
    const activeMission = activeMissionForAgentSession(item.session);
    await sendAgentInputWithQueueConfirmation('/api/agent/send', {
      session: item.session,
      text: command,
      missionId: activeMission?.id || null
    }, item.session);
    markAgentInteraction(item.session, 'agent.send');
    if (command === '/model') toggleTerminalPickerControls(item, true, 'model', true);
    forceTerminalScrollBottom(item);
    setNotice(`${labels.get(command)} sent to ${displayNameForSession(item.session)}.`);
    window.setTimeout(() => {
      if (state.terminalWindows.has(item.id)) refreshTerminalWindow(item);
    }, 600);
  } catch (error) {
    setNotice(
      error.userCanceled ? error.message : `${labels.get(command)} failed: ${error.message}`,
      error.userCanceled ? 'info' : 'error'
    );
  } finally {
    item.sendInFlight = false;
    updateSendInputState(item);
  }
}

// Picker keys use a separate allowlisted API; prompt input stays literal text plus Enter.
async function sendTerminalUiKey(item, key) {
  const allowedKeys = new Set(['up', 'down', 'left', 'right', 'select', 'cancel']);
  if (state.snapshot?.capabilities?.pickerUiKeys !== true || !item || !allowedKeys.has(key)) return;
  if (key === 'cancel') {
    item.uiKeyQueue.length = 0;
    item.uiKeyQueue.push(key);
  } else {
    if (item.uiKeyQueue.length >= 24) return;
    item.uiKeyQueue.push(key);
  }
  if (item.uiKeyInFlight) return;
  item.uiKeyInFlight = true;
  updateSendInputState(item);
  let sentAny = false;

  try {
    while (item.uiKeyQueue.length && state.terminalWindows.has(item.id)) {
      const nextKey = item.uiKeyQueue.shift();
      const canPrompt = canPromptAgent(item.session);
      if (!canPrompt.ok) throw new Error(`${displayNameForSession(item.session)} is not accepting input`);
      const activeMission = activeMissionForAgentSession(item.session);
      await api('/api/agent/ui-key', {
        method: 'POST',
        body: JSON.stringify({ session: item.session, key: nextKey, missionId: activeMission?.id || null })
      });
      sentAny = true;
      markAgentInteraction(item.session, 'agent.ui_key', new Date().toISOString(), { rerender: false });
      forceTerminalScrollBottom(item);
      if (nextKey === 'cancel') {
        toggleTerminalPickerControls(item, false);
      } else if (nextKey === 'select' && item.pickerStage === 'model') {
        toggleTerminalPickerControls(item, true, 'effort');
      } else if (nextKey === 'select' && item.pickerStage === 'effort') {
        toggleTerminalPickerControls(item, false);
      }
    }
    window.setTimeout(() => {
      if (state.terminalWindows.has(item.id)) refreshTerminalWindow(item);
    }, 180);
    if (sentAny) render({ preserveActiveEditor: true });
  } catch (error) {
    item.uiKeyQueue.length = 0;
    setNotice(`Picker navigation failed: ${error.message}`, 'error');
  } finally {
    item.uiKeyInFlight = false;
    updateSendInputState(item);
  }
}

async function sendTerminalTextValue(item, text, { expectedTarget = null, clearTerminalInput = false, onSent = null } = {}) {
  if (!item || item.sendInFlight || item.uiKeyInFlight || item.pickerActive) return;
  const { session } = item;
  const value = String(text || '');
  if (!session || !value.trim()) return false;
  if (expectedTarget) {
    const currentTarget = projectDeskTargetForTerminal(item);
    if (!sameExactTarget(expectedTarget, currentTarget)) {
      setNotice('Input not sent: the reviewed tmux pane was replaced or is no longer focused.', 'error');
      return false;
    }
  }
  const canPrompt = canPromptAgent(session);
  if (!canPrompt.ok) {
    setNotice(`Input not sent: ${displayNameForSession(session)} is ${canPrompt.reason}.`, 'error');
    updateTerminalSendForm(item);
    return false;
  }
  item.sendInFlight = true;
  updateSendInputState(item);
  try {
    const activeMission = activeMissionForAgentSession(session);
    const durableTarget = expectedTarget || projectDeskTargetForTerminal(item);
    const result = await sendAgentInputWithQueueConfirmation('/api/agent/send', {
      session,
      text: value,
      missionId: activeMission?.id || null,
      ...(durableTarget?.identityComplete ? exactTargetIdentityPayload(durableTarget) : {})
    }, session, { allowAnswerContinuation: true });
    markAgentInteraction(session, 'agent.send');
    rememberTerminalHistory(item, value);
    if (clearTerminalInput && item.sendText.value === value) clearSendText(item, { remember: false });
    if (onSent) onSent();
    if (result.queueContinuation?.requested && result.queueContinuation.ok) {
      setNotice(`Answer sent to ${displayNameForSession(session)}. PaneFleet is monitoring the same accepted turn.`);
    } else if (result.queueContinuation?.requested) {
      setNotice(`Answer was sent to ${displayNameForSession(session)}, but PaneFleet could not link its queue record. Inspect the accepted turn; do not resend.`, 'error');
    } else {
      setNotice(`Sent terminal input to ${displayNameForSession(session)}.`);
    }
    window.setTimeout(() => {
      if (state.terminalWindows.has(item.id) && item.mode !== 'static') refreshTerminalWindow(item);
    }, 600);
    return true;
  } catch (error) {
    setNotice(error.userCanceled ? error.message : `Send failed: ${error.message}`, error.userCanceled ? 'info' : 'error');
    return false;
  } finally {
    item.sendInFlight = false;
    updateSendInputState(item);
    updateProjectComposerState();
  }
}

async function sendTerminalText(item) {
  if (!item) return false;
  return sendTerminalTextValue(item, item.sendText.value, { clearTerminalInput: true });
}

async function confirmScratchpadSend() {
  const review = state.projectDesk.review;
  if (!review || state.projectDesk.sending) return;
  if (!projectDeskCapabilityAvailable()) {
    setNotice('Prompt not sent: restart PaneFleet to enable durable exact-target validation.', 'error');
    clearScratchpadReview();
    updateProjectComposerState();
    return;
  }
  const item = state.terminalWindows.get(review.terminalId);
  const currentTarget = projectDeskTargetForTerminal(item);
  if (!item || !sameExactTarget(review, currentTarget)) {
    setNotice('Prompt not sent: the reviewed tmux pane identity changed. Review the target again.', 'error');
    clearScratchpadReview();
    syncProjectDesk();
    return;
  }
  state.projectDesk.sending = true;
  updateProjectComposerState();
  try {
    await sendTerminalTextValue(item, review.text, {
      expectedTarget: review,
      onSent: () => {
        if (els.scratchpadText.value === review.text) {
          els.scratchpadText.value = '';
          safeStorageSet(scratchpadDraftKey(review), '');
        }
        clearScratchpadReview();
      }
    });
  } finally {
    state.projectDesk.sending = false;
    updateProjectComposerState();
  }
}

function requestPromptSubmit(item) {
  if (!item || item.sendInFlight || item.uiKeyInFlight || item.pickerActive) return;
  const now = Date.now();
  if (now - item.promptSubmitRequestedAt < 250) return;
  item.promptSubmitRequestedAt = now;
  window.setTimeout(() => item.sendForm.requestSubmit(), 0);
}

function shouldSubmitOnLineBreak(item) {
  return Date.now() > item.allowLineBreakUntil;
}

function handleTerminalTextInput(event, item) {
  if (item.sendText.value) item.sendUndoText = '';
  persistTerminalDraft(item);
  updateSendInputState(item);
  if (event.isComposing || event.inputType !== 'insertLineBreak' || !shouldSubmitOnLineBreak(item)) return;
  const withoutTrailingBreak = item.sendText.value.replace(/[\r\n]+$/g, '');
  if (withoutTrailingBreak !== item.sendText.value) {
    item.sendText.value = withoutTrailingBreak;
    updateSendInputState(item);
  }
  requestPromptSubmit(item);
}

document.addEventListener('pointerdown', (event) => {
  const item = terminalItemFromTarget(event.target);
  if (!item) return;
  focusTerminalWindow(item);
  const resizeHandle = event.target.closest('[data-terminal-resize]');
  if (resizeHandle) {
    beginTerminalPointerInteraction(event, item, resizeHandle.dataset.terminalResize);
    return;
  }
  const dragHandle = event.target.closest('[data-terminal-drag]');
  if (dragHandle && !event.target.closest('button, input, textarea, select, a')) {
    beginTerminalPointerInteraction(event, item);
  }
});

document.addEventListener('selectionchange', () => {
  if (!state.selectionDeferredDomUpdates.size || activePageTextSelection() || state.selectionResumeFrame) return;
  state.selectionResumeFrame = window.requestAnimationFrame(() => {
    state.selectionResumeFrame = null;
    if (!state.selectionDeferredDomUpdates.size || activePageTextSelection()) return;
    const updates = [...state.selectionDeferredDomUpdates.values()];
    state.selectionDeferredDomUpdates.clear();
    for (const update of updates) update();
  });
});

document.addEventListener('dblclick', (event) => {
  const dragHandle = event.target.closest('[data-terminal-drag]');
  if (!dragHandle || event.target.closest('button')) return;
  toggleTerminalMaximize(terminalItemFromTarget(dragHandle));
});

document.addEventListener('keydown', (event) => {
  if (handleShortcutHelpKeydown(event)) return;
  if (handleDrawerKeydown(event)) return;
  if (event.target === els.sessionSearch && handleSessionSearchKeydown(event)) return;
  if (handleSessionResultKeydown(event)) return;
  if (handleTerminalTabKeydown(event)) return;
  if (handleTerminalModalKeydown(event)) return;
  if (event.target?.classList?.contains('terminal-find-input')) {
    const item = terminalItemFromTarget(event.target);
    if (String(event.key || '').toLowerCase() === 'f' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      event.target.select();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTerminalFindOpen(item, false);
    } else if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      stepTerminalFind(item, event.shiftKey ? -1 : 1);
    }
    return;
  }
  const openLauncher = document.querySelector('.new-agent-panel[open]');
  if (openLauncher && handleNewAgentLauncherKeydown(event, openLauncher)) return;
  if (event.target?.matches?.('#prompt-queue-form textarea[name="text"]') && isPromptQueueSubmitShortcut(event)) {
    event.preventDefault();
    const form = event.target.closest('#prompt-queue-form');
    readPromptQueueDraft(form);
    const queueButton = form.querySelector('button[type="submit"][value="queue"]');
    if (!queueButton?.disabled) form.requestSubmit(queueButton);
    return;
  }
  const editableTarget = Boolean(event.target?.closest?.('input, textarea, select, [contenteditable="true"]'));
  if (isTerminalFindShortcut(event, editableTarget)) {
    const findTerminal = state.terminalWindows.get(state.activeTerminalId);
    if (findTerminal && !findTerminal.minimized) {
      event.preventDefault();
      setTerminalFindOpen(findTerminal, true);
      return;
    }
  }
  const shortcut = dashboardShortcut(event, editableTarget);
  if (shortcut) {
    event.preventDefault();
    if (shortcut === 'search') {
      switchView('agents');
      window.requestAnimationFrame(() => {
        els.sessionSearch.focus({ preventScroll: true });
        els.sessionSearch.select();
      });
    } else if (shortcut === 'tools') {
      openToolView(state.activeToolView);
    } else if (shortcut === 'new-agent') {
      openNewAgentLauncher();
    } else if (shortcut === 'shortcuts') {
      openShortcutHelp(document.activeElement);
    } else if (shortcut === 'terminal-previous' || shortcut === 'terminal-next') {
      cycleActiveTerminal(shortcut === 'terminal-previous' ? -1 : 1);
    } else if (shortcut === 'workspace-focus') {
      switchView('agents');
      setWorkspaceFocus();
    } else {
      switchView(shortcut, { focusTab: true });
    }
    return;
  }
  const activeTerminal = state.terminalWindows.get(state.activeTerminalId);
  if (
    activeTerminal?.pickerActive
    && activeTerminal.element.contains(event.target)
    && TERMINAL_PICKER_KEY_MAP.has(event.key)
    && !event.isComposing
    && event.keyCode !== 229
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
  ) {
    event.preventDefault();
    sendTerminalUiKey(activeTerminal, TERMINAL_PICKER_KEY_MAP.get(event.key));
    return;
  }

  if (!event.target?.classList?.contains('terminal-send-text') || event.key !== 'Enter') return;
  const item = terminalItemFromTarget(event.target);
  if (!item) return;
  if (event.isComposing || event.keyCode === 229) return;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    item.allowLineBreakUntil = Date.now() + 500;
    return;
  }
  event.preventDefault();
  requestPromptSubmit(item);
});

document.addEventListener('beforeinput', (event) => {
  if (!event.target?.classList?.contains('terminal-send-text') || event.isComposing) return;
  const item = terminalItemFromTarget(event.target);
  if (!item || event.inputType !== 'insertLineBreak' || !shouldSubmitOnLineBreak(item)) return;
  event.preventDefault();
  requestPromptSubmit(item);
});

loadSnapshot('startup');
connectEvents();
loadOptions();
