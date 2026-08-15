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

  function windowCard(provider, item, value) {
    const reported = Boolean(value);
    const fillClass = provider === 'codex' ? 'codex-weekly' : 'gemini-weekly';
    return `<section class="rate-limit-section ${reported ? '' : 'is-unreported'}"><div class="rate-limit-head"><span>${item.label}</span><strong>${reported ? `${Math.round(value.remainingPercent)}% left` : 'Not reported'}</strong></div>${reported ? `<div class="rate-limit-track"><div class="rate-limit-fill ${fillClass}" style="width:${value.remainingPercent}%"></div></div><div class="rate-limit-foot"><span>Provider report</span><span>${escapeHtml(value.refreshesIn || 'Reset not reported')}</span></div>` : '<div class="rate-limit-foot"><span>This provider has not reported this window.</span></div>'}</section>`;
  }

  function providerCard(provider) {
    const isCodex = provider === 'codex';
    const summary = tokenSummary(provider);
    const limitWindows = isCodex ? codexWindows() : antigravityWindows();
    const model = summary.agents.find((agent) => agent.codexTelemetry?.model || agent.model)?.codexTelemetry?.model || summary.agents.find((agent) => agent.model)?.model || 'Model not reported';
    const observedAt = isCodex ? snapshot?.codexUsage?.observedAt : snapshot?.antigravityUsage?.observedAt;
    const refresh = !isCodex && summary.agents.find((agent) => agent.agentStatus?.state === 'idle');
    const cacheRate = summary.values.input ? `${((summary.values.cached / summary.values.input) * 100).toFixed(1)}%` : 'Not reported';
    return `<article class="provider-telemetry-card ${isCodex ? 'codex-card' : 'gemini-card'}"><header class="provider-card-header"><div class="provider-title-group"><span class="provider-pill ${isCodex ? 'codex' : 'gemini'}">${isCodex ? 'OpenAI Codex' : 'Google Antigravity'}</span><h3>${escapeHtml(model)}</h3><p class="provider-meta-sub">${observedAt ? `Last reported ${escapeHtml(new Date(observedAt).toLocaleString())}` : 'Waiting for a provider report'}</p></div>${refresh ? `<button class="action-button" data-refresh-antigravity="${escapeHtml(refresh.session)}" type="button">Refresh usage</button>` : ''}</header><div class="usage-limit-grid">${windows.map((item) => windowCard(provider, item, limitWindows[item.id])).join('')}</div><div class="token-metrics-grid"><div class="metric-box"><span>Input</span><strong>${formatNumber(summary.values.input)}</strong></div><div class="metric-box"><span>Cached input</span><strong>${formatNumber(summary.values.cached)}</strong><small class="metric-sub">${cacheRate} cache rate</small></div><div class="metric-box"><span>Output</span><strong>${formatNumber(summary.values.output)}</strong></div><div class="metric-box"><span>Reasoning</span><strong>${formatNumber(summary.values.reasoning)}</strong></div></div><p class="provider-note">Session-token counters are currently reported by Codex only. Quota windows are account-wide and provider-reported.</p></article>`;
  }

  function render() {
    const view = document.querySelector('#usage-workspace-view');
    if (!view || view.hidden) return;
    const codex = tokenSummary('codex');
    const antigravity = tokenSummary('antigravity');
    view.innerHTML = `<div class="usage-workspace-layout"><div class="usage-hero-strip"><div class="usage-hero-card"><span class="usage-hero-label">Provider accounts</span><strong class="usage-hero-val">2</strong><small class="usage-hero-sub">Codex and Antigravity</small></div><div class="usage-hero-card"><span class="usage-hero-label">Active sessions</span><strong class="usage-hero-val">${codex.agents.length + antigravity.agents.length}</strong><small class="usage-hero-sub">${codex.agents.length} Codex · ${antigravity.agents.length} Antigravity</small></div><div class="usage-hero-card"><span class="usage-hero-label">Usage refresh</span><strong class="usage-hero-val">Manual</strong><small class="usage-hero-sub">No quota panel is opened automatically</small></div></div><div class="usage-providers-grid">${providerCard('codex')}${providerCard('antigravity')}</div><div class="usage-history-card"><div class="history-card-header"><h3>How these limits work</h3><button id="refresh-telemetry-btn" class="action-button" type="button">Refresh dashboard</button></div><p class="provider-note">Both providers use the identical window layout. A blank window means the provider did not expose that limit, not that PaneFleet guessed a value. Codex limits update passively from its session telemetry. Antigravity refresh is manual and only offered for an idle Antigravity session; it opens the provider’s <code>/usage</code> panel, captures the report, and closes it.</p></div></div>`;
    view.querySelector('#refresh-telemetry-btn')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('panefleet:refresh-snapshot')));
    view.querySelector('[data-refresh-antigravity]')?.addEventListener('click', (event) => window.dispatchEvent(new CustomEvent('panefleet:refresh-antigravity-usage', { detail: { session: event.currentTarget.dataset.refreshAntigravity } })));
  }

  for (const name of ['panefleet:view-change', 'panefleet:snapshot', 'panefleet:refresh-complete']) window.addEventListener(name, (event) => { snapshot = event.detail?.snapshot || snapshot; render(); });
})();
