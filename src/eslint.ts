import type { ESLint, Linter, Rule } from "eslint"
import { noDefaultExport } from "./rules/no-default-export"

const olwibaPlugin = {
  name: "@olwiba/dx",
  rules: { "no-default-export": noDefaultExport } satisfies Record<string, Rule.RuleModule>,
}

export type OlwibaEslintOptions = {
  react?: boolean
  files?: string[]
}

// Wrapping import() in a function makes TypeScript return Promise<any>,
// bypassing module resolution for optional peer deps.
const lazyImport = (id: string) => import(id)

function getDefault<T>(mod: unknown): T {
  if (typeof mod === "object" && mod !== null && "default" in mod) {
    return (mod as { default: T }).default
  }
  return mod as T
}

export async function olwiba(options: OlwibaEslintOptions = {}): Promise<Linter.Config[]> {
  const { react = false, files = ["**/*.{ts,tsx,js,jsx,mts,cts}"] } = options
  const configs: Linter.Config[] = []

  configs.push({
    files,
    plugins: { "@olwiba/dx": olwibaPlugin },
    rules: {
      "@olwiba/dx/no-default-export": "error",
      "no-console": "warn",
    },
  })

  try {
    const [tsPluginMod, tsParserMod] = await Promise.all([
      lazyImport("@typescript-eslint/eslint-plugin"),
      lazyImport("@typescript-eslint/parser"),
    ])
    configs.push({
      files: ["**/*.{ts,tsx,mts,cts}"],
      languageOptions: { parser: getDefault<Linter.Parser>(tsParserMod) },
      plugins: { "@typescript-eslint": getDefault<ESLint.Plugin>(tsPluginMod) },
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports", fixStyle: "separate-type-imports" },
        ],
        "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      },
    })
  } catch {
    process.stderr.write(
      "[olwiba/dx] tip: install @typescript-eslint/eslint-plugin + @typescript-eslint/parser for TypeScript rules\n"
    )
  }

  if (react) {
    try {
      const reactHooksMod = await lazyImport("eslint-plugin-react-hooks")
      configs.push({
        files: ["**/*.{tsx,jsx}"],
        plugins: { "react-hooks": getDefault<ESLint.Plugin>(reactHooksMod) },
        rules: {
          "react-hooks/rules-of-hooks": "error",
          "react-hooks/exhaustive-deps": "warn",
        },
      })
    } catch {
      process.stderr.write(
        "[olwiba/dx] tip: install eslint-plugin-react-hooks for React rules\n"
      )
    }
  }

  return configs
}
