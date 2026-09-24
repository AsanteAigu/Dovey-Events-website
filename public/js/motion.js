// Motion layer shared by the public pages: smooth scrolling (Lenis), scroll reveals
// and headline line reveals (GSAP + ScrollTrigger + SplitText), a trailing cursor,
// magnetic buttons, the occasions marquee, the rotating badge, the floating action
// bar and the first-visit intro.
//
// Pages opt in with attributes:
//   data-reveal="lines"   headline rises line by line from behind a mask
//   data-reveal="up"      element fades up
//   data-reveal="stagger" children fade up one after another
//   data-count="<pesewas>" number counts up to a cedi amount when revealed
//   data-magnetic         element leans toward the pointer
//   data-cursor="Label"   the cursor grows and shows a label over this element
//
// boot.js (loaded in <head>) adds html.motion before first paint unless the visitor
// prefers reduced motion; CSS pre-hides reveal targets only under that class, with a
// timed fallback that shows them anyway if this script never runs.
import { money } from './common.js';

const root = document.documentElement;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;

export const enabled = root.classList.contains('motion') && !!gsap && !!ScrollTrigger;
const finePointer = matchMedia('(pointer: fine)').matches;
const EASE = 'expo.out';

let lenis;
let scrollVelocity = 0; // px/s, smoothed; drives the marquee and badge

if (enabled) {
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  root.classList.add('motion-ready'); // cancels the CSS fallback timers
  init();
} else {
  root.classList.remove('motion', 'intro-pending');
}

function init() {
  setupSmoothScroll();
  setupVelocity();
  setupFloatBar();
  setupMarquee();
  setupBadge();
  if (finePointer) {
    setupCursor();
    setupMagnetic();
  }

  // The hero's own CSS entrance (.rise) is paused while the intro covers the page.
  const intro = document.querySelector('.intro');
  if (root.classList.contains('intro-pending') && intro) playIntro(intro);
  else root.classList.remove('intro-pending');

  // Measure lines only once the display font has loaded, or the splits are wrong.
  document.fonts.ready.then(() => reveal(document));
}

// ---------- Smooth scroll ----------

