import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  ASCII_CHAR_HEIGHT,
  ASCII_CHAR_WIDTH,
  asciiFonts,
  composeAsciiText,
  getAsciiAccentColumns,
  getAsciiCellIntensity,
  parseFigletFont,
  type AsciiFontName,
  type AsciiTextLayout,
} from "./ascii/index"

interface RGB {
  r: number
  g: number
  b: number
}

export interface GenerateAsciiGifOptions {
  text: string
  accent?: string
  font?: AsciiFontName | string
  outputPath: string
  color?: string
  accentColor?: string
  backgroundColor?: string
  blendColor?: string
  fps?: number
  duration?: number
  scale?: number
  levels?: number
  padding?: number
  transparent?: boolean
}

export async function generateAsciiGif(options: GenerateAsciiGifOptions): Promise<void> {
  const fps = options.fps ?? 24
  const duration = options.duration ?? 2.4
  const scale = options.scale ?? 2
  const levels = Math.max(2, Math.min(48, options.levels ?? 32))
  const padding = Math.max(0, Math.round(options.padding ?? 16))
  const fontRaw = resolveFont(options.font ?? "dosrebel")
  const font = parseFigletFont(fontRaw)
  const layout = composeAsciiText(font, options.text)
  const bounds = getLayoutBounds(layout)
  const accentColumns = getAsciiAccentColumns(font, options.text, options.accent ?? "")
  const palette = createPalette({
    backgroundColor: options.backgroundColor ?? "#0a0a0a",
    blendColor: options.blendColor ?? options.backgroundColor ?? "#0a0a0a",
    color: options.color ?? "#e5e5e5",
    accentColor: options.accentColor ?? options.color ?? "#38bdf8",
    levels,
    transparent: options.transparent ?? false,
  })
  const width = Math.ceil(bounds.cols * ASCII_CHAR_WIDTH * scale) + padding * 2
  const height = bounds.rows * ASCII_CHAR_HEIGHT * scale + padding * 2
  const frameCount = Math.max(1, Math.round(fps * duration))
  const delay = Math.max(1, Math.round(100 / fps))
  const frames: Uint8Array[] = []

  for (let frame = 0; frame < frameCount; frame++) {
    frames.push(
      renderIndexedAsciiFrame({
        layout,
        accentColumns,
        phase: frame / frameCount,
        width,
        height,
        scale,
        levels,
        bounds,
        padding,
      }),
    )
  }

  const bytes = encodeGif({
    width,
    height,
    delay,
    palette: palette.table,
    frames,
    transparent: options.transparent ?? false,
  })

  mkdirSync(path.dirname(options.outputPath), { recursive: true })
  writeFileSync(options.outputPath, bytes)
}

interface RenderIndexedFrameOptions {
  layout: AsciiTextLayout
  accentColumns: ReadonlySet<number>
  phase: number
  width: number
  height: number
  scale: number
  levels: number
  bounds: LayoutBounds
  padding: number
}

interface LayoutBounds {
  minCol: number
  minRow: number
  cols: number
  rows: number
}

function renderIndexedAsciiFrame(options: RenderIndexedFrameOptions): Uint8Array {
  const pixels = new Uint8Array(options.width * options.height)
  const charWidth = Math.round(ASCII_CHAR_WIDTH * options.scale)
  const charHeight = Math.round(ASCII_CHAR_HEIGHT * options.scale)

  for (const cell of options.layout.cells) {
    const intensity = getAsciiCellIntensity(cell, { phase: options.phase })
    const level = Math.max(0, Math.min(options.levels - 1, Math.round(intensity * (options.levels - 1))))
    const offset = options.accentColumns.has(cell.col) ? 1 + options.levels : 1
    const colorIndex = offset + level
    const x0 = options.padding + Math.round((cell.col - options.bounds.minCol) * ASCII_CHAR_WIDTH * options.scale)
    const y0 = options.padding + (cell.row - options.bounds.minRow) * charHeight
    const x1 = Math.min(options.width, x0 + charWidth)
    const y1 = Math.min(options.height, y0 + charHeight)

    for (let y = y0; y < y1; y++) {
      const row = y * options.width
      for (let x = x0; x < x1; x++) {
        pixels[row + x] = colorIndex
      }
    }
  }

  return pixels
}

function getLayoutBounds(layout: AsciiTextLayout): LayoutBounds {
  if (layout.cells.length === 0) {
    return { minCol: 0, minRow: 0, cols: Math.max(1, layout.cols), rows: Math.max(1, layout.rows) }
  }

  let minCol = Number.POSITIVE_INFINITY
  let maxCol = Number.NEGATIVE_INFINITY
  let minRow = Number.POSITIVE_INFINITY
  let maxRow = Number.NEGATIVE_INFINITY

  for (const cell of layout.cells) {
    minCol = Math.min(minCol, cell.col)
    maxCol = Math.max(maxCol, cell.col)
    minRow = Math.min(minRow, cell.row)
    maxRow = Math.max(maxRow, cell.row)
  }

  return {
    minCol,
    minRow,
    cols: maxCol - minCol + 1,
    rows: maxRow - minRow + 1,
  }
}

