import type { FakeApiSnapshot } from "./store"
import type { FakeVariant } from "./types"
import { FAKE_API_SESSION_HEADER, STUDIO_PATH } from "./plugin"

export interface FakeApiControllerOptions {
  baseUrl: string
  /** Stable per worker/test identity used to isolate overrides and activity. */
  sessionId?: string
  fetch?: typeof globalThis.fetch
}

export type FakeApiControllerState = FakeApiSnapshot & { active: string | null }

/** Typed control surface for agents and browser-test fixtures. */
export class FakeApiController {
  readonly sessionId: string
  private readonly baseUrl: string
  private readonly requestFetch: typeof globalThis.fetch

  constructor(options: FakeApiControllerOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "")
    this.sessionId = options.sessionId ?? crypto.randomUUID()
    this.requestFetch = options.fetch ?? globalThis.fetch
  }

  private async request(path: string, init?: RequestInit): Promise<FakeApiControllerState> {
    const response = await this.requestFetch(`${this.baseUrl}${STUDIO_PATH}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        [FAKE_API_SESSION_HEADER]: this.sessionId,
        ...init?.headers,
      },
    })
    const body = (await response.json()) as FakeApiControllerState & { error?: string }
    if (!response.ok) throw new Error(body.error ?? `Fake API request failed (${response.status}).`)
    return body
  }

  state(): Promise<FakeApiControllerState> {
    return this.request("/api/state")
  }

  selectPreset(preset: string | null): Promise<FakeApiControllerState> {
    return this.request("/api/preset", { method: "PUT", body: JSON.stringify({ preset }) })
  }

  setOverride(path: string, variant: FakeVariant | null): Promise<FakeApiControllerState> {
    return this.request("/api/overrides", {
      method: "PUT",
      body: JSON.stringify({ path, variant }),
    })
  }

  resetOverrides(): Promise<FakeApiControllerState> {
    return this.request("/api/overrides", { method: "DELETE" })
  }

  clearActivity(): Promise<FakeApiControllerState> {
    return this.request("/api/activity", { method: "DELETE" })
  }

  async activity() {
    return (await this.state()).activity
  }

  dispose(): Promise<FakeApiControllerState> {
    return this.request("/api/session", { method: "DELETE" })
  }
}

export function createFakeApiController(options: FakeApiControllerOptions): FakeApiController {
  return new FakeApiController(options)
}
