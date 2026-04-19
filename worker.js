/**
 * YSP Collective — Cloudflare Worker
 * Worker name: ysp-ai-proxy
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY      →  sk_live_xxxx
 *   STRIPE_WEBHOOK_SECRET  →  whsec_xxxx  (from Stripe dashboard → Webhooks)
 *   ANTHROPIC_API_KEY      →  sk-ant-xxxx
 *   AUTH_SECRET            →  any long random string
 *   BREVO_API_KEY          →  your Brevo API key (v3)
 *
 * Required KV binding (wrangler.toml):
 *   [[kv_namespaces]]
 *   binding = "YSP_USERS"
 *   id = "YOUR_KV_NAMESPACE_ID"
 *
 * Required Cron Trigger (wrangler.toml):
 *   [triggers]
 *   crons = ["0 9 * * *"]   ← runs daily at 9am UTC
 *
 * Endpoints:
 *   POST /auth/register
 *   POST /auth/login
 *   POST /auth/logout
 *   GET  /auth/me
 *   POST /profile/save
 *   GET  /profile
 *   POST /favourites/toggle
 *   GET  /favourites
 *   POST /checkout
 *   POST /sync-product
 *   POST /chat
 *   POST /stripe-webhook
 *   POST /subscribe
 *   GET  /reviews/{slug}
 *   POST /reviews/submit
 *   POST /reviews/approve
 *   GET  /health
 */

