/**
 * YSP Collective — AI Fragrance & Customer Assistant
 * Drop this script into any page and add your API key to window.YSP_API_KEY
 * The widget handles fragrance recommendations, product questions, shipping info etc.
 */

(function() {
  'use strict';

  // ─── PRODUCT CATALOGUE ─────────────────────────────────────────────────────
  // Auto-loaded from ysp-products-data.js which is generated at build time
  // Never edit this manually — add products via the CMS admin instead
  function getProducts() {
    return window.YSP_PRODUCTS_DATA || [];
  }

    // ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = `You are the YSP Collective fragrance and beauty advisor — a warm, knowledgeable assistant for a curated lifestyle brand based in Portugal. You have the personality of an expert friend who genuinely loves fragrance and skincare: enthusiastic, honest, and never pushy.

YSP Collective sells:
- Arabian/niche fragrances: Lattafa, Armaf, Arabiyat Prestige
- K-beauty skincare: Beauty of Joseon, ANUA

CURRENT PRODUCT CATALOGUE:
${JSON.stringify(getProducts(), null, 2)}

YOUR ROLE:
1. Help customers find the perfect fragrance through friendly conversation
2. Answer questions about products, ingredients, how to wear fragrances, skincare routines
3. Handle basic customer queries: shipping (2-5 days EU, dispatched within 24h, from Portugal), returns (14 days), authenticity (all EU authorised stock), ordering (enquire via contact form or find on Amazon EU under "YSP Collective")
4. Be honest — if something isn't right for someone, say so

FRAGRANCE GUIDANCE APPROACH:
- Ask about occasion, mood, and scent preferences before recommending
- Use the accord data to match recommendations accurately  
- Always explain WHY a fragrance suits them based on what they told you
- Mention longevity and projection honestly — important for managing expectations
- For Khamrah and Khamrah Qahwa, always mention to use 1-2 sprays only

TONE:
- Warm, genuine, expert — like a knowledgeable friend, not a sales script
- Concise responses — no waffle, get to the point
- Use the product descriptions and YSP Thoughts to inform your recommendations
- Never make up products or information not in the catalogue above

FORMATTING:
- Keep responses conversational and relatively short
- When recommending a product, always mention the name and price
- Do not use markdown headers or bullet points in responses — write in natural flowing sentences
- If recommending multiple options, present them naturally in prose

If asked something you don't know (e.g. very specific stock levels, exact delivery dates), direct them to info@yspcollective.com`;

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isTyping = false;
  const SESSION_KEY = 'ysp_chat_history';

  function saveMessages(msgs) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs)); } catch(e) {}
  }

  function loadMessages() {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  }

  function saveChatOpen(open) {
    try { sessionStorage.setItem('ysp_chat_open', open ? '1' : '0'); } catch(e) {}
  }

  function wasChatOpen() {
    try { return sessionStorage.getItem('ysp_chat_open') === '1'; } catch(e) { return false; }
  }

  let messages = loadMessages();

  // ─── BUILD UI ──────────────────────────────────────────────────────────────
  function buildWidget() {
    const styles = document.createElement('style');
    styles.textContent = `
      #ysp-chat-btn {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 9999;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #2a2826;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        transition: transform 0.3s ease, background 0.3s ease;
        font-size: 1.4rem;
      }
      #ysp-chat-btn:hover { background: #c8a96e; transform: scale(1.08); }
      #ysp-chat-btn .btn-icon-open { display: flex; }
      #ysp-chat-btn .btn-icon-close { display: none; }
      #ysp-chat-btn.open .btn-icon-open { display: none; }
      #ysp-chat-btn.open .btn-icon-close { display: flex; }

      #ysp-chat-window {
        position: fixed;
        bottom: 6rem;
        right: 2rem;
        z-index: 9998;
        width: 380px;
        max-width: calc(100vw - 2rem);
        height: 540px;
        max-height: calc(100vh - 8rem);
        background: #faf8f5;
        border: 1px solid #e8e5df;
        box-shadow: 0 8px 48px rgba(0,0,0,0.14);
        display: flex;
        flex-direction: column;
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        font-family: 'Outfit', 'DM Sans', -apple-system, sans-serif;
      }
      #ysp-chat-window.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      #ysp-chat-header {
        padding: 1.1rem 1.4rem;
        background: #2a2826;
        color: #faf8f5;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        flex-shrink: 0;
      }
      .ysp-chat-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #c8a96e;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        flex-shrink: 0;
      }
      .ysp-chat-header-info {}
      .ysp-chat-header-name {
        font-size: 0.88rem;
        font-weight: 500;
        letter-spacing: 0.04em;
        color: #faf8f5;
      }
      .ysp-chat-header-status {
        font-size: 0.68rem;
        color: #c8a96e;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .ysp-chat-close {
        margin-left: auto;
        background: none;
        border: none;
        color: rgba(255,255,255,0.5);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.2rem;
        transition: color 0.2s;
        line-height: 1;
      }
      .ysp-chat-close:hover { color: #fff; }

      #ysp-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        scroll-behavior: smooth;
      }
      #ysp-chat-messages::-webkit-scrollbar { width: 4px; }
      #ysp-chat-messages::-webkit-scrollbar-track { background: transparent; }
      #ysp-chat-messages::-webkit-scrollbar-thumb { background: #e8e5df; border-radius: 2px; }

      .ysp-msg {
        max-width: 88%;
        font-size: 0.85rem;
        line-height: 1.6;
        padding: 0.7rem 1rem;
        border-radius: 2px;
        animation: yspFadeIn 0.3s ease;
      }
      @keyframes yspFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ysp-msg-assistant {
        background: #fff;
        color: #2a2826;
        border: 1px solid #e8e5df;
        align-self: flex-start;
        border-bottom-left-radius: 0;
      }
      .ysp-msg-user {
        background: #2a2826;
        color: #faf8f5;
        align-self: flex-end;
        border-bottom-right-radius: 0;
      }
      .ysp-msg-product {
        background: #fff;
        border: 1px solid #c8a96e;
        align-self: flex-start;
        max-width: 100%;
        width: 100%;
        padding: 0.9rem 1rem;
      }
      .ysp-product-name {
        font-family: 'Playfair Display', 'Cormorant Garamond', Georgia, serif;
        font-size: 1rem;
        font-weight: 400;
        color: #2a2826;
        margin-bottom: 0.2rem;
      }
      .ysp-product-price {
        font-size: 0.8rem;
        color: #c8a96e;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }
      .ysp-product-summary {
        font-size: 0.78rem;
        color: #7a7672;
        line-height: 1.5;
        margin-bottom: 0.6rem;
      }
      .ysp-product-link {
        display: inline-block;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #2a2826;
        text-decoration: none;
        border-bottom: 1px solid #c8a96e;
        padding-bottom: 1px;
        transition: color 0.2s;
      }
      .ysp-product-link:hover { color: #c8a96e; }

      .ysp-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 0.8rem 1rem;
        background: #fff;
        border: 1px solid #e8e5df;
        align-self: flex-start;
        border-bottom-left-radius: 0;
      }
      .ysp-typing span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #c8a96e;
        animation: yspBounce 1.2s infinite;
      }
      .ysp-typing span:nth-child(2) { animation-delay: 0.2s; }
      .ysp-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes yspBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }

      #ysp-chat-suggestions {
        padding: 0 1.2rem 0.6rem;
        display: flex;
        gap: 0.4rem;
        flex-wrap: wrap;
        flex-shrink: 0;
      }
      .ysp-suggestion {
        padding: 0.35rem 0.8rem;
        border: 1px solid #e8e5df;
        background: #fff;
        font-family: inherit;
        font-size: 0.72rem;
        color: #7a7672;
        cursor: pointer;
        transition: all 0.2s;
        border-radius: 2px;
        letter-spacing: 0.04em;
      }
      .ysp-suggestion:hover {
        border-color: #c8a96e;
        color: #2a2826;
        background: #faf8f5;
      }

      #ysp-chat-input-wrap {
        padding: 0.8rem 1.2rem 1rem;
        border-top: 1px solid #e8e5df;
        display: flex;
        gap: 0.6rem;
        flex-shrink: 0;
        background: #fff;
      }
      #ysp-chat-input {
        flex: 1;
        border: 1px solid #e8e5df;
        background: #faf8f5;
        padding: 0.65rem 0.9rem;
        font-family: inherit;
        font-size: 0.85rem;
        color: #2a2826;
        outline: none;
        transition: border-color 0.2s;
        border-radius: 2px;
        resize: none;
        height: 40px;
        line-height: 1.4;
      }
      #ysp-chat-input:focus { border-color: #c8a96e; }
      #ysp-chat-input::placeholder { color: #b5afa5; }
      #ysp-chat-send {
        width: 40px;
        height: 40px;
        background: #2a2826;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        flex-shrink: 0;
        border-radius: 2px;
      }
      #ysp-chat-send:hover { background: #c8a96e; }
      #ysp-chat-send svg { width: 16px; height: 16px; fill: #fff; }
      #ysp-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

      .ysp-chat-footer {
        text-align: center;
        font-size: 0.62rem;
        color: #b5afa5;
        padding: 0 1.2rem 0.6rem;
        letter-spacing: 0.06em;
        background: #fff;
      }

      @media (max-width: 480px) {
        #ysp-chat-window { right: 0.5rem; bottom: 5rem; width: calc(100vw - 1rem); }
        #ysp-chat-btn { right: 1rem; bottom: 1rem; }
      }
    `;
    document.head.appendChild(styles);

    // Button
    const btn = document.createElement('button');
    btn.id = 'ysp-chat-btn';
    btn.setAttribute('aria-label', 'Open fragrance advisor');
    btn.innerHTML = `
      <span class="btn-icon-open">✦</span>
      <span class="btn-icon-close" style="color:#fff;font-size:1.2rem">✕</span>
    `;
    btn.addEventListener('click', toggleChat);
    document.body.appendChild(btn);

    // Window
    const win = document.createElement('div');
    win.id = 'ysp-chat-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'YSP Collective Assistant');
    win.innerHTML = `
      <div id="ysp-chat-header">
        <div class="ysp-chat-avatar">✦</div>
        <div class="ysp-chat-header-info">
          <div class="ysp-chat-header-name">YSP Advisor</div>
          <div class="ysp-chat-header-status">Fragrance & Beauty</div>
        </div>
        <button class="ysp-chat-close" aria-label="Close">✕</button>
      </div>
      <div id="ysp-chat-messages"></div>
      <div id="ysp-chat-suggestions"></div>
      <div id="ysp-chat-input-wrap">
        <textarea id="ysp-chat-input" placeholder="Ask me anything..." rows="1"></textarea>
        <button id="ysp-chat-send" aria-label="Send">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div class="ysp-chat-footer">Powered by YSP Collective · info@yspcollective.com</div>
    `;
    document.body.appendChild(win);

    // Events
    win.querySelector('.ysp-chat-close').addEventListener('click', toggleChat);
    document.getElementById('ysp-chat-send').addEventListener('click', sendMessage);
    document.getElementById('ysp-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Restore previous chat or show welcome
    if (messages.length > 0) {
      // Restore previous conversation
      messages.forEach(msg => addMessage(msg.role, msg.content));
      // Re-open if was open
      if (wasChatOpen()) {
        setTimeout(() => toggleChat(), 300);
      }
    } else {
      // Fresh welcome
      setTimeout(() => {
        addMessage('assistant', "Hello! I'm your YSP fragrance and beauty advisor. I can help you find your perfect scent, answer questions about our skincare range, or help with anything else — delivery, ordering, you name it. What can I help you with today?");
        showSuggestions([
          "Find me a fragrance",
          "What's popular?",
          "Skincare advice",
          "Shipping info"
        ]);
      }, 400);
    }
  }

  // ─── TOGGLE ────────────────────────────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    document.getElementById('ysp-chat-btn').classList.toggle('open', isOpen);
    document.getElementById('ysp-chat-window').classList.toggle('open', isOpen);
    saveChatOpen(isOpen);
    if (isOpen) {
      setTimeout(() => document.getElementById('ysp-chat-input').focus(), 300);
    }
  }

  // ─── MESSAGES ──────────────────────────────────────────────────────────────
  function addMessage(role, text) {
    const container = document.getElementById('ysp-chat-messages');
    const div = document.createElement('div');
    div.className = `ysp-msg ysp-msg-${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function addProductCard(product) {
    const container = document.getElementById('ysp-chat-messages');
    const div = document.createElement('div');
    div.className = 'ysp-msg ysp-msg-product';
    div.innerHTML = `
      <div class="ysp-product-name">${product.name}</div>
      <div class="ysp-product-price">${product.price}</div>
      <div class="ysp-product-summary">${product.summary}</div>
      <a href="${product.url}" class="ysp-product-link">View product →</a>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('ysp-chat-messages');
    const div = document.createElement('div');
    div.className = 'ysp-typing';
    div.id = 'ysp-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('ysp-typing-indicator');
    if (el) el.remove();
  }

  function showSuggestions(suggestions) {
    const container = document.getElementById('ysp-chat-suggestions');
    container.innerHTML = '';
    suggestions.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'ysp-suggestion';
      btn.textContent = s;
      btn.addEventListener('click', () => {
        container.innerHTML = '';
        handleUserInput(s);
      });
      container.appendChild(btn);
    });
  }

  // ─── SEND ──────────────────────────────────────────────────────────────────
  function sendMessage() {
    const input = document.getElementById('ysp-chat-input');
    const text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    document.getElementById('ysp-chat-suggestions').innerHTML = '';
    handleUserInput(text);
  }

  async function handleUserInput(text) {
    addMessage('user', text);
    messages.push({ role: 'user', content: text });

    isTyping = true;
    document.getElementById('ysp-chat-send').disabled = true;
    showTyping();

    try {
      const response = await fetch('https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: messages
        })
      });

      const data = await response.json();
      hideTyping();

      if (data.error) throw new Error(data.error.message);

      const reply = data.content[0].text;
      messages.push({ role: 'assistant', content: reply });
      saveMessages(messages);
      addMessage('assistant', reply);

      // Check if reply mentions any products and show cards
      const mentioned = getProducts().filter(p =>
        reply.toLowerCase().includes(p.name.toLowerCase().split(' ').slice(0,3).join(' ').toLowerCase())
      );
      mentioned.slice(0, 2).forEach(p => addProductCard(p));

      // Context-aware follow-up suggestions
      const lowerReply = reply.toLowerCase();
      if (lowerReply.includes('fragrance') || lowerReply.includes('scent') || lowerReply.includes('perfume')) {
        showSuggestions(["Tell me more", "What about for evenings?", "Something lighter?", "View all fragrances"]);
      } else if (lowerReply.includes('skincare') || lowerReply.includes('spf') || lowerReply.includes('serum')) {
        showSuggestions(["Tell me more", "What about sensitive skin?", "Build a routine", "View skincare"]);
      } else {
        showSuggestions(["Find me a fragrance", "Skincare advice", "How to order"]);
      }

    } catch (err) {
      hideTyping();
      addMessage('assistant', "I'm having a little trouble connecting right now. For immediate help, please email info@yspcollective.com and we'll get back to you within 24 hours.");
      console.error('YSP Chat error:', err);
    }

    isTyping = false;
    document.getElementById('ysp-chat-send').disabled = false;
    document.getElementById('ysp-chat-input').focus();
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }

})();
