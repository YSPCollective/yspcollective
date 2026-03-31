/**
 * YSP Collective — Language Switcher
 * Clean minimal dropdown, no flags, site colours only.
 */
(function() {
  'use strict';

  const LANGS = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'pt', label: 'PT', full: 'Português' },
    { code: 'es', label: 'ES', full: 'Español' }
  ];

  const STORAGE_KEY = 'ysp_lang';

  function getLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
      // First visit — detect browser language
      const browser = (navigator.language || navigator.userLanguage || 'en').toLowerCase().substring(0, 2);
      const supported = ['en', 'pt', 'es'];
      const detected = supported.includes(browser) ? browser : 'en';
      localStorage.setItem(STORAGE_KEY, detected);
      return detected;
    } catch(e) { return 'en'; }
  }

  function setLang(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch(e) {}
  }

  function applyTranslations(lang) {
    if (!window.YSP_TRANSLATIONS) return;
    const t = window.YSP_TRANSLATIONS[lang] || window.YSP_TRANSLATIONS['en'];
    if (!t) return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) {
        if (el.getAttribute('data-i18n-html') === 'true') {
          el.innerHTML = t[key];
        } else {
          el.textContent = t[key];
        }
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key]) el.placeholder = t[key];
    });

    // Update announcement bar language
    const annPt = document.querySelector('.ann-pt');
    const annEn = document.querySelector('.ann-en');
    if (annPt && annEn) {
      annPt.style.display = lang === 'pt' ? '' : 'none';
      annEn.style.display = lang === 'pt' ? 'none' : '';
    }

    document.documentElement.lang = lang;
  }

  function buildSwitcher() {
    const container = document.getElementById('ysp-lang-switcher');
    if (!container) return;

    const currentLang = getLang();
    const current = LANGS.find(l => l.code === currentLang) || LANGS[0];

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      .ysp-lang-wrap {
        position: relative;
      }
      .ysp-lang-trigger {
        background: none;
        border: none;
        cursor: pointer;
        font-family: var(--sans);
        font-size: 0.75rem;
        font-weight: 400;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--grey);
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.3rem 0;
        transition: color 0.25s;
        white-space: nowrap;
      }
      .ysp-lang-trigger:hover { color: var(--accent); }
      .ysp-lang-trigger .ysp-lang-chevron {
        font-size: 0.55rem;
        opacity: 0.6;
        transition: transform 0.2s;
        display: inline-block;
      }
      .ysp-lang-wrap.open .ysp-lang-chevron { transform: rotate(180deg); }
      .ysp-lang-dropdown {
        display: none;
        position: absolute;
        top: calc(100% + 0.6rem);
        right: 0;
        background: var(--white);
        border: 1px solid var(--sand);
        min-width: 120px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        z-index: 2000;
      }
      .ysp-lang-wrap.open .ysp-lang-dropdown { display: block; }
      .ysp-lang-option {
        display: block;
        width: 100%;
        padding: 0.65rem 1rem;
        background: none;
        border: none;
        cursor: pointer;
        font-family: var(--sans);
        font-size: 0.72rem;
        font-weight: 400;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--grey);
        text-align: left;
        transition: color 0.2s, background 0.2s;
        border-bottom: 1px solid var(--sand);
      }
      .ysp-lang-option:last-child { border-bottom: none; }
      .ysp-lang-option:hover { color: var(--black); background: var(--cream); }
      .ysp-lang-option.active { color: var(--accent); }
    `;
    document.head.appendChild(style);

    // Build HTML
    container.innerHTML = `
      <div class="ysp-lang-wrap" id="ysp-lang-wrap">
        <button class="ysp-lang-trigger" id="ysp-lang-trigger" aria-haspopup="true" aria-expanded="false">
          <span id="ysp-lang-current">${current.label}</span>
          <span class="ysp-lang-chevron">▾</span>
        </button>
        <div class="ysp-lang-dropdown" role="menu">
          ${LANGS.map(l => `
            <button class="ysp-lang-option${l.code === currentLang ? ' active' : ''}" data-lang="${l.code}" role="menuitem">
              ${l.label} <span style="opacity:0.5;font-size:0.65rem;margin-left:0.3rem">${l.full}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    const wrap = document.getElementById('ysp-lang-wrap');
    const trigger = document.getElementById('ysp-lang-trigger');
    const currentLabel = document.getElementById('ysp-lang-current');

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      wrap.classList.toggle('open');
      trigger.setAttribute('aria-expanded', !isOpen);
    });

    // Close on outside click
    document.addEventListener('click', () => {
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    });

    // Language selection
    container.querySelectorAll('.ysp-lang-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = btn.dataset.lang;
        setLang(lang);
        applyTranslations(lang);
        currentLabel.textContent = LANGS.find(l => l.code === lang).label;
        container.querySelectorAll('.ysp-lang-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        wrap.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    buildSwitcher();
    applyTranslations(getLang());
  });

  // Expose for external use
  window.YSP_LANG = {
    get: getLang,
    set: (code) => { setLang(code); applyTranslations(code); },
    t: (key, lang) => {
      const l = lang || getLang();
      return (window.YSP_TRANSLATIONS && window.YSP_TRANSLATIONS[l] && window.YSP_TRANSLATIONS[l][key]) || key;
    }
  };

})();
