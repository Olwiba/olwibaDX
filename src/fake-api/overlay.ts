import { clientScript, HOST_ID } from "./client"

/**
 * The launcher and drawer added to every page while the fake API is on.
 *
 * A tab on the right edge that opens out on hover; clicking it slides in a
 * drawer holding the scenario studio. Both render into a shadow root on the
 * page (see ./client.ts), so they take the app's theme and cannot collide
 * with its CSS. The app can detect them through `[data-fake-api-overlay]`.
 */

export interface OverlayOptions {
  basePath: string
  title: string
  accentColor: string
  /** Distance of the launcher from the bottom of the viewport, in pixels. */
  launcherBottom: number
}

export function overlaySnippet({ basePath, title, accentColor, launcherBottom }: OverlayOptions): string {
  return `<div id="${HOST_ID}" data-fake-api-overlay="true"></div>${clientScript({
    base: basePath,
    embedded: true,
    title,
    brand: accentColor,
    launcherBottom,
  })}`
}
