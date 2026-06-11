# Plan 006: Put `types` first in exports conditions and make `eslint` an optional peer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0886dfb..HEAD -- package.json`
> If `package.json` changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

Two packaging issues in `package.json`:

1. Every `exports` entry lists the `"import"` condition before `"types"`. TypeScript matches export conditions in order and documents that `"types"` must come first; resolution currently works only by accident (tsup emits `.d.ts` files adjacent to each `.js`, so TS falls back to sibling lookup). Any future change to output layout silently breaks consumer types.
2. `eslint` is the only peer dependency NOT marked optional in `peerDependenciesMeta`, so every consumer installing `@olwiba/dx` — even ones that never touch the lint config — gets an eslint peer requirement (Bun auto-installs peers; npm warns). The lint config is one optional feature among several; all its sibling peers (`@typescript-eslint/*`, `eslint-plugin-react-hooks`) are already optional, and `src/eslint.ts` already degrades gracefully when plugins are missing.

## Current state

- `package.json:14-43` — exports map; every entry has the shape:

```json
".": {
  "import": "./dist/index.js",
  "types": "./dist/index.d.ts"
},
```

There are 7 entries: `.`, `./eslint`, `./skills`, `./generate-previews`, `./ascii`, `./ascii-gif`, `./generate-assets`.

- `package.json:61-69` — peers:

```json
"peerDependencies": {
  "eslint": ">=9.0.0",
  "puppeteer-core": ">=22.0.0",
  "@typescript-eslint/eslint-plugin": ">=8.0.0",
  "@typescript-eslint/parser": ">=8.0.0",
  "eslint-plugin-react-hooks": ">=5.0.0",
  "sharp": ">=0.32.0",
  "lucide-static": ">=0.400.0"
}
```

- `package.json:70-89` — `peerDependenciesMeta` marks all of the above optional EXCEPT `eslint`.
- `src/eslint.ts:1` imports eslint types only (`import type { ESLint, Linter, Rule } from "eslint"`) — no runtime import of the `eslint` package itself, so marking it optional cannot break runtime resolution.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run tsc`            | exit 0              |
| Build     | `bun run build`          | exit 0              |
| Pack check| `npm pack --dry-run`     | exit 0, lists dist files |

## Scope

**In scope** (the only file you should modify):
- `package.json`

**Out of scope** (do NOT touch):
- `version` field — releases are tag-driven and owned by the release script.
- Adding `"default"` conditions, `"require"` conditions, or restructuring exports beyond reordering — the package is ESM-only by design.
- `tsup.config.ts`.

## Git workflow

- Branch: `advisor/006-packaging-exports-and-peers`
- Commit message: `fix(pkg): types-first export conditions; mark eslint peer optional`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Reorder conditions — `types` first in all 7 exports entries

Each entry becomes (example for `.`):

```json
".": {
  "types": "./dist/index.d.ts",
  "import": "./dist/index.js"
},
```

Apply to all 7 entries. Do not change any path values.

**Verify**:

```bash
node -e "const e = require('./package.json').exports; const bad = Object.entries(e).filter(([,v]) => Object.keys(v)[0] !== 'types'); console.log(bad.length === 0 ? 'OK' : 'BAD: ' + bad.map(([k])=>k))"
```

→ prints `OK`

### Step 2: Mark `eslint` optional in `peerDependenciesMeta`

Add to the existing `peerDependenciesMeta` object:

```json
"eslint": {
  "optional": true
},
```

Keep `eslint` in `peerDependencies` (the version constraint still applies when present).

**Verify**: `node -e "console.log(require('./package.json').peerDependenciesMeta.eslint.optional === true ? 'OK' : 'BAD')"` → prints `OK`

### Step 3: Full gate

**Verify**: `bun run tsc` → exit 0; `bun run build` → exit 0; `npm pack --dry-run` → exit 0 and the file list contains `dist/index.d.ts`, `dist/eslint.d.ts`, `dist/ascii/index.d.ts`. Delete any `.tgz` if one was created despite `--dry-run` (it should not be; `*.tgz` is gitignored regardless).

## Test plan

Not applicable — manifest-only change. The `node -e` assertions plus build/pack are the gates. A full consumer-resolution test (installing the packed tarball into a scratch project and typechecking an import of each subpath) is worthwhile but deferred to release verification, which this ecosystem already does downstream.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 1 `node -e` check prints `OK` (types first in all 7 entries)
- [ ] Step 2 `node -e` check prints `OK` (eslint optional)
- [ ] `bun run tsc`, `bun run build`, `npm pack --dry-run` all exit 0
- [ ] `git diff --name-only` lists only `package.json` (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The exports map at `0886dfb` shape doesn't match (e.g. someone added `"default"` conditions or an `./env` entry) — reorder rules still apply but report the new surface first.
- `npm pack --dry-run` shows missing `.d.ts` files — that's a pre-existing build problem, not yours to fix.

## Maintenance notes

- Whenever a new subpath export is added, keep `"types"` as the first condition — consider this the repo convention now.
- The optional-eslint change means a consumer using `@olwiba/dx/eslint` without eslint installed gets a module-resolution error at lint time rather than an install-time prompt; that is the same contract as the other optional peers (`sharp`, `puppeteer-core`) and matches the graceful-degradation messages already in `src/eslint.ts:56-60`.
- Reviewer: confirm no path values changed, only key order and the one meta addition.
