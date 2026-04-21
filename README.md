# @olwiba/dx

> Developer experience tooling for the Olwiba ecosystem.

## What This Is

`@olwiba/dx` is the DX package in the Nexus ecosystem.

Use it for:
- dev server banners and terminal output utilities
- build-time developer tooling shared across ecosystem repos

## Package Chain

```text
@olwiba/cn    -> shared primitives, styles, hooks, and low-level interactions
@olwiba/docs  -> docs shell, search, and MDX helpers built on @olwiba/cn
@olwiba/ui    -> app shells, marketing sections, and higher-level UI
@olwiba/dx    -> developer experience tooling (build-time, Node-only)
```

## Installation

```bash
bun add -d @olwiba/dx
```

No peer dependencies. Pure Node/build-time — safe to install as a devDependency in any project.

## Dev Banner

Prints a coloured ASCII art banner in the terminal when your Vite dev server starts.

### Vite plugin (recommended)

```ts
// vite.config.ts
import { createDevBannerPlugin } from "@olwiba/dx"

export default defineConfig({
  plugins: [
    createDevBannerPlugin({
      segments: [
        { text: "my" },
        { text: "App", colorHex: "#22D3EE" },
      ],
    }),
  ],
})
```

### Standalone

```ts
import { printBanner } from "@olwiba/dx"

await printBanner({
  segments: [
    { text: "my" },
    { text: "App", colorHex: "#22D3EE" },
  ],
})
```

### Compact fallback

Pass `compactSegments` to show a shorter banner on narrow terminals:

```ts
createDevBannerPlugin({
  segments: [
    { text: "olwiba" },
    { text: "DOCS", colorHex: "#f59e0b" },
  ],
  compactSegments: [
    { text: "o" },
    { text: "DOCS", colorHex: "#f59e0b" },
  ],
})
```

## Release

Releases are tag-driven. Push a `v*` tag matching `package.json` version to trigger CI publish.
