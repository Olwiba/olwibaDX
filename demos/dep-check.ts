import { checkDeps, formatDepReport } from "../src/dep-check"
import { demoHeader } from "./shared"

demoHeader(
  "dependency check",
  "A fabricated project held in memory — no package.json or node_modules is read.",
)

/**
 * The versions below are the real 2026-09-17 nestrrr failure, kept as written.
 *
 * Four `@olwiba/*` packages sat behind their pins for days. Every import
 * resolved, the types checked, the dev server booted, and the app ran against
 * `ui-pro` two releases older than the code expected. A check that only asked
 * "is it installed?" would have printed a green line through all of it, which
 * is the whole reason this one compares versions.
 */
const declared = {
  "@olwiba/cn": "0.1.55",
  "@olwiba/docs": "0.1.53",
  "@olwiba/ui": "0.2.37",
  "@olwiba/ui-pro": "0.1.63",
  "@olwiba/render": "0.1.12",
  "@olwiba/dx": "0.0.34",
  "@tanstack/react-router": "^1.167.0",
  react: "^19.0.0",
  "left-pad": "1.3.0",
  "@olwiba/local-thing": "workspace:*",
}

const installed: Record<string, string | null> = {
  "@olwiba/cn": "0.1.53",
  "@olwiba/docs": "0.1.52",
  "@olwiba/ui": "0.2.36",
  "@olwiba/ui-pro": "0.1.61",
  "@olwiba/render": "0.1.12",
  // Newer than the pin: the workspace root hoisted one copy for every member
  // and took the highest. Reinstalling reproduces it; the fix is the pin.
  "@olwiba/dx": "0.0.35",
  "@tanstack/react-router": "1.99.0",
  react: "19.0.0",
  // Declared, never installed.
  "left-pad": null,
}

const result = checkDeps({
  declared: Object.entries(declared).map(([name, range]) => ({ name, range })),
  installedVersion: (name) => installed[name] ?? null,
  satisfies: (version, range) => Bun.semver.satisfies(version, range),
  compare: (a, b) => Bun.semver.order(a, b),
})

process.stdout.write(`${formatDepReport(result)}\n`)

process.stdout.write(
  `${result.blocking} blocking, ${result.warnings} warning, ` +
    `${result.okCount} correct, ${result.skippedCount} not comparable\n` +
    `exit code would be ${result.blocking > 0 ? 1 : 0}\n`,
)
