# Design: ESLint Config + Skills Manifest

**Date:** 2026-04-24
**Package:** `@olwiba/dx`

## Overview

Two new subpath exports added to the existing `@olwiba/dx` package:

- `@olwiba/dx/eslint` — opinionated flat config factory
- `@olwiba/dx/skills` — curated skills manifest + install CLI

One install, everything included. No new package.

---

## `@olwiba/dx/eslint`

A `olwiba()` factory function returns an ESLint flat config array.

```ts
// eslint.config.ts
import { olwiba } from "@olwiba/dx/eslint"
export default olwiba({ react: true })
```

### Layers

**Base (always on, zero peer deps)**

Custom rules bundled directly — no external plugin required:

- No default exports (named exports only)
- No `any` — use `unknown`
- Consistent `import type {}` for type-only imports
- No `console.log` left in code (warn)
- Prefer `const` arrow functions for React components

**TypeScript layer (peer dep: `@typescript-eslint`)**

Proxies a curated subset of `@typescript-eslint` strict-type-checked rules. Not the full preset — Olwiba-selected rules only.

**React layer (opt-in: `{ react: true }`, peer dep: `eslint-plugin-react-hooks`)**

- Rules of Hooks enforced
- No inline styles

### Peer dep behaviour

If a peer dep is not installed, that layer is silently skipped and a hint is printed to the terminal. Base rules always work with zero extra installs.

### Package shape additions

`package.json` exports:
```json
"./eslint": {
  "import": "./dist/eslint.js",
  "types": "./dist/eslint.d.ts"
}
```

---

## `@olwiba/dx/skills`

A curated JSON manifest ships inside the package. Each entry names a recommended Claude Code skill, points to its external source (nothing hosted by `@olwiba/dx`), and describes the antipattern it catches.

```json
{
  "skills": [
    {
      "name": "bun-link-antipattern",
      "source": "...",
      "description": "Detects bun link usage which breaks SSR"
    },
    {
      "name": "no-barrel-abuse",
      "source": "...",
      "description": "Flags deep barrel re-export chains"
    }
  ]
}
```

### CLI

A `dx` binary reads the manifest and installs skills to `.claude/plugins/` in the current project:

```bash
bunx @olwiba/dx skills install
# or, if installed as devDep:
dx skills install
```

`package.json` additions:
```json
"bin": { "dx": "./dist/cli.js" },
"./skills": {
  "import": "./dist/skills.js",
  "types": "./dist/skills.d.ts"
}
```

### Manifest ownership

The manifest is Olwiba-curated. Skills are added/removed as opinions evolve. Users re-run `dx skills install` to sync. No skill content is hosted — the manifest points to external sources only.

---

## Non-goals

- No hosting of skill files
- No auto-fixing rules beyond what ESLint natively supports
- No framework-specific rules beyond React
