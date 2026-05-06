import type { ProjectConfig } from "./project-brand"

export const projectConfig = {
  id: "olwibaDX",
  label: "olwibaDX",
  brandAccent: {
    hex: "#f97316",
  },
  banner: {
    segments: [
      { text: "olwiba" },
      { text: "DX", accent: true },
    ],
  },
} as const satisfies ProjectConfig
