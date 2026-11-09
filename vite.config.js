import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { MODEL_SPECS } from './src/assets/manifest.js';

// Detect optional files without issuing failing HTTP requests for absent assets.
// Restart Vite after adding a GLB or HDR file in public/.
const candidates = [
  ...MODEL_SPECS.map(({ file }) => `models/${file}`),
  'hdri/mars_sky.hdr',
];
const availableAssets = candidates.filter(path =>
  existsSync(fileURLToPath(new URL(`./public/${path}`, import.meta.url))),
);

export default defineConfig({
  base: '/simulation-mars/',
  define: {
    __AVAILABLE_ASSETS__: JSON.stringify(availableAssets),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
});
