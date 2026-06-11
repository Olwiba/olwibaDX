# Plan 001: Sanitize skill slugs in `dx skills install` to prevent path traversal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0886dfb..HEAD -- src/cli.ts src/skills.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

`dx skills install` fetches a JSON manifest from a URL (default `https://olwiba.com/skills/manifest.json`, overridable with `--source <url>`) and writes each skill to `<cwd>/.claude/skills/<slug>/SKILL.md`. The `slug` comes from the remote manifest and is passed to `join()` unsanitized. A malicious or compromised manifest can use a slug like `../../.git/hooks/post-checkout` to write an arbitrary file outside the install directory — including executable git hooks. After this plan, slugs that are not simple directory names are rejected and reported as failures.

## Current state

- `src/cli.ts` — the CLI entry point. `runSkillsInstall()` (lines 41–107) fetches the manifest and writes skills. The vulnerable join is at lines 85–87:

```ts
// src/cli.ts:85-95
  for (const skill of selected) {
    const skillDir = join(installDir, skill.slug)
    const skillPath = join(skillDir, "SKILL.md")
    const url = new URL(skill.contentUrl, source).toString()

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const content = await res.text()
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(skillPath, content, "utf-8")
```

- `src/skills.ts` — currently a types-only module exporting `ManifestSkill` and `SkillsManifest`. It is a published subpath (`@olwiba/dx/skills`) built by tsup to `dist/skills.js`. The new validation function goes here so it is exported and machine-verifiable.

Repo conventions: no semicolons, double quotes, 2-space indent, named exports only (the repo ships its own `no-default-export` ESLint rule). Error output goes to `process.stderr.write(...)`, success to `process.stdout.write(...)` — see `src/cli.ts:47` and `src/cli.ts:100` for the existing pattern. Match it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run tsc`            | exit 0, no errors   |
| Build     | `bun run build`          | exit 0, dist/ written, ASCII banner printed |

There is no test or lint script in this repo (as of `0886dfb`).

## Scope

**In scope** (the only files you should modify):
- `src/skills.ts`
- `src/cli.ts`

**Out of scope** (do NOT touch, even though they look related):
- `selectSkills` / `promptSkillSelection` in `src/cli.ts` — selection logic is unrelated.
- The `--source` flag itself — fetching from arbitrary URLs is by design; only the filesystem write path needs hardening.
- `package.json` exports — `./skills` is already exported.

## Git workflow

- Branch: `advisor/001-sanitize-skills-install-slug`
- Conventional-commit style, e.g. `fix(cli): reject unsafe skill slugs in skills install` (matches repo history, e.g. `fix: correct accent column matching — substring position not char-set membership`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `isSafeSkillSlug` to `src/skills.ts`

Append to `src/skills.ts`:

```ts
const SAFE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i

/**
 * A slug is safe when it is a plain directory name: alphanumeric segments
 * joined by `-`, `_`, or `.`, never starting/ending with a separator, and
 * never containing path separators or `..`.
 */
export function isSafeSkillSlug(slug: string): boolean {
  return SAFE_SLUG_PATTERN.test(slug) && !slug.includes("..")
}
```

**Verify**: `bun run tsc` → exit 0.

### Step 2: Reject unsafe slugs in `runSkillsInstall`

In `src/cli.ts`, import the validator (the file currently has no import from `./skills`):

```ts
import { isSafeSkillSlug } from "./skills"
```

Then guard the loop body before any filesystem path is computed. Current loop start (lines 85–88) becomes:

```ts
  for (const skill of selected) {
    if (!isSafeSkillSlug(skill.slug)) {
      process.stderr.write(`  ✗ skipped unsafe slug: ${JSON.stringify(skill.slug)}\n`)
      failed++
      continue
    }
    const skillDir = join(installDir, skill.slug)
```

**Verify**: `bun run tsc` → exit 0.

### Step 3: Build and verify the published behavior

Run `bun run build`, then check the built validator directly:

**Verify**:

```bash
node -e "import('./dist/skills.js').then(m => console.log(m.isSafeSkillSlug('my-skill'), m.isSafeSkillSlug('../evil'), m.isSafeSkillSlug('a/b'), m.isSafeSkillSlug('..'), m.isSafeSkillSlug('with.dots')))"
```

→ prints `true false false false true`

## Test plan

No test infrastructure exists in this repo yet (a separate initiative). The inline `node -e` check in Step 3 is the verification gate. If a `bun test` setup exists by the time you execute this (check for `*.test.ts` files), add `src/skills.test.ts` covering: a normal slug, `..`, `../x`, `a/b`, `a\\b`, empty string, leading `-`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run tsc` exits 0
- [ ] `bun run build` exits 0
- [ ] Step 3 `node -e` check prints `true false false false true`
- [ ] `git diff --name-only` lists only `src/skills.ts` and `src/cli.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/cli.ts:85-95` does not match the "Current state" excerpt (codebase drifted).
- `src/skills.ts` is no longer types-only (someone added runtime code that conflicts).
- Typecheck or build fails twice after a reasonable fix attempt.
- You find other remote-controlled values flowing into filesystem paths beyond `skill.slug` — report them, do not expand scope.

## Maintenance notes

- Plan 005 (dedupe manifest types) also touches `src/cli.ts` and `src/skills.ts` — execute this plan first; 005's drift check will absorb the changes.
- If a `skills update`/`uninstall` command is ever added, it must reuse `isSafeSkillSlug` before touching any path derived from a manifest.
- Reviewer: confirm the guard runs before `join(installDir, skill.slug)` is computed, and that the failure increments the existing `failed` counter so the summary line stays accurate.
