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
  <a href="https://github.com/sponsors/Olwiba"><img src="https://img.shields.io/static/v1?label=Sponsor&message=❤&logo=GitHub&color=22c55e" alt="Sponsor" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Olwiba/olwibaDX?label=license&logo=github" alt="License" /></a>
  <a href="https://github.com/Olwiba/olwibaDX/issues"><img src="https://img.shields.io/github/issues/Olwiba/olwibaDX" alt="Issues" /></a>
</p>

## What This Is

`@olwiba/dx` is a small toolbox of build-time and Node-only developer experience helpers used across the Olwiba ecosystem.

It powers the dev server banners, the ASCII art you see in our READMEs, the figlet renderer behind `<AsciiText>` in `@olwiba/cn`, and the screenshot pipeline that pre-renders the isometric tiles on our docs sites.

The package is pure Node, build-time only. Nothing in it ships to a browser bundle.

## Installation

```bash
bun add -d @olwiba/dx
```

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

## What's Included

**Dev banners** Coloured ASCII banners on Vite dev start and tsup build success
**ASCII utilities** Figlet renderer + DOS Rebel font, used by `<AsciiText>` in `@olwiba/cn`
**ASCII GIF generator** Render an animated ASCII GIF from any text — what powers our README banners
**Preview generator** Puppeteer-based screenshot tool for pre-rendering isometric docs tiles
**ESLint config** Opinionated lint rules shared across the ecosystem
**Skills manifest** Installable Claude/Amp skills for working in Olwiba projects

## ASCII GIF

Generate an animated ASCII GIF from any text. Used to produce the README banner you see at the top of this file.

```bash
bunx @olwiba/dx ascii-gif \
  --text "olwibaDX" \
  --accent "DX" \
  --out ./public/olwibaDX.gif
```

## ESLint & Skills

```ts
// eslint.config.js
import olwibaConfig from "@olwiba/dx/eslint";

export default [...olwibaConfig];
```

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
