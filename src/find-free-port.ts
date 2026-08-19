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
 * Resolve the dev server port for a preferred base port, falling back to the
 * next free one and saying so loudly.
 *
 * Falling back is the right default — a second app should start rather than
 * refuse — but the move used to be near-silent, and the port is not the thing
 * that breaks. What breaks is anything holding an absolute localhost URL:
 * sign-in fails "Invalid origin" if the origin is pinned, and magic links point
 * at the port you are no longer on.
 *
 * So callers are expected to do two things, and the log says so:
 *   - trust localhost on any port in dev (`http://localhost:*`)
 *   - derive `BETTER_AUTH_URL` from the port this returns, not from `.env`
 */
export async function resolveDevPort(preferred: number, attempts = 20): Promise<number> {
  const port = await findFreePort(preferred, attempts)
  if (port !== preferred) {
    console.warn(
      `\n  ⚠ Port ${preferred} is in use — this dev server is on ${port} instead.\n` +
        `    Absolute URLs built from .env still say ${preferred}. Anything that\n` +
        `    emails you a link (magic link, email verification) will point at the\n` +
        `    wrong port unless BETTER_AUTH_URL is derived from ${port}.\n`,
    )
  }
  return port
}
