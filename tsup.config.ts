import { defineConfig } from "tsup"
import { createProjectTsupBannerHook } from "./src/project-brand"
import { projectConfig } from "./src/project.config"

const OPTIONAL_PEER_DEPS = [
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "eslint-plugin-react-hooks",
  "puppeteer-core",
  "sharp",
  "lucide-static",
]

export default [
  defineConfig({
    entry: [
      "src/index.ts",
      "src/eslint.ts",
      "src/skills.ts",
      "src/generate-previews.ts",
      "src/ascii/index.ts",
      "src/ascii-gif.ts",
      "src/generate-assets.ts",
      "src/env-check.ts",
      // Dynamically imported by the CLI, so it has to be its own entry — the
      // CLI bundle is built with splitting off and would otherwise resolve a
      // relative path into dist that nothing had written.
      "src/docs-check.ts",
      "src/dep-check.ts",
    ],
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["eslint", "puppeteer-core", "sharp", "lucide-static", ...OPTIONAL_PEER_DEPS],
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
