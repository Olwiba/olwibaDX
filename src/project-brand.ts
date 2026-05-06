import {
  createDevBannerPlugin,
  createTsupBannerHook,
  type BannerSegment,
} from "./dev-banner"

export type ProjectBrandAccent = {
  hex: string
  lightOklch?: string
  darkOklch?: string
}

export type ProjectBannerSegment = {
  text: string
  accent?: boolean
  colorHex?: string
}

export type ProjectConfig = {
  id: string
  label: string
  brandAccent: ProjectBrandAccent
  banner: {
    segments: readonly ProjectBannerSegment[]
    compactSegments?: readonly ProjectBannerSegment[]
  }
}

function resolveProjectBannerSegments(
  segments: readonly ProjectBannerSegment[],
  accentHex: string
): BannerSegment[] {
  return segments.map((segment) => ({
    text: segment.text,
    colorHex: segment.accent ? accentHex : segment.colorHex,
  }))
}

function getProjectBanner(project: ProjectConfig) {
  return {
    segments: resolveProjectBannerSegments(project.banner.segments, project.brandAccent.hex),
    compactSegments: project.banner.compactSegments
      ? resolveProjectBannerSegments(project.banner.compactSegments, project.brandAccent.hex)
      : undefined,
  }
}

export function createProjectDevBannerPlugin(project: ProjectConfig) {
  return createDevBannerPlugin(getProjectBanner(project))
}

export function createProjectTsupBannerHook(project: ProjectConfig) {
  return createTsupBannerHook(getProjectBanner(project))
}