// ── CORS ─────────────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── CRYPTO HELPERS ───────────────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generateToken(userId, secret) {
  const payload = `${userId}:${Date.now()}:${Math.random()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return btoa(`${payload}|||${sigB64}`);
}

function getAuthToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getUserFromToken(token, env) {
  if (!token) return null;
  try {
    const sessionData = await env.YSP_USERS.get(`session:${token}`);
    if (!sessionData) return null;
    const session = JSON.parse(sessionData);
    if (session.expires < Date.now()) {
      await env.YSP_USERS.delete(`session:${token}`);
      return null;
    }
    const userData = await env.YSP_USERS.get(`user:${session.userId}`);
    if (!userData) return null;
    return { ...JSON.parse(userData), userId: session.userId };
  } catch (_) {
    return null;
  }
}

// ── STRIPE WEBHOOK VERIFICATION ──────────────────────────────────────────────
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const signature = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === signature;
}

// ── BREVO EMAIL ───────────────────────────────────────────────────────────────
const REVIEW_LINK = 'https://www.trustpilot.com/review/yspcollective.com';

const REVIEW_EMAIL_CONTENT = {
  pt: {
    subject: 'Como correu a sua encomenda? 🌟',
    preheader: 'Adoraríamos saber a sua opinião',
    greeting: (name) => `Olá ${name},`,
    p1: 'Esperamos que a sua encomenda tenha chegado em perfeitas condições e que esteja a adorar o(s) produto(s).',
    p2: 'A YSP Collective é uma marca jovem e cada avaliação faz uma diferença enorme para nós. Se tiver um minuto, ficávamos muito gratos se partilhasse a sua experiência no Trustpilot — honestamente, mesmo que tenha corrido menos bem, queremos saber.',
    cta: 'Deixar uma Avaliação',
    p3: 'Obrigado por nos ter dado uma oportunidade. Se tiver alguma questão ou preocupação, responda directamente a este e-mail — estou aqui para ajudar.',
    sign: 'Stephen',
    sign_sub: 'YSP Collective, Portugal',
  },
  es: {
    subject: '¿Cómo fue su pedido? 🌟',
    preheader: 'Nos encantaría conocer su opinión',
    greeting: (name) => `Hola ${name},`,
    p1: 'Esperamos que su pedido haya llegado en perfectas condiciones y que esté disfrutando de los productos.',
    p2: 'YSP Collective es una marca joven y cada reseña marca una gran diferencia para nosotros. Si tiene un minuto, le estaríamos muy agradecidos si compartiera su experiencia en Trustpilot — honestamente, aunque algo no haya ido bien, nos gustaría saberlo.',
    cta: 'Dejar una Reseña',
    p3: 'Gracias por darnos una oportunidad. Si tiene alguna pregunta o inquietud, responda directamente a este correo — estoy aquí para ayudar.',
    sign: 'Stephen',
    sign_sub: 'YSP Collective, Portugal',
  },
  en: {
    subject: 'How was your order? 🌟',
    preheader: 'We\'d love to hear from you',
    greeting: (name) => `Hi ${name},`,
    p1: 'We hope your order arrived in perfect condition and that you\'re enjoying the product(s).',
    p2: 'YSP Collective is a young brand and every review makes a huge difference to us. If you have a minute, we\'d be incredibly grateful if you could share your experience on Trustpilot — honestly, even if something didn\'t go quite right, we want to know.',
    cta: 'Leave a Review',
    p3: 'Thank you for giving us a chance. If you have any questions or concerns, just reply to this email — I\'m here to help.',
    sign: 'Stephen',
    sign_sub: 'YSP Collective, Portugal',
  },
};

function buildReviewEmailHtml(lang, firstName) {
  const c = REVIEW_EMAIL_CONTENT[lang] || REVIEW_EMAIL_CONTENT.en;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#1a1916;letter-spacing:0.06em;margin:0;">YSP</p>
      <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#8a847a;margin:2px 0 0;">COLLECTIVE</p>
    </div>

    <!-- Card -->
    <div style="background:#faf8f5;padding:40px 40px 32px;border:1px solid #e6dfd4;">

      <p style="font-size:16px;color:#1a1916;margin:0 0 20px;line-height:1.6;">${c.greeting(firstName)}</p>

      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 16px;">${c.p1}</p>

      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 32px;">${c.p2}</p>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${REVIEW_LINK}"
           style="display:inline-block;padding:14px 36px;background:#9c7b56;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          ${c.cta} →
        </a>
      </div>

      <!-- Divider -->
      <div style="border-top:1px solid #e6dfd4;margin:0 0 24px;"></div>

      <p style="font-size:14px;color:#8a847a;line-height:1.8;margin:0 0 24px;">${c.p3}</p>

      <p style="font-size:15px;color:#1a1916;margin:0;">
        ${c.sign}<br>
        <span style="font-size:12px;color:#b5afa5;">${c.sign_sub}</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;">
      <p style="font-size:11px;color:#b5afa5;margin:0;line-height:1.7;">
        YSP Collective · Portugal, EU<br>
        <a href="https://yspcollective.com" style="color:#9c7b56;text-decoration:none;">yspcollective.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

async function sendReviewEmail(env, { toEmail, toName, lang }) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not configured');

  const c = REVIEW_EMAIL_CONTENT[lang] || REVIEW_EMAIL_CONTENT.en;
  const firstName = toName.split(' ')[0] || toName;

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: 'Stephen from YSP Collective', email: 'info@yspcollective.com' },
      to: [{ email: toEmail, name: toName }],
      subject: c.subject,
      htmlContent: buildReviewEmailHtml(lang, firstName),
      headers: {
        'X-Mailin-custom': 'review-request',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
  return true;
}

// ── LANGUAGE DETECTION ───────────────────────────────────────────────────────
function detectLang(stripeSession) {
  if (stripeSession.metadata?.lang) {
    const l = stripeSession.metadata.lang;
    if (['pt', 'es', 'en'].includes(l)) return l;
  }
  const country = stripeSession.shipping?.address?.country ||
                  stripeSession.customer_details?.address?.country || '';
  if (country === 'PT') return 'pt';
  if (country === 'ES') return 'es';
  return 'en';
}

// ── PRODUCT CATALOGUE ────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    name: "Lattafa Yara 100ml",
    url: "https://yspcollective.com/products/lattafa-yara-100ml.html",
    price: "€29.55",
    brand: "Lattafa",
    gender: "Women",
    concentration: "EDP",
    size: "100ml",
    family: "Floral Fruity",
    top: "Raspberry, Pear, Mandarin",
    heart: "Jasmine, Iris, Muguet",
    base: "Musk, Sandalwood, Vanilla, Praline",
    accords: ["floral", "fruity", "sweet", "musky", "powdery"],
    longevity: "8–10 hours",
    projection: "Moderate–Strong",
    best_for: "Everyday, date night, spring/summer",
    summary: "Sweet, fruity-floral with a clean musky finish. Fresh and feminine — one of Lattafa's most popular. Viral on TikTok.",
    ysp_thoughts: "A brilliant everyday fragrance for women who want something sweet but not heavy. Incredible value."
  },
  {
    name: "Lattafa Khamrah Qahwa 100ml",
    url: "https://yspcollective.com/products/lattafa-edp-khamrah-qahwa-unisex-perfume-100ml.html",
    price: "€34",
    brand: "Lattafa",
    gender: "Unisex",
    concentration: "EDP",
    size: "100ml",
    family: "Oriental / Coffee",
    top: "Coffee, Saffron, Cardamom",
    heart: "Rose, Oud, Incense",
    base: "Amber, Vanilla, Musk",
    accords: ["coffee", "oriental", "amber", "spicy", "smoky", "sweet"],
    longevity: "8–12 hours",
    projection: "Strong",
    best_for: "Autumn/winter, evenings, office",
    summary: "Qahwa is Arabic coffee — rich roasted coffee and saffron over deep oud and amber. Distinctive and long-lasting.",
    ysp_thoughts: "For those who want something truly different. The coffee note is gorgeous and the amber base lasts all day."
  },
  {
    name: "Lattafa Khamrah 100ml",
    url: "https://yspcollective.com/products/lattafa-khamrah-eau-de-parfum-100ml-unisex-fragrance.html",
    price: "€34",
    brand: "Lattafa",
    gender: "Unisex",
    concentration: "EDP",
    size: "100ml",
    family: "Oriental Spicy / Gourmand",
    top: "Cinnamon, Nutmeg, Bergamot",
    heart: "Dates, Praline, Tuberose",
    base: "Vanilla, Tonka Bean, Benzoin, Myrrh, Amberwood",
    accords: ["spicy", "gourmand", "amber", "woody", "vanilla", "resinous"],
    longevity: "8–12+ hours",
    projection: "Strong",
    best_for: "Evening, autumn/winter, special occasions",
    summary: "Rich, spiced and deeply indulgent. Cinnamon-dates opening over a stunning resinous amber base. Fragrantica Readers' Choice 2024.",
    ysp_thoughts: "One of the most impressive value fragrances we stock. The cinnamon-date combination is extraordinary."
  },
  {
    name: "Armaf Club de Nuit Intense Man 105ml",
    url: "https://yspcollective.com/products/armaf-club-de-nuit-intense-105ml.html",
    price: "€29.55",
    brand: "Armaf",
    gender: "Men",
    concentration: "EDP",
    size: "105ml",
    family: "Woody Aromatic",
    top: "Lemon, Pineapple, Blackcurrant, Apple",
    heart: "Rose, Jasmine, Birch",
    base: "Ambergris, Musk, Vanilla, Patchouli",
    accords: ["woody", "fresh", "citrus", "smoky", "ambergris"],
    longevity: "8–12 hours",
    projection: "Moderate–Strong",
    best_for: "Office, evenings, year-round",
    summary: "The famous Aventus clone. Pineapple-citrus opening with distinctive smoky birch and ambergris drydown.",
    ysp_thoughts: "If someone wants the Creed Aventus DNA without the price tag — this is the answer."
  },
  {
    name: "Arabiyat Prestige Nyla 80ml",
    url: "https://yspcollective.com/products/arabiyat-prestige-nyla-80ml-eau-de-parfum-unisex-perfume.html",
    price: "€30",
    brand: "Arabiyat Prestige",
    gender: "Unisex",
    concentration: "EDP",
    size: "80ml",
    family: "Floral Oriental",
    accords: ["floral", "oriental", "warm", "sweet", "musky"],
    longevity: "6–8 hours",
    projection: "Moderate",
    best_for: "Everyday, all seasons",
    summary: "Warm, floral and approachable. A beautiful everyday unisex EDP with Middle Eastern elegance.",
    ysp_thoughts: "Arabiyat Prestige consistently delivers quality at a great price point. Nyla is a crowd-pleaser."
  },
  {
    name: "Beauty of Joseon Relief Sun SPF50+",
    url: "https://yspcollective.com/products/beauty-of-joseon-relief-sun-spf50.html",
    price: "€16",
    brand: "Beauty of Joseon",
    type: "beauty",
    category: "SPF / Sunscreen",
    size: "50ml",
    summary: "The K-beauty SPF that broke the internet. Lightweight, no white cast, dewy finish. Fragrance-free, reef-safe, all skin types.",
    ysp_thoughts: "Arguably the best affordable SPF on the market. No white cast, no greasy finish."
  },
  {
    name: "Anua PDRN Hyaluronic Acid Capsule 100 Serum",
    url: "https://yspcollective.com/products/anua-pdrn-hyaluronic-acid-capsule-100-serum.html",
    price: "€27.50",
    brand: "ANUA",
    type: "beauty",
    category: "Serum",
    size: "30ml",
    summary: "Clinical-grade PDRN serum with 11 types of hyaluronic acid. Dewy glass-skin finish.",
    ysp_thoughts: "PDRN is a next-level ingredient for hydration and skin repair. This is the real deal."
  },
  {
    name: "Anua Heartleaf Pore Control Cleansing Oil",
    url: "https://yspcollective.com/products/anua-heartleaf-control-cleansing-oil.html",
    price: "€18.30",
    brand: "ANUA",
    type: "beauty",
    category: "Cleanser",
    size: "200ml",
    summary: "Plant-based cleansing oil with 65% heartleaf extract. Removes makeup and SPF cleanly without stripping.",
    ysp_thoughts: "Best cleansing oil for sensitive or acne-prone skin. The heartleaf calms while it cleans."
  },
  {
    name: "Anua Heartleaf 70% Intense Calming Cream",
    url: "https://yspcollective.com/products/heartleaf-70-intense-calming-cream.html",
    price: "€26",
    brand: "ANUA",
    type: "beauty",
    category: "Moisturiser",
    size: "50ml",
    summary: "70% heartleaf extract moisturiser for sensitive and reactive skin. Rich but absorbs cleanly.",
    ysp_thoughts: "Perfect for anyone with redness or sensitivity. The high heartleaf concentration is genuinely effective."
  }
];

// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function buildSystemPrompt(userProfile = null) {
  let profileSection = '';
  if (userProfile) {
    profileSection = `
