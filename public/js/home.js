import { api } from './common.js';

try {
  const { depositPercent } = await api('/api/catalog');
  document.querySelectorAll('[data-deposit]').forEach((el) => (el.textContent = `${depositPercent}%`));
} catch {
  /* the default text is already correct for the standard deposit */
}
