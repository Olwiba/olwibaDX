import type { Rule } from "eslint"

export const noDefaultExport: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow default exports — use named exports",
    },
    messages: {
      noDefault: "Use named exports. Default exports make refactoring harder.",
    },
    schema: [],
  },
  create(context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "noDefault" })
      },
    }
  },
}
