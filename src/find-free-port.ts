import { createServer } from "node:net"

/**
 * Probe for the first free port from `start` up. Vite's own auto-increment
 * doesn't kick in reliably under the TanStack Start plugin, so dev servers
 * resolve the port themselves before passing it to `server.port`.
 */
/** True when `port` can be bound right now. */
async function isFree(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const probe = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => probe.close(() => resolve(true)))
    probe.listen(port)
  })
}

export async function findFreePort(start: number, attempts = 20): Promise<number> {
  for (let port = start; port < start + attempts; port++) {
    if (await isFree(port)) return port
  }
  throw new Error(`No free port found in range ${start}-${start + attempts - 1}`)
}

/**
 * Resolve the dev server port, or fail.
 *
 * Deliberately does **not** fall back to the next free port. Silently moving to
 * 3001 looks like it worked and then breaks something unrelated several minutes
 * later: `BETTER_AUTH_TRUSTED_ORIGINS` pins an origin, so the app boots fine and
 * every sign-in fails with "Invalid origin" — a message that points at auth
 * config rather than at the port that actually moved.
 *
 * Running a second app at the same time is still supported, but has to be said
 * out loud: `PORT=3001 bun run dev`.
 */
export async function resolveDevPort(preferred: number): Promise<number> {
  if (await isFree(preferred)) return preferred

  throw new Error(
    `Port ${preferred} is already in use.\n\n` +
      `  Free it, or start this app on another port explicitly:\n` +
      `    PORT=${preferred + 1} bun run dev\n\n` +
      `  If you pick another port, add its origin to BETTER_AUTH_TRUSTED_ORIGINS\n` +
      `  or sign-in will fail with "Invalid origin".`,
  )
}
