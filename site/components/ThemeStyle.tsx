'use client';

import * as React from 'react';
import { projectThemeStyleCss } from '~/project.config';

/**
 * Injects the project accent variables.
 *
 * The other sites wrap the body in OlwibaUIProvider as well, to pick up the
 * mode dropdown. Nothing here renders an olwibaUI component — and depending on
 * `@olwiba/ui` would point a package back at one of its own consumers — so this
 * is the style tag on its own.
 */
export function ThemeStyle({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{projectThemeStyleCss}</style>
      {children}
    </>
  );
}
