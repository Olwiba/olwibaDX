import type { IncomingMessage, ServerResponse } from "node:http"
import { injectBeforeBodyEnd } from "./inject"
import { overlaySnippet } from "./overlay"
import { createFakeApiStore, type FakeApiStore } from "./store"
import { studioPage } from "./studio"
import { parseTrpcCall, trpcBody } from "./trpc"
import type { FakeApiOptions, FakeApiPreset, FakeVariant } from "./types"

/**
 * The fake API, as a Vite dev-server plugin.
 *
 * Answers the app's tRPC calls from named scenarios so a UI can be put into
 * any state without touching a database, and adds a launcher to every page
 * that opens the scenario studio in a drawer.
 *
 * Off by default and dev-only by construction: `apply: "serve"` means it does
 * not exist in a production build. Two ways to switch it on:
 *
 * - `dx vite dev --fake-api` (or `FAKE_API=1`): every browser gets the
 *   default scenario until it chooses another, or the real API, in the studio.
 * - `?fake=<scenario>` on any URL, without the flag: that browser alone.
 *
 * The active scenario travels in a cookie, because the app's own server code
 * has to see it during server rendering (to fake a signed-in session), before
 * any client code runs. The studio's choices are held in the dev server's
 * memory and reset when it restarts.
 */

export const STUDIO_PATH = "/__fake-api"
export const FAKE_API_SESSION_HEADER = "x-olwiba-fake-api-session"
const DEFAULT_TRPC_PATH = "/api/trpc"
const DEFAULT_READ_ONLY = "This preview uses sample data. Exit preview to save changes."
const DEFAULT_ACCENT = "#2563eb"
const SESSION_LIMIT = 32

type Next = (error?: unknown) => void
type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => void
type LoadModule = (path: string) => Promise<Record<string, unknown>>
interface DevServerLike {
  middlewares: { use: (middleware: Middleware) => void }
  ssrLoadModule: LoadModule
}

/** Whether `--fake-api`/`FAKE_API=1` switched the fake API on for this process. */
export function isFakeApiRequested(env: NodeJS.ProcessEnv = process.env, argv: string[] = process.argv): boolean {
  return env.FAKE_API === "1" || env.FAKE_API === "true" || argv.includes("--fake-api")
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return decodeURIComponent(rest.join("="))
  }
  return null
}

function cookieHeader(name: string, value: string | null): string {
  return value === null
    ? `${name}=; Path=/; Max-Age=0; SameSite=Lax`
    : `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`
}

/**
 * Adds a Set-Cookie without clobbering ones the app sets later on the same
 * response (a sign-in page setting its own session cookie, say).
 */
function appendSetCookie(res: ServerResponse, value: string): void {
  const merge = (existing: unknown): string[] =>
    existing === undefined ? [value] : [...(Array.isArray(existing) ? existing : [String(existing)]), value]
  res.setHeader("set-cookie", merge(res.getHeader("set-cookie")))
  const originalSetHeader = res.setHeader.bind(res)
  res.setHeader = ((name: string, headerValue: number | string | readonly string[]) => {
    if (name.toLowerCase() !== "set-cookie") return originalSetHeader(name, headerValue)
    const incoming = Array.isArray(headerValue) ? [...headerValue] : [String(headerValue)]
    return originalSetHeader(name, incoming.includes(value) ? incoming : [...incoming, value])
  }) as ServerResponse["setHeader"]
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.statusCode = status
  res.setHeader("content-type", "application/json")
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ""
    req.setEncoding("utf8")
    req.on("data", (chunk: string) => (data += chunk))
    req.on("end", () => resolve(data))
    req.on("error", reject)
  })
}

/** A page navigation, as opposed to an API call, a module or an asset. */
function isDocumentRequest(req: IncomingMessage, url: URL): boolean {
  if (req.method !== "GET") return false
  if (!String(req.headers.accept ?? "").includes("text/html")) return false
  if (/^\/(@|__|node_modules\/|src\/|api\/)/.test(url.pathname)) return false
  return !/\.[a-z0-9]{2,5}$/i.test(url.pathname)
}

export interface FakeApiHandler {
  /** The Connect middleware. Exposed for tests and non-Vite servers. */
  middleware: Middleware
  /** Resolves once scenarios are loaded. */
  ready: () => Promise<FakeApiStore>
}

/** The scenarios a module exports, as `presets` or as its default export. */
function presetsFromModule(path: string, mod: Record<string, unknown>): FakeApiPreset[] {
  const presets = mod.presets ?? mod.default
  if (!Array.isArray(presets)) {
    throw new Error(`${path} must export its fake API scenarios as \`presets\` (an array).`)
  }
  return presets as FakeApiPreset[]
}

