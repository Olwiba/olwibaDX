import { mkdirSync, writeFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve, sep } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { isSafeSkillSlug, type ManifestSkill, type SkillsManifest } from "./skills"

const DEFAULT_SOURCE = "https://olwiba.com/skills/manifest.json"

const [command, subcommand] = process.argv.slice(2)

if (command === "skills" && subcommand === "install") {
  await runSkillsInstall()
} else if ((command === "worktree" || command === "wt") && subcommand === "cleanup") {
  const { runWorktreeCleanup } = await import("./worktree-cleanup")
  try {
    process.exitCode = await runWorktreeCleanup(process.argv.slice(4))
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
} else if (command === "ascii-gif") {
  await runAsciiGif()
} else if (command === "generate-assets") {
  await runGenerateAssets()
} else {
  process.stdout.write(
    "Usage:\n" +
      "  dx skills install [--source <url>] [--target claude|amp] [--all] [--name a,b,c]\n" +
      "  dx worktree cleanup [repo-name-or-path] [--repos-root <path>] [--remote <name>] [--dry-run] [--force] [--no-fetch]\n" +
      "  dx ascii-gif --text <text> --out <file.gif>\n" +
      "  dx generate-assets --name <app> --icon <lucide-icon> --color <#hex> [--out <dir>] [--og-component <svg-or-image-path>]\n",
  )
}

async function runSkillsInstall() {
  const flags = parseFlags(process.argv.slice(3))
  const source = flags.source ?? DEFAULT_SOURCE
  const target = (flags.target ?? "claude").toLowerCase()

  if (target !== "claude" && target !== "amp") {
    process.stderr.write(`Invalid --target: ${target} (expected 'claude' or 'amp')\n`)
    process.exitCode = 1
    return
  }

  const targetDir = target === "amp" ? join(".amp", "skills") : join(".claude", "skills")

  process.stdout.write(`Fetching manifest from ${safeUrlForDisplay(source)}\n`)

  let manifest: SkillsManifest
  try {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = (await res.json()) as SkillsManifest
  } catch (err) {
    process.stderr.write(`Failed to fetch manifest: ${safeRequestError(err)}\n`)
    process.exitCode = 1
    return
  }

  if (!manifest.skills || manifest.skills.length === 0) {
    process.stdout.write("No skills found in manifest.\n")
    return
  }

  const selected = await selectSkills(manifest.skills, flags)
  if (selected.length === 0) {
    process.stdout.write("No skills selected.\n")
    return
  }

  const installDir = join(process.cwd(), targetDir)
  mkdirSync(installDir, { recursive: true })

  let installed = 0
  let failed = 0

  for (const skill of selected) {
    if (!isSafeSkillSlug(skill.slug)) {
      process.stderr.write("  ✗ invalid skill slug\n")
      failed++
      continue
    }

    const skillDir = resolve(installDir, skill.slug)
    const relativeDestination = relative(installDir, skillDir)
    if (
      !relativeDestination ||
      relativeDestination === ".." ||
      relativeDestination.startsWith(`..${sep}`) ||
      isAbsolute(relativeDestination)
    ) {
      process.stderr.write(`  ✗ ${skill.slug}: invalid install destination\n`)
      failed++
      continue
    }
    const skillPath = join(skillDir, "SKILL.md")

    try {
      const url = new URL(skill.contentUrl, source).toString()
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const content = await res.text()
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(skillPath, content, "utf-8")
      process.stdout.write(`  ✓ ${skill.slug}\n`)
      installed++
    } catch (err) {
      process.stderr.write(`  ✗ ${skill.slug}: ${safeRequestError(err)}\n`)
      failed++
    }
  }

  process.stdout.write(`\n${installed} installed, ${failed} failed\n`)
  process.stdout.write(`Location: ${targetDir}/\n`)
  if (failed > 0) process.exitCode = 1
}

function safeUrlForDisplay(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return "custom source"
    url.username = ""
    url.password = ""
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return "custom source"
  }
}

function safeRequestError(error: unknown): string {
  return error instanceof Error && /^HTTP \d{3}$/.test(error.message)
    ? error.message
    : "request failed"
}

