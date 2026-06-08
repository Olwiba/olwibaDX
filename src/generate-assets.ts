import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

export interface GenerateAssetsConfig {
  name: string
  icon: string
  color: string
  outputDir: string
}

export interface GenerateAssetsResult {
  files: string[]
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

function getLucideIconInner(iconName: string): string {
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
  // Strip outer <svg> wrapper; clear inherited stroke/fill so parent <g> controls them
  return svg
    .replace(/<svg[^>]*>/, "")
    .replace(/<\/svg>/, "")
    .replace(/\sstroke="currentColor"/g, "")
    .replace(/\sfill="none"/g, "")
    .trim()
}

function buildIconSvg(inner: string, color: string, size: number): string {
  const pad = Math.round(size * 0.18)
  const area = size - pad * 2
  const scale = area / 24
  const rx = Math.round(size * 0.16)
  // Inverse-scale stroke so it renders at ~2px regardless of size
  const sw = (2 / scale).toFixed(4)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${color}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})" stroke="white" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    ${inner}
  </g>
</svg>`
}

function buildOgSvg(inner: string, name: string, color: string): string {
  const iconPx = 180
  const iconX = Math.round((1200 - iconPx) / 2) // 510
  const iconY = 160
  const scale = iconPx / 24
  // ~2.5px strokes at final 180px icon size
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

const FAVICON_SIZES = [16, 32, 48, 64] as const

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

  const inner = getLucideIconInner(icon)
  const written: string[] = []

  // favicon/favicon-{size}.png
  for (const size of FAVICON_SIZES) {
    const svg = buildIconSvg(inner, color, size)
    const png = await sharpFn(Buffer.from(svg)).png().toBuffer()
    const dest = join(faviconDir, `favicon-${size}.png`)
    writeFileSync(dest, png)
    written.push(dest)
  }

  // apple-touch-icon, android-chrome-*
  for (const [filename, size] of NAMED_ICONS) {
    const svg = buildIconSvg(inner, color, size)
    const png = await sharpFn(Buffer.from(svg)).png().toBuffer()
    const dest = join(outputDir, filename)
    writeFileSync(dest, png)
    written.push(dest)
  }

  // og-image.png
  const ogSvg = buildOgSvg(inner, name, color)
  const ogPng = await sharpFn(Buffer.from(ogSvg)).png().toBuffer()
  const ogDest = join(outputDir, "og-image.png")
  writeFileSync(ogDest, ogPng)
  written.push(ogDest)

  // manifest.json
  const manifest = {
    name,
    short_name: name,
    theme_color: color,
    background_color: "#09090b",
    display: "standalone",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
  const manifestDest = join(outputDir, "manifest.json")
  writeFileSync(manifestDest, JSON.stringify(manifest, null, 2) + "\n")
  written.push(manifestDest)

  // robots.txt
  const robotsDest = join(outputDir, "robots.txt")
  writeFileSync(robotsDest, "User-agent: *\nAllow: /\n")
  written.push(robotsDest)

  return { files: written }
}
