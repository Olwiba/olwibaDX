/**
 * Checks rendered copy for characters the house style bans.
 *
 * The rule that started this is "no em dashes in anything a reader sees". It
 * lived in a memory note and a review comment, which is to say it lived
 * nowhere: em dashes kept arriving through docs, marketing strings and
 * generated descriptions, and each one was caught by eye or not at all.
 *
 * So it is mechanical. Rendered copy is Markdown/MDX prose (frontmatter
 * included, because titles and descriptions render) and the strings and JSX
 * text in TS/TSX. What is not copy is skipped: code fences and inline code in
 * Markdown, and comments in source, where an em dash harms nobody. A line can
 * opt out with `copy-check-allow`, for the rare literal glyph that is the point.
 *
 * Pure core, string in and findings out, like `docs-check`: the CLI owns the
 * filesystem.
 */

// Written as an escape so this file passes its own check.
export const DEFAULT_BANNED = ["\u2014"]

const ALLOW = "copy-check-allow"

export interface CopyFile {
  /** Path as it should be reported: repository-relative, forward slashes. */
  file: string
  source: string
}

export interface CopyFinding {
  file: string
  line: number
  column: number
  char: string
  /** The offending line, trimmed, for the report. */
  excerpt: string
}

export interface CopyCheckResult {
  findings: CopyFinding[]
  checkedCount: number
  cleanCount: number
}

export interface CopyCheckOptions {
  banned?: string[]
}

const CHECKED = /\.(mdx?|tsx?)$/
const SKIPPED = /(\.test\.|\.spec\.|\.d\.ts$|\.generated\.|\.gen\.|(^|\/)(generated|__generated__)\/)/
/** Notes for whoever works on the repo, not copy a reader of the product sees. */
const DEVELOPER_DOCS = /(^|\/)(README|CHANGELOG|AGENTS|CLAUDE|CONTRIBUTING|SECURITY)\.md$/i

/**
 * Whether a path holds copy this check reads. Tests, type declarations,
 * generated code and repository notes do not.
 */
export function isCheckedFile(path: string): boolean {
  return CHECKED.test(path) && !SKIPPED.test(path) && !DEVELOPER_DOCS.test(path)
}

/** Blanks a span, keeping newlines so line and column numbers still point at the original. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, " ")
}

function maskMarkdown(source: string): string {
  return (
    source
      // Fences first, so an unpaired backtick inside one cannot swallow the rest of the file.
      .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, blank)
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/`[^`\n]*`/g, blank)
  )
}

/**
 * Blanks comments in TS/TSX. Strings are tracked only so that a `//` inside
 * one is not read as a comment; their contents stay, because they are copy.
 */
function maskSource(source: string): string {
  const out = source.split("")
  type Mode = "code" | "line" | "block" | "single" | "double" | "template"
  const stack: Mode[] = ["code"]
  // Brace depth per template expression, so `${ {a: 1} }` closes in the right place.
  const braces: number[] = []

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]
    const mode = stack[stack.length - 1]

    if (mode === "line") {
      if (ch === "\n") stack.pop()
      else out[i] = " "
      continue
    }
    if (mode === "block") {
      if (ch === "*" && next === "/") {
        out[i] = out[i + 1] = " "
        i++
        stack.pop()
      } else if (ch !== "\n") {
        out[i] = " "
      }
      continue
    }
    if (mode === "single" || mode === "double") {
      if (ch === "\\") i++
      else if ((mode === "single" && ch === "'") || (mode === "double" && ch === '"') || ch === "\n") stack.pop()
      continue
    }
    if (mode === "template") {
      if (ch === "\\") i++
      else if (ch === "`") stack.pop()
      else if (ch === "$" && next === "{") {
        stack.push("code")
        braces.push(0)
        i++
      }
      continue
    }

    // code
    if (ch === "/" && next === "/") {
      stack.push("line")
      out[i] = out[i + 1] = " "
      i++
    } else if (ch === "/" && next === "*") {
      stack.push("block")
      out[i] = out[i + 1] = " "
      i++
    } else if (ch === "'") stack.push("single")
    else if (ch === '"') stack.push("double")
    else if (ch === "`") stack.push("template")
    else if (braces.length > 0 && ch === "{") braces[braces.length - 1]++
    else if (braces.length > 0 && ch === "}") {
      if (braces[braces.length - 1] === 0) {
        braces.pop()
        stack.pop()
      } else {
        braces[braces.length - 1]--
      }
    }
  }
  return out.join("")
}

export function checkCopy(files: CopyFile[], options: CopyCheckOptions = {}): CopyCheckResult {
  const banned = options.banned?.length ? options.banned : DEFAULT_BANNED
  const findings: CopyFinding[] = []
  let cleanCount = 0

  for (const { file, source } of files) {
    const masked = /\.mdx?$/.test(file) ? maskMarkdown(source) : maskSource(source)
    const originalLines = source.split("\n")
    const maskedLines = masked.split("\n")
    const before = findings.length

    maskedLines.forEach((line, index) => {
      const original = originalLines[index] ?? ""
      if (original.includes(ALLOW)) return
      for (const char of banned) {
        let column = line.indexOf(char)
        while (column !== -1) {
          findings.push({ file, line: index + 1, column: column + 1, char, excerpt: original.trim() })
          column = line.indexOf(char, column + char.length)
        }
      }
    })

    if (findings.length === before) cleanCount++
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column)
  return { findings, checkedCount: files.length, cleanCount }
}

function codepoint(char: string) {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`
}

export function formatCopyReport(result: CopyCheckResult): string {
  if (result.findings.length === 0) {
    return `Copy is clean: ${result.checkedCount} file${result.checkedCount === 1 ? "" : "s"} checked.`
  }
  const lines = result.findings.map(
    (f) => `  ${f.file}:${f.line}:${f.column}  ${codepoint(f.char)}  ${f.excerpt.length > 100 ? `${f.excerpt.slice(0, 97)}...` : f.excerpt}`,
  )
  return [
    `${result.findings.length} banned character${result.findings.length === 1 ? "" : "s"} in rendered copy:`,
    ...lines,
    "",
    "Rewrite the sentence (a comma, a colon or a full stop usually reads better), or mark a deliberate",
    `literal with a "${ALLOW}: <reason>" comment on the same line.`,
  ].join("\n")
}