/**
 * @param loadModule How a `presets` module path is loaded. The Vite plugin
 *   passes the dev server's SSR loader, so the app's aliases resolve and an
 *   edited fixture is picked up on the next request.
 */
export function createFakeApiHandler(options: FakeApiOptions, loadModule?: LoadModule): FakeApiHandler {
  const trpcPath = options.trpcPath ?? DEFAULT_TRPC_PATH
  const enabled = options.enabled ?? isFakeApiRequested()
  const refuseUnder = options.refuseWritesUnder === undefined ? "/api/" : options.refuseWritesUnder
  const readOnlyMessage = options.readOnlyMessage ?? DEFAULT_READ_ONLY
  const accentColor = options.accentColor ?? DEFAULT_ACCENT
  const title = options.title ?? "App"
  const overlay = overlaySnippet({
    basePath: STUDIO_PATH,
    title,
    accentColor,
    launcherBottom: options.launcherBottom ?? 76,
  })
  const { cookieName } = options

  const source = options.presets
  const storeOptions = {
    enabled,
    defaultPreset: options.defaultPreset,
    readOnlyMessage,
    slowMs: options.slowMs ?? 2500,
  }
  let storePromise: Promise<FakeApiStore> | undefined
  const sessionStores = new Map<string, FakeApiStore>()
  const load = async (): Promise<FakeApiPreset[]> => {
    if (typeof source === "string") {
      if (!loadModule) throw new Error("A presets module path needs the Vite plugin, which loads it.")
      return presetsFromModule(source, await loadModule(source))
    }
    return typeof source === "function" ? source() : source
  }
  let loaded: FakeApiPreset[] | undefined
  const ready = async (): Promise<FakeApiStore> => {
    const store = await (storePromise ??= load().then((presets) => {
      loaded = presets
      return createFakeApiStore(presets, storeOptions)
    }))
    if (typeof source === "string") {
      // Vite caches the module until one of its files changes, so this is a
      // lookup on most requests and a fresh copy after an edit.
      const presets = await load()
      if (presets !== loaded) {
        loaded = presets
        store.replacePresets(presets)
        for (const sessionStore of sessionStores.values()) sessionStore.replacePresets(presets)
      }
    }
    return store
  }

  function sessionIdOf(req: IncomingMessage): string | null {
    const value = req.headers[FAKE_API_SESSION_HEADER]
    const id = Array.isArray(value) ? value[0] : value
    return id && /^[a-zA-Z0-9._:-]{1,128}$/.test(id) ? id : null
  }

  async function storeFor(req: IncomingMessage): Promise<{
    store: FakeApiStore
    sessionId: string | null
  }> {
    const shared = await ready()
    const sessionId = sessionIdOf(req)
    if (!sessionId) return { store: shared, sessionId: null }

    let sessionStore = sessionStores.get(sessionId)
    if (!sessionStore) {
      if (sessionStores.size >= SESSION_LIMIT) {
        const oldest = sessionStores.keys().next().value as string | undefined
        if (oldest) sessionStores.delete(oldest)
      }
      sessionStore = createFakeApiStore(loaded ?? [], storeOptions)
    } else {
      sessionStores.delete(sessionId)
    }
    sessionStores.set(sessionId, sessionStore)
    return { store: sessionStore, sessionId }
  }

  async function handle(req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost")

    // 1. `?fake=<scenario>` on any page: remember it for this browser and come
    //    back to the clean URL. Anything that is not a scenario (`off`) opts
    //    this browser out, even while the fake API is on for everyone.
    const requested = url.searchParams.get("fake")
    if (requested !== null && isDocumentRequest(req, url)) {
      const { store } = await storeFor(req)
      url.searchParams.delete("fake")
      res.statusCode = 302
      res.setHeader("set-cookie", cookieHeader(cookieName, store.isPreset(requested) ? requested : "off"))
      res.setHeader("location", url.pathname + url.search)
      res.end()
      return
    }

    // 2. The studio and its API.
    if (url.pathname === STUDIO_PATH || url.pathname.startsWith(`${STUDIO_PATH}/`)) {
      const { store, sessionId } = await storeFor(req)
      const active = store.presetFor(readCookie(req.headers.cookie, cookieName))
      const route = url.pathname.slice(STUDIO_PATH.length)

      if (route === "" || route === "/") {
        res.statusCode = 200
        res.setHeader("content-type", "text/html; charset=utf-8")
        res.end(studioPage({ basePath: STUDIO_PATH, title, accentColor }))
        return
      }
      if (route === "/api/state" && req.method === "GET") {
        sendJson(res, 200, { ...store.snapshot(), active })
        return
      }
      if (route === "/api/preset" && req.method === "PUT") {
        const body = JSON.parse((await readBody(req)) || "{}") as { preset?: string | null }
        const preset = body.preset ?? null
        if (preset !== null && !store.isPreset(preset)) {
          sendJson(res, 400, { error: `Unknown scenario: ${preset}` })
          return
        }
        // The global choice follows only while the fake API is on for
        // everyone; this browser's cookie follows either way.
        if (sessionId) store.setPreset(preset)
        else if (store.enabled && preset !== null) store.setPreset(preset)
        sendJson(res, 200, { ...store.snapshot(), active: preset }, {
          "set-cookie": cookieHeader(cookieName, preset ?? "off"),
        })
        return
      }
      if (route === "/api/overrides" && req.method === "PUT") {
        const body = JSON.parse((await readBody(req)) || "{}") as {
          path?: string
          variant?: FakeVariant | null
        }
        try {
          if (!body.path) throw new Error("Expected a procedure path.")
          store.setOverride(body.path, body.variant ?? null)
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          return
        }
        sendJson(res, 200, { ...store.snapshot(), active })
        return
      }
      if (route === "/api/activity" && req.method === "DELETE") {
        store.clearActivity()
        sendJson(res, 200, { ...store.snapshot(), active })
        return
      }
      if (route === "/api/overrides" && req.method === "DELETE") {
        store.resetOverrides()
        sendJson(res, 200, { ...store.snapshot(), active })
        return
      }
      if (route === "/api/session" && req.method === "DELETE" && sessionId) {
        sessionStores.delete(sessionId)
        sendJson(res, 200, { ...store.snapshot(), active })
        return
      }
      sendJson(res, 404, { error: "Unknown fake API route." })
      return
    }

    const { store } = await storeFor(req)
    const cookie = readCookie(req.headers.cookie, cookieName)
    const active = store.presetFor(cookie)

    // 3. The fake API is on for everyone and this browser has not chosen:
    //    hand it the default scenario. The cookie is added to this very
    //    request, so server rendering (which reads it to fake a session) sees
    //    the scenario now, and set on the response for every request after.
    if (store.enabled && cookie === null && active && isDocumentRequest(req, url)) {
      const pair = `${cookieName}=${encodeURIComponent(active)}`
      req.headers.cookie = req.headers.cookie ? `${req.headers.cookie}; ${pair}` : pair
      appendSetCookie(res, cookieHeader(cookieName, active))
    }

    if (!active) {
      // Opted out of a fake API that is on for everyone: keep the launcher,
      // or the only way back would be a URL nobody remembers.
      if (store.enabled && isDocumentRequest(req, url)) {
        injectBeforeBodyEnd(res, overlay)
      }
      next()
      return
    }

    // 4. tRPC: answered from the scenario. Nothing else reads the body, and
    //    only here, so a request that falls through arrives untouched.
    if (url.pathname === trpcPath || url.pathname.startsWith(`${trpcPath}/`)) {
      const method = req.method ?? "GET"
      const body = method === "POST" ? await readBody(req) : undefined
      const call = parseTrpcCall(url, trpcPath, body)
      const { results, delayMs } = store.answer(call, method, active)
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
      const { status, body: payload } = trpcBody(results, call.batched)
      res.statusCode = status
      res.setHeader("content-type", "application/json")
      res.end(payload)
      return
    }

    // 5. Other writes would reach the real server with a fake session.
    if (refuseUnder !== false && req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && url.pathname.startsWith(refuseUnder)) {
      sendJson(res, 403, { message: readOnlyMessage })
      return
    }

    // 6. Pages get the launcher.
    if (isDocumentRequest(req, url)) {
      injectBeforeBodyEnd(res, overlay)
    }
    next()
  }

  const middleware: Middleware = (req, res, next) => {
    handle(req, res, next).catch((error: unknown) => {
      if (res.headersSent) return next(error)
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    })
  }

  return { middleware, ready }
}

/**
 * The Vite plugin. Add it before the framework's own plugins so it sees
 * requests first.
 */
export function fakeApi(options: FakeApiOptions) {
  return {
    name: "olwiba-fake-api",
    apply: "serve" as const,
    configureServer(server: DevServerLike) {
      const { middleware } = createFakeApiHandler(options, (path) => server.ssrLoadModule(path))
      server.middlewares.use(middleware)
    },
  }
}
