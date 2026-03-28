/**
 * YSP Collective — Image Error Handler
 * Fixes NS_BINDING_ABORTED errors and broken product images.
 *
 * Include this in your base layout just before </body>.
 * Works on all pages automatically.
 */

(function () {
  'use strict';

  // Fallback placeholder — a lightweight inline SVG data URI
  // Shows the YSP accent colour with a subtle ✦ icon
  const FALLBACK = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%23f3efe8'/%3E%3Ctext x='200' y='265' font-family='Georgia%2Cserif' font-size='48' fill='%23c8a87a' text-anchor='middle' opacity='0.4'%3E%E2%9C%A6%3C/text%3E%3C/svg%3E`;

  function fixImage(img) {
    if (!img.complete || img.naturalWidth === 0) {
      img.src = FALLBACK;
      img.alt = '';
      img.style.objectFit = 'contain';
      img.style.padding = '1.5rem';
    }
  }

  function attachHandlers() {
    document.querySelectorAll('img[src]').forEach(img => {
      // Already broken
      if (img.complete && img.naturalWidth === 0) {
        fixImage(img);
        return;
      }
      // Error handler for future failures
      img.addEventListener('error', () => fixImage(img), { once: true });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }

  // Also catch any images added after page load (e.g. cart drawer)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') fixImage(node);
        node.querySelectorAll?.('img[src]').forEach(fixImage);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

})();