async function selectSkills(
  skills: ManifestSkill[],
  flags: Record<string, string | undefined>,
): Promise<ManifestSkill[]> {
  if (flags.all === "true") return skills

  if (flags.name) {
    const wanted = new Set(flags.name.split(",").map((n) => n.trim()).filter(Boolean))
    const matched = skills.filter((s) => wanted.has(s.slug))
    const missing = [...wanted].filter((n) => !skills.some((s) => s.slug === n))
    for (const m of missing) process.stderr.write(`  ! unknown skill: ${m}\n`)
    return matched
  }

  return promptSkillSelection(skills)
}

async function promptSkillSelection(skills: ManifestSkill[]): Promise<ManifestSkill[]> {
  process.stdout.write(`\nAvailable skills (${skills.length}):\n\n`)
  skills.forEach((skill, i) => {
    const num = String(i + 1).padStart(2, " ")
    process.stdout.write(`  ${num}. ${skill.slug} — ${skill.description}\n`)
  })

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(
      "\nEnter skill numbers (e.g. 1,3,5), 'all', or blank to cancel: ",
    )
    const trimmed = answer.trim().toLowerCase()
    if (!trimmed) return []
    if (trimmed === "all") return skills

    const indices = trimmed
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= skills.length)

    const seen = new Set<number>()
    return indices
      .filter((i) => {
        if (seen.has(i)) return false
        seen.add(i)
        return true
      })
      .map((i) => skills[i - 1])
  } finally {
    rl.close()
  }
}

async function runAsciiGif() {
  const { generateAsciiGif } = await import("./ascii-gif")
  const flags = parseFlags(process.argv.slice(3))
  const text = flags.text
  const outputPath = flags.out ?? flags.output

  if (!text || !outputPath) {
    process.stderr.write("Usage: dx ascii-gif --text <text> --out <file.gif>\n")
    process.exitCode = 1
    return
  }

  await generateAsciiGif({
    text,
    outputPath,
    accent: flags.accent,
    font: flags.font,
    color: flags.color,
    accentColor: flags["accent-color"],
    backgroundColor: flags["background-color"],
    blendColor: flags["blend-color"],
    fps: parseNumberFlag(flags.fps),
    duration: parseNumberFlag(flags.duration),
    scale: parseNumberFlag(flags.scale),
    padding: parseNumberFlag(flags.padding),
    transparent: flags.transparent === "true",
  })

  process.stdout.write(`Generated ${outputPath}\n`)
}

function parseFlags(args: string[]): Record<string, string | undefined> {
  const flags: Record<string, string | undefined> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith("--")) continue

    const inline = /^--([^=]+)=(.*)$/.exec(arg)
    if (inline) {
      flags[inline[1]] = inline[2]
      continue
    }

    const key = arg.slice(2)
    const value = args[i + 1]
    if (value && !value.startsWith("--")) {
      flags[key] = value
      i++
    } else {
      flags[key] = "true"
    }
  }

  return flags
}

async function runGenerateAssets() {
  const { generateAssets } = await import("./generate-assets")
  const flags = parseFlags(process.argv.slice(3))

  const name = flags.name
  const icon = flags.icon
  const color = flags.color
  const outputDir = flags.out ?? flags.output ?? "public"
  const ogComponent = flags["og-component"]

  if (!name || !icon || !color) {
    process.stderr.write(
      "Usage: dx generate-assets --name <app> --icon <lucide-icon> --color <#hex> [--out <dir>] [--og-component <svg-or-image-path>]\n",
    )
    process.exitCode = 1
    return
  }

  process.stdout.write(`Generating assets for "${name}"…\n`)
  try {
    const result = await generateAssets({ name, icon, color, outputDir, ogComponent })
    process.stdout.write(`Generated ${result.files.length} files in ${outputDir}/\n`)
    for (const f of result.files) process.stdout.write(`  ${f}\n`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Error: ${message}\n`)
    process.exitCode = 1
  }
}

function parseNumberFlag(value: string | undefined): number | undefined {
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
