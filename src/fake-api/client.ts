/**
 * The fake API's browser side: the launcher, the drawer and the studio inside
 * it, as one self-contained script and stylesheet.
 *
 * Rendered into a shadow root on the app's own page rather than an iframe, so
 * that it can read the page it sits on. It takes the app's design tokens
 * (`--background`, `--primary`, `--radius`, ...) and font when the page has
 * them, follows the app's light or dark theme as it changes, and opens
 * without loading a second document. The shadow root keeps the app's CSS out
 * and its own CSS in. Apps without those tokens get a neutral palette that
 * follows the same theme.
 *
 * The standalone studio page (`/__fake-api`) mounts the same code without the
 * launcher and drawer.
 *
 * Kept as source strings because it runs in the browser and this package is
 * Node-only: no DOM types, nothing imported into an app bundle. No backticks
 * or template placeholders inside, so the strings stay literal.
 */

export const HOST_ID = "olwiba-fake-api"

export interface ClientConfig {
  base: string
  embedded: boolean
  title: string
  brand: string
  launcherBottom: number
}

/**
 * The script that mounts the client into the element with `HOST_ID`. The
 * config travels as base64 so nothing in it (a `</script>` in a title, say)
 * can end the inline script early.
 */
export function clientScript(config: ClientConfig): string {
  const encoded = Buffer.from(JSON.stringify({ ...config, hostId: HOST_ID, css: CLIENT_CSS })).toString("base64")
  return `<script type="module">${CLIENT_JS}
mountFakeApi(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob("${encoded}"), (c) => c.charCodeAt(0)))));</script>`
}

