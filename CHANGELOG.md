# Changelog

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

- Parse annotated `.env.example` specs to drive environment variable validation

### Fixed

- Correct accent column matching to use substring position instead of char-set membership

## 0.0.12

### Added

- Parse annotated `.env.example` specs for environment variable validation

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
