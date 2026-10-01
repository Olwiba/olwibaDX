import { clientScript, HOST_ID } from "./client"

/**
 * The scenario studio as a page of its own, at the studio path: the same
 * studio the drawer holds (see ./client.ts), without the launcher, following
 * the system's light or dark mode.
 *
 * Scenarios first, then the per-endpoint overrides behind "Customise", then
 * recent calls as a live log.
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
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)} fake API</title>
<style>html, body { margin: 0; background: #ffffff; } @media (prefers-color-scheme: dark) { html, body { background: #0a0a0a; } }</style>
</head>
<body>
<div id="${HOST_ID}"></div>
${clientScript({ base: basePath, embedded: false, title, brand: accentColor, launcherBottom: 0 })}
</body>
</html>`
}
