import { afterEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { classifyWorktree, parseWorktreeList, runWorktreeCleanup } from "./worktree-cleanup.ts"

const temporaryRoots = new Set()

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true })
  temporaryRoots.clear()
})

/**
 * `commit.gpgsign` is read from the developer's global config, and a signing
 * prompt in a test has nothing to type into: the suite hangs until it is
 * killed rather than failing. Turned off per-invocation so these fixtures do
 * not depend on how the machine running them is set up.
 */
function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, "-c", "commit.gpgsign=false", ...args], {
    encoding: "utf8",
  }).trim()
}

function createMergedWorktree() {
  const root = mkdtempSync(join(tmpdir(), "olwiba-dx-cleanup-"))
  temporaryRoots.add(root)
  const remote = join(root, "remote.git")
  const repo = join(root, "repo")
  const worktree = join(root, "feature-worktree")
  execFileSync("git", ["init", "--bare", remote])
  execFileSync("git", ["clone", remote, repo])
  git(repo, "config", "user.email", "test@example.com")
  git(repo, "config", "user.name", "Test User")
  writeFileSync(join(repo, "file.txt"), "main\n")
  git(repo, "add", "file.txt")
  git(repo, "commit", "-m", "initial")
  git(repo, "branch", "-M", "main")
  git(repo, "push", "-u", "origin", "main")
  git(repo, "checkout", "-b", "feature")
  writeFileSync(join(repo, "feature.txt"), "feature\n")
  git(repo, "add", "feature.txt")
  git(repo, "commit", "-m", "feature")
  git(repo, "push", "-u", "origin", "feature")
  git(repo, "checkout", "main")
  git(repo, "merge", "--no-ff", "feature", "-m", "merge feature")
  git(repo, "push", "origin", "main")
  git(repo, "worktree", "add", worktree, "feature")
  return { repo, worktree }
}

async function captureOutput(action) {
  let output = ""
  const originalOut = process.stdout.write
  const originalErr = process.stderr.write
  process.stdout.write = (chunk) => { output += String(chunk); return true }
  process.stderr.write = (chunk) => { output += String(chunk); return true }
  try {
    return { code: await action(), output }
  } finally {
    process.stdout.write = originalOut
    process.stderr.write = originalErr
  }
}

describe("parseWorktreeList", () => {
  test("parses branch and detached worktrees without breaking paths containing spaces", () => {
    const worktrees = parseWorktreeList(`worktree C:/code/project
HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
branch refs/heads/main

worktree C:/code/project worktrees/finished
HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
branch refs/heads/feature/finished

worktree C:/code/project-worktrees/detached
HEAD cccccccccccccccccccccccccccccccccccccccc
detached
`)

    expect(worktrees).toEqual([
      {
        path: "C:/code/project",
        head: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        branch: "main",
      },
      {
        path: "C:/code/project worktrees/finished",
        head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        branch: "feature/finished",
      },
      {
        path: "C:/code/project-worktrees/detached",
        head: "cccccccccccccccccccccccccccccccccccccccc",
      },
    ])
  })
})

describe("classifyWorktree", () => {
  const safeMerged = {
    branch: "feature/finished",
    head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    defaultSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    defaultBranch: "main",
    remote: "origin",
    isCurrent: false,
    pathExists: true,
    dirty: false,
    aheadCount: 0,
    remoteBranchExists: true,
    remoteBranchMerged: true,
    headMerged: true,
  }

  test("removes a clean worktree whose remote branch has landed", () => {
    expect(classifyWorktree(safeMerged)).toEqual({
      removable: true,
      reason: "branch merged into main",
    })
  })

  test.each([
    ["the current worktree", { isCurrent: true }, "current working directory"],
    ["a dirty worktree", { dirty: true }, "uncommitted changes"],
    ["a branch ahead of the default branch", { aheadCount: 2 }, "2 commit(s) ahead of origin/main"],
    ["a branch not confirmed merged", { remoteBranchMerged: false, headMerged: false }, "remote branch exists; merge into main not confirmed"],
  ])("preserves %s", (_name, overrides, reason) => {
    expect(classifyWorktree({ ...safeMerged, ...overrides })).toEqual({
      removable: false,
      reasons: [reason],
    })
  })

  test("preserves a detached worktree with commits not in the default branch", () => {
    expect(classifyWorktree({
      ...safeMerged,
      branch: undefined,
      remoteBranchExists: false,
      remoteBranchMerged: false,
      headMerged: false,
    })).toEqual({
      removable: false,
      reasons: ["detached HEAD is not merged into main"],
    })
  })

  test("removes a clean detached worktree whose HEAD has landed", () => {
    expect(classifyWorktree({
      ...safeMerged,
      branch: undefined,
      remoteBranchExists: false,
      remoteBranchMerged: false,
    })).toEqual({
      removable: true,
      reason: "detached HEAD merged into main",
    })
  })

  test("removes a merged local branch after its remote branch is deleted", () => {
    expect(classifyWorktree({
      ...safeMerged,
      remoteBranchExists: false,
      remoteBranchMerged: false,
    })).toEqual({
      removable: true,
      reason: "branch merged into main (remote branch deleted)",
    })
  })

  test("does not treat a branch at the default tip as stale", () => {
    expect(classifyWorktree({
      ...safeMerged,
      head: safeMerged.defaultSha,
      remoteBranchExists: false,
      remoteBranchMerged: false,
    })).toEqual({
      removable: false,
      reasons: ["branch points at current main; automatic removal skipped"],
    })
  })
})

describe("runWorktreeCleanup destructive revalidation", () => {
  test("preserves a worktree that becomes dirty after planning", async () => {
    const { repo, worktree } = createMergedWorktree()

    const result = await captureOutput(() => runWorktreeCleanup(
      [repo, "--force", "--no-fetch"],
      { beforeRemoval: () => writeFileSync(join(worktree, "late-change.txt"), "do not delete\n") },
    ))

    expect(result.code).toBe(1)
    expect(readFileSync(join(worktree, "late-change.txt"), "utf8")).toBe("do not delete\n")
    expect(result.output).toContain("changed since planning")
    expect(result.output).toContain("uncommitted changes")
  }, 180_000)

  test("reports branch deletion failure as a partial failure", async () => {
    const { repo, worktree } = createMergedWorktree()

    const result = await captureOutput(() => runWorktreeCleanup(
      [repo, "--force", "--no-fetch"],
      { afterWorktreeRemoval: () => git(repo, "checkout", "feature") },
    ))

    expect(result.code).toBe(1)
    expect(result.output).toContain("worktree removed, but local branch deletion failed")
    expect(result.output).toContain("Done. Removed 1 worktree(s)")
    expect(git(repo, "branch", "--show-current")).toBe("feature")
  }, 180_000)
})
