// Copies MapLibre GL JS's web worker into public/ so the web build can serve it.
// maplibre-gl 6 locates its worker via import.meta.url, which Metro's web
// bundle doesn't provide; PawMap.web.tsx points setWorkerUrl() at this copy.
// Runs on postinstall, so the copy always matches the installed version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const worker = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist', 'maplibre-gl-worker.mjs');

mkdirSync(path.join(root, 'public'), { recursive: true });
copyFileSync(worker, path.join(root, 'public', 'maplibre-gl-worker.mjs'));
console.log('Copied maplibre-gl-worker.mjs to public/');