function setupSmoothScroll() {
  if (!Lenis) return;
  lenis = new Lenis({ lerp: 0.1, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  // The phone menu locks the page behind it.
  window.addEventListener('dovey:menu', (event) => (event.detail.open ? lenis.stop() : lenis.start()));
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function setupVelocity() {
  ScrollTrigger.create({
    onUpdate: (self) => {
      scrollVelocity = self.getVelocity();
    },
  });
  // Ease the value back to zero when scrolling stops.
  gsap.ticker.add(() => {
    scrollVelocity *= 0.92;
  });
}

// ---------- Reveals ----------

/** Wires up scroll reveals for everything under `scope` (safe to call again for new content). */
export function reveal(scope = document) {
  if (!enabled) return;

  scope.querySelectorAll('[data-reveal="lines"]:not([data-revealed])').forEach((el) => {
    el.dataset.revealed = '';
    if (!SplitText) return gsap.to(el, { opacity: 1 });
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',
      autoSplit: true,
      onSplit: (split) => {
        gsap.set(el, { opacity: 1 });
        return gsap.from(split.lines, {
          yPercent: 110,
          duration: 1.1,
          ease: EASE,
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });

  scope.querySelectorAll('[data-reveal="up"]:not([data-revealed])').forEach((el) => {
    el.dataset.revealed = '';
    gsap.fromTo(el, { opacity: 0, y: 40 }, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: EASE,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  scope.querySelectorAll('[data-reveal="stagger"]:not([data-revealed])').forEach((el) => {
    if (el.getAttribute('aria-busy') === 'true') return; // still loading; its script calls reveal() when ready
    el.dataset.revealed = '';
    gsap.set(el, { opacity: 1 });
    gsap.fromTo(el.children, { opacity: 0, y: 48 }, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: EASE,
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      onStart: () => el.querySelectorAll('[data-count]').forEach(countUp),
    });
  });
}

function countUp(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const state = { value: 0 };
  gsap.to(state, {
    value: target,
    duration: 1.6,
    ease: 'power3.out',
    // Count in whole cedis so the figure never flickers through pesewas.
    onUpdate: () => {
      el.textContent = money(Math.round(state.value / 100) * 100);
    },
  });
}

// ---------- Intro ----------

function playIntro(intro) {
  const letters = intro.querySelectorAll('.intro-word span');
  intro.classList.add('is-playing'); // keeps it visible after intro-pending is dropped
  try { sessionStorage.setItem('dovey:intro', '1'); } catch { /* storage off: intro plays again */ }

  const release = () => {
    root.classList.remove('intro-pending');
    intro.remove();
  };
  // Never keep visitors waiting: on a stalled or very slow device, just open the page.
  const safety = setTimeout(release, 6000);

  gsap.timeline({ onComplete: () => { clearTimeout(safety); release(); } })
    .from(intro.querySelector('.intro-mark'), { scale: 0.6, opacity: 0, duration: 0.8, ease: 'back.out(1.6)' })
    .from(letters, { yPercent: 110, duration: 0.8, ease: EASE, stagger: 0.05 }, '-=0.45')
    .from(intro.querySelector('.intro-sub'), { opacity: 0, y: 10, duration: 0.6 }, '-=0.5')
    .to(intro, { yPercent: -100, duration: 1, ease: 'expo.inOut' }, '+=0.35')
    // Release the page (scrolling, hero entrance) as the curtain lifts.
    .add(() => root.classList.remove('intro-pending'), '-=0.6');
}

// ---------- Marquee & badge (both speed up with scrolling) ----------

function setupMarquee() {
  document.querySelectorAll('.marquee').forEach((marquee) => {
    const track = marquee.querySelector('.marquee-track');
    if (!track) return;
    // A second copy makes the loop seamless; screen readers only hear the first.
    track.append(...[...track.children].map((node) => {
      const copy = node.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      return copy;
    }));
    const loop = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
    gsap.ticker.add(() => {
      const boost = Math.min(Math.abs(scrollVelocity) / 250, 6);
      loop.timeScale(gsap.utils.interpolate(loop.timeScale(), (scrollVelocity < 0 ? -1 : 1) * (1 + boost), 0.1));
    });
  });
}

function setupBadge() {
  document.querySelectorAll('.badge-text').forEach((text) => {
    const spin = gsap.to(text, { rotation: 360, duration: 22, ease: 'none', repeat: -1, transformOrigin: '50% 50%' });
    gsap.ticker.add(() => {
      spin.timeScale(gsap.utils.interpolate(spin.timeScale(), 1 + Math.min(Math.abs(scrollVelocity) / 150, 8), 0.08));
    });
  });
}

// ---------- Floating action bar ----------

function setupFloatBar() {
  const bar = document.querySelector('.float-bar');
  if (!bar) return;
  const footer = document.querySelector('.site-footer');
  const update = () => {
    const past = window.scrollY > window.innerHeight * 0.6;
    const atFooter = footer && footer.getBoundingClientRect().top < window.innerHeight - 40;
    bar.classList.toggle('is-visible', past && !atFooter);
  };
  ScrollTrigger.create({ onUpdate: update });
  update();
}

// ---------- Cursor & magnetic buttons (mouse only) ----------

function setupCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  cursor.append(label);
  document.body.append(cursor);

  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
  let shown = false;

  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    if (!shown) {
      shown = true;
      gsap.set(cursor, { x: event.clientX, y: event.clientY });
      cursor.classList.add('is-visible');
    }
    xTo(event.clientX);
    yTo(event.clientY);
  });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
  document.addEventListener('pointerenter', () => shown && cursor.classList.add('is-visible'));

  document.addEventListener('pointerover', (event) => {
    const target = event.target.closest('a, button, label, [data-cursor]');
    const text = target?.closest('[data-cursor]')?.dataset.cursor ?? '';
    cursor.classList.toggle('is-link', !!target);
    cursor.classList.toggle('has-label', !!text);
    label.textContent = text;
  });
  document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
}

function setupMagnetic() {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (event) => {
      const box = el.getBoundingClientRect();
      xTo((event.clientX - (box.left + box.width / 2)) * 0.3);
      yTo((event.clientY - (box.top + box.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}
