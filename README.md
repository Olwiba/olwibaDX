<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="./public/olwibaDX--light.gif" />
    <source media="(prefers-color-scheme: dark)" srcset="./public/olwibaDX.gif" />
    <img src="./public/olwibaDX.gif" alt="olwibaDX" style="width: 100%;" />
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

A lot of what's in here reflects personal preference — small build-time and Node-only helpers I reach for across every project. The package grows as the ecosystem grows, so expect new features over time.

It is pure Node, build-time only. Nothing in it ships to a browser bundle.

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
import { renderAscii } from "@olwiba/dx/ascii";

const art = renderAscii("hello", { font: "dosrebel" });
```

### ASCII GIF Generator

Render an animated ASCII GIF from any text. This is what produced the README banner you see at the top of this file.

```bash
bunx @olwiba/dx ascii-gif \
  --text "olwibaDX" \
  --accent "DX" \
  --out ./public/olwibaDX.gif
```

### Preview Generator

Puppeteer-based screenshot tool used to pre-render the isometric preview tiles on docs sites.

```ts
import { generatePreviews } from "@olwiba/dx";

await generatePreviews({
  url: "http://localhost:3000/preview",
  outputDir: "./public/previews",
});
```

### ESLint Config

Opinionated lint rules shared across the ecosystem.

```ts
// eslint.config.js
import olwibaConfig from "@olwiba/dx/eslint";

export default [...olwibaConfig];
```

### Skills

Installable Claude/Amp skills manifest for working in Olwiba projects.

```bash
bunx @olwiba/dx skills install
```

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
