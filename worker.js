// worker.js

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generateToken(userId, secret) {
  const payload = `${userId}:${Date.now()}:${Math.random()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return btoa(`${payload}|||${sigB64}`);
}

function getAuthToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
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

async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return false;
  // Reject webhooks older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

// ─── REVIEW EMAIL ─────────────────────────────────────────────────────────────

var REVIEW_LINK = "https://www.trustpilot.com/review/yspcollective.com";

var REVIEW_EMAIL_CONTENT = {
  pt: {
    subject: "Como correu a sua encomenda? 🌟",
    preheader: "Adoraríamos saber a sua opinião",
    greeting: (name) => `Olá ${name},`,
    p1: "Esperamos que a sua encomenda tenha chegado em perfeitas condições e que esteja a adorar o(s) produto(s).",
    p2: "A YSP Collective é uma marca jovem e cada avaliação faz uma diferença enorme para nós. Se tiver um minuto, ficávamos muito gratos se partilhasse a sua experiência no Trustpilot — honestamente, mesmo que tenha corrido menos bem, queremos saber.",
    cta: "Deixar uma Avaliação",
    p3: "Obrigado por nos ter dado uma oportunidade. Se tiver alguma questão ou preocupação, responda directamente a este e-mail — estou aqui para ajudar.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  },
  es: {
    subject: "¿Cómo fue su pedido? 🌟",
    preheader: "Nos encantaría conocer su opinión",
    greeting: (name) => `Hola ${name},`,
    p1: "Esperamos que su pedido haya llegado en perfectas condiciones y que esté disfrutando de los productos.",
    p2: "YSP Collective es una marca joven y cada reseña marca una gran diferencia para nosotros. Si tiene un minuto, le estaríamos muy agradecidos si compartiera su experiencia en Trustpilot — honestamente, aunque algo no haya ido bien, nos gustaría saberlo.",
    cta: "Dejar una Reseña",
    p3: "Gracias por darnos una oportunidad. Si tiene alguna pregunta o inquietud, responda directamente a este correo — estoy aquí para ayudar.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  },
  en: {
    subject: "How was your order? 🌟",
    preheader: "We'd love to hear from you",
    greeting: (name) => `Hi ${name},`,
    p1: "We hope your order arrived in perfect condition and that you're enjoying the product(s).",
    p2: "YSP Collective is a young brand and every review makes a huge difference to us. If you have a minute, we'd be incredibly grateful if you could share your experience on Trustpilot — honestly, even if something didn't go quite right, we want to know.",
    cta: "Leave a Review",
    p3: "Thank you for giving us a chance. If you have any questions or concerns, just reply to this email — I'm here to help.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  }
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
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#1a1916;letter-spacing:0.06em;margin:0;">YSP</p>
      <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#8a847a;margin:2px 0 0;">COLLECTIVE</p>
    </div>
    <div style="background:#faf8f5;padding:40px 40px 32px;border:1px solid #e6dfd4;">
      <p style="font-size:16px;color:#1a1916;margin:0 0 20px;line-height:1.6;">${c.greeting(firstName)}</p>
      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 16px;">${c.p1}</p>
      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 32px;">${c.p2}</p>
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${REVIEW_LINK}" style="display:inline-block;padding:14px 36px;background:#9c7b56;color:#ffffff;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          ${c.cta} →
        </a>
      </div>
      <div style="border-top:1px solid #e6dfd4;margin:0 0 24px;"></div>
      <p style="font-size:14px;color:#8a847a;line-height:1.8;margin:0 0 24px;">${c.p3}</p>
      <p style="font-size:15px;color:#1a1916;margin:0;">
        ${c.sign}<br>
        <span style="font-size:12px;color:#b5afa5;">${c.sign_sub}</span>
      </p>
    </div>
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
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");
  const c = REVIEW_EMAIL_CONTENT[lang] || REVIEW_EMAIL_CONTENT.en;
  const firstName = toName.split(" ")[0] || toName;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "Stephen from YSP Collective", email: "info@yspcollective.com" },
      to: [{ email: toEmail, name: toName }],
      subject: c.subject,
      htmlContent: buildReviewEmailHtml(lang, firstName),
      headers: { "X-Mailin-custom": "review-request" }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
  return true;
}

// ─── ORDER CONFIRMATION EMAIL ─────────────────────────────────────────────────

var ORDER_CONFIRM_CONTENT = {
  pt: {
    subject: "A sua encomenda foi confirmada ✓",
    greeting: (name) => `Olá ${name},`,
    p1: "Recebemos o seu pagamento e a sua encomenda está confirmada.",
    p2: "Iremos processar e enviar no prazo de 1 dia útil. Receberá uma notificação quando a sua encomenda for expedida.",
    order_label: "Referência da encomenda",
    items_label: "Resumo da encomenda",
    shipping_label: "Envio",
    total_label: "Total",
    free_shipping: "Grátis",
    p3: "Se tiver alguma questão, responda directamente a este e-mail — estou aqui para ajudar.",
    vat_note: "Precisa de uma factura com o seu NIF? Basta responder a este e-mail.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  },
  es: {
    subject: "Su pedido ha sido confirmado ✓",
    greeting: (name) => `Hola ${name},`,
    p1: "Hemos recibido su pago y su pedido está confirmado.",
    p2: "Lo procesaremos y enviaremos en el plazo de 1 día hábil. Recibirá una notificación cuando su pedido sea enviado.",
    order_label: "Referencia del pedido",
    items_label: "Resumen del pedido",
    shipping_label: "Envío",
    total_label: "Total",
    free_shipping: "Gratis",
    p3: "Si tiene alguna pregunta, responda directamente a este correo — estoy aquí para ayudar.",
    vat_note: "¿Necesita una factura con su NIE/NIF? Solo tiene que responder a este correo.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  },
  en: {
    subject: "Your order is confirmed ✓",
    greeting: (name) => `Hi ${name},`,
    p1: "We've received your payment and your order is confirmed.",
    p2: "We'll process and dispatch within 1 business day. You'll receive a notification once your order has shipped.",
    order_label: "Order reference",
    items_label: "Order summary",
    shipping_label: "Shipping",
    total_label: "Total",
    free_shipping: "Free",
    p3: "If you have any questions, just reply to this email — I'm here to help.",
    vat_note: "Need a VAT invoice with your NIF/NIE? Just reply to this email.",
    sign: "Stephen",
    sign_sub: "YSP Collective, Portugal"
  }
};

function buildOrderConfirmationHtml(lang, firstName, lineItems, total, shippingCost, orderNumber) {
  const c = ORDER_CONFIRM_CONTENT[lang] || ORDER_CONFIRM_CONTENT.en;
  const shippingDisplay = parseFloat(shippingCost) === 0 ? c.free_shipping : `€${parseFloat(shippingCost).toFixed(2)}`;

  const itemRows = lineItems.map((item) => {
    const name = item.description || item.price?.product?.name || "Product";
    const qty = item.quantity || 1;
    const unitAmount = item.price?.unit_amount ? (item.price.unit_amount / 100).toFixed(2) : "—";
    const lineTotal = item.amount_total ? (item.amount_total / 100).toFixed(2) : "—";
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e6dfd4;color:#1a1916;font-size:14px;line-height:1.5;">
          ${name}<br>
          <span style="color:#8a847a;font-size:12px;">Qty: ${qty} × €${unitAmount}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #e6dfd4;color:#1a1916;font-size:14px;text-align:right;vertical-align:top;">€${lineTotal}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">

    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#1a1916;letter-spacing:0.06em;margin:0;">YSP</p>
      <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:#8a847a;margin:2px 0 0;">COLLECTIVE</p>
    </div>

    <div style="background:#faf8f5;padding:40px 40px 32px;border:1px solid #e6dfd4;">

      <p style="font-size:16px;color:#1a1916;margin:0 0 20px;line-height:1.6;">${c.greeting(firstName)}</p>
      ${orderNumber ? `<p style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8a847a;margin:0 0 4px;">${c.order_label}</p><p style="font-size:18px;font-weight:600;color:#1a1916;letter-spacing:0.1em;margin:0 0 24px;">${orderNumber}</p>` : ""}
      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 8px;">${c.p1}</p>
      <p style="font-size:15px;color:#8a847a;line-height:1.8;margin:0 0 32px;">${c.p2}</p>

      <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8a847a;margin:0 0 12px;">${c.items_label}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${itemRows}
        <tr>
          <td style="padding:10px 0;color:#8a847a;font-size:13px;">${c.shipping_label}</td>
          <td style="padding:10px 0;color:#8a847a;font-size:13px;text-align:right;">${shippingDisplay}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;color:#1a1916;font-size:15px;font-weight:600;border-top:1px solid #e6dfd4;">${c.total_label}</td>
          <td style="padding:12px 0 0;color:#1a1916;font-size:15px;font-weight:600;text-align:right;border-top:1px solid #e6dfd4;">€${parseFloat(total).toFixed(2)}</td>
        </tr>
      </table>

      <div style="border-top:1px solid #e6dfd4;margin:24px 0;"></div>

      <p style="font-size:14px;color:#8a847a;line-height:1.8;margin:0 0 8px;">${c.p3}</p>
      <p style="font-size:13px;color:#b5afa5;line-height:1.8;margin:0 0 24px;">${c.vat_note}</p>

      <p style="font-size:15px;color:#1a1916;margin:0;">
        ${c.sign}<br>
        <span style="font-size:12px;color:#b5afa5;">${c.sign_sub}</span>
      </p>
    </div>

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

async function sendOrderConfirmationEmail(env, session, lineItems = [], orderNumber = null) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return;

  const customerEmail = session.customer_details?.email;
  const customerName = session.customer_details?.name || "Customer";
  if (!customerEmail) return;

  const firstName = customerName.split(" ")[0] || customerName;
  const lang = detectLang(session);
  const total = ((session.amount_total || 0) / 100).toFixed(2);
  const shippingCost = session.shipping_cost ? (session.shipping_cost.amount_total / 100).toFixed(2) : "0.00";

  const c = ORDER_CONFIRM_CONTENT[lang] || ORDER_CONFIRM_CONTENT.en;
  const html = buildOrderConfirmationHtml(lang, firstName, lineItems, total, shippingCost, orderNumber);

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "YSP Collective", email: "info@yspcollective.com" },
      to: [{ email: customerEmail, name: customerName }],
      subject: c.subject,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo order confirm error ${res.status}: ${err}`);
  }
}

async function sendOrderAdminNotification(env, session, lineItems, orderNumber = null) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return;

  const customerName = session.customer_details?.name || "Customer";
  const customerEmail = session.customer_details?.email || "—";
  const total = ((session.amount_total || 0) / 100).toFixed(2);
  const shippingCost = session.shipping_cost ? (session.shipping_cost.amount_total / 100).toFixed(2) : "0.00";
  const shippingDisplay = parseFloat(shippingCost) === 0 ? "Free" : `€${shippingCost}`;

  const addr = session.shipping?.address || session.customer_details?.address;
  const addressHtml = addr
    ? `${addr.line1 || ""}${addr.line2 ? ", " + addr.line2 : ""}, ${addr.city || ""}, ${addr.postal_code || ""}, ${addr.country || ""}`
    : "—";

  const itemRows = lineItems.map((item) => {
    const name = item.description || item.price?.product?.name || "Product";
    const qty = item.quantity || 1;
    const unitAmount = item.price?.unit_amount ? (item.price.unit_amount / 100).toFixed(2) : "—";
    const lineTotal = item.amount_total ? (item.amount_total / 100).toFixed(2) : "—";
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;">${name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:center;">${qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;">€${unitAmount}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;">€${lineTotal}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1916;background:#f3efe8;">
  <div style="background:#faf8f5;border:1px solid #e6dfd4;padding:32px;">

    <div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e6dfd4;">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:300;color:#1a1916;letter-spacing:0.06em;margin:0;">YSP</p>
      <p style="font-size:8px;letter-spacing:0.4em;text-transform:uppercase;color:#8a847a;margin:2px 0 8px;">COLLECTIVE</p>
      <p style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#9c7b56;margin:0;font-weight:500;">New Order Received</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${orderNumber ? `<tr>
        <td style="padding:6px 0;color:#8a847a;font-size:13px;width:130px;">Order Ref</td>
        <td style="padding:6px 0;font-size:13px;color:#1a1916;font-weight:600;letter-spacing:0.06em;">${orderNumber}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:6px 0;color:#8a847a;font-size:13px;width:130px;">Customer</td>
        <td style="padding:6px 0;font-size:13px;color:#1a1916;">${customerName}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#8a847a;font-size:13px;">Email</td>
        <td style="padding:6px 0;font-size:13px;color:#1a1916;">${customerEmail}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#8a847a;font-size:13px;">Ship to</td>
        <td style="padding:6px 0;font-size:13px;color:#1a1916;">${addressHtml}</td>
      </tr>
    </table>

    <p style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8a847a;margin:0 0 10px;">Items</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr>
          <th style="padding:6px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8a847a;text-align:left;border-bottom:1px solid #e6dfd4;">Product</th>
          <th style="padding:6px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8a847a;text-align:center;border-bottom:1px solid #e6dfd4;">Qty</th>
          <th style="padding:6px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8a847a;text-align:right;border-bottom:1px solid #e6dfd4;">Unit</th>
          <th style="padding:6px 0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8a847a;text-align:right;border-bottom:1px solid #e6dfd4;">Line</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;font-size:13px;color:#8a847a;">Shipping</td>
        <td style="padding:6px 0;font-size:13px;color:#8a847a;text-align:right;">${shippingDisplay}</td>
      </tr>
      <tr>
        <td style="padding:8px 0 0;font-size:15px;font-weight:600;color:#1a1916;border-top:1px solid #e6dfd4;">Total</td>
        <td style="padding:8px 0 0;font-size:15px;font-weight:600;color:#1a1916;text-align:right;border-top:1px solid #e6dfd4;">€${total}</td>
      </tr>
    </table>

  </div>
  <p style="text-align:center;font-size:11px;color:#b5afa5;margin:16px 0 0;">
    <a href="https://dashboard.stripe.com/payments" style="color:#9c7b56;text-decoration:none;">View in Stripe →</a>
  </p>
