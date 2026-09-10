import react from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { createProjectDevBannerPlugin, resolveDevPort } from './src/index';
import { projectConfig } from './src/project.config';

export default defineConfig({
  server: {
    port: await resolveDevPort(3004),
    allowedHosts: true,
  },
  resolve: {
    /** Linked `@olwiba/cn` resolves Radix from `olwibaCN/node_modules`; that pulls a second `react` and breaks SSR hooks. */
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['@olwiba/docs'],
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
  ssr: {
    noExternal: [
      '@olwiba/cn',
      '@olwiba/docs',
      // Radix packages are deps of @olwiba/cn. Without this they resolve as SSR
      // externals from olwibaCN/node_modules and pull a second React instance,
      // causing "Cannot read properties of null (reading 'useMemo')".
      /^@radix-ui\//,
    ],
  },
  plugins: [
    // Straight from source rather than through `@olwiba/dx`: this repo is the
    // package, so the published build is always one step behind what is here.
    createProjectDevBannerPlugin(projectConfig),
    mdx(await import('./source.config')),
    tailwindcss(),
    tsConfigPaths({
      projects: ['./tsconfig.site.json'],
    }),
    tanstackStart({
      srcDirectory: 'site',
    }),
    react(),
  ],
});
