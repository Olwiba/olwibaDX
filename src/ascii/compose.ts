import type { FigletFont } from "./figlet"

export interface AsciiCell {
  ch: "█" | "░"
  col: number
  row: number
}

export interface AsciiTextLayout {
  cells: AsciiCell[]
  cols: number
  rows: number
}

export function composeAsciiText(font: FigletFont, text: string): AsciiTextLayout {
  const charBlocks: Array<{ lines: string[]; width: number }> = []

  for (const ch of text) {
    const code = ch.charCodeAt(0)
    const glyph = font.chars.get(code) ?? font.chars.get(32)
    if (!glyph) continue

    const width = Math.max(...glyph.map((line) => line.length))
    charBlocks.push({
      lines: glyph.map((line) => line.padEnd(width)),
      width,
    })
  }

  const cols = charBlocks.reduce((sum, block) => sum + block.width, 0)
  const rows = font.height
  const cells: AsciiCell[] = []
  let offsetX = 0

  for (const block of charBlocks) {
    for (let row = 0; row < rows; row++) {
      const line = block.lines[row] ?? ""
      for (let col = 0; col < line.length; col++) {
        const ch = line[col]
        if (ch === "█" || ch === "░") {
          cells.push({ ch, col: offsetX + col, row })
        }
      }
    }
    offsetX += block.width
  }

  return { cells, cols, rows }
}

export function getAsciiAccentColumns(
  font: FigletFont,
  text: string,
  accent: string,
): Set<number> {
  if (!accent) return new Set<number>()

  const columns = new Set<number>()
  const accentRanges: Array<{ start: number; end: number }> = []
  let searchFrom = 0
  while (true) {
    const idx = text.indexOf(accent, searchFrom)
    if (idx === -1) break
    accentRanges.push({ start: idx, end: idx + accent.length })
    searchFrom = idx + 1
  }
  if (accentRanges.length === 0) return columns

  let offsetX = 0
  let charIndex = 0

  for (const ch of text) {
    const code = ch.charCodeAt(0)
    const glyph = font.chars.get(code) ?? font.chars.get(32)
    if (!glyph) { charIndex++; continue }

    const width = Math.max(...glyph.map((line) => line.length))
    if (accentRanges.some((r) => charIndex >= r.start && charIndex < r.end)) {
      for (let col = 0; col < width; col++) columns.add(offsetX + col)
    }
    offsetX += width
    charIndex++
  }

  return columns
}
