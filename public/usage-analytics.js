/* PaneFleet Usage view. Data is supplied by the dashboard's native snapshot route. */
(() => {
  'use strict';

  let snapshot = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const formatNumber = (value) => new Intl.NumberFormat().format(Math.max(0, Number(value) || 0));
  const percentage = (value) => Number.isFinite(Number(value)) ? `${Math.max(0, Math.min(100, Number(value))).toFixed(0)}% remaining` : 'Not reported';

  function cachedAntigravityUsage() {
    try { return JSON.parse(window.localStorage.getItem('panefleet:antigravity-usage') || '{}'); } catch { return {}; }
  }

  function codexSummary(agents) {
    const samples = agents.map((agent) => agent.codexTelemetry).filter(Boolean);
    const tokens = samples.reduce((total, telemetry) => {
      const current = telemetry.sessionTokens || {};
      total.input += Number(current.inputTokens) || 0;
      total.cached += Number(current.cachedInputTokens) || 0;
      total.output += Number(current.outputTokens) || 0;
      total.reasoning += Number(current.reasoningOutputTokens) || 0;
      return total;
    }, { input: 0, cached: 0, output: 0, reasoning: 0 });
    const account = samples.find((telemetry) => telemetry.account?.primary || telemetry.account?.secondary)?.account || null;
    return { tokens, account, model: samples.find((telemetry) => telemetry.model)?.model || 'Model not reported', observed: samples.length };
  }

  function providerCard({ kind, title, model, tokens, account, observed, usage }) {
    const primary = account?.primary || account?.secondary || null;
    const weekly = usage?.weekly || (primary?.windowMinutes >= 10080 ? { remainingPercent: 100 - Number(primary.usedPercent || 0), refreshesIn: primary.resetsAt ? new Date(primary.resetsAt).toLocaleString() : '' } : null);
    const burst = usage?.fiveHour || (primary?.windowMinutes && primary.windowMinutes < 10080 ? { remainingPercent: 100 - Number(primary.usedPercent || 0), refreshesIn: primary.resetsAt ? new Date(primary.resetsAt).toLocaleString() : '' } : null);
    const total = tokens.input + tokens.output;
    const cacheRate = tokens.input > 0 ? ((tokens.cached / tokens.input) * 100).toFixed(1) : 'Not reported';
    const source = observed ? `${observed} observed session${observed === 1 ? '' : 's'}` : 'No passive telemetry reported yet';
    const usageRow = (label, entry) => entry ? `
      <div class="rate-limit-section"><div class="rate-limit-head"><span>${label}</span><strong>${percentage(entry.remainingPercent)}</strong></div>
      <div class="rate-limit-track"><div class="rate-limit-fill ${kind === 'codex' ? 'codex-weekly' : 'gemini-weekly'}" style="width:${Math.max(0, Math.min(100, Number(entry.remainingPercent) || 0))}%"></div></div>
      <div class="rate-limit-foot"><span>Last reported</span><span>${escapeHtml(entry.refreshesIn || 'Reset not reported')}</span></div></div>` : '';
    return `
      <article class="provider-telemetry-card ${kind === 'codex' ? 'codex-card' : 'gemini-card'}">
        <header class="provider-card-header"><div class="provider-title-group"><span class="provider-pill ${kind === 'codex' ? 'codex' : 'gemini'}">${kind === 'codex' ? 'OpenAI Codex' : 'Google Antigravity'}</span><h3>${escapeHtml(model)}</h3><p class="provider-meta-sub">${escapeHtml(source)}</p></div></header>
        ${usageRow('Account limit', weekly)}${usageRow('Short-window limit', burst)}
        <div class="token-metrics-grid"><div class="metric-box"><span>Input</span><strong>${formatNumber(tokens.input)}</strong></div><div class="metric-box"><span>Cached input</span><strong>${formatNumber(tokens.cached)}</strong><small class="metric-sub">${cacheRate === 'Not reported' ? cacheRate : `${cacheRate}% cache rate`}</small></div><div class="metric-box"><span>Output</span><strong>${formatNumber(tokens.output)}</strong></div><div class="metric-box"><span>Reasoning</span><strong>${formatNumber(tokens.reasoning)}</strong></div></div>
        <p class="provider-note">Processed tokens: ${formatNumber(total)}. These are observed session values, not inferred account consumption.</p>
      </article>`;
  }

  function render() {
    const view = document.querySelector('#usage-workspace-view');
    if (!view || view.hidden) return;
    const agents = Array.isArray(snapshot?.agents) ? snapshot.agents : [];
    const codexAgents = agents.filter((agent) => agent.provider !== 'antigravity');
    const antigravityAgents = agents.filter((agent) => agent.provider === 'antigravity');
    const codex = codexSummary(codexAgents);
    const antigravityUsage = cachedAntigravityUsage();
    const allTokens = codex.tokens.input + codex.tokens.output;
    view.innerHTML = `<div class="usage-workspace-layout">
      <div class="usage-hero-strip"><div class="usage-hero-card"><span class="usage-hero-label">Observed processed tokens</span><strong class="usage-hero-val">${formatNumber(allTokens)}</strong><small class="usage-hero-sub">Codex sessions with passive telemetry</small></div><div class="usage-hero-card"><span class="usage-hero-label">Provider sessions</span><strong class="usage-hero-val">${agents.length}</strong><small class="usage-hero-sub">${codexAgents.length} Codex · ${antigravityAgents.length} Antigravity</small></div><div class="usage-hero-card"><span class="usage-hero-label">Antigravity quota</span><strong class="usage-hero-val">${percentage(antigravityUsage.weekly?.remainingPercent)}</strong><small class="usage-hero-sub">Use Refresh usage in an Antigravity session to update</small></div></div>
      <div class="usage-providers-grid">${providerCard({ kind: 'codex', title: 'OpenAI Codex', model: codex.model, tokens: codex.tokens, account: codex.account, observed: codex.observed })}${providerCard({ kind: 'antigravity', title: 'Google Antigravity', model: antigravityAgents.find((agent) => agent.model)?.model || 'Model not reported', tokens: { input: 0, cached: 0, output: 0, reasoning: 0 }, observed: antigravityAgents.length, usage: antigravityUsage })}</div>
      <div class="usage-history-card"><div class="history-card-header"><h3>Telemetry scope</h3><button id="refresh-telemetry-btn" class="action-button" type="button">Refresh dashboard</button></div><p class="provider-note">PaneFleet only shows values reported by the provider or captured passively from the active session. Missing values remain “Not reported”; this page does not estimate usage, costs, resets, or token totals.</p></div>
    </div>`;
    view.querySelector('#refresh-telemetry-btn')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('panefleet:refresh-snapshot')));
  }

  window.addEventListener('panefleet:view-change', (event) => {
    snapshot = event.detail?.snapshot || snapshot;
    render();
  });
  window.addEventListener('panefleet:snapshot', (event) => {
    snapshot = event.detail?.snapshot || snapshot;
    render();
  });
  window.addEventListener('panefleet:refresh-complete', (event) => {
    snapshot = event.detail?.snapshot || snapshot;
    render();
  });
})();
