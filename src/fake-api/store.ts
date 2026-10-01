import { trpcData, trpcError, type TrpcCall, type TrpcResult } from "./trpc"
import {
  ERROR_VARIANTS,
  type FakeApiActivity,
  type FakeApiPreset,
  type FakeVariant,
} from "./types"

/**
 * The fake API's state, held in the dev server's memory: which scenario is
 * active when none is chosen per browser, which procedures are overridden,
 * and what was asked for recently. Restarting the dev server resets it, which
 * is the point: a fake state should never outlive the session that chose it.
 */

const ACTIVITY_LIMIT = 60

const ERROR_LABELS: Record<string, string> = {
  "error:401": "Not signed in (401)",
  "error:403": "Forbidden (403)",
  "error:404": "Not found (404)",
  "error:500": "Server error (500)",
}

export interface ProcedureSummary {
  path: string
  /** Router the procedure belongs to: `properties` for `properties.list`. */
  group: string
  override: FakeVariant | null
  /** Scenarios that define a fixture for it. */
  definedIn: string[]
  variants: { id: FakeVariant; label: string }[]
  /** When it was last requested in this session, if it was. */
  lastCalledAt: string | null
}

export interface FakeApiSnapshot {
  enabled: boolean
  preset: string | null
  presets: { id: string; label: string; description?: string }[]
  procedures: ProcedureSummary[]
  activity: FakeApiActivity[]
}

export interface AnswerResult {
  results: TrpcResult[]
  /** How long to hold the response, for `slow`. */
  delayMs: number
}

export interface FakeApiStoreOptions {
  enabled: boolean
  defaultPreset?: string
  readOnlyMessage: string
  slowMs: number
}

export type FakeApiStore = ReturnType<typeof createFakeApiStore>

