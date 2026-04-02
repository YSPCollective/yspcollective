/**
 * YSP Collective — AI Fragrance & Beauty Assistant
 * Guided Q&A chat widget — collects preferences via buttons,
 * then sends a rich prompt to the Cloudflare Worker /chat endpoint.
 * After the initial recommendation, free-text follow-up is enabled.
 * System prompt + product catalogue live in the Worker.
 */

(function() {
  'use strict';

  // ─── CONFIG ────────────────────────────────────────────────────────────────
  const WORKER_URL  = 'https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/chat';
  const MAX_HISTORY = 12;
  const SESSION_KEY = 'ysp_chat_history';
  const STATE_KEY   = 'ysp_chat_state';   // persists Q&A answers
  const OPEN_KEY    = 'ysp_chat_open';

  // ─── Q&A FLOW ──────────────────────────────────────────────────────────────
  // Each step: { id, question, options: [{label, value}], multi? }
  // 'multi' allows picking several options before continuing.
  const QA_FLOW = [
    {
      id: 'category',
      question: 'What are you looking for today?',
      options: [
        { label: '🌸 Fragrance', value: 'fragrance' },
        { label: '✨ Skincare', value: 'skincare' },
        { label: '💛 Both', value: 'both' },
      ],
    },
    {
      id: 'gender',
      question: 'Who is this for?',
      options: [
        { label: 'For me — woman', value: 'women' },
        { label: 'For me — man', value: 'men' },
        { label: 'Unisex / gift', value: 'unisex' },
      ],
      condition: (a) => a.category !== 'skincare',
    },
    {
      id: 'scentFamily',
      question: 'What kind of scent appeals to you?',
      multi: true,
      options: [
        { label: '🌹 Floral', value: 'floral' },
        { label: '🪵 Woody / Oud', value: 'woody oud' },
        { label: '🍊 Fresh / Citrus', value: 'fresh citrus' },
        { label: '🍬 Sweet / Gourmand', value: 'sweet gourmand' },
        { label: '🌿 Spicy / Amber', value: 'spicy amber' },
        { label: '🌊 Aquatic / Clean', value: 'aquatic clean' },
      ],
      condition: (a) => a.category !== 'skincare',
    },
    {
      id: 'skinType',
      question: 'What is your skin type?',
      options: [
        { label: 'Oily', value: 'oily' },
        { label: 'Dry', value: 'dry' },
        { label: 'Combination', value: 'combination' },
        { label: 'Sensitive', value: 'sensitive' },
        { label: 'Normal', value: 'normal' },
      ],
      condition: (a) => a.category !== 'fragrance',
    },
    {
      id: 'skinConcern',
      question: 'Any specific skin concern?',
      multi: true,
      options: [
        { label: 'SPF / Sun protection', value: 'SPF sun protection' },
        { label: 'Hydration', value: 'hydration' },
        { label: 'Brightening', value: 'brightening' },
        { label: 'Pores / Cleansing', value: 'pores cleansing' },
        { label: 'Anti-ageing', value: 'anti-ageing' },
        { label: 'No preference', value: 'no specific concern' },
      ],
      condition: (a) => a.category !== 'fragrance',
    },
    {
      id: 'budget',
      question: 'What is your budget per product?',
      options: [
        { label: 'Under €20', value: 'under €20' },
        { label: '€20 – €35', value: '€20–35' },
        { label: '€35 – €50', value: '€35–50' },
        { label: 'No limit', value: 'flexible' },
      ],
    },
    {
      id: 'occasion',
      question: 'When will you use it most?',
      options: [
        { label: '🌅 Everyday', value: 'everyday' },
        { label: '🌙 Evenings / nights out', value: 'evenings nights out' },
        { label: '💼 Work / office', value: 'work office' },
        { label: '🎁 Special occasion', value: 'special occasion' },
      ],
      condition: (a) => a.category !== 'skincare',
    },
  ];

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let isOpen     = false;
  let isLoading  = false;
  let qaStep     = -1;       // -1 = not started, index into filteredSteps
  let qaAnswers  = {};       // { stepId: value | value[] }
  let qaMultiSel = new Set();// current multi-select buffer
  let qaComplete = false;    // true after recommendation delivered
  let filteredSteps = [];    // QA_FLOW filtered by conditions

  // ─── STORAGE ───────────────────────────────────────────────────────────────
  function saveMessages(msgs) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY))); } catch(e) {}
  }
  function loadMessages() {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : []; } catch(e) { return []; } 
  }
  function saveState(state) {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(e) {}
  }
  function loadState() {
    try { const s = sessionStorage.getItem(STATE_KEY); return s ? JSON.parse(s) : null; } catch(e) { return null; }
  }
  function saveChatOpen(open) {
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch(e) {}
  }
  function wasChatOpen() {
    try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch(e) { return false; }
  }

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

    /* Pulse badge when Q&A not yet completed */
    #ysp-chat-btn .ysp-btn-badge {
      position: absolute;
      top: -3px; right: -3px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #c8a96e;
      border: 2px solid #fff;
      animation: yspBadgePulse 2s ease-in-out infinite;
      display: none;
    }
    @keyframes yspBadgePulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.7; }
    }

    #ysp-chat-window {
      position: fixed;
      bottom: 5.5rem;
      right: 1.8rem;
      z-index: 9998;
      width: 380px;
      max-height: 600px;
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

    /* ── Header ── */
    #ysp-chat-header {
      padding: 0.85rem 1.2rem;
      background: #2a2826;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .ysp-header-left { display: flex; align-items: center; gap: 0.7rem; }
    .ysp-avatar {
      width: 30px; height: 30px; border-radius: 50%;
      background: #c8a96e;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 400; color: #fff; flex-shrink: 0;
    }
    .ysp-header-name { font-size: 0.82rem; font-weight: 400; letter-spacing: 0.06em; }
    .ysp-header-status { font-size: 0.65rem; color: rgba(255,255,255,0.45); margin-top: 1px; }
    .ysp-header-actions { display: flex; align-items: center; gap: 0.6rem; }
    .ysp-restart-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.4); font-size: 0.62rem;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      transition: color 0.2s;
    }
    .ysp-restart-btn:hover { color: rgba(255,255,255,0.8); }
    .ysp-close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.5); font-size: 1.2rem; line-height: 1;
      transition: color 0.2s; padding: 0.2rem;
    }
    .ysp-close-btn:hover { color: #fff; }

    /* ── Messages ── */
    #ysp-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.2rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      scroll-behavior: smooth;
    }
    #ysp-chat-messages::-webkit-scrollbar { width: 4px; }
    #ysp-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #ysp-chat-messages::-webkit-scrollbar-thumb { background: #e8e5df; border-radius: 2px; }

    .ysp-msg {
      max-width: 88%;
      padding: 0.65rem 0.95rem;
      line-height: 1.6;
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
    /* Bot messages: basic markdown rendering */
    .ysp-msg-bot strong { font-weight: 500; }
    .ysp-msg-bot em { font-style: italic; }
    .ysp-msg-bot .ysp-rec-product {
      display: block;
      margin-top: 0.5rem;
      padding: 0.5rem 0.7rem;
      background: #fff;
      border: 1px solid #e8e5df;
      border-left: 2px solid #c8a96e;
      font-size: 0.8rem;
      line-height: 1.5;
    }
    .ysp-msg-bot .ysp-rec-product-name {
      font-weight: 500;
      color: #2a2826;
      display: block;
    }
    .ysp-msg-bot .ysp-rec-product-detail {
      color: #8a847a;
      font-size: 0.76rem;
    }

    /* Typing indicator */
    .ysp-typing {
      display: flex; gap: 5px; align-items: center;
      padding: 0.6rem 0.95rem;
      align-self: flex-start;
      background: #f8f6f2;
      border: 1px solid #eee;
      border-radius: 2px 12px 12px 2px;
    }
    .ysp-typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: #c8a96e;
      animation: yspPulse 1.3s ease-in-out infinite;
    }
    .ysp-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ysp-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes yspPulse {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* ── Q&A / Options area ── */
    #ysp-qa-area {
      padding: 0.6rem 1.2rem 0.8rem;
      flex-shrink: 0;
      border-top: 1px solid #f0ede8;
      max-height: 220px;
      overflow-y: auto;
    }
    .ysp-qa-question {
      font-size: 0.75rem;
      color: #9a9690;
      letter-spacing: 0.05em;
      margin-bottom: 0.6rem;
    }
    .ysp-options-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.5rem;
    }
    .ysp-option-btn {
      padding: 0.4rem 0.9rem;
      border: 1px solid #e0ddd8;
      background: #faf8f5;
      font-family: inherit;
      font-size: 0.76rem;
      color: #5a5652;
      cursor: pointer;
      transition: all 0.2s;
      border-radius: 20px;
      letter-spacing: 0.02em;
      white-space: nowrap;
      user-select: none;
    }
    .ysp-option-btn:hover { border-color: #c8a96e; color: #2a2826; background: #fff; }
    .ysp-option-btn.selected {
      background: #2a2826;
      color: #fff;
      border-color: #2a2826;
    }
    .ysp-multi-confirm {
      display: none;
      margin-top: 0.5rem;
      padding: 0.4rem 1rem;
      background: #c8a96e;
      color: #fff;
      border: none;
      font-family: inherit;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 20px;
      transition: background 0.2s;
    }
    .ysp-multi-confirm.visible { display: inline-block; }
    .ysp-multi-confirm:hover { background: #2a2826; }

    /* Skip link */
    .ysp-skip-link {
      display: block;
      font-size: 0.65rem;
      color: #b5afa5;
      text-align: center;
      cursor: pointer;
      margin-top: 0.4rem;
      letter-spacing: 0.06em;
      transition: color 0.2s;
      border: none;
      background: none;
      font-family: inherit;
      width: 100%;
    }
    .ysp-skip-link:hover { color: #7a7672; }

    /* ── Free-text input (shown post Q&A) ── */
    #ysp-chat-input-wrap {
      padding: 0.7rem 1.2rem 0.85rem;
      border-top: 1px solid #e8e5df;
      display: flex;
      gap: 0.6rem;
      flex-shrink: 0;
      background: #fff;
      align-items: flex-end;
      display: none; /* hidden until Q&A complete or skipped */
    }
    #ysp-chat-input-wrap.visible { display: flex; }
    #ysp-chat-input {
      flex: 1;
      border: 1px solid #e0ddd8;
      background: #faf8f5;
      padding: 0.55rem 0.85rem;
      font-family: inherit;
      font-size: 0.84rem;
      font-weight: 300;
      color: #2a2826;
      outline: none;
      transition: border-color 0.2s;
      border-radius: 20px;
      resize: none;
      min-height: 36px;
      max-height: 100px;
      line-height: 1.4;
      overflow-y: auto;
    }
    #ysp-chat-input:focus { border-color: #c8a96e; background: #fff; }
    #ysp-chat-input::placeholder { color: #b5afa5; }
    #ysp-chat-send {
      width: 36px; height: 36px; min-width: 36px;
      background: #2a2826;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
      border-radius: 50%;
    }
    #ysp-chat-send:hover { background: #c8a96e; }
    #ysp-chat-send:disabled { opacity: 0.35; cursor: not-allowed; }
    #ysp-chat-send svg { width: 15px; height: 15px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .ysp-chat-footer {
      text-align: center;
      font-size: 0.58rem;
      color: #c0bdb8;
      padding: 0 1.2rem 0.5rem;
      letter-spacing: 0.06em;
    }

    @media (max-width: 480px) {
      #ysp-chat-window { right: 0.5rem; bottom: 5rem; width: calc(100vw - 1rem); max-height: 72vh; }
      #ysp-chat-btn { right: 1rem; bottom: 1rem; }
    }
  `;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ─── BUILD HTML ────────────────────────────────────────────────────────────
  const chatBtn = document.createElement('button');
  chatBtn.id = 'ysp-chat-btn';
  chatBtn.setAttribute('aria-label', 'Open beauty & fragrance advisor');
  chatBtn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    <span class="ysp-btn-badge"></span>
  `;

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
          <div class="ysp-header-status" id="ysp-status-text">Here to find your perfect match</div>
        </div>
      </div>
      <div class="ysp-header-actions">
        <button class="ysp-restart-btn" id="ysp-restart-btn" aria-label="Start over">Start over</button>
        <button class="ysp-close-btn" aria-label="Close chat">✕</button>
      </div>
    </div>
    <div id="ysp-chat-messages" role="log" aria-live="polite"></div>
    <div id="ysp-qa-area">
      <div class="ysp-options-grid" id="ysp-options"></div>
      <button class="ysp-multi-confirm" id="ysp-multi-confirm">Continue →</button>
      <button class="ysp-skip-link" id="ysp-skip-btn">Skip — let me type freely</button>
    </div>
    <div id="ysp-chat-input-wrap">
      <textarea id="ysp-chat-input" rows="1" placeholder="Ask a follow-up question…" aria-label="Type your message" maxlength="500"></textarea>
      <button id="ysp-chat-send" aria-label="Send message" disabled>
        <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
    <p class="ysp-chat-footer">Powered by AI · YSP Collective</p>
  `;

  document.body.appendChild(chatBtn);
  document.body.appendChild(chatWindow);

  // ─── DOM REFS ──────────────────────────────────────────────────────────────
  const messagesEl   = document.getElementById('ysp-chat-messages');
  const qaAreaEl     = document.getElementById('ysp-qa-area');
  const optionsEl    = document.getElementById('ysp-options');
  const multiConfirm = document.getElementById('ysp-multi-confirm');
  const skipBtn      = document.getElementById('ysp-skip-btn');
  const inputWrap    = document.getElementById('ysp-chat-input-wrap');
  const inputEl      = document.getElementById('ysp-chat-input');
  const sendBtn      = document.getElementById('ysp-chat-send');
  const closeBtn     = chatWindow.querySelector('.ysp-close-btn');
  const restartBtn   = document.getElementById('ysp-restart-btn');
  const statusEl     = document.getElementById('ysp-status-text');
  const badgeEl      = chatBtn.querySelector('.ysp-btn-badge');

  // ─── MESSAGE HELPERS ───────────────────────────────────────────────────────
  function renderBotText(text) {
    // Simple markdown: **bold**, *italic*, bullet lists, product blocks
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Convert lines starting with - or • or number. to a product block
    const lines = html.split('\n');
    const out = [];
    let inList = false;
    lines.forEach(line => {
      const stripped = line.trim();
      if (/^[-•\d+\.]\s/.test(stripped)) {
        if (!inList) { out.push('<div class="ysp-rec-product">'); inList = true; }
        else { out.push('</div><div class="ysp-rec-product">'); }
        out.push(`<span class="ysp-rec-product-name">${stripped.replace(/^[-•\d+\.]\s/, '')}</span>`);
      } else {
        if (inList) { out.push('</div>'); inList = false; }
        if (stripped) out.push(`<p style="margin:0 0 0.35rem">${stripped}</p>`);
      }
    });
    if (inList) out.push('</div>');
    return out.join('');
  }

  function appendMessage(role, text) {
    const div = document.createElement('div');
    if (role === 'user') {
      div.className = 'ysp-msg ysp-msg-user';
      div.textContent = text;
    } else {
      div.className = 'ysp-msg ysp-msg-bot';
      div.innerHTML = renderBotText(text);
    }
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTyping() {
    const el = document.createElement('div');
    el.className = 'ysp-typing'; el.id = 'ysp-typing';
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

  // ─── Q&A ENGINE ────────────────────────────────────────────────────────────
  function buildFilteredSteps() {
    filteredSteps = QA_FLOW.filter(step => {
      if (!step.condition) return true;
      return step.condition(qaAnswers);
    });
  }

  function startQA() {
    qaStep    = 0;
    qaAnswers = {};
    qaMultiSel = new Set();
    qaComplete = false;
    buildFilteredSteps();
    showStep(0);
    badgeEl.style.display = 'block';
  }

  function showStep(index) {
    if (index >= filteredSteps.length) {
      finishQA();
      return;
    }
    const step = filteredSteps[index];
    qaMultiSel = new Set();

    optionsEl.innerHTML = '';
    multiConfirm.classList.remove('visible');
    skipBtn.style.display = index === 0 ? 'block' : 'none';

    // Bot asks the question
    appendMessage('assistant', step.question);

    step.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'ysp-option-btn';
      btn.textContent = opt.label;
      btn.dataset.value = opt.value;

      if (step.multi) {
        btn.addEventListener('click', () => {
          if (qaMultiSel.has(opt.value)) {
            qaMultiSel.delete(opt.value);
            btn.classList.remove('selected');
          } else {
            qaMultiSel.add(opt.value);
            btn.classList.add('selected');
          }
          multiConfirm.classList.toggle('visible', qaMultiSel.size > 0);
        });
      } else {
        btn.addEventListener('click', () => {
          optionsEl.querySelectorAll('.ysp-option-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          qaAnswers[step.id] = opt.value;
          // User echo
          appendMessage('user', opt.label);
          // Advance after short delay for feedback
          setTimeout(() => advanceStep(), 260);
        });
      }
      optionsEl.appendChild(btn);
    });
  }

  function advanceStep() {
    qaStep++;
    // Rebuild filtered steps as answers evolve (conditions may change)
    buildFilteredSteps();
    if (qaStep < filteredSteps.length) {
      showStep(qaStep);
    } else {
      finishQA();
    }
  }

  multiConfirm.addEventListener('click', () => {
    const step = filteredSteps[qaStep];
    const selected = [...qaMultiSel];
    qaAnswers[step.id] = selected;
    // Echo selected labels
    const labels = step.options
      .filter(o => selected.includes(o.value))
      .map(o => o.label).join(', ');
    appendMessage('user', labels);
    multiConfirm.classList.remove('visible');
    setTimeout(() => advanceStep(), 260);
  });

  skipBtn.addEventListener('click', () => {
    // Skip Q&A entirely — go straight to free text
    appendMessage('assistant', "No problem! Ask me anything about our fragrances or skincare and I'll help you find the perfect match. ✦");
    qaAreaEl.style.display = 'none';
    inputWrap.classList.add('visible');
    qaComplete = true;
    badgeEl.style.display = 'none';
    statusEl.textContent = 'Ask me anything';
    setTimeout(() => inputEl.focus(), 200);
  });

  async function finishQA() {
    // Hide Q&A area, show free-text
    qaAreaEl.style.display = 'none';
    inputWrap.classList.add('visible');
    qaComplete = true;
    badgeEl.style.display = 'none';
    statusEl.textContent = 'Personalised recommendations';
    saveState({ qaAnswers });

    // Build prompt from answers
    const prompt = buildPromptFromAnswers(qaAnswers);
    await sendToAI(prompt, true);
    setTimeout(() => inputEl.focus(), 300);
  }

  function buildPromptFromAnswers(a) {
    const parts = [];
    if (a.category && a.category !== 'both') {
      parts.push(`I'm looking for ${a.category === 'skincare' ? 'skincare products' : 'a fragrance'}.`);
    } else if (a.category === 'both') {
      parts.push('I\'m interested in both fragrance and skincare.');
    }
    if (a.gender) parts.push(`It's for: ${a.gender}.`);
    if (a.scentFamily) {
      const scents = Array.isArray(a.scentFamily) ? a.scentFamily.join(', ') : a.scentFamily;
      parts.push(`Scent families I like: ${scents}.`);
    }
    if (a.skinType) parts.push(`My skin type is ${a.skinType}.`);
    if (a.skinConcern) {
      const concerns = Array.isArray(a.skinConcern) ? a.skinConcern.join(', ') : a.skinConcern;
      parts.push(`My skin concerns: ${concerns}.`);
    }
    if (a.budget) parts.push(`My budget is ${a.budget} per product.`);
    if (a.occasion) parts.push(`I'll mainly use it for: ${a.occasion}.`);
    parts.push('Based on this, what do you recommend from your range? Please be specific and mention 2–3 products with prices.');
    return parts.join(' ');
  }

  // ─── AI CALL ───────────────────────────────────────────────────────────────
  async function sendToAI(text, isQaResult = false) {
    if (isLoading) return;
    isLoading = true;
    sendBtn.disabled = true;

    const messages = loadMessages();
    messages.push({ role: 'user', content: text });
    saveMessages(messages);

    if (!isQaResult) appendMessage('user', text);

    inputEl.value = '';
    inputEl.style.height = 'auto';
    showTyping();

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      appendMessage('assistant', "I'm having a little trouble connecting right now. For immediate help, please email info@yspcollective.com.");
    }

    isLoading = false;
    sendBtn.disabled = !inputEl.value.trim();
  }

  // ─── FREE-TEXT INPUT ───────────────────────────────────────────────────────
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    sendBtn.disabled = !inputEl.value.trim() || isLoading;
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendToAI(inputEl.value.trim());
    }
  });
  sendBtn.addEventListener('click', () => {
    const val = inputEl.value.trim();
    if (val) sendToAI(val);
  });

  // ─── OPEN / CLOSE / RESTART ────────────────────────────────────────────────
  function resetChat() {
    messagesEl.innerHTML = '';
    qaAreaEl.style.display = '';
    inputWrap.classList.remove('visible');
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(STATE_KEY); } catch(e) {}
  }

  function openChat() {
    isOpen = true;
    chatWindow.classList.add('open');
    saveChatOpen(true);

    const existingHistory = loadMessages();
    const savedState = loadState();

    if (existingHistory.length > 0 && savedState) {
      // Restore conversation
      qaAnswers  = savedState.qaAnswers || {};
      qaComplete = true;
      existingHistory.forEach(m => appendMessage(m.role, m.content));
      qaAreaEl.style.display = 'none';
      inputWrap.classList.add('visible');
      badgeEl.style.display = 'none';
      statusEl.textContent = 'Personalised recommendations';
      setTimeout(() => inputEl.focus(), 300);
    } else if (existingHistory.length > 0) {
      // History exists but no QA state (skipped) — show in free text mode
      existingHistory.forEach(m => appendMessage(m.role, m.content));
      qaAreaEl.style.display = 'none';
      inputWrap.classList.add('visible');
      badgeEl.style.display = 'none';
      statusEl.textContent = 'Ask me anything';
      setTimeout(() => inputEl.focus(), 300);
    } else {
      // Fresh start
      appendMessage('assistant', 'Welcome to YSP Collective ✦ I\'m your personal beauty advisor. Let me ask a few quick questions to find your perfect match — or skip straight to chat if you prefer.');
      startQA();
    }

    scrollToBottom();
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove('open');
    saveChatOpen(false);
  }

  restartBtn.addEventListener('click', () => {
    resetChat();
    appendMessage('assistant', 'Let\'s start fresh! I\'ll ask a few quick questions to find your perfect match.');
    startQA();
  });

  chatBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());
  closeBtn.addEventListener('click', closeChat);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  // ─── RESTORE ON LOAD ───────────────────────────────────────────────────────
  if (wasChatOpen()) openChat();

  // ─── EXTERNAL API ──────────────────────────────────────────────────────────
  // Called from product pages: window.openYSPChat('Tell me about Lattafa Yara')
  window.openYSPChat = function(prompt) {
    if (!isOpen) openChat();
    if (prompt && qaComplete) {
      setTimeout(() => sendToAI(prompt), 400);
    } else if (prompt && !qaComplete) {
      // Skip Q&A, send directly
      setTimeout(() => {
        resetChat();
        appendMessage('assistant', 'Happy to help with that!');
        qaAreaEl.style.display = 'none';
        inputWrap.classList.add('visible');
        qaComplete = true;
        badgeEl.style.display = 'none';
        sendToAI(prompt, false);
      }, 200);
    }
  };

})();