</body>
</html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "YSP Orders", email: "info@yspcollective.com" },
      to: [{ email: "info@yspcollective.com", name: "Stephen" }],
      subject: `🛍 New order ${orderNumber ? orderNumber + " — " : ""}${customerName} — €${total}`,
      htmlContent: html
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo admin notify error ${res.status}: ${err}`);
  }
}

// ─── LANGUAGE DETECTION ───────────────────────────────────────────────────────

function generateOrderNumber() {
  // Excludes 0/O and 1/I to avoid confusion when reading aloud or handwriting
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "YSP-";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function detectLang(stripeSession) {
  if (stripeSession.metadata?.lang) {
    const l = stripeSession.metadata.lang;
    if (["pt", "es", "en"].includes(l)) return l;
  }
  const country =
    stripeSession.shipping?.address?.country ||
    stripeSession.customer_details?.address?.country ||
    "";
  if (country === "PT") return "pt";
  if (country === "ES") return "es";
  return "en";
}

// ─── PRODUCTS & CHAT SYSTEM ───────────────────────────────────────────────────
// ── PRODUCT CATALOGUE: AUTO-GENERATED START ──
const PRODUCTS = [
  {
    "name": "Al Haramain Amber Oud Dubai Night Extrait de Parfum 100ml",
    "slug": "al-haramain-amber-oud-dubai-night",
    "url": "https://yspcollective.com/products/al-haramain-amber-oud-dubai-night.html",
    "price": "€49.99",
    "brand": "Al Haramain",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "oud",
      "amber",
      "saffron",
      "woody",
      "smoky",
      "floral",
      "incense",
      "resinous"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Woody Oriental Oud",
    "top": "Saffron, Bergamot, Elemi",
    "heart": "Agarwood, Bulgarian Rose, Lily of the Valley",
    "base": "Tonka Bean, Amber, White Must, Oakmoss",
    "longevity": "10+ hours",
    "projection": "Strong +",
    "best_for": "Night time wear, Winter/Spring/Autumn",
    "inspired_by": "Tom Ford Noir",
    "summary": "A bold, smoky oriental from Al Haramain — one of the Gulf's most established fragrance houses. Dubai Night is a dark, addictive blend of oud and amber with serious projection and all-night longevity.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Armaf Club de Nuit Intense 105ml",
    "slug": "armaf-club-de-nuit-intense-105ml",
    "url": "https://yspcollective.com/products/armaf-club-de-nuit-intense-105ml.html",
    "price": "€29.55",
    "brand": "Armaf",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "citrus",
      "fructured",
      "leather",
      "smoked",
      "woody",
      "aromatic",
      "sweet",
      "fresh",
      "musked"
    ],
    "concentration": "Eau de Toilette (EDT)",
    "size": "105ml",
    "family": "Woody Spicy",
    "top": "Lemon, Pineapple, Bergamot, Black Currant, Apple",
    "heart": "Rose, Birch, Jasmine",
    "base": "Musk, Ambergris, Patchouli, Vanilla",
    "longevity": "8–12 hours",
    "projection": "Strong",
    "best_for": "Evening wear, cooler seasons, formal and smart-casual occasions",
    "inspired_by": "Creed Aventus",
    "summary": "One of the most celebrated value fragrances in men's perfumery. Bold citrus-fruit opening, exceptional dry-down, 8–12 hour longevity.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Armaf Club de Nuit Intense 150ml",
    "slug": "armaf-club-de-nuit-intense-150ml",
    "url": "https://yspcollective.com/products/armaf-club-de-nuit-intense-150ml.html",
    "price": "€49.99",
    "brand": "Armaf",
    "gender": "Men",
    "stock": "low_stock",
    "accords": [
      "citrus",
      "fructured",
      "leather",
      "smoked",
      "woody",
      "aromatic",
      "sweet",
      "fresh",
      "musked"
    ],
    "concentration": "Parfum",
    "size": "150ml",
    "family": "Woody Fruity Smoky",
    "top": "Lemon, Pineapple, Bergamot, Black Currant, Apple",
    "heart": "Rose, Birch, Jasmine",
    "base": "Musk, Ambergris, Patchouli, Vanilla",
    "longevity": "10-14 hours",
    "projection": "Strong",
    "best_for": "Year-round, Office, Evening, Formal, Casual",
    "inspired_by": "Creed Aventus",
    "summary": "The finest concentration of one of fragrance's great value stories. The 150ml Parfum takes Club de Nuit Intense Man's legendary smoky birch and blackcurrant profile and refines it: smoother, earthier and more nuanced than the EDT or EDP, with exceptional longevity. A bold, confident masculine fragrance that consistently outperforms its price.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Armaf Odyssey Mandarin Sky Eau de Parfum 100ml",
    "slug": "armaf-odyssey-mandarin-sky-edp-100ml",
    "url": "https://yspcollective.com/products/armaf-odyssey-mandarin-sky-edp-100ml.html",
    "price": "€25",
    "brand": "Armaf",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "citrus",
      "caramel",
      "sweet",
      "woody",
      "amber"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Amber Citrus Woody",
    "top": "Mandarin Orange, Orange, Saffron, Sage",
    "heart": "Caramel, Tonka Bean, Marigold",
    "base": "Ambroxan, Cedar, Vetiver",
    "longevity": "8-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Spring, Summer, Daytime, Casual",
    "inspired_by": "Jean Paul Gaultier Scandal Pour Homme",
    "summary": "A bright, juicy burst of mandarin and orange that dries down",
    "ysp_thoughts": "<p>Mandarin Sky sits in the same territory as Jean Paul Gaultier's Scandal Pour Homme, that citrus-caramel-tonka DNA that's become one of the most crowd-pleasing fragrance profiles of recent years.</p>"
  },
  {
    "name": "Creed Aventus Eau de Parfum 100ml",
    "slug": "creed-aventus-eau-de-parfum",
    "url": "https://yspcollective.com/products/creed-aventus-eau-de-parfum.html",
    "price": "€310",
    "brand": "Creed",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "fruity",
      "sweet",
      "woody",
      "leather",
      "citrus",
      "smoky",
      "musky",
      "tropical",
      "fresh",
      "mossy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Fruity Chypre",
    "top": "Bergamot, Black Currant, Apple, Lemon, Pink Pepper",
    "heart": "Pineapple, Patchouli, Moroccan Jasmine",
    "base": "Birch, Musk, Oak moss, Cedarwood, Ambroxan",
    "longevity": "10-12 hours",
    "projection": "Moderate - Strong",
    "best_for": "Evening wear, smart-casual, formal occasions, cooler months",
    "summary": "The benchmark masculine. Creed Aventus EDP needs no introduction — smoky, fruity, and iconic, it remains the fragrance that every other masculine is measured against.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Creed Bois Du Portugal Eau De Parfum 100ml",
    "slug": "creed-bois-de-portugal",
    "url": "https://yspcollective.com/products/creed-bois-de-portugal.html",
    "price": "€295",
    "brand": "Creed",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "woody",
      "aromatic",
      "lavender",
      "citrus",
      "powdery",
      "fresh spicy",
      "amber"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Spicy Woody",
    "top": "Bergamot",
    "heart": "Lavender",
    "base": "Vetiver, Cedar, Ambergris, Sandalwood",
    "longevity": "10-12 hours",
    "projection": "Strong",
    "best_for": "Formal occasions, office, cooler seasons, evening wear",
    "summary": "A timeless aromatic classic from Creed with a direct connection to Portugal. Bois du Portugal is refined, understated, and deeply rooted in the landscape that inspired it — a fragrance we couldn't not carry.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Creed Viking Eau de Parfum 100ml",
    "slug": "creed-viking-eau-de-parfum",
    "url": "https://yspcollective.com/products/creed-viking-eau-de-parfum.html",
    "price": "€310",
    "brand": "Creed",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "aromatic",
      "fresh spicy",
      "green",
      "citrus",
      "soft spicy",
      "lavender",
      "woody"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Spicy Woody",
    "top": "Bergamot, Orange, Absinthe, Pink Pepper, Peppermint, Lemon",
    "heart": "Clove, Allspice, Jasmine, Orris Root, Bulgarian Rose, Lavender",
    "base": "White Musk, Tonka Bean, Cedar, Vetiver",
    "longevity": "10-12 hours",
    "projection": "Strong",
    "best_for": "Evening wear, cooler seasons, bold occasions, formal",
    "summary": "A bold, aromatic powerhouse from Creed — Viking is the house at its most intense and masculine. Spiced, woody, and built for those who wear fragrance with conviction.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Fragrance World Classy Chic Girl Eau de Parfum 90ml",
    "slug": "fragrance-world-classy-chic-girl-eau-de-parfum-90ml",
    "url": "https://yspcollective.com/products/fragrance-world-classy-chic-girl-eau-de-parfum-90ml.html",
    "price": "€19.90",
    "brand": "Fragrance World",
    "gender": "Women",
    "stock": "in_stock",
    "accords": [
      "floral",
      "gourmand",
      "sweet",
      "woody",
      "amber",
      "vanilla"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "90ml",
    "family": "Amber Floral Gourmand",
    "top": "Almond, Coffee, Bergamot, Lemon",
    "heart": "Tuberose, Jasmine, Orange Blossom, Rose",
    "base": "Tonka Bean, Cacao, Vanilla, Praline, Musk, Amber, Cinnamon, Patchouli, Cedar",
    "longevity": "6-9 hours",
    "projection": "Moderate",
    "best_for": "Evening, Autumn, Winter, Date Night",
    "inspired_by": "Carolina Herrera Good Girl",
    "summary": "The bold dual-character scent made famous by Carolina Herrera",
    "ysp_thoughts": "<p>Classy Chic Girl sits in one of our favourite value spots — a note pyramid that the fragrance community knows and loves, at a price that makes it an easy yes. The Good Girl DNA (tuberose + tonka + cacao) is very much present and accounted for.</p>"
  },
  {
    "name": "French Avenue Liquid Brun Eau de Parfum 100ml",
    "slug": "french-avenue-liquid-brun-eau-de-parfum-100ml",
    "url": "https://yspcollective.com/products/french-avenue-liquid-brun-eau-de-parfum-100ml.html",
    "price": "€37.90",
    "brand": "French Avenue",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "vanilla",
      "woody",
      "gourmand",
      "sweet",
      "amber",
      "spicy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Woody Vanilla Gourmand",
    "top": "Cinnamon, Bergamot, Cardamom, Orange Blossom",
    "heart": "Bourbon Vanilla, Elemi",
    "base": "Praline, Musk, Ambroxan, Guaiac Wood",
    "longevity": "7-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Evening, Autumn, Winter, Cold Weather",
    "inspired_by": "Parfums de Marly Althaïr",
    "summary": "One of the fragrance community's most talked-about value",
    "ysp_thoughts": "<p>Liquid Brun is one of the easiest recommends in our catalogue for autumn/winter. The vanilla here is genuinely quality — not sharp or synthetic — and the ambroxan base gives it that addictive skin-scent quality that the best fragrances share.</p>"
  },
  {
    "name": "Gulf Orchid Creamy Pistachio Eau de Parfum 100ml",
    "slug": "gulf-orchid-creamy-pistachio",
    "url": "https://yspcollective.com/products/gulf-orchid-creamy-pistachio.html",
    "price": "€33.50",
    "brand": "Gulf Orchid",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "citrus",
      "woody",
      "vanilla",
      "powdery",
      "green",
      "fresh spicy",
      "musky"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Gourmand Oriental",
    "top": "Bergamot, Pistachio, Apple",
    "heart": "Neroli, Cedarwood, Rose",
    "base": "Vanilla, Milk, Musk",
    "longevity": "6-8 hours",
    "projection": "Moderate",
    "best_for": "Daytime wear, spring/summer, casual occasions",
    "inspired_by": "Givenchy L'Interdit",
    "summary": "A playful, gourmand oriental from Gulf Orchid — warm pistachio and creamy sweetness wrapped in soft woods and musk. Unique, comforting, and surprisingly addictive.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Gulf Orchid Mango Ice Eau de Parfum 100ml",
    "slug": "gulf-orchid-mango-ice",
    "url": "https://yspcollective.com/products/gulf-orchid-mango-ice.html",
    "price": "€39.99",
    "brand": "Gulf Orchid",
    "gender": "Unisex",
    "stock": "last_one",
    "accords": [
      "fruity",
      "tropical",
      "sweet",
      "citrus",
      "fresh spicy",
      "musky",
      "fresh"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Fruity Floral",
    "top": "Mango, Lemon, Ginger, Rhubarb",
    "heart": "White Flowers, Amber, Licorice",
    "base": "Musk, Vanilla, Caramel, Chestnut",
    "longevity": "6-8 hours",
    "projection": "Moderate - Strong ",
    "best_for": "Daytime wear, summer, beach, casual occasions",
    "inspired_by": "God of Fire by Stéphane Humbert Lucas",
    "summary": "A fun, fruit-forward EDP from Gulf Orchid — juicy mango and cooling freshness balanced over a soft, musky base. Vibrant, approachable, and perfect for warmer days.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Khadlaj Azure Velvet Extrait de Parfum 100ml",
    "slug": "khadlaj-azure-velvet-extrait-de-parfum-100ml",
    "url": "https://yspcollective.com/products/khadlaj-azure-velvet-extrait-de-parfum-100ml.html",
    "price": "€33",
    "brand": "Khadlaj",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "woody",
      "aromatic",
      "fresh",
      "powdery",
      "floral",
      "amber"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Aromatic Woody",
    "top": "Bergamot, Lavender, Mint",
    "heart": "Floral Notes, Fruity Notes, Fresh Notes",
    "base": "Woody Notes, Powdery Notes, Incense",
    "longevity": "7-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Daily, Office, All Seasons",
    "inspired_by": "Parfums de Marly Layton",
    "summary": "A sophisticated unisex extrait in the world of Parfums de",
    "ysp_thoughts": "<p>Azure Velvet is one of the most impressive value propositions in our entire catalogue. Layton by Parfums de Marly has a near-cult following in the fragrance community — it's routinely listed among the greatest aromatic woodys of the modern era.</p>"
  },
  {
    "name": "Khadlaj Icon Eau de Parfum 100ml",
    "slug": "khadlaj-icon-eau-de-parfum-100ml",
    "url": "https://yspcollective.com/products/khadlaj-icon-eau-de-parfum-100ml.html",
    "price": "€35",
    "brand": "Khadlaj",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "woody",
      "aromatic",
      "amber",
      "citrus",
      "fresh spicy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Woody",
    "top": "Bergamot",
    "heart": "Lavender, Incense, Labdanum",
    "base": "Amber, Suede, Sandalwood",
    "longevity": "6-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Office, Evening, Special Occasions",
    "inspired_by": "Bleu de Chanel L'Exclusif ",
    "summary": "A bold, modern masculine from Khadlaj that opens with",
    "ysp_thoughts": "<p>We added Icon because it fills a gap we kept hearing about from customers — a confident men's fragrance that works from 9am to midnight without needing a refresh.</p>"
  },
  {
    "name": "Khadlaj Island Dreams Extrait de Parfum 100ml",
    "slug": "khadlaj-island-dreams-extrait-100ml",
    "url": "https://yspcollective.com/products/khadlaj-island-dreams-extrait-100ml.html",
    "price": "€39.90",
    "brand": "Other",
    "gender": "Unisex",
    "stock": "sold_out",
    "accords": [
      "citrus",
      "grapefruit",
      "ginger",
      "ambroxan",
      "fresh",
      "clean"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Citrus Aromatic",
    "top": "Bergamot, Ginger",
    "heart": "Grapefruit",
    "base": "Ambroxan, Musk",
    "longevity": "6-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Spring, Summer, Daytime, Office, Casual",
    "inspired_by": "Louis Vuitton Symphony",
    "summary": "A bright, citrus-forward extrait that opens with sparkling",
    "ysp_thoughts": "<p>Louis Vuitton Symphony has been one of the most talked-about fragrances of the last few years — that vibrant citrus-grapefruit-ambroxan combination has built a devoted following.</p>"
  },
  {
    "name": "Khadlaj Shiyaaka Snow Eau de Parfum 100ml",
    "slug": "khadlaj-shiyaaka-snow-eau-de-parfum-100ml",
    "url": "https://yspcollective.com/products/khadlaj-shiyaaka-snow-eau-de-parfum-100ml.html",
    "price": "€34.99",
    "brand": "Khadlaj",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "citrus",
      "aromatic",
      "woody",
      "fresh spicy",
      "clean"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Citrus Aromatic",
    "top": "Mandarin Orange, Bergamot, Citrus Notes",
    "heart": "Neroli, Nutmeg, Pink Pepper",
    "base": "Indonesian Vetiver Oil, Cardamom",
    "longevity": "5-8 hours",
    "projection": "Moderate",
    "best_for": "Daily, Spring, Summer, Office",
    "inspired_by": "Louis Vuitton Météore",
    "summary": "A clean, crisp unisex fresh that sits in the world of Louis",
    "ysp_thoughts": "<p>Shiyaaka Snow is one of those fragrances that punches well above its category. The Météore comparison is strong in the community — same clean citrus energy, same refined aromatic heart — but Shiyaaka Snow is a genuinely standalone quality fragrance regardless.</p>"
  },
  {
    "name": "Lattafa Ana Abiyedh Coral EDP 60ml",
    "slug": "lattafa-ana-abiyedh-coral-edp-60ml",
    "url": "https://yspcollective.com/products/lattafa-ana-abiyedh-coral-edp-60ml.html",
    "price": "€19.50",
    "brand": "Lattafa",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "watermelon",
      "peach",
      "coconut",
      "fruity",
      "tropical",
      "sweet",
      "floral"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "60ml",
    "family": "Floral Fruity",
    "top": "Watermelon, Peach, Orange",
    "heart": "Coconut, White Flowers",
    "base": "Vanilla, Amber, Musk",
    "longevity": "5-8 hours",
    "projection": "Moderate",
    "best_for": "Spring, Summer, Daytime, Beach, Casual",
    "inspired_by": "Wavechild by Room 1015",
    "summary": "A joyful, sun-drenched summer fragrance opening with juicy watermelon, peach and orange, evolving into a creamy tropical heart of coconut and white flowers, finishing softly with vanilla and amber. Ana Abiyedh Coral is sunshine in a bottle.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Ana Abiyedh Rouge Eau de Parfum 60ml",
    "slug": "lattafa-ana-abiyedh-rouge-edp-60ml",
    "url": "https://yspcollective.com/products/lattafa-ana-abiyedh-rouge-edp-60ml.html",
    "price": "€16.70",
    "brand": "Lattafa",
    "gender": "Women",
    "stock": "low_stock",
    "accords": [
      "sweet",
      "amber",
      "fruity",
      "woody",
      "salty"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "60ml",
    "family": "Woody Spicy",
    "top": "Nashi Pear, Kumquat, Bergamot",
    "heart": "Caramel, Geranium",
    "base": "Ambergris, Musk, Oakmoss",
    "longevity": "8-12 hours",
    "projection": "Strong",
    "best_for": "Evening, Date Night, All Seasons",
    "inspired_by": "Maison Francis Kurkdjian Baccarat Rouge 540 ",
    "summary": "A warm, sweet and slightly salty composition of pear, caramel and ambergris — one of the most complimented fragrances in the Lattafa range. Loud, long-lasting and genuinely addictive.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Bade'e Al Oud For Glory Eau de Parfum 100ml",
    "slug": "lattafa-badee-al-oud-for-glory",
    "url": "https://yspcollective.com/products/lattafa-badee-al-oud-for-glory.html",
    "price": "€27.50",
    "brand": "Lattafa",
    "gender": "Unisex",
    "stock": "sold_out",
    "accords": [
      "oud",
      "warm spicy",
      "fresh spicy",
      "patchouli",
      "metallic",
      "musky",
      "woody"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Woody Oriental Oud",
    "top": "Saffron, Nutmeg, Lavender",
    "heart": "Agarwood, Pathcouli",
    "base": "Agarwood, Pathouli, Musk",
    "longevity": "10-12 hours",
    "projection": "Strong",
    "best_for": "Evening wear, formal occasions, cooler seasons, night out",
    "inspired_by": "Tom Ford Oud Wood",
    "summary": "A rich, celebratory oud from Lattafa — one of Dubai's most",
    "ysp_thoughts": "<p>Lattafa has earned its reputation by consistently delivering at a price point that feels almost unfair for the quality.</p>"
  },
  {
    "name": "Lattafa Khamrah Qahwa 100ml",
    "slug": "lattafa-edp-khamrah-qahwa-unisex-perfume-100ml",
    "url": "https://yspcollective.com/products/lattafa-edp-khamrah-qahwa-unisex-perfume-100ml.html",
    "price": "€34",
    "brand": "Lattafa",
    "gender": "Unisex",
    "stock": "sold_out",
    "accords": [
      "coffee",
      "vanilla",
      "gourmand",
      "sweet",
      "spicy",
      "amber",
      "cinnamon",
      "cardamom",
      "warm",
      "resinous"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Vanilla / Gourmand",
    "top": "Cinnamon, Cardamom, Ginger",
    "heart": "Praline, Candied Fruits, White Flowers",
    "base": "Coffee, Vanilla, Tonka Bean, Benzoin, Musk",
    "longevity": "12–15 hours on skin; days on clothing",
    "projection": "Strong (1–2 sprays recommended)",
    "best_for": "Evening wear, autumn/winter, special occasions",
    "inspired_by": "Tom Ford Tobacco Vanille",
    "summary": "Khamrah's darker sibling — spiced coffee gourmand with extraordinary longevity. Fragrantica Readers' Choice Award winner 2024.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Khamrah 100ml",
    "slug": "lattafa-khamrah-eau-de-parfum-100ml-unisex-fragrance",
    "url": "https://yspcollective.com/products/lattafa-khamrah-eau-de-parfum-100ml-unisex-fragrance.html",
    "price": "€34",
    "brand": "Lattafa",
    "gender": "Unisex",
    "stock": "sold_out",
    "accords": [
      "vanilla",
      "gourmand",
      "sweet",
      "spicy",
      "amber",
      "tonka",
      "woody",
      "resinous",
      "cinnamon",
      "warm"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Spicy / Gourmand",
    "top": "Cinnamon, Nutmeg, Bergamot",
    "heart": "Dates, Praline, Tuberose, Mahonial",
    "base": "Vanilla, Tonka Bean, Benzoin, Myrrh, Amberwood, Akigalawood",
    "longevity": "8–12+ hours",
    "projection": "Strong — use 1–2 sprays",
    "best_for": "Evening wear, autumn/winter, special occasions",
    "inspired_by": "Kilian Angels' Share",
    "summary": "Rich, spiced and deeply indulgent. One of the most celebrated Arabic fragrances — bold cinnamon-dates opening, extraordinary resinous base.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Musamam White Intense EDP 100ml",
    "slug": "lattafa-musamam-white-intense-edp-100ml",
    "url": "https://yspcollective.com/products/lattafa-musamam-white-intense-edp-100ml.html",
    "price": "€39.50",
    "brand": "Lattafa",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "coconut",
      "spicy",
      "floral",
      "oriental",
      "sandalwood",
      "creamy",
      "woody"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Floral",
    "top": "Bergamot, Orange, Spices",
    "heart": "Coconut, Ylang Ylang, Ambroxan, Mahonial",
    "base": "Sandalwood, Benzoin, Musk",
    "longevity": "6-10 hours",
    "projection": "Moderate",
    "best_for": "Evening, Date night, Autumn, Winter, Year-round",
    "inspired_by": "BDK Parfums Gris Charnel",
    "summary": "An exotic, seductive unisex EDP opening with spiced bergamot and orange, revealing a rich heart of creamy coconut and ylang ylang over ambroxan, and settling into warm sandalwood and benzoin. Addictive, sophisticated and consistently complimented — the snake bottle earns every bit of its reputation.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Najdia EDP 100ml + Deodorant Spray 50ml",
    "slug": "lattafa-najdia-edp-100ml-deodorant-spray-50ml",
    "url": "https://yspcollective.com/products/lattafa-najdia-edp-100ml-deodorant-spray-50ml.html",
    "price": "€16.50",
    "brand": "Lattafa",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "aquatic",
      "fresh",
      "citrus",
      "woody",
      "spicy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml + 50ml",
    "family": "Aromatic Aquatic",
    "top": "Lemon, Apple, Cinnamon, Lemongrass, Bergamot",
    "heart": "Watery Notes, Lavender, Cardamom, Rosemary",
    "base": "Musk, Amber, Sandalwood, Cedar, Tobacco",
    "longevity": "8-12 hours",
    "projection": "Moderate to Strong",
    "best_for": "Spring, Summer, Daytime, Office, Gym",
    "inspired_by": "Paco Rabanne Invictus Aqua",
    "summary": "A fresh, energetic burst of citrus and aquatic notes with a",
    "ysp_thoughts": "<p>Najdia sits in the same world as Paco Rabanne Invictus Aqua and Rasasi Hawas, that clean, fresh aquatic-citrus profile that works on everyone and gets compliments from both men and women.</p>"
  },
  {
    "name": "Lattafa Pride Fakhar Platin Eau de Parfum 100ml",
    "slug": "lattafa-pride-fakhar-platin",
    "url": "https://yspcollective.com/products/lattafa-pride-fakhar-platin.html",
    "price": "€26.75",
    "brand": "Lattafa",
    "gender": "Men",
    "stock": "low_stock",
    "accords": [
      "woody",
      "spicy",
      "floral",
      "aromatic",
      "amber",
      "incense",
      "fresh spicy",
      "lavender"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Floral Woody Oriental",
    "top": "Bergamot, Pink Pepper, Cardamom",
    "heart": "Ginger, Lavender, Guava",
    "base": "Palo Santo, Incense, Sandalwood",
    "longevity": "10-12 hours",
    "projection": "Moderate",
    "best_for": "Evening wear, formal occasions, cooler seasons",
    "inspired_by": "Creed Silver Mountain Water",
    "summary": "A gleaming, luxury-coded oriental from Lattafa Pride — Fakhar Platin is polished, powerful, and positioned firmly at the prestige end of the Arabian fragrance spectrum.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Qaed al Fursan Eau de Parfum 90ml",
    "slug": "lattafa-qaed-al-fursan",
    "url": "https://yspcollective.com/products/lattafa-qaed-al-fursan.html",
    "price": "€19.95",
    "brand": "Lattafa",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "fruity",
      "sweet",
      "woody",
      "tropical",
      "fresh",
      "amber",
      "warm spicy",
      "oud"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "90ml",
    "family": "Aromatic Fresh Woody",
    "top": "Saffron, Pineapple",
    "heart": "Jasmine, Fir Balsam",
    "base": "Oud Wood, Cedarwood, Amber",
    "longevity": "8-10 hours",
    "projection": "Moderate - Strong",
    "best_for": "Evening wear, smart-casual, cooler seasons, date night",
    "inspired_by": "Creed Aventus",
    "summary": "A fresh, sophisticated masculine fragrance from Lattafa —",
    "ysp_thoughts": "<p>Some fragrances have a specific occasion, and some just work everywhere — Qaed Al Fursan is firmly in the second category.</p>"
  },
  {
    "name": "Lattafa Yara 100ml",
    "slug": "lattafa-yara-100ml",
    "url": "https://yspcollective.com/products/lattafa-yara-100ml.html",
    "price": "€19.55",
    "brand": "Lattafa",
    "gender": "Women",
    "stock": "sold_out",
    "accords": [
      "vanilla",
      "gourmand",
      "floral",
      "fruity",
      "sweet",
      "musk"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Vanilla",
    "top": "Orchid, Heliotrope, Tangerine",
    "heart": "Gourmand Accord, Tropical Fruits",
    "base": "Vanilla, Musk, Sandalwood",
    "longevity": "6–8 hours",
    "projection": "Moderate",
    "best_for": "Everyday wear, spring/summer, office, casual evenings",
    "summary": "Lattafa's most beloved feminine fragrance. Orchid and tangerine open bright, tropical fruits and gourmand notes build through the heart, and a long-lasting vanilla-musk-sandalwood base ties it all together. Sweet, addictive, and effortlessly wearable.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Lattafa Yara Candy Eau de Parfum 100ml",
    "slug": "lattafa-yara-candy-100ml",
    "url": "https://yspcollective.com/products/lattafa-yara-candy-100ml.html",
    "price": "€19.50",
    "brand": "Lattafa",
    "gender": "Women",
    "stock": "low_stock",
    "accords": [
      "strawberry",
      "fruity",
      "sweet",
      "vanilla",
      "candy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Amber Fruity",
    "top": "Green Mandarin, Blackcurrant",
    "heart": "Strawberry Fizz Candy, Gardenia",
    "base": "Vanilla Syrup, Sandalwood, Amber, Musk",
    "longevity": "8-12 hours",
    "projection": "Moderate",
    "best_for": "Spring, Summer, Daytime, Casual",
    "summary": "A fizzy, playful burst of green mandarin and blackcurrant opening into a heart of strawberry candy and gardenia, finishing with warm vanilla syrup and amber. Sweet, fun and surprisingly long-lasting.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Maison Alhambra Kismet for Men EDP 100ml",
    "slug": "maison-alhambra-kismet-for-men-edp-100ml",
    "url": "https://yspcollective.com/products/maison-alhambra-kismet-for-men-edp-100ml.html",
    "price": "€25",
    "brand": "Maison Alhambra",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "coffee",
      "chocolate",
      "vanilla",
      "woody",
      "spicy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Woody",
    "top": "Woody Notes, Nutmeg",
    "heart": "Patchouli, Coffee, Cacao, Sandalwood",
    "base": "Vanilla, Vetiver",
    "longevity": "8 - 10 hours",
    "projection": "Moderate",
    "best_for": "Evening, Autumn, Winter, Date Night",
    "inspired_by": "Kilian Black Phantom",
    "summary": "A rich, dark gourmand of nutmeg and woody spice opening into",
    "ysp_thoughts": "<p>Kilian's Black Phantom is one of the most celebrated dark gourmands in niche perfumery — coffee, rum, chocolate and vanilla in a composition that retails at around €255.</p>"
  },
  {
    "name": "Ministry of Gourmand\tCoconut Lagoon 100ml",
    "slug": "ministry-of-gourman-coconut-lagoon",
    "url": "https://yspcollective.com/products/ministry-of-gourman-coconut-lagoon.html",
    "price": "€39.50",
    "brand": "Paris Corner",
    "gender": "Unisex",
    "stock": "last_one",
    "accords": [
      "citrus",
      "coconut",
      "vanilla",
      "sweet",
      "ozonic",
      "aquatic",
      "caramel",
      "fruity"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Gourmand Tropical Floral",
    "top": "Lemon, Mandarin, Apple",
    "heart": "Watermelon, Caramel",
    "base": "Coconut, Vanilla",
    "longevity": "7-9 hours",
    "projection": "Moderate",
    "best_for": "Daytime wear, summer, beach, casual occasions",
    "summary": "A sun-drenched, tropical gourmand from Paris Corner — creamy",
    "ysp_thoughts": "<p>Ministry of Gourmand does exactly what the name suggests — they specialise in this space and it shows. Coconut Lagoon is the kind of fragrance that puts you in a good mood before you've even left the house.</p>"
  },
  {
    "name": "Miss Dior Parfum 50ml",
    "slug": "miss-dior-parfum",
    "url": "https://yspcollective.com/products/miss-dior-parfum.html",
    "price": "€99.95",
    "brand": "Dior",
    "gender": "Women",
    "stock": "sold_out",
    "accords": [
      "woody",
      "fruity",
      "amber",
      "sweet",
      "earthy",
      "patchouli",
      "floral",
      "warm"
    ],
    "concentration": "Parfum",
    "size": "50ml",
    "family": "Floral Chypre",
    "top": "Peach, Apricot, Mandarin Orange",
    "heart": "Floral notes, Jasmine, Wild Strawberry",
    "base": "Patchouli, Amberwood, Amber, Moss, Atlas Cedar",
    "longevity": "12+",
    "projection": "Moderate/Strong",
    "best_for": "Daytime wear, spring/summer, smart-casual, evening",
    "summary": "A timeless feminine icon reinvented. Miss Dior Parfum is the most intense, most intimate expression of the house's signature floral — refined, sensual, and unmistakably Dior.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Rasasi Hawas Eclat 100ml",
    "slug": "rasasi-hawas-eclat",
    "url": "https://yspcollective.com/products/rasasi-hawas-eclat.html",
    "price": "€39",
    "brand": "Rasasi",
    "gender": "Women",
    "stock": "sold_out",
    "accords": [],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Fresh Aquatic ",
    "top": "Litchi, Pear, Beramot, Pistachio",
    "heart": "Rose, Incense",
    "base": "Vanilla, Musk, Amber, Woodsy Notes",
    "longevity": "8-10 hours",
    "projection": "Moderate - Strong",
    "best_for": "Daytime wear, spring/summer, casual occasions, office",
    "inspired_by": "Delina da Parfums de Marly",
    "summary": "A lighter, brighter interpretation of the beloved Hawas line. Hawas Eclat brings a sparkling, citrus-led freshness that's effortlessly wearable and built for warmer days.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Rasasi Hawas Elixir Eau de Parfum 100ml",
    "slug": "rasasi-hawas-elixir",
    "url": "https://yspcollective.com/products/rasasi-hawas-elixir.html",
    "price": "€37.00",
    "brand": "Rasasi",
    "gender": "Unisex",
    "stock": "sold_out",
    "accords": [
      "aquatic",
      "vanilla",
      "chocolate",
      "mint",
      "amber",
      "spicy",
      "tonka",
      "musky",
      "dark",
      "oriental"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aquatic Oriental",
    "top": "Mint, Bergamot, Artemisia",
    "heart": "Dark Chocolate, Lavender, Benzoin",
    "base": "Vanilla, Tonka Bean, White Musk",
    "longevity": "8-10 hours",
    "projection": "Strong",
    "best_for": "Evening wear, cooler seasons, date night, autumn/winter",
    "inspired_by": "Jean Paul Gaultier Le Male Elixir",
    "summary": "A modern aquatic-oriental from Dubai's Rasasi — fresh and",
    "ysp_thoughts": "<p>Hawas already had our attention — it's one of those fragrances that genuinely surprised us when we first tried it.</p>"
  },
  {
    "name": "Rayhaan Aquatica Eau de Parfum 100ml",
    "slug": "rayhaan-aquatica-100ml",
    "url": "https://yspcollective.com/products/rayhaan-aquatica-100ml.html",
    "price": "€39.90",
    "brand": "Rayhaan",
    "gender": "Men",
    "stock": "last_one",
    "accords": [
      "citrus",
      "aquatic",
      "coconut",
      "rum",
      "tropical",
      "sweet"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Citrus Gourmand",
    "top": "Lime, Coconut Milk, Bergamot, Mandarin",
    "heart": "Sugar Cane, Jasmine, Hibiscus, Gardenia",
    "base": "Rum, Musk, Tonka Bean, Patchouli",
    "longevity": "6-8 hours",
    "projection": "Moderate",
    "best_for": "Summer, Holiday, Daytime",
    "inspired_by": "Creed Virgin Island Water ",
    "summary": "A sun-soaked citrus gourmand opening with zesty lime and",
    "ysp_thoughts": "<p>We stocked Aquatica because it solves a very specific problem: Creed Virgin Island Water is one of the most loved summer fragrances in the world, and it retails for around €350.</p>"
  },
  {
    "name": "Rayhaan Italia Pour Homme Eau de Parfum 100ml",
    "slug": "rayhaan-italia-pour-homme-100ml",
    "url": "https://yspcollective.com/products/rayhaan-italia-pour-homme-100ml.html",
    "price": "€34.90",
    "brand": "Rayhaan",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "honey",
      "tobacco",
      "vanilla",
      "lavender",
      "spicy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Woody",
    "top": "Lavender, Lemon, Bergamot",
    "heart": "Honey, Cinnamon, Cashmeran, Jasmine",
    "base": "Vanilla, Tobacco Leaf, Tonka Bean",
    "longevity": "8-12 hours",
    "projection": "Moderate - Strong",
    "best_for": "Evening, Date night, Autumn/Winter",
    "inspired_by": "Xerjoff XJ 1861 Naxos",
    "summary": "A rich, warm oriental opening of lavender, honey and cinnamon settling into a deeply sensual base of tobacco, vanilla and tonka bean. Sophisticated, long-lasting, and genuinely hard to put down.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Rayhaan Jungle Vibe Eau de Parfum 100ml",
    "slug": "rayhaan-jungle-vibe-eau-de-parfum-100ml",
    "url": "https://yspcollective.com/products/rayhaan-jungle-vibe-eau-de-parfum-100ml.html",
    "price": "€34.90",
    "brand": "Rayhaan",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "green",
      "woody",
      "citrus",
      "fresh",
      "fig",
      "musky"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Green Woody Fresh",
    "top": "Bergamot, Grapefruit",
    "heart": "Fig, Violet Leaf",
    "base": "Sandalwood, White Musk",
    "longevity": "6-8 hours",
    "projection": "Moderate",
    "best_for": "Daily, Warm Weather, Office, Casual",
    "inspired_by": "Dries Van Noten Santal Greenery",
    "summary": "A vibrant, nature-inspired fresh from Rayhaan. Bergamot and",
    "ysp_thoughts": "<p>Jungle Vibe impressed us with how wearable it is, clean and fresh but with enough character in the fig and violet leaf heart to avoid feeling generic. It's the kind of daily driver that gets quiet compliments rather than loud ones.</p>"
  },
  {
    "name": "Rayhaan Pacific Aura Eau de Parfum 100ml",
    "slug": "rayhaan-pacific-aura-eau-de-parfum-100ml",
    "url": "https://yspcollective.com/products/rayhaan-pacific-aura-eau-de-parfum-100ml.html",
    "price": "€34.90",
    "brand": "Rayhaan",
    "gender": "Men",
    "stock": "in_stock",
    "accords": [
      "citrus",
      "fresh",
      "aquatic",
      "aromatic",
      "green",
      "amber"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Aquatic Citrus",
    "top": "Citron, Mandarin, Mint, Bergamot, Black Currant, Coriander",
    "heart": "Basil, Rose, Carrot Seed",
    "base": "Amber, Fig, Ambroxan",
    "longevity": "7-10 hours",
    "projection": "Moderate to Strong",
    "best_for": "Summer, Daytime, Warm Weather, Casual",
    "inspired_by": "Louis Vuitton Pacific Chill",
    "summary": "A fresh coastal masculine that shares the spirit of Louis",
    "ysp_thoughts": "<p>Pacific Aura is one of the strongest value-for-performance propositions in the fresh/aquatic category right now. The comparison to LV Pacific Chill is widely cited by the fragrance community — same DNA, same vibe — but Pacific Aura beats the original on projection and longevity, which matters for day-to-day wear.</p>"
  },
  {
    "name": "Roja Parfums Danger Parfum Cologne Spray 100ml",
    "slug": "roja-parfums-danger-parfum",
    "url": "https://yspcollective.com/products/roja-parfums-danger-parfum.html",
    "price": "€335",
    "brand": "Roja Parfums",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "aromatic",
      "woody",
      "fresh spicy",
      "citrus",
      "lavender",
      "vanilla",
      "earthy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Leather Oriental",
    "top": "Lavender, Lemon, Begamot, Tarragon",
    "heart": "Violet, Jasmine, Lily of the Valley",
    "base": "Cumin, Oakmoss, Tonka Bean, Leather, Woody Notes, Vetiver, Galbanum",
    "longevity": "10-12+ hours",
    "projection": "Strong",
    "best_for": "Evening wear, formal occasions, cooler seasons, statement occasions",
    "summary": "A powerhouse masculine from one of Britain's most celebrated niche perfumers. Danger is bold, leather-forward, and unmistakably Roja — a fragrance that commands attention without seeking it.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Swiss Arabian Enigma of Taif Extrait de Parfum",
    "slug": "swiss-arabian-enigma-of-taif",
    "url": "https://yspcollective.com/products/swiss-arabian-enigma-of-taif.html",
    "price": "€63.50",
    "brand": "Swiss Arabian",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "rose",
      "floral",
      "saffron",
      "amber",
      "woody",
      "spicy",
      "incense",
      "smoky",
      "oriental",
      "plum"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Floral Oriental",
    "top": "Cardamom, Black Pepper, Pink Pepper, Elemi, Plum",
    "heart": "Taif Rose elevated by Saffron, Violet, Osmanthus, and Olibanum (Frankincense).",
    "base": "It settles into a warm, smoky trail of Oakwood, Molasses, Vetiver,",
    "longevity": "7-12+",
    "projection": "Strong",
    "best_for": "Evening wear, all seasons, special occasions, date night",
    "summary": "A warm, rosy oriental from one of Dubai's most respected fragrance houses. Enigma of Taif captures the legendary Taif rose of Saudi Arabia — rich, velvety, and deeply complex. Long-lasting and distinctly Arabian in character.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Swiss Arabian Soul of Bali Extrait de Parfum 100ml",
    "slug": "swiss-arabian-soul-of-bali",
    "url": "https://yspcollective.com/products/swiss-arabian-soul-of-bali.html",
    "price": "€69",
    "brand": "Swiss Arabian",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "tropical",
      "fruity",
      "floral",
      "spicy",
      "woody",
      "musk",
      "aquatic",
      "fresh",
      "saffron"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Floral Woody Oriental",
    "top": "Bergamot, Ginger, Pineapple, Rhubarb, Mango, Pink Pepper",
    "heart": "Aquatic notes, Saffron, Cardamom, Nutmeg, Olibanum",
    "base": "Sandalwood, Musk, Cypriol",
    "longevity": "7-12 hours",
    "projection": "Moderate - Strong",
    "best_for": "Daytime wear, spring/summer, casual occasions",
    "summary": "A lush, tropical escape bottled in an extrait. Soul of Bali blends exotic florals with warm, creamy woods — an escapist fragrance that's rich enough to wear as a signature scent.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Tom Ford Noir Eau de Parfum Spray 100ml",
    "slug": "tom-ford-noir-eau-de-parfum-spray",
    "url": "https://yspcollective.com/products/tom-ford-noir-eau-de-parfum-spray.html",
    "price": "€139.95",
    "brand": "Tom Ford",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "amber",
      "powdery",
      "fresh spicy",
      "woody",
      "violet",
      "patchouli",
      "earthy"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Oriental Woody Spicy",
    "top": "Violet, Caraway, Bergamot, Verbena, Pink Pepper",
    "heart": "Bulgarian Rose, Tuscan Iris, Black Pepper, Nutmeg, Clary Sage, Geranium",
    "base": "Amber, Vanilla, Civet, Styrax, Vetiver, Indonesian Pathouli Leaf,",
    "longevity": "10-12 hours",
    "projection": "Strong",
    "best_for": "Evening wear, formal occasions, date night, cooler seasons",
    "summary": "A dark, sophisticated oriental from one of fashion's most uncompromising creative forces. Tom Ford Noir is brooding, complex, and deeply masculine — a fragrance that means business.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Yves Saint Laurent Black Opium Eau de Parfum 50ml",
    "slug": "yves-saint-laurent-black-opium-eau-de-pafrum",
    "url": "https://yspcollective.com/products/yves-saint-laurent-black-opium-eau-de-pafrum.html",
    "price": "€85",
    "brand": "YSL",
    "gender": "Women",
    "stock": "sold_out",
    "accords": [
      "vanilla",
      "coffee",
      "swet",
      "white floral",
      "warm spicy",
      "woody",
      "fruity"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "50ml",
    "family": "Floral Gourmand Oriental",
    "top": "Pink Pepper, Pear, Orange Blossom",
    "heart": "Licorice, Coffee, Jasmine, Bitter Almond",
    "base": "Patchouli, Vanilla, Cashmere Wood, Cedar",
    "longevity": "8-10 hours",
    "projection": "Moderate/Strong ",
    "best_for": "Evening wear, date night, cooler seasons, autumn/winter",
    "summary": "The modern classic that turned an entire generation onto fragrance. Black Opium is bold, addictive, and as relevant today as the day it launched — coffee, vanilla, and white florals in perfect balance.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Zimaya Al Barari Coral EDP 100ml",
    "slug": "zimaya-al-barari-coral-edp-100ml",
    "url": "https://yspcollective.com/products/zimaya-al-barari-coral-edp-100ml.html",
    "price": "€29.90",
    "brand": "Zimaya",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "fruity",
      "mango",
      "citrus",
      "floral",
      "amber",
      "musk",
      "fresh"
    ],
    "concentration": "Eau de Parfum (EDP)",
    "size": "100ml",
    "family": "Aromatic Fruity",
    "top": "Bergamot, Orange, Ginger, Mango, Pear",
    "heart": "Orange Blossom, Cedar, Red Berries",
    "base": "Musk, Amber",
    "longevity": "5-7 hours",
    "projection": "Moderate",
    "best_for": "Spring, Summer, Daytime, Office, Casual",
    "inspired_by": "Ex Nihilo Blue Talisman",
    "summary": "A vibrant, sun-drenched unisex EDP opening with juicy mango, pear and bergamot sharpened with ginger, evolving into a soft floral-berry heart of orange blossom and red berries, finishing on warm amber and musk. Light, modern, effortlessly wearable.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Zimaya Sharaf Divine Extract de parfum 100ml",
    "slug": "zimaya-sharaf-divine",
    "url": "https://yspcollective.com/products/zimaya-sharaf-divine.html",
    "price": "€39.99",
    "brand": "Zimaya",
    "gender": "Unisex",
    "stock": "in_stock",
    "accords": [
      "fruity",
      "sweet",
      "warm spicy",
      "vanilla",
      "woody",
      "cinnamon",
      "amber",
      "rose"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Floral Woody Oriental Spicy",
    "top": "Raspberry, Cinnamon, Bergamot",
    "heart": "Apple, Caramel, Rose",
    "base": "Cognac, Vanilla, Amber, Tonka Beans, Moss",
    "longevity": "8-10 hours",
    "projection": "Strong",
    "best_for": "Evening wear, date night, cooler seasons, formal occasions",
    "inspired_by": "Angels' Share Paradis by Kilian",
    "summary": "A gourmand oriental that opens with playful raspberry and",
    "ysp_thoughts": "<p>This is the one that surprises people. Raspberry and cognac sounds like a cocktail — and in the best possible way, it is.</p>"
  },
  {
    "name": "Zimaya Sharaf the Club Extrait de Parfum 100ml",
    "slug": "zimaya-sharaf-the-club",
    "url": "https://yspcollective.com/products/zimaya-sharaf-the-club.html",
    "price": "€29.99",
    "brand": "Zimaya",
    "gender": "Men",
    "stock": "sold_out",
    "accords": [
      "fruity",
      "smoky",
      "woody",
      "birch",
      "mossy",
      "citrus",
      "amber",
      "leather",
      "sweet"
    ],
    "concentration": "Extrait de Parfum",
    "size": "100ml",
    "family": "Woody Oriental Spicy",
    "top": "Pineapple, Bergamot, Apple, White Flowers",
    "heart": "Birch, Amber, Orange Blossom",
    "base": "Oak moss, Ambergis, Musk ",
    "longevity": "10-12 hours",
    "projection": "Moderate - Strong",
    "best_for": "Evening wear, formal occasions, cooler seasons, smart-casual",
    "inspired_by": "Dior Sauvage Elixir",
    "summary": "A bold, clubby oriental from Zimaya — dark, spiced, and magnetic. Sharaf the Club is built for nights out and makes no apologies for it.",
    "ysp_thoughts": "|"
  },
  {
    "name": "Anua Heartleaf Pore Control Cleansing Oil",
    "slug": "anua-heartleaf-control-cleansing-oil",
    "url": "https://yspcollective.com/products/anua-heartleaf-control-cleansing-oil.html",
    "price": "€18.71",
    "brand": "ANUA",
    "gender": "",
    "stock": "sold_out",
    "accords": [],
    "type": "beauty",
    "category": "Cleanser",
    "size": "200ml",
    "summary": "The ideal first-step cleanser. Plant-based oils emulsify on",
    "ysp_thoughts": "We needed a cleansing oil that could sit confidently next to the rest of the Anua lineup — and this does exactly that. It does its job without any fuss: it removes everything, rinses clean, and leaves skin feeling like skin, not like it's just been scrubbed."
  },
  {
    "name": "Anua PDRN Hyaluronic Acid Capsule 100 Serum",
    "slug": "anua-pdrn-hyaluronic-acid-capsule-100-serum",
    "url": "https://yspcollective.com/products/anua-pdrn-hyaluronic-acid-capsule-100-serum.html",
    "price": "€24.69",
    "brand": "ANUA",
    "gender": "",
    "stock": "sold_out",
    "accords": [],
    "type": "beauty",
    "category": "Serum",
    "size": "30ml",
    "summary": "Clinical-grade PDRN in a daily serum. 11 types of hyaluronic",
    "ysp_thoughts": "This one caught our attention for the ingredient story alone. PDRN — the same compound used in clinical skin treatments — showing up in an affordable daily serum felt worth paying attention to. So we tried it."
  },
  {
    "name": "Beauty of Joseon Relief Sun SPF50+",
    "slug": "beauty-of-joseon-relief-sun-spf50",
    "url": "https://yspcollective.com/products/beauty-of-joseon-relief-sun-spf50.html",
    "price": "€16",
    "brand": "Beauty of Joseon",
    "gender": "",
    "stock": "sold_out",
    "accords": [],
    "type": "beauty",
    "category": "SPF / Sunscreen",
    "size": "50ml",
    "summary": "The K-beauty sunscreen that broke the internet. SPF50+ PA++++",
    "ysp_thoughts": "This is one of those products that genuinely lives up to the hype. We tried the Beauty of Joseon Relief Sun ourselves before ever listing it, and it immediately became a daily staple. It's the SPF that made us stop dreading sunscreen."
  },
  {
    "name": "Anua Heartleaf 70% Intense Calming Cream",
    "slug": "heartleaf-70-intense-calming-cream",
    "url": "https://yspcollective.com/products/heartleaf-70-intense-calming-cream.html",
    "price": "€26.00",
    "brand": "ANUA",
    "gender": "",
    "stock": "in_stock",
    "accords": [],
    "type": "beauty",
    "category": "Moisturiser",
    "size": "50ml",
    "summary": "70% heartleaf extract moisturiser for sensitive and reactive",
    "ysp_thoughts": "The Heartleaf 70% Intense Calming Cream was one of those additions that felt like a no-brainer the moment we tried it. We have a rule — nothing goes on the site unless we've used it — and this one passed immediately."
  }
];
// ── PRODUCT CATALOGUE: AUTO-GENERATED END ──

function buildSystemPrompt(userProfile = null) {
  let profileSection = "";
  if (userProfile) {
    profileSection = `
