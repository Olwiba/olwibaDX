# Plan 005: Deduplicate skills-manifest types between `cli.ts` and `skills.ts`

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
> mismatch, treat it as a STOP condition. Note: plan 001 intentionally
> modifies both files — if 001 is DONE, expect an `isSafeSkillSlug` import in
> `cli.ts` and a validator in `skills.ts`; that is NOT drift.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-sanitize-skills-install-slug.md (soft — execute 001 first to avoid merge noise; this plan still works if 001 was skipped)
- **Category**: tech-debt
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

The skills-manifest shape is defined twice: `ManifestSkill`/`SkillsManifestResponse` privately in `src/cli.ts:25-39`, and `ManifestSkill`/`SkillsManifest` publicly in `src/skills.ts:1-15`. The fields are identical today, but two copies are free to drift — and the public `@olwiba/dx/skills` subpath exists precisely so consumers (and the CLI) share one contract. After this plan the CLI imports the types from `./skills` and the duplicate definitions are gone.

## Current state

- `src/skills.ts` — public types module (subpath `@olwiba/dx/skills`):

```ts
// src/skills.ts:1-15
export interface ManifestSkill {
  slug: string
  name: string
  description: string
  category?: string
  providers?: string[]
  examples?: string[]
  tip?: string | null
  contentUrl: string
}

export interface SkillsManifest {
  version: string
  skills: ManifestSkill[]
}
```

- `src/cli.ts:25-39` — private duplicates with the same fields; the manifest one is named `SkillsManifestResponse` and is used at `src/cli.ts:56` (`let manifest: SkillsManifestResponse`). `ManifestSkill` is referenced in `selectSkills` and `promptSkillSelection` signatures (lines 109–112, 126).
- tsup builds `src/cli.ts` as a separate entry with `dts: false` (see `tsup.config.ts:34-43`); type-only imports between entries are erased at build time, so this introduces no runtime coupling.
- Repo style: no semicolons, double quotes, `import type { ... }` for type-only imports (the repo's own ESLint config enforces `consistent-type-imports` — see `src/eslint.ts:49-52`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run tsc`            | exit 0              |
| Build     | `bun run build`          | exit 0              |

## Scope

**In scope** (the only file you should modify):
- `src/cli.ts`

**Out of scope** (do NOT touch):
- `src/skills.ts` — it is the canonical copy; nothing to change there (plan 001 adds a function to it; that is plan 001's business).
- Renaming the public types or changing any field — published API.

## Git workflow

- Branch: `advisor/005-dedupe-manifest-types`
- Commit message: `refactor(cli): import manifest types from skills module`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the private interfaces with an import

In `src/cli.ts`:

1. Delete the `interface ManifestSkill { ... }` and `interface SkillsManifestResponse { ... }` blocks (lines 25–39 at `0886dfb`).
2. Add to the imports at the top:

```ts
import type { ManifestSkill, SkillsManifest } from "./skills"
```

(If plan 001 already added `import { isSafeSkillSlug } from "./skills"`, merge into: `import { isSafeSkillSlug, type ManifestSkill, type SkillsManifest } from "./skills"` — or keep separate value/type imports; the repo's lint prefers separate type imports.)

3. Rename the one usage of `SkillsManifestResponse` (line 56) to `SkillsManifest`.

**Verify**: `bun run tsc` → exit 0; `grep -n "SkillsManifestResponse\|^interface ManifestSkill" src/cli.ts` → no matches.

### Step 2: Build

**Verify**: `bun run build` → exit 0. Then confirm the built CLI still parses: `node dist/cli.js` → prints the `Usage:` block, exit 0.

## Test plan

No test infrastructure exists in this repo yet. Gates: typecheck, build, and the `node dist/cli.js` usage-print check above.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "SkillsManifestResponse" src/cli.ts` → 0
- [ ] `grep -c "interface ManifestSkill" src/cli.ts` → 0
- [ ] `src/cli.ts` contains a type import from `"./skills"`
- [ ] `bun run tsc` exits 0; `bun run build` exits 0; `node dist/cli.js` prints usage
- [ ] `git diff --name-only` lists only `src/cli.ts` (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The two definitions are no longer field-identical (someone changed one copy since `0886dfb`) — unifying then changes behavior; report which fields differ.
- Typecheck surfaces errors in files other than `src/cli.ts`.

## Maintenance notes

- Future manifest-shape changes now happen only in `src/skills.ts` and flow to the CLI automatically.
- Reviewer: confirm the import is type-only (erased at build) so `dist/cli.js` gains no new runtime import.
