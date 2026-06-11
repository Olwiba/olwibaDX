# Plan 002: Fix broken README usage examples

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0886dfb..HEAD -- README.md src/index.ts src/ascii/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `0886dfb`, 2026-06-11

## Why this matters

Two copy-paste examples in the README of this published npm package (`@olwiba/dx`) reference exports that do not exist. A new consumer following the README hits an import error on first contact. This plan corrects the examples to match the real export surface — it changes documentation only, no source code.

## Current state

- `README.md` — package readme shown on npm and GitHub.
- `src/index.ts` — root barrel. Exports ONLY banner APIs:

```ts
// src/index.ts:1-11
export { createDevBannerPlugin, createTsupBannerHook, printBanner } from "./dev-banner"
export type { BannerSegment } from "./dev-banner"
export {
  createProjectDevBannerPlugin,
  createProjectTsupBannerHook,
} from "./project-brand"
```

- `src/ascii/index.ts` — the `@olwiba/dx/ascii` subpath. There is NO `renderAscii` export. Real exports: `composeAsciiText`, `getAsciiAccentColumns`, `parseFigletFont`, `getAsciiCanvasSize`, `getAsciiCellIntensity`, `renderAsciiFrameToContext`, `asciiFonts`, `dosrebelFont`, `getAsciiFont`, plus types.

Broken example 1 — `README.md:66-71` claims a `renderAscii` function:

```md
Figlet renderer with a bundled DOS Rebel font. Powers the `<AsciiText>` component in `@olwiba/cn`.

```ts
import { renderAscii } from "@olwiba/dx/ascii";

const art = renderAscii("hello", { font: "dosrebel" });
```
```

Broken example 2 — `README.md:86-95` imports `generatePreviews` from the root, but it only exists at the `@olwiba/dx/generate-previews` subpath (see `package.json` `exports["./generate-previews"]`):

```md
```ts
import { generatePreviews } from "@olwiba/dx";

await generatePreviews({
  url: "http://localhost:3000/preview",
  outputDir: "./public/previews",
});
```
```

Additionally, `generatePreviews`'s real config (see `GeneratePreviewsConfig` in `src/generate-previews.ts:12-22`) has no `url` field — it is `baseUrl`, and `components` is required.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run tsc`            | exit 0 (sanity only — this plan must not change `src/`) |

## Scope

**In scope** (the only files you should modify):
- `README.md`

**Out of scope** (do NOT touch):
- Anything under `src/` — do not "fix" this by adding a `renderAscii` export or re-exporting `generatePreviews` from the root; that is an API-design decision not made here.
- `package.json` exports.

## Git workflow

- Branch: `advisor/002-fix-readme-examples`
- Commit message: `docs: fix README examples to match real export surface`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the ASCII example

Replace the code block at `README.md:67-71` with a working example using the real API:

```ts
import { parseFigletFont, composeAsciiText, dosrebelFont } from "@olwiba/dx/ascii";

const font = parseFigletFont(dosrebelFont);
const layout = composeAsciiText(font, "hello"); // { cells, cols, rows }
```

Keep the surrounding prose; adjust the sentence if it implies a string-returning renderer (the API returns a cell layout consumed by canvas renderers / the GIF generator).

**Verify**: `Select-String -Path README.md -Pattern "renderAscii\b" -CaseSensitive | Where-Object { $_.Line -notmatch "renderAsciiFrameToContext" }` → no output (PowerShell), or `grep -n "renderAscii(" README.md` → no matches.

### Step 2: Fix the preview-generator example

Replace the code block at `README.md:88-95` with:

```ts
import { generatePreviews } from "@olwiba/dx/generate-previews";

await generatePreviews({
  baseUrl: "http://localhost:3000",
  outputDir: "./public/previews",
  components: [{ name: "button" }],
});
```

**Verify**: `grep -n 'generatePreviews } from "@olwiba/dx"' README.md` → no matches; `grep -n "baseUrl" README.md` → 1 match.

### Step 3: Sweep for other dead references

Check every remaining `import ... from "@olwiba/dx...` line in README.md against the actual exports in `src/index.ts`, `src/ascii/index.ts`, and `package.json` `exports`. As of `0886dfb` the only other example is `createDevBannerPlugin` from the root, which is valid.

**Verify**: `bun run tsc` → exit 0 and `git diff --name-only` → only `README.md`.

## Test plan

Not applicable — docs-only change. The grep gates above are the verification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "renderAscii(" README.md` → 0
- [ ] README's generatePreviews example imports from `@olwiba/dx/generate-previews` and uses `baseUrl` + `components`
- [ ] `git diff --name-only` lists only `README.md` (and `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A `renderAscii` export HAS been added to `src/ascii/index.ts` since `0886dfb` — the README may now be correct; report instead of editing.
- Fixing an example would require changing code in `src/` to make it true.

## Maintenance notes

- If the maintainer later wants a convenience `renderAscii(text) => string[]` helper (the shape the old README implied), that is a small feature: `src/dos-rebel-font.ts`'s `renderDosRebel` is essentially it, but it is not exported from any public subpath. Deliberately deferred — API addition needs a maintainer decision.
- Reviewer: run both example snippets mentally against `src/ascii/index.ts` and `src/generate-previews.ts` signatures.
