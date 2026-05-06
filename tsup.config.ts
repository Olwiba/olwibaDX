import { defineConfig } from "tsup"
import { createProjectTsupBannerHook } from "./src/project-brand"
import { projectConfig } from "./src/project.config"

const OPTIONAL_PEER_DEPS = [
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "eslint-plugin-react-hooks",
]

export default [
  defineConfig({
    entry: ["src/index.ts", "src/eslint.ts", "src/skills.ts", "src/generate-previews.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["eslint", "playwright", ...OPTIONAL_PEER_DEPS],
    onSuccess: createProjectTsupBannerHook(projectConfig),
  }),
  defineConfig({
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    treeshake: true,
    banner: { js: "#!/usr/bin/env node" },
  }),
]
