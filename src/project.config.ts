import type { ProjectConfig } from "./project-brand"

export const projectConfig = {
  id: "olwibaDX",
  label: "olwibaDX",
  brandAccent: {
    hex: "#f97316",
    // The same orange in the colour space the docs site styles in. Kept beside
    // the hex so the terminal banner and the website cannot drift apart.
    lightOklch: "oklch(0.705 0.213 47.604)",
    darkOklch: "oklch(0.750 0.183 55.934)",
  },
  banner: {
    segments: [
      { text: "olwiba" },
      { text: "DX", accent: true },
    ],
  },
} as const satisfies ProjectConfig
