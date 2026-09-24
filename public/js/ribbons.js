// Silk ribbons: flat, twisting strips driven by a procedural wind field.
// Rendered behind the homepage hero; pauses when off-screen and respects reduced motion.
import * as THREE from '/vendor/three.module.js';
import { RoomEnvironment } from '/vendor/RoomEnvironment.js';

const canvas = document.getElementById('ribbon-canvas');
const host = canvas?.parentElement;

function supportsWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

if (canvas && supportsWebGL()) start();

// Cheap fractal-sine "flow" noise.
function flow1(x) {
  return Math.sin(x) * 0.5 + Math.sin(x * 2.13 + 1.7) * 0.28 + Math.sin(x * 4.7 + 3.1) * 0.14;
}

// Inigo Quilez cosine gradient.
function paletteColor(t, a, b, c, d, out) {
  out.r = a.x + b.x * Math.cos(6.28318 * (c.x * t + d.x));
  out.g = a.y + b.y * Math.cos(6.28318 * (c.y * t + d.y));
  out.b = a.z + b.z * Math.cos(6.28318 * (c.z * t + d.z));
  return out;
}

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // Phones: fewer pixels to shade keeps the ribbons smooth and the battery happy.
  const small = matchMedia('(max-width: 720px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 14);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.DirectionalLight(0xffffff, 1.2).translateZ(5).translateY(5));
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const group = new THREE.Group();
  scene.add(group);

  class Ribbon {
    constructor(o) {
      this.o = o;
      this.N = 140;
      const count = this.N * 2 * 3;
      this.positions = new Float32Array(count);
      this.normals = new Float32Array(count);
      this.colors = new Float32Array(count);
      this.pts = Array.from({ length: this.N }, () => new THREE.Vector3());

      const indices = [];
      for (let i = 0; i < this.N - 1; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, c, b, b, c, d);
      }
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setIndex(indices);
      this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
      this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3));
      this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

      const material = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        metalness: 0.15,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        side: THREE.DoubleSide,
      });
      group.add(new THREE.Mesh(this.geometry, material));
    }

    update(t) {
      const { o, N, pts } = this;
      const tangent = new THREE.Vector3();
      const up = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const binormal = new THREE.Vector3();
      const col = new THREE.Color();

      for (let i = 0; i < N; i++) {
        const s = i / (N - 1);
        const windPhase = s * o.windFreq - t * o.windSpeed;
        pts[i].set(
          Math.sin(s * o.turns * Math.PI * 2 + o.phase) * o.spread + flow1(windPhase + o.seed) * o.windAmp,
          THREE.MathUtils.lerp(o.top, o.bottom, s),
          Math.cos(s * o.turns * Math.PI * 2 + o.phase) * o.spread * 0.5 + flow1(windPhase * 1.3 + o.seed + 4.2) * o.windAmp * 0.7,
        );
      }

      const half = o.width / 2;
      for (let i = 0; i < N; i++) {
        tangent.copy(pts[Math.min(i + 1, N - 1)]).sub(pts[Math.max(i - 1, 0)]).normalize();
        up.set(Math.abs(tangent.y) > 0.95 ? 1 : 0, Math.abs(tangent.y) > 0.95 ? 0 : 1, 0);
        normal.crossVectors(up, tangent).normalize();
        binormal.crossVectors(tangent, normal).normalize();

        const s = i / (N - 1);
        const twist = s * o.twistTurns * Math.PI * 2 + o.phase * 0.5;
        const cosT = Math.cos(twist), sinT = Math.sin(twist);
        const nx = normal.x * cosT + binormal.x * sinT;
        const ny = normal.y * cosT + binormal.y * sinT;
        const nz = normal.z * cosT + binormal.z * sinT;
        const bx = binormal.x * cosT - normal.x * sinT;
        const by = binormal.y * cosT - normal.y * sinT;
        const bz = binormal.z * cosT - normal.z * sinT;

        const p = pts[i];
        const li = i * 6, ri = li + 3;
        this.positions[li] = p.x - nx * half;
        this.positions[li + 1] = p.y - ny * half;
        this.positions[li + 2] = p.z - nz * half;
        this.positions[ri] = p.x + nx * half;
        this.positions[ri + 1] = p.y + ny * half;
        this.positions[ri + 2] = p.z + nz * half;

        this.normals[li] = this.normals[ri] = bx;
        this.normals[li + 1] = this.normals[ri + 1] = by;
        this.normals[li + 2] = this.normals[ri + 2] = bz;

        const band = 0.5 + 0.5 * Math.sin(s * o.bandFreq + t * 0.6);
        paletteColor(s * 0.7 + band * 0.15, o.a, o.b, o.c, o.d, col);
        this.colors[li] = this.colors[ri] = col.r;
        this.colors[li + 1] = this.colors[ri + 1] = col.g;
        this.colors[li + 2] = this.colors[ri + 2] = col.b;
      }

      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.normal.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const ribbons = [
    new Ribbon({
      top: 9, bottom: -9, spread: 2.6, turns: 1.4, twistTurns: 2.2,
      phase: 0, windAmp: 1.1, windFreq: 5, windSpeed: 0.6, seed: 0, width: 0.9, bandFreq: 18,
      a: v3(0.5, 0.5, 0.6), b: v3(0.5, 0.5, 0.4), c: v3(0.6, 0.7, 0.9), d: v3(0.6, 0.5, 0.7), // blue / pink
    }),
    new Ribbon({
      top: 9.5, bottom: -8.5, spread: 3.2, turns: 1.1, twistTurns: -1.8,
      phase: 2.4, windAmp: 0.9, windFreq: 4.2, windSpeed: 0.45, seed: 10, width: 0.7, bandFreq: 14,
      a: v3(0.55, 0.36, 0.7), b: v3(0.3, 0.22, 0.28), c: v3(0.8, 0.7, 0.6), d: v3(0.05, 0.15, 0.2), // orchid (logo purple)
    }),
  ];

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Sit the ribbons to the right on wide screens so they frame the headline.
    group.position.x = w > 860 ? 4.2 * Math.min(w / h, 2) / 1.6 : 0;
    group.scale.setScalar(Math.min(h / 900, 1.6));
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clock = new THREE.Clock();
  let visible = true;
  let frame = 0;

  // The wind picks up while the page scrolls, and the ribbons lean toward the pointer.
  let windTime = 4;
  let windSpeed = 1;
  let lastScroll = window.scrollY;
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  function render() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduceMotion.matches) {
      const scrolled = Math.abs(window.scrollY - lastScroll);
      lastScroll = window.scrollY;
      windSpeed += (1 + Math.min(scrolled * 0.12, 5) - windSpeed) * 0.06;
      windTime += dt * windSpeed;
      group.rotation.y += (pointer.x * 0.35 - group.rotation.y) * 0.04;
      group.rotation.x += (pointer.y * 0.18 - group.rotation.x) * 0.04;
    }
    for (const r of ribbons) r.update(windTime);
    renderer.render(scene, camera);
  }

  function loop() {
    render();
    frame = visible && !reduceMotion.matches ? requestAnimationFrame(loop) : 0;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frame) loop();
  }).observe(host);

  reduceMotion.addEventListener('change', () => { if (!frame) loop(); });
  loop();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
