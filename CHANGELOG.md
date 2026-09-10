# Changelog





## 0.0.27

No user-facing changes.

### Notes

- The `env-check` test suite now uses `node:test` and `node:assert/strict` like the rest of the repo. It had imported `bun:test`, which passed locally under bun but failed the CI typecheck — `tsconfig` declares `types: ["node"]` only, and CI typechecks the whole `src` tree. Behaviour of `checkEnv`, `formatEnvReport`, and `parseEnv` is unchanged

## 0.0.26

No user-facing changes.

## 0.0.25

### Added

- `dx env-check` (also `dx env`) compares a real environment against the `.env.example` that documents it. The example is the schema, which is what makes this work in repositories that have no typed one — and those are the repositories where environments quietly rot. Exits `1` when there are findings, so it can gate a deploy
- Renames are their own finding, reported with the name they were probably meant to be: `✗ VITE_PUBLIC_DOCS  →  did you mean PUBLIC_DOCS?`. A renamed key reads as configured at a glance, so calling it a generic unknown would not tell anyone that the setting it was meant to carry is now unset and a default nobody chose is in force. The report also flags missing keys, keys present but empty where the example shows a value, duplicate assignments, and malformed lines
- Flags: `--example <path>` (defaults to `.env.example`), `--file <path>`, and `--optional <a,b,c>` for keys allowed to be absent or blank. Without `--file` it reads stdin, so a deployment's variables can be pasted straight out of a hosting dashboard
- `@olwiba/dx/env-check` exports `checkEnv`, `formatEnvReport`, and `parseEnv` for use outside the CLI

### Notes

- The comparison is plain string work in memory. Nothing is written to disk, echoed back, or sent anywhere, and no model is involved — the only honest way to accept a file of live credentials. Values are discarded during parsing rather than filtered out of the report, so a later change to the output format cannot start leaking one; a test asserts a live-looking secret never reaches the output
- Malformed lines are reported by line number with the first 24 characters only, because a line missing its `=` may itself be a pasted secret
- Rename detection compares names with non-alphanumerics stripped, and treats a prefix or suffix on an otherwise identical name as a match once the known key is at least six characters. Short keys are left alone rather than guessed at
- A key blank in both files is treated as a deliberate opt-out, not a finding. Where a key is assigned twice, the last assignment decides, matching what most loaders do

## 0.0.24

### Added

- Support authenticated pages in generatePreviews

### Changed

- Harden public DX tooling

## 0.0.23

### Added

- `generateAssets` takes `ogComponent` — a path to a rendered SVG/PNG/JPG/WebP composited into `og-image.png`. With it set, the OG image switches from the large-logo layout to a solid brand-colour field with a small mark and wordmark at the top and the component filling the space beneath. `dx generate-assets` exposes it as `--og-component <svg-or-image-path>`
- An ambient glow behind the component, so it sits on the brand field rather than on top of it. White at low opacity rather than a tint, so it reads as light on any brand colour instead of becoming a second colour competing with it

### Notes

- The component scales to width and is allowed to run off the bottom edge. A screenshot that fits entirely inside the frame reads as a picture of an app; one that continues past it reads as the app, and the detail stays legible at the size a link preview is actually seen. A component short enough to fit still centres in the space under the header, so a wide strip does not cling to the wordmark with a gulf beneath it
- `ogComponent` takes an already-rendered image. Nothing here renders React — a component has to be screenshotted or drawn first
- The experimental annotated `.env.example` parser documented in 0.0.12 and 0.0.13 was removed and is not part of the current public API




## 0.0.22

No user-facing changes.

## 0.0.21

### Changed

- **Breaking:** `resolveDevPort` no longer falls back to the next free port — it throws when the preferred port is taken. Silently moving to 3001 booted fine and then failed every sign-in with "Invalid origin", because `BETTER_AUTH_TRUSTED_ORIGINS` pins the origin. The error names the port and shows the explicit opt-in (`PORT=3001 bun run dev`) plus the trusted-origins caveat. Running a second app concurrently still works, it just has to be asked for.
- **Breaking:** `resolveDevPort` dropped its `attempts` parameter, which no longer had meaning without the fallback scan. `findFreePort(start, attempts)` is unchanged for callers that do want a scan.

### Fixed

- `createTsupBannerHook` dedupes across hook instances, so the same banner prints once per build instead of once per tsup entry.

## 0.0.20

### Changed

- Exempt first-party @olwiba/* from minimum release age

## 0.0.19

### Added

- `findFreePort` and `resolveDevPort` helpers — probe for the first free port from a preferred base so dev servers fall back cleanly when the port is taken.

## 0.0.18

No user-facing changes.

## 0.0.17

### Fixed

- Added `sharp` to devDependencies so DTS type resolution succeeds in CI.

## 0.0.16

No user-facing changes.

## 0.0.15

No user-facing changes.

## 0.0.14

No user-facing changes.

## 0.0.13

### Added

- Added an experimental annotated `.env.example` parser for environment variable validation (subsequently removed; it is not part of the current public API)

### Fixed

- Correct accent column matching to use substring position instead of char-set membership

## 0.0.12

### Added

- Added an experimental annotated `.env.example` parser for environment variable validation (subsequently removed; it is not part of the current public API)

### Fixed

- Correct accent column matching to use substring position instead of character-set membership

## 0.0.11

### Fixed

- `generatePreviews` forces light/dark before page scripts run (`evaluateOnNewDocument`), emulates `prefers-color-scheme`, and waits for `<html class="dark">` to match — fixes Fumadocs/next-themes sites where post-load toggles were overridden.

## 0.0.10

### Changed

- Packages now published via npm Trusted Publishing (OIDC) with provenance attestation.

## 0.0.9

### Changed

- `skills install` now fetches from a remote manifest instead of bundled data.

## 0.0.8

### Changed

- Republished to recover from a failed publish workflow run. No source changes.

## 0.0.6

### Changed

- Republished to recover from a failed publish workflow run. No source changes.

## 0.0.5

### Changed

- Republished to recover from a failed publish workflow run. No source changes.

## 0.0.4

### Changed

- Republished to recover from a failed publish workflow run. No source changes.

## 0.0.3

### Added

- ESLint config and skills manifest design spec.

### Changed

- DX banner colour set to orange.
- Dev banner now also runs on this package's own tsup watcher.

## 0.0.2

### Added

- `createTsupBannerHook` — returns an `onSuccess` function for tsup configs; shows the banner once on first successful build.

## 0.0.1

### Added

- Initial release.
- `createDevBannerPlugin` — Vite plugin that prints a coloured ASCII art banner on dev server start.
- `printBanner` — standalone banner printer for use outside Vite.