CUSTOMER PROFILE (use this to personalise all recommendations):
- Name: ${userProfile.firstName || 'Customer'}
- Interests: ${userProfile.interests || 'not set'}
- Fragrance preferences: ${JSON.stringify(userProfile.fragrancePrefs || {})}
- Beauty preferences: ${JSON.stringify(userProfile.beautyPrefs || {})}

Always address them by first name. Lead recommendations with what matches their profile before exploring alternatives.
`;
  }

  return `You are the YSP Collective fragrance and beauty advisor — a warm, knowledgeable assistant for a curated lifestyle brand based in Portugal. You have the personality of an expert friend who genuinely loves fragrance and skincare: enthusiastic, honest, and never pushy.

YSP Collective sells:
- Arabian/niche fragrances: Lattafa, Armaf, Arabiyat Prestige (and sourcing from Swiss Arabian, Rasasi, Gulf Orchid, Zimaya, Al Haramain)
- K-beauty skincare: Beauty of Joseon, ANUA
${profileSection}
CURRENT PRODUCT CATALOGUE:
${JSON.stringify(PRODUCTS, null, 2)}

YOUR ROLE:
1. Help customers find the perfect fragrance or skincare product through friendly conversation
2. Answer questions about products, ingredients, how to wear fragrances, skincare routines
3. Handle basic customer queries:
   - Shipping: 2–5 days EU, dispatched within 24 hours, from Portugal
   - Returns: 14 days, no hassle
   - Authenticity: all EU authorised stock, no grey market
   - Ordering: enquire via contact form or find on Amazon EU under "YSP Collective"