CUSTOMER PROFILE (use this to personalise all recommendations):
- Name: ${userProfile.firstName || "Customer"}
- Interests: ${userProfile.interests || "not set"}
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

TONE & LENGTH — STRICT RULES:
- Warm, genuine, expert — like a knowledgeable friend, not a sales script
- NO preamble. Do not write an intro sentence before recommending. Go straight to the product.
- Max 2 products per response. One sentence per product — tight, specific, no padding.
- Format each recommendation EXACTLY like this (one line, nothing before or after):
  [Product Name](url) — €price — one sentence on why it fits them.
- NO closing question. NO summary. Stop after the last recommendation.
- Never write bullet points, never write headers, never write paragraphs about a product.

RECOMMENDATION RULES — READ CAREFULLY:
- NEVER recommend a product where stock is "sold_out". Skip it entirely — act as if it doesn't exist.
- If stock is "last_one", recommend it but add "last one in stock" so they know to move fast.
- NEVER say we have "limited options", "not many options", "only one option", "our selection is small", or anything that implies scarcity or disappointment. It is never acceptable to apologise for the range.
- If even one product matches, go ALL IN on it. Present it as a deliberate, curated choice: "We've selected the very best in this category and here's why this is perfect for you."
- Always explain WHY each recommendation suits them specifically — mention the accords, the occasion, the longevity — make them feel like this is made for them.
- If you recommend one product, make it sound like the definitive answer, not a compromise. If two or three fit, present each as a strong, confident recommendation.
- Lean into the brand story: YSP Collective curates the best of Arabian niche fragrance and K-beauty — everything we stock is there for a reason.
- Only acknowledge a genuine gap (e.g. truly nothing in the catalogue fits at all) if no product can be stretched to work. Even then, suggest the closest match and explain what makes it interesting.

