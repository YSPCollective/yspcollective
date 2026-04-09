/**
 * YSP Collective — Cookie Consent Manager
 * GDPR / ePrivacy compliant · GA4 Consent Mode v2 · Multilingual (EN/PT/ES)
 *
 * LOADING: This script must load AFTER ysp-translations.js and ysp-lang.js
 * GA4 consent defaults are set by a separate inline snippet in <head> (see base.njk)
 *
 * Save to: src/ysp-cookie-consent.js
 */
(function () {
  'use strict';

  const CONSENT_KEY = 'ysp_cookie_consent';
  const CONSENT_VERSION = '1';

  // ── Consent helpers ───────────────────────────────────────────────────────
  function getConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p.version !== CONSENT_VERSION ? null : p;
    } catch (e) { return null; }
  }

  function setConsent(analytics) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      version: CONSENT_VERSION,
      analytics: analytics,
      timestamp: new Date().toISOString()
    }));
  }

  // ── GA4 helpers ───────────────────────────────────────────────────────────
  function activateGA4() {
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }

  function denyGA4() {
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    }
  }

  // ── Translation helper ────────────────────────────────────────────────────
  // By the time this script runs (after ysp-translations.js + ysp-lang.js),
  // both window.YSP_TRANSLATIONS and window.YSP_LANG are guaranteed available.
  function t(key) {
    try {
      if (window.YSP_LANG && typeof window.YSP_LANG.t === 'function') {
        return window.YSP_LANG.t(key);
      }
      if (window.YSP_TRANSLATIONS) {
        const lang = (function () {
          try { return localStorage.getItem('ysp_lang') || 'en'; } catch (e) { return 'en'; }
        })();
        const tr = window.YSP_TRANSLATIONS[lang] || window.YSP_TRANSLATIONS['en'];
        if (tr && tr[key]) return tr[key];
      }
    } catch (e) {}
    // Hard-coded EN fallbacks — should never be needed given load order
    const fallbacks = {
      cookie_title: 'We use cookies',
      cookie_desc: 'We use essential cookies to make our site work, and optional analytics cookies (Google Analytics) to understand how visitors use it. Read our <a href="/privacy-policy.html">Privacy Policy</a> for details.',
      cookie_accept: 'Accept All',
      cookie_reject: 'Essential Only',
      cookie_manage: 'Manage',
      cookie_modal_title: 'Cookie Preferences',
      cookie_modal_intro: 'Manage your preferences below. Essential cookies are always active. You can opt in or out of analytics cookies at any time.',
      cookie_cat_essential: 'Essential Cookies',
      cookie_cat_essential_desc: 'Required for the site to function — checkout, sessions, security. These cannot be disabled.',
      cookie_cat_analytics: 'Analytics Cookies',
      cookie_cat_analytics_desc: 'Google Analytics (GA4) — helps us understand how visitors use the site. No personal data is sold to third parties.',
      cookie_save: 'Save Preferences',
      cookie_accept_all: 'Accept All',
      cookie_settings: 'Cookie Settings'
    };
    return fallbacks[key] || key;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ysp-cookie-styles')) return;
    const css = `
      #ysp-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#1a1916;border-top:1px solid rgba(156,123,86,0.3);padding:1.5rem 3.5rem;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;transform:translateY(100%);transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);font-family:'Outfit',-apple-system,sans-serif;}
      #ysp-cookie-banner.ysp-visible{transform:translateY(0);}
      .ysp-cookie-text{flex:1;min-width:240px;}
      .ysp-cookie-title{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:400;color:#faf8f5;margin-bottom:0.4rem;}
      .ysp-cookie-desc{font-size:0.78rem;font-weight:300;color:rgba(255,255,255,0.5);line-height:1.6;max-width:560px;}
      .ysp-cookie-desc a{color:#c8a87a;text-decoration:none;border-bottom:1px solid rgba(200,168,122,0.35);}
      .ysp-cookie-desc a:hover{border-color:#c8a87a;}
      .ysp-cookie-actions{display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;flex-shrink:0;}
      .ysp-btn{padding:0.6rem 1.5rem;font-family:'Outfit',-apple-system,sans-serif;font-size:0.68rem;font-weight:400;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;border:none;transition:all 0.25s;white-space:nowrap;}
      .ysp-btn-accept{background:#9c7b56;color:#faf8f5;}
      .ysp-btn-accept:hover{background:#c8a87a;transform:translateY(-1px);}
      .ysp-btn-reject{background:transparent;color:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.12);}
      .ysp-btn-reject:hover{color:rgba(255,255,255,0.75);border-color:rgba(255,255,255,0.3);}
      .ysp-btn-manage{background:transparent;color:rgba(255,255,255,0.35);font-size:0.65rem;padding:0.5rem 0.8rem;border:none;text-decoration:underline;text-underline-offset:2px;letter-spacing:0.08em;cursor:pointer;font-family:'Outfit',-apple-system,sans-serif;}
      .ysp-btn-manage:hover{color:rgba(255,255,255,0.65);}
      #ysp-cookie-modal{display:none;position:fixed;inset:0;z-index:100000;background:rgba(26,25,22,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);align-items:center;justify-content:center;padding:1.5rem;}
      #ysp-cookie-modal.ysp-modal-open{display:flex;}
      .ysp-modal-box{background:#faf8f5;max-width:520px;width:100%;padding:2.5rem;position:relative;}
      .ysp-modal-close{position:absolute;top:1.2rem;right:1.5rem;background:none;border:none;cursor:pointer;font-size:1.1rem;color:#8a847a;transition:color 0.2s;padding:0.2rem 0.5rem;}
      .ysp-modal-close:hover{color:#1a1916;}
      .ysp-modal-title{font-family:'Playfair Display',Georgia,serif;font-size:1.4rem;font-weight:300;color:#1a1916;margin-bottom:0.6rem;}
      .ysp-modal-intro{font-size:0.82rem;color:#8a847a;line-height:1.7;margin-bottom:2rem;}
      .ysp-cat{border-top:1px solid #e6dfd4;padding:1.2rem 0;display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem;}
      .ysp-cat:last-of-type{border-bottom:1px solid #e6dfd4;margin-bottom:2rem;}
      .ysp-cat-name{font-size:0.7rem;font-weight:400;letter-spacing:0.12em;text-transform:uppercase;color:#1a1916;margin-bottom:0.3rem;font-family:'Outfit',-apple-system,sans-serif;}
      .ysp-cat-desc{font-size:0.78rem;color:#8a847a;line-height:1.5;max-width:320px;}
      .ysp-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
      .ysp-toggle input{opacity:0;width:0;height:0;position:absolute;}
      .ysp-toggle-track{position:absolute;inset:0;background:#d4cdc4;cursor:pointer;border-radius:22px;transition:background 0.3s;}
      .ysp-toggle input:checked+.ysp-toggle-track{background:#9c7b56;}
      .ysp-toggle-track::before{content:'';position:absolute;height:16px;width:16px;left:3px;top:3px;background:white;border-radius:50%;transition:transform 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.15);}
      .ysp-toggle input:checked+.ysp-toggle-track::before{transform:translateX(18px);}
      .ysp-toggle input:disabled+.ysp-toggle-track{cursor:not-allowed;opacity:0.6;}
      .ysp-modal-actions{display:flex;gap:0.75rem;justify-content:flex-end;flex-wrap:wrap;}
      .ysp-modal-actions .ysp-btn{padding:0.7rem 1.6rem;}
      .ysp-btn-save{background:#9c7b56;color:#faf8f5;}
      .ysp-btn-save:hover{background:#1a1916;}
      .ysp-btn-accept-all{background:#1a1916;color:#faf8f5;}
      .ysp-btn-accept-all:hover{background:#9c7b56;}
      .ysp-cookie-settings-btn{background:none;border:none;cursor:pointer;font-family:'Outfit',-apple-system,sans-serif;font-size:0.85rem;color:rgba(255,255,255,0.35);transition:color 0.25s;padding:0;display:block;margin-bottom:0.6rem;text-align:left;}
      .ysp-cookie-settings-btn:hover{color:#c8a87a;}
      @media(max-width:768px){
        #ysp-cookie-banner{padding:1.25rem 1.5rem;flex-direction:column;align-items:flex-start;gap:1.25rem;}
        .ysp-cookie-actions{width:100%;}
        .ysp-modal-box{padding:2rem 1.5rem;}
      }
    `;
    const s = document.createElement('style');
    s.id = 'ysp-cookie-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── Build modal ───────────────────────────────────────────────────────────
  function buildModal() {
    const m = document.createElement('div');
    m.id = 'ysp-cookie-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = `
      <div class="ysp-modal-box">
        <button class="ysp-modal-close" id="ysp-modal-close" aria-label="Close">✕</button>
        <div class="ysp-modal-title">${t('cookie_modal_title')}</div>
        <div class="ysp-modal-intro">${t('cookie_modal_intro')}</div>
        <div class="ysp-cat">
          <div>
            <div class="ysp-cat-name">${t('cookie_cat_essential')}</div>
            <div class="ysp-cat-desc">${t('cookie_cat_essential_desc')}</div>
          </div>
          <label class="ysp-toggle">
            <input type="checkbox" checked disabled>
            <span class="ysp-toggle-track"></span>
          </label>
        </div>
        <div class="ysp-cat">
          <div>
            <div class="ysp-cat-name">${t('cookie_cat_analytics')}</div>
            <div class="ysp-cat-desc">${t('cookie_cat_analytics_desc')}</div>
          </div>
          <label class="ysp-toggle">
            <input type="checkbox" id="ysp-analytics-toggle">
            <span class="ysp-toggle-track"></span>
          </label>
        </div>
        <div class="ysp-modal-actions">
          <button class="ysp-btn ysp-btn-save" id="ysp-save-prefs">${t('cookie_save')}</button>
          <button class="ysp-btn ysp-btn-accept-all" id="ysp-accept-all-modal">${t('cookie_accept_all')}</button>
        </div>
      </div>`;
    return m;
  }

  function attachModalEvents(modal, onSave) {
    document.getElementById('ysp-modal-close').addEventListener('click', function () {
      modal.classList.remove('ysp-modal-open');
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('ysp-modal-open');
    });
    document.getElementById('ysp-save-prefs').addEventListener('click', function () {
      const allow = document.getElementById('ysp-analytics-toggle').checked;
      setConsent(allow);
      allow ? activateGA4() : denyGA4();
      modal.classList.remove('ysp-modal-open');
      if (onSave) onSave();
    });
    document.getElementById('ysp-accept-all-modal').addEventListener('click', function () {
      document.getElementById('ysp-analytics-toggle').checked = true;
      setConsent(true);
      activateGA4();
      modal.classList.remove('ysp-modal-open');
      if (onSave) onSave();
    });
  }

  function openModal(onSave) {
    injectStyles();
    let modal = document.getElementById('ysp-cookie-modal');
    if (!modal) {
      modal = buildModal();
      document.body.appendChild(modal);
      attachModalEvents(modal, onSave);
    }
    const c = getConsent();
    const toggle = document.getElementById('ysp-analytics-toggle');
    if (toggle) toggle.checked = c ? c.analytics : false;
    modal.classList.add('ysp-modal-open');
  }

  function hideBanner(banner) {
    banner.classList.remove('ysp-visible');
    setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 600);
  }

  // ── Show banner ───────────────────────────────────────────────────────────
  function showBanner() {
    injectStyles();
    const banner = document.createElement('div');
    banner.id = 'ysp-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.innerHTML = `
      <div class="ysp-cookie-text">
        <div class="ysp-cookie-title">${t('cookie_title')}</div>
        <div class="ysp-cookie-desc">${t('cookie_desc')}</div>
      </div>
      <div class="ysp-cookie-actions">
        <button class="ysp-btn ysp-btn-reject" id="ysp-reject-all">${t('cookie_reject')}</button>
        <button class="ysp-btn ysp-btn-accept" id="ysp-accept-all">${t('cookie_accept')}</button>
        <button class="ysp-btn-manage" id="ysp-manage">${t('cookie_manage')}</button>
      </div>`;
    document.body.appendChild(banner);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { banner.classList.add('ysp-visible'); });
    });

    document.getElementById('ysp-accept-all').addEventListener('click', function () {
      setConsent(true); activateGA4(); hideBanner(banner);
    });
    document.getElementById('ysp-reject-all').addEventListener('click', function () {
      setConsent(false); denyGA4(); hideBanner(banner);
    });
    document.getElementById('ysp-manage').addEventListener('click', function () {
      openModal(function () { hideBanner(banner); });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window.yspOpenCookieSettings = function () { openModal(null); };

  // ── Update footer button label when language switches ─────────────────────
  (function hookLangSwitcher() {
    const originalSet = window.YSP_LANG && window.YSP_LANG.set;
    if (originalSet) {
      window.YSP_LANG.set = function (code) {
        originalSet(code);
        document.querySelectorAll('.ysp-cookie-settings-btn').forEach(function (btn) {
          btn.textContent = t('cookie_settings');
        });
      };
    }
    document.querySelectorAll('.ysp-cookie-settings-btn').forEach(function (btn) {
      btn.textContent = t('cookie_settings');
    });
  })();

  // ── Init — runs immediately (script is at bottom of body, after translations) ──
  const c = getConsent();
  if (c === null) {
    showBanner();
  } else if (c.analytics === true) {
    activateGA4();
  }
  // c.analytics === false: GA4 stays denied via the <head> defaults

})();