4. Be honest — if something isn't right for someone, say so

FRAGRANCE GUIDANCE:
- Ask about occasion, mood, and scent preferences before recommending
- Use the accord data to match recommendations accurately
- Always explain WHY a fragrance suits them based on what they said
- Mention longevity and projection honestly
- For Khamrah and Khamrah Qahwa: ALWAYS mention to use 1–2 sprays only — they are very potent

TONE:
- Warm, genuine, expert — like a knowledgeable friend, not a sales script
- Concise responses — no waffle, get to the point
- No markdown headers or bullet points — write in natural flowing sentences
- When recommending, always mention the product name and price
- If recommending multiple options, present them naturally in prose

If asked something outside your knowledge, direct to info@yspcollective.com`;
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const method = request.method;
    const url = new URL(request.url);

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/health') return json({ ok: true });

    // ── AUTH ──
    if (url.pathname === '/auth/register' && method === 'POST') return handleRegister(request, env);
    if (url.pathname === '/auth/login'    && method === 'POST') return handleLogin(request, env);
    if (url.pathname === '/auth/logout'   && method === 'POST') return handleLogout(request, env);
    if (url.pathname === '/auth/me'       && method === 'GET')  return handleMe(request, env);

    // ── PROFILE ──
    if (url.pathname === '/profile/save'  && method === 'POST') return handleProfileSave(request, env);
    if (url.pathname === '/profile'       && method === 'GET')  return handleProfileGet(request, env);

    // ── FAVOURITES ──
    if (url.pathname === '/favourites/toggle' && method === 'POST') return handleFavouriteToggle(request, env);
    if (url.pathname === '/favourites'        && method === 'GET')  return handleFavouritesGet(request, env);

    // ── COMMERCE ──
    if (url.pathname === '/checkout'      && method === 'POST') return handleCheckout(request, env);
    if (url.pathname === '/sync-product'  && method === 'POST') return handleSyncProduct(request, env);
    if (url.pathname === '/stripe-webhook'&& method === 'POST') return handleStripeWebhook(request, env);

    // ── AI ──
    if (url.pathname === '/chat'          && method === 'POST') return handleChat(request, env);

    // ── SUBSCRIBE ──
    if (url.pathname === '/subscribe'     && method === 'POST') return handleSubscribe(request, env);

    // ── REVIEWS ──
    if (url.pathname.startsWith('/reviews/') && method === 'GET')  return handleReviewsGet(url, env);
    if (url.pathname === '/reviews/submit'   && method === 'POST') return handleReviewSubmit(request, env);
    if (url.pathname === '/reviews/approve'  && method === 'POST') return handleReviewApprove(request, env);

    return json({ error: 'Not found' }, 404);
  },

  // Cron Trigger — runs daily at 9am UTC
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processScheduledReviewEmails(env));
  },
};

// ── STRIPE WEBHOOK ───────────────────────────────────────────────────────────
async function handleStripeWebhook(request, env) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return json({ error: 'Webhook secret not configured' }, 500);

  const payload = await request.text();
  const sigHeader = request.headers.get('stripe-signature') || '';

  const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
  if (!valid) return json({ error: 'Invalid signature' }, 400);

  let event;
  try { event = JSON.parse(payload); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.payment_status !== 'paid') return json({ ok: true });

    const customerEmail = session.customer_details?.email;
    const customerName  = session.customer_details?.name || 'Customer';
    if (!customerEmail) return json({ ok: true });

    const lang = detectLang(session);

    const sendAfter = Date.now() + 6 * 24 * 60 * 60 * 1000;
    const reviewKey = `review_pending:${session.id}`;

    await env.YSP_USERS.put(reviewKey, JSON.stringify({
      email: customerEmail,
      name: customerName,
      lang,
      sendAfter,
      sessionId: session.id,
    }), {
      expirationTtl: 30 * 24 * 60 * 60,
    });

    console.log(`Review email scheduled for ${customerEmail} in 6 days (lang: ${lang})`);
  }

  return json({ ok: true });
}

// ── SCHEDULED REVIEW EMAIL PROCESSOR ─────────────────────────────────────────
async function processScheduledReviewEmails(env) {
  const list = await env.YSP_USERS.list({ prefix: 'review_pending:' });
  const now = Date.now();
  let sent = 0;
  let errors = 0;

  for (const key of list.keys) {
    try {
      const raw = await env.YSP_USERS.get(key.name);
      if (!raw) continue;

      const pending = JSON.parse(raw);

      if (pending.sendAfter > now) continue;

      await sendReviewEmail(env, {
        toEmail: pending.email,
        toName: pending.name,
        lang: pending.lang || 'en',
      });

      await env.YSP_USERS.delete(key.name);
      sent++;
      console.log(`Review email sent to ${pending.email}`);

    } catch (err) {
      errors++;
      console.error(`Failed to send review email for ${key.name}:`, err.message);
    }
  }

  console.log(`Review emails: ${sent} sent, ${errors} errors`);
}

// ── CHECKOUT ─────────────────────────────────────────────────────────────────
async function handleCheckout(request, env) {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { items, success_url, cancel_url, lang } = body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'items array required' }, 400);
  }

  const lineItems = items.map(item => {
    if (item.priceId) {
      return { price: item.priceId, quantity: item.quantity || 1 };
    }
    return {
      price_data: {
        currency: 'eur',
        product_data: { name: item.name || 'Product' },
        unit_amount: Math.round((item.price || 0) * 100),
      },
      quantity: item.quantity || 1,
    };
  });

  const origin = request.headers.get('Origin') || 'https://yspcollective.com';
  const params = new URLSearchParams({
    mode: 'payment',
    'success_url': success_url || `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
    'cancel_url': cancel_url || `${origin}/`,
    'payment_method_types[]': 'card',
    'billing_address_collection': 'required',
    'shipping_address_collection[allowed_countries][0]': 'PT',
    'shipping_address_collection[allowed_countries][1]': 'ES',
  });

  if (lang) params.append('metadata[lang]', lang); params.append("custom_text[submit][message]", "By completing this order you confirm you have read our Terms & Conditions. Under EU consumer law you have the right to withdraw from this purchase within 14 days of receiving your order without giving any reason.");

  lineItems.forEach((li, i) => {
    if (li.price) {
      params.append(`line_items[${i}][price]`, li.price);
    } else {
      params.append(`line_items[${i}][price_data][currency]`, li.price_data.currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, li.price_data.product_data.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, li.price_data.unit_amount);
    }
    params.append(`line_items[${i}][quantity]`, li.quantity);
  });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || 'Stripe error' }, 502);
    return json({ url: data.url, sessionId: data.id });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ── SUBSCRIBE ─────────────────────────────────────────────────────────────────
