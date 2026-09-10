import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkEnv, formatEnvReport, parseEnv } from "./env-check"

const EXAMPLE = `
# Private docs / purchase gate
DATABASE_URL=file:./dev.db
BETTER_AUTH_SECRET=change-me
PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=preview
RESEND_API_KEY=
`

describe("parsing", () => {
  test("keeps keys and discards values", () => {
    const parsed = parseEnv("FOO=secret-value\nBAR=")
    assert.deepEqual([...parsed.keys.keys()], ["FOO", "BAR"])
    assert.equal(parsed.keys.get("FOO"), true)
    assert.equal(parsed.keys.get("BAR"), false)
  })

  test("ignores comments and blank lines", () => {
    assert.equal(parseEnv("# note\n\nFOO=1").keys.size, 1)
  })

  test("accepts shell-style export", () => {
    assert.deepEqual([...parseEnv("export FOO=1").keys.keys()], ["FOO"])
  })

  test("last assignment wins and the repeat is reported", () => {
    const parsed = parseEnv("FOO=\nFOO=1")
    assert.equal(parsed.keys.get("FOO"), true)
    assert.deepEqual(parsed.duplicates, ["FOO"])
  })
})

describe("the failures this exists to catch", () => {
  // The VITE_ migration left keys addressing names nothing read, so a gate sat
  // off for weeks while the file said it was on.
  test("a prefixed leftover is reported as a rename, not an unknown", () => {
    const result = checkEnv({
      example: EXAMPLE,
      actual: `
DATABASE_URL=x
BETTER_AUTH_SECRET=x
VITE_PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=resend
`,
    })

    const renamed = result.findings.find((finding) => finding.kind === "renamed")
    assert.ok(renamed, "expected a rename finding")
    assert.equal(renamed.kind === "renamed" && renamed.key, "VITE_PRO_CONTENT_GATED")
    assert.equal(renamed.kind === "renamed" && renamed.looksLike, "PRO_CONTENT_GATED")

    // And the setting it was meant to carry is reported absent.
    assert.ok(
      result.findings.some(
        (finding) => finding.kind === "missing" && finding.key === "PRO_CONTENT_GATED",
      ),
    )
  })

  test("a key typed with spaces is caught", () => {
    const result = checkEnv({ example: EXAMPLE, actual: "PRO CONTENT GATED=true" })
    const names = result.findings.map((finding) => ("key" in finding ? finding.key : ""))
    assert.ok(names.includes("PRO CONTENT GATED"))
  })
})

describe("reporting", () => {
  test("passes when the environment matches", () => {
    const result = checkEnv({
      example: EXAMPLE,
      actual: `
DATABASE_URL=x
BETTER_AUTH_SECRET=x
PRO_CONTENT_GATED=true
UI_PRO_SIGNUPS_ENABLED=false
EMAIL_PROVIDER=resend
`,
      // Blank in the example, so absence is deliberate.
      optional: ["RESEND_API_KEY"],
    })

    assert.deepEqual(result.findings, [])
    assert.ok(formatEnvReport(result).includes("PASS"))
  })

  test("flags a key present but blank where the example shows a value", () => {
    const result = checkEnv({ example: "EMAIL_PROVIDER=preview", actual: "EMAIL_PROVIDER=" })
    assert.ok(
      result.findings.some(
        (finding) => finding.kind === "empty" && finding.key === "EMAIL_PROVIDER",
      ),
    )
  })

  test("a blank in both is left alone", () => {
    const result = checkEnv({ example: "RESEND_API_KEY=", actual: "RESEND_API_KEY=" })
    assert.deepEqual(result.findings, [])
  })

  // The whole input is credentials. A report that echoes one is a worse problem
  // than the drift it found.
  test("never puts a value in the report", () => {
    const secret = "sk-live-do-not-print-this"
    const result = checkEnv({
      example: "DATABASE_URL=file:./dev.db\nAPI_KEY=example",
      actual: `API_KEY=${secret}\nSTRIPE_SECRET=${secret}\nnonsense-${secret}`,
    })

    const report = formatEnvReport(result)
    assert.ok(!report.includes(secret), "a value reached the report")
    assert.ok(report.includes("STRIPE_SECRET"))
  })
})

describe("optionality comes from the example", () => {
  // Otherwise every unset credential for a service this deployment does not use
  // is reported, and the real findings drown.
  test("a key blank in the example may be absent", () => {
    const result = checkEnv({ example: "RESEND_API_KEY=\nAPP_URL=http://x", actual: "APP_URL=http://y" })
    assert.deepEqual(result.findings, [])
  })

  test("a key with a value in the example may not be absent", () => {
    const result = checkEnv({ example: "APP_URL=http://x", actual: "" })
    assert.ok(
      result.findings.some((finding) => finding.kind === "missing" && finding.key === "APP_URL"),
    )
  })
})