const CLIENT_CSS = String.raw`
:host { all: initial; }
:host {
  --fa-bg: #ffffff; --fa-fg: #0a0a0a; --fa-card: #ffffff; --fa-popover: #ffffff;
  --fa-muted: #f4f4f5; --fa-muted-fg: #71717a; --fa-border: #e4e4e7; --fa-hover: #f4f4f5;
  --fa-primary: var(--fa-brand); --fa-primary-fg: #ffffff;
  --fa-ok: #16a34a; --fa-warn: #d97706; --fa-bad: #dc2626; --fa-get: #2563eb; --fa-post: #9333ea;
  --fa-radius: 8px;
  --fa-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fa-mono: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, "Liberation Mono", monospace;
  --fa-shadow: 0 16px 48px -12px rgb(0 0 0 / .28), 0 6px 16px -8px rgb(0 0 0 / .16);
}
:host([data-theme="dark"]) {
  --fa-bg: #0a0a0a; --fa-fg: #fafafa; --fa-card: #111113; --fa-popover: #18181b;
  --fa-muted: #141416; --fa-muted-fg: #a1a1aa; --fa-border: #27272a; --fa-hover: #1f1f23;
  --fa-ok: #4ade80; --fa-warn: #fbbf24; --fa-bad: #f87171; --fa-get: #60a5fa; --fa-post: #c084fc;
  --fa-shadow: 0 16px 48px -12px rgb(0 0 0 / .7), 0 6px 16px -8px rgb(0 0 0 / .5);
}
@media print { :host { display: none !important; } }
*, *::before, *::after { box-sizing: border-box; }
.fa { color: var(--fa-fg); font: 400 14px/1.45 var(--fa-font); -webkit-font-smoothing: antialiased; }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--fa-primary); outline-offset: 2px; }
svg { display: block; }

.launcher {
  position: fixed; right: 0; bottom: var(--fa-launcher-bottom, 76px); z-index: 2147483000;
  display: flex; align-items: center; gap: 8px; height: 34px; max-width: 38px; padding: 0 12px 0 10px;
  overflow: hidden; border: 0; border-radius: 9px 0 0 9px; color: #fff; background: var(--fa-brand);
  box-shadow: 0 4px 14px rgb(0 0 0 / .22); font: 600 12.5px/1 var(--fa-font); white-space: nowrap; cursor: pointer;
  transition: max-width .22s cubic-bezier(.2, .8, .2, 1), box-shadow .15s;
}
.launcher:hover, .launcher:focus-visible { max-width: 120px; box-shadow: 0 6px 20px rgb(0 0 0 / .28); }
.launcher svg { width: 17px; height: 17px; flex: none; }
.launcher .text { opacity: 0; transition: opacity .15s; }
.launcher:hover .text, .launcher:focus-visible .text { opacity: 1; }

.drawer {
  position: fixed; inset: 0 0 0 auto; margin: 0; width: min(560px, 100vw); height: 100dvh;
  max-width: none; max-height: none; padding: 0; overflow: hidden;
  border: 0; border-left: 1px solid var(--fa-border); color: var(--fa-fg); background: var(--fa-bg);
  box-shadow: var(--fa-shadow); font: 400 14px/1.45 var(--fa-font);
}
.drawer[open] { display: flex; flex-direction: column; animation: fa-in .24s cubic-bezier(.2, .8, .2, 1); }
.drawer::backdrop { background: rgb(0 0 0 / .3); animation: fa-fade .2s ease-out; }
.drawer.instant[open], .drawer.instant::backdrop { animation: none; }
@keyframes fa-in { from { transform: translateX(100%); } to { transform: none; } }
@keyframes fa-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .drawer[open], .drawer::backdrop { animation: none; } }
.head {
  display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px;
  height: 56px; padding: 0 12px 0 20px; border-bottom: 1px solid var(--fa-border);
}
.head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
.head h2 svg { width: 18px; height: 18px; color: var(--fa-brand); }
.icon-btn {
  display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0;
  border-radius: var(--fa-radius); color: var(--fa-muted-fg); background: transparent; cursor: pointer;
}
.icon-btn:hover { color: var(--fa-fg); background: var(--fa-hover); }
.icon-btn svg { width: 16px; height: 16px; }
.body { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px 28px; }
section + section { margin-top: 22px; }
.label {
  display: flex; align-items: center; gap: 8px; margin: 0 0 8px; color: var(--fa-muted-fg);
  font-size: 11.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
}
.label .spacer { flex: 1; }
.error {
  margin: 0 0 14px; padding: 8px 10px; border: 1px solid color-mix(in oklab, var(--fa-bad) 40%, transparent);
  border-radius: var(--fa-radius); color: var(--fa-bad); background: color-mix(in oklab, var(--fa-bad) 8%, transparent); font-size: 12.5px;
}

.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.card {
  position: relative; display: flex; flex-direction: column; gap: 3px; min-height: 70px; padding: 10px 32px 10px 12px;
  border: 1px solid var(--fa-border); border-radius: calc(var(--fa-radius) + 2px); background: var(--fa-card);
  text-align: left; cursor: pointer; transition: border-color .15s, background-color .15s, box-shadow .15s;
}
.card:hover { border-color: color-mix(in oklab, var(--fa-primary) 45%, var(--fa-border)); }
.card[aria-pressed="true"] {
  border-color: var(--fa-primary); background: color-mix(in oklab, var(--fa-primary) 7%, var(--fa-card));
  box-shadow: 0 0 0 1px var(--fa-primary);
}
.card .name { font-size: 13.5px; font-weight: 600; }
.card .desc {
  display: -webkit-box; overflow: hidden; color: var(--fa-muted-fg); font-size: 12px; line-height: 1.4;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.card .check {
  position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 16px; height: 16px;
  border-radius: 50%; color: var(--fa-primary-fg); background: var(--fa-primary);
  opacity: 0; transform: scale(.6); transition: opacity .15s, transform .15s;
}
.card[aria-pressed="true"] .check { opacity: 1; transform: none; }
.card .check svg { width: 10px; height: 10px; }
.card.real .name::before {
  content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%;
  background: var(--fa-ok); vertical-align: 1px;
}
@media (max-width: 420px) { .cards { grid-template-columns: 1fr; } }

.customise { border: 1px solid var(--fa-border); border-radius: calc(var(--fa-radius) + 2px); background: var(--fa-card); }
.expander {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 11px 12px; border: 0; border-radius: inherit;
  background: transparent; font-size: 13.5px; font-weight: 600; text-align: left; cursor: pointer;
}
.expander:hover { background: var(--fa-hover); }
.expander .chev { width: 16px; height: 16px; color: var(--fa-muted-fg); transition: transform .18s; }
.expander[aria-expanded="true"] { border-radius: calc(var(--fa-radius) + 2px) calc(var(--fa-radius) + 2px) 0 0; }
.expander[aria-expanded="true"] .chev { transform: rotate(90deg); }
.expander .count { margin-left: auto; color: var(--fa-muted-fg); font-size: 12px; font-weight: 500; }
.expander .count.on {
  padding: 2px 8px; border-radius: 999px; color: var(--fa-primary); font-weight: 600;
  background: color-mix(in oklab, var(--fa-primary) 12%, transparent);
}
.panel { padding: 0 12px 10px; border-top: 1px solid var(--fa-border); }
.toolbar { display: flex; align-items: center; gap: 10px; padding-top: 12px; }
.search {
  flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--fa-border);
  border-radius: var(--fa-radius); background: var(--fa-bg); font-size: 13px;
}
.search::placeholder { color: var(--fa-muted-fg); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 6px; }
.chip {
  height: 24px; padding: 0 9px; border: 1px solid var(--fa-border); border-radius: 999px;
  color: var(--fa-muted-fg); background: transparent; font-size: 12px; font-weight: 500; cursor: pointer;
}
.chip:hover { color: var(--fa-fg); }
.chip[aria-pressed="true"] { color: var(--fa-primary-fg); border-color: var(--fa-primary); background: var(--fa-primary); }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--fa-border); }
.row:first-child { border-top: 0; }
.info { min-width: 0; }
.path { overflow: hidden; font: 12.5px/1.35 var(--fa-mono); text-overflow: ellipsis; white-space: nowrap; }
.row.overridden .path { color: var(--fa-primary); }
.meta { margin-top: 2px; color: var(--fa-muted-fg); font-size: 11.5px; }
.note { margin: 10px 0 4px; color: var(--fa-muted-fg); font-size: 12px; }
.link {
  padding: 0; border: 0; color: var(--fa-primary); background: none; font-size: 12px; font-weight: 600;
  letter-spacing: 0; text-transform: none; cursor: pointer;
}
.link:hover { text-decoration: underline; }

.dd-btn {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; width: 172px; height: 30px;
  padding: 0 8px 0 10px; border: 1px solid var(--fa-border); border-radius: var(--fa-radius);
  background: var(--fa-bg); font-size: 12.5px; cursor: pointer;
}
.dd-btn:hover { background: var(--fa-hover); }
.dd-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dd-btn svg { width: 14px; height: 14px; flex: none; color: var(--fa-muted-fg); }
.dd-btn[aria-expanded="true"] { border-color: var(--fa-primary); }
.row.overridden .dd-btn { border-color: var(--fa-primary); color: var(--fa-primary); }
.menu {
  position: fixed; z-index: 10; min-width: 200px; max-height: 300px; overflow: auto; padding: 4px;
  border: 1px solid var(--fa-border); border-radius: calc(var(--fa-radius) + 2px);
  color: var(--fa-fg); background: var(--fa-popover); box-shadow: var(--fa-shadow);
  font: 400 12.5px/1.4 var(--fa-font); animation: fa-pop .12s ease-out;
}
@keyframes fa-pop { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.opt {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0;
  border-radius: calc(var(--fa-radius) - 2px); background: transparent; text-align: left; white-space: nowrap; cursor: pointer;
}
.opt:hover, .opt:focus-visible { outline: none; background: var(--fa-hover); }
.opt .tick { width: 14px; flex: none; color: var(--fa-primary); }
.opt .tick svg { width: 14px; height: 14px; }
.opt.err { color: var(--fa-bad); }
.sep { height: 1px; margin: 4px 2px; background: var(--fa-border); }

.live {
  width: 6px; height: 6px; border-radius: 50%; background: var(--fa-ok);
  animation: fa-pulse 2s ease-out infinite;
}
@keyframes fa-pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--fa-ok) 55%, transparent); }
  70%, 100% { box-shadow: 0 0 0 6px transparent; }
}
.log {
  overflow: hidden; border: 1px solid var(--fa-border); border-radius: calc(var(--fa-radius) + 2px);
  background: var(--fa-muted); font: 11.5px/1.55 var(--fa-mono); font-variant-numeric: tabular-nums;
}
.entry {
  display: grid; grid-template-columns: 58px 32px 26px minmax(0, 1fr) minmax(0, max-content);
  gap: 10px; align-items: baseline; padding: 3px 12px; white-space: nowrap;
}
.entry:first-child { padding-top: 8px; }
.entry:last-child { padding-bottom: 8px; }
.entry:hover { background: var(--fa-hover); }
.entry.new { animation: fa-flash 1.4s ease-out; }
@keyframes fa-flash { from { background: color-mix(in oklab, var(--fa-primary) 18%, transparent); } to { background: transparent; } }
.entry .t, .entry .src { color: var(--fa-muted-fg); }
.entry .m { font-weight: 600; color: var(--fa-muted-fg); }
.entry .m-get { color: var(--fa-get); }
.entry .m-post { color: var(--fa-post); }
.entry .ok { color: var(--fa-ok); }
.entry .warn { color: var(--fa-warn); }
.entry .bad { color: var(--fa-bad); }
.entry .p, .entry .src { overflow: hidden; text-overflow: ellipsis; }
.entry .src { max-width: 150px; }
.idle { padding: 12px; color: var(--fa-muted-fg); }

.page { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; background: var(--fa-bg); }
.page .body { overflow: visible; padding: 0; }
.page-head { margin-bottom: 22px; }
.eyebrow { margin: 0 0 4px; color: var(--fa-primary); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.page-head h1 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
.toast {
  position: fixed; left: 50%; bottom: 18px; z-index: 5; margin: 0; padding: 8px 12px; border-radius: var(--fa-radius);
  color: var(--fa-bg); background: var(--fa-fg); font-size: 12.5px; opacity: 0; transform: translate(-50%, 6px);
  transition: opacity .15s, transform .15s; pointer-events: none;
}
.toast.visible { opacity: 1; transform: translate(-50%, 0); }
`

