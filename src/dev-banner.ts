const RESET = "\x1b[0m"
const DEFAULT_HEX = "#22D3EE"
const WHITE_HEX = "#ffffff"

export type BannerSegment = {
  text: string
  colorHex?: string
}

type BannerOptions = {
  segments: BannerSegment[]
  compactSegments?: BannerSegment[]
}

type LegacyBannerOptions = {
  baseText: string
  suffix?: string
  colorHex?: string
  baseColorHex?: string
}

type DevPlugin = {
  name: string
  apply: "serve"
  configureServer: (server: unknown) => void
}

function hexToAnsi24(hex: string) {
  const normalized = hex.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null
  }
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `\x1b[38;2;${r};${g};${b}m`
}

function visibleLen(value: string) {
  return value.length
}

function normalizeSegments(
  input: string | BannerOptions | LegacyBannerOptions
): { segments: BannerSegment[]; compactSegments?: BannerSegment[] } {
  if (typeof input === "string") {
    return { segments: [{ text: input, colorHex: WHITE_HEX }] }
  }

  if ("segments" in input) {
    const normalize = (segments: BannerSegment[]) =>
      segments
      .filter((segment) => segment.text.trim().length > 0)
      .map((segment) => ({
        text: segment.text,
        colorHex: segment.colorHex ?? WHITE_HEX,
      }))
    const segments = normalize(input.segments)
    const compactSegments =
      input.compactSegments && input.compactSegments.length > 0
        ? normalize(input.compactSegments)
        : undefined
    return { segments, compactSegments }
  }

  const suffix = input.suffix ?? ""
  if (!suffix) {
    return {
      segments: [{ text: input.baseText, colorHex: input.colorHex ?? DEFAULT_HEX }],
    }
  }

  return {
    segments: [
      { text: input.baseText, colorHex: input.baseColorHex ?? WHITE_HEX },
      { text: suffix, colorHex: input.colorHex ?? DEFAULT_HEX },
    ],
  }
}

async function renderSegmentedFiglet(segments: BannerSegment[]) {
  const { renderDosRebel } = await import("./dos-rebel-font")
  const cumulativeTexts: string[] = []
  let textSoFar = ""
  for (const segment of segments) {
    textSoFar += segment.text
    cumulativeTexts.push(textSoFar)
  }

  const renderedByBoundary = await Promise.all(
    cumulativeTexts.map((text) => renderDosRebel(text))
  )
  const lines = renderedByBoundary[renderedByBoundary.length - 1] ?? []
  const boundaryLines = renderedByBoundary.slice(0, -1)
  const ansiBySegment = segments.map(
    (segment) => hexToAnsi24(segment.colorHex ?? WHITE_HEX) ?? "\x1b[97m"
  )
  const widestLine = lines.reduce((max, line) => Math.max(max, visibleLen(line)), 0)

  return { lines, boundaryLines, ansiBySegment, widestLine }
}

function printColoredFiglet(
  lines: string[],
  boundaryLines: string[][],
  ansiBySegment: string[]
) {
  for (let i = 0; i < lines.length; i++) {
    const full = lines[i] ?? ""
    let cursor = 0
    let out = ""

    for (let segmentIndex = 0; segmentIndex < ansiBySegment.length; segmentIndex += 1) {
      const boundaryLine =
        segmentIndex < boundaryLines.length ? boundaryLines[segmentIndex]?.[i] ?? "" : full
      const end = Math.min(boundaryLine.length, full.length)
      const chunk = full.slice(cursor, end)
      out += `${ansiBySegment[segmentIndex]}${chunk}`
      cursor = end
    }

    process.stdout.write(`${out}${RESET}\n`)
  }
}

export async function printBanner(input: string | BannerSegment[] | BannerOptions) {
  const normalized = Array.isArray(input)
    ? { segments: input, compactSegments: undefined }
    : normalizeSegments(input)
  const segments = normalized.segments
  const compactSegments = normalized.compactSegments
  if (!segments.length) return

  process.stdout.write(`${RESET}\n`)
  const terminalColumns = process.stdout.columns ?? 0
  const primary = await renderSegmentedFiglet(segments)

  if (terminalColumns === 0 || primary.widestLine <= terminalColumns) {
    printColoredFiglet(primary.lines, primary.boundaryLines, primary.ansiBySegment)
    return
  }

  if (compactSegments && compactSegments.length > 0) {
    const compactFiglet = await renderSegmentedFiglet(compactSegments)
    if (compactFiglet.widestLine <= terminalColumns) {
      printColoredFiglet(
        compactFiglet.lines,
        compactFiglet.boundaryLines,
        compactFiglet.ansiBySegment
      )
      return
    }
  }

  let plain = ""
  for (let i = 0; i < segments.length; i++) {
    const text = segments[i]?.text ?? ""
    if (!text) continue
    plain += `${primary.ansiBySegment[i]}${text}`
  }
  process.stdout.write(`${plain}${RESET}\n`)
}

export function createTsupBannerHook(
  project: string | BannerOptions | LegacyBannerOptions
): () => Promise<void> {
  let shown = false
  const normalized = normalizeSegments(project)
  return async () => {
    if (shown) return
    shown = true
    await printBanner(normalized)
  }
}

export function createDevBannerPlugin(
  project: string | BannerOptions | LegacyBannerOptions
): DevPlugin {
  let shown = false
  const { segments, compactSegments } = normalizeSegments(project)
  const bannerText = segments.map((segment) => segment.text).join("")
  return {
    name: `nexus-dev-banner-${bannerText.toLowerCase()}`,
    apply: "serve",
    configureServer(_server: unknown) {
      if (shown) return
      shown = true
      void printBanner({ segments, compactSegments })
    },
  }
}
