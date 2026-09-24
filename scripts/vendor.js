// Copies the browser libraries the site uses into public/vendor, so every host
// (including Vercel's static hosting) serves them like any other asset, from our
// own origin (the CSP only allows scripts from 'self').
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');
const threeDir = join(dirname(createRequire(import.meta.url).resolve('three')), '..');
const out = join(root, 'public/vendor');

mkdirSync(out, { recursive: true });

// three.js, for the ribbon hero.
copyFileSync(join(threeDir, 'build/three.module.js'), join(out, 'three.module.js'));
// RoomEnvironment imports the bare specifier 'three'. Point it at the copy above
// so the browser needs no import map (inline scripts are blocked by our CSP).
const roomEnvironment = readFileSync(join(threeDir, 'examples/jsm/environments/RoomEnvironment.js'), 'utf8')
  .replace(/from\s+['"]three['"]/g, "from './three.module.js'");
writeFileSync(join(out, 'RoomEnvironment.js'), roomEnvironment);

// GSAP (scroll animations, text reveals) and Lenis (smooth scrolling).
for (const file of ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js']) {
  copyFileSync(join(modules, 'gsap/dist', file), join(out, file));
}
copyFileSync(join(modules, 'lenis/dist/lenis.min.js'), join(out, 'lenis.min.js'));

console.log('Copied three.js, GSAP and Lenis into public/vendor');
