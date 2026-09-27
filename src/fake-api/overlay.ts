/**
 * The launcher and drawer added to every page while the fake API is on.
 *
 * A tab at the bottom-right edge that opens out on hover to name the active
 * scenario; clicking it slides a drawer in from the right holding the
 * scenario studio (./studio.ts) in an iframe. Choosing anything in the
 * studio reloads the page so every query refetches against the new state.
 *
 * Self-contained markup, styles and script, all prefixed, so it cannot
 * collide with the app's own CSS or globals. The app can detect it through
 * `[data-fake-api-overlay]` if it ever needs to.
 */

export interface OverlayOptions {
  basePath: string
  accentColor: string
  /** Label of the scenario answering this page, or null when the real API is. */
  scenarioLabel: string | null
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

export function overlaySnippet({ basePath, accentColor, scenarioLabel }: OverlayOptions): string {
  const label = scenarioLabel ? escapeHtml(scenarioLabel) : "Real API"
  const accent = escapeHtml(accentColor)
  return `
<div data-fake-api-overlay="true">
<style>
  #olwiba-fake-api-launcher {
    --fa-accent: ${accent};
    position: fixed; right: 0; bottom: 24px; z-index: 2147483000;
    display: flex; align-items: center; gap: 10px;
    height: 40px; max-width: 44px; padding: 0 12px 0 13px; overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--fa-accent) 70%, black); border-right: 0;
    border-radius: 10px 0 0 10px;
    color: #fff; background: var(--fa-accent);
    box-shadow: 0 6px 20px rgba(15, 23, 42, .25);
    font: 600 13px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    white-space: nowrap; cursor: pointer;
    transition: max-width .25s cubic-bezier(.2, .8, .2, 1), box-shadow .15s;
  }
  #olwiba-fake-api-launcher:hover, #olwiba-fake-api-launcher:focus-visible {
    max-width: 320px; box-shadow: 0 8px 26px rgba(15, 23, 42, .32);
  }
  #olwiba-fake-api-launcher:focus-visible { outline: 2px solid var(--fa-accent); outline-offset: 3px; }
  #olwiba-fake-api-launcher svg { width: 18px; height: 18px; flex: 0 0 auto; }
  #olwiba-fake-api-launcher .fa-text { opacity: 0; transform: translateX(6px); transition: opacity .15s, transform .2s; }
  #olwiba-fake-api-launcher:hover .fa-text, #olwiba-fake-api-launcher:focus-visible .fa-text { opacity: 1; transform: none; }
  #olwiba-fake-api-launcher .fa-scenario { font-weight: 500; opacity: .85; }
  #olwiba-fake-api-drawer {
    position: fixed; inset: 8px 8px 8px auto; margin: 0;
    width: min(760px, calc(100vw - 16px)); height: calc(100dvh - 16px);
    max-width: none; max-height: none; padding: 0; overflow: hidden;
    border: 1px solid rgba(15, 23, 42, .14); border-radius: 14px;
    color: #0f172a; background: #fff;
    box-shadow: 0 24px 70px rgba(15, 23, 42, .35);
  }
  #olwiba-fake-api-drawer[open] { animation: olwiba-fake-api-in .22s cubic-bezier(.2, .8, .2, 1); }
  #olwiba-fake-api-drawer::backdrop { background: rgba(15, 23, 42, .35); backdrop-filter: blur(2px); }
  @keyframes olwiba-fake-api-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  #olwiba-fake-api-drawer header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    height: 52px; padding: 0 12px 0 18px; border-bottom: 1px solid rgba(15, 23, 42, .1);
    font: 600 14px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  #olwiba-fake-api-drawer header .fa-pill {
    margin-left: 8px; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    color: ${accent}; background: color-mix(in srgb, ${accent} 12%, transparent);
  }
  #olwiba-fake-api-close {
    border: 0; border-radius: 8px; padding: 7px 10px; background: transparent; color: inherit;
    font: 500 12px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; opacity: .75;
  }
  #olwiba-fake-api-close:hover { opacity: 1; background: rgba(15, 23, 42, .06); }
  #olwiba-fake-api-frame { display: block; width: 100%; height: calc(100% - 52px); border: 0; background: transparent; }
  @media (prefers-color-scheme: dark) {
    #olwiba-fake-api-drawer { color: #e2e8f0; background: #0b1220; border-color: rgba(226, 232, 240, .12); }
    #olwiba-fake-api-drawer header { border-color: rgba(226, 232, 240, .1); }
    #olwiba-fake-api-close:hover { background: rgba(226, 232, 240, .08); }
  }
  @media print { [data-fake-api-overlay] { display: none !important; } }
</style>
<button id="olwiba-fake-api-launcher" type="button" aria-haspopup="dialog" aria-controls="olwiba-fake-api-drawer" title="Fake API (Alt+Shift+F)">
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5.2L4.8 16a3.4 3.4 0 0 0 3 5h8.4a3.4 3.4 0 0 0 3-5L15 8.2V3"/><path d="M8 3h8M7 15h10"/></svg>
  <span class="fa-text">Fake API <span class="fa-scenario">· ${label}</span></span>
</button>
<dialog id="olwiba-fake-api-drawer" aria-labelledby="olwiba-fake-api-title">
  <header>
    <div id="olwiba-fake-api-title">Fake API<span class="fa-pill">${label}</span></div>
    <button id="olwiba-fake-api-close" type="button" aria-label="Close the fake API studio">Close</button>
  </header>
  <iframe id="olwiba-fake-api-frame" title="Fake API scenario studio" loading="lazy" data-src="${escapeHtml(basePath)}?embedded=1"></iframe>
</dialog>
<script>
(() => {
  const launcher = document.getElementById('olwiba-fake-api-launcher');
  const drawer = document.getElementById('olwiba-fake-api-drawer');
  const frame = document.getElementById('olwiba-fake-api-frame');
  const open = () => {
    if (!frame.src) frame.src = frame.dataset.src;
    if (!drawer.open) drawer.showModal();
  };
  launcher.addEventListener('click', open);
  document.getElementById('olwiba-fake-api-close').addEventListener('click', () => drawer.close());
  drawer.addEventListener('click', (event) => { if (event.target === drawer) drawer.close(); });
  addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && event.code === 'KeyF') {
      event.preventDefault();
      drawer.open ? drawer.close() : open();
    }
  });
  addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data && event.data.type === 'olwiba:fake-api-changed') location.reload();
  });
})();
</script>
</div>`
}