async function handleSubscribe(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { email, lang, product, unsubscribe } = body;
  if (!email || !email.includes('@')) return json({ error: 'Valid email required' }, 400);

  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return json({ error: 'Email not configured' }, 500);

  try {
    if (unsubscribe) {
      const res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          email,
          listIds: [],
          unlinkListIds: [2, 3, 4],
          updateEnabled: true,
        }),
      });
      if (!res.ok && res.status !== 204) console.error('Brevo unsubscribe error:', await res.text());
    } else {
      const listId = lang === 'pt' ? 3 : lang === 'es' ? 4 : 2;
      const res = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({
          email,
          listIds: [listId],
          updateEnabled: true,
          attributes: {
            LANGUAGE: lang || 'en',
            ...(product ? { NOTIFY_PRODUCT: product } : {}),
          },
        }),
      });
      if (!res.ok && res.status !== 204) console.error('Brevo subscribe error:', await res.text());
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return json({ ok: true });
  }
}

// ── REVIEWS ───────────────────────────────────────────────────────────────────

// GET /reviews/{slug} — fetch approved reviews for a product
async function handleReviewsGet(url, env) {
  const slug = url.pathname.replace('/reviews/', '').replace(/\//g, '');
  if (!slug) return json({ error: 'slug required' }, 400);

  try {
    const list = await env.YSP_USERS.list({ prefix: `review:approved:${slug}:` });
    const reviews = [];

    for (const key of list.keys) {
      const raw = await env.YSP_USERS.get(key.name);
      if (raw) {
        try { reviews.push(JSON.parse(raw)); } catch(_) {}
      }
    }

    // Sort newest first
    reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return json({ reviews, count: reviews.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// POST /reviews/submit — submit a new review (goes to pending, awaits approval)
async function handleReviewSubmit(request, env) {
  let body;
  try { body = await request.json(); } catch(_) { return json({ error: 'Invalid JSON' }, 400); }

  const { slug, product_name, rating, name, email, title, body: reviewBody, photos } = body;

  if (!slug) return json({ error: 'slug required' }, 400);
  if (!rating || rating < 1 || rating > 5) return json({ error: 'rating must be 1–5' }, 400);
  if (!name || name.trim().length < 1) return json({ error: 'name required' }, 400);
  if (!email || !email.includes('@')) return json({ error: 'valid email required' }, 400);
  if (!reviewBody || reviewBody.trim().length < 15) return json({ error: 'review must be at least 15 characters' }, 400);

  // Check verified buyer via Stripe
  let verified_buyer = false;
  try {
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(email.toLowerCase().trim())}'&limit=1`,
        { headers: { 'Authorization': `Bearer ${stripeKey}` } }
      );
      if (customerRes.ok) {
        const customerData = await customerRes.json();
        if (customerData.data && customerData.data.length > 0) {
          const chargesRes = await fetch(
            `https://api.stripe.com/v1/charges?customer=${customerData.data[0].id}&limit=1`,
            { headers: { 'Authorization': `Bearer ${stripeKey}` } }
          );
          if (chargesRes.ok) {
            const chargesData = await chargesRes.json();
            verified_buyer = chargesData.data && chargesData.data.length > 0 &&
              chargesData.data.some(c => c.status === 'succeeded');
          }
        }
      }
    }
  } catch(err) {
    console.error('Stripe verification error:', err.message);
  }

  // Validate photos — base64 data URLs only, max 3, max ~2MB each
  const MAX_PHOTO_SIZE = 2.8 * 1024 * 1024;
  const cleanPhotos = [];
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 3)) {
      if (typeof p === 'string' && p.startsWith('data:image/') && p.length < MAX_PHOTO_SIZE) {
        cleanPhotos.push(p);
      }
    }
  }

  const ts = Date.now();
  const review = {
    slug,
    product_name: product_name || slug,
    rating: parseInt(rating),
    name: name.trim().substring(0, 60),
    email: email.toLowerCase().trim(),
    title: (title || '').trim().substring(0, 100),
    body: reviewBody.trim().substring(0, 1200),
    photos: cleanPhotos,
    verified_buyer,
    created_at: new Date().toISOString(),
    ip: request.headers.get('CF-Connecting-IP') || '',
  };

  const pendingKey = `review:pending:${slug}:${ts}`;
  await env.YSP_USERS.put(pendingKey, JSON.stringify(review), {
    expirationTtl: 90 * 24 * 60 * 60,
  });

  // Notify admin via Brevo
  try {
    await sendReviewAdminNotification(env, { review, pendingKey });
  } catch(err) {
    console.error('Review admin notification failed:', err.message);
  }

  console.log(`Review pending for ${slug} from ${email} (verified: ${verified_buyer})`);
  return json({ ok: true, verified_buyer });
}

