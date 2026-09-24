// Phone menu: a floating Menu button (always reachable, even after scrolling)
// opens a full-screen overlay with large links. Built here, not in each page's
// HTML, so every page shares one menu; without JavaScript the header's normal
// links stay visible instead.
const header = document.querySelector('.site-header .wrap');
const root = document.documentElement;

const LINKS = [
  ['/', 'Home'],
  ['/packages', 'Packages'],
  ['/about', 'About'],
  ['/confirmation', 'My booking'],
];

if (header) {
  const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'menu-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'mobile-menu');
  toggle.innerHTML = '<span class="menu-toggle-lines" aria-hidden="true"><i></i><i></i></span><span class="menu-toggle-label">Menu</span>';

  const menu = document.createElement('div');
  menu.className = 'mobile-menu';
  menu.id = 'mobile-menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.setAttribute('aria-label', 'Menu');
  menu.hidden = true;

  const list = document.createElement('nav');
  list.className = 'mobile-menu-links';
  list.setAttribute('aria-label', 'Main');
  LINKS.forEach(([href, text], i) => {
    const a = document.createElement('a');
    a.href = href;
    a.style.setProperty('--i', i);
    a.innerHTML = `<span class="mobile-menu-index">0${i + 1}</span><span class="mobile-menu-text"></span>`;
    a.querySelector('.mobile-menu-text').textContent = text;
    if (href === here) a.setAttribute('aria-current', 'page');
    list.append(a);
  });

  const foot = document.createElement('div');
  foot.className = 'mobile-menu-foot';
  foot.innerHTML = '<a class="btn btn-accent btn-block" href="/book">Book a date <span class="arrow" aria-hidden="true">→</span></a><p>Where every detail matters.</p>';

  menu.append(list, foot);
  document.body.append(menu, toggle);
  root.classList.add('has-menu');

  let closeTimer;
  function setOpen(open) {
    clearTimeout(closeTimer);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.menu-toggle-label').textContent = open ? 'Close' : 'Menu';
    root.classList.toggle('menu-open', open);
    window.dispatchEvent(new CustomEvent('dovey:menu', { detail: { open } }));
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      list.querySelector('a')?.focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      closeTimer = setTimeout(() => (menu.hidden = true), 600); // after the closing animation
    }
  }

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('menu-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  // Rotating a tablet to desktop width with the menu open: just close it.
  matchMedia('(min-width: 721px)').addEventListener('change', (e) => e.matches && setOpen(false));
}
