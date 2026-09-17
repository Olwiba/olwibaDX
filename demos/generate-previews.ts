import { resolve } from "node:path"
import { generatePreviews } from "../src/generate-previews"
import { demoHeader } from "./shared"

demoHeader(
  "preview generator",
  "Starts a temporary local page, captures it with the real generator, then stops the server.",
)

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: light; --bg: #fff7ed; --card: #ffffff; --text: #18181b; --muted: #71717a; --border: #fed7aa; }
      :root.dark { color-scheme: dark; --bg: #18130f; --card: #211b16; --text: #fafafa; --muted: #a1a1aa; --border: #7c2d12; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-demo-preview] { width: 680px; padding: 34px; border: 1px solid var(--border); border-radius: 22px; background: var(--card); box-shadow: 0 30px 80px rgb(0 0 0 / .16); }
      .eyebrow { color: #f97316; font-size: 13px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 12px 0 8px; font-size: 34px; letter-spacing: -.04em; }
      p { margin: 0 0 24px; color: var(--muted); font-size: 17px; line-height: 1.55; }
      .command { display: flex; align-items: center; gap: 12px; padding: 15px 17px; border: 1px solid var(--border); border-radius: 13px; }
      .prompt { color: #f97316; font-weight: 800; }
      code { flex: 1; font: 15px ui-monospace, SFMono-Regular, Consolas, monospace; }
      kbd { padding: 4px 7px; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font: 12px ui-monospace, monospace; }
    </style>
  </head>
  <body>
    <main data-demo-preview>
      <div class="eyebrow">olwibaDX</div>
      <h1>Tools that get out of your way.</h1>
      <p>Generate the repetitive parts, check the easy-to-miss parts, and keep development environments readable.</p>
      <div class="command"><span class="prompt">$</span><code>bunx @olwiba/dx generate-assets</code><kbd>Enter</kbd></div>
    </main>
  </body>
</html>`

const server = Bun.serve({
  port: 0,
  fetch() {
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })
  },
})

try {
  await generatePreviews({
    baseUrl: `http://127.0.0.1:${server.port}`,
    outputDir: resolve("artifacts/demos/previews"),
    components: [{ name: "tool-card", urlPath: "/tool-card", selector: "[data-demo-preview]" }],
    themes: ["light", "dark"],
    padding: 24,
    viewport: { width: 900, height: 620 },
  })
} finally {
  server.stop(true)
}
