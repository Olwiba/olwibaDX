import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkDeps, formatDepReport, isExactPin, isUncomparableSpec } from "./dep-check"

/** Every range is satisfied only by the exact version named after `^`. */
const naiveSatisfies = (version: string, range: string) =>
  range.startsWith("^") ? version === range.slice(1) : undefined

/** Numeric-tuple ordering, enough for the three-part versions used in tests. */
const compare = (a: string, b: string) => {
  const parse = (v: string) => v.split(".").map(Number)
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

const check = (
  declared: Array<[string, string]>,
  installed: Record<string, string | null>,
  satisfies?: (v: string, r: string) => boolean | undefined,
) =>
  checkDeps({
    declared: declared.map(([name, range]) => ({ name, range })),
    installedVersion: (name) => (name in installed ? installed[name] : null),
    satisfies,
    compare,
  })

describe("exact pin detection", () => {
  test("bare versions are exact", () => {
    for (const range of ["0.1.55", "1.0.0", "10.20.30", "1.2.3-beta.1", "1.2.3+build.5"]) {
      assert.equal(isExactPin(range), true, range)
    }
  })

  test("anything with an operator is not", () => {
    for (const range of ["^1.2.3", "~1.2.3", ">=1.2.3", "1.2.x", "*", "1.2.3 || 2.0.0", "1.2"]) {
      assert.equal(isExactPin(range), false, range)
    }
  })

  test("surrounding whitespace does not change the verdict", () => {
    assert.equal(isExactPin("  1.2.3  "), true)
  })
})

describe("uncomparable specs", () => {
  test("source protocols are skipped", () => {
    for (const range of [
      "workspace:*",
      "link:../thing",
      "file:./vendor/thing.tgz",
      "npm:other-package@1.0.0",
      "github:owner/repo",
      "git+https://example.com/repo.git",
      "https://example.com/thing.tgz",
      "catalog:default",
      "*",
      "latest",
    ]) {
      assert.equal(isUncomparableSpec(range), true, range)
    }
  })

  test("real ranges are comparable", () => {
    for (const range of ["1.2.3", "^1.2.3", ">=1.0.0 <2.0.0"]) {
      assert.equal(isUncomparableSpec(range), false, range)
    }
  })
})

describe("the case this exists for", () => {
  // The exact shape of the 2026-09-17 nestrrr failure: everything present and
  // resolvable, four packages quietly behind their pins. A presence-only check
  // reports this as healthy.
  test("catches exact pins that are installed at the wrong version", () => {
    const result = check(
      [
        ["@olwiba/cn", "0.1.55"],
        ["@olwiba/docs", "0.1.53"],
        ["@olwiba/ui", "0.2.37"],
        ["@olwiba/ui-pro", "0.1.63"],
        ["@olwiba/render", "0.1.12"],
      ],
      {
        "@olwiba/cn": "0.1.53",
        "@olwiba/docs": "0.1.52",
        "@olwiba/ui": "0.2.36",
        "@olwiba/ui-pro": "0.1.61",
        "@olwiba/render": "0.1.12",
      },
    )

    assert.equal(result.findings.length, 4)
    assert.equal(result.blocking, 4)
    assert.equal(result.okCount, 1)
    assert.ok(result.findings.every((finding) => finding.kind === "stale"))
  })

  test("an exact pin that matches is not a finding", () => {
    const result = check([["@olwiba/cn", "0.1.55"]], { "@olwiba/cn": "0.1.55" })
    assert.equal(result.findings.length, 0)
    assert.equal(result.okCount, 1)
  })
})

describe("which direction the pin disagrees", () => {
  test("older than the pin is stale, and blocks", () => {
    const result = check([["@olwiba/ui-pro", "0.1.63"]], { "@olwiba/ui-pro": "0.1.61" })
    assert.equal(result.findings[0].kind, "stale")
    assert.equal(result.blocking, 1)
  })

  // Workspace hoisting: the root install resolves one copy for all members and
  // takes the highest, so a member whose pin lags gets a newer package than it
  // declared. Blocking on that would wedge every lagging member permanently,
  // since reinstalling just reproduces it.
  test("newer than the pin is ahead, and only warns", () => {
    const result = check([["@olwiba/cn", "0.1.54"]], { "@olwiba/cn": "0.1.55" })
    assert.equal(result.findings[0].kind, "ahead")
    assert.equal(result.blocking, 0)
    assert.equal(result.warnings, 1)
  })

  test("without a comparator an unequal pin stays blocking", () => {
    const result = checkDeps({
      declared: [{ name: "@olwiba/cn", range: "0.1.54" }],
      installedVersion: () => "0.1.55",
    })
    assert.equal(result.findings[0].kind, "stale")
    assert.equal(result.blocking, 1)
  })

  test("the two get different advice", () => {
    const stale = formatDepReport(check([["a", "2.0.0"]], { a: "1.0.0" }))
    assert.match(stale, /bun install/)
    assert.ok(!stale.includes("hoisting"))

    const ahead = formatDepReport(check([["b", "1.0.0"]], { b: "2.0.0" }))
    assert.match(ahead, /hoisting/)
    assert.match(ahead, /Raise the pin/)
    assert.ok(!ahead.includes("bun install"))
  })
})

describe("presence", () => {
  test("declared and absent is missing, and blocks", () => {
    const result = check([["left-pad", "1.3.0"]], {})
    assert.deepEqual(result.findings, [{ kind: "missing", name: "left-pad", wanted: "1.3.0" }])
    assert.equal(result.blocking, 1)
  })

  test("present with an unreadable manifest blocks rather than passing", () => {
    const result = check([["broken", "1.0.0"]], { broken: "" })
    assert.equal(result.findings[0].kind, "unreadable")
    assert.equal(result.blocking, 1)
  })
})

describe("ranges", () => {
  test("drift inside a range warns rather than blocking", () => {
    const result = check([["react", "^19.0.0"]], { react: "18.3.1" }, naiveSatisfies)
    assert.equal(result.findings.length, 1)
    assert.equal(result.findings[0].kind, "drifted")
    assert.equal(result.blocking, 0)
    assert.equal(result.warnings, 1)
  })

  test("a satisfied range is clean", () => {
    const result = check([["react", "^19.0.0"]], { react: "19.0.0" }, naiveSatisfies)
    assert.equal(result.findings.length, 0)
    assert.equal(result.okCount, 1)
  })

  test("no evaluator counts as skipped, never as a pass or a failure", () => {
    const result = check([["react", "^19.0.0"]], { react: "18.3.1" })
    assert.equal(result.findings.length, 0)
    assert.equal(result.okCount, 0)
    assert.equal(result.skippedCount, 1)
  })

  test("an evaluator that declines one range still judges the others", () => {
    const result = check(
      [
        ["react", "^19.0.0"],
        ["weird", ">=1 <2 || 3.x"],
      ],
      { react: "18.3.1", weird: "5.0.0" },
      naiveSatisfies,
    )
    assert.equal(result.findings.length, 1)
    assert.equal(result.findings[0].name, "react")
    assert.equal(result.skippedCount, 1)
  })
})

describe("skipping", () => {
  test("a workspace spec is skipped even when nothing is installed", () => {
    const result = check([["@olwiba/dx", "workspace:*"]], {})
    assert.equal(result.findings.length, 0)
    assert.equal(result.skippedCount, 1)
  })
})

describe("report", () => {
  test("a clean run states the count on one line", () => {
    const report = formatDepReport(check([["@olwiba/cn", "0.1.55"]], { "@olwiba/cn": "0.1.55" }))
    assert.match(report, /^\[dep-check\] 1 of 1 dependencies agree/)
    assert.ok(!report.includes("\n"))
  })

  test("a clean run mentions what it could not compare", () => {
    const report = formatDepReport(check([["@olwiba/dx", "workspace:*"]], {}))
    assert.match(report, /1 not comparable/)
  })

  test("findings name the wanted and installed versions", () => {
    const report = formatDepReport(check([["@olwiba/ui-pro", "0.1.63"]], { "@olwiba/ui-pro": "0.1.61" }))
    assert.match(report, /Stale/)
    assert.match(report, /@olwiba\/ui-pro\s+wants 0\.1\.63, has 0\.1\.61/)
    assert.match(report, /bun install/)
  })
})
