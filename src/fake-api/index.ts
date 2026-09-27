/**
 * `@olwiba/dx/fake-api`: scenario-driven fake tRPC answers for development,
 * with an in-page studio to switch them. See ./plugin.ts.
 */
export { createFakeApiHandler, fakeApi, isFakeApiRequested, readCookie, STUDIO_PATH } from "./plugin"
export type { FakeApiHandler } from "./plugin"
export { injectBeforeBodyEnd } from "./inject"
export { createFakeApiStore } from "./store"
export type { FakeApiSnapshot, FakeApiStore, ProcedureSummary } from "./store"
export { parseTrpcCall, trpcBody, trpcData, trpcError } from "./trpc"
export type { TrpcCall, TrpcResult } from "./trpc"
export type { FakeApiActivity, FakeApiOptions, FakeApiPreset, FakeResponse, FakeVariant } from "./types"
