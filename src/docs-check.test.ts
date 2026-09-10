import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkDocs, formatDocsReport } from "./docs-check"

const page = (file: string, source: string) => ({ file, source })

describe("what the rule applies to", () => {
  test("a page with a Sandbox needs an APIReference", () => {
    const result = checkDocs([page("a.mdx", '<Sandbox id="x" />')])
    assert.deepEqual(result.findings, [{ kind: "missing", file: "a.mdx" }])
  })

  test("a page with a ComponentPreview needs one too", () => {
    const result = checkDocs([page("a.mdx", '<ComponentPreview name="x" />')])
    assert.deepEqual(result.findings, [{ kind: "missing", file: "a.mdx" }])
  })

  test("a page with both a preview and a reference passes", () => {
    const result = checkDocs([page("a.mdx", '<Sandbox id="x" />\n<APIReference name="X" />')])
    assert.deepEqual(result.findings, [])
    assert.equal(result.okCount, 1)
  })

  test("a page with no preview is not asked for anything", () => {
    const result = checkDocs([page("index.mdx", "# Marketing\n\nSections for landing pages.")])
    assert.deepEqual(result.findings, [])
    assert.equal(result.skippedCount, 1)
  })

  test("names that merely start the same do not count as a preview", () => {
    const result = checkDocs([page("a.mdx", "<SandboxRegistryNote />")])
    assert.deepEqual(result.findings, [])
    assert.equal(result.skippedCount, 1)
  })
})

describe("the escape hatch", () => {
  test("an explained opt-out exempts the page", () => {
    const source =
      "{/* api-reference: none — the preview shows an internal component this\n" +
      "    package does not export. */}\n" +
      '<ComponentPreview name="not-found" />'
    const result = checkDocs([page("status.mdx", source)])
    assert.deepEqual(result.findings, [])
    assert.equal(result.exemptCount, 1)
  })

  test("a bare opt-out does not", () => {
    const result = checkDocs([
      page("status.mdx", '{/* api-reference: none */}\n<Sandbox id="x" />'),
    ])
    assert.deepEqual(result.findings, [{ kind: "unexplained-opt-out", file: "status.mdx" }])
  })

  test("prose elsewhere on the page is not a reason", () => {
    const source =
      "{/* api-reference: none */}\n" +
      '<Sandbox id="x" />\n\nThis section explains a great many things at length.'
    const result = checkDocs([page("status.mdx", source)])
    assert.deepEqual(result.findings, [{ kind: "unexplained-opt-out", file: "status.mdx" }])
  })

  test("opting out and documenting it anyway is reported as stale", () => {
    const source =
      "{/* api-reference: none — nothing public here. */}\n" +
      '<Sandbox id="x" />\n<APIReference name="X" />'
    const result = checkDocs([page("status.mdx", source)])
    assert.deepEqual(result.findings, [{ kind: "redundant-opt-out", file: "status.mdx" }])
  })
})

describe("the props expression", () => {
  test("a mis-escaped quote is caught before it reaches a page", () => {
    const source =
      '<Sandbox id="x" />\n' +
      '<APIReference name="X" props={[\n' +
      '  { name: "media", type: "string", description: "Set it to \\\\"phone\\\\"." },\n' +
      "]} />"
    const [finding] = checkDocs([page("a.mdx", source)]).findings
    assert.equal(finding?.kind, "broken-props")
  })

  test("an entry without a type is caught too", () => {
    const source =
      '<Sandbox id="x" />\n<APIReference name="X" props={[{ name: "media" }]} />'
    const [finding] = checkDocs([page("a.mdx", source)]).findings
    assert.equal(finding?.kind, "broken-props")
  })

  test("nested object literals do not confuse the brace matching", () => {
    const source =
      '<Sandbox id="x" />\n' +
      '<APIReference name="X" props={[\n' +
      '  { name: "cta", type: "{ label: string; href: string }", default: "{ label: \\"Go\\" }" },\n' +
      "]} />"
    assert.deepEqual(checkDocs([page("a.mdx", source)]).findings, [])
  })

  test("single-quoted strings carrying double quotes are fine", () => {
    const source =
      '<Sandbox id="x" />\n' +
      "<APIReference name=\"X\" props={[{ name: 'media', type: 'string', description: 'Set it to \"phone\".' }]} />"
    assert.deepEqual(checkDocs([page("a.mdx", source)]).findings, [])
  })
})

describe("the report", () => {
  test("says so plainly when everything is documented", () => {
    const result = checkDocs([page("a.mdx", '<Sandbox id="x" />\n<APIReference name="X" />')])
    assert.match(formatDocsReport(result), /^All documentation pages/)
  })

  test("names each page that fails and how to fix it", () => {
    const result = checkDocs([page("marketing/hero-section.mdx", '<Sandbox id="hero" />')])
    const report = formatDocsReport(result)
    assert.match(report, /marketing\/hero-section\.mdx/)
    assert.match(report, /api-reference: none/)
  })
})
