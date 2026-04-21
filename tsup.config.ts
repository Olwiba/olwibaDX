import { defineConfig } from 'tsup';
import { createTsupBannerHook } from './src/index';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  onSuccess: createTsupBannerHook({
    segments: [
      { text: 'olwiba' },
      { text: 'DX', colorHex: '#22c55e' },
    ],
  }),
});
