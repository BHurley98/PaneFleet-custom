/* PaneFleet provider usage dashboard: every number is provider-reported. */
(() => {
  'use strict';
  let snapshot = null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const formatNumber = (value) => new Intl.NumberFormat().format(Math.max(0, Number(value) || 0));
  const windows = [
    { id: 'weekly', label: 'Weekly limit', minutes: 7 * 24 * 60 },
    { id: 'fiveHour', label: 'Five-hour limit', minutes: 5 * 60 },
    { id: 'daily', label: 'Daily limit', minutes: 24 * 60 },
    { id: 'hourly', label: 'Hourly limit', minutes: 60 }
  ];

  function providerCapability(provider) {
    return snapshot?.capabilities?.providerTelemetry?.[provider] || {
      quotaWindows: {}, accountFields: {}, tokenCounters: {}, refresh: {}, staleAfterMinutes: 15
    };
  }

  function remainingWindow(value) {
    if (!value || !Number.isFinite(Number(value.remainingPercent))) return null;
    return { remainingPercent: Math.max(0, Math.min(100, Number(value.remainingPercent))), refreshesIn: String(value.refreshesIn || '') };
  }

  function codexWindows() {
    const result = Object.fromEntries(windows.map((item) => [item.id, null]));
    const pools = Array.isArray(snapshot?.codexUsage?.pools) ? snapshot.codexUsage.pools : [];
    for (const pool of pools) {
      for (const limit of [pool?.account?.primary, pool?.account?.secondary]) {
        if (!limit || !Number.isFinite(Number(limit.windowMinutes))) continue;
        const minutes = Number(limit.windowMinutes);
        const target = windows.reduce((best, candidate) => Math.abs(candidate.minutes - minutes) < Math.abs(best.minutes - minutes) ? candidate : best, windows[0]);
        const entry = { remainingPercent: 100 - Number(limit.usedPercent || 0), refreshesIn: limit.resetsAt ? new Date(limit.resetsAt).toLocaleString() : '' };
        if (!result[target.id] || minutes === target.minutes) result[target.id] = remainingWindow(entry);
      }
    }
    return result;
  }

  function antigravityWindows() {
    const usage = snapshot?.antigravityUsage || null;
    return { weekly: remainingWindow(usage?.weekly), fiveHour: remainingWindow(usage?.fiveHour), daily: null, hourly: null };
  }

  function tokenSummary(provider) {
    const agents = (snapshot?.agents || []).filter((agent) => provider === 'antigravity' ? agent.provider === 'antigravity' : agent.provider !== 'antigravity');
    const values = agents.reduce((total, agent) => {
      const tokens = agent.codexTelemetry?.sessionTokens || {};
      total.input += Number(tokens.inputTokens) || 0;
      total.cached += Number(tokens.cachedInputTokens) || 0;
      total.output += Number(tokens.outputTokens) || 0;
      total.reasoning += Number(tokens.reasoningOutputTokens) || 0;
      return total;
    }, { input: 0, cached: 0, output: 0, reasoning: 0 });
    return { agents, values };
  }

  function windowCard(provider, item, value, supported) {
    const reported = Boolean(value);
    const fillClass = provider === 'codex' ? 'codex-weekly' : 'gemini-weekly';
    const state = !supported ? 'unsupported' : reported ? 'reported' : 'waiting';
    const detail = !supported
      ? 'This provider does not expose this window.'
      : 'This provider supports this window but has not reported it yet.';
    return `<section class="rate-limit-section ${reported ? '' : 'is-unreported'}" data-telemetry-state="${state}"><div class="rate-limit-head"><span>${item.label}</span><strong>${reported ? `${Math.round(value.remainingPercent)}% left` : !supported ? 'Unsupported' : 'Awaiting report'}</strong></div>${reported ? `<div class="rate-limit-track"><div class="rate-limit-fill ${fillClass}" style="width:${value.remainingPercent}%"></div></div><div class="rate-limit-foot"><span>Provider report</span><span>${escapeHtml(value.refreshesIn || 'Reset not reported')}</span></div>` : `<div class="rate-limit-foot"><span>${detail}</span></div>`}</section>`;
  }

  function tokenMetric(label, value, supported, detail = '') {
    return `<div class="metric-box" data-telemetry-state="${supported ? 'reported' : 'unsupported'}"><span>${label}</span><strong>${supported ? formatNumber(value) : 'Unsupported'}</strong><small class="metric-sub">${supported ? detail : 'Not exposed by this provider'}</small></div>`;
  }

  function freshnessLabel(observedAt, capability) {
    const timestamp = Date.parse(observedAt || '');
    if (!Number.isFinite(timestamp)) return 'Waiting for a provider report';
    const stale = Date.now() - timestamp > Number(capability.staleAfterMinutes || 15) * 60_000;
    return `${stale ? 'Stale · ' : ''}Last reported ${new Date(timestamp).toLocaleString()}`;
  }

  function usageHistory() {
    return (snapshot?.providerUsageHistory?.entries || []).slice(-8).reverse().map((entry) => {
      const provider = entry.provider === 'antigravity' ? 'Google Antigravity' : 'OpenAI Codex';
      const timestamp = Number.isFinite(Date.parse(entry.observedAt || '')) ? new Date(entry.observedAt).toLocaleString() : 'Time unavailable';
      const detail = entry.outcome === 'failed'
        ? `Refresh failed: ${entry.reason || 'provider did not return usage'}`
        : 'Quota snapshot captured; no terminal transcript retained.';
      return `<tr><td>${escapeHtml(timestamp)}</td><td>${escapeHtml(provider)}</td><td>${escapeHtml(entry.outcome)}</td><td>${escapeHtml(detail)}</td></tr>`;
    }).join('') || '<tr><td colspan="4">No provider quota snapshots have been recorded yet.</td></tr>';
  }

  function providerCard(provider) {
    const isCodex = provider === 'codex';
    const capability = providerCapability(provider);
    const summary = tokenSummary(provider);
    const limitWindows = isCodex ? codexWindows() : antigravityWindows();
    const model = summary.agents.find((agent) => agent.codexTelemetry?.model || agent.model)?.codexTelemetry?.model || summary.agents.find((agent) => agent.model)?.model || 'Model not reported';
    const observedAt = isCodex ? snapshot?.codexUsage?.observedAt : snapshot?.antigravityUsage?.observedAt;
    const refresh = !isCodex && summary.agents.find((agent) => agent.agentStatus?.state === 'idle');
    const cacheRate = summary.values.input ? `${((summary.values.cached / summary.values.input) * 100).toFixed(1)}% cache rate` : 'No session tokens reported';
    const title = capability.label || (isCodex ? 'OpenAI Codex' : 'Google Antigravity');
    return `<article class="provider-telemetry-card ${isCodex ? 'codex-card' : 'gemini-card'}"><header class="provider-card-header"><div class="provider-title-group"><span class="provider-pill ${isCodex ? 'codex' : 'gemini'}">${escapeHtml(title)}</span><h3>${escapeHtml(model)}</h3><p class="provider-meta-sub">${escapeHtml(freshnessLabel(observedAt, capability))}</p></div>${refresh ? `<button class="action-button" data-refresh-antigravity="${escapeHtml(refresh.session)}" type="button">Refresh usage</button>` : ''}</header><div class="usage-limit-grid">${windows.map((item) => windowCard(provider, item, limitWindows[item.id], capability.quotaWindows?.[item.id] === true)).join('')}</div><div class="token-metrics-grid">${tokenMetric('Input', summary.values.input, capability.tokenCounters?.input === true, 'Observed session total')}${tokenMetric('Cached input', summary.values.cached, capability.tokenCounters?.cachedInput === true, cacheRate)}${tokenMetric('Output', summary.values.output, capability.tokenCounters?.output === true, 'Observed session total')}${tokenMetric('Reasoning', summary.values.reasoning, capability.tokenCounters?.reasoning === true, 'Observed session total')}</div><p class="provider-note">Refresh: ${escapeHtml(capability.refresh?.mode || 'not reported')}. Quota windows are account-wide; token counters are session-scoped.</p></article>`;
  }

  function render() {
    const view = document.querySelector('#usage-workspace-view');
    if (!view || view.hidden) return;
    const codex = tokenSummary('codex');
    const antigravity = tokenSummary('antigravity');
    view.innerHTML = `<div class="usage-workspace-layout"><div class="usage-hero-strip"><div class="usage-hero-card"><span class="usage-hero-label">Provider accounts</span><strong class="usage-hero-val">2</strong><small class="usage-hero-sub">Codex and Antigravity</small></div><div class="usage-hero-card"><span class="usage-hero-label">Active sessions</span><strong class="usage-hero-val">${codex.agents.length + antigravity.agents.length}</strong><small class="usage-hero-sub">${codex.agents.length} Codex · ${antigravity.agents.length} Antigravity</small></div><div class="usage-hero-card"><span class="usage-hero-label">Usage refresh</span><strong class="usage-hero-val">Manual</strong><small class="usage-hero-sub">No quota panel is opened automatically</small></div></div><div class="usage-providers-grid">${providerCard('codex')}${providerCard('antigravity')}</div><div class="usage-history-card"><div class="history-card-header"><h3>Recent provider quota history</h3><button id="refresh-telemetry-btn" class="action-button" type="button">Refresh dashboard</button></div><div class="history-table-wrap"><table class="usage-table"><thead><tr><th>Observed</th><th>Provider</th><th>Outcome</th><th>Detail</th></tr></thead><tbody>${usageHistory()}</tbody></table></div><p class="provider-note">History is bounded to 120 provider quota records. It stores timestamps, normalized limits, and fixed refresh outcomes only—never prompts, responses, or terminal output.</p></div></div>`;
    view.querySelector('#refresh-telemetry-btn')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('panefleet:refresh-snapshot')));
    view.querySelector('[data-refresh-antigravity]')?.addEventListener('click', (event) => window.dispatchEvent(new CustomEvent('panefleet:refresh-antigravity-usage', { detail: { session: event.currentTarget.dataset.refreshAntigravity } })));
  }

  for (const name of ['panefleet:view-change', 'panefleet:snapshot', 'panefleet:refresh-complete']) window.addEventListener(name, (event) => { snapshot = event.detail?.snapshot || snapshot; render(); });
})();
