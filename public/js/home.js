import { api } from './common.js';
import { hydrateOccasionIcons } from './icons.js';

// Before anything awaits, so the marquee is complete when motion.js duplicates it.
hydrateOccasionIcons();

try {
  const { depositPercent } = await api('/api/catalog');
  document.querySelectorAll('[data-deposit]').forEach((el) => (el.textContent = `${depositPercent}%`));
} catch {
  /* the default text is already correct for the standard deposit */
}
