import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"
import type { SkillsManifest } from "./skills"

const require = createRequire(import.meta.url)

const [command, subcommand] = process.argv.slice(2)

if (command === "skills" && subcommand === "install") {
  await runSkillsInstall()
} else if (command === "ascii-gif") {
  await runAsciiGif()
} else {
  process.stdout.write("Usage:\n  dx skills install\n  dx ascii-gif --text <text> --out <file.gif>\n")
}

async function runSkillsInstall() {
  const manifest = require("../skills-manifest.json") as SkillsManifest
  const pluginsDir = join(process.cwd(), ".claude", "plugins")
  mkdirSync(pluginsDir, { recursive: true })

  let installed = 0
  let skipped = 0

  for (const skill of manifest.skills) {
    if (!skill.source) {
      process.stdout.write(`  — ${skill.name}: no source configured\n`)
      skipped++
      continue
    }

    try {
      const res = await fetch(skill.source)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const content = await res.text()
      const skillDir = join(pluginsDir, skill.name)
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(join(skillDir, "skill.md"), content, "utf-8")
      process.stdout.write(`  ✓ ${skill.name}\n`)
      installed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      process.stderr.write(`  ✗ ${skill.name}: ${message}\n`)
    }
  }

  process.stdout.write(`\n${installed} installed, ${skipped} skipped\n`)
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

function parseNumberFlag(value: string | undefined): number | undefined {
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
