import assert from "node:assert/strict"
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, test } from "node:test"
import { generateAsciiGif } from "./ascii-gif"

const outputs = new Set<string>()

function outputPath(name: string): string {
  const output = join(process.cwd(), `artifacts/${name}.gif`)
  outputs.add(output)
  return output
}

afterEach(() => {
  for (const output of outputs) rmSync(output, { force: true })
  outputs.clear()
})

describe("GIF palette limits", () => {
  test("accepts exactly 256 entries in accent mode", async () => {
    const output = outputPath("accent-palette-boundary")

    await generateAsciiGif({
      text: "A",
      accents: Array.from({ length: 50 }, () => ({ text: "", color: "#ffffff" })),
      levels: 5,
      fps: 1,
      duration: 1,
      outputPath: output,
    })

    assert.equal(existsSync(output), true)
  })

  test("rejects more than 256 entries in accent mode", async () => {
    const output = outputPath("accent-palette-overflow")

    await assert.rejects(
      () => generateAsciiGif({
        text: "A",
        accents: Array.from({ length: 51 }, () => ({ text: "", color: "#ffffff" })),
        levels: 5,
        outputPath: output,
      }),
      { message: "GIF palette supports at most 256 entries; accent mode requires 261" },
    )
    assert.equal(existsSync(output), false)
  })

  test("accepts exactly 256 entries in row-color mode", async () => {
    const output = outputPath("row-palette-boundary")

    await generateAsciiGif({
      text: "A",
      rowColors: Array.from({ length: 51 }, (_, index) => `rgb(${index}, 0, 0)`),
      levels: 5,
      fps: 1,
      duration: 1,
      outputPath: output,
    })

    assert.equal(existsSync(output), true)
  })

  test("rejects more than 256 entries in row-color mode", async () => {
    const output = outputPath("row-palette-overflow")

    await assert.rejects(
      () => generateAsciiGif({
        text: "A",
        rowColors: Array.from({ length: 52 }, (_, index) => `rgb(${index}, 0, 0)`),
        levels: 5,
        outputPath: output,
      }),
      { message: "GIF palette supports at most 256 entries; row-color mode requires 261" },
    )
    assert.equal(existsSync(output), false)
  })
})
