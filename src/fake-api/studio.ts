/**
 * The scenario studio: the page inside the fake API drawer, also reachable on
 * its own at the studio path.
 *
 * Three things on one page, in the order they are used:
 *
 * 1. **Scenarios**: pick the state the whole app is in, or the real API.
 * 2. **Endpoints**: override one procedure without changing the rest (take
 *    it from another scenario, make it slow, make it fail), which is how
 *    states that no single scenario describes get tested.
 * 3. **Recent calls**: what the page actually asked for and what answered,
 *    so a missing fixture or a surprise override is visible at once.
 *
 * Plain HTML, CSS and a small script with no dependencies. Every change
 * tells the page around it to reload, so the app refetches against the new
 * state immediately.
 */

export interface StudioOptions {
  basePath: string
  title: string
  accentColor: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

export function studioPage({ basePath, title, accentColor }: StudioOptions): string {
  const accent = escapeHtml(accentColor)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} fake API</title>
<style>
  :root {
    --accent: ${accent};
    --bg: #f6f7f9; --panel: #ffffff; --text: #0f172a; --muted: #64748b; --line: #e2e8f0;
    --soft: color-mix(in srgb, var(--accent) 10%, var(--panel));
    --ok: #15803d; --bad: #b91c1c;
    color-scheme: light dark;
    font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0b1220; --panel: #111a2b; --text: #e2e8f0; --muted: #94a3b8; --line: #1f2a3d; --ok: #4ade80; --bad: #f87171; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--text); background: var(--bg); }
  body.embedded { background: transparent; }
  main { max-width: 820px; margin: 0 auto; padding: 22px 20px 60px; }
  .eyebrow { margin: 0 0 4px; color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  h1 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
  body.embedded .page-heading { display: none; }
  .status { margin: 8px 0 0; color: var(--muted); }
  .status strong { color: var(--text); }
  section { margin-top: 26px; }
  h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 10px; font-size: 13px; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
  h2 button { text-transform: none; letter-spacing: 0; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
  .card {
    position: relative; display: flex; flex-direction: column; gap: 4px; min-height: 84px;
    padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px;
    color: inherit; background: var(--panel); text-align: left; font: inherit; cursor: pointer;
    transition: border-color .15s, transform .15s, box-shadow .15s;
  }
  .card:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); transform: translateY(-1px); }
  .card:focus-visible, select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .card[aria-pressed="true"] { border-color: var(--accent); background: var(--soft); box-shadow: inset 3px 0 var(--accent); }
  .card .name { font-weight: 650; }
  .card .desc { color: var(--muted); font-size: 12.5px; }
  .card .tick { position: absolute; top: 10px; right: 12px; color: var(--accent); font-weight: 700; opacity: 0; }
  .card[aria-pressed="true"] .tick { opacity: 1; }
  .card.real .name::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 7px; border-radius: 50%; background: var(--ok); vertical-align: middle; }
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
  .search { flex: 1 1 220px; min-width: 0; padding: 8px 11px; border: 1px solid var(--line); border-radius: 9px; color: inherit; background: var(--panel); font: inherit; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { padding: 5px 10px; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: var(--panel); font: 500 12px/1.2 inherit; cursor: pointer; }
  .chip[aria-pressed="true"] { color: var(--accent); border-color: var(--accent); background: var(--soft); }
  .list { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--panel); }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 12px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); }
  .row:first-child { border-top: 0; }
  .row.overridden { background: var(--soft); }
  .path { overflow: hidden; font: 12.5px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .meta { margin-top: 2px; color: var(--muted); font-size: 11.5px; }
  .meta .dot { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: var(--accent); vertical-align: middle; }
  select { width: 100%; padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; color: inherit; background: var(--panel); font: inherit; font-size: 12.5px; }
  .row.overridden select { border-color: var(--accent); }
  .link { padding: 0; border: 0; color: var(--accent); background: none; font: 600 12px/1 inherit; cursor: pointer; }
  .empty { padding: 22px; color: var(--muted); text-align: center; }
  .calls { font-size: 12.5px; }
  .call { display: grid; grid-template-columns: 64px 44px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 14px; border-top: 1px solid var(--line); }
  .call:first-child { border-top: 0; }
  .call .time, .call .method { color: var(--muted); font-variant-numeric: tabular-nums; }
  .call .served { color: var(--muted); white-space: nowrap; }
  .call.bad .served { color: var(--bad); }
  .call.ok .served::before { content: "\\2713  "; color: var(--ok); }
  .call.bad .served::before { content: "\\2717  "; }
  #toast { position: fixed; left: 50%; bottom: 18px; z-index: 5; padding: 9px 13px; border-radius: 9px; color: #fff; background: #0f172a; font-size: 12.5px; opacity: 0; transform: translate(-50%, 6px); transition: opacity .15s, transform .15s; pointer-events: none; }
  #toast.visible { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 560px) { .row { grid-template-columns: 1fr; } .call { grid-template-columns: 56px minmax(0, 1fr) auto; } .call .method { display: none; } }
</style>
</head>
<body>
<main>
  <div class="page-heading">
    <p class="eyebrow">${escapeHtml(title)} · development</p>
    <h1>Fake API</h1>
  </div>
  <p class="status" id="status">Loading…</p>

  <section aria-labelledby="scenarios-heading">
    <h2 id="scenarios-heading">Scenario</h2>
    <div class="cards" id="scenarios"></div>
  </section>

  <section aria-labelledby="endpoints-heading">
    <h2 id="endpoints-heading"><span>Endpoints</span><button class="link" id="reset" type="button" hidden>Reset all overrides</button></h2>
    <div class="toolbar">
      <input class="search" id="search" type="search" placeholder="Find an endpoint…" autocomplete="off">
      <div class="chips" id="groups"></div>
    </div>
    <div class="list" id="endpoints"></div>
  </section>

  <section aria-labelledby="calls-heading">
    <h2 id="calls-heading">Recent calls</h2>
    <div class="list calls" id="calls"></div>
  </section>
</main>
<p id="toast" role="status"></p>
<script type="module">
  const base = ${JSON.stringify(basePath)};
  const embedded = new URLSearchParams(location.search).has('embedded');
  if (embedded) document.body.classList.add('embedded');
  const $ = (id) => document.getElementById(id);
  let state = null;
  let group = 'all';

  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const ago = (iso) => {
    if (!iso) return '';
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    return Math.round(seconds / 3600) + 'h ago';
  };
  const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let toastTimer;
  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
  }

  async function call(method, path, body) {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The fake API refused that change.');
    return result;
  }

  function changed(message) {
    toast(message);
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'olwiba:fake-api-changed' }, location.origin);
    }
  }

  async function load() {
    state = await call('GET', '/state');
    render();
  }

  function render() {
    const active = state.presets.find((p) => p.id === state.active);
    $('status').innerHTML = active
      ? 'This browser is seeing <strong>' + esc(active.label) + '</strong>' + (state.enabled ? '' : ' (chosen with <code>?fake=</code>)') + '.'
      : 'This browser is using the <strong>real API</strong>.';
    renderScenarios();
    renderEndpoints();
    renderCalls();
  }

  function renderScenarios() {
    const cards = state.presets.map((p) =>
      '<button class="card" type="button" data-preset="' + esc(p.id) + '" aria-pressed="' + (p.id === state.active) + '">'
      + '<span class="tick" aria-hidden="true">\\u2713</span><span class="name">' + esc(p.label) + '</span>'
      + (p.description ? '<span class="desc">' + esc(p.description) + '</span>' : '') + '</button>');
    cards.push('<button class="card real" type="button" data-preset="" aria-pressed="' + (state.active === null) + '">'
      + '<span class="tick" aria-hidden="true">\\u2713</span><span class="name">Real API</span>'
      + '<span class="desc">Your database and your account. Nothing faked.</span></button>');
    $('scenarios').innerHTML = cards.join('');
    for (const card of $('scenarios').querySelectorAll('.card')) {
      card.addEventListener('click', async () => {
        const preset = card.dataset.preset || null;
        if ((preset ?? null) === state.active) return;
        state = await call('PUT', '/preset', { preset });
        render();
        const label = state.presets.find((p) => p.id === preset)?.label;
        changed(label ? 'Switched to ' + label + '.' : 'Back on the real API.');
      });
    }
  }

  function renderEndpoints() {
    const query = $('search').value.trim().toLowerCase();
    const groups = [...new Set(state.procedures.map((p) => p.group))].sort();
    $('groups').innerHTML = ['all', ...groups].map((g) =>
      '<button class="chip" type="button" data-group="' + esc(g) + '" aria-pressed="' + (g === group) + '">' + (g === 'all' ? 'All' : esc(g)) + '</button>').join('');
    for (const chip of $('groups').querySelectorAll('.chip')) {
      chip.addEventListener('click', () => { group = chip.dataset.group; renderEndpoints(); });
    }

    const visible = state.procedures.filter((p) =>
      (group === 'all' || p.group === group) && (!query || p.path.toLowerCase().includes(query)));
    $('reset').hidden = !state.procedures.some((p) => p.override);

    if (visible.length === 0) {
      $('endpoints').innerHTML = '<div class="empty">No endpoints match.</div>';
      return;
    }
    $('endpoints').innerHTML = visible.map((p) => {
      const activeHas = state.active && p.definedIn.includes(state.active);
      const options = ['<option value="">' + (state.active ? (activeHas ? 'Scenario default' : 'Scenario default (no fixture)') : 'Scenario default') + '</option>']
        .concat(p.variants.map((v) => '<option value="' + esc(v.id) + '"' + (p.override === v.id ? ' selected' : '') + '>' + esc(v.label) + '</option>'));
      const meta = [];
      if (p.lastCalledAt) meta.push('<span class="dot"></span>called ' + ago(p.lastCalledAt));
      if (!activeHas && state.active) meta.push('not in this scenario');
      return '<div class="row' + (p.override ? ' overridden' : '') + '"><div style="min-width:0"><div class="path" title="' + esc(p.path) + '">' + esc(p.path) + '</div>'
        + (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') + '</div>'
        + '<select data-path="' + esc(p.path) + '" aria-label="Answer for ' + esc(p.path) + '">' + options.join('') + '</select></div>';
    }).join('');
    for (const select of $('endpoints').querySelectorAll('select')) {
      select.addEventListener('change', async () => {
        const path = select.dataset.path;
        state = await call('PUT', '/overrides', { path, variant: select.value || null });
        render();
        changed(select.value ? path + ' overridden.' : path + ' back to the scenario.');
      });
    }
  }

  function renderCalls() {
    if (state.activity.length === 0) {
      $('calls').innerHTML = '<div class="empty">Nothing yet. Use the app and its requests appear here.</div>';
      return;
    }
    $('calls').innerHTML = state.activity.slice(0, 25).map((c) =>
      '<div class="call ' + (c.ok ? 'ok' : 'bad') + '"><span class="time">' + clock(c.at) + '</span><span class="method">' + esc(c.method) + '</span>'
      + '<span class="path">' + esc(c.path) + '</span><span class="served">' + esc(c.servedBy) + '</span></div>').join('');
  }

  $('search').addEventListener('input', renderEndpoints);
  $('reset').addEventListener('click', async () => {
    state = await call('DELETE', '/overrides');
    render();
    changed('All overrides cleared.');
  });
  addEventListener('unhandledrejection', (event) => toast(event.reason?.message || String(event.reason)));

  await load();
  // Recent calls change as the app is used; keep them current while visible.
  setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    const next = await call('GET', '/state');
    state = { ...state, activity: next.activity, procedures: next.procedures };
    renderCalls();
  }, 3000);
</script>
</body>
</html>`
}
