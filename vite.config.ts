import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePagesBase } from './src/pagesBase';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'),
) as { version: string };

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages for rrkennedy69/Sunburn is served at /Sunburn/.
  base: resolvePagesBase(command, process.env.VITE_BASE_PATH),
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // `vite build --mode capture` is only used by `npm run docs:screenshots`.
    __CAPTURE_SESSION__: JSON.stringify(process.env.CAPTURE_SESSION === '1'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          fabric: ['fabric'],
          paper: ['paper'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 4317,
    strictPort: true,
    // Only the app sources are watched. Flatpak output (`builddir/`,
    // `.flatpak-builder/`), packaged builds and local repos contain mount
    // trees and self-referencing symlinks (e.g. `var/run/udev/watch/*`) that
    // make chokidar die with ELOOP and take the dev server down.
    watch: {
      ignored: [
        '**/builddir/**',
        '**/.flatpak-builder/**',
        '**/release/**',
        '**/dist/**',
        '**/dist-electron/**',
        '**/repo/**',
        '**/coverage/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/website/**',
      ],
    },
  },
  preview: {
    port: 4318,
    strictPort: true,
  },
}));
