import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

/**
 * `dx vite [...vite args]`: runs the project's own Vite, after taking out the
 * flags that belong to dx.
 *
 * Vite rejects options it does not know (`Unknown option --fake-api`), so an
 * app script can not pass `bun run dev --fake-api` straight through to it.
 * With `"dev": "... && dx vite dev"`, it can: dx removes the flag, sets the
 * environment variable the plugin reads, and hands Vite the rest.
 *
 * | dx flag      | Effect                                                    |
 * |--------------|-----------------------------------------------------------|
 * | `--fake-api` | `FAKE_API=1`: every browser gets the fake API's default   |
 * |              | scenario, with the studio launcher on every page          |
 */

export interface ViteLaunch {
  args: string[]
  env: Record<string, string>
}

const DX_FLAGS: Record<string, Record<string, string>> = {
  "--fake-api": { FAKE_API: "1" },
  "--fakeAPI": { FAKE_API: "1" },
}

export function splitViteArgs(argv: string[]): ViteLaunch {
  const env: Record<string, string> = {}
  const args: string[] = []
  for (const arg of argv) {
    const flagEnv = DX_FLAGS[arg]
    if (flagEnv) Object.assign(env, flagEnv)
    else args.push(arg)
  }
  return { args, env }
}

/**
 * The project's own Vite CLI. Read from its `bin` field, because Vite's
 * `exports` map does not expose `bin/vite.js` to `require.resolve`.
 */
export function resolveViteBin(cwd: string): string | null {
  try {
    const manifestPath = createRequire(join(cwd, "package.json")).resolve("vite/package.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin?: string | Record<string, string> }
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.vite
    return bin ? join(dirname(manifestPath), bin) : null
  } catch {
    return null
  }
}

export async function runVite(argv: string[], cwd = process.cwd()): Promise<number> {
  const { args, env } = splitViteArgs(argv)
  const viteBin = resolveViteBin(cwd)
  if (!viteBin) {
    process.stderr.write("dx vite: no vite installed in this project.\n")
    return 1
  }

  if (env.FAKE_API) process.stdout.write("[dx] fake API on: open any page and use the launcher at the bottom right.\n")

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [viteBin, ...args], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...env },
    })
    const forward = (signal: NodeJS.Signals) => () => child.kill(signal)
    process.on("SIGINT", forward("SIGINT"))
    process.on("SIGTERM", forward("SIGTERM"))
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 0)))
  })
}
