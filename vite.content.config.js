import { defineConfig } from 'vite';
import { copyFileSync, cpSync } from 'fs';
import { resolve } from 'path';

/**
 * Strips CSS imports so the IIFE content script bundle stays self-contained.
 * CSS for the settings panel is already loaded by the popup UI build.
 */
function ignoreCss() {
  return {
    name: 'ignore-css',
    transform(_code, id) {
      if (id.endsWith('.css')) return { code: '', map: null };
    },
  };
}

/**
 * Copies manifest.json and the src/assets/ folder into dist/ after the content build.
 */
function copyExtensionAssets(): Plugin {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );
      cpSync(
        resolve(__dirname, 'src/assets'),
        resolve(__dirname, 'dist/assets'),
        { recursive: true }
      );
    },
  };
}

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/popup.js'),
      name: 'SocialMediaBlocks',
      fileName: () => 'popup.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [ignoreCss(), copyExtensionAssets()],
});