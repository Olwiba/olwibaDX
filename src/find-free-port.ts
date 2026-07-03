import { createServer } from "node:net"

/**
 * Probe for the first free port from `start` up. Vite's own auto-increment
 * doesn't kick in reliably under the TanStack Start plugin, so dev servers
 * resolve the port themselves before passing it to `server.port`.
 */
export async function findFreePort(start: number, attempts = 20): Promise<number> {
  for (let port = start; port < start + attempts; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer()
        .once("error", () => resolve(false))
        .once("listening", () => probe.close(() => resolve(true)))
      probe.listen(port)
    })
    if (free) return port
  }
  throw new Error(`No free port found in range ${start}-${start + attempts - 1}`)
}

/**
 * Resolve the dev server port for a preferred base port, logging when the
 * preferred port is taken and a fallback is used.
 */
export async function resolveDevPort(preferred: number, attempts = 20): Promise<number> {
  const port = await findFreePort(preferred, attempts)
  if (port !== preferred) {
    console.log(`Port ${preferred} is in use — dev server will use ${port} instead.`)
  }
  return port
}