If asked something outside your knowledge, direct to info@yspcollective.com`;
}

// ─── ROUTING ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const method = request.method;
    const url = new URL(request.url);

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    if (url.pathname === "/health") return json({ ok: true });
    if (url.pathname === "/auth/register" && method === "POST") return handleRegister(request, env);
    if (url.pathname === "/auth/login" && method === "POST") return handleLogin(request, env);
    if (url.pathname === "/auth/logout" && method === "POST") return handleLogout(request, env);
    if (url.pathname === "/auth/me" && method === "GET") return handleMe(request, env);
    if (url.pathname === "/profile/save" && method === "POST") return handleProfileSave(request, env);
    if (url.pathname === "/profile" && method === "GET") return handleProfileGet(request, env);
    if (url.pathname === "/favourites/toggle" && method === "POST") return handleFavouriteToggle(request, env);
    if (url.pathname === "/favourites" && method === "GET") return handleFavouritesGet(request, env);
    if (url.pathname === "/checkout" && method === "POST") return handleCheckout(request, env);
    if (url.pathname === "/sync-product" && method === "POST") return handleSyncProduct(request, env);
    if (url.pathname === "/stripe-webhook" && method === "POST") return handleStripeWebhook(request, env);
    if (url.pathname === "/chat" && method === "POST") return handleChat(request, env);
    if (url.pathname === "/subscribe" && method === "POST") return handleSubscribe(request, env);
    if (url.pathname === "/reviews/pending" && method === "GET") return handleReviewsPending(request, env);
    if (url.pathname.startsWith("/reviews/") && method === "GET") return handleReviewsGet(url, env);
    if (url.pathname === "/reviews/submit" && method === "POST") return handleReviewSubmit(request, env);
    if (url.pathname === "/reviews/approve" && method === "POST") return handleReviewApprove(request, env);
    if (url.pathname.startsWith("/stock/") && method === "GET") return handleGetStock(url, env);
    if (url.pathname === "/admin/stock" && method === "GET") return handleAdminGetAllStock(request, env);
    if (url.pathname === "/admin/stock/set" && method === "POST") return handleAdminSetStock(request, env);
    if (url.pathname === "/admin/stock/bulk" && method === "POST") return handleAdminBulkSetStock(request, env);
    if (url.pathname === "/admin/seed-prices" && method === "POST") return handleAdminSeedPrices(request, env);
    return json({ error: "Not found" }, 404);
  },

  // Cron Trigger — runs daily at 9am UTC
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processScheduledReviewEmails(env));
  }
};

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────────

async function handleStripeWebhook(request, env) {
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return json({ error: "Webhook secret not configured" }, 500);

  const payload = await request.text();
  const sigHeader = request.headers.get("stripe-signature") || "";
  const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
  if (!valid) return json({ error: "Invalid signature" }, 400);

  let event;
  try {
    event = JSON.parse(payload);
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status !== "paid") return json({ ok: true });

    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name || "Customer";
    if (!customerEmail) return json({ ok: true });

    const lang = detectLang(session);

    // Fetch line items once — used by both emails
    let lineItems = [];
    try {
      const liRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=20&expand[]=data.price.product`,
        { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
      );
      if (liRes.ok) {
        const liData = await liRes.json();
        lineItems = liData.data || [];
      }
    } catch (err) {
      console.error("Failed to fetch line items:", err.message);
    }

    // Generate and store order number
    const orderNumber = generateOrderNumber();
    if (env.YSP_USERS) {
      await env.YSP_USERS.put(
        `order:${orderNumber}`,
        JSON.stringify({ sessionId: session.id, customer: customerName, email: customerEmail, total: session.amount_total, createdAt: Date.now() }),
        { expirationTtl: 365 * 24 * 60 * 60 }
      );
    }

    // Decrement stock for each purchased item
    if (env.YSP_USERS && lineItems.length > 0) {
      for (const li of lineItems) {
        const slug = li.price?.product?.metadata?.slug;
        if (!slug) continue;
        const stockStr = await env.YSP_USERS.get(`stock:${slug}`);
        if (stockStr !== null) {
          const newStock = Math.max(0, (parseInt(stockStr) || 0) - (li.quantity || 1));
          await env.YSP_USERS.put(`stock:${slug}`, String(newStock));
        }
      }
    }

    // 1. Send order confirmation to customer
    try {
      await sendOrderConfirmationEmail(env, session, lineItems, orderNumber);
      console.log(`Order confirmation sent to ${customerEmail}`);
    } catch (err) {
      console.error("Order confirmation email failed:", err.message);
    }

    // 2. Send admin notification to Stephen
    try {
      await sendOrderAdminNotification(env, session, lineItems, orderNumber);
      console.log(`Admin order notification sent`);
    } catch (err) {
      console.error("Admin order notification failed:", err.message);
    }

    // 3. Schedule review email for 6 days later
    const sendAfter = Date.now() + 6 * 24 * 60 * 60 * 1000;
    const reviewKey = `review_pending:${session.id}`;
    await env.YSP_USERS.put(
      reviewKey,
      JSON.stringify({ email: customerEmail, name: customerName, lang, sendAfter, sessionId: session.id }),
      { expirationTtl: 30 * 24 * 60 * 60 }
    );
    console.log(`Review email scheduled for ${customerEmail} in 6 days (lang: ${lang})`);
  }

  return json({ ok: true });
}

