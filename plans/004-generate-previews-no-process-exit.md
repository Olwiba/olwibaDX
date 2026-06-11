# Plan 004: Stop `generatePreviews` from killing the host process; align style with the repo

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0886dfb..HEAD -- src/generate-previews.ts`
> If the file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (behavior change is throw-instead-of-exit; consumers are first-party scripts)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

`generatePreviews` is a library function exported at `@olwiba/dx/generate-previews`, but when the dev server is unreachable it calls `process.exit(1)` — terminating whatever process imported it, with no chance to handle the error. It also throws a message-less `Error` that it immediately swallows. Separately, the file is the lone style outlier in the repo (semicolons, single quotes, `console.log`) which makes every future diff noisy. After this plan the function throws a descriptive error instead of exiting, and the file matches repo style.

## Current state

- `src/generate-previews.ts` — Puppeteer screenshot tool. The offending block:

```ts
// src/generate-previews.ts:73-79
  try {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error();
  } catch {
    console.error(`\nDev server not running at ${baseUrl}.\nStart it first, then re-run iso:generate.\n`);
    process.exit(1);
  }
```

- The rest of the file uses `console.log`/`console.error` for progress output (lines 82, 192, 194, 208) and semicolons/single quotes throughout.
- Repo style everywhere else (`src/cli.ts`, `src/dev-banner.ts`, etc.): no semicolons, double quotes, `process.stdout.write(...)` / `process.stderr.write(...)` with explicit `\n`. Exemplar: `src/cli.ts:54` `process.stdout.write(\`Fetching manifest from ${source}\n\`)`.
- Known consumers: olwibaCN / olwibaDOCS / olwibaUI docs sites call this from one-shot scripts (e.g. an `iso:generate` script), so throw-vs-exit reaches a top-level rejection that still fails the script — exit code stays nonzero either way.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run tsc`            | exit 0              |
| Build     | `bun run build`          | exit 0              |

## Scope

**In scope** (the only file you should modify):
- `src/generate-previews.ts`

**Out of scope** (do NOT touch):
- The screenshot/theming logic inside the `for (const component of components)` loop — the `page.evaluateOnNewDocument` / MutationObserver dance is deliberate (next-themes workaround, see comments at lines 104 and 110). Do not "simplify" it.
- The function's public signature, `GeneratePreviewsConfig`, `ManifestEntry` — published API.
- Per-component error handling (lines 193–195) — catching and continuing per component is intended behavior; only convert its output call style.

## Git workflow

- Branch: `advisor/004-generate-previews-no-process-exit`
- Commit message: `fix(previews): throw instead of process.exit; align file style with repo`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the exit with a thrown error

Replace lines 73–79 with:

```ts
  try {
    const res = await fetch(baseUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    const detail = err instanceof Error && err.message ? ` (${err.message})` : ""
    throw new Error(
      `Dev server not reachable at ${baseUrl}${detail}. Start it first, then re-run.`,
    )
  }
```

**Verify**: `grep -n "process.exit" src/generate-previews.ts` → no matches.

### Step 2: Convert output calls and style

- Replace `console.log(...)` at lines 82, 192, 208 with `process.stdout.write(\`...\n\`)`.
- Replace `console.error(...)` at line 194 with `process.stderr.write(...)`; that call currently passes the error object as a second argument — interpolate it instead: `` process.stderr.write(`✗ ${component.name} (${theme}): ${err instanceof Error ? err.message : String(err)}\n`) ``.
- Convert the file to repo style: double quotes, no semicolons. Do not restructure logic while doing this — quote/semicolon/output-call changes only.

**Verify**: `grep -n "console\." src/generate-previews.ts` → no matches; `bun run tsc` → exit 0.

### Step 3: Build

**Verify**: `bun run build` → exit 0.

## Test plan

No test infrastructure exists in this repo yet. Behavioral gate: from the repo root run

```bash
node -e "import('./dist/generate-previews.js').then(m => m.generatePreviews({ baseUrl: 'http://127.0.0.1:59999', outputDir: './.tmp-previews', components: [] })).then(() => { console.log('NO-THROW'); process.exit(2) }, (e) => { console.log('THREW:', e.message); })"
```

→ prints `THREW: Dev server not reachable at http://127.0.0.1:59999...` and exits 0. (Before this change, the same invocation would exit 1 without a catchable error.) Remove `./.tmp-previews` if it was created (it should not be — the throw happens first).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "process.exit" src/generate-previews.ts` → 0
- [ ] `grep -c "console\." src/generate-previews.ts` → 0
- [ ] `bun run tsc` exits 0 and `bun run build` exits 0
- [ ] Step "Test plan" node check prints `THREW: ...`
- [ ] `git diff --name-only` lists only `src/generate-previews.ts` (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpt at lines 73–79 doesn't match the live file.
- Any downstream repo in the workspace greps as relying on `process.exit` behavior from this function (e.g. checks nothing and assumes the process dies) — check with `grep -rn "generatePreviews" ../olwibaCN ../olwibaDOCS ../olwibaUI --include=*.ts` if those sibling dirs exist; if a consumer would silently continue past a failure, report before changing semantics.
- You find yourself editing the theming/screenshot logic.

## Maintenance notes

- This is a behavior change for consumers that relied on the hard exit: they now get a rejected promise. First-party scripts fail either way (unhandled rejection = nonzero exit on Node ≥ 15), but a release note line is warranted when this ships.
- Reviewer: diff should show only quotes/semicolons/output-calls plus the one throw block — any logic restructure is scope creep.