function resolveFont(font: AsciiFontName | string): string {
  if (font in asciiFonts) return asciiFonts[font as AsciiFontName]
  return readFileSync(font, "utf-8")
}

function createPalette(options: {
  backgroundColor: string
  blendColor: string
  color: string
  accentColor: string
  levels: number
  transparent: boolean
}) {
  const bg = parseColor(options.backgroundColor)
  const blend = parseColor(options.blendColor)
  const base = parseColor(options.color)
  const accent = parseColor(options.accentColor)
  const table: number[] = [bg.r, bg.g, bg.b]

  for (let level = 0; level < options.levels; level++) {
    const alpha = level / (options.levels - 1)
    const mixed = mix(blend, base, alpha)
    table.push(mixed.r, mixed.g, mixed.b)
  }

  for (let level = 0; level < options.levels; level++) {
    const alpha = level / (options.levels - 1)
    const mixed = mix(blend, accent, alpha)
    table.push(mixed.r, mixed.g, mixed.b)
  }

  while (table.length < 256 * 3) table.push(0, 0, 0)
  return { table: Uint8Array.from(table.slice(0, 256 * 3)) }
}

function parseColor(input: string): RGB {
  const color = input.trim()
  const shortHex = /^#([0-9a-f]{3})$/i.exec(color)
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("").map((part) => Number.parseInt(part + part, 16))
    return { r, g, b }
  }

  const longHex = /^#([0-9a-f]{6})$/i.exec(color)
  if (longHex) {
    const value = longHex[1]
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    }
  }

  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(color)
  if (rgb) {
    return {
      r: clampByte(Number.parseInt(rgb[1], 10)),
      g: clampByte(Number.parseInt(rgb[2], 10)),
      b: clampByte(Number.parseInt(rgb[3], 10)),
    }
  }

  throw new Error(`Unsupported color "${input}". Use #rgb, #rrggbb, or rgb(r,g,b).`)
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return {
    r: clampByte(a.r + (b.r - a.r) * amount),
    g: clampByte(a.g + (b.g - a.g) * amount),
    b: clampByte(a.b + (b.b - a.b) * amount),
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

interface EncodeGifOptions {
  width: number
  height: number
  delay: number
  palette: Uint8Array
  frames: Uint8Array[]
  transparent: boolean
}

function encodeGif(options: EncodeGifOptions): Uint8Array {
  const bytes: number[] = []
  writeAscii(bytes, "GIF89a")
  writeU16(bytes, options.width)
  writeU16(bytes, options.height)
  bytes.push(0xf7, 0, 0)
  pushBytes(bytes, options.palette)
  bytes.push(0x21, 0xff, 0x0b)
  writeAscii(bytes, "NETSCAPE2.0")
  bytes.push(0x03, 0x01)
  writeU16(bytes, 0)
  bytes.push(0)

  for (const frame of options.frames) {
    bytes.push(0x21, 0xf9, 0x04, options.transparent ? 0x05 : 0x04)
    writeU16(bytes, options.delay)
    bytes.push(0, 0)
    bytes.push(0x2c)
    writeU16(bytes, 0)
    writeU16(bytes, 0)
    writeU16(bytes, options.width)
    writeU16(bytes, options.height)
    bytes.push(0)
    bytes.push(8)
    writeSubBlocks(bytes, lzwEncode(frame, 8))
  }

  bytes.push(0x3b)
  return Uint8Array.from(bytes)
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  let codeSize = minCodeSize + 1
  const output: number[] = []
  const writeCode = createBitWriter(output)

  writeCode(clearCode, codeSize)

  let codesSinceClear = 0
  for (const index of indices) {
    if (codesSinceClear >= 240) {
      writeCode(clearCode, codeSize)
      codeSize = minCodeSize + 1
      codesSinceClear = 0
    }
    writeCode(index, codeSize)
    codesSinceClear++
  }

  writeCode(endCode, codeSize)
  writeCode(-1, 0)

  return Uint8Array.from(output)
}

function createBitWriter(output: number[]) {
  let buffer = 0
  let bitCount = 0

  return (code: number, size: number) => {
    if (code < 0) {
      if (bitCount > 0) output.push(buffer & 0xff)
      buffer = 0
      bitCount = 0
      return
    }

    buffer |= code << bitCount
    bitCount += size

    while (bitCount >= 8) {
      output.push(buffer & 0xff)
      buffer >>= 8
      bitCount -= 8
    }
  }
}

function writeSubBlocks(bytes: number[], data: Uint8Array) {
  for (let offset = 0; offset < data.length; offset += 255) {
    const chunk = data.slice(offset, offset + 255)
    bytes.push(chunk.length)
    pushBytes(bytes, chunk)
  }
  bytes.push(0)
}

function writeAscii(bytes: number[], value: string) {
  for (let i = 0; i < value.length; i++) bytes.push(value.charCodeAt(i))
}

function writeU16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >> 8) & 0xff)
}

function pushBytes(bytes: number[], values: Uint8Array) {
  for (const value of values) bytes.push(value)
}
