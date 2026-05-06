import { composeAsciiText } from "./ascii/compose"
import { dosrebelFont } from "./ascii/fonts"
import { parseFigletFont } from "./ascii/figlet"

let renderCache = new Map<string, string[]>()

export async function renderDosRebel(text: string): Promise<string[]> {
  const cached = renderCache.get(text)
  if (cached) return cached

  const font = parseFigletFont(dosrebelFont)
  const layout = composeAsciiText(font, text)
  const output = Array.from({ length: layout.rows }, () => "")
  const cellByPosition = new Map(layout.cells.map((cell) => [`${cell.row}:${cell.col}`, cell.ch]))

  for (let row = 0; row < layout.rows; row++) {
    let line = ""
    for (let col = 0; col < layout.cols; col++) {
      line += cellByPosition.get(`${row}:${col}`) ?? " "
    }
    output[row] = line.replace(/\s+$/g, "")
  }

  renderCache.set(text, output)
  return output
}
