/**
 * tRPC's HTTP protocol, both halves, with no tRPC dependency.
 *
 * Batched: `GET|POST <trpcPath>/a.b,c.d?batch=1`, inputs in `?input=` for
 * queries (`{"0":…,"1":…}`) or the body for mutations, answered with an
 * array in path order. Unbatched: one path, one input, one object back.
 * Responses are plain JSON, which is what a client without a transformer
 * expects. Apps with a transformer (superjson) are not supported yet.
 */

export interface TrpcCall {
  paths: string[]
  batched: boolean
  /** Input per path index. */
  inputs: Record<number, unknown>
}

export type TrpcResult =
  | { result: { data: unknown } }
  | { error: { message: string; code: number; data: { code: string; httpStatus: number; path: string } } }

const ERROR_CODES: Record<number, { code: string; rpc: number }> = {
  400: { code: "BAD_REQUEST", rpc: -32600 },
  401: { code: "UNAUTHORIZED", rpc: -32001 },
  403: { code: "FORBIDDEN", rpc: -32003 },
  404: { code: "NOT_FOUND", rpc: -32004 },
  500: { code: "INTERNAL_SERVER_ERROR", rpc: -32603 },
}

export function trpcError(path: string, status: number, message: string): TrpcResult {
  const known = ERROR_CODES[status] ?? ERROR_CODES[500]!
  return {
    error: { message, code: known.rpc, data: { code: known.code, httpStatus: status, path } },
  }
}

export function trpcData(data: unknown): TrpcResult {
  return { result: { data } }
}

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Reads a tRPC request. `url` must be relative to the tRPC mount
 * (`/properties.list,monitors.get?batch=1&input=…`) or absolute; `body` is
 * the raw request body, read only for mutations.
 */
export function parseTrpcCall(url: URL, trpcPath: string, body?: string): TrpcCall {
  const batched = url.searchParams.get("batch") === "1"
  const raw = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(trpcPath) + trpcPath.length))
  const paths = raw.replace(/^\/+/, "").split(",").filter(Boolean)
  const source = body !== undefined ? parseJson(body) : parseJson(url.searchParams.get("input"))

  let inputs: Record<number, unknown> = {}
  if (batched) {
    inputs = source !== null && typeof source === "object" ? (source as Record<number, unknown>) : {}
  } else if (source !== undefined) {
    inputs = { 0: source }
  }
  return { paths, batched, inputs }
}

/**
 * The body and status for a set of results. A single unbatched error takes
 * its own status; batches answer 200 and carry each error inside, which is
 * how tRPC's batch link expects them.
 */
export function trpcBody(results: TrpcResult[], batched: boolean): { status: number; body: string } {
  if (batched) return { status: 200, body: JSON.stringify(results) }
  const [only] = results
  const status = only && "error" in only ? only.error.data.httpStatus : 200
  return { status, body: JSON.stringify(only) }
}
