import { dosrebelFont } from "./fonts/dosrebel-data"

export { dosrebelFont }

export const asciiFonts = {
  dosrebel: dosrebelFont,
} as const

export type AsciiFontName = keyof typeof asciiFonts

export function getAsciiFont(name: AsciiFontName): string {
  return asciiFonts[name]
}
