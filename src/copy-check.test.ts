import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { checkCopy, formatCopyReport, isCheckedFile } from "./copy-check"

const file = (path: string, source: string) => ({ file: path, source })

describe("what counts as rendered copy", () => {
  test("an em dash in Markdown prose is reported with its position", () => {
    const result = checkCopy([file("a.mdx", "# Title\n\nFast — and small.")])
    assert.equal(result.findings.length, 1)
    assert.deepEqual(
      { line: result.findings[0].line, column: result.findings[0].column, char: result.findings[0].char },
      { line: 3, column: 6, char: "—" },
    )
  })

  test("frontmatter is rendered (titles, descriptions), so it is checked", () => {
    const result = checkCopy([file("a.mdx", "---\ndescription: One — two\n---\n# Hi")])
    assert.equal(result.findings.length, 1)
    assert.equal(result.findings[0].line, 2)
  })

  test("code fences, inline code and comments in Markdown are not copy", () => {
    const source = [
      "Text.",
      "```ts",
      "const a = '—'",
      "```",
      "Use `a — b` here.",
      "{/* note — internal */}",
      "<!-- also — internal -->",
    ].join("\n")
    assert.deepEqual(checkCopy([file("a.mdx", source)]).findings, [])
  })

  test("JSX text and string literals in TSX are copy", () => {
    const result = checkCopy([
      file("a.tsx", 'export const A = () => <p>Fast — small</p>\nconst label = "One — two"'),
    ])
    assert.deepEqual(
      result.findings.map((f) => f.line),
      [1, 2],
    )
  })

  test("comments in TS are not copy, and a // inside a string does not start one", () => {
    const source = [
      "// Fast — small, a line comment",
      "/* block — comment",
      "   still — comment */",
      'const url = "https://example.com" // trailing — comment',
      'const bad = "https://x.dev — y"',
    ].join("\n")
    const result = checkCopy([file("a.ts", source)])
    assert.deepEqual(
      result.findings.map((f) => f.line),
      [5],
    )
  })

  test("template literals are copy", () => {
    const result = checkCopy([file("a.ts", "const t = `Hello — ${name}`")])
    assert.equal(result.findings.length, 1)
  })
})

describe("configuration", () => {
  test("a line marked copy-check-allow is skipped", () => {
    const result = checkCopy([file("a.tsx", 'const sep = "—" // copy-check-allow: the literal separator glyph')])
    assert.deepEqual(result.findings, [])
  })

  test("other characters can be banned", () => {
    const result = checkCopy([file("a.md", "Range 1–5 and an ellipsis…")], { banned: ["–", "…"] })
    assert.deepEqual(
      result.findings.map((f) => f.char),
      ["–", "…"],
    )
  })

  test("counts files checked and clean", () => {
    const result = checkCopy([file("a.md", "ok"), file("b.md", "not — ok")])
    assert.equal(result.checkedCount, 2)
    assert.equal(result.cleanCount, 1)
  })
})

describe("which files are checked", () => {
  test("source and content files are, tests and generated files are not", () => {
    assert.equal(isCheckedFile("src/components/Hero.tsx"), true)
    assert.equal(isCheckedFile("content/docs/index.mdx"), true)
    assert.equal(isCheckedFile("src/lib/copy.ts"), true)
    assert.equal(isCheckedFile("src/components/Hero.test.tsx"), false)
    assert.equal(isCheckedFile("site/lib/catalog.generated.ts"), false)
    assert.equal(isCheckedFile("src/routeTree.gen.ts"), false)
    assert.equal(isCheckedFile("src/types.d.ts"), false)
    assert.equal(isCheckedFile("public/logo.svg"), false)
    assert.equal(isCheckedFile("src/generated/db/internal/class.ts"), false)
    assert.equal(isCheckedFile("src/core/README.md"), false)
    assert.equal(isCheckedFile("AGENTS.md"), false)
    assert.equal(isCheckedFile("content/docs/readme-guide.md"), true)
  })
})

describe("the report", () => {
  test("names each finding as file:line:column with the line excerpt", () => {
    const report = formatCopyReport(checkCopy([file("a.mdx", "Fast — small.")]))
    assert.match(report, /a\.mdx:1:6/)
    assert.match(report, /Fast — small\./)
    assert.match(report, /U\+2014/)
  })

  test("a clean run says so", () => {
    assert.match(formatCopyReport(checkCopy([file("a.md", "fine")])), /clean/i)
  })
})
