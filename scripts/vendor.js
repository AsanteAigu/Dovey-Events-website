// Copies the browser libraries the site uses into public/vendor, so every host
// (including Vercel's static hosting) serves them like any other asset, from our
// own origin (the CSP only allows scripts from 'self').
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');
const out = join(root, 'public/vendor');

mkdirSync(out, { recursive: true });

// GSAP (scroll animations, text reveals) and Lenis (smooth scrolling).
for (const file of ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js']) {
  copyFileSync(join(modules, 'gsap/dist', file), join(out, file));
}
copyFileSync(join(modules, 'lenis/dist/lenis.min.js'), join(out, 'lenis.min.js'));

console.log('Copied GSAP and Lenis into public/vendor');
