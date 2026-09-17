# Changelog














## 0.0.36

### Added

- Compare package.json against node_modules

## 0.0.35

### Added

- `@olwiba/dx/oxlint-design-system.json`, an oxlint preset that puts the design system's rules where a linter can read them. `@olwiba/cn` owns how its components look, colour comes from theme tokens so a component follows light and dark and survives a brand change, and a product composes rather than restyles — until now those lived in component comments and prose, which is the least reliable place to keep a rule
- The preset carries the `@shadcn/lint` settings rather than each product rediscovering them: `@olwiba/cn` as the design system, `componentImports` covering `cn`, `ui`, `ui-pro` and `render`, `cn` as the merge function and `cva` as the variant function. A product extends it from its own `oxlint.json`, so a new product inherits the ruleset instead of hand-rolling it and the rules change in one place. Requires oxlint 1.80 or later, which is where its JS plugin API lands

### Notes

- All six rules — `no-raw-colors`, `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes`, `no-restyle` and `require-static-classes` — are warnings on adoption. Four of them started as errors, against roughly 150 existing violations across the two products that predate the rules, and a lint gate that fails the first time it runs does not get satisfied, it gets switched off. As warnings the counts are real rather than estimated from a grep, and a rule gets promoted to error once its violations are cleared, starting with the colour and spacing ones, which are the smallest
- `no-restyle` allows `layout`. Supplying layout is the part of composition a product is meant to do; the rule is about a product reaching past that into how a component looks
- That reasoning is also in the `note` the settings hand to an agent, so whoever picks this up next reads it where they are working rather than here
- The preset is a JSON file published as-is, not a build output, so `files` now lists `oxlint-design-system.json` beside `dist`. This is the first thing the published package ships that is not `dist`
- Nothing in the repository consumes the preset yet and it is not on the documentation site or in the README. It is there for products to extend
- `@olwiba/cn` and `@olwiba/docs` move to 0.1.53 and 0.1.52. Both are devDependencies used to build the site; neither reaches the published package

## 0.0.34

No user-facing changes.

## 0.0.33

### Changed

- Show the version pill beside the credit line

## 0.0.32

No user-facing changes.

### Notes

- The documentation site's Agent Skills page moves up under Get Started, above Tools, and now carries a table of the catalogue saying what each skill does. It had a paragraph announcing that a list existed, which is the reader doing the navigating to find out whether any of it is for them
- The Toolbox page is gone. A Tools section and a Toolbox section sitting next to each other read as the same thing said twice, and what Toolbox listed is not part of this package — a page that ships with the docs reads as documentation for the thing being documented, whatever the prose around it says
- The GIF in the "why" modal showed at a fixed height under `object-cover`, which cropped the top and bottom off it. It now honours its natural 480x312 aspect inside the dialog, so the whole thing is visible and the modal does not grow to do it
- `.env.example` documents `VITE_GA_MEASUREMENT_ID` for the site, left blank, which is `env-check` reading it as optional under the 0.0.28 rule — unset is the supported default, and nothing loads or leaves the page when it is. It is a `VITE_` build argument baked into the image, so setting it on a running container does nothing until the image is rebuilt
- `@olwiba/cn` and `@olwiba/docs` move to 0.1.44 and 0.1.48. Both are devDependencies used to build the site; neither reaches the published package, which still ships `dist` alone

## 0.0.31

### Added

- Skills and toolbox pages, a shorter modal, and previews that fit

## 0.0.30

No user-facing changes.

### Notes

- The documentation site's title and description now say what the homepage says. They described the package by the stack it belongs to, which none of these tools are specific to, and the description predated `docs-check` — metadata is what search results and link previews show, so every link to the site described something other than what a reader would find there. The site is not part of the published package, which still ships `dist` alone

## 0.0.29

### Added

- `dx docs-check` walks a documentation tree and reports every page that shows a component off without documenting it — a `<Sandbox>` or `<ComponentPreview>` with no `<APIReference>` beside it. A preview is a promise that this is a component you can use, and the properties table is the half of that promise that goes missing, because a page reads as finished long before anyone writes the props down. `--dir <path>` for projects that keep their pages somewhere other than `content/docs`. Exits `1` when there are findings, so it can gate a build
- Pages with no public surface to document opt out in the file, with `{/* api-reference: none — why */}`. The reason is required — the marker alone is a finding — because an escape hatch that costs nothing to use stops being an exception. Opting out and then adding a reference anyway is reported too, so the stale comment gets removed rather than outliving what it described
- `docs-check` evaluates each `<APIReference>` props array and reports one that is not valid JavaScript, naming the error. MDX leaves a page's expressions unevaluated until something renders it, so a mis-escaped quote inside a description survives every build step and surfaces as a blank page in front of a reader. A props entry missing its `name` or `type` is reported the same way

### Changed

- `dx env-check` appears in the CLI usage text, which it never has

### Notes

- Markers are read from what a page renders, not from what it quotes: fenced and inline code come out first. Matching the raw source made the checker's own documentation page its first false positive, and a rule that fires on the page describing the rule gets switched off rather than fixed. Props tables are still read from the raw source, because those are expressions MDX evaluates and stripping inline code would change them
- Only a closing fence strips anything, so a page with an unpaired backtick is read whole. That is the safe direction — the cost is a false positive somebody fixes, where stripping to end of file would let one stray backtick disable the check for everything below it
- The checker ships as a CLI command only. There is no `@olwiba/dx/docs-check` subpath export the way `env-check` has one, so `checkDocs` and `formatDocsReport` are not importable yet
- Pages without a preview are counted and otherwise left alone. This says nothing about index pages, guides, or concept pages — it only holds a page to what the page itself claims
- The repository now builds a documentation site for these tools, including a browser-side `env-check` that imports `src/env-check.ts` directly rather than reimplementing it, so the CLI and the page cannot disagree about what a finding is. None of it is in the published package, which still ships `dist` alone

## 0.0.28

### Changed

- `env-check` takes optionality from the example. A key the example shows blank may now be absent from the environment without being reported — a blank names the setting without claiming a value belongs there, which is the example saying the slot is optional, so absent means the same as blank. Keys the example shows with a value are still reported when they are missing or blank, and `--optional` still covers those

### Notes

- Across four repositories this took fifteen findings down to six. Nine of the removed ones were unset credentials for services those deployments do not use. Drowning the real findings is how a checker gets ignored, and an ignored checker is worse than none — it leaves the next person assuming the environment was verified. The six that remain are all real, including `PACKAGES_TOKEN` set in three environments and documented in none
- This widens the opt-out described in 0.0.25. Blank in both files was already treated as deliberate; absent where the example is blank now reads the same way

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