// POST /reviews/approve — approve or reject a pending review (admin only)
async function handleReviewApprove(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const authSecret = env.AUTH_SECRET || 'ysp-default-secret';
  if (authHeader !== `Bearer ${authSecret}`) {
    return json({ error: 'Unauthorised' }, 401);
  }

  let body;
  try { body = await request.json(); } catch(_) { return json({ error: 'Invalid JSON' }, 400); }

  const { action, key } = body;
  if (!key || !key.startsWith('review:pending:')) {
    return json({ error: 'key must be a review:pending: key' }, 400);
  }
  if (!['approve', 'reject'].includes(action)) {
    return json({ error: 'action must be approve or reject' }, 400);
  }

  const raw = await env.YSP_USERS.get(key);
  if (!raw) return json({ error: 'Review not found or already processed' }, 404);

  let review;
  try { review = JSON.parse(raw); } catch(_) { return json({ error: 'Corrupt review data' }, 500); }

  await env.YSP_USERS.delete(key);

  if (action === 'approve') {
    const ts = new Date(review.created_at).getTime() || Date.now();
    const approvedKey = `review:approved:${review.slug}:${ts}`;

    // Strip private fields before storing the public record
    const { email: _email, ip: _ip, ...publicReview } = review;
    await env.YSP_USERS.put(approvedKey, JSON.stringify(publicReview), {
      expirationTtl: 3 * 365 * 24 * 60 * 60,
    });

    console.log(`Review approved: ${approvedKey}`);
    return json({ ok: true, action: 'approved', key: approvedKey });
  } else {
    console.log(`Review rejected: ${key}`);
    return json({ ok: true, action: 'rejected' });
  }
}

