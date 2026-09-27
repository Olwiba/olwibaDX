/**
 * A fixture for one procedure: the data to answer with, or a function of the
 * procedure's input for fixtures that depend on it (a record looked up by
 * id). Functions are never valid response data, so the two cannot collide.
 */
export type FakeResponse = unknown | ((input: unknown) => unknown)

/**
 * A whole-app scenario: one coherent state of the product ("populated",
 * "empty", "at plan limit"), as the fixtures every procedure answers with.
 */
export interface FakeApiPreset {
  id: string
  /** Shown in the studio and on the launcher. */
  label: string
  /** One line on what the scenario is for. */
  description?: string
  /** Procedure path (`properties.list`) to its fixture. */
  responses: Record<string, FakeResponse>
}

/**
 * How one procedure is answered instead of by the active scenario:
 *
 * - `preset:<id>`: that scenario's fixture, while every other procedure
 *   keeps the active scenario's. This is how states are mixed.
 * - `slow`: the active scenario's fixture, after a delay, for loading states.
 * - `error:<status>`: a tRPC error (401, 403, 404 or 500), for error states.
 */
export type FakeVariant = `preset:${string}` | "slow" | "error:401" | "error:403" | "error:404" | "error:500"

export const ERROR_VARIANTS = ["error:401", "error:403", "error:404", "error:500"] as const

export interface FakeApiActivity {
  at: string
  method: string
  path: string
  /** What answered: a scenario id, an override, or a refusal. */
  servedBy: string
  ok: boolean
}

export interface FakeApiOptions {
  /**
   * The scenarios. Prefer a module path (`"/src/mocks/fake-api.ts"`) that
   * exports them as `presets`: the dev server loads it the way it loads app
   * code, so the app's path aliases work, the fixtures stay out of the Vite
   * config's own bundle, and an edited fixture applies on the next request
   * without a restart. An array, or a function returning one, also works.
   */
  presets: string | FakeApiPreset[] | (() => FakeApiPreset[] | Promise<FakeApiPreset[]>)
  /** Scenario used when the fake API is switched on without one chosen. Defaults to the first. */
  defaultPreset?: string
  /**
   * The cookie that carries the active scenario. The app's own server code
   * reads it too (to fake a session during SSR), so it must match.
   */
  cookieName: string
  /** Where the tRPC handler is mounted. Default `/api/trpc`. */
  trpcPath?: string
  /**
   * Answer every request from the fake API unless a tab opts out. Default:
   * on when `FAKE_API=1`, which `dx vite --fake-api` sets. Off, a scenario is
   * still available per browser through `?fake=<id>`.
   */
  enabled?: boolean
  /**
   * While a scenario is active, writes under this prefix that are not tRPC
   * are refused rather than reaching the real server with a fake session.
   * Default `/api/`. `false` turns it off.
   */
  refuseWritesUnder?: string | false
  /** Refusal message for writes the scenario does not answer. */
  readOnlyMessage?: string
  /** Product name for the studio heading. */
  title?: string
  /** Launcher and selection colour. Default a neutral blue. */
  accentColor?: string
  /** Delay for the `slow` variant, in milliseconds. Default 2500. */
  slowMs?: number
}
