import type { ServerResponse } from "node:http"

type Headers = Record<string, unknown> | unknown[]

/**
 * Reads a header from any shape `writeHead` accepts: an object, a flat
 * `[name, value, ...]` list (what srvx, under TanStack Start, passes), or a
 * list of pairs.
 */
function headerFrom(headers: Headers, name: string): string | undefined {
  for (const [key, value] of headerEntries(headers)) {
    if (String(key).toLowerCase() === name) return String(value)
  }
  return undefined
}

function headerEntries(headers: Headers): [unknown, unknown][] {
  if (!Array.isArray(headers)) return Object.entries(headers)
  if (headers.every(Array.isArray)) return headers as [unknown, unknown][]
  const entries: [unknown, unknown][] = []
  for (let i = 0; i + 1 < headers.length; i += 2) entries.push([headers[i], headers[i + 1]])
  return entries
}

/** The same headers in the same shape, without `name`. */
function withoutHeader(headers: Headers, name: string): Headers {
  const keep = ([key]: [unknown, unknown]) => String(key).toLowerCase() !== name
  if (!Array.isArray(headers)) return Object.fromEntries(Object.entries(headers).filter(keep))
  if (headers.every(Array.isArray)) return (headers as [unknown, unknown][]).filter(keep)
  return headerEntries(headers).filter(keep).flat()
}

/**
 * Inserts `snippet` before `</body>` in an HTML response as it streams.
 *
 * Server-rendered frameworks (TanStack Start, among others) stream their
 * document through the dev server rather than going through Vite's
 * `transformIndexHtml`, so the only place to add dev UI to every page is the
 * response itself. Chunks pass straight through until the one holding
 * `</body>`, which is rewritten; nothing is buffered, so streaming still
 * streams. Responses that are not HTML are left alone.
 */
export function injectBeforeBodyEnd(res: ServerResponse, snippet: string): void {
  let isHtml: boolean | undefined
  let injected = false

  const checkHtml = (declaredType?: string) => {
    if (isHtml === undefined) {
      const type = declaredType ?? String(res.getHeader("content-type") ?? "")
      isHtml = type.includes("text/html")
      // The body grows, so a declared length would be wrong.
      if (isHtml) res.removeHeader("content-length")
    }
    return isHtml
  }

  const rewrite = (chunk: unknown): unknown => {
    if (injected || chunk === undefined || chunk === null || typeof chunk === "function") return chunk
    if (!checkHtml()) return chunk
    const text =
      typeof chunk === "string"
        ? chunk
        : chunk instanceof Uint8Array
          ? Buffer.from(chunk).toString("utf8")
          : String(chunk)
    const at = text.lastIndexOf("</body>")
    // Untouched: a chunk that splits a multibyte character must not be re-encoded.
    if (at === -1) return chunk
    injected = true
    return text.slice(0, at) + snippet + text.slice(at)
  }

  const originalWriteHead = res.writeHead.bind(res) as (...args: unknown[]) => ServerResponse
  res.writeHead = ((...args: unknown[]) => {
    // `writeHead(status, headers)` or `writeHead(status, statusText, headers)`.
    const at = args.findIndex((arg, index) => index > 0 && arg !== null && typeof arg === "object")
    if (at !== -1) {
      const headers = args[at] as Headers
      const declared = headerFrom(headers, "content-type")
      if (checkHtml(declared ?? String(res.getHeader("content-type") ?? ""))) {
        args[at] = withoutHeader(headers, "content-length")
      }
    }
    return originalWriteHead(...args)
  }) as ServerResponse["writeHead"]

  const originalWrite = res.write.bind(res) as (...args: unknown[]) => boolean
  res.write = ((chunk: unknown, ...rest: unknown[]) =>
    originalWrite(rewrite(chunk), ...rest)) as ServerResponse["write"]

  const originalEnd = res.end.bind(res) as (...args: unknown[]) => ServerResponse
  res.end = ((chunk?: unknown, ...rest: unknown[]) =>
    originalEnd(rewrite(chunk), ...rest)) as ServerResponse["end"]
}