export function createFakeApiStore(initialPresets: FakeApiPreset[], options: FakeApiStoreOptions) {
  let presets = initialPresets
  if (presets.length === 0) throw new Error("The fake API needs at least one scenario.")
  let byId = new Map(presets.map((entry) => [entry.id, entry]))
  const fallback = options.defaultPreset && byId.has(options.defaultPreset) ? options.defaultPreset : presets[0]!.id

  let preset: string | null = options.enabled ? fallback : null
  const overrides = new Map<string, FakeVariant>()
  const activity: FakeApiActivity[] = []
  const lastCalled = new Map<string, string>()

  function isPreset(id: string | null | undefined): id is string {
    return !!id && byId.has(id)
  }

  /**
   * The scenario answering a request: the browser's own choice (its cookie)
   * when it made one, otherwise the global one while the fake API is on.
   */
  function presetFor(cookieValue: string | null | undefined): string | null {
    if (cookieValue === "off") return null
    if (isPreset(cookieValue)) return cookieValue
    return preset
  }

  function setPreset(id: string | null): void {
    if (id !== null && !isPreset(id)) throw new Error(`Unknown scenario: ${id}`)
    preset = id
  }

  function setOverride(path: string, variant: FakeVariant | null): void {
    if (variant === null) {
      overrides.delete(path)
      return
    }
    const valid =
      variant === "slow" ||
      (ERROR_VARIANTS as readonly string[]).includes(variant) ||
      (variant.startsWith("preset:") && isPreset(variant.slice("preset:".length)))
    if (!valid) throw new Error(`Unknown variant: ${variant}`)
    overrides.set(path, variant)
  }

  function resetOverrides(): void {
    overrides.clear()
  }

  function clearActivity(): void {
    activity.length = 0
  }

  /**
   * Swaps in edited fixtures while keeping the session's choices. Choices that
   * point at a scenario which no longer exists are dropped.
   */
  function replacePresets(next: FakeApiPreset[]): void {
    if (next.length === 0) return
    presets = next
    byId = new Map(next.map((entry) => [entry.id, entry]))
    if (preset !== null && !byId.has(preset)) preset = next[0]!.id
    for (const [path, variant] of overrides) {
      if (variant.startsWith("preset:") && !byId.has(variant.slice("preset:".length))) overrides.delete(path)
    }
  }

  function fixtureFrom(presetId: string, path: string): { found: boolean; value: unknown } {
    const responses = byId.get(presetId)?.responses ?? {}
    if (!(path in responses)) return { found: false, value: undefined }
    return { found: true, value: responses[path] }
  }

  function record(entry: FakeApiActivity): void {
    activity.unshift(entry)
    if (activity.length > ACTIVITY_LIMIT) activity.length = ACTIVITY_LIMIT
    lastCalled.set(entry.path, entry.at)
  }

  /** Answers every procedure in a call from `presetId`, applying overrides. */
  function answer(call: TrpcCall, method: string, presetId: string, now = new Date()): AnswerResult {
    let delayMs = 0
    const isWrite = method !== "GET" && method !== "HEAD"
    const results = call.paths.map((path, index): TrpcResult => {
      const override = overrides.get(path)
      let source = presetId
      let servedBy = presetId

      if (override?.startsWith("error:")) {
        const status = Number(override.slice("error:".length))
        record({ at: now.toISOString(), method, path, servedBy: override, ok: false, status })
        return trpcError(path, status, `Simulated ${ERROR_LABELS[override] ?? status} from the fake API.`)
      }
      if (override === "slow") {
        delayMs = Math.max(delayMs, options.slowMs)
        servedBy = `${presetId} (slow)`
      }
      if (override?.startsWith("preset:")) {
        source = override.slice("preset:".length)
        servedBy = `${source} (override)`
      }

      const fixture = fixtureFrom(source, path)
      if (!fixture.found) {
        record({ at: now.toISOString(), method, path, servedBy, ok: false, status: isWrite ? 403 : 500 })
        return isWrite
          ? trpcError(path, 403, options.readOnlyMessage)
          : trpcError(
              path,
              500,
              `No fake API fixture for "${path}" in the "${source}" scenario. Add one to the app's scenarios.`,
            )
      }

      const value =
        typeof fixture.value === "function"
          ? (fixture.value as (input: unknown) => unknown)(call.inputs[index])
          : fixture.value
      if (value === undefined) {
        // A fixture that looks a record up and finds nothing answers the way
        // the real API would, rather than with an empty success.
        record({ at: now.toISOString(), method, path, servedBy, ok: false, status: 404 })
        return trpcError(path, 404, "Not found in this fake API scenario.")
      }
      record({ at: now.toISOString(), method, path, servedBy, ok: true, status: 200 })
      return trpcData(value)
    })
    return { results, delayMs }
  }

  function snapshot(): FakeApiSnapshot {
    const paths = new Set<string>()
    for (const entry of presets) for (const path of Object.keys(entry.responses)) paths.add(path)
    for (const path of lastCalled.keys()) paths.add(path)

    const procedures = [...paths].sort().map((path): ProcedureSummary => {
      const definedIn = presets.filter((p) => path in p.responses).map((p) => p.id)
      return {
        path,
        group: path.includes(".") ? path.slice(0, path.indexOf(".")) : "other",
        override: overrides.get(path) ?? null,
        definedIn,
        lastCalledAt: lastCalled.get(path) ?? null,
        variants: [
          ...definedIn.map((id) => ({
            id: `preset:${id}` as FakeVariant,
            label: `From ${byId.get(id)!.label}`,
          })),
          { id: "slow", label: `Slow (${Math.round(options.slowMs / 100) / 10}s)` },
          ...ERROR_VARIANTS.map((id) => ({ id, label: ERROR_LABELS[id]! })),
        ],
      }
    })

    return {
      enabled: options.enabled,
      preset,
      presets: presets.map(({ id, label, description }) => ({ id, label, description })),
      procedures,
      activity: [...activity],
    }
  }

  return {
    presetFor,
    setPreset,
    setOverride,
    resetOverrides,
    replacePresets,
    clearActivity,
    answer,
    snapshot,
    isPreset,
    labelOf: (id: string | null) => (id ? (byId.get(id)?.label ?? id) : null),
    get enabled() {
      return options.enabled
    },
  }
}
