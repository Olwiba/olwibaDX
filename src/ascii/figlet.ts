export interface FigletFont {
  height: number
  baseline: number
  hardblank: string
  chars: Map<number, string[]>
}

export function parseFigletFont(raw: string): FigletFont {
  const lines = raw.split("\n")

  if (lines[0]?.charCodeAt(0) === 0xfeff) {
    lines[0] = lines[0].slice(1)
  }

  const header = lines[0]
  if (!header?.startsWith("flf2a")) {
    throw new Error("Invalid FIGlet font: missing flf2a header")
  }

  const hardblank = header[5] ?? "$"
  const parts = header.slice(6).trim().split(/\s+/)
  const height = Number.parseInt(parts[0] ?? "", 10)
  const baseline = Number.parseInt(parts[1] ?? "", 10)
  const commentLines = Number.parseInt(parts[4] ?? "", 10)

  if (!Number.isFinite(height) || height <= 0) {
    throw new Error("Invalid FIGlet font: missing character height")
  }

  const dataStart = 1 + (Number.isFinite(commentLines) ? commentLines : 0)
  const chars = new Map<number, string[]>()
  let lineIndex = dataStart
  let ascii = 32

  while (lineIndex + height <= lines.length && ascii <= 126) {
    const charLines: string[] = []
    for (let row = 0; row < height; row++) {
      const line = (lines[lineIndex + row] ?? "")
        .replace(/@+$/, "")
        .replaceAll(hardblank, " ")
      charLines.push(line)
    }

    chars.set(ascii, charLines)
    lineIndex += height
    ascii++
  }

  return { height, baseline, hardblank, chars }
}
