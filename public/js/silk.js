// Hero backdrop: draped silk and drifting event lights, drawn by a single WebGL
// fragment shader (no libraries). The silk sways slowly, catches the light, leans
// toward the pointer and ripples faster while the page scrolls. Pauses off-screen;
// one still frame for visitors who prefer reduced motion. Without WebGL, the hero's
// CSS gradient shows instead.

const canvas = document.getElementById('silk-canvas');
const gl = canvas?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });

if (canvas && gl) start();

function shaderSource(lights) {
  return `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// Height of the fabric: long folds hanging mostly vertically, bent by a slow
// noise field so they billow rather than repeat.
float silk(vec2 p, float warp, float t) {
  // Drape on a diagonal, like fabric swagged from the top corner.
  vec2 q = mat2(0.87, -0.5, 0.5, 0.87) * p;
  float sway = sin(q.y * 0.9 + t * 0.3) * 0.7 + uPointer.x * 1.1;
  float folds = sin(q.x * 2.6 + warp * 3.6 + sway);
  float secondary = sin(q.x * 5.3 - warp * 2.2 + q.y * 0.8 + t * 0.2) * 0.35;
  float ripple = sin(q.x * 13.0 + warp * 6.0 - t * 0.45) * 0.06;
  return folds + secondary + ripple;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y) * 2.0;
  float t = uTime;

  float warp = fbm(vec2(p.x * 0.35 + t * 0.03, p.y * 0.55 - t * 0.06));
  float e = 0.01;
  float h = silk(p, warp, t);
  float hx = silk(p + vec2(e, 0.0), warp, t);
  float hy = silk(p + vec2(0.0, e), warp, t);
  vec3 n = normalize(vec3((h - hx) / e * 0.2, (h - hy) / e * 0.2, 1.0));

  vec3 light = normalize(vec3(0.55 + uPointer.x * 0.5, 0.7 - uPointer.y * 0.4, 0.9));
  float diffuse = clamp(dot(n, light), 0.0, 1.0);
  float sheen = pow(clamp(dot(n, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 36.0);
  float depth = clamp(0.55 + 0.35 * h, 0.0, 1.0); // crests nearer the light, valleys in shadow

  vec3 ink = vec3(0.043, 0.051, 0.071);
  vec3 plum = vec3(0.26, 0.11, 0.38);
  vec3 orchid = vec3(0.68, 0.40, 0.85);
  vec3 lilac = vec3(0.95, 0.87, 1.0);

  vec3 col = mix(ink, plum, smoothstep(0.35, 0.98, diffuse) * (0.35 + 0.65 * depth));
  col = mix(col, orchid, smoothstep(0.9, 1.0, diffuse) * 0.6 * depth);
  col += lilac * sheen * 0.85 * depth;

  // Event lights: soft bokeh orbs drifting upward, warm champagne and lilac.
  for (int i = 0; i < ${lights}; i++) {
    float fi = float(i);
    float speed = 0.015 + 0.035 * hash(vec2(fi, 3.7));
    float x = (hash(vec2(fi, 1.3)) * 2.0 - 1.0) * (uRes.x / min(uRes.x, uRes.y));
    float y = fract(hash(vec2(fi, 7.1)) + t * speed) * 2.8 - 1.4;
    y *= uRes.y / min(uRes.x, uRes.y);
    vec2 c = vec2(x + sin(t * 0.3 + fi * 1.7) * 0.06, y);
    float r = 0.025 + 0.075 * hash(vec2(fi, 9.2));
    float d = length(p - c);
    float disc = smoothstep(r, r * 0.6, d);
    float rim = smoothstep(r, r * 0.92, d) - smoothstep(r * 0.92, r * 0.8, d);
    float glow = exp(-d * d / (r * r * 5.0));
    float twinkle = 0.6 + 0.4 * sin(t * 1.3 + fi * 2.3);
    vec3 tint = mix(vec3(1.0, 0.82, 0.55), vec3(0.88, 0.7, 1.0), hash(vec2(fi, 4.4)));
    col += tint * (disc * 0.28 + rim * 0.18 + glow * 0.12) * twinkle;
  }

  // Deepen the corners so the fabric feels lit from within the room.
  float vignette = smoothstep(1.35, 0.25, length((uv - vec2(0.6, 0.55)) * vec2(1.2, 1.0)));
  col = mix(ink, col, 0.5 + 0.5 * vignette);

  gl_FragColor = vec4(col, 1.0);
}`;
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
  }
  return shader;
}

function start() {
  const host = canvas.parentElement;
  const small = matchMedia('(max-width: 720px)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER,
      'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, shaderSource(small ? 12 : 22)));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (err) {
    console.warn('Silk backdrop unavailable:', err.message);
    return; // the CSS gradient behind the canvas remains
  }
  gl.useProgram(program);

  // One triangle that covers the whole screen.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attr = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uPointer = gl.getUniformLocation(program, 'uPointer');

  // The shader runs per pixel, so cap the resolution: it's a soft image anyway.
  const scale = Math.min(devicePixelRatio, small ? 1 : 1.5);
  function resize() {
    canvas.width = Math.round(host.clientWidth * scale);
    canvas.height = Math.round(host.clientHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    if (!frame) draw(); // keep a correct still frame when paused
  }

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  let time = 12; // start mid-drift so the lights are already spread out
  let speed = 1;
  let lastScroll = window.scrollY;
  let last = performance.now();
  let frame = 0;
  let visible = true;

  function draw() {
    gl.uniform1f(uTime, time);
    gl.uniform2f(uPointer, eased.x, eased.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const scrolled = Math.abs(window.scrollY - lastScroll);
    lastScroll = window.scrollY;
    speed += (1 + Math.min(scrolled * 0.08, 4) - speed) * 0.06;
    time += dt * speed;
    eased.x += (pointer.x - eased.x) * 0.04;
    eased.y += (pointer.y - eased.y) * 0.04;
    draw();
    frame = requestAnimationFrame(loop);
  }

  function play() {
    if (frame || !visible || reduceMotion.matches || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  new ResizeObserver(resize).observe(host);
  resize();
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? play() : pause();
  }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  reduceMotion.addEventListener('change', () => (reduceMotion.matches ? (pause(), draw()) : play()));

  draw();
  play();
  requestAnimationFrame(() => canvas.classList.add('ready'));
}
