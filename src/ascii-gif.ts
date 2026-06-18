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
  type AsciiCell,
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
  accents?: Array<{ text: string; color: string; sparkle?: boolean }>
  font?: AsciiFontName | string
  outputPath: string
  color?: string
  accentColor?: string
  rowColors?: string[]
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
  // Build colAccentMap: col → accent index (0-based). Multi-accent overrides single.
  let colAccentMap: Map<number, number>
  let accentColorList: string[]
  let sparklingAccents: Set<number>
  if (options.accents && options.accents.length > 0) {
    colAccentMap = new Map()
    sparklingAccents = new Set()
    for (let i = 0; i < options.accents.length; i++) {
      const cols = getAsciiAccentColumns(font, options.text, options.accents[i].text)
      for (const col of cols) colAccentMap.set(col, i)
      if (options.accents[i].sparkle) sparklingAccents.add(i)
    }
    accentColorList = options.accents.map((a) => a.color)
  } else {
    colAccentMap = new Map([...accentColumns].map((col) => [col, 0]))
    accentColorList = [options.accentColor ?? options.color ?? "#38bdf8"]
    sparklingAccents = new Set()
  }
  const width = Math.ceil(bounds.cols * ASCII_CHAR_WIDTH * scale) + padding * 2
  const height = bounds.rows * ASCII_CHAR_HEIGHT * scale + padding * 2
  const frameCount = Math.max(1, Math.round(fps * duration))
  const delay = Math.max(1, Math.round(100 / fps))
  const frames: Uint8Array[] = []

  // Row-colors path — one palette set per unique row color, applied by cell.row
  if (options.rowColors && options.rowColors.length > 0) {
    const uniqueRowColors = [...new Set(options.rowColors)]
    const rowPalette = createRowColorPalette({
      backgroundColor: options.backgroundColor ?? "#0a0a0a",
      blendColor: options.blendColor ?? options.backgroundColor ?? "#0a0a0a",
      rowColors: uniqueRowColors,
      levels,
      transparent: options.transparent ?? false,
    })
    for (let frame = 0; frame < frameCount; frame++) {
      frames.push(
        renderIndexedAsciiFrameWithRowColors({
          layout,
          phase: frame / frameCount,
          width,
          height,
          scale,
          levels,
          bounds,
          padding,
          rowColorsInput: options.rowColors,
          uniqueRowColors,
        }),
      )
    }
    const bytes = encodeGif({
      width,
      height,
      delay,
      palette: rowPalette.table,
      frames,
      transparent: options.transparent ?? false,
    })
    mkdirSync(path.dirname(options.outputPath), { recursive: true })
    writeFileSync(options.outputPath, bytes)
    return
  }

  const palette = createMultiAccentPalette({
    backgroundColor: options.backgroundColor ?? "#0a0a0a",
    blendColor: options.blendColor ?? options.backgroundColor ?? "#0a0a0a",
    color: options.color ?? "#e5e5e5",
    accentColors: accentColorList,
    levels,
    transparent: options.transparent ?? false,
  })

  const sparkleParticles = generateSparkleParticles({
    layout,
    colAccentMap,
    sparklingAccents,
    bounds,
    padding,
    scale,
    width,
    height,
  })

  for (let frame = 0; frame < frameCount; frame++) {
    frames.push(
      renderIndexedAsciiFrame({
        layout,
        colAccentMap,
        sparklingAccents,
        sparkleParticles,
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
  colAccentMap: ReadonlyMap<number, number>
  sparklingAccents: ReadonlySet<number>
  sparkleParticles: SparkleParticle[]
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
    const accentIdx = options.colAccentMap.get(cell.col)
    const isGlitter = accentIdx !== undefined && options.sparklingAccents.has(accentIdx) && cell.ch === "█"
    const intensity = isGlitter
      ? getGlitterIntensity(cell, options.phase * Math.PI * 2)
      : getAsciiCellIntensity(cell, { phase: options.phase })
    const level = Math.max(0, Math.min(options.levels - 1, Math.round(intensity * (options.levels - 1))))
    const offset = accentIdx !== undefined ? 1 + (accentIdx + 1) * options.levels : 1
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

  // Draw sparkle particles — white + and * shapes on/around sparkling accents
  for (const p of options.sparkleParticles) {
    const wave = Math.sin(p.phase * Math.PI * 2 + options.phase * Math.PI * 2 * p.freq)
    if (wave < 0.68) continue
    const brightness = (wave - 0.68) / 0.32
    const level = Math.max(0, Math.min(options.levels - 1, Math.round(brightness * (options.levels - 1))))
    const particleColorIdx = 1 + level  // text ramp (white) — contrast against colored letter
    const pts: [number, number][] = [[p.px, p.py]]
    if (p.shape === "plus") {
      // +: 3px arms on cardinal directions
      for (let d = 1; d <= 3; d++) {
        pts.push([p.px - d, p.py], [p.px + d, p.py], [p.px, p.py - d], [p.px, p.py + d])
      }
    } else {
      // *: 2px cardinal arms + 1px diagonals
      for (let d = 1; d <= 2; d++) {
        pts.push([p.px - d, p.py], [p.px + d, p.py], [p.px, p.py - d], [p.px, p.py + d])
      }
      pts.push([p.px - 1, p.py - 1], [p.px + 1, p.py - 1], [p.px - 1, p.py + 1], [p.px + 1, p.py + 1])
    }
    for (const [x, y] of pts) {
      if (x >= 0 && x < options.width && y >= 0 && y < options.height) {
        pixels[y * options.width + x] = particleColorIdx
      }
    }
  }

  return pixels
}

interface RenderWithRowColorsOptions {
  layout: AsciiTextLayout
  phase: number
  width: number
  height: number
  scale: number
  levels: number
  bounds: LayoutBounds
  padding: number
  rowColorsInput: string[]
  uniqueRowColors: string[]
}

function renderIndexedAsciiFrameWithRowColors(options: RenderWithRowColorsOptions): Uint8Array {
  const pixels = new Uint8Array(options.width * options.height)
  const charWidth = Math.round(ASCII_CHAR_WIDTH * options.scale)
  const charHeight = Math.round(ASCII_CHAR_HEIGHT * options.scale)

  for (const cell of options.layout.cells) {
    const intensity = getAsciiCellIntensity(cell, { phase: options.phase })
    const level = Math.max(0, Math.min(options.levels - 1, Math.round(intensity * (options.levels - 1))))
    const rowColor = options.rowColorsInput[cell.row % options.rowColorsInput.length] ?? options.rowColorsInput[0]!
    const colorSetIndex = Math.max(0, options.uniqueRowColors.indexOf(rowColor))
    const colorIndex = 1 + colorSetIndex * options.levels + level
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

function createRowColorPalette(options: {
  backgroundColor: string
  blendColor: string
  rowColors: string[]
  levels: number
  transparent: boolean
}) {
  const bg = parseColor(options.backgroundColor)
  const blend = parseColor(options.blendColor)
  const table: number[] = [bg.r, bg.g, bg.b]

  for (const colorHex of options.rowColors) {
    const color = parseColor(colorHex)
    for (let level = 0; level < options.levels; level++) {
      const alpha = level / (options.levels - 1)
      const mixed = mix(blend, color, alpha)
      table.push(mixed.r, mixed.g, mixed.b)
    }
  }

  while (table.length < 256 * 3) table.push(0, 0, 0)
  return { table: Uint8Array.from(table.slice(0, 256 * 3)) }
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


function getGlitterIntensity(cell: AsciiCell, loop: number): number {
  // Per-cell deterministic phase — each block blinks on its own schedule
  const seed = (cell.col * 7.13 + cell.row * 13.37) % (Math.PI * 2)
  const glitter = (Math.sin(loop * 3.5 + seed) + 1) / 2  // 0..1, uncorrelated across cells
  // Keep the base flow so the letter still reads as a coherent shape
  const flow = Math.sin(cell.col * 0.08 + loop) * 0.055 + Math.sin(cell.row * 0.22 - loop * 0.75) * 0.04
  // Glitter fires only near peaks — power curve concentrates the bright flashes
  const sparkBoost = Math.pow(glitter, 3) * 0.42
  return Math.max(0.55, Math.min(1, 0.68 + flow + sparkBoost))
}

interface SparkleParticle {
  px: number
  py: number
  phase: number
  freq: number
  accentIdx: number
  shape: "plus" | "star"
}

function generateSparkleParticles(options: {
  layout: AsciiTextLayout
  colAccentMap: ReadonlyMap<number, number>
  sparklingAccents: ReadonlySet<number>
  bounds: LayoutBounds
  padding: number
  scale: number
  width: number
  height: number
}): SparkleParticle[] {
  const charWidth = Math.round(ASCII_CHAR_WIDTH * options.scale)
  const charHeight = Math.round(ASCII_CHAR_HEIGHT * options.scale)
  const particles: SparkleParticle[] = []

  // Collect foreground (█) cells per sparkling accent for inside placement
  const fgCells = new Map<number, Array<{ col: number; row: number }>>()
  for (const cell of options.layout.cells) {
    if (cell.ch !== "█") continue
    const accentIdx = options.colAccentMap.get(cell.col)
    if (accentIdx === undefined || !options.sparklingAccents.has(accentIdx)) continue
    const arr = fgCells.get(accentIdx) ?? []
    arr.push({ col: cell.col, row: cell.row })
    fgCells.set(accentIdx, arr)
  }

  // Compute pixel bounding box per sparkling accent for outside placement
  const accentBoxes = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>()
  for (const cell of options.layout.cells) {
    const accentIdx = options.colAccentMap.get(cell.col)
    if (accentIdx === undefined || !options.sparklingAccents.has(accentIdx)) continue
    const x0 = options.padding + Math.round((cell.col - options.bounds.minCol) * ASCII_CHAR_WIDTH * options.scale)
    const y0 = options.padding + (cell.row - options.bounds.minRow) * charHeight
    const b = accentBoxes.get(accentIdx)
    if (b) {
      b.minX = Math.min(b.minX, x0)
      b.maxX = Math.max(b.maxX, x0 + charWidth)
      b.minY = Math.min(b.minY, y0)
      b.maxY = Math.max(b.maxY, y0 + charHeight)
    } else {
      accentBoxes.set(accentIdx, { minX: x0, maxX: x0 + charWidth, minY: y0, maxY: y0 + charHeight })
    }
  }

  const PHI = 0.6180339887  // golden ratio — maximally equidistributed phases

  for (const [accentIdx, box] of accentBoxes) {
    const cells = fgCells.get(accentIdx) ?? []
    const insideCount = Math.min(20, cells.length)

    // Inside: golden-ratio cell selection + phase spread + varied frequencies
    for (let i = 0; i < insideCount; i++) {
      const cell = cells[Math.floor((i * PHI % 1) * cells.length)]
      if (!cell) continue
      const px = options.padding + Math.round((cell.col - options.bounds.minCol) * ASCII_CHAR_WIDTH * options.scale) + Math.floor(charWidth / 2)
      const py = options.padding + (cell.row - options.bounds.minRow) * charHeight + Math.floor(charHeight / 2)
      const phase = (i * PHI) % 1
      // Varied freq — prime-ish spacing so particles never sync up within the loop
      const freq = 2.3 + (i * 0.41 % 2.8)
      const shape: "plus" | "star" = i % 3 === 1 ? "plus" : "star"
      particles.push({ px, py, phase, freq, accentIdx, shape })
    }

    // Outside: 8 particles around the bounding box, also varied freq + golden-ratio phase
    const cx = (box.minX + box.maxX) / 2
    const cy = (box.minY + box.maxY) / 2
    const hw = (box.maxX - box.minX) / 2 + charWidth * 0.5
    const hh = (box.maxY - box.minY) / 2 + charHeight * 0.5
    const outside = [
      { ox: 0,        oy: -hh - 5 },
      { ox:  hw * 0.5, oy: -hh - 4 },
      { ox: -hw * 0.5, oy: -hh - 4 },
      { ox:  hw + 5,   oy: -hh * 0.3 },
      { ox:  hw + 5,   oy:  hh * 0.4 },
      { ox: -hw - 5,   oy:  hh * 0.1 },
      { ox:  hw * 0.3, oy:  hh + 5 },
      { ox: -hw * 0.4, oy:  hh + 4 },
    ]
    outside.forEach(({ ox, oy }, i) => {
      const globalI = insideCount + i
      const phase = (globalI * PHI) % 1
      const freq = 2.3 + (globalI * 0.41 % 2.8)
      const shape: "plus" | "star" = i % 2 === 0 ? "plus" : "star"
      particles.push({ px: Math.round(cx + ox), py: Math.round(cy + oy), phase, freq, accentIdx, shape })
    })
  }

  return particles
}

function createMultiAccentPalette(options: {
  backgroundColor: string
  blendColor: string
  color: string
  accentColors: string[]
  levels: number
  transparent: boolean
}) {
  const bg = parseColor(options.backgroundColor)
  const blend = parseColor(options.blendColor)
  const base = parseColor(options.color)
  const table: number[] = [bg.r, bg.g, bg.b]

  // Text ramp (indices 1..levels)
  for (let level = 0; level < options.levels; level++) {
    const alpha = level / (options.levels - 1)
    const mixed = mix(blend, base, alpha)
    table.push(mixed.r, mixed.g, mixed.b)
  }

  // One ramp per accent color (indices 1+levels, 1+2*levels, ...)
  for (const accentHex of options.accentColors) {
    const accent = parseColor(accentHex)
    for (let level = 0; level < options.levels; level++) {
      const alpha = level / (options.levels - 1)
      const mixed = mix(blend, accent, alpha)
      table.push(mixed.r, mixed.g, mixed.b)
    }
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
