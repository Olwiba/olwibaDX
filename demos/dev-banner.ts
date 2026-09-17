import { printBanner } from "../src/dev-banner"
import { demoHeader } from "./shared"

demoHeader(
  "development banners",
  "The real banner renderer, shown with a few ecosystem project identities.",
)

const projects = [
  { name: "olwibaDX", base: "olwiba", suffix: "DX", color: "#fb923c", port: 3004 },
  { name: "olwibaUI", base: "olwiba", suffix: "UI", color: "#a3e635", port: 3002 },
  { name: "genesis", base: "genesis", suffix: "", color: "#34d399", port: 3000 },
]

for (const project of projects) {
  await printBanner({
    segments: [
      { text: project.base, ...(project.suffix ? {} : { colorHex: project.color }) },
      ...(project.suffix ? [{ text: project.suffix, colorHex: project.color }] : []),
    ],
  })
  process.stdout.write(`\n  ${project.name} ready at http://localhost:${project.port}\n`)
}
