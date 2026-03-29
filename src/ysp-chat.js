/**
 * YSP Collective — AI Fragrance & Beauty Assistant
 * Chat widget — text input ENABLED.
 * System prompt + product catalogue live in the Cloudflare Worker /chat endpoint.
 * Only conversation messages are sent over the network.
 */

(function() {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const WORKER_URL = 'https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/chat';
  const MAX_HISTORY = 12; // keep last 12 messages to avoid payload bloat
  const SESSION_KEY = 'ysp_chat_history';
  const OPEN_KEY    = 'ysp_chat_open';

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let isOpen    = false;
  let isLoading = false;

  // ─── STORAGE HELPERS ───────────────────────────────────────────────────────
  function saveMessages(msgs) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY))); } catch(e) {}
  }
  function loadMessages() {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : []; } catch(e) { return []; }
  }
  function saveChatOpen(open) {
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch(e) {}
  }
  function wasChatOpen() {
    try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch(e) { return false; }
  }

  // ─── SUGGESTIONS ───────────────────────────────────────────────────────────
  const SUGGESTIONS = [
    'Find me a fragrance',
    'Best fragrance for men',
    'Best fragrance for women',
    'Recommend a K-beauty SPF',
    'Long-lasting fragrances',
    'Best gift ideas',
    'Tell me about Lattafa Khamrah',
    'Tell me about Armaf Club de Nuit',
    'Shipping info',
  ];

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400&display=swap');

    #ysp-chat-btn {
      position: fixed;
      bottom: 1.8rem;
      right: 1.8rem;
      z-index: 9999;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #2a2826;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.22);
      transition: background 0.25s, transform 0.25s;
    }
    #ysp-chat-btn:hover { background: #c8a96e; transform: scale(1.06); }
    #ysp-chat-btn svg { width: 24px; height: 24px; fill: #fff; }

    #ysp-chat-window {
      position: fixed;
      bottom: 5.5rem;
      right: 1.8rem;
      z-index: 9998;
      width: 360px;
      max-height: 560px;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid #e8e5df;
      box-shadow: 0 8px 40px rgba(0,0,0,0.14);
      font-family: 'Outfit', -apple-system, sans-serif;
      font-size: 0.88rem;
      font-weight: 300;
      color: #2a2826;
      opacity: 0;
      transform: translateY(12px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    #ysp-chat-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    #ysp-chat-header {
      padding: 0.9rem 1.2rem;
      background: #2a2826;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .ysp-header-left { display: flex; align-items: center; gap: 0.7rem; }
    .ysp-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: #c8a96e;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.85rem; font-weight: 400; color: #fff; flex-shrink: 0;
    }
    .ysp-header-name { font-size: 0.82rem; font-weight: 400; letter-spacing: 0.06em; }
    .ysp-header-status { font-size: 0.68rem; color: rgba(255,255,255,0.5); margin-top: 1px; }
    .ysp-close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.55); font-size: 1.3rem; line-height: 1;
      transition: color 0.2s; padding: 0.2rem;
    }
    .ysp-close-btn:hover { color: #fff; }

    #ysp-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      scroll-behavior: smooth;
    }
    #ysp-chat-messages::-webkit-scrollbar { width: 4px; }
    #ysp-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #ysp-chat-messages::-webkit-scrollbar-thumb { background: #e8e5df; border-radius: 2px; }

    .ysp-msg {
      max-width: 84%;
      padding: 0.65rem 0.9rem;
      line-height: 1.55;
      font-size: 0.84rem;
    }
    .ysp-msg-bot {
      background: #f8f6f2;
      border: 1px solid #eee;
      align-self: flex-start;
      border-radius: 2px 12px 12px 2px;
      color: #2a2826;
    }
    .ysp-msg-user {
      background: #2a2826;
      color: #fff;
      align-self: flex-end;
      border-radius: 12px 2px 2px 12px;
    }
    .ysp-typing {
      display: flex;
      gap: 5px;
      align-items: center;
      padding: 0.7rem 1rem;
      align-self: flex-start;
    }
    .ysp-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #c8a96e;
      animation: yspPulse 1.3s ease-in-out infinite;
    }
    .ysp-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ysp-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes yspPulse {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    #ysp-chat-suggestions {
      padding: 0.6rem 1.2rem 0.7rem;
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      flex-shrink: 0;
      border-top: 1px solid #f0ede8;
    }
    .ysp-suggestion {
      padding: 0.3rem 0.75rem;
      border: 1px solid #e0ddd8;
      background: #faf8f5;
      font-family: inherit;
      font-size: 0.7rem;
      color: #7a7672;
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 20px;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .ysp-suggestion:hover { border-color: #c8a96e; color: #2a2826; background: #fff; }

    #ysp-chat-input-wrap {
      padding: 0.75rem 1.2rem 0.9rem;
      border-top: 1px solid #e8e5df;
      display: flex;
      gap: 0.6rem;
      flex-shrink: 0;
      background: #fff;
      align-items: flex-end;
    }
    #ysp-chat-input {
      flex: 1;
      border: 1px solid #e0ddd8;
      background: #faf8f5;
      padding: 0.6rem 0.85rem;
      font-family: inherit;
      font-size: 0.84rem;
      font-weight: 300;
      color: #2a2826;
      outline: none;
      transition: border-color 0.2s;
      border-radius: 20px;
      resize: none;
      min-height: 38px;
      max-height: 100px;
      line-height: 1.4;
      overflow-y: auto;
    }
    #ysp-chat-input:focus { border-color: #c8a96e; background: #fff; }
    #ysp-chat-input::placeholder { color: #b5afa5; }
    #ysp-chat-send {
      width: 38px;
      height: 38px;
      min-width: 38px;
      background: #2a2826;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
      border-radius: 50%;
    }
    #ysp-chat-send:hover { background: #c8a96e; }
    #ysp-chat-send:disabled { opacity: 0.35; cursor: not-allowed; }
    #ysp-chat-send svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .ysp-chat-footer {
      text-align: center;
      font-size: 0.6rem;
      color: #c0bdb8;
      padding: 0 1.2rem 0.55rem;
      letter-spacing: 0.06em;
    }

    @media (max-width: 480px) {
      #ysp-chat-window { right: 0.5rem; bottom: 5rem; width: calc(100vw - 1rem); max-height: 70vh; }
      #ysp-chat-btn { right: 1rem; bottom: 1rem; }
    }
  `;

  // ─── INJECT STYLES ─────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ─── INJECT HTML ───────────────────────────────────────────────────────────
  const chatBtn = document.createElement('button');
  chatBtn.id = 'ysp-chat-btn';
  chatBtn.setAttribute('aria-label', 'Open chat assistant');
  chatBtn.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;

  const chatWindow = document.createElement('div');
  chatWindow.id = 'ysp-chat-window';
  chatWindow.setAttribute('role', 'dialog');
  chatWindow.setAttribute('aria-label', 'YSP Collective beauty advisor');
  chatWindow.innerHTML = `
    <div id="ysp-chat-header">
      <div class="ysp-header-left">
        <div class="ysp-avatar">✦</div>
        <div>
          <div class="ysp-header-name">YSP Beauty Advisor</div>
          <div class="ysp-header-status">Online — here to help</div>
        </div>
      </div>
      <button class="ysp-close-btn" aria-label="Close chat">✕</button>
    </div>
    <div id="ysp-chat-messages" role="log" aria-live="polite"></div>
    <div id="ysp-chat-suggestions"></div>
    <div id="ysp-chat-input-wrap">
      <textarea
        id="ysp-chat-input"
        rows="1"
        placeholder="Ask about fragrances or skincare…"
        aria-label="Type your message"
        maxlength="500"
      ></textarea>
      <button id="ysp-chat-send" aria-label="Send message" disabled>
        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <p class="ysp-chat-footer">Powered by AI · YSP Collective</p>
  `;

  document.body.appendChild(chatBtn);
  document.body.appendChild(chatWindow);

  // ─── DOM REFS ──────────────────────────────────────────────────────────────
  const messagesEl    = document.getElementById('ysp-chat-messages');
  const inputEl       = document.getElementById('ysp-chat-input');
  const sendBtn       = document.getElementById('ysp-chat-send');
  const suggestionsEl = document.getElementById('ysp-chat-suggestions');
  const closeBtn      = chatWindow.querySelector('.ysp-close-btn');

  // ─── MESSAGE HELPERS ───────────────────────────────────────────────────────
  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = role === 'user' ? 'ysp-msg ysp-msg-user' : 'ysp-msg ysp-msg-bot';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'ysp-typing';
    el.id = 'ysp-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function removeTyping() {
    const el = document.getElementById('ysp-typing');
    if (el) el.remove();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ─── SUGGESTIONS ───────────────────────────────────────────────────────────
  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    SUGGESTIONS.forEach(text => {
      const btn = document.createElement('button');
      btn.className = 'ysp-suggestion';
      btn.textContent = text;
      btn.addEventListener('click', () => sendMessage(text));
      suggestionsEl.appendChild(btn);
    });
  }

  // ─── SEND MESSAGE ──────────────────────────────────────────────────────────
  async function sendMessage(text) {
    text = (text || '').trim();
    if (!text || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;

    // Load and append to history
    const messages = loadMessages();
    messages.push({ role: 'user', content: text });
    saveMessages(messages);

    appendMessage('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only messages sent — system prompt lives in Worker
        body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY) }),
      });

      removeTyping();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content || "I'm not sure — please email info@yspcollective.com and we'll help you directly.";

      messages.push({ role: 'assistant', content: reply });
      saveMessages(messages);
      appendMessage('assistant', reply);

    } catch (err) {
      removeTyping();
      console.error('YSP Chat error:', err);
      appendMessage('assistant', "I'm having a little trouble connecting right now. For immediate help, please email info@yspcollective.com and we'll get back to you within 24 hours.");
    }

    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  // ─── INPUT HANDLERS ────────────────────────────────────────────────────────
  inputEl.addEventListener('input', () => {
    // Auto-resize
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    // Enable/disable send
    sendBtn.disabled = !inputEl.value.trim() || isLoading;
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage(inputEl.value);
    }
  });

  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));

  // ─── OPEN / CLOSE ──────────────────────────────────────────────────────────
  function openChat() {
    isOpen = true;
    chatWindow.classList.add('open');
    saveChatOpen(true);

    // Show welcome message if no history
    const msgs = loadMessages();
    if (msgs.length === 0) {
      // Don't save welcome to history — it's cosmetic
      appendMessage('assistant', "Welcome to YSP Collective ✦ I'm your personal fragrance and beauty advisor. Ask me anything — about our fragrances, skincare, or just tell me what you're looking for and I'll find you the perfect match.");
      renderSuggestions();
    } else {
      // Replay history
      msgs.forEach(m => appendMessage(m.role, m.content));
      renderSuggestions();
    }

    setTimeout(() => inputEl.focus(), 300);
    scrollToBottom();
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove('open');
    saveChatOpen(false);
  }

  chatBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // ─── RESTORE STATE ─────────────────────────────────────────────────────────
  if (wasChatOpen()) openChat();

  // ─── PREFILL from product pages ────────────────────────────────────────────
  // Called by product pages: window.openYSPChat('Tell me about Lattafa Yara')
  window.openYSPChat = function(prompt) {
    if (!isOpen) openChat();
    if (prompt) {
      setTimeout(() => sendMessage(prompt), 400);
    }
  };

})();
