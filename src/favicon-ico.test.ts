import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { createFaviconIco, generateAssets } from "./generate-assets"

test("ICO directory addresses the original PNGs, including the 256px zero-size convention", async () => {
  const frames = await Promise.all([256, 16, 48].map((size) => sharp({
    create: { width: size, height: size, channels: 4, background: "#0d9488" },
  }).png().toBuffer()))
  const ico = createFaviconIco(frames)
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 3)
  let expectedOffset = 54
  for (const [index, size] of [16, 48, 256].entries()) {
    const entry = 6 + index * 16
    assert.equal(ico[entry], size === 256 ? 0 : size)
    assert.equal(ico[entry + 1], ico[entry])
    assert.equal(ico.readUInt32LE(entry + 12), expectedOffset)
    const bytes = ico.readUInt32LE(entry + 8)
    const png = ico.subarray(expectedOffset, expectedOffset + bytes)
    assert.deepEqual(png, frames.find((frame) => frame.readUInt32BE(16) === size))
    assert.equal((await sharp(png).metadata()).width, size)
    expectedOffset += bytes
  }
  assert.equal(expectedOffset, ico.length)
})

test("ICO rejects unsupported or ambiguous frame dimensions", async () => {
  const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "red" } }).png().toBuffer()
  assert.throws(() => createFaviconIco([]), /needs/)
  assert.throws(() => createFaviconIco([Buffer.from("not a PNG")]), /PNG/)
  assert.throws(() => createFaviconIco([png, png]), /Duplicate/)
  for (const [width, height] of [[512, 512], [32, 16]]) {
    const invalid = await sharp({ create: { width, height, channels: 4, background: "red" } }).png().toBuffer()
    assert.throws(() => createFaviconIco([invalid]), /square/)
  }
})

test("asset generation includes a usable root favicon ICO", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "dx-ico-"))
  try {
    const result = await generateAssets({ name: "Example", icon: "rocket", color: "#0d9488", outputDir })
    const path = join(outputDir, "favicon.ico")
    assert.ok(result.files.includes(path))
    const ico = readFileSync(path)
    assert.equal(ico.readUInt16LE(4), 6)
    const sizes = Array.from({ length: 6 }, (_, index) => ico[6 + index * 16] || 256)
    assert.deepEqual(sizes, [16, 32, 48, 64, 192, 256])
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})
