/**
 * YSP Collective — Language Switcher
 * Handles EN / PT / ES translation across all pages
 */

(function() {
  'use strict';

  const SUPPORTED = ['en', 'pt', 'es'];
  const DEFAULT = 'en';
  const STORAGE_KEY = 'ysp_lang';

  // ── Get current language ──────────────────────────────────────────
  function getLang() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
    // Auto-detect from browser
    const browser = (navigator.language || '').toLowerCase().slice(0, 2);
    if (browser === 'pt') return 'pt';
    if (browser === 'es') return 'es';
    return DEFAULT;
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
    updateSwitcher(lang);
    document.documentElement.lang = lang;
  }

  // ── Get translation string ────────────────────────────────────────
  function t(key, lang) {
    const translations = window.YSP_TRANSLATIONS;
    if (!translations) return '';
    const langObj = translations[lang] || translations[DEFAULT];
    const fallback = translations[DEFAULT];
    return langObj[key] || fallback[key] || key;
  }

  // ── Apply all translations to page ───────────────────────────────
  function applyTranslations(lang) {
    // Find all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key, lang);
      if (el.getAttribute('data-i18n-html') === 'true') {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key, lang);
    });

    // Dispatch event so other scripts can react
    document.dispatchEvent(new CustomEvent('ysp:langchange', { detail: { lang } }));
  }

  // ── Build the language switcher UI ───────────────────────────────
  function buildSwitcher() {
    const switcher = document.getElementById('ysp-lang-switcher');
    if (!switcher) return;

    const langs = [
      { code: 'en', flag: '🇬🇧', label: 'EN' },
      { code: 'pt', flag: '🇵🇹', label: 'PT' },
      { code: 'es', flag: '🇪🇸', label: 'ES' }
    ];

    switcher.innerHTML = '';
    langs.forEach(l => {
      const btn = document.createElement('button');
      btn.className = 'lang-btn';
      btn.setAttribute('data-lang', l.code);
      btn.setAttribute('aria-label', `Switch to ${l.label}`);
      btn.innerHTML = `<span class="lang-flag">${l.flag}</span><span class="lang-code">${l.label}</span>`;
      btn.addEventListener('click', () => setLang(l.code));
      switcher.appendChild(btn);
    });
  }

  function updateSwitcher(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    if (!window.YSP_TRANSLATIONS) {
      console.warn('YSP: Translations not loaded');
      return;
    }
    buildSwitcher();
    const lang = getLang();
    applyTranslations(lang);
    updateSwitcher(lang);
    document.documentElement.lang = lang;
  }

  // Wait for translations to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-apply on slide change (carousel may reset content)
  document.addEventListener('ysp:slidechange', () => {
    applyTranslations(getLang());
  });

  // Also re-apply after a short delay to catch any late renders
  window.addEventListener('load', () => {
    setTimeout(() => applyTranslations(getLang()), 300);
  });

  // Expose globally
  window.YSP_LANG = { get: getLang, set: setLang, t };

})();