async function processScheduledReviewEmails(env) {
  const list = await env.YSP_USERS.list({ prefix: "review_pending:" });
  const now = Date.now();
  let sent = 0;
  let errors = 0;
  for (const key of list.keys) {
    try {
      const raw = await env.YSP_USERS.get(key.name);
      if (!raw) continue;
      const pending = JSON.parse(raw);
      if (pending.sendAfter > now) continue;
      await sendReviewEmail(env, { toEmail: pending.email, toName: pending.name, lang: pending.lang || "en" });
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

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────

async function handleCheckout(request, env) {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { items, success_url, cancel_url, lang, subtotal } = body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return json({ error: "items array required" }, 400);
  }

  // Check stock for each item before creating a Stripe session
  if (env.YSP_USERS) {
    for (const item of items) {
      const slug = item.id || item.slug;
      if (!slug) continue;
      const stockStr = await env.YSP_USERS.get(`stock:${slug}`);
      if (stockStr !== null) {
        const available = parseInt(stockStr) || 0;
        const requested = item.quantity || 1;
        if (available < requested) {
          const productName = item.name || slug;
          return json({
            error: available === 0
              ? `${productName} is currently out of stock`
              : `Only ${available} unit${available === 1 ? "" : "s"} of ${productName} available`,
            slug,
            available
          }, 400);
        }
      }
    }
  }

  // Look up authoritative priceIds from KV — overrides anything the client sends
  const lineItems = await Promise.all(items.map(async (item) => {
    const slug = item.id || item.slug;
    if (slug && env.YSP_USERS) {
      const kvRaw = await env.YSP_USERS.get(`price:${slug}`);
      if (kvRaw) {
        const { priceId } = JSON.parse(kvRaw);
        if (priceId) return { price: priceId, quantity: item.quantity || 1 };
      }
    }
    // Fall back to client-provided priceId, then dynamic price_data
    if (item.priceId) {
      return { price: item.priceId, quantity: item.quantity || 1 };
    }
    return {
      price_data: {
        currency: "eur",
        product_data: {
          name: item.name || "Product",
          metadata: { slug: slug || "" }
        },
        unit_amount: Math.round((item.price || 0) * 100)
      },
      quantity: item.quantity || 1
    };
  }));

  // Compute cart total from KV prices (authoritative) for shipping threshold
  let cartTotal = 0;
  for (const item of items) {
    const slug = item.id || item.slug;
    let unitPrice = item.price || 0;
    if (slug && env.YSP_USERS) {
      const kvRaw = await env.YSP_USERS.get(`price:${slug}`);
      if (kvRaw) {
        const kv = JSON.parse(kvRaw);
        if (kv.price) unitPrice = parseFloat(kv.price) || unitPrice;
      }
    }
    cartTotal += unitPrice * (item.quantity || 1);
  }

  const origin = request.headers.get("Origin") || "https://yspcollective.com";

  const params = new URLSearchParams({
    mode: "payment",
    "success_url": success_url || `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
    "cancel_url": cancel_url || `${origin}/`,
    "payment_method_types[]": "card",
    "billing_address_collection": "required",
    "phone_number_collection[enabled]": "true",
    "shipping_address_collection[allowed_countries][0]": "PT",
    "shipping_address_collection[allowed_countries][1]": "ES"
  });

  if (lang) params.append("metadata[lang]", lang);

  // Shipping — inline rate data (no pre-created Stripe rate needed)
  if (cartTotal >= 50) {
    params.append("shipping_options[0][shipping_rate_data][display_name]", "Free Shipping");
    params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "0");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");
  } else {
    params.append("shipping_options[0][shipping_rate_data][display_name]", "Standard Shipping");
    params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "595");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "1");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "4");
  }

  params.append(
    "custom_text[submit][message]",
    "By completing this order you confirm you have read our Terms & Conditions. Under EU consumer law you have the right to withdraw from this purchase within 14 days of receiving your order without giving any reason."
  );

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
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || "Stripe error" }, 502);
    return json({ url: data.url, sessionId: data.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── SUBSCRIBE ────────────────────────────────────────────────────────────────

async function handleSubscribe(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { email, lang, product, unsubscribe } = body;
  if (!email || !email.includes("@")) return json({ error: "Valid email required" }, 400);
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return json({ error: "Email not configured" }, 500);
  try {
    if (unsubscribe) {
      const res = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({ email, listIds: [], unlinkListIds: [2, 3, 4], updateEnabled: true })
      });
      if (!res.ok && res.status !== 204) console.error("Brevo unsubscribe error:", await res.text());
    } else {
      const listId = lang === "pt" ? 3 : lang === "es" ? 4 : 2;
      const res = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": apiKey },
        body: JSON.stringify({
          email,
          listIds: [listId],
          updateEnabled: true,
          attributes: { LANGUAGE: lang || "en", ...product ? { NOTIFY_PRODUCT: product } : {} }
        })
      });
      if (!res.ok && res.status !== 204) console.error("Brevo subscribe error:", await res.text());
    }
    return json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err.message);
    return json({ ok: true });
  }
}

// ─── REVIEWS ──────────────────────────────────────────────────────────────────

async function handleReviewsPending(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);
  try {
    const list = await env.YSP_USERS.list({ prefix: "review:pending:" });
    const reviews = [];
    for (const key of list.keys) {
      const raw = await env.YSP_USERS.get(key.name);
      if (raw) {
        try { reviews.push({ ...JSON.parse(raw), key: key.name }); } catch (_) {}
      }
    }
    reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json({ reviews, count: reviews.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleReviewsGet(url, env) {
  const slug = url.pathname.replace("/reviews/", "").replace(/\//g, "");
  if (!slug) return json({ error: "slug required" }, 400);
  try {
    const list = await env.YSP_USERS.list({ prefix: `review:approved:${slug}:` });
    const reviews = [];
    for (const key of list.keys) {
      const raw = await env.YSP_USERS.get(key.name);
      if (raw) {
        try { reviews.push(JSON.parse(raw)); } catch (_) {}
      }
    }
    reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json({ reviews, count: reviews.length });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function handleReviewSubmit(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { slug, product_name, rating, name, email, title, body: reviewBody, photos } = body;
  if (!slug) return json({ error: "slug required" }, 400);
  if (!rating || rating < 1 || rating > 5) return json({ error: "rating must be 1–5" }, 400);
  if (!name || name.trim().length < 1) return json({ error: "name required" }, 400);
  if (!email || !email.includes("@")) return json({ error: "valid email required" }, 400);
  if (!reviewBody || reviewBody.trim().length < 15) return json({ error: "review must be at least 15 characters" }, 400);

  let verified_buyer = false;
  try {
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      const customerRes = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(email.toLowerCase().trim())}'&limit=1`,
        { headers: { "Authorization": `Bearer ${stripeKey}` } }
      );
      if (customerRes.ok) {
        const customerData = await customerRes.json();
        if (customerData.data && customerData.data.length > 0) {
          const chargesRes = await fetch(
            `https://api.stripe.com/v1/charges?customer=${customerData.data[0].id}&limit=1`,
            { headers: { "Authorization": `Bearer ${stripeKey}` } }
          );
          if (chargesRes.ok) {
            const chargesData = await chargesRes.json();
            verified_buyer = chargesData.data && chargesData.data.length > 0 && chargesData.data.some((c) => c.status === "succeeded");
          }
        }
      }
    }
  } catch (err) {
    console.error("Stripe verification error:", err.message);
  }

  const MAX_PHOTO_SIZE = 2.8 * 1024 * 1024;
  const cleanPhotos = [];
  if (Array.isArray(photos)) {
    for (const p of photos.slice(0, 3)) {
      if (typeof p === "string" && p.startsWith("data:image/") && p.length < MAX_PHOTO_SIZE) {
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
    title: (title || "").trim().substring(0, 100),
    body: reviewBody.trim().substring(0, 1200),
    photos: cleanPhotos,
    verified_buyer,
    created_at: new Date().toISOString(),
    ip: request.headers.get("CF-Connecting-IP") || ""
  };

  const pendingKey = `review:pending:${slug}:${ts}`;
  await env.YSP_USERS.put(pendingKey, JSON.stringify(review), { expirationTtl: 90 * 24 * 60 * 60 });

  try {
    await sendReviewAdminNotification(env, { review, pendingKey });
  } catch (err) {
    console.error("Review admin notification failed:", err.message);
  }

  console.log(`Review pending for ${slug} from ${email} (verified: ${verified_buyer})`);
  return json({ ok: true, verified_buyer });
}

async function handleReviewApprove(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action, key } = body;
  if (!key || !key.startsWith("review:pending:")) return json({ error: "key must be a review:pending: key" }, 400);
  if (!["approve", "reject"].includes(action)) return json({ error: "action must be approve or reject" }, 400);

  const raw = await env.YSP_USERS.get(key);
  if (!raw) return json({ error: "Review not found or already processed" }, 404);

  let review;
  try {
    review = JSON.parse(raw);
  } catch (_) {
    return json({ error: "Corrupt review data" }, 500);
  }

  await env.YSP_USERS.delete(key);

  if (action === "approve") {
    const ts = new Date(review.created_at).getTime() || Date.now();
    const approvedKey = `review:approved:${review.slug}:${ts}`;
    const { email: _email, ip: _ip, ...publicReview } = review;
    await env.YSP_USERS.put(approvedKey, JSON.stringify(publicReview), { expirationTtl: 3 * 365 * 24 * 60 * 60 });
    console.log(`Review approved: ${approvedKey}`);
    return json({ ok: true, action: "approved", key: approvedKey });
  } else {
    console.log(`Review rejected: ${key}`);
    return json({ ok: true, action: "rejected" });
  }
}

async function sendReviewAdminNotification(env, { review, pendingKey }) {
  const apiKey = env.BREVO_API_KEY;
  if (!apiKey) return;
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const verifiedBadge = review.verified_buyer ? " ✓ VERIFIED BUYER" : "";
  const html = `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <h2 style="color:#9c7b56;">New Review Pending — YSP Collective</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
    <tr><td style="padding:6px 0;color:#888;width:120px;">Product</td><td><strong>${review.product_name}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#888;">Rating</td><td>${stars} (${review.rating}/5)</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Reviewer</td><td>${review.name}${verifiedBadge}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Email</td><td>${review.email}</td></tr>
    ${review.title ? `<tr><td style="padding:6px 0;color:#888;">Title</td><td>${review.title}</td></tr>` : ""}
    <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Review</td><td style="line-height:1.6;">${review.body}</td></tr>
    <tr><td style="padding:6px 0;color:#888;">Photos</td><td>${review.photos.length} photo${review.photos.length === 1 ? "" : "s"}</td></tr>
  </table>
  <div style="margin-top:1.5rem;text-align:center;">
    <a href="https://yspcollective.com/admin/reviews.html" style="display:inline-block;padding:0.9rem 2.5rem;background:#1a1916;color:#ffffff;text-decoration:none;font-size:0.8rem;letter-spacing:0.12em;text-transform:uppercase;">Review &amp; Approve →</a>
  </div>
  <p style="margin-top:1rem;font-size:0.78rem;color:#888;text-align:center;">Sign in with your admin password at yspcollective.com/admin/reviews.html</p>
</body>
</html>`;
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "YSP Review System", email: "info@yspcollective.com" },
      to: [{ email: "info@yspcollective.com", name: "Stephen" }],
      subject: `⭐ New ${review.rating}-star review pending — ${review.product_name}`,
      htmlContent: html
    })
  });
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { email, password, firstName, lastName } = body;
  if (!email || !password || !firstName) return json({ error: "email, password and firstName required" }, 400);
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);

  const emailKey = `email:${email.toLowerCase().trim()}`;
  const existing = await env.YSP_USERS.get(emailKey);
  if (existing) return json({ error: "An account with this email already exists" }, 409);

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const user = {
    userId, email: email.toLowerCase().trim(), firstName, lastName: lastName || "",
    passwordHash, createdAt: now, profileComplete: false,
    interests: null, fragrancePrefs: null, beautyPrefs: null
  };
  await env.YSP_USERS.put(`user:${userId}`, JSON.stringify(user));
  await env.YSP_USERS.put(emailKey, userId);

  const token = await generateToken(userId, env.AUTH_SECRET);
  const session = { userId, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  await env.YSP_USERS.put(`session:${token}`, JSON.stringify(session), { expirationTtl: 30 * 24 * 60 * 60 });
  return json({ token, user: { userId, email: user.email, firstName, lastName: user.lastName, profileComplete: false } });
}

