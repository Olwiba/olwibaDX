import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isSafeSkillSlug } from "./skills"

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("isSafeSkillSlug", () => {
  test.each(["react", "react-hooks", "skill_2", "v1.2", "a", ".hidden", "a..b"])(
    "accepts safe directory name %s",
    (slug) => expect(isSafeSkillSlug(slug)).toBe(true),
  )

  test.each([
    "",
    ".",
    "..",
    "../escape",
    "skill/child",
    "skill\\child",
    "/absolute",
    "C:\\absolute",
    " skill",
    "skill ",
    "skill:name",
    "nul\0byte",
  ])("rejects unsafe directory name %s", (slug) => {
    expect(isSafeSkillSlug(slug)).toBe(false)
  })
})

test("installer rejects unsafe selected slugs, preserves the summary, and fails", () => {
  const cwd = mkdtempSync(join(tmpdir(), "olwiba-dx-skills-"))
  temporaryDirectories.push(cwd)
  const manifest = {
    version: "1",
    skills: [
      {
        slug: "../secret-value",
        name: "Unsafe",
        description: "Unsafe",
        contentUrl: "data:text/plain,secret-value",
      },
    ],
  }
  const source = `data:application/json,${encodeURIComponent(JSON.stringify(manifest))}`
  const result = Bun.spawnSync({
    cmd: [process.execPath, "run", join(import.meta.dir, "cli.ts"), "skills", "install", "--all", "--source", source],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = result.stdout.toString()
  const stderr = result.stderr.toString()

  expect(result.exitCode).toBe(1)
  expect(stdout).toContain("0 installed, 1 failed")
  expect(stdout).not.toContain("secret-value")
  expect(stderr).not.toContain("secret-value")
})
