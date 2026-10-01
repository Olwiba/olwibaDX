import assert from "node:assert/strict"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { afterEach, describe, test } from "node:test"
import { resolveViteBin, splitViteArgs } from "../vite-launcher"
import {
  createFakeApiController,
  createFakeApiHandler,
  createFakeApiStore,
  FAKE_API_SESSION_HEADER,
  injectBeforeBodyEnd,
  parseTrpcCall,
} from "./index"
import { overlaySnippet } from "./overlay"
import { studioPage } from "./studio"
import type { FakeApiPreset } from "./types"

const PRESETS: FakeApiPreset[] = [
  {
    id: "populated",
    label: "Populated",
    description: "Monitors running, matches landing.",
    responses: {
      "properties.list": { items: [{ id: "p1" }, { id: "p2" }] },
      "properties.get": (input: unknown) =>
        (input as { id?: string } | undefined)?.id === "p1" ? { id: "p1", title: "Mare Street" } : undefined,
      "properties.setFavorite": {},
    },
  },
  {
    id: "empty",
    label: "Empty",
    responses: { "properties.list": { items: [] } },
  },
]

const COOKIE = "app_fake_api"

interface ErrorEnvelope {
  error: { message: string; data: { code: string; httpStatus: number } }
}

const errorOf = (result: unknown) => (result as ErrorEnvelope).error

describe("parseTrpcCall", () => {
  test("reads a batched query with inputs per path", () => {
    const input = encodeURIComponent(JSON.stringify({ 1: { id: "p1" } }))
    const url = new URL(`http://x/api/trpc/properties.list,properties.get?batch=1&input=${input}`)
    assert.deepEqual(parseTrpcCall(url, "/api/trpc"), {
      paths: ["properties.list", "properties.get"],
      batched: true,
      inputs: { 1: { id: "p1" } },
    })
  })

  test("reads an unbatched mutation from its body", () => {
    const url = new URL("http://x/api/trpc/properties.setFavorite")
    assert.deepEqual(parseTrpcCall(url, "/api/trpc", JSON.stringify({ id: "p1" })), {
      paths: ["properties.setFavorite"],
      batched: false,
      inputs: { 0: { id: "p1" } },
    })
  })
})

describe("createFakeApiStore", () => {
  const store = () => createFakeApiStore(PRESETS, { enabled: true, readOnlyMessage: "Read only.", slowMs: 1000 })

  test("a browser's own choice wins over the global scenario, and 'off' opts out", () => {
    const s = store()
    assert.equal(s.presetFor(null), "populated")
    assert.equal(s.presetFor("empty"), "empty")
    assert.equal(s.presetFor("off"), null)
    assert.equal(s.presetFor("nonsense"), "populated")
  })

  test("answers from the scenario, including fixtures that depend on input", () => {
    const { results } = store().answer(
      { paths: ["properties.list", "properties.get"], batched: true, inputs: { 1: { id: "p1" } } },
      "GET",
      "populated",
    )
    assert.deepEqual(results, [
      { result: { data: { items: [{ id: "p1" }, { id: "p2" }] } } },
      { result: { data: { id: "p1", title: "Mare Street" } } },
    ])
  })

  test("a lookup that finds nothing is a 404, like the real API", () => {
    const { results } = store().answer(
      { paths: ["properties.get"], batched: false, inputs: { 0: { id: "nope" } } },
      "GET",
      "populated",
    )
    assert.equal(errorOf(results[0]).data.code, "NOT_FOUND")
    assert.equal(errorOf(results[0]).data.httpStatus, 404)
  })

  test("a query with no fixture fails loudly; a write with none is refused as read-only", () => {
    const s = store()
    const missing = s.answer({ paths: ["monitors.list"], batched: false, inputs: {} }, "GET", "populated")
    assert.equal(errorOf(missing.results[0]).data.httpStatus, 500)
    assert.match(errorOf(missing.results[0]).message, /No fake API fixture/)

    const write = s.answer({ paths: ["monitors.create"], batched: false, inputs: {} }, "POST", "populated")
    assert.equal(errorOf(write.results[0]).message, "Read only.")
    assert.equal(errorOf(write.results[0]).data.code, "FORBIDDEN")
  })

  test("overrides take one procedure from another scenario, slow it down, or fail it", () => {
    const s = store()
    const call = { paths: ["properties.list"], batched: false, inputs: {} }

    s.setOverride("properties.list", "preset:empty")
    assert.deepEqual(s.answer(call, "GET", "populated").results[0], { result: { data: { items: [] } } })

    s.setOverride("properties.list", "slow")
    assert.equal(s.answer(call, "GET", "populated").delayMs, 1000)

    s.setOverride("properties.list", "error:401")
    assert.equal(errorOf(s.answer(call, "GET", "populated").results[0]).data.code, "UNAUTHORIZED")

    s.resetOverrides()
    assert.ok("result" in (s.answer(call, "GET", "populated").results[0] as object))
  })

  test("refuses overrides that do not exist", () => {
    assert.throws(() => store().setOverride("properties.list", "preset:missing"))
    assert.throws(() => store().setOverride("properties.list", "error:418" as never))
  })

  test("lists every procedure with its variants and what was called", () => {
    const s = store()
    s.answer({ paths: ["properties.list"], batched: false, inputs: {} }, "GET", "populated")
    const snapshot = s.snapshot()
    const list = snapshot.procedures.find((p) => p.path === "properties.list")
    assert.ok(list)

    assert.equal(list.group, "properties")
    assert.deepEqual(list.definedIn, ["populated", "empty"])
    assert.ok(list.variants.some((v) => v.id === "preset:empty"))
    assert.notEqual(list.lastCalledAt, null)
    assert.equal(snapshot.activity[0]?.path, "properties.list")
    assert.equal(snapshot.activity[0]?.ok, true)
    assert.equal(snapshot.activity[0]?.servedBy, "populated")
    assert.equal(snapshot.activity[0]?.status, 200)
  })

  test("records the status each call answered with, and clears", () => {
    const s = store()
    s.setOverride("properties.list", "error:401")
    s.answer({ paths: ["properties.list", "properties.get", "monitors.list"], batched: true, inputs: { 1: { id: "x" } } }, "GET", "populated")
    s.answer({ paths: ["monitors.create"], batched: false, inputs: {} }, "POST", "populated")
    assert.deepEqual(
      s.snapshot().activity.map((entry) => entry.status),
      [403, 500, 404, 401],
    )
    s.clearActivity()
    assert.equal(s.snapshot().activity.length, 0)
  })
})

