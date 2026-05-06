import type { AsciiCell, AsciiTextLayout } from "./compose"

export const ASCII_CHAR_WIDTH = 7.5
export const ASCII_CHAR_HEIGHT = 15

export interface AsciiWave {
  cx: number
  cy: number
  t: number
}

export interface AsciiPointer {
  x: number
  y: number
  active: boolean
}

export interface AsciiFrameState {
  time?: number
  phase?: number
  pointer?: AsciiPointer
  waves?: AsciiWave[]
}

export interface AsciiRenderOptions extends AsciiFrameState {
  accentColumns?: ReadonlySet<number>
  color: string
  accentColor?: string
  charWidth?: number
  charHeight?: number
}

export interface AsciiFrameContext {
  clearRect(x: number, y: number, width: number, height: number): void
  fillRect(x: number, y: number, width: number, height: number): void
  globalAlpha: number
  fillStyle: string
}

export function getAsciiCanvasSize(
  layout: AsciiTextLayout,
  charWidth = ASCII_CHAR_WIDTH,
  charHeight = ASCII_CHAR_HEIGHT,
) {
  return {
    width: Math.ceil(layout.cols * charWidth),
    height: layout.rows * charHeight,
  }
}

export function getAsciiCellIntensity(cell: AsciiCell, options: AsciiFrameState): number {
  const time = options.time ?? 0
  const loop = options.phase == null ? null : options.phase * Math.PI * 2

  if (cell.ch === "░") {
    const drift =
      loop == null
        ? Math.sin(time * 0.3 + cell.col * 0.1) * 0.03
        : Math.sin(loop + cell.col * 0.1) * 0.03
    return 0.15 + drift
  }

  const noise =
    loop == null
      ? getLiveNoise(cell, time)
      : getLoopNoise(cell, loop)

  const seed = cell.col * 7.13 + cell.row * 13.37
  const flickerPhase = Math.sin(seed) * 1000
  const flickerWave =
    loop == null
      ? Math.sin(time * 0.8 + flickerPhase)
      : Math.sin(loop * 2 + flickerPhase)
  const flicker = flickerWave > 0.97 ? 0.15 : 0

  let intensity = 0.7 + noise + flicker
  const charWidth = ASCII_CHAR_WIDTH
  const charHeight = ASCII_CHAR_HEIGHT

  if (options.pointer?.active) {
    const mdx = cell.col * charWidth + charWidth / 2 - options.pointer.x
    const mdy = cell.row * charHeight + charHeight / 2 - options.pointer.y
    const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
    const radius = 80
    if (mDist < radius) {
      const falloff = 1 - mDist / radius
      const ripple = Math.sin(mDist * 0.08 - time * 4) * 0.12 * falloff * falloff
      intensity = Math.min(1, intensity + falloff * 0.2 + ripple)
    }
  }

  const px = cell.col * charWidth + charWidth / 2
  const py = cell.row * charHeight + charHeight / 2
  for (const wave of options.waves ?? []) {
    const wdx = px - wave.cx
    const wdy = py - wave.cy
    const dist = Math.sqrt(wdx * wdx + wdy * wdy)
    const age = time - wave.t
    const waveRadius = age * 200
    const delta = dist - waveRadius
    const fade = Math.exp(-age * 1.5)
    const ring = Math.exp(-delta * delta * 0.002) * fade
    intensity = Math.min(1, intensity + ring * 0.5 * Math.sin(delta * 0.06 + 1.5))
  }

  return Math.max(0.5, Math.min(1, intensity))
}

export function renderAsciiFrameToContext(
  ctx: AsciiFrameContext,
  layout: AsciiTextLayout,
  options: AsciiRenderOptions,
) {
  const charWidth = options.charWidth ?? ASCII_CHAR_WIDTH
  const charHeight = options.charHeight ?? ASCII_CHAR_HEIGHT
  const { width, height } = getAsciiCanvasSize(layout, charWidth, charHeight)
  const accentColor = options.accentColor ?? options.color

  ctx.clearRect(0, 0, width, height)

  for (const cell of layout.cells) {
    const isAccent = options.accentColumns?.has(cell.col) ?? false
    ctx.globalAlpha = getAsciiCellIntensity(cell, options)
    ctx.fillStyle = isAccent ? accentColor : options.color
    ctx.fillRect(cell.col * charWidth, cell.row * charHeight, charWidth, charHeight)
  }

  ctx.globalAlpha = 1
}

function getLiveNoise(cell: AsciiCell, time: number): number {
  const nx = cell.col * 0.18 + time * 0.9
  const ny = cell.row * 0.3 + time * 0.55
  return (
    Math.sin(nx) * 0.12 +
    Math.sin(ny * 1.4 + nx * 0.6) * 0.1 +
    Math.sin(nx * 0.4 - ny * 0.8 + time * 1.6) * 0.08 +
    Math.sin((cell.col + cell.row) * 0.15 + time * 0.4) * 0.07
  )
}

function getLoopNoise(cell: AsciiCell, loop: number): number {
  return (
    Math.sin(cell.col * 0.18 + loop) * 0.12 +
    Math.sin(cell.row * 0.42 + cell.col * 0.1 + loop * 2) * 0.1 +
    Math.sin(cell.col * 0.08 - cell.row * 0.22 - loop) * 0.08 +
    Math.sin((cell.col + cell.row) * 0.15 + loop * 3) * 0.07
  )
}