async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { email, password } = body;
  if (!email || !password) return json({ error: "email and password required" }, 400);

  const userId = await env.YSP_USERS.get(`email:${email.toLowerCase().trim()}`);
  if (!userId) return json({ error: "Invalid email or password" }, 401);

  const userData = await env.YSP_USERS.get(`user:${userId}`);
  if (!userData) return json({ error: "Invalid email or password" }, 401);

  const user = JSON.parse(userData);
  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) return json({ error: "Invalid email or password" }, 401);

  const token = await generateToken(userId, env.AUTH_SECRET);
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
  if (!user) return json({ error: "Unauthorised" }, 401);
  return json({ userId: user.userId, email: user.email, firstName: user.firstName, lastName: user.lastName, profileComplete: user.profileComplete, interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs, createdAt: user.createdAt || null });
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

async function handleProfileSave(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: "Unauthorised" }, 401);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { interests, fragrancePrefs, beautyPrefs } = body;
  const updated = { ...user, interests: interests || user.interests, fragrancePrefs: fragrancePrefs || user.fragrancePrefs, beautyPrefs: beautyPrefs || user.beautyPrefs, profileComplete: true };
  const { userId, ...toStore } = updated;
  await env.YSP_USERS.put(`user:${user.userId}`, JSON.stringify(toStore));
  return json({ ok: true, profileComplete: true });
}

