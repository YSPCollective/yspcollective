/**
 * YSP Collective — AI Fragrance & Customer Assistant
 * Text input disabled — suggestion buttons only.
 * TODO: Move SYSTEM_PROMPT (inc. product data) into Worker /chat endpoint
 * so it never travels over the network, then re-enable text input.
 */

(function() {
  'use strict';

  // ─── SYSTEM PROMPT ─────────────────────────────────────────────────────────
  // Kept brief — product data removed to keep payload small.
  // Full product knowledge should be moved into the Worker.
  const SYSTEM_PROMPT = `You are the YSP Collective fragrance and beauty advisor — a warm, knowledgeable assistant for a curated lifestyle brand based in Portugal.

YSP Collective sells Arabian/niche fragrances (Lattafa, Armaf, Arabiyat Prestige, Swiss Arabian, Rasasi, Gulf Orchid, Zimaya, Al Haramain) and K-beauty skincare (Beauty of Joseon, ANUA).

YOUR ROLE:
- Help customers find the perfect fragrance through friendly conversation
- Answer questions about products, skincare routines, ingredients
- Handle basic queries: shipping (2-5 days EU, 24h dispatch from Portugal), returns (14 days), authenticity (all EU authorised stock)
- For ordering: direct to the enquiry form or Amazon EU under "YSP Collective"
- For Khamrah and Khamrah Qahwa: always mention 1-2 sprays only

TONE: Warm, genuine, expert. Concise — no waffle. Natural prose, no bullet points.
If you don't know something specific, direct to info@yspcollective.com`;

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
        position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
        width: 60px; height: 60px; border-radius: 50%;
        background: #2a2826; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
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
        position: fixed; bottom: 6rem; right: 2rem; z-index: 9998;
        width: 380px; max-width: calc(100vw - 2rem);
        height: 500px; max-height: calc(100vh - 8rem);
        background: #faf8f5; border: 1px solid #e8e5df;
        box-shadow: 0 8px 48px rgba(0,0,0,0.14);
        display: flex; flex-direction: column;
        opacity: 0; transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
        font-family: 'Outfit', 'DM Sans', -apple-system, sans-serif;
      }
      #ysp-chat-window.open {
        opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
      }

      #ysp-chat-header {
        padding: 1.1rem 1.4rem; background: #2a2826; color: #faf8f5;
        display: flex; align-items: center; gap: 0.8rem; flex-shrink: 0;
      }
      .ysp-chat-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: #c8a96e; display: flex; align-items: center;
        justify-content: center; font-size: 1rem; flex-shrink: 0;
      }
      .ysp-chat-header-name { font-size: 0.88rem; font-weight: 500; letter-spacing: 0.04em; color: #faf8f5; }
      .ysp-chat-header-status { font-size: 0.68rem; color: #c8a96e; letter-spacing: 0.08em; text-transform: uppercase; }
      .ysp-chat-close {
        margin-left: auto; background: none; border: none;
        color: rgba(255,255,255,0.5); cursor: pointer;
        font-size: 1.2rem; padding: 0.2rem; transition: color 0.2s; line-height: 1;
      }
      .ysp-chat-close:hover { color: #fff; }

      #ysp-chat-messages {
        flex: 1; overflow-y: auto; padding: 1.2rem;
        display: flex; flex-direction: column; gap: 0.8rem; scroll-behavior: smooth;
      }
      #ysp-chat-messages::-webkit-scrollbar { width: 4px; }
      #ysp-chat-messages::-webkit-scrollbar-thumb { background: #e8e5df; }

      .ysp-msg {
        max-width: 88%; font-size: 0.85rem; line-height: 1.6;
        padding: 0.7rem 1rem; border-radius: 2px;
        animation: yspFadeIn 0.3s ease;
      }
      @keyframes yspFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ysp-msg-assistant {
        background: #fff; color: #2a2826; border: 1px solid #e8e5df;
        align-self: flex-start; border-bottom-left-radius: 0;
      }
      .ysp-msg-user {
        background: #2a2826; color: #faf8f5;
        align-self: flex-end; border-bottom-right-radius: 0;
      }

      .ysp-typing {
        display: flex; align-items: center; gap: 4px;
        padding: 0.8rem 1rem; background: #fff; border: 1px solid #e8e5df;
        align-self: flex-start; border-bottom-left-radius: 0;
      }
      .ysp-typing span {
        width: 6px; height: 6px; border-radius: 50%; background: #c8a96e;
        animation: yspBounce 1.2s infinite;
      }
      .ysp-typing span:nth-child(2) { animation-delay: 0.2s; }
      .ysp-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes yspBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }

      #ysp-chat-suggestions {
        padding: 0.8rem 1.2rem;
        display: flex; gap: 0.4rem; flex-wrap: wrap; flex-shrink: 0;
        border-top: 1px solid #e8e5df; background: #fff;
      }
      .ysp-suggestion {
        padding: 0.4rem 0.9rem; border: 1px solid #e8e5df;
        background: #faf8f5; font-family: inherit; font-size: 0.75rem;
        color: #7a7672; cursor: pointer; transition: all 0.2s;
        border-radius: 2px; letter-spacing: 0.04em;
      }
      .ysp-suggestion:hover { border-color: #c8a96e; color: #2a2826; background: #fff; }

      .ysp-chat-footer {
        text-align: center; font-size: 0.62rem; color: #b5afa5;
        padding: 0.5rem 1.2rem 0.7rem; letter-spacing: 0.06em; background: #fff;
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

    // Window — no text input, suggestions only
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
      <div class="ysp-chat-footer">Powered by YSP Collective · info@yspcollective.com</div>
    `;
    document.body.appendChild(win);

    win.querySelector('.ysp-chat-close').addEventListener('click', toggleChat);

    // Restore or welcome
    if (messages.length > 0) {
      messages.forEach(msg => addMessage(msg.role, msg.content));
      if (wasChatOpen()) setTimeout(() => toggleChat(), 300);
    } else {
      setTimeout(() => {
        addMessage('assistant', "Hello! I'm your YSP fragrance and beauty advisor. Tap a topic below to get started, or ask me anything about our fragrances and skincare.");
        showSuggestions(["Find me a fragrance", "What's popular?", "Skincare advice", "Shipping info"]);
      }, 400);
    }
  }

  // ─── TOGGLE ────────────────────────────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    document.getElementById('ysp-chat-btn').classList.toggle('open', isOpen);
    document.getElementById('ysp-chat-window').classList.toggle('open', isOpen);
    saveChatOpen(isOpen);
  }

  // ─── MESSAGES ──────────────────────────────────────────────────────────────
  function addMessage(role, text) {
    const container = document.getElementById('ysp-chat-messages');
    const div = document.createElement('div');
    div.className = `ysp-msg ysp-msg-${role}`;
    div.textContent = text;
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

  // ─── HANDLE INPUT ──────────────────────────────────────────────────────────
  async function handleUserInput(text) {
    addMessage('user', text);
    messages.push({ role: 'user', content: text });

    isTyping = true;
    showTyping();

    try {
      const response = await fetch('https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: messages.slice(-6)
        })
      });

      const data = await response.json();
      hideTyping();

      if (data.error) throw new Error(data.error);

      const reply = data.content[0].text;
      messages.push({ role: 'assistant', content: reply });
      saveMessages(messages);
      addMessage('assistant', reply);

      // Context-aware follow-up suggestions
      const lower = reply.toLowerCase();
      if (lower.includes('fragrance') || lower.includes('scent') || lower.includes('perfume')) {
        showSuggestions(["Tell me more", "For evenings?", "Something lighter?", "How to order"]);
      } else if (lower.includes('skincare') || lower.includes('spf') || lower.includes('serum')) {
        showSuggestions(["Tell me more", "Sensitive skin?", "Build a routine", "How to order"]);
      } else if (lower.includes('ship') || lower.includes('deliver') || lower.includes('order')) {
        showSuggestions(["Find me a fragrance", "Skincare advice", "Contact us"]);
      } else {
        showSuggestions(["Find me a fragrance", "Skincare advice", "Shipping info"]);
      }

    } catch (err) {
      hideTyping();
      addMessage('assistant', "I'm having a little trouble right now. Please email info@yspcollective.com and we'll get back to you within 24 hours.");
      console.error('YSP Chat error:', err);
      showSuggestions(["Find me a fragrance", "Skincare advice", "Shipping info"]);
    }

    isTyping = false;
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }

})();
