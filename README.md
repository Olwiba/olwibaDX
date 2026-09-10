<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Olwiba/olwibaDX/master/.github/assets/olwibaDX--light.gif" />
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Olwiba/olwibaDX/master/.github/assets/olwibaDX.gif" />
    <img src="https://raw.githubusercontent.com/Olwiba/olwibaDX/master/.github/assets/olwibaDX.gif" alt="olwibaDX" style="width: 100%;" />
  </picture>
</p>

<p align="center">
  <strong>Developer experience tooling for the Olwiba ecosystem.</strong>
</p>

<p align="center">
  <a href="https://github.com/Olwiba/olwibaDX/issues/new?template=bug_report.md">🪲 Report a bug</a> ·
  <a href="https://github.com/Olwiba/olwibaDX/issues/new?template=feature_request.md">✨ Feature request</a>
</p>

<p align="center">
  <a href="https://github.com/sponsors/Olwiba"><img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=22c55e" alt="Sponsor" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Olwiba/olwibaDX?label=license&logo=github" alt="License" /></a>
  <a href="https://github.com/Olwiba/olwibaDX/issues"><img src="https://img.shields.io/github/issues/Olwiba/olwibaDX" alt="Issues" /></a>
</p>

## What This Is

`@olwiba/dx` is a collection of tools focused on delivering the best developer experience when building projects.

A lot of what's in here reflects personal preference.  
This package grows as the ecosystem grows, so expect new features over time.

Feel free to request additions or leverage what's already added as you see fit.

## Installation

```bash
bun add -d @olwiba/dx
```

## Features

### Dev Banners

Coloured ASCII banners printed on Vite dev server start and tsup build success. Makes it instantly obvious which project is running in your terminal.

```ts
// vite.config.ts
import { createDevBannerPlugin } from "@olwiba/dx";

export default defineConfig({
  plugins: [
    createDevBannerPlugin({
      segments: [
        { text: "my" },
        { text: "App", colorHex: "#22D3EE" },
      ],
    }),
  ],
});
```

For tsup, swap `createDevBannerPlugin` for `createTsupBannerHook` and pass it to `onSuccess`. For a one-shot print, call `printBanner` directly.

### ASCII Text

Figlet renderer with a bundled DOS Rebel font. Powers the `<AsciiText>` component in `@olwiba/cn`.

```ts
import { composeAsciiText, getAsciiFont } from "@olwiba/dx/ascii";

const layout = composeAsciiText(getAsciiFont("dosrebel"), "hello");
```

### ASCII GIF Generator

Render an animated ASCII GIF from any text. This is what produced the README banner you see at the top of this file.

```bash
bunx @olwiba/dx ascii-gif \
  --text "olwibaDX" \
  --accent "DX" \
  --out ./.github/assets/olwibaDX.gif
```

### Asset Generator

Generate favicons, app icons, manifest files, robots.txt, and an `og-image.png` from a Lucide icon or SVG mark.

```bash
bunx @olwiba/dx generate-assets \
  --name "myApp" \
  --icon ./public/logo.svg \
  --color "#0d9488" \
  --og-component ./public/search-bar.svg \
  --out ./public
```

`--og-component` is optional and only affects the social image: it renders the given SVG/PNG/JPG/WebP
component bottom-middle on a solid `--color` background, with a small `--icon` + `--name` wordmark
grouped above it. Without it, `og-image.png` uses the default large-logo layout. Favicons and app
icons always use `--icon`.

```ts
import { generateAssets } from "@olwiba/dx/generate-assets";

await generateAssets({
  name: "myApp",
  icon: "./public/logo.svg",
  color: "#0d9488",
  outputDir: "./public",
  ogComponent: "./public/search-bar.svg",
});
```

### Preview Generator

Puppeteer-based screenshot tool used to pre-render the isometric preview tiles on docs sites.

```ts
import { generatePreviews } from "@olwiba/dx/generate-previews";

await generatePreviews({
  baseUrl: "http://localhost:3000/preview",
  outputDir: "./public/previews",
  components: [
    { name: "button", urlPath: "/button" },
    { name: "dialog", urlPath: "/dialog", selector: "[data-preview]" },
  ],
  selector: "[data-preview]",
  themes: ["light", "dark"],
});
```

### ESLint Config

Opinionated lint rules shared across the ecosystem.

```ts
// eslint.config.js
import { olwiba } from "@olwiba/dx/eslint";

export default await olwiba({ react: true });
```

### Skills

Installable Claude/Amp skills manifest for working in Olwiba projects.

```bash
bunx @olwiba/dx skills install
```

### Worktree Cleanup

Safely removes linked Git worktrees only after their commits have landed in the remote default branch. Dirty worktrees, the current worktree, unmerged commits, and missing paths are preserved and reported.

```bash
# Current repository
bunx @olwiba/dx worktree cleanup --dry-run

# Named child repository under ./repos
bunx @olwiba/dx worktree cleanup my-repo

# Any repository path or non-standard remote
bunx @olwiba/dx worktree cleanup ../my-repo --remote upstream
```

The command fetches and prunes the remote first, shows the worktrees it considers safe to remove, and asks for confirmation. Use `--force` to skip confirmation, `--no-fetch` for offline use, or `--repos-root <path>` when resolving a repository by name outside `./repos`.

To keep a favourite project-local command:

```json
{
  "scripts": {
    "wt:cleanup": "dx worktree cleanup"
  }
}
```

Then run `bun run wt:cleanup -- my-repo` as before.

## Tech Stack

- [TypeScript](https://www.typescriptlang.org)
- [tsup](https://tsup.egoist.dev)
- [Vite](https://vite.dev)
- [Puppeteer](https://pptr.dev)
- [figlet](https://github.com/patorjk/figlet.js)
- [chalk](https://github.com/chalk/chalk)

## Ecosystem

- [`@olwiba/cn`](https://github.com/Olwiba/olwibaCN) — shadcn-style component primitives
- _More coming soon!_

## Contributing

Bug reports, pull requests & feature requests are welcome.
Open an issue first for anything beyond a small fix.

<br/>
<br/>

<p align="center">
  Built with 💖 by <a href="https://github.com/Olwiba">Olwiba</a>
</p>

<p align="center">
  <a href="https://buymeacoffee.com/olwiba"><img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me A Coffee" /></a>
</p>