async function handleProfileGet(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: "Unauthorised" }, 401);
  return json({ interests: user.interests, fragrancePrefs: user.fragrancePrefs, beautyPrefs: user.beautyPrefs, profileComplete: user.profileComplete });
}

// ─── FAVOURITES ───────────────────────────────────────────────────────────────

async function handleFavouriteToggle(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: "Unauthorised" }, 401);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { slug, name, price, image, type } = body;
  if (!slug) return json({ error: "slug required" }, 400);
  const favsKey = `favourites:${user.userId}`;
  const existing = await env.YSP_USERS.get(favsKey);
  let favs = existing ? JSON.parse(existing) : [];
  const idx = favs.findIndex((f) => f.slug === slug);
  let action;
  if (idx > -1) {
    favs.splice(idx, 1);
    action = "removed";
  } else {
    favs.unshift({ slug, name, price, image, type, addedAt: new Date().toISOString() });
    action = "added";
  }
  await env.YSP_USERS.put(favsKey, JSON.stringify(favs));
  return json({ ok: true, action, count: favs.length });
}

async function handleFavouritesGet(request, env) {
  const token = getAuthToken(request);
  const user = await getUserFromToken(token, env);
  if (!user) return json({ error: "Unauthorised" }, 401);
  const favsKey = `favourites:${user.userId}`;
  const existing = await env.YSP_USERS.get(favsKey);
  return json({ favourites: existing ? JSON.parse(existing) : [] });
}

