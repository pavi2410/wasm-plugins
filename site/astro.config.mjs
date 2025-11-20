import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://pavi2410.github.io',
  base: '/wasm-plugins',
  outDir: '../dist',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
