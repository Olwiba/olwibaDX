import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createRequire } from "node:module"
import type { SkillsManifest } from "./skills"

const require = createRequire(import.meta.url)

const [command, subcommand] = process.argv.slice(2)

if (command === "skills" && subcommand === "install") {
  await runSkillsInstall()
} else {
  process.stdout.write("Usage:\n  dx skills install\n")
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
