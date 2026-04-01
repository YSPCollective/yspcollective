/**
 * YSP Collective — Account & Auth Manager
 * Loaded globally via base.njk
 * Handles: session, auth modals, favourites, nav state
 */

const YSP_PROXY = 'https://ysp-ai-proxy.rapid-shadow-439d.workers.dev';

window.YSPAccount = (function () {

  // ── Session ───────────────────────────────────────────────────────────────
  function getToken() {
    try { return localStorage.getItem('ysp_token'); } catch (_) { return null; }
  }
  function setToken(t) {
    try { localStorage.setItem('ysp_token', t); } catch (_) {}
  }
  function clearToken() {
    try {
      localStorage.removeItem('ysp_token');
      localStorage.removeItem('ysp_user');
    } catch (_) {}
  }
  function getUser() {
    try {
      const u = localStorage.getItem('ysp_user');
      return u ? JSON.parse(u) : null;
    } catch (_) { return null; }
  }
  function setUser(u) {
    try { localStorage.setItem('ysp_user', JSON.stringify(u)); } catch (_) {}
  }

  function authHeaders() {
    const t = getToken();
    return t ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
             : { 'Content-Type': 'application/json' };
  }

  // ── API helpers ───────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(YSP_PROXY + path, opts);
    return res.json();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function register(email, password, firstName, lastName) {
    const data = await api('POST', '/auth/register', { email, password, firstName, lastName });
    if (data.token) { setToken(data.token); setUser(data.user); updateNavState(); }
    return data;
  }

  async function login(email, password) {
    const data = await api('POST', '/auth/login', { email, password });
    if (data.token) { setToken(data.token); setUser(data.user); updateNavState(); }
    return data;
  }

  async function logout() {
    await api('POST', '/auth/logout');
    clearToken();
    updateNavState();
    if (window.location.pathname.includes('/account')) {
      window.location.href = '/';
    }
  }

  async function verifySession() {
    const token = getToken();
    if (!token) return null;
    const data = await api('GET', '/auth/me');
    if (data.error) { clearToken(); return null; }
    setUser(data);
    updateNavState();
    return data;
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  async function saveProfile(profileData) {
    return api('POST', '/profile/save', profileData);
  }

  async function getProfile() {
    return api('GET', '/profile');
  }

  // ── Favourites ────────────────────────────────────────────────────────────
  async function toggleFavourite(productData) {
    if (!getToken()) {
      showAuthModal('login', 'Sign in to save favourites');
      return null;
    }
    const data = await api('POST', '/favourites/toggle', productData);
    updateFavouriteButtons(productData.slug, data.action === 'added');
    return data;
  }

  async function getFavourites() {
    if (!getToken()) return { favourites: [] };
    return api('GET', '/favourites');
  }

  function updateFavouriteButtons(slug, isActive) {
    document.querySelectorAll(`[data-fav-slug="${slug}"]`).forEach(btn => {
      btn.classList.toggle('is-favourite', isActive);
      btn.setAttribute('aria-label', isActive ? 'Remove from favourites' : 'Add to favourites');
    });
  }

  // ── Nav state ─────────────────────────────────────────────────────────────
  function updateNavState() {
    const user = getUser();
    const accountLinks = document.querySelectorAll('.ysp-account-link');
    const loginButtons = document.querySelectorAll('.ysp-login-btn, [data-action="login"]');
    const accountNameEls = document.querySelectorAll('.ysp-account-name');

    if (user) {
      accountLinks.forEach(el => { el.style.display = ''; el.href = '/account.html'; });
      loginButtons.forEach(el => el.style.display = 'none');
      accountNameEls.forEach(el => { el.textContent = user.firstName; });
    } else {
      accountLinks.forEach(el => el.style.display = 'none');
      loginButtons.forEach(el => { el.style.display = ''; });
    }
  }

  // ── Auth Modal ────────────────────────────────────────────────────────────
  function showAuthModal(mode = 'login', message = '') {
    const existing = document.getElementById('ysp-auth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ysp-auth-modal';
    modal.innerHTML = `
      <div class="ysp-modal-backdrop"></div>
      <div class="ysp-modal-box" role="dialog" aria-modal="true">
        <button class="ysp-modal-close" aria-label="Close">✕</button>
        ${message ? `<p class="ysp-modal-message">${message}</p>` : ''}
        <div class="ysp-modal-tabs">
          <button class="ysp-tab ${mode === 'login' ? 'active' : ''}" data-tab="login">Sign In</button>
          <button class="ysp-tab ${mode === 'register' ? 'active' : ''}" data-tab="register">Create Account</button>
        </div>

        <!-- Login form -->
        <div class="ysp-tab-panel ${mode === 'login' ? 'active' : ''}" id="ysp-login-panel">
          <div class="ysp-form-group">
            <label>Email</label>
            <input type="email" id="ysp-login-email" placeholder="your@email.com" autocomplete="email">
          </div>
          <div class="ysp-form-group">
            <label>Password</label>
            <input type="password" id="ysp-login-password" placeholder="Password" autocomplete="current-password">
          </div>
          <div class="ysp-form-error" id="ysp-login-error"></div>
          <button class="ysp-btn-primary" id="ysp-login-submit">Sign In</button>
          <p class="ysp-form-footer"><a href="#" id="ysp-forgot-link">Forgot password?</a></p>
        </div>

        <!-- Register form -->
        <div class="ysp-tab-panel ${mode === 'register' ? 'active' : ''}" id="ysp-register-panel">
          <div class="ysp-form-row">
            <div class="ysp-form-group">
              <label>First Name</label>
              <input type="text" id="ysp-reg-first" placeholder="First name" autocomplete="given-name">
            </div>
            <div class="ysp-form-group">
              <label>Last Name</label>
              <input type="text" id="ysp-reg-last" placeholder="Last name" autocomplete="family-name">
            </div>
          </div>
          <div class="ysp-form-group">
            <label>Email</label>
            <input type="email" id="ysp-reg-email" placeholder="your@email.com" autocomplete="email">
          </div>
          <div class="ysp-form-group">
            <label>Password</label>
            <input type="password" id="ysp-reg-password" placeholder="Minimum 8 characters" autocomplete="new-password">
          </div>
          <div class="ysp-form-error" id="ysp-reg-error"></div>
          <button class="ysp-btn-primary" id="ysp-reg-submit">Create Account</button>
          <p class="ysp-form-footer">By creating an account you agree to our <a href="/privacy-policy.html">Privacy Policy</a>.</p>
        </div>
      </div>
    `;

    injectModalStyles();
    document.body.appendChild(modal);

    // Tab switching
    modal.querySelectorAll('.ysp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.ysp-tab, .ysp-tab-panel').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelector(`#ysp-${tab.dataset.tab}-panel`).classList.add('active');
      });
    });

    // Close
    const close = () => modal.remove();
    modal.querySelector('.ysp-modal-close').addEventListener('click', close);
    modal.querySelector('.ysp-modal-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });

    // Login submit
    modal.querySelector('#ysp-login-submit').addEventListener('click', async () => {
      const btn = modal.querySelector('#ysp-login-submit');
      const errEl = modal.querySelector('#ysp-login-error');
      const email = modal.querySelector('#ysp-login-email').value.trim();
      const password = modal.querySelector('#ysp-login-password').value;
      errEl.textContent = '';
      btn.textContent = 'Signing in…';
      btn.disabled = true;
      const result = await login(email, password);
      if (result.error) {
        errEl.textContent = result.error;
        btn.textContent = 'Sign In';
        btn.disabled = false;
      } else {
        close();
        // Show Q&A if profile not complete
        if (!result.user?.profileComplete) {
          setTimeout(() => showProfileQA(result.user), 400);
        }
      }
    });

    // Register submit
    modal.querySelector('#ysp-reg-submit').addEventListener('click', async () => {
      const btn = modal.querySelector('#ysp-reg-submit');
      const errEl = modal.querySelector('#ysp-reg-error');
      const email = modal.querySelector('#ysp-reg-email').value.trim();
      const password = modal.querySelector('#ysp-reg-password').value;
      const firstName = modal.querySelector('#ysp-reg-first').value.trim();
      const lastName = modal.querySelector('#ysp-reg-last').value.trim();
      errEl.textContent = '';
      btn.textContent = 'Creating account…';
      btn.disabled = true;
      const result = await register(email, password, firstName, lastName);
      if (result.error) {
        errEl.textContent = result.error;
        btn.textContent = 'Create Account';
        btn.disabled = false;
      } else {
        close();
        setTimeout(() => showProfileQA(result.user), 400);
      }
    });

    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector(`#ysp-${mode}-panel input`);
      if (firstInput) firstInput.focus();
    }, 100);
  }

  // ── Profile Q&A ───────────────────────────────────────────────────────────
  function showProfileQA(user) {
    const existing = document.getElementById('ysp-qa-modal');
    if (existing) existing.remove();

    const firstName = user?.firstName || 'there';

    // Q&A flow state
    let step = 0;
    let interests = null; // 'fragrance' | 'beauty' | 'both'
    const fragrancePrefs = { scents: [], occasions: [], gender: null, budget: null };
    const beautyPrefs = { skinType: [], concerns: [], budget: null };

    const steps = {
      welcome: {
        question: `Welcome, ${firstName}! Let's personalise your experience.`,
        sub: 'What are you most interested in?',
        options: [
          { label: '🌹 Fragrance', value: 'fragrance' },
          { label: '✨ Beauty & Skincare', value: 'beauty' },
          { label: '💛 Both', value: 'both' },
        ],
        multi: false,
      },
      // Fragrance steps
      frag_scents: {
        question: 'Which scent families appeal to you?',
        sub: 'Select all that apply',
        options: [
          { label: 'Oud & Amber', value: 'oud-amber' },
          { label: 'Fresh & Clean', value: 'fresh' },
          { label: 'Floral', value: 'floral' },
          { label: 'Woody & Earthy', value: 'woody' },
          { label: 'Sweet & Gourmand', value: 'gourmand' },
        ],
        multi: true,
      },
      frag_occasion: {
        question: 'When do you wear fragrance?',
        sub: 'Select all that apply',
        options: [
          { label: 'Daily', value: 'daily' },
          { label: 'Work', value: 'work' },
          { label: 'Evening', value: 'evening' },
          { label: 'Special Occasions', value: 'special' },
        ],
        multi: true,
      },
      frag_gender: {
        question: 'What\'s your preference?',
        sub: 'Choose one',
        options: [
          { label: 'Men\'s', value: 'mens' },
          { label: 'Women\'s', value: 'womens' },
          { label: 'Unisex', value: 'unisex' },
        ],
        multi: false,
      },
      frag_budget: {
        question: 'Budget per bottle?',
        sub: 'Choose one',
        options: [
          { label: 'Under €30', value: 'under-30' },
          { label: '€30–60', value: '30-60' },
          { label: '€60–100', value: '60-100' },
          { label: 'No limit', value: 'no-limit' },
        ],
        multi: false,
      },
      // Beauty steps
      beauty_skin: {
        question: 'What\'s your skin type?',
        sub: 'Select all that apply',
        options: [
          { label: 'Oily', value: 'oily' },
          { label: 'Dry', value: 'dry' },
          { label: 'Combination', value: 'combination' },
          { label: 'Sensitive', value: 'sensitive' },
          { label: 'Normal', value: 'normal' },
        ],
        multi: true,
      },
      beauty_concerns: {
        question: 'Main skin concerns?',
        sub: 'Select all that apply',
        options: [
          { label: 'Hydration', value: 'hydration' },
          { label: 'Anti-ageing', value: 'anti-ageing' },
          { label: 'Brightening', value: 'brightening' },
          { label: 'Acne & Blemishes', value: 'acne' },
          { label: 'Sun Protection', value: 'spf' },
        ],
        multi: true,
      },
      beauty_budget: {
        question: 'Budget per product?',
        sub: 'Choose one',
        options: [
          { label: 'Under €20', value: 'under-20' },
          { label: '€20–40', value: '20-40' },
          { label: '€40+', value: '40-plus' },
          { label: 'No limit', value: 'no-limit' },
        ],
        multi: false,
      },
    };

    function getStepOrder() {
      const order = ['welcome'];
      if (interests === 'fragrance' || interests === 'both') {
        order.push('frag_scents', 'frag_occasion', 'frag_gender', 'frag_budget');
      }
      if (interests === 'beauty' || interests === 'both') {
        order.push('beauty_skin', 'beauty_concerns', 'beauty_budget');
      }
      return order;
    }

    let selected = [];

    function renderStep() {
      const order = getStepOrder();
      const key = order[step];
      const cfg = steps[key];
      selected = [];

      const totalSteps = order.length;
      const progress = Math.round((step / (totalSteps - 1)) * 100);

      modal.querySelector('.ysp-qa-progress-bar').style.width = `${progress}%`;
      modal.querySelector('.ysp-qa-question').textContent = cfg.question;
      modal.querySelector('.ysp-qa-sub').textContent = cfg.sub || '';

      const optionsEl = modal.querySelector('.ysp-qa-options');
      optionsEl.innerHTML = '';
      cfg.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'ysp-qa-option';
        btn.textContent = opt.label;
        btn.dataset.value = opt.value;
        btn.addEventListener('click', () => {
          if (cfg.multi) {
            btn.classList.toggle('selected');
            const val = opt.value;
            const idx = selected.indexOf(val);
            if (idx > -1) selected.splice(idx, 1);
            else selected.push(val);
            modal.querySelector('.ysp-qa-next').disabled = selected.length === 0;
          } else {
            optionsEl.querySelectorAll('.ysp-qa-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selected = [opt.value];
            modal.querySelector('.ysp-qa-next').disabled = false;
          }
        });
        optionsEl.appendChild(btn);
      });

      const nextBtn = modal.querySelector('.ysp-qa-next');
      nextBtn.disabled = true;
      nextBtn.textContent = step === order.length - 1 ? 'Get my recommendations →' : 'Next →';

      const backBtn = modal.querySelector('.ysp-qa-back');
      backBtn.style.visibility = step > 0 ? 'visible' : 'hidden';
    }

    function saveStepData(key) {
      switch (key) {
        case 'welcome':       interests = selected[0]; break;
        case 'frag_scents':  fragrancePrefs.scents = selected; break;
        case 'frag_occasion':fragrancePrefs.occasions = selected; break;
        case 'frag_gender':  fragrancePrefs.gender = selected[0]; break;
        case 'frag_budget':  fragrancePrefs.budget = selected[0]; break;
        case 'beauty_skin':   beautyPrefs.skinType = selected; break;
        case 'beauty_concerns':beautyPrefs.concerns = selected; break;
        case 'beauty_budget': beautyPrefs.budget = selected[0]; break;
      }
    }

    const modal = document.createElement('div');
    modal.id = 'ysp-qa-modal';
    modal.innerHTML = `
      <div class="ysp-modal-backdrop"></div>
      <div class="ysp-modal-box ysp-qa-box" role="dialog" aria-modal="true">
        <div class="ysp-qa-progress"><div class="ysp-qa-progress-bar"></div></div>
        <h3 class="ysp-qa-question"></h3>
        <p class="ysp-qa-sub"></p>
        <div class="ysp-qa-options"></div>
        <div class="ysp-qa-actions">
          <button class="ysp-qa-back">← Back</button>
          <button class="ysp-qa-next" disabled>Next →</button>
        </div>
        <p class="ysp-qa-skip"><a href="#" id="ysp-qa-skip-link">Skip for now</a></p>
      </div>
    `;

    injectModalStyles();
    document.body.appendChild(modal);
    renderStep();

    modal.querySelector('.ysp-qa-next').addEventListener('click', async () => {
      const order = getStepOrder();
      const key = order[step];
      saveStepData(key);
      // If this was the welcome step, interests is now set — recalculate order
      const newOrder = getStepOrder();
      step++;
      if (step >= newOrder.length) {
        await finishQA();
      } else {
        renderStep();
      }
    });

    modal.querySelector('.ysp-qa-back').addEventListener('click', () => {
      if (step > 0) { step--; renderStep(); }
    });

    modal.querySelector('#ysp-qa-skip-link').addEventListener('click', e => {
      e.preventDefault();
      modal.remove();
    });

    modal.querySelector('.ysp-modal-backdrop').addEventListener('click', () => modal.remove());

    async function finishQA() {
      const nextBtn = modal.querySelector('.ysp-qa-next');
      nextBtn.textContent = 'Saving…';
      nextBtn.disabled = true;

      const profileData = {
        interests,
        fragrancePrefs: (interests === 'fragrance' || interests === 'both') ? fragrancePrefs : null,
        beautyPrefs: (interests === 'beauty' || interests === 'both') ? beautyPrefs : null,
      };

      await saveProfile(profileData);

      // Update local user cache
      const user = getUser();
      if (user) { user.profileComplete = true; setUser(user); }

      modal.remove();

      // Open chat with personalised first message
      if (window.YSPChat) {
        const intro = buildChatIntro(interests, fragrancePrefs, beautyPrefs, firstName);
        window.YSPChat.openWithMessage(intro);
      }
    }
  }

  function buildChatIntro(interests, fragPrefs, beautyPrefs, name) {
    if (interests === 'fragrance' || interests === 'both') {
      const scents = fragPrefs.scents?.join(', ') || 'various scents';
      const occasions = fragPrefs.occasions?.join(', ') || 'everyday';
      return `Hi, I'm ${name}. I'm interested in ${scents} fragrances, mainly for ${occasions}. My preference is ${fragPrefs.gender || 'unisex'} and my budget is ${fragPrefs.budget || 'flexible'} per bottle. Can you recommend something?`;
    }
    if (interests === 'beauty') {
      const skin = beautyPrefs.skinType?.join(', ') || 'all skin types';
      const concerns = beautyPrefs.concerns?.join(', ') || 'general skincare';
      return `Hi, I'm ${name}. I have ${skin} skin and I'm mainly focused on ${concerns}. My budget is ${beautyPrefs.budget || 'flexible'} per product. What would you recommend?`;
    }
    return `Hi, I'm ${name}! I'm interested in both fragrance and beauty. Can you help me find something great?`;
  }

  // ── Modal styles (injected once) ──────────────────────────────────────────
  function injectModalStyles() {
    if (document.getElementById('ysp-modal-styles')) return;
    const style = document.createElement('style');
    style.id = 'ysp-modal-styles';
    style.textContent = `
      #ysp-auth-modal, #ysp-qa-modal {
        position: fixed; inset: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        padding: 1rem;
      }
      .ysp-modal-backdrop {
        position: absolute; inset: 0;
        background: rgba(26,25,22,0.7);
        backdrop-filter: blur(4px);
      }
      .ysp-modal-box {
        position: relative; z-index: 1;
        background: var(--white, #faf8f5);
        width: 100%; max-width: 460px;
        padding: 2.5rem;
        box-shadow: 0 24px 80px rgba(0,0,0,0.18);
        animation: yspModalIn 0.25s cubic-bezier(0.4,0,0.2,1);
      }
      @keyframes yspModalIn {
        from { opacity: 0; transform: translateY(16px) scale(0.98); }
        to   { opacity: 1; transform: none; }
      }
      .ysp-modal-close {
        position: absolute; top: 1rem; right: 1rem;
        background: none; border: none; cursor: pointer;
        color: var(--grey, #8a847a); font-size: 0.9rem;
        width: 28px; height: 28px; display: flex;
        align-items: center; justify-content: center;
        transition: color 0.2s;
      }
      .ysp-modal-close:hover { color: var(--black, #1a1916); }
      .ysp-modal-message {
        font-size: 0.85rem; color: var(--accent, #9c7b56);
        margin-bottom: 1.2rem; text-align: center;
      }
      .ysp-modal-tabs {
        display: flex; border-bottom: 1px solid var(--sand, #e6dfd4);
        margin-bottom: 1.8rem;
      }
      .ysp-tab {
        flex: 1; background: none; border: none; cursor: pointer;
        padding: 0.6rem; font-family: var(--sans, sans-serif);
        font-size: 0.78rem; letter-spacing: 0.1em; text-transform: uppercase;
        color: var(--grey, #8a847a); border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: all 0.2s;
      }
      .ysp-tab.active {
        color: var(--black, #1a1916);
        border-bottom-color: var(--accent, #9c7b56);
      }
      .ysp-tab-panel { display: none; }
      .ysp-tab-panel.active { display: block; }
      .ysp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      .ysp-form-group { margin-bottom: 1rem; }
      .ysp-form-group label {
        display: block; font-size: 0.72rem; letter-spacing: 0.1em;
        text-transform: uppercase; color: var(--grey, #8a847a);
        margin-bottom: 0.4rem;
      }
      .ysp-form-group input {
        width: 100%; padding: 0.7rem 0.9rem;
        border: 1px solid var(--sand, #e6dfd4);
        background: var(--white, #faf8f5);
        font-family: var(--sans, sans-serif); font-size: 0.9rem;
        color: var(--black, #1a1916);
        outline: none; transition: border-color 0.2s;
      }
      .ysp-form-group input:focus { border-color: var(--accent, #9c7b56); }
      .ysp-form-error {
        font-size: 0.82rem; color: #c0392b;
        min-height: 1.2rem; margin-bottom: 0.6rem;
      }
      .ysp-btn-primary {
        width: 100%; padding: 0.85rem;
        background: var(--accent, #9c7b56);
        color: var(--white, #faf8f5);
        border: none; cursor: pointer;
        font-family: var(--sans, sans-serif);
        font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase;
        transition: background 0.2s, transform 0.15s;
        font-weight: 400;
      }
      .ysp-btn-primary:hover { background: var(--black, #1a1916); }
      .ysp-btn-primary:active { transform: scale(0.99); }
      .ysp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .ysp-form-footer {
        font-size: 0.78rem; color: var(--grey, #8a847a);
        text-align: center; margin-top: 1rem;
      }
      .ysp-form-footer a { color: var(--accent, #9c7b56); text-decoration: none; }

      /* Q&A styles */
      .ysp-qa-box { max-width: 520px; }
      .ysp-qa-progress {
        height: 2px; background: var(--sand, #e6dfd4);
        margin-bottom: 2rem; position: relative;
      }
      .ysp-qa-progress-bar {
        height: 100%; background: var(--accent, #9c7b56);
        transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
        width: 0%;
      }
      .ysp-qa-question {
        font-family: var(--serif, serif); font-size: 1.4rem; font-weight: 300;
        line-height: 1.3; margin-bottom: 0.4rem; color: var(--black, #1a1916);
      }
      .ysp-qa-sub {
        font-size: 0.8rem; color: var(--grey, #8a847a);
        letter-spacing: 0.05em; margin-bottom: 1.5rem;
      }
      .ysp-qa-options {
        display: flex; flex-wrap: wrap; gap: 0.6rem;
        margin-bottom: 2rem;
      }
      .ysp-qa-option {
        padding: 0.55rem 1.1rem;
        border: 1px solid var(--sand, #e6dfd4);
        background: none; cursor: pointer;
        font-family: var(--sans, sans-serif);
        font-size: 0.82rem; color: var(--grey, #8a847a);
        transition: all 0.18s; white-space: nowrap;
      }
      .ysp-qa-option:hover { border-color: var(--accent, #9c7b56); color: var(--black, #1a1916); }
      .ysp-qa-option.selected {
        background: var(--accent, #9c7b56); border-color: var(--accent, #9c7b56);
        color: var(--white, #faf8f5);
      }
      .ysp-qa-actions {
        display: flex; justify-content: space-between; align-items: center;
        gap: 1rem;
      }
      .ysp-qa-back {
        background: none; border: none; cursor: pointer;
        font-family: var(--sans, sans-serif); font-size: 0.78rem;
        color: var(--grey, #8a847a); letter-spacing: 0.1em;
        text-transform: uppercase; transition: color 0.2s;
        visibility: hidden;
      }
      .ysp-qa-back:hover { color: var(--black, #1a1916); }
      .ysp-qa-next {
        flex: 1; max-width: 240px; padding: 0.75rem 1.5rem;
        background: var(--accent, #9c7b56); color: var(--white, #faf8f5);
        border: none; cursor: pointer;
        font-family: var(--sans, sans-serif);
        font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase;
        transition: background 0.2s, opacity 0.2s;
      }
      .ysp-qa-next:hover:not(:disabled) { background: var(--black, #1a1916); }
      .ysp-qa-next:disabled { opacity: 0.35; cursor: not-allowed; }
      .ysp-qa-skip { text-align: center; margin-top: 1.2rem; font-size: 0.78rem; }
      .ysp-qa-skip a { color: var(--grey, #8a847a); text-decoration: none; }
      .ysp-qa-skip a:hover { color: var(--accent, #9c7b56); }

      @media (max-width: 480px) {
        .ysp-modal-box { padding: 1.8rem 1.4rem; }
        .ysp-form-row { grid-template-columns: 1fr; }
        .ysp-qa-question { font-size: 1.2rem; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Favourite heart button helper ─────────────────────────────────────────
  function initFavouriteButtons() {
    document.querySelectorAll('[data-fav-slug]').forEach(btn => {
      // Remove any existing listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const slug = newBtn.dataset.favSlug;
        const name = newBtn.dataset.favName;
        const price = newBtn.dataset.favPrice;
        const image = newBtn.dataset.favImage;
        const type = newBtn.dataset.favType;
        const result = await toggleFavourite({ slug, name, price, image, type });
        if (result) {
          const added = result.action === 'added';
          newBtn.textContent = added ? '♥' : '♡';
          newBtn.classList.toggle('is-favourite', added);
        }
      });
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    updateNavState();
    initFavouriteButtons();
    // Silently verify session on page load
    const token = getToken();
    if (token) await verifySession();

    // Wire up any login/register buttons in the page
    document.querySelectorAll('[data-action="login"]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); showAuthModal('login'); });
    });
    document.querySelectorAll('[data-action="register"]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); showAuthModal('register'); });
    });
    document.querySelectorAll('[data-action="logout"]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); logout(); });
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    getUser, getToken, isLoggedIn: () => !!getToken(),
    login, logout, register,
    showAuthModal, showProfileQA,
    saveProfile, getProfile,
    toggleFavourite, getFavourites,
    verifySession,
  };

})();