describe("the fake API middleware", () => {
  let server: Server | undefined
  let seen: { cookie?: string; body: string }[] = []

  afterEach(() => {
    server?.close()
    server = undefined
    seen = []
  })

  /** The middleware in front of a stand-in app that streams an HTML page. */
  async function start(enabled: boolean): Promise<string> {
    const { middleware } = createFakeApiHandler({
      presets: async () => PRESETS,
      cookieName: COOKIE,
      enabled,
      title: "Test",
      slowMs: 10,
    })
    const app = (req: IncomingMessage, res: ServerResponse) => {
      let body = ""
      req.on("data", (chunk: Buffer) => (body += chunk.toString()))
      req.on("end", () => {
        seen.push({ cookie: req.headers.cookie, body })
        if (req.url?.startsWith("/api/")) {
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify({ real: true }))
          return
        }
        res.setHeader("content-type", "text/html")
        res.write("<!doctype html><html><body><main>App</main>")
        res.end("</body></html>")
      })
    }
    const listening = createServer((req, res) => middleware(req, res, () => app(req, res)))
    server = listening
    await new Promise<void>((resolve) => listening.listen(0, resolve))
    return `http://127.0.0.1:${(listening.address() as AddressInfo).port}`
  }

  const html = { accept: "text/html" }

  test("--fake-api hands a new browser the default scenario before the page renders", async () => {
    const base = await start(true)
    const response = await fetch(`${base}/a/properties`, { headers: html })
    const body = await response.text()

    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${COOKIE}=populated`))
    // Server rendering saw the scenario on this very request.
    assert.match(seen[0]?.cookie ?? "", new RegExp(`${COOKIE}=populated`))
    assert.ok(body.includes('data-fake-api-overlay="true"'))
    assert.ok(body.indexOf("data-fake-api-overlay") < body.indexOf("</body>"))
  })

  test("answers tRPC from the browser's scenario and never reaches the app", async () => {
    const base = await start(true)
    const input = encodeURIComponent(JSON.stringify({ 0: { id: "p1" } }))
    const response = await fetch(`${base}/api/trpc/properties.get?batch=1&input=${input}`, {
      headers: { cookie: `${COOKIE}=populated` },
    })

    assert.deepEqual(await response.json(), [{ result: { data: { id: "p1", title: "Mare Street" } } }])
    assert.equal(seen.length, 0)
  })

  test("refuses writes the scenario does not answer, tRPC or not", async () => {
    const base = await start(true)
    const cookie = { cookie: `${COOKIE}=populated` }

    const trpc = await fetch(`${base}/api/trpc/monitors.create`, { method: "POST", headers: cookie, body: "{}" })
    assert.equal(trpc.status, 403)

    const other = await fetch(`${base}/api/upload`, { method: "POST", headers: cookie, body: "x" })
    assert.equal(other.status, 403)
    assert.equal(seen.length, 0)
  })

  test("?fake= picks a scenario for this browser and returns to the clean URL", async () => {
    const base = await start(false)
    const response = await fetch(`${base}/a/properties?fake=empty&tab=2`, { headers: html, redirect: "manual" })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get("location"), "/a/properties?tab=2")
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`${COOKIE}=empty`))
  })

  test("the studio switches scenarios and overrides, and each change is served", async () => {
    const base = await start(true)
    const cookie = { cookie: `${COOKIE}=populated` }

    const page = await fetch(`${base}/__fake-api`)
    assert.ok((await page.text()).includes("Fake API"))

    const state = (await (await fetch(`${base}/__fake-api/api/state`, { headers: cookie })).json()) as {
      active: string
      presets: unknown[]
    }
    assert.equal(state.active, "populated")
    assert.equal(state.presets.length, 2)

    await fetch(`${base}/__fake-api/api/overrides`, {
      method: "PUT",
      headers: { ...cookie, "content-type": "application/json" },
      body: JSON.stringify({ path: "properties.list", variant: "error:500" }),
    })
    const failed = await fetch(`${base}/api/trpc/properties.list`, { headers: cookie })
    assert.equal(failed.status, 500)

    const off = await fetch(`${base}/__fake-api/api/preset`, {
      method: "PUT",
      headers: { ...cookie, "content-type": "application/json" },
      body: JSON.stringify({ preset: null }),
    })
    assert.match(off.headers.get("set-cookie") ?? "", new RegExp(`${COOKIE}=off`))
  })

  test("agent sessions isolate scenario controls, overrides, and activity", async () => {
    const base = await start(true)
    const first = createFakeApiController({ baseUrl: base, sessionId: "worker-a" })
    const second = createFakeApiController({ baseUrl: base, sessionId: "worker-b" })

    await first.selectPreset("empty")
    await first.setOverride("properties.list", "error:500")

    assert.equal((await first.state()).active, "empty")
    assert.equal(
      (await first.state()).procedures.find((entry) => entry.path === "properties.list")?.override,
      "error:500",
    )
    assert.equal((await second.state()).active, "populated")
    assert.equal(
      (await second.state()).procedures.find((entry) => entry.path === "properties.list")?.override,
      null,
    )

    const failed = await fetch(`${base}/api/trpc/properties.list`, {
      headers: { [FAKE_API_SESSION_HEADER]: "worker-a" },
    })
    const succeeded = await fetch(`${base}/api/trpc/properties.list`, {
      headers: { [FAKE_API_SESSION_HEADER]: "worker-b" },
    })
    assert.equal(failed.status, 500)
    assert.equal(succeeded.status, 200)
    assert.equal((await first.activity()).length, 1)
    assert.equal((await second.activity()).length, 1)

    await first.clearActivity()
    assert.equal((await first.activity()).length, 0)
    assert.equal((await second.activity()).length, 1)
    await first.dispose()
    await second.dispose()
  })

  test("a browser on the real API keeps the launcher and reaches the app untouched", async () => {
    const base = await start(true)
    const cookie = { cookie: `${COOKIE}=off` }

    const page = await (await fetch(`${base}/a/properties`, { headers: { ...html, ...cookie } })).text()
    assert.ok(page.includes('data-fake-api-overlay="true"'))

    const api = await fetch(`${base}/api/trpc/properties.setFavorite`, {
      method: "POST",
      headers: cookie,
      body: '{"id":"p1"}',
    })
    assert.deepEqual(await api.json(), { real: true })
    // The body was not read on the way through.
    assert.equal(seen.at(-1)?.body, '{"id":"p1"}')
  })

  test("without the flag and without a cookie, nothing is faked or injected", async () => {
    const base = await start(false)
    const page = await (await fetch(`${base}/a/properties`, { headers: html })).text()
    assert.ok(!page.includes("data-fake-api-overlay"))
    assert.equal(seen[0]?.cookie, undefined)
  })
})

describe("injectBeforeBodyEnd", () => {
  test("injects into a response written the way srvx writes TanStack Start pages", async () => {
    const page = new TextEncoder().encode("<html><body><main>App</main></body></html>")
    const server = createServer((_req, res) => {
      injectBeforeBodyEnd(res, "<aside>launcher</aside>")
      // Flat header list, a declared length, and bytes rather than strings.
      res.writeHead(200, "OK", ["content-type", "text/html; charset=utf-8", "content-length", String(page.length)])
      res.write(page.slice(0, 10))
      res.end(page.slice(10))
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)
      assert.equal(await response.text(), "<html><body><main>App</main><aside>launcher</aside></body></html>")
      assert.equal(response.headers.get("content-length"), null)
    } finally {
      server.close()
    }
  })

  test("leaves other responses alone, length and all", async () => {
    const server = createServer((_req, res) => {
      injectBeforeBodyEnd(res, "<aside>launcher</aside>")
      res.writeHead(200, { "Content-Type": "application/json", "Content-Length": "15" })
      res.end('{"a":"</body>"}')
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)
      assert.equal(await response.text(), '{"a":"</body>"}')
      assert.equal(response.headers.get("content-length"), "15")
    } finally {
      server.close()
    }
  })
})

describe("the browser client", () => {
  const scriptOf = (html: string) => {
    const start = html.indexOf('<script type="module">') + '<script type="module">'.length
    return html.slice(start, html.indexOf("</script>", start))
  }
  const configOf = (script: string) => {
    const encoded = /atob\("([^"]+)"\)/.exec(script)?.[1] ?? ""
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>
  }

  test("the overlay and studio scripts parse, and carry their config safely", () => {
    const overlay = overlaySnippet({ basePath: "/__fake-api", title: "A </script> app", accentColor: "#123456", launcherBottom: 120 })
    const studio = studioPage({ basePath: "/__fake-api", title: "App", accentColor: "#123456" })
    for (const script of [scriptOf(overlay), scriptOf(studio)]) {
      assert.doesNotThrow(() => new Function(script))
    }
    // One script element: the title could not end it early.
    assert.equal(overlay.split("</script>").length, 2)
    assert.deepEqual(
      { ...configOf(scriptOf(overlay)), css: undefined },
      { base: "/__fake-api", embedded: true, title: "A </script> app", brand: "#123456", launcherBottom: 120, hostId: "olwiba-fake-api", css: undefined },
    )
    assert.equal(configOf(scriptOf(studio)).embedded, false)
  })

  test("the launcher names only the tool, not the scenario", () => {
    const script = scriptOf(overlaySnippet({ basePath: "/__fake-api", title: "App", accentColor: "#123456", launcherBottom: 96 }))
    assert.match(script, /<span class="text">Fake API<\/span>/)
  })
})

describe("scenarios from a module", () => {
  test("loads them through the dev server and picks up an edit without losing choices", async () => {
    let mod: Record<string, unknown> = { presets: PRESETS }
    const handler = createFakeApiHandler({ presets: "/src/mocks/fake-api.ts", cookieName: COOKIE, enabled: true }, async (path) => {
      assert.equal(path, "/src/mocks/fake-api.ts")
      return mod
    })

    const store = await handler.ready()
    store.setPreset("empty")
    store.setOverride("properties.get", "slow")

    const edited = PRESETS.map((preset) =>
      preset.id === "empty" ? { ...preset, responses: { "properties.list": { items: [{ id: "new" }] } } } : preset,
    )
    mod = { default: edited }
    const call = { paths: ["properties.list"], batched: false, inputs: {} }
    assert.deepEqual((await handler.ready()).answer(call, "GET", "empty").results[0], {
      result: { data: { items: [{ id: "new" }] } },
    })
    assert.equal(store.snapshot().preset, "empty")
    assert.equal(store.snapshot().procedures.find((p) => p.path === "properties.get")?.override, "slow")
  })

  test("says what is wrong with a module that exports no scenarios", async () => {
    const handler = createFakeApiHandler({ presets: "/src/mocks/nope.ts", cookieName: COOKIE }, async () => ({}))
    await assert.rejects(handler.ready(), /must export its fake API scenarios/)
  })
})

describe("dx vite", () => {
  test("takes dx flags out and passes the rest to vite", () => {
    assert.deepEqual(splitViteArgs(["dev", "--fake-api", "--port", "3001"]), {
      args: ["dev", "--port", "3001"],
      env: { FAKE_API: "1" },
    })
    assert.deepEqual(splitViteArgs(["build"]), { args: ["build"], env: {} })
  })

  test("finds the project's Vite CLI, which Vite's exports map hides", () => {
    assert.match(resolveViteBin(process.cwd()) ?? "", /vite[\\/]bin[\\/]vite\.js$/)
    assert.equal(resolveViteBin(tmpdir()), null)
  })
})
