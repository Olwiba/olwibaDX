# Demo scripts

Small, repository-only examples for screenshots and short recordings. They are not part of the
published `@olwiba/dx` CLI.

```bash
bun run demo:worktrees
bun run demo:env
bun run demo:docs
bun run demo:banners
bun run demo:skills
bun run demo:assets
bun run demo:ascii
bun run demo:previews
```

The worktree and skills demos print clearly labelled illustrative data and do not touch the
filesystem or network. Environment and documentation demos run their real checkers against
in-memory fixtures. Banner and visual demos run the real implementation; generated files go to
the gitignored `artifacts/demos/` directory.

`demo:previews` requires Chrome or Edge, matching the real preview generator.
