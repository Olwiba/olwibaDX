import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

export interface GenerateAssetsConfig {
  name: string
  /** Lucide icon name (e.g. "Zap") OR path to an SVG file (e.g. "./logo.svg") */
  icon: string
  color: string
  outputDir: string
}

export interface GenerateAssetsResult {
  files: string[]
}

type IconMode = "lucide" | "svg"

function detectIconMode(icon: string): IconMode {
  return icon.endsWith(".svg") || icon.includes("/") || icon.includes("\\") ? "svg" : "lucide"
}

function toKebabCase(name: string): string {
  return name
    .replace(/([A-Z])/g, (_, ch: string) => `-${ch.toLowerCase()}`)
    .replace(/^-/, "")
    .toLowerCase()
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function getLucideInner(iconName: string): string {
  const kebab = toKebabCase(iconName)
  const req = createRequire(import.meta.url)
  let iconPath: string
  try {
    iconPath = req.resolve(`lucide-static/icons/${kebab}.svg`)
  } catch {
    throw new Error(
      `Unknown Lucide icon: "${iconName}" (tried "${kebab}.svg"). ` +
        `Browse icons at https://lucide.dev/icons`,
    )
  }
  const svg = readFileSync(iconPath, "utf-8")
  return svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/\sstroke="currentColor"/g, "")
    .replace(/\sfill="none"/g, "")
    .trim()
}

function getSvgInner(svgPath: string): { inner: string; viewBox: number } {
  const abs = resolve(process.cwd(), svgPath)
  const svg = readFileSync(abs, "utf-8")
  const vbMatch = svg.match(/viewBox="0 0 (\d+\.?\d*) \d/)
  const viewBox = vbMatch ? parseFloat(vbMatch[1]) : 24
  const inner = svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .trim()
  return { inner, viewBox }
}

function buildIconSvgLucide(inner: string, color: string, size: number): string {
  const pad = Math.round(size * 0.18)
  const area = size - pad * 2
  const scale = area / 24
  const rx = Math.round(size * 0.16)
  const sw = (2 / scale).toFixed(4)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${color}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" stroke="white" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>`
}

function buildIconSvgCustom(inner: string, viewBox: number, color: string, size: number): string {
  const pad = Math.round(size * 0.08)
  const area = size - pad * 2
  const scale = area / viewBox
  const rx = Math.round(size * 0.16)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${color}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    ${inner}
  </g>
</svg>`
}

function buildOgSvgLucide(inner: string, name: string, color: string): string {
  const iconPx = 180
  const iconX = Math.round((1200 - iconPx) / 2)
  const iconY = 160
  const scale = iconPx / 24
  const sw = (2.5 / scale).toFixed(4)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="rg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#09090b"/>
  <rect width="1200" height="630" fill="url(#rg)"/>
  <g transform="translate(${iconX} ${iconY}) scale(${scale})" stroke="${color}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
  <text x="600" y="470" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" font-size="72" font-weight="700" fill="white" text-anchor="middle" letter-spacing="-1">${escapeXml(name)}</text>
</svg>`
}

function buildOgSvgCustom(inner: string, viewBox: number, color: string): string {
  const s = 470
  const x = Math.round((1200 - s) / 2)
  const y = Math.round((630 - s) / 2)
  const scale = s / viewBox
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="${color}"/>
  <g transform="translate(${x} ${y}) scale(${scale})">
    ${inner}
  </g>
</svg>`
}

const FAVICON_SIZES = [16, 32, 48, 64, 192, 512] as const

const NAMED_ICONS: Array<[string, number]> = [
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
]

export async function generateAssets(
  config: GenerateAssetsConfig,
): Promise<GenerateAssetsResult> {
  const { name, icon, color, outputDir } = config

  let sharpFn: typeof import("sharp")
  try {
    sharpFn = (await import("sharp")).default
  } catch {
    throw new Error(
      "sharp is required for asset generation.\n" +
        "Install it in your project: bun add sharp lucide-static",
    )
  }

  mkdirSync(outputDir, { recursive: true })
  const faviconDir = join(outputDir, "favicon")
  mkdirSync(faviconDir, { recursive: true })

  const mode = detectIconMode(icon)
  const written: string[] = []

  let inner: string
  let viewBox = 24

  if (mode === "svg") {
    const parsed = getSvgInner(icon)
    inner = parsed.inner
    viewBox = parsed.viewBox
  } else {
    inner = getLucideInner(icon)
  }

  const buildIcon = (size: number) =>
    mode === "svg"
      ? buildIconSvgCustom(inner, viewBox, color, size)
      : buildIconSvgLucide(inner, color, size)

  for (const size of FAVICON_SIZES) {
    const png = await sharpFn(Buffer.from(buildIcon(size))).png().toBuffer()
    const dest = join(faviconDir, `favicon-${size}.png`)
    writeFileSync(dest, png)
    written.push(dest)
  }

  for (const [filename, size] of NAMED_ICONS) {
    const png = await sharpFn(Buffer.from(buildIcon(size))).png().toBuffer()
    const dest = join(outputDir, filename)
    writeFileSync(dest, png)
    written.push(dest)
  }

  const ogSvg =
    mode === "svg"
      ? buildOgSvgCustom(inner, viewBox, color)
      : buildOgSvgLucide(inner, name, color)

  const ogPng = await sharpFn(Buffer.from(ogSvg)).png().toBuffer()
  const ogDest = join(outputDir, "og-image.png")
  writeFileSync(ogDest, ogPng)
  written.push(ogDest)

  const manifest = {
    name,
    short_name: name,
    theme_color: color,
    background_color: mode === "svg" ? color : "#09090b",
    display: "standalone",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
  const manifestDest = join(outputDir, "manifest.json")
  writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + "\n")
  written.push(manifestDest)

  const robotsDest = join(outputDir, "robots.txt")
  writeFileSync(robotsDest, "User-agent: *\nAllow: /\n")
  written.push(robotsDest)

  return { files: written }
}
