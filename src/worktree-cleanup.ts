import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs"
import { basename, isAbsolute, join, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

export interface WorktreeInfo {
  path: string
  head: string
  branch?: string
}

interface WorktreeState {
  branch?: string
  head: string
  defaultSha: string
  defaultBranch: string
  remote: string
  isCurrent: boolean
  pathExists: boolean
  dirty: boolean
  aheadCount: number
  remoteBranchExists: boolean
  remoteBranchMerged: boolean
  headMerged: boolean
}

type WorktreeClassification =
  | { removable: true; reason: string }
  | { removable: false; reasons: string[] }

interface CleanupOptions {
  repo?: string
  reposRoot?: string
  remote: string
  dryRun: boolean
  force: boolean
  fetch: boolean
}

interface RemovableWorktree extends WorktreeInfo {
  reason: string
  sizeMB: number
}

interface PreservedWorktree extends WorktreeInfo {
  reasons: string[]
}

export interface WorktreeCleanupHooks {
  beforeRemoval?: (worktree: WorktreeInfo) => void
  afterWorktreeRemoval?: (worktree: WorktreeInfo) => void
}

export function parseWorktreeList(output: string): WorktreeInfo[] {
  return output
    .trim()
    .split(/\r?\n\r?\n/)
    .filter(Boolean)
    .map((record) => {
      const fields = new Map<string, string>()
      for (const line of record.split(/\r?\n/)) {
        const separator = line.indexOf(" ")
        if (separator === -1) {
          fields.set(line, "")
        } else {
          fields.set(line.slice(0, separator), line.slice(separator + 1))
        }
      }

      const path = fields.get("worktree")
      const head = fields.get("HEAD")
      if (!path || !head) throw new Error("Unexpected output from git worktree list")

      const branchRef = fields.get("branch")
      return {
        path,
        head,
        ...(branchRef ? { branch: branchRef.replace(/^refs\/heads\//, "") } : {}),
      }
    })
}

export function classifyWorktree(state: WorktreeState): WorktreeClassification {
  const reasons: string[] = []
  let removalReason: string | undefined

  if (state.isCurrent) reasons.push("current working directory")

  if (!state.branch) {
    if (state.headMerged) {
      removalReason = `detached HEAD merged into ${state.defaultBranch}`
    } else {
      reasons.push(`detached HEAD is not merged into ${state.defaultBranch}`)
    }
  } else if (state.remoteBranchExists) {
    if (state.remoteBranchMerged) {
      removalReason = `branch merged into ${state.defaultBranch}`
    } else {
      reasons.push(`remote branch exists; merge into ${state.defaultBranch} not confirmed`)
    }
  } else if (!state.headMerged) {
    reasons.push(`remote branch deleted; merge into ${state.defaultBranch} not confirmed`)
  } else if (state.head === state.defaultSha) {
    reasons.push(`branch points at current ${state.defaultBranch}; automatic removal skipped`)
  } else {
    removalReason = `branch merged into ${state.defaultBranch} (remote branch deleted)`
  }

  if (!state.pathExists) reasons.push("worktree path missing")
  if (state.dirty) reasons.push("uncommitted changes")
  if (state.aheadCount > 0) {
    reasons.push(
      `${state.aheadCount} commit(s) ahead of ${state.remote}/${state.defaultBranch}`,
    )
  }

  return reasons.length > 0
    ? { removable: false, reasons }
    : { removable: true, reason: removalReason ?? "safe to remove" }
}

export async function runWorktreeCleanup(
  args: string[],
  hooks: WorktreeCleanupHooks = {},
): Promise<number> {
  let options: CleanupOptions
  try {
    options = parseCleanupArgs(args)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    writeUsage(process.stderr)
    return 1
  }

  if (args.includes("--help") || args.includes("-h")) {
    writeUsage(process.stdout)
    return 0
  }

  let repoPath: string
  try {
    repoPath = resolveRepo(options.repo, options.reposRoot)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }

  const repoName = basename(repoPath)
  process.stdout.write(`Repo: ${repoName}\nPath: ${repoPath}\n`)

  if (options.fetch) {
    process.stdout.write(`Fetching latest from ${options.remote}...\n`)
    const fetched = runGit(repoPath, ["fetch", options.remote, "--prune"], true)
    if (!fetched.ok) {
      process.stderr.write(fetched.stderr || `git fetch failed for ${repoName}\n`)
      return 1
    }
  }

  const defaultBranch = resolveDefaultBranch(repoPath, options.remote)
  const defaultRef = `${options.remote}/${defaultBranch}`
  const defaultSha = gitOutput(repoPath, ["rev-parse", defaultRef])
  if (!defaultSha) {
    process.stderr.write(`Could not find ${defaultRef} for ${repoName}.\n`)
    return 1
  }

  const worktrees = parseWorktreeList(requiredGitOutput(repoPath, ["worktree", "list", "--porcelain"]))
  const additionalWorktrees = worktrees.slice(1)
  if (additionalWorktrees.length === 0) {
    process.stdout.write("No additional worktrees found. Nothing to clean up.\n")
    return 0
  }

  const callerWorktree = canonicalPath(gitOutput(process.cwd(), ["rev-parse", "--show-toplevel"]))
  const removable: RemovableWorktree[] = []
  const preserved: PreservedWorktree[] = []

  for (const worktree of additionalWorktrees) {
    const pathExists = existsSync(worktree.path)
    const trackedBranch = worktree.branch
      ? gitOutput(repoPath, [
          "for-each-ref",
          "--format=%(upstream:short)",
          `refs/heads/${worktree.branch}`,
        ])
      : ""
    const remoteBranch = worktree.branch
      ? trackedBranch.startsWith(`${options.remote}/`)
        ? trackedBranch
        : `${options.remote}/${worktree.branch}`
      : ""
    const remoteBranchExists = Boolean(remoteBranch) && gitSucceeds(repoPath, ["rev-parse", "--verify", remoteBranch])
    const headMerged = gitIsAncestor(repoPath, worktree.head, defaultRef)
    const classification = classifyWorktree({
      branch: worktree.branch,
      head: worktree.head,
      defaultSha,
      defaultBranch,
      remote: options.remote,
      isCurrent: canonicalPath(worktree.path) === callerWorktree,
      pathExists,
      dirty: pathExists && Boolean(gitOutput(worktree.path, ["status", "--porcelain"])),
      aheadCount: worktree.branch && pathExists
        ? Number(gitOutput(worktree.path, ["rev-list", "--count", `${defaultRef}..HEAD`]) || 0)
        : 0,
      remoteBranchExists,
      remoteBranchMerged: remoteBranchExists && gitIsAncestor(repoPath, remoteBranch, defaultRef),
      headMerged,
    })

    if (classification.removable) {
      removable.push({
        ...worktree,
        reason: classification.reason,
        sizeMB: directorySizeMB(worktree.path),
      })
    } else {
      preserved.push({ ...worktree, reasons: classification.reasons })
    }
  }

  if (preserved.length > 0) {
    process.stdout.write("\nWorktrees needing attention (not automatically removed):\n")
    for (const item of preserved) {
      process.stdout.write(`  ${item.branch ?? "(detached)"}\n    ${item.reasons.join("; ")}\n    ${item.path}\n`)
    }
  }

  if (removable.length === 0) {
    process.stdout.write(`\nNo worktrees are safely removable.\nSummary: 0 safely removable; ${preserved.length} needing attention.\n`)
    return 0
  }

  const totalMB = removable.reduce((total, item) => total + item.sizeMB, 0)
  process.stdout.write("\nWorktrees to remove:\n")
  for (const item of removable) {
    process.stdout.write(`  ${item.branch ?? "(detached)"} - ${item.reason} - ~${item.sizeMB} MB\n    ${item.path}\n`)
  }
  process.stdout.write(`Total space to reclaim: ~${totalMB} MB\n`)

  if (options.dryRun) {
    process.stdout.write(`\n[DRY RUN] No changes made.\nSummary: ${removable.length} safely removable; ${preserved.length} needing attention.\n`)
    return 0
  }

  if (!options.force && !(await confirmRemoval())) {
    process.stdout.write(`Aborted.\nSummary: 0 removed; ${preserved.length} needing attention.\n`)
    return 0
  }

  let removedCount = 0
  let reclaimedMB = 0
  const skipped: Array<{ item: RemovableWorktree; error: string }> = []

  for (const item of removable) {
    hooks.beforeRemoval?.(item)
    const current = inspectWorktree(repoPath, item.path, options.remote, defaultBranch)
    if (!current.classification.removable) {
      skipped.push({
        item,
        error: `changed since planning: ${current.classification.reasons.join("; ")}`,
      })
      continue
    }

    process.stdout.write(`Removing worktree: ${item.branch ?? "(detached)"} ...\n`)
    const removal = runGit(repoPath, ["worktree", "remove", item.path, "--force"])
    if (!removal.ok) {
      skipped.push({ item, error: removal.stderr.trim() || "git worktree remove failed" })
      continue
    }

    removedCount++
    reclaimedMB += item.sizeMB
    hooks.afterWorktreeRemoval?.(item)
    if (current.worktree.branch) {
      const branchRemoval = runGit(repoPath, ["branch", "-D", current.worktree.branch])
      if (!branchRemoval.ok) {
        skipped.push({
          item,
          error: `worktree removed, but local branch deletion failed: ${branchRemoval.stderr.trim() || "git branch -D failed"}`,
        })
        continue
      }
    }
  }

  if (skipped.length > 0) {
    process.stdout.write("\nWorktree cleanup issues:\n")
    for (const { item, error } of skipped) {
      process.stdout.write(`  ${item.branch ?? "(detached)"}: ${error}\n    ${item.path}\n`)
    }
  }

  process.stdout.write(`\nDone. Removed ${removedCount} worktree(s), reclaimed ~${reclaimedMB} MB; skipped ${skipped.length}.\n`)
  process.stdout.write(`Summary: ${preserved.length} worktree(s) still need attention (see report above).\n`)
  return skipped.length > 0 ? 1 : 0
}

function inspectWorktree(
  repoPath: string,
  worktreePath: string,
  remote: string,
  defaultBranch: string,
): { worktree: WorktreeInfo; classification: WorktreeClassification } {
  const listed = parseWorktreeList(requiredGitOutput(repoPath, ["worktree", "list", "--porcelain"]))
  const expectedPath = pathIdentity(worktreePath)
  const worktree = listed.find((candidate) => pathIdentity(candidate.path) === expectedPath)
    ?? { path: worktreePath, head: "", branch: undefined }
  const pathExists = existsSync(worktree.path)
  const defaultRef = `${remote}/${defaultBranch}`
  const defaultSha = gitOutput(repoPath, ["rev-parse", defaultRef])
  const trackedBranch = worktree.branch
    ? gitOutput(repoPath, ["for-each-ref", "--format=%(upstream:short)", `refs/heads/${worktree.branch}`])
    : ""
  const remoteBranch = worktree.branch
    ? trackedBranch.startsWith(`${remote}/`) ? trackedBranch : `${remote}/${worktree.branch}`
    : ""
  const remoteBranchExists = Boolean(remoteBranch)
    && gitSucceeds(repoPath, ["rev-parse", "--verify", remoteBranch])
  const currentWorktree = canonicalPath(gitOutput(process.cwd(), ["rev-parse", "--show-toplevel"]))

  return {
    worktree,
    classification: classifyWorktree({
      branch: worktree.branch,
      head: worktree.head,
      defaultSha,
      defaultBranch,
      remote,
      isCurrent: expectedPath !== "" && expectedPath === currentWorktree,
      pathExists,
      dirty: pathExists && Boolean(gitOutput(worktree.path, ["status", "--porcelain"])),
      aheadCount: worktree.branch && pathExists
        ? Number(gitOutput(worktree.path, ["rev-list", "--count", `${defaultRef}..HEAD`]) || 0)
        : 0,
      remoteBranchExists,
      remoteBranchMerged: remoteBranchExists && gitIsAncestor(repoPath, remoteBranch, defaultRef),
      headMerged: Boolean(worktree.head) && gitIsAncestor(repoPath, worktree.head, defaultRef),
    }),
  }
}

function parseCleanupArgs(args: string[]): CleanupOptions {
  const options: CleanupOptions = {
    remote: "origin",
    dryRun: false,
    force: false,
    fetch: true,
  }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--dry-run" || arg.toLowerCase() === "-dryrun") options.dryRun = true
    else if (arg === "--force" || arg.toLowerCase() === "-force") options.force = true
    else if (arg === "--no-fetch") options.fetch = false
    else if (arg === "--help" || arg === "-h") continue
    else if (arg === "--repos-root" || arg === "--remote") {
      const value = args[++index]
      if (!value) throw new Error(`${arg} requires a value`)
      if (arg === "--repos-root") options.reposRoot = value
      else options.remote = value
    } else if (arg.startsWith("--repos-root=")) options.reposRoot = arg.slice(13)
    else if (arg.startsWith("--remote=")) options.remote = arg.slice(9)
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`)
    else if (!options.repo) options.repo = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }

  return options
}

function resolveRepo(repoInput?: string, reposRootInput?: string): string {
  if (!repoInput) {
    const root = gitOutput(process.cwd(), ["rev-parse", "--show-toplevel"])
    if (!root) throw new Error("Current directory is not inside a git repository. Provide a repo path or name.")
    return realpathSync(root)
  }

  const directPath = isAbsolute(repoInput) ? repoInput : resolve(process.cwd(), repoInput)
  if (existsSync(directPath)) return resolveGitRoot(directPath)

  const reposRoot = resolve(process.cwd(), reposRootInput ?? "repos")
  if (!existsSync(reposRoot)) {
    throw new Error(`Repo '${repoInput}' was not found. Provide its path or use --repos-root.`)
  }

  const matches = findRepos(reposRoot).filter((path) => basename(path).toLowerCase() === repoInput.toLowerCase())
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error(`Repo name '${repoInput}' is ambiguous. Provide a repo path instead.`)
  throw new Error(`Unknown repo '${repoInput}' under ${reposRoot}.`)
}

function resolveGitRoot(path: string): string {
  const root = gitOutput(path, ["rev-parse", "--show-toplevel"])
  if (!root) throw new Error(`Path is not inside a git repository: ${path}`)
  return realpathSync(root)
}

function findRepos(root: string): string[] {
  const repos: string[] = []
  const visit = (directory: string) => {
    if (existsSync(join(directory, ".git"))) {
      repos.push(realpathSync(directory))
      return
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue
      visit(join(directory, entry.name))
    }
  }
  visit(root)
  return repos
}

function resolveDefaultBranch(repoPath: string, remote: string): string {
  const symbolic = gitOutput(repoPath, ["symbolic-ref", "--short", `refs/remotes/${remote}/HEAD`])
  if (symbolic) return symbolic.replace(`${remote}/`, "")
  if (gitSucceeds(repoPath, ["rev-parse", "--verify", `${remote}/main`])) return "main"
  if (gitSucceeds(repoPath, ["rev-parse", "--verify", `${remote}/master`])) return "master"
  throw new Error(`Could not resolve the default branch for remote '${remote}'.`)
}

function canonicalPath(path: string): string {
  if (!path || !existsSync(path)) return ""
  const canonical = realpathSync(path)
  return process.platform === "win32" ? canonical.toLowerCase() : canonical
}

function pathIdentity(path: string): string {
  const identity = existsSync(path) ? realpathSync(path) : resolve(path)
  return process.platform === "win32" ? identity.toLowerCase() : identity
}

function gitIsAncestor(repoPath: string, ancestor: string, descendant: string): boolean {
  return gitSucceeds(repoPath, ["merge-base", "--is-ancestor", ancestor, descendant])
}

function gitSucceeds(repoPath: string, args: string[]): boolean {
  return runGit(repoPath, args).ok
}

function requiredGitOutput(repoPath: string, args: string[]): string {
  const result = runGit(repoPath, args)
  if (!result.ok) throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`)
  return result.stdout.trim()
}

function gitOutput(repoPath: string, args: string[]): string {
  const result = runGit(repoPath, args)
  return result.ok ? result.stdout.trim() : ""
}

function runGit(repoPath: string, args: string[], showOutput = false) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    stdio: showOutput ? ["inherit", "pipe", "pipe"] : "pipe",
  })
  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.error?.message ?? result.stderr ?? "",
  }
}

function directorySizeMB(path: string): number {
  if (!existsSync(path)) return 0
  let bytes = 0
  const visit = (entryPath: string) => {
    try {
      const stat = lstatSync(entryPath)
      if (stat.isSymbolicLink()) return
      if (stat.isFile()) {
        bytes += stat.size
        return
      }
      if (stat.isDirectory()) {
        for (const entry of readdirSync(entryPath)) visit(join(entryPath, entry))
      }
    } catch {
      // A size estimate must never make cleanup fail.
    }
  }
  visit(path)
  return Math.round(bytes / 1024 / 1024)
}

async function confirmRemoval(): Promise<boolean> {
  const readline = createInterface({ input, output })
  try {
    const answer = await readline.question("\nRemove these worktrees? (y/N) ")
    return ["y", "yes"].includes(answer.trim().toLowerCase())
  } finally {
    readline.close()
  }
}

function writeUsage(stream: NodeJS.WritableStream) {
  stream.write(
    "Usage: dx worktree cleanup [repo-name-or-path] [--repos-root <path>] [--remote <name>] [--dry-run] [--force] [--no-fetch]\n" +
      "\nWith no repo, the current git repository is used. A repo name is searched for under ./repos by default.\n",
  )
}
