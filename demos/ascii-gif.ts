import { resolve } from "node:path"
import { generateAsciiGif } from "../src/ascii-gif"
import { demoHeader, success } from "./shared"

demoHeader(
  "ASCII GIF generator",
  "Runs the real generator and writes dark and light GIFs beneath artifacts/demos/.",
)

const dark = resolve("artifacts/demos/ascii/olwibaDX.gif")
const light = resolve("artifacts/demos/ascii/olwibaDX--light.gif")

await generateAsciiGif({
  text: "olwibaDX",
  accent: "DX",
  outputPath: dark,
  color: "#f5f5f5",
  accentColor: "#fb923c",
  backgroundColor: "#09090b",
  blendColor: "#27272a",
  duration: 1.4,
  fps: 12,
})
success("artifacts/demos/ascii/olwibaDX.gif")

await generateAsciiGif({
  text: "olwibaDX",
  accent: "DX",
  outputPath: light,
  color: "#18181b",
  accentColor: "#f97316",
  backgroundColor: "#ffffff",
  blendColor: "#e4e4e7",
  duration: 1.4,
  fps: 12,
})
success("artifacts/demos/ascii/olwibaDX--light.gif")
