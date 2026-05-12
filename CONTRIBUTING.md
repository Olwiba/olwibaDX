# Contributing

Thanks for your interest in contributing to `@olwiba/dx`. We're happy to have you here.

Please take a moment to review this document before submitting your first pull request.  
We also strongly recommend that you check for open issues and pull requests to see if someone else is working on something similar.

If you need any help, feel free to reach out to [@Olwiba](https://github.com/Olwiba).

## About this repository

This repository ships a single npm package: `@olwiba/dx`.

- We use [Bun](https://bun.sh) for package management and scripts.
- We use [tsup](https://tsup.egoist.dev) as our build system.
- We use tag-driven GitHub Actions workflows for releases.

## Structure

This repository is structured as follows:

```
src
├── ascii
├── rules
├── ascii-gif.ts
├── cli.ts
├── dev-banner.ts
├── eslint.ts
├── generate-previews.ts
├── index.ts
└── skills.ts
```

| Path                       | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `src/index.ts`             | Public entrypoint — re-exports the main API.           |
| `src/cli.ts`               | The `dx` CLI binary (`bunx @olwiba/dx ...`).           |
| `src/dev-banner.ts`        | Vite plugin and tsup hook for dev banners.             |
| `src/ascii/`               | Figlet renderer + DOS Rebel font.                      |
| `src/ascii-gif.ts`         | Animated ASCII GIF generator.                          |
| `src/generate-previews.ts` | Puppeteer-based preview screenshot tool.               |
| `src/eslint.ts`            | Shared ESLint flat config.                             |
| `src/skills.ts`            | Skills manifest installer.                             |
| `src/rules/`               | ESLint rule definitions.                               |

## Development

### Fork this repo

You can fork this repo by clicking the fork button in the top right corner of this page.

### Clone on your local machine

```bash
git clone https://github.com/your-username/olwibaDX.git
```

### Navigate to project directory

```bash
cd olwibaDX
```

### Create a new branch

```bash
git checkout -b my-new-branch
```

### Install dependencies

```bash
bun install
```

### Build the package

```bash
bun run build
```

### Watch mode

```bash
bun run dev
```

### Type-check

```bash
bun run tsc
```

## Running the CLI Locally

The package exposes a `dx` binary. After running `bun run build`, you can invoke it directly:

```bash
node ./dist/cli.js ascii-gif --text "hello" --out ./out.gif
```

Or test it via the package itself:

```bash
bun run build
bunx --bun . ascii-gif --text "hello" --out ./out.gif
```

## Adding a Feature

When adding a new feature, please ensure that:

1. The feature has a clear, single responsibility.
2. You add or update the corresponding section in the README's `## Features` block.
3. You update the `CHANGELOG.md` under the next version heading.
4. You re-run `bun run build` and confirm `dist/` still resolves.

## Commit Convention

Before you create a Pull Request, please check whether your commits comply with
the commit conventions used in this repository.

When you create a commit we kindly ask you to follow the convention
`category(scope or module): message` in your commit message while using one of
the following categories:

- `feat / feature`: all changes that introduce completely new code or new
  features
- `fix`: changes that fix a bug (ideally you will additionally reference an
  issue if present)
- `refactor`: any code related change that is not a fix nor a feature
- `docs`: changing existing or creating new documentation (i.e. README, docs for
  usage of a lib or cli usage)
- `build`: all changes regarding the build of the software, changes to
  dependencies or the addition of new dependencies
- `test`: all changes regarding tests (adding new tests or changing existing
  ones)
- `ci`: all changes regarding the configuration of continuous integration (i.e.
  github actions, ci system)
- `chore`: all changes to the repository that do not fit into any of the above
  categories

  e.g. `feat(ascii-gif): add transparent background option`

If you are interested in the detailed specification, you can visit  
https://www.conventionalcommits.org/

## Requests for new features

If you have a request for a new feature, please open a discussion or issue on GitHub. We'll be happy to help you out.

## Releases

Releases are tag-driven. The publish workflow runs automatically when a `v*` tag matching the `package.json` version is pushed.
