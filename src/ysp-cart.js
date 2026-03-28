/**
 * YSP Collective — Shopping Cart
 * Multi-item slide-out drawer → Stripe Checkout
 * Worker endpoint: https://rapid-shadow-439d.workers.dev/checkout
 *
 * Usage:
 *   YSPCart.add({ id, name, price, image, quantity })
 *   YSPCart.open()
 *
 * Add to product pages:
 *   <button onclick="YSPCart.addFromButton(this)"
 *           data-id="lattafa-yara-100ml"
 *           data-name="Lattafa Yara 100ml"
 *           data-price="29.55"
 *           data-image="/products/lattafa/yara/1-78.jpeg">
 *     Add to Cart
 *   </button>
 */

(function () {
  'use strict';

  const WORKER_URL = 'https://ysp-ai-proxy-rapid-shadow-439d.workers.dev/checkout';
  const STORAGE_KEY = 'ysp_cart_v2';

  /* ─── STATE ─────────────────────────────────────────────────────────── */
  let cart = loadCart();

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) { return []; }
  }

  function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    updateBadge();
  }

  function getTotal() {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  /* ─── CART OPERATIONS ───────────────────────────────────────────────── */
  function addItem({ id, name, price, image, quantity = 1 }) {
    const existing = cart.find(i => i.id === id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ id, name, price: parseFloat(price), image: image || '', quantity });
    }
    saveCart();
    renderItems();
    openCart();
    showAddedFeedback(id);
  }

  function removeItem(id) {
    cart = cart.filter(i => i.id !== id);
    saveCart();
    renderItems();
  }

  function updateQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
    renderItems();
  }

  function clearCart() {
    cart = [];
    saveCart();
    renderItems();
  }

  /* ─── CHECKOUT ──────────────────────────────────────────────────────── */
  async function checkout() {
    if (!cart.length) return;

    const btn = document.getElementById('ysp-cart-checkout-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Processing...';
    }

    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: Math.round(item.price * 100), // cents
            image: item.image,
            quantity: item.quantity
          })),
          success_url: window.location.origin + '/checkout-success.html',
          cancel_url: window.location.href
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Checkout failed');
      }

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.sessionId) {
        // Stripe.js fallback
        if (window.Stripe) {
          const stripe = Stripe(data.publishableKey || '');
          await stripe.redirectToCheckout({ sessionId: data.sessionId });
        } else {
          throw new Error('Redirect URL not received');
        }
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('[YSP Cart] Checkout error:', err);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Checkout';
      }
      showCartError('Checkout failed — please try again or contact info@yspcollective.com');
    }
  }

  /* ─── BUILD UI ──────────────────────────────────────────────────────── */
  function buildCart() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      /* ── YSP Cart Overlay ── */
      #ysp-cart-overlay {
        position: fixed; inset: 0; background: rgba(26,25,22,0.5);
        z-index: 9000; opacity: 0; pointer-events: none;
        transition: opacity 0.35s ease; backdrop-filter: blur(4px);
      }
      #ysp-cart-overlay.open { opacity: 1; pointer-events: all; }

      /* ── Cart Drawer ── */
      #ysp-cart-drawer {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 420px; max-width: 100vw;
        background: #faf8f5;
        z-index: 9001;
        transform: translateX(100%);
        transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex; flex-direction: column;
        font-family: 'Outfit', 'DM Sans', -apple-system, sans-serif;
        box-shadow: -8px 0 48px rgba(0,0,0,0.12);
      }
      #ysp-cart-drawer.open { transform: translateX(0); }

      /* ── Header ── */
      #ysp-cart-header {
        padding: 1.4rem 1.6rem;
        border-bottom: 1px solid #e6dfd4;
        display: flex; align-items: center; justify-content: space-between;
        flex-shrink: 0;
      }
      #ysp-cart-header h2 {
        font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
        font-size: 1.3rem; font-weight: 300; color: #1a1916;
        display: flex; align-items: center; gap: 0.6rem;
      }
      #ysp-cart-count-badge {
        background: #9c7b56; color: #fff;
        font-family: 'Outfit', sans-serif;
        font-size: 0.65rem; font-weight: 500;
        padding: 0.15rem 0.5rem; letter-spacing: 0.05em;
        display: none;
      }
      #ysp-cart-count-badge.visible { display: inline-block; }
      #ysp-cart-close {
        background: none; border: none; cursor: pointer;
        color: #8a847a; font-size: 1.4rem; line-height: 1;
        padding: 0.2rem; transition: color 0.2s;
      }
      #ysp-cart-close:hover { color: #1a1916; }

      /* ── Items ── */
      #ysp-cart-items {
        flex: 1; overflow-y: auto; padding: 1.2rem 1.6rem;
      }
      #ysp-cart-items::-webkit-scrollbar { width: 4px; }
      #ysp-cart-items::-webkit-scrollbar-track { background: transparent; }
      #ysp-cart-items::-webkit-scrollbar-thumb { background: #e6dfd4; }

      /* ── Empty state ── */
      #ysp-cart-empty {
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        height: 100%; gap: 0.8rem; color: #8a847a;
        text-align: center; padding: 2rem;
      }
      #ysp-cart-empty .empty-icon { font-size: 2.5rem; opacity: 0.4; }
      #ysp-cart-empty p { font-size: 0.9rem; line-height: 1.6; }
      #ysp-cart-empty a {
        display: inline-block; margin-top: 0.5rem;
        font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase;
        color: #9c7b56; text-decoration: none;
        border-bottom: 1px solid currentColor; padding-bottom: 2px;
      }

      /* ── Cart item card ── */
      .ysp-cart-item {
        display: grid; grid-template-columns: 72px 1fr auto;
        gap: 1rem; align-items: start;
        padding: 1rem 0; border-bottom: 1px solid #e6dfd4;
      }
      .ysp-cart-item:last-child { border-bottom: none; }
      .ysp-cart-item-img {
        width: 72px; height: 90px; object-fit: cover;
        background: #e6dfd4;
      }
      .ysp-cart-item-img.no-img {
        display: flex; align-items: center; justify-content: center;
        font-size: 1.5rem; color: #b5afa5;
      }
      .ysp-cart-item-name {
        font-size: 0.88rem; font-weight: 400; color: #1a1916;
        line-height: 1.35; margin-bottom: 0.4rem;
      }
      .ysp-cart-item-price {
        font-size: 0.9rem; color: #9c7b56; font-weight: 400;
        margin-bottom: 0.6rem;
      }
      .ysp-cart-item-qty {
        display: flex; align-items: center; gap: 0.5rem;
      }
      .ysp-cart-qty-btn {
        width: 26px; height: 26px; border: 1px solid #e6dfd4;
        background: transparent; cursor: pointer; color: #1a1916;
        font-size: 0.9rem; display: flex; align-items: center;
        justify-content: center; transition: all 0.2s; flex-shrink: 0;
      }
      .ysp-cart-qty-btn:hover { border-color: #9c7b56; color: #9c7b56; }
      .ysp-cart-qty-num { font-size: 0.88rem; min-width: 1.2rem; text-align: center; }
      .ysp-cart-item-remove {
        background: none; border: none; cursor: pointer;
        color: #b5afa5; font-size: 1rem; padding: 0;
        transition: color 0.2s; margin-top: 2px;
        line-height: 1;
      }
      .ysp-cart-item-remove:hover { color: #c05a4e; }

      /* ── Footer ── */
      #ysp-cart-footer {
        padding: 1.4rem 1.6rem;
        border-top: 1px solid #e6dfd4;
        background: #f3efe8;
        flex-shrink: 0;
      }
      #ysp-cart-total-row {
        display: flex; justify-content: space-between;
        align-items: center; margin-bottom: 1.2rem;
      }
      #ysp-cart-total-label {
        font-size: 0.72rem; letter-spacing: 0.18em;
        text-transform: uppercase; color: #8a847a;
      }
      #ysp-cart-total-price {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.4rem; font-weight: 300; color: #1a1916;
      }
      #ysp-cart-checkout-btn {
        width: 100%; padding: 1rem;
        background: #1a1916; color: #faf8f5;
        border: none; cursor: pointer;
        font-family: 'Outfit', sans-serif;
        font-size: 0.78rem; font-weight: 400;
        letter-spacing: 0.14em; text-transform: uppercase;
        transition: background 0.25s, transform 0.2s;
      }
      #ysp-cart-checkout-btn:hover:not(:disabled) { background: #9c7b56; transform: translateY(-1px); }
      #ysp-cart-checkout-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      #ysp-cart-error {
        font-size: 0.78rem; color: #c05a4e;
        margin-top: 0.7rem; text-align: center;
        display: none;
      }
      #ysp-cart-note {
        font-size: 0.68rem; color: #8a847a;
        text-align: center; margin-top: 0.8rem;
        display: flex; align-items: center; justify-content: center; gap: 0.3rem;
      }

      /* ── Nav cart button ── */
      #ysp-cart-nav-btn {
        position: relative; background: none; border: none;
        cursor: pointer; color: #8a847a;
        font-size: 1.1rem; display: flex; align-items: center;
        gap: 0.4rem; padding: 0.3rem;
        transition: color 0.2s;
      }
      #ysp-cart-nav-btn:hover { color: #1a1916; }
      #ysp-cart-nav-dot {
        position: absolute; top: -2px; right: -4px;
        width: 16px; height: 16px; border-radius: 50%;
        background: #9c7b56; color: #fff;
        font-size: 0.55rem; font-weight: 600;
        display: none; align-items: center; justify-content: center;
      }
      #ysp-cart-nav-dot.visible { display: flex; }

      /* ── Add to cart button (on product pages) ── */
      .ysp-add-to-cart {
        cursor: pointer;
        transition: all 0.25s;
      }
      .ysp-add-to-cart.added {
        background: #7a9a6a !important;
      }
      .ysp-add-to-cart.added::after {
        content: ' ✓';
      }

      @media (max-width: 480px) {
        #ysp-cart-drawer { width: 100vw; }
      }
    `;
    document.head.appendChild(style);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'ysp-cart-overlay';
    overlay.addEventListener('click', closeCart);
    document.body.appendChild(overlay);

    // Drawer
    const drawer = document.createElement('div');
    drawer.id = 'ysp-cart-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Shopping cart');
    drawer.innerHTML = `
      <div id="ysp-cart-header">
        <h2>Cart <span id="ysp-cart-count-badge"></span></h2>
        <button id="ysp-cart-close" aria-label="Close cart">✕</button>
      </div>
      <div id="ysp-cart-items"></div>
      <div id="ysp-cart-footer" style="display:none;">
        <div id="ysp-cart-total-row">
          <span id="ysp-cart-total-label">Total</span>
          <span id="ysp-cart-total-price">€0.00</span>
        </div>
        <button id="ysp-cart-checkout-btn">Checkout</button>
        <div id="ysp-cart-error"></div>
        <p id="ysp-cart-note">🔒 Secure checkout via Stripe</p>
      </div>
    `;
    document.body.appendChild(drawer);

    // Wire up close button
    document.getElementById('ysp-cart-close').addEventListener('click', closeCart);
    document.getElementById('ysp-cart-checkout-btn').addEventListener('click', checkout);

    // Inject cart button into nav
    injectNavButton();

    renderItems();
  }

  function injectNavButton() {
    // Try to find the nav links list
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    const li = document.createElement('li');
    li.innerHTML = `
      <button id="ysp-cart-nav-btn" aria-label="Open cart" onclick="YSPCart.open()">
        🛍 <span id="ysp-cart-nav-label" style="font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:400;">Cart</span>
        <span id="ysp-cart-nav-dot"></span>
      </button>
    `;
    navLinks.appendChild(li);
  }

  function renderItems() {
    const container = document.getElementById('ysp-cart-items');
    const footer = document.getElementById('ysp-cart-footer');
    if (!container) return;

    if (cart.length === 0) {
      container.innerHTML = `
        <div id="ysp-cart-empty">
          <span class="empty-icon">🛍</span>
          <p>Your cart is empty.</p>
          <a href="/#featured">Browse Products</a>
        </div>
      `;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'block';

    container.innerHTML = cart.map(item => `
      <div class="ysp-cart-item" data-id="${escHtml(item.id)}">
        ${item.image
          ? `<img class="ysp-cart-item-img" src="${escHtml(item.image)}" alt="${escHtml(item.name)}" loading="lazy" onerror="this.className='ysp-cart-item-img no-img';this.outerHTML='<div class=\\'ysp-cart-item-img no-img\\'>✦</div>'">`
          : `<div class="ysp-cart-item-img no-img">✦</div>`
        }
        <div>
          <div class="ysp-cart-item-name">${escHtml(item.name)}</div>
          <div class="ysp-cart-item-price">€${(item.price * item.quantity).toFixed(2)}</div>
          <div class="ysp-cart-item-qty">
            <button class="ysp-cart-qty-btn" onclick="YSPCart._updateQty('${escHtml(item.id)}', -1)" aria-label="Decrease quantity">−</button>
            <span class="ysp-cart-qty-num">${item.quantity}</span>
            <button class="ysp-cart-qty-btn" onclick="YSPCart._updateQty('${escHtml(item.id)}', 1)" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="ysp-cart-item-remove" onclick="YSPCart._remove('${escHtml(item.id)}')" aria-label="Remove ${escHtml(item.name)}">✕</button>
      </div>
    `).join('');

    // Update total
    const totalEl = document.getElementById('ysp-cart-total-price');
    if (totalEl) totalEl.textContent = `€${getTotal().toFixed(2)}`;

    updateBadge();
  }

  function updateBadge() {
    const count = getCount();
    const badge = document.getElementById('ysp-cart-count-badge');
    const dot = document.getElementById('ysp-cart-nav-dot');
    const navLabel = document.getElementById('ysp-cart-nav-label');

    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('visible', count > 0);
    }
    if (dot) {
      dot.textContent = count > 9 ? '9+' : count;
      dot.classList.toggle('visible', count > 0);
    }
    if (navLabel && count > 0) {
      navLabel.textContent = `Cart (${count})`;
    } else if (navLabel) {
      navLabel.textContent = 'Cart';
    }
  }

  function showAddedFeedback(id) {
    // Flash any buttons on the page that match this product id
    document.querySelectorAll(`[data-id="${id}"]`).forEach(btn => {
      if (btn.tagName === 'BUTTON' || btn.classList.contains('ysp-add-to-cart')) {
        const orig = btn.textContent;
        btn.classList.add('added');
        setTimeout(() => {
          btn.classList.remove('added');
          btn.textContent = orig;
        }, 1800);
      }
    });
  }

  function showCartError(msg) {
    const el = document.getElementById('ysp-cart-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function openCart() {
    document.getElementById('ysp-cart-overlay')?.classList.add('open');
    document.getElementById('ysp-cart-drawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    document.getElementById('ysp-cart-overlay')?.classList.remove('open');
    document.getElementById('ysp-cart-drawer')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function escHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  /* ─── PUBLIC API ────────────────────────────────────────────────────── */
  window.YSPCart = {
    add: addItem,
    open: openCart,
    close: closeCart,
    clear: clearCart,
    getCount,
    getTotal,
    _remove: removeItem,
    _updateQty: updateQty,

    /** Called by data-attribute buttons on product pages */
    addFromButton(btn) {
      const { id, name, price, image } = btn.dataset;
      if (!id || !name || !price) {
        console.warn('[YSP Cart] Button missing data-id, data-name or data-price');
        return;
      }
      addItem({ id, name, price: parseFloat(price), image: image || '' });
    }
  };

  /* ─── INIT ──────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildCart);
  } else {
    buildCart();
  }

})();