// Admin email notification when a new review is submitted
async function sendReviewAdminNotification(env, { review, pendingKey }) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return;

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const verifiedBadge = review.verified_buyer ? ' ✓ VERIFIED BUYER' : '';

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#9c7b56;">New Review Pending — YSP Collective</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
    <tr><td style="padding:6px 0;color:#888;width:120px;">Product</td><td><strong>${review.product_name}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#888;">Rating</td><td>${stars} (${review.rating}/5)</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Reviewer</td><td>${review.name}${verifiedBadge}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Email</td><td>${review.email}</td></tr>
    ${review.title ? `<tr><td style="padding:6px 0;color:#888;">Title</td><td>${review.title}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Review</td><td style="line-height:1.6;">${review.body}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Photos</td><td>${review.photos.length} photo${review.photos.length === 1 ? '' : 's'}</td></tr>
  </table>
  <p style="margin-bottom:0.5rem;font-weight:bold;">To approve:</p>
  <pre style="background:#f5f5f5;padding:12px;font-size:12px;overflow-x:auto;border-left:3px solid #9c7b56;">curl -X POST https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/reviews/approve \\
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"approve","key":"${pendingKey}"}'</pre>
  <p style="margin-bottom:0.5rem;font-weight:bold;">To reject:</p>
  <pre style="background:#f5f5f5;padding:12px;font-size:12px;overflow-x:auto;border-left:3px solid #888;">curl -X POST https://ysp-ai-proxy.rapid-shadow-439d.workers.dev/reviews/approve \\
  -H "Authorization: Bearer YOUR_AUTH_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"reject","key":"${pendingKey}"}'</pre>
</body>
</html>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: 'YSP Review System', email: 'info@yspcollective.com' },
      to: [{ email: 'info@yspcollective.com', name: 'Stephen' }],
      subject: `⭐ New ${review.rating}-star review pending — ${review.product_name}`,
      htmlContent: html,
    }),
  });
}

// ── AUTH HANDLERS ─────────────────────────────────────────────────────────────
async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { email, password, firstName, lastName } = body;
  if (!email || !password || !firstName) {
    return json({ error: 'email, password and firstName required' }, 400);
  }
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);

  const emailKey = `email:${email.toLowerCase().trim()}`;
  const existing = await env.YSP_USERS.get(emailKey);
  if (existing) return json({ error: 'An account with this email already exists' }, 409);

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const user = {
    userId,
    email: email.toLowerCase().trim(),
    firstName,
    lastName: lastName || '',
    passwordHash,
    createdAt: now,
    profileComplete: false,
    interests: null,
    fragrancePrefs: null,
    beautyPrefs: null,
  };

  await env.YSP_USERS.put(`user:${userId}`, JSON.stringify(user));
  await env.YSP_USERS.put(emailKey, userId);

  const token = await generateToken(userId, env.AUTH_SECRET || 'ysp-default-secret');
  const session = { userId, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  await env.YSP_USERS.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 30 * 24 * 60 * 60 });

  return json({ token, user: { userId, email: user.email, firstName, lastName: user.lastName, profileComplete: false } });
}

async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { email, password } = body;
  if (!email || !password) return json({ error: 'email and password required' }, 400);

  const userId = await env.YSP_USERS.get(`email:${email.toLowerCase().trim()}`);
  if (!userId) return json({ error: 'Invalid email or password' }, 401);

  const userData = await env.YSP_USERS.get(`user:${userId}`);
  if (!userData) return json({ error: 'Invalid email or password' }, 401);

  const user = JSON.parse(userData);
  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) return json({ error: 'Invalid email or password' }, 401);

  const token = await generateToken(userId, env.AUTH_SECRET || 'ysp-default-secret');
  const session = { userId, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  await env.YSP_USERS.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 30 * 24 * 60 * 60 });

  return json({ token, user: { userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName, profileComplete: user.profileComplete, interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs, createdAt: user.createdAt || null } });
}

async function handleLogout(request, env) {
  const token = getAuthToken(request);
  if (token) await env.YSP_USERS.delete(`session:${token}`);
  return json({ ok: true });
}

async function handleMe(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: 'Unauthorised' }, 401);
  return json({ userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName, profileComplete: user.profileComplete, interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs, createdAt: user.createdAt || null });
}

async function handleProfileSave(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: 'Unauthorised' }, 401);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { interests, fragrancePrefs, beautyPrefs } = body;
  const updated = { ...user, interests: interests || user.interests, fragrancePrefs: fragrancePrefs || user.fragrancePrefs, beautyPrefs: beautyPrefs || user.beautyPrefs, profileComplete: true };
  const { userId, ...toStore } = updated;
  await env.YSP_USERS.put(`user:${user.userId}`, JSON.stringify(toStore));
  return json({ ok: true, profileComplete: true });
}

async function handleProfileGet(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: 'Unauthorised' }, 401);
  return json({ interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs, profileComplete: user.profileComplete });
}

async function handleFavouriteToggle(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: 'Unauthorised' }, 401);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { slug, name, price, image, type } = body;
  if (!slug) return json({ error: 'slug required' }, 400);

  const favsKey = `favourites:${user.userId}`;
  const existing = await env.YSP_USERS.get(favsKey);
  let favs = existing ? JSON.parse(existing) : [];

  const idx = favs.findIndex(f => f.slug === slug);
  let action;
  if (idx > -1) { favs.splice(idx, 1); action = 'removed'; }
  else { favs.unshift({ slug, name, price, image, type, addedAt: new Date().toISOString() }); action = 'added'; }

  await env.YSP_USERS.put(favsKey, JSON.stringify(favs));
  return json({ ok: true, action, count: favs.length });
}

async function handleFavouritesGet(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: 'Unauthorised' }, 401);
  const favsKey = `favourites:${user.userId}`;
  const existing = await env.YSP_USERS.get(favsKey);
  return json({ favourites: existing ? JSON.parse(existing) : [] });
}

async function handleSyncProduct(request, env) {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { name, price, description, images, metadata } = body;
  if (!name || !price) return json({ error: 'name and price required' }, 400);

  const headers = { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' };

  try {
    const searchRes = await fetch(`https://api.stripe.com/v1/products/search?query=name:'${encodeURIComponent(name)}'&limit=1`, { headers });
    const searchData = await searchRes.json();

    let productId;
    if (searchData.data && searchData.data.length > 0) {
      productId = searchData.data[0].id;
    } else {
      const productParams = new URLSearchParams({ name });
      if (description) productParams.append('description', description);
      if (images && images[0]) productParams.append('images[]', images[0]);
      if (metadata) Object.entries(metadata).forEach(([k, v]) => productParams.append(`metadata[${k}]`, v));
      const productRes = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers, body: productParams.toString() });
      const productData = await productRes.json();
      if (!productRes.ok) return json({ error: productData.error?.message || 'Product create failed' }, 502);
      productId = productData.id;
    }

    const priceParams = new URLSearchParams({ product: productId, currency: 'eur', unit_amount: Math.round(price * 100) });
    const priceRes = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers, body: priceParams.toString() });
    const priceData = await priceRes.json();
    if (!priceRes.ok) return json({ error: priceData.error?.message || 'Price create failed' }, 502);

    return json({ productId, priceId: priceData.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleChat(request, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'Chat not configured' }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'Invalid JSON' }, 400); }

  const { messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: 'messages array required' }, 400);
  }

  let userProfile = null;
  const token = getAuthToken(request);
  if (token) {
    const user = await getUserFromToken(token, env);
    if (user && user.profileComplete) {
      userProfile = { firstName: user.firstName, interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs };
    }
  }

  const cleanMessages = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: String(m.content).substring(0, 2000) }));

  if (cleanMessages.length === 0) return json({ error: 'No valid messages' }, 400);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: buildSystemPrompt(userProfile), messages: cleanMessages }),
    });

    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || 'AI error' }, 502);
    const text = data.content?.find(c => c.type === 'text')?.text || '';
    return json({ content: text });
  } catch (err) {
    return json({ error: 'Internal error' }, 500);
  }
}