const CLIENT_JS = String.raw`
function mountFakeApi(config) {
  const host = document.getElementById(config.hostId);
  if (!host || host.shadowRoot) return;
  const root = host.attachShadow({ mode: 'open' });
  const embedded = config.embedded;
  const KEY_OPEN = 'olwiba-fake-api:open';
  const KEY_SCROLL = 'olwiba-fake-api:scroll';
  const KEY_CUSTOMISE = 'olwiba-fake-api:customise';

  const read = (area, key) => { try { return window[area].getItem(key); } catch (e) { return null; } };
  const write = (area, key, value) => {
    try { if (value === null) window[area].removeItem(key); else window[area].setItem(key, value); } catch (e) {}
  };
  const svg = (paths, width) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (width || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  const ICON = {
    flask: svg('<path d="M9 3v5.2L4.8 16a3.4 3.4 0 0 0 3 5h8.4a3.4 3.4 0 0 0 3-5L15 8.2V3"/><path d="M8 3h8M7 15h10"/>', 1.8),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    chevron: svg('<path d="m9 18 6-6-6-6"/>').replace('<svg', '<svg class="chev"'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>', 3),
  };
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  const ago = (iso) => {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    return s < 60 ? s + 's ago' : s < 3600 ? Math.round(s / 60) + 'm ago' : Math.round(s / 3600) + 'h ago';
  };

  host.style.setProperty('--fa-brand', config.brand);
  host.style.setProperty('--fa-launcher-bottom', config.launcherBottom + 'px');

  // Theme: the app's own tokens and font when it has them, and its light or
  // dark mode either way, re-read whenever <html> changes.
  const TOKENS = [
    ['bg', 'background'], ['fg', 'foreground'], ['card', 'card'], ['popover', 'popover'],
    ['muted', 'muted'], ['muted-fg', 'muted-foreground'], ['border', 'border'], ['hover', 'accent'],
    ['primary', 'primary'], ['primary-fg', 'primary-foreground'],
  ];
  let canvas = null;
  const luminance = (color) => {
    canvas = canvas || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!canvas) return null;
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = 'transparent';
    canvas.fillStyle = color;
    canvas.fillRect(0, 0, 1, 1);
    const d = canvas.getImageData(0, 0, 1, 1).data;
    return d[3] === 0 ? null : (0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]) / 255;
  };
  const detectTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark') || html.dataset.theme === 'dark') return 'dark';
    if (html.classList.contains('light') || html.dataset.theme === 'light') return 'light';
    if (embedded) {
      const l = luminance(getComputedStyle(document.body).backgroundColor);
      if (l !== null) return l < 0.5 ? 'dark' : 'light';
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const syncTheme = () => {
    host.dataset.theme = detectTheme();
    if (!embedded) return;
    const style = getComputedStyle(document.body);
    for (const [name, token] of TOKENS) {
      const value = style.getPropertyValue('--' + token).trim();
      if (value && CSS.supports('color', value)) host.style.setProperty('--fa-' + name, value);
      else host.style.removeProperty('--fa-' + name);
    }
    const radius = style.getPropertyValue('--radius').trim();
    if (radius && CSS.supports('border-radius', radius)) host.style.setProperty('--fa-radius', radius);
    else host.style.removeProperty('--fa-radius');
    if (style.fontFamily) host.style.setProperty('--fa-font', style.fontFamily);
  };
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);

  const content =
    '<p class="error" data-error hidden></p>'
    + '<section><h3 class="label">Scenario</h3><div class="cards" data-cards></div></section>'
    + '<section class="customise"><button class="expander" type="button" aria-expanded="false" data-expander>'
    + ICON.chevron + '<span>Customise</span><span class="count" data-count></span></button>'
    + '<div class="panel" data-panel hidden><div class="toolbar"><input class="search" type="search" placeholder="Filter endpoints" autocomplete="off" spellcheck="false" aria-label="Filter endpoints" data-search>'
    + '<button class="link" type="button" data-reset hidden>Reset all</button></div>'
    + '<div class="chips" data-groups></div><div class="rows" data-rows></div></div></section>'
    + '<section><h3 class="label">Recent calls<span class="live" aria-hidden="true"></span><span class="spacer"></span>'
    + '<button class="link" type="button" data-clear>Clear</button></h3><div class="log" data-log></div></section>';

  root.innerHTML = '<style>' + config.css + '</style>' + (embedded
    ? '<div class="fa"><button class="launcher" type="button" aria-haspopup="dialog" title="Fake API (Alt+Shift+F)">' + ICON.flask + '<span class="text">Fake API</span></button>'
      + '<dialog class="drawer" aria-labelledby="fa-title"><header class="head"><h2 id="fa-title">' + ICON.flask + 'Fake API</h2>'
      + '<button class="icon-btn" type="button" aria-label="Close" data-close>' + ICON.close + '</button></header>'
      + '<div class="body" data-body>' + content + '</div></dialog></div>'
    : '<div class="fa page"><header class="page-head"><p class="eyebrow">' + esc(config.title) + ' · development</p><h1>Fake API</h1></header>'
      + '<div class="body" data-body>' + content + '</div><p class="toast" role="status" data-toast></p></div>');

  const $ = (selector) => root.querySelector(selector);
  const dialog = $('.drawer');
  let state = null;
  let loading = null;
  let group = 'all';
  let seenAt = null;
  let menu = null;
  let toastTimer = 0;
  let errorTimer = 0;

  async function api(method, path, body) {
    const response = await fetch(config.base + '/api' + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The fake API refused that change.');
    return result;
  }
  function load() {
    loading = loading || api('GET', '/state').then((next) => { state = next; render(); }).finally(() => { loading = null; });
    return loading;
  }
  function fail(error) {
    const el = $('[data-error]');
    el.textContent = (error && error.message) || String(error);
    el.hidden = false;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }
  function toast(message) {
    const el = $('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
  }
  // A change reloads the page around the drawer so every query refetches,
  // and reopens the drawer where it was.
  function changed(message) {
    if (!embedded) { toast(message); return; }
    write('sessionStorage', KEY_OPEN, '1');
    write('sessionStorage', KEY_SCROLL, String($('[data-body]').scrollTop));
    location.reload();
  }
  const act = (fn) => (event) => { Promise.resolve(fn(event)).catch(fail); };

  function render() {
    if (!state) return;
    renderCards();
    renderCustomise();
    renderLog();
  }

  function card(id, label, description, pressed, extra) {
    return '<button class="card' + extra + '" type="button" data-preset="' + esc(id) + '" aria-pressed="' + pressed + '">'
      + '<span class="check" aria-hidden="true">' + ICON.check + '</span><span class="name">' + esc(label) + '</span>'
      + (description ? '<span class="desc">' + esc(description) + '</span>' : '') + '</button>';
  }
  function renderCards() {
    const cards = state.presets.map((p) => card(p.id, p.label, p.description || '', p.id === state.active, ''));
    cards.push(card('', 'Real API', 'Your database and account. Nothing faked.', state.active === null, ' real'));
    $('[data-cards]').innerHTML = cards.join('');
  }

  const choices = (p) => [{ id: '', label: 'Scenario default' }].concat(p.variants);
  const choiceLabel = (p) => (choices(p).find((c) => c.id === (p.override || '')) || { label: 'Scenario default' }).label;

  function renderCustomise() {
    const overridden = state.procedures.filter((p) => p.override).length;
    const count = $('[data-count]');
    count.textContent = overridden ? overridden + ' overridden' : state.procedures.length + ' endpoints';
    count.classList.toggle('on', overridden > 0);
    $('[data-reset]').hidden = overridden === 0;
    renderGroups();
    renderRows();
  }
  function renderGroups() {
    const groups = ['all'].concat([...new Set(state.procedures.map((p) => p.group))].sort());
    $('[data-groups]').innerHTML = groups.map((g) => '<button class="chip" type="button" data-group="' + esc(g) + '" aria-pressed="' + (g === group) + '">' + (g === 'all' ? 'All' : esc(g)) + '</button>').join('');
  }
  function renderRows() {
    closeMenu();
    const query = $('[data-search]').value.trim().toLowerCase();
    const active = state.presets.find((p) => p.id === state.active);
    const visible = state.procedures.filter((p) => (group === 'all' || p.group === group) && (!query || p.path.toLowerCase().includes(query)));
    let html = state.active ? '' : '<p class="note">Overrides apply while a scenario is active.</p>';
    html += visible.length ? visible.map((p) => {
      const meta = [];
      if (p.lastCalledAt) meta.push('called ' + ago(p.lastCalledAt));
      if (active && !p.definedIn.includes(active.id)) meta.push('no fixture in ' + esc(active.label));
      return '<div class="row' + (p.override ? ' overridden' : '') + '"><div class="info"><div class="path" title="' + esc(p.path) + '">' + esc(p.path) + '</div>'
        + (meta.length ? '<div class="meta">' + meta.join(' · ') + '</div>' : '') + '</div>'
        + '<button class="dd-btn" type="button" aria-haspopup="listbox" aria-expanded="false" data-path="' + esc(p.path) + '"><span>' + esc(choiceLabel(p)) + '</span>' + ICON.down + '</button></div>';
    }).join('') : '<p class="note">No endpoints match.</p>';
    $('[data-rows]').innerHTML = html;
  }
  function setExpanded(open) {
    $('[data-expander]').setAttribute('aria-expanded', String(open));
    $('[data-panel]').hidden = !open;
    write('localStorage', KEY_CUSTOMISE, open ? '1' : null);
  }

  function closeMenu() {
    if (!menu) return;
    menu.button.setAttribute('aria-expanded', 'false');
    menu.el.remove();
    menu = null;
  }
  function openMenu(button) {
    closeMenu();
    const p = state.procedures.find((x) => x.path === button.dataset.path);
    if (!p) return;
    const el = document.createElement('div');
    el.className = 'menu';
    el.setAttribute('role', 'listbox');
    let html = '';
    let previous = null;
    for (const choice of choices(p)) {
      const kind = choice.id === '' ? 'default' : choice.id.startsWith('preset:') ? 'preset' : choice.id === 'slow' ? 'slow' : 'error';
      if (previous && kind !== previous) html += '<div class="sep" role="separator"></div>';
      previous = kind;
      const selected = (p.override || '') === choice.id;
      html += '<button class="opt' + (kind === 'error' ? ' err' : '') + '" type="button" role="option" aria-selected="' + selected + '" data-value="' + esc(choice.id) + '">'
        + '<span class="tick">' + (selected ? ICON.check : '') + '</span>' + esc(choice.label) + '</button>';
    }
    el.innerHTML = html;
    (dialog || $('.fa')).appendChild(el);
    const rect = button.getBoundingClientRect();
    el.style.minWidth = rect.width + 'px';
    const height = el.offsetHeight;
    const width = el.offsetWidth;
    const flip = innerHeight - rect.bottom < height + 12 && rect.top > height + 12;
    el.style.top = (flip ? rect.top - height - 4 : rect.bottom + 4) + 'px';
    el.style.left = Math.max(8, Math.min(rect.right - width, innerWidth - width - 8)) + 'px';
    button.setAttribute('aria-expanded', 'true');
    menu = { el, button, path: p.path };
    (el.querySelector('[aria-selected="true"]') || el.querySelector('.opt')).focus();
  }

  function renderLog() {
    const entries = state.activity.slice(0, 50);
    const log = $('[data-log]');
    if (entries.length === 0) {
      log.innerHTML = '<div class="idle">Waiting for requests…</div>';
      seenAt = null;
      return;
    }
    const since = seenAt;
    log.innerHTML = entries.map((c) => {
      const status = c.status || (c.ok ? 200 : 500);
      const tone = status >= 500 ? 'bad' : status >= 400 ? 'warn' : 'ok';
      const method = String(c.method);
      return '<div class="entry' + (since !== null && c.at > since ? ' new' : '') + '">'
        + '<span class="t">' + clock(c.at) + '</span><span class="m m-' + esc(method.toLowerCase()) + '">' + esc(method) + '</span>'
        + '<span class="' + tone + '">' + status + '</span><span class="p" title="' + esc(c.path) + '">' + esc(c.path) + '</span>'
        + '<span class="src" title="' + esc(c.servedBy) + '">' + esc(c.servedBy) + '</span></div>';
    }).join('');
    seenAt = entries[0].at;
  }

  $('[data-cards]').addEventListener('click', act(async (event) => {
    const target = event.target.closest('.card');
    if (!target) return;
    const preset = target.dataset.preset || null;
    if (preset === state.active) return;
    state = await api('PUT', '/preset', { preset });
    renderCards();
    renderRows();
    const label = (state.presets.find((p) => p.id === preset) || {}).label;
    changed(label ? 'Switched to ' + label + '.' : 'Back on the real API.');
  }));
  $('[data-expander]').addEventListener('click', () => setExpanded($('[data-panel]').hidden));
  $('[data-search]').addEventListener('input', renderRows);
  $('[data-groups]').addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    group = chip.dataset.group;
    renderGroups();
    renderRows();
  });
  $('[data-rows]').addEventListener('click', (event) => {
    const button = event.target.closest('.dd-btn');
    if (!button) return;
    if (menu && menu.button === button) closeMenu();
    else openMenu(button);
  });
  root.addEventListener('click', act(async (event) => {
    const option = event.target.closest('.opt');
    if (!option || !menu) return;
    const path = menu.path;
    const variant = option.dataset.value || null;
    closeMenu();
    state = await api('PUT', '/overrides', { path, variant });
    renderCustomise();
    changed(variant ? path + ' overridden.' : path + ' back to the scenario.');
  }));
  root.addEventListener('keydown', (event) => {
    if (!menu) return;
    const options = [...menu.el.querySelectorAll('.opt')];
    const index = options.indexOf(root.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = options[(index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length];
      if (next) next.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const button = menu.button;
      closeMenu();
      button.focus();
    } else if (event.key === 'Tab') {
      closeMenu();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!menu) return;
    const path = event.composedPath();
    if (!path.includes(menu.el) && !path.includes(menu.button)) closeMenu();
  }, true);
  $('[data-body]').addEventListener('scroll', closeMenu, { passive: true });
  addEventListener('resize', closeMenu);
  $('[data-reset]').addEventListener('click', act(async () => {
    state = await api('DELETE', '/overrides');
    renderCustomise();
    changed('All overrides cleared.');
  }));
  $('[data-clear]').addEventListener('click', act(async () => {
    state = await api('DELETE', '/activity');
    seenAt = null;
    renderLog();
  }));
  setExpanded(read('localStorage', KEY_CUSTOMISE) === '1');

  // Recent calls stay current while they can be seen.
  setInterval(() => {
    const visible = embedded ? dialog.open : document.visibilityState === 'visible';
    if (!visible || !state || loading) return;
    api('GET', '/state').then((next) => {
      state.activity = next.activity;
      renderLog();
    }).catch(() => {});
  }, 2000);

  if (!embedded) {
    load().catch(fail);
    return;
  }

  const launcher = $('.launcher');
  const open = () => {
    if (!dialog.open) dialog.showModal();
    if (!state) load().catch(fail);
  };
  launcher.addEventListener('pointerenter', () => { if (!state) load().catch(() => {}); }, { once: true });
  launcher.addEventListener('click', open);
  $('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('cancel', (event) => { if (menu) { event.preventDefault(); closeMenu(); } });
  dialog.addEventListener('close', () => { closeMenu(); dialog.classList.remove('instant'); });
  addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyF') {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });

  if (read('sessionStorage', KEY_OPEN) === '1') {
    const scroll = Number(read('sessionStorage', KEY_SCROLL) || 0);
    write('sessionStorage', KEY_OPEN, null);
    write('sessionStorage', KEY_SCROLL, null);
    dialog.classList.add('instant');
    open();
    load().then(() => { $('[data-body]').scrollTop = scroll; }).catch(fail);
  }
}
`
