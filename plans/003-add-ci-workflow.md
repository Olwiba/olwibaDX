# Plan 003: Add a CI workflow that typechecks and builds on push/PR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0886dfb..HEAD -- .github/workflows/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

The only workflow in this repo is `publish-package.yml`, which runs on version tags. Nothing typechecks or builds the package on push or pull request, so a broken master is discovered at release time — the worst moment. After this plan, every push to `master` and every PR runs install → typecheck → build on Ubuntu.

## Current state

- `.github/workflows/publish-package.yml` — the only workflow; triggers on `push: tags: ['v*']` and `workflow_dispatch`. Its setup steps (which the new workflow should mirror for consistency) are:

```yaml
# .github/workflows/publish-package.yml:16-33
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org

      - name: Install
        run: bun install --frozen-lockfile

      - name: Build
        run: bun run build
```

- `package.json` scripts: `build` → `tsup`, `tsc` → `tsc --noEmit`. There is no test or lint script (as of `0886dfb`).
- `bunfig.toml` sets `minimumReleaseAge = 604800` for installs — `bun install --frozen-lockfile` respects the lockfile, so this does not affect CI.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install --frozen-lockfile` | exit 0       |
| Typecheck | `bun run tsc`            | exit 0              |
| Build     | `bun run build`          | exit 0              |

## Scope

**In scope** (the only files you should create/modify):
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- `.github/workflows/publish-package.yml` — the release pipeline works; do not consolidate or refactor it.
- `package.json` — do not add lint/test scripts here; those are separate initiatives.

## Git workflow

- Branch: `advisor/003-add-ci-workflow`
- Commit message: `ci: typecheck and build on push and pull request`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches:
      - master
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install
        run: bun install --frozen-lockfile

      - name: Typecheck
        run: bun run tsc

      - name: Build
        run: bun run build
```

Notes: the Node setup step from the publish workflow is omitted — it exists there only for npm registry auth, which CI does not need (tsup runs fine under Bun). If `bun run build` fails in CI for a Node-related reason, see STOP conditions.

**Verify**: file exists and `git diff --name-only` → only `.github/workflows/ci.yml`.

### Step 2: Validate the workflow locally

Run the same gates the workflow runs:

**Verify**: `bun install --frozen-lockfile` → exit 0; `bun run tsc` → exit 0; `bun run build` → exit 0 (prints the olwibaDX ASCII banner on success).

If `actionlint` is available on the machine (`actionlint --version` succeeds), also run `actionlint .github/workflows/ci.yml` → no output. Skip if not installed — do not install it.

## Test plan

Not applicable — workflow file. Local execution of the three commands in Step 2 is the gate; the real proof is the first CI run after push (operator's responsibility).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `.github/workflows/ci.yml` exists with push(master) + pull_request triggers
- [ ] `bun run tsc` exits 0 locally
- [ ] `bun run build` exits 0 locally
- [ ] `git diff --name-only` lists only `.github/workflows/ci.yml` (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A CI workflow (other than the publish one) already exists — reconcile instead of duplicating.
- `bun run build` fails locally for reasons unrelated to this change.
- You feel the need to modify `publish-package.yml` — that is out of scope.

## Maintenance notes

- When a test runner lands (separate initiative: bun test baseline), add a `bun test` step to this workflow between Typecheck and Build.
- If the default branch is ever renamed from `master`, update the push trigger.
- Reviewer: confirm `permissions: contents: read` is present (least privilege) and that the workflow does NOT publish anything.
