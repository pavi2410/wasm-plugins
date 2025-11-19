import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://pavi2410.github.io',
  base: '/wasm-plugins',
  outDir: '../dist',
  integrations: [react()],
});
