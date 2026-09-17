import { relative, resolve } from "node:path"
import { generateAssets } from "../src/generate-assets"
import { demoHeader, success } from "./shared"

demoHeader(
  "asset generator",
  "Runs the real generator and writes only beneath artifacts/demos/.",
)

const outputDir = resolve("artifacts/demos/generated-assets")
process.stdout.write(`Generating assets for "Launchpad"…\n`)

const result = await generateAssets({
  name: "Launchpad",
  icon: "Rocket",
  color: "#f97316",
  outputDir,
})

success(`Generated ${result.files.length} files`)
for (const file of result.files) {
  process.stdout.write(`  ${relative(process.cwd(), file).replaceAll("\\", "/")}\n`)
}
