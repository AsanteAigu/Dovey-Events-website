// Line icons for the occasions, drawn on a 24×24 grid with a 1.5px stroke in the
// current text colour, so they sit naturally next to the site's type.
const ICONS = {
  // Two interlocking rings, a diamond on the first.
  wedding: `
    <circle cx="9" cy="14.5" r="5.5"/>
    <circle cx="15" cy="14.5" r="5.5"/>
    <path d="M7.4 6.6 9 4.5l1.6 2.1L9 9Z"/>`,
  // A small bouquet, stems gathered in a wrap.
  bridal: `
    <circle cx="12" cy="5.5" r="2.5"/>
    <circle cx="7.5" cy="8" r="2.5"/>
    <circle cx="16.5" cy="8" r="2.5"/>
    <path d="M8.5 10.3 11 15M15.5 10.3 13 15M12 8v7"/>
    <path d="M9 14.5h6l-1.6 7h-2.8Z"/>`,
  // A two-tier cake with one lit candle.
  birthday: `
    <path d="M12 3.2c1 1.1 1 2-.001 2.8-1-.8-1-1.7.001-2.8Z"/>
    <path d="M12 6.5v2.5"/>
    <rect x="7.5" y="9" width="9" height="4.5" rx="1"/>
    <rect x="4.5" y="13.5" width="15" height="6.5" rx="1"/>
    <path d="M4.5 16.2c1.25 1 2.5 1 3.75 0s2.5-1 3.75 0 2.5 1 3.75 0 2.5-1 3.75 0"/>
    <path d="M3 20h18"/>`,
  // A dove in flight: head and beak to the right, wing swept up, tail fanned.
  christening: `
    <path d="M20.5 8.6 18.6 8c-.5-1.2-1.6-2-3-2-1.9 0-3.2 1.4-3.6 3.3l-.3 1.3c-.5 2.3-2.5 3.9-4.9 3.9H3.5l2.2 1.9-1 2.6 3.3-1.5c.9.3 1.9.4 2.9.4 4.2 0 7.3-3 7.4-7.1Z"/>
    <path d="M12.4 9.9C11.3 6.6 8.9 4.3 5.4 3.6c.2 3.6 2.1 6.4 5.3 7.6"/>
    <path d="M8.4 6.9c.6 1.2 1.4 2.1 2.5 2.8"/>
    <circle cx="16.3" cy="8.4" r=".55" fill="currentColor" stroke="none"/>`,
  // A memorial candle.
  funeral: `
    <path d="M12 2.8c1.5 1.6 1.7 3.2 0 4.7-1.7-1.5-1.5-3.1 0-4.7Z"/>
    <path d="M12 7.5v2"/>
    <rect x="8.5" y="9.5" width="7" height="10.5" rx="1"/>
    <path d="M6 20.5h12"/>`,
  // A sparkle, for anything else.
  other: `
    <path d="M11 3.5 12.9 9l5.6 2-5.6 2L11 18.5 9.1 13l-5.6-2 5.6-2Z"/>
    <path d="m18.5 15 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>`,
};

/** Returns an <svg> icon for an occasion id (decorative: hidden from screen readers). */
export function occasionIcon(id, className = 'occasion-icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  svg.innerHTML = ICONS[id] ?? ICONS.other;
  return svg;
}

/** Fills every <span data-occasion-icon="id"> placeholder on the page. */
export function hydrateOccasionIcons(scope = document) {
  scope.querySelectorAll('[data-occasion-icon]').forEach((slot) => {
    if (!slot.firstChild) slot.append(occasionIcon(slot.dataset.occasionIcon));
  });
}
