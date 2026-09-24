// Runs in <head>, before first paint (a blocking script, deliberately tiny).
// Turns on the motion styles unless the visitor prefers reduced motion, and on the
// homepage schedules the intro once per browser session.
(function () {
  var root = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('motion');
  try {
    if (root.hasAttribute('data-intro') && !sessionStorage.getItem('dovey:intro')) {
      root.classList.add('intro-pending');
    }
  } catch (e) {
    /* storage blocked: skip the intro */
  }
})();