// ─── SYNC PRODUCT ─────────────────────────────────────────────────────────────

async function handleSyncProduct(request, env) {
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { name, price, description, images, metadata, slug, stock_quantity } = body;
  if (!name || !price) return json({ error: "name and price required" }, 400);
  const headers = { "Authorization": `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" };
  try {
    const searchRes = await fetch(`https://api.stripe.com/v1/products/search?query=name:'${encodeURIComponent(name)}'&limit=1`, { headers });
    const searchData = await searchRes.json();
    let productId;
    if (searchData.data && searchData.data.length > 0) {
      productId = searchData.data[0].id;
      // Update metadata on existing product so slug is always stored
      if (slug) {
        const updateParams = new URLSearchParams();
        updateParams.append("metadata[slug]", slug);
        await fetch(`https://api.stripe.com/v1/products/${productId}`, { method: "POST", headers, body: updateParams.toString() });
      }
    } else {
      const productParams = new URLSearchParams({ name });
      if (description) productParams.append("description", description);
      if (images && images[0]) productParams.append("images[]", images[0]);
      if (slug) productParams.append("metadata[slug]", slug);
      if (metadata) Object.entries(metadata).forEach(([k, v]) => productParams.append(`metadata[${k}]`, v));
      const productRes = await fetch("https://api.stripe.com/v1/products", { method: "POST", headers, body: productParams.toString() });
      const productData = await productRes.json();
      if (!productRes.ok) return json({ error: productData.error?.message || "Product create failed" }, 502);
      productId = productData.id;
    }

    // Sync stock to KV — only resets available stock when the admin changes the quantity
    if (slug && stock_quantity !== undefined && env.YSP_USERS) {
      const qty = parseInt(stock_quantity) || 0;
      const storedInitial = await env.YSP_USERS.get(`stock_initial:${slug}`);
      const initialQty = storedInitial !== null ? parseInt(storedInitial) : null;
      if (initialQty === null || qty !== initialQty) {
        await env.YSP_USERS.put(`stock:${slug}`, String(qty));
        await env.YSP_USERS.put(`stock_initial:${slug}`, String(qty));
      }
    }

    const priceParams = new URLSearchParams({ product: productId, currency: "eur", unit_amount: Math.round(price * 100) });
    const priceRes = await fetch("https://api.stripe.com/v1/prices", { method: "POST", headers, body: priceParams.toString() });
    const priceData = await priceRes.json();
    if (!priceRes.ok) return json({ error: priceData.error?.message || "Price create failed" }, 502);

    // Store the authoritative priceId and price in KV so checkout can enforce it instantly
    if (slug && env.YSP_USERS) {
      await env.YSP_USERS.put(`price:${slug}`, JSON.stringify({ priceId: priceData.id, price: String(price), productId }));
    }

    return json({ productId, priceId: priceData.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

async function handleChat(request, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: "Chat not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return json({ error: "messages array required" }, 400);
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
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: String(m.content).substring(0, 2000) }));
  if (cleanMessages.length === 0) return json({ error: "No valid messages" }, 400);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, system: buildSystemPrompt(userProfile), messages: cleanMessages })
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data.error?.message || "AI error" }, 502);
    const text = data.content?.find((c) => c.type === "text")?.text || "";
    return json({ content: text });
  } catch (err) {
    return json({ error: "Internal error" }, 500);
  }
}

// ─── STOCK ────────────────────────────────────────────────────────────────────

async function handleGetStock(url, env) {
  const slug = url.pathname.slice("/stock/".length);
  if (!slug) return json({ error: "slug required" }, 400);
  const stockStr = await env.YSP_USERS.get(`stock:${slug}`);
  if (stockStr === null) return json({ stock: null });
  return json({ stock: parseInt(stockStr) || 0 });
}

async function handleAdminGetAllStock(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);
  const list = await env.YSP_USERS.list({ prefix: "stock:" });
  const stock = {};
  for (const key of list.keys) {
    const slug = key.name.slice("stock:".length);
    const val = await env.YSP_USERS.get(key.name);
    stock[slug] = parseInt(val) || 0;
  }
  return json({ stock });
}

async function handleAdminSetStock(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON" }, 400); }
  const { slug, stock } = body;
  if (!slug) return json({ error: "slug required" }, 400);
  const qty = parseInt(stock);
  if (isNaN(qty) || qty < 0) return json({ error: "stock must be a non-negative integer" }, 400);
  await env.YSP_USERS.put(`stock:${slug}`, String(qty));
  await env.YSP_USERS.put(`stock_initial:${slug}`, String(qty));
  return json({ ok: true, slug, stock: qty });
}

async function handleAdminBulkSetStock(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON" }, 400); }
  const { items } = body;
  if (!Array.isArray(items)) return json({ error: "items array required" }, 400);
  let updated = 0;
  for (const item of items) {
    if (!item.slug || typeof item.stock !== "number") continue;
    const qty = Math.max(0, Math.round(item.stock));
    await env.YSP_USERS.put(`stock:${item.slug}`, String(qty));
    await env.YSP_USERS.put(`stock_initial:${item.slug}`, String(qty));
    updated++;
  }
  return json({ ok: true, updated });
}

async function handleAdminSeedPrices(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  const authSecret = env.AUTH_SECRET;
  if (authHeader !== `Bearer ${authSecret}`) return json({ error: "Unauthorised" }, 401);
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON" }, 400); }
  const { items } = body;
  if (!Array.isArray(items)) return json({ error: "items array required" }, 400);
  let seeded = 0;
  for (const item of items) {
    if (!item.slug || !item.priceId) continue;
    await env.YSP_USERS.put(`price:${item.slug}`, JSON.stringify({
      priceId: item.priceId,
      price: String(item.price || "0"),
      productId: item.productId || ""
    }));
    seeded++;
  }
  return json({ ok: true, seeded });
}
