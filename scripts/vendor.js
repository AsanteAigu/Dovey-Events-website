// Copies the three.js files the homepage needs into public/vendor, so every host
// (including Vercel's static hosting) serves them like any other asset.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const threeDir = join(dirname(createRequire(import.meta.url).resolve('three')), '..');
const out = join(root, 'public/vendor');

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'three.module.js'), readFileSync(join(threeDir, 'build/three.module.js')));

// RoomEnvironment imports the bare specifier 'three'. Point it at the copy above
// so the browser needs no import map (inline scripts are blocked by our CSP).
const roomEnvironment = readFileSync(join(threeDir, 'examples/jsm/environments/RoomEnvironment.js'), 'utf8')
  .replace(/from\s+['"]three['"]/g, "from './three.module.js'");
writeFileSync(join(out, 'RoomEnvironment.js'), roomEnvironment);

console.log('Copied three.js into public/vendor');
