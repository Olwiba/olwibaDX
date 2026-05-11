# Contributing to olwibaDX

Thanks for your interest in contributing. This package is build-time / Node-only
developer experience tooling. Bug reports, fixes, and small enhancements are
welcome.

## Before you start

For anything beyond a small fix or typo, **please open an issue first** so the
direction can be discussed before code is written.

## Local development

Requirements:

- [Bun](https://bun.sh) (v1.1+ recommended)
- Node.js 20+

Setup:

```bash
git clone https://github.com/Olwiba/olwibaDX.git
cd olwibaDX
bun install
```

Common scripts:

| Command | What it does |
|---|---|
| `bun run dev` | Watch + rebuild on change |
| `bun run build` | Build the package (`dist/`) |
| `bun run tsc` | TypeScript check (`--noEmit`) |

## Project structure

- `src/dev-banner.ts` - dev server / tsup banner plugin and standalone printer
- `src/ascii/` - figlet renderer + DOS Rebel font, exposed as `@olwiba/dx/ascii`
- `src/ascii-gif.ts` - animated ASCII GIF generator (`@olwiba/dx/ascii-gif`)
- `src/generate-previews.ts` - Puppeteer-based screenshot generator
- `src/eslint.ts` - shared ESLint config (`@olwiba/dx/eslint`)
- `src/cli.ts` - the `dx` CLI binary
- `src/skills.ts` + `skills-manifest.json` - installable Claude/Amp skills

## Pull requests

- Keep PRs focused. One concern per PR.
- Include a short description of what changed and why.
- The CHANGELOG is generated at release time from commit messages, so prefer
  descriptive commit subjects (`feat: …`, `fix: …`, `docs: …`).

## Code of conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
