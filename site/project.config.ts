import { projectConfig as packageConfig } from '../src/project.config'

/**
 * The site's view of the brand.
 *
 * Colours come from `src/project.config.ts`, which the terminal banner and the
 * tsup build already read — one place decides what colour olwibaDX is. Only the
 * docs theme is added here, because the CLI has no use for it.
 */
export const projectConfig = {
  ...packageConfig,
  theme: {
    initialDocsTheme: 'orange',
  },
} as const

export const projectThemeStyleCss = `:root {
  --project-brand-accent: ${projectConfig.brandAccent.lightOklch};
  --project-brand-accent-dark: ${projectConfig.brandAccent.darkOklch};
}`
