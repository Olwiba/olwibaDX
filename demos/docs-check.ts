import { checkDocs, formatDocsReport, type DocsPage } from "../src/docs-check"
import { demoHeader } from "./shared"

demoHeader(
  "documentation check",
  "Representative MDX pages held in memory — no documentation files are read.",
)

const pages: DocsPage[] = [
  {
    file: "marketing/hero-section.mdx",
    source: `<Sandbox><HeroSection /></Sandbox>`,
  },
  {
    file: "app/command-palette.mdx",
    source: `{/* api-reference: none */}\n<ComponentPreview><CommandPalette /></ComponentPreview>`,
  },
  {
    file: "overlays/sheet.mdx",
    source: `<ComponentPreview><Sheet /></ComponentPreview>\n<APIReference props={[{ name: 'side', type: 'string', description: 'The user's preferred side' }]} />`,
  },
  {
    file: "forms/button.mdx",
    source: `<Sandbox><Button /></Sandbox>\n<APIReference props={[{ name: 'variant', type: 'string' }]} />`,
  },
  {
    file: "layout/divider.mdx",
    source: `{/* api-reference: none — renders a decorative line and accepts no public props */}\n<Sandbox><Divider /></Sandbox>`,
  },
  {
    file: "guides/getting-started.mdx",
    source: `# Getting started\n\nInstall the package and import a component.`,
  },
]

process.stdout.write(`${formatDocsReport(checkDocs(pages))}\n`)
