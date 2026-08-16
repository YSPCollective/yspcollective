const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// This file lives at marketing/tester-guide/ in the repo, so the repo root
// is two levels up — works regardless of where the repo is checked out.
const REPO = path.join(__dirname, '..', '..');
const PRODUCTS_DIR = path.join(REPO, 'src', '_products', 'fragrances');
const OUT_DIR = process.argv[2] || __dirname;
const LANG = process.argv[3] === 'pt' ? 'pt' : 'en'; // node build-tester-guide.js [outdir] [pt]

// ---------- Translation (PT-PT) — UI chrome + fragrance accord vocabulary.
// Brand names, product names, and inspired-by reference names are never
// translated — they're real proper nouns, not descriptive copy.
const UI = {
  en: {
    topBar: 'Arabian &amp; Niche Fragrance Specialists &middot; Portugal, EU',
    title: 'Fragrance Tester Guide',
    subtitle: (n) => `${n} Fragrances &middot; In Stock &amp; Arriving Soon`,
    pageOf: (a, b) => `Page ${a} of ${b}`,
    inspiredBy: 'Inspired By',
    longevity: 'Longevity',
    projection: 'Projection',
    hrsSuffix: 'hrs',
    genders: { men: 'Men', women: 'Women', unisex: 'Unisex' },
    projLabels: { strong: 'Strong', strongPlus: 'Strong+', modStrong: 'Moderate–Strong', moderate: 'Moderate', light: 'Light' },
    footerTagline: 'Luxury Arabian Fragrances',
    htmlLang: 'en',
  },
  pt: {
    topBar: 'Especialistas em Fragrâncias Árabes e de Nicho &middot; Portugal, UE',
    title: 'Guia de Teste de Fragrâncias',
    subtitle: (n) => `${n} Fragrâncias &middot; Em Stock e a Chegar em Breve`,
    pageOf: (a, b) => `Página ${a} de ${b}`,
    inspiredBy: 'Inspirado Em',
    longevity: 'Duração',
    projection: 'Projeção',
    hrsSuffix: 'h',
    genders: { men: 'Masculino', women: 'Feminino', unisex: 'Unissexo' },
    projLabels: { strong: 'Forte', strongPlus: 'Forte+', modStrong: 'Moderado a Forte', moderate: 'Moderado', light: 'Leve' },
    footerTagline: 'Fragrâncias Árabes de Luxo',
    htmlLang: 'pt-PT',
  },
};
const T = UI[LANG];

const ACCORD_PT = {
  amber: 'Âmbar', ambroxan: 'Ambroxan', aquatic: 'Aquático', aromatic: 'Aromático',
  birch: 'Bétula', candy: 'Doce', caramel: 'Caramelo', cardamom: 'Cardamomo',
  chocolate: 'Chocolate', cinnamon: 'Canela', citrus: 'Cítrico', clean: 'Limpo',
  coconut: 'Coco', coffee: 'Café', creamy: 'Cremoso', dark: 'Escuro',
  earthy: 'Terroso', fig: 'Figo', floral: 'Floral', fresh: 'Fresco',
  'fresh spicy': 'Especiado Fresco', fructured: 'Frutado', fruity: 'Frutado',
  ginger: 'Gengibre', gourmand: 'Gourmand', grapefruit: 'Toranja', green: 'Verde',
  honey: 'Mel', incense: 'Incenso', lavender: 'Lavanda', leather: 'Couro',
  mango: 'Manga', marine: 'Marinho', metallic: 'Metálico', mint: 'Menta',
  mossy: 'Musgoso', musk: 'Almíscar', musked: 'Almiscarado', musky: 'Almiscarado',
  oriental: 'Oriental', oud: 'Oud', ozonic: 'Ozónico', patchouli: 'Patchouli',
  peach: 'Pêssego', plum: 'Ameixa', powdery: 'Empoado', resinous: 'Resinoso',
  rose: 'Rosa', rum: 'Rum', saffron: 'Açafrão', salty: 'Salgado',
  sandalwood: 'Sândalo', smoked: 'Fumado', smoky: 'Fumado', 'soft spicy': 'Especiado Suave',
  spicy: 'Especiado', strawberry: 'Morango', sweet: 'Doce', swet: 'Doce',
  tobacco: 'Tabaco', tonka: 'Tonka', tropical: 'Tropical', tuberose: 'Tuberosa',
  vanilla: 'Baunilha', violet: 'Violeta', warm: 'Quente', 'warm spicy': 'Especiado Quente',
  watermelon: 'Melancia', 'white floral': 'Floral Branco', woody: 'Amadeirado',
};

// in_stock/low_stock/last_one = currently sellable. on_order = confirmed restock
// arriving shortly, included per YSP so the guide reflects the shelf next week.
const ACTIVE = new Set(['in_stock', 'low_stock', 'last_one', 'on_order']);

// ---------- Extract ----------
const files = fs.readdirSync(PRODUCTS_DIR).filter(f => f.endsWith('.md'));
const products = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(PRODUCTS_DIR, f), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  const fm = yaml.load(m[1]);
  const status = fm.stock_status || 'in_stock';
  if (!fm.published || !ACTIVE.has(status)) continue;
  products.push(fm);
}

// Sort: by brand then name, for a tidy catalogue order
products.sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name));

console.log(`Active in-stock fragrances: ${products.length}`);

// ---------- Helpers ----------
function imgToDataUri(imgPath) {
  const full = path.join(REPO, imgPath.replace(/^\//, ''));
  if (!fs.existsSync(full)) {
    console.warn('MISSING IMAGE', imgPath);
    return '';
  }
  const ext = path.extname(full).toLowerCase();
  const mime = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
  const b64 = fs.readFileSync(full).toString('base64');
  return `data:${mime};base64,${b64}`;
}

function accordsToNotes(accordsText) {
  if (!accordsText) return '';
  return accordsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 4)
    .map(word => (LANG === 'pt' ? (ACCORD_PT[word] || word) : word).toUpperCase())
    .join(' &bull; ');
}

function longevityDots(text) {
  if (!text) return 3;
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  let avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 6;
  if (/\+/.test(text)) avg += 1.5;
  const dots = Math.round(avg / 2.2);
  return Math.max(1, Math.min(5, dots));
}

// Boils the free-text longevity field (which can run long, e.g. "12–15 hours
// on skin; days on clothing") down to a short "X-Y hrs" label to sit next to
// the dots — mirroring how projection shows its word label.
function longevityLabel(text) {
  if (!text) return '';
  const range = text.match(/(\d+)\s*[-–]\s*(\d+)\+?/);
  if (range) return `${range[1]}-${range[2]} ${T.hrsSuffix}`;
  const plus = text.match(/(\d+)\s*\+/);
  if (plus) return `${plus[1]}+ ${T.hrsSuffix}`;
  const single = text.match(/(\d+)\s*hours?/i);
  if (single) return `${single[1]} ${T.hrsSuffix}`;
  return text.trim();
}

function projectionInfo(text) {
  if (!text) return { dots: 3, label: T.projLabels.moderate };
  const t = text.toLowerCase();
  const hasStrong = /strong/.test(t);
  const hasModerate = /moderate/.test(t);
  const hasLight = /light|soft|intimate|skin/.test(t);
  let dots, label;
  if (hasStrong && hasModerate) { dots = 3; label = T.projLabels.modStrong; }
  else if (hasStrong && /\+/.test(t)) { dots = 5; label = T.projLabels.strongPlus; }
  else if (hasStrong) { dots = 4; label = T.projLabels.strong; }
  else if (hasModerate) { dots = 2; label = T.projLabels.moderate; }
  else if (hasLight) { dots = 1; label = T.projLabels.light; }
  else { dots = 3; label = text.trim(); }
  return { dots, label };
}

function genderLabel(raw) {
  const g = (raw || '').trim().toLowerCase();
  if (!g) return '';
  if (g === 'men') return T.genders.men;
  if (g === 'women') return T.genders.women;
  if (g === 'unisex') return T.genders.unisex;
  return raw.trim();
}

function dotsHtml(count, cls) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="dot ${cls}${i <= count ? ' on' : ''}"></span>`;
  }
  return html;
}

function money(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  return `&euro;${n.toFixed(2).replace(/\.00$/, '')}`;
}

function esc(s) {
  return (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Card builder ----------
function buildCard(p, num, extraClass) {
  const img = imgToDataUri(p.image_main);
  const notes = accordsToNotes(p.accords_text);
  const lDots = longevityDots(p.longevity);
  const lLabel = longevityLabel(p.longevity);
  const proj = projectionInfo(p.projection);
  const gender = genderLabel(p.gender || p.gender_label);
  // Single current price only — no strikethrough RRP on the printed guide.
  const priceHtml = `<span class="price-now">${money(p.price)}</span>`;

  // Only render an "Inspired By" block when the product actually has one —
  // never invent a comparison for fragrances sold as originals.
  const inspiredHtml = p.inspired_by_name
    ? `<div class="inspired">
         <div class="inspired-label">${T.inspiredBy}</div>
         <div class="inspired-name">${esc(p.inspired_by_name)}</div>
       </div>`
    : '';

  return `
  <div class="card${extraClass ? ' ' + extraClass : ''}">
    <div class="card-num">${String(num).padStart(2, '0')}</div>
    <div class="card-img"><img src="${img}" alt="${esc(p.name)}" /></div>
    <div class="card-body">
      <div class="card-head">
        <div class="card-name">${esc(p.name.replace(/\s*\d+ml\s*$/i, ''))}</div>
        <div class="card-brand">${esc(p.brand)}${gender ? ` &middot; ${esc(gender)}` : ''}</div>
      </div>
      ${inspiredHtml}
      <div class="notes">${notes}</div>
      <div class="rule"></div>
      <div class="stat-row">
        <span class="stat-label">${T.longevity}</span>
        <span class="dots">${dotsHtml(lDots, 'l')}</span>
        <span class="stat-word">${esc(lLabel)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${T.projection}</span>
        <span class="dots">${dotsHtml(proj.dots, 'p')}</span>
        <span class="stat-word">${esc(proj.label)}</span>
        <span class="price">${priceHtml}</span>
      </div>
    </div>
  </div>`;
}

// ---------- Page builder ----------
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,500&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap');

  :root{
    --black:#151210;
    --ink:#1c1815;
    --gold:#a9812e;
    --gold-soft:#c9a44f;
    --paper:#ffffff;
    --line:#e3e0d8;
    --grey:#726a5e;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;}
  body{
    background:#ededec;
    font-family:'DM Sans',sans-serif;
    color:var(--ink);
  }
  .page{
    width:210mm;
    min-height:297mm;
    margin:12mm auto;
    background:var(--paper);
    box-shadow:0 4px 30px rgba(0,0,0,.16);
    padding:14mm 13mm 11mm;
    position:relative;
  }
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @media print{
    @page{size:A4;margin:0;}
    body{background:#fff;}
    .page{margin:0;box-shadow:none;}
  }

  /* header */
  .top-bar{
    font-family:'DM Sans',sans-serif;
    font-size:8.5px;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:var(--gold);
    border-bottom:1px solid var(--line);
    padding-bottom:6px;
    margin-bottom:10px;
  }
  .header{
    display:flex;
    justify-content:space-between;
    align-items:flex-end;
    padding-bottom:14px;
    border-bottom:2px solid var(--black);
    margin-bottom:6px;
  }
  .logo{
    font-family:'Cormorant Garamond',serif;
    line-height:.85;
  }
  .logo-ysp{
    font-size:38px;
    font-weight:700;
    letter-spacing:.04em;
  }
  .logo-collective{
    font-family:'DM Sans',sans-serif;
    font-size:9.5px;
    letter-spacing:.42em;
    color:var(--grey);
    margin-top:4px;
  }
  .title-block{
    text-align:center;
    flex:1;
    padding:0 20px;
  }
  .title-block h1{
    font-family:'Cormorant Garamond',serif;
    font-weight:600;
    font-size:24px;
    letter-spacing:.06em;
    margin:0 0 4px;
    text-transform:uppercase;
  }
  .title-block .sub{
    font-size:9px;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--grey);
  }
  .page-badge{
    background:var(--black);
    color:var(--gold-soft);
    font-family:'DM Sans',sans-serif;
    text-align:center;
    padding:7px 14px;
    min-width:86px;
  }
  .page-badge .of{
    font-size:7.5px;
    letter-spacing:.14em;
    color:#cbbfa2;
    text-transform:uppercase;
  }
  .page-badge .range{
    font-family:'Cormorant Garamond',serif;
    font-size:19px;
    font-weight:600;
    letter-spacing:.03em;
    margin-top:2px;
  }

  /* grid — single grid in row-major (reading) order so paired cards share a
     grid row and auto-size to equal height; keeps the divider lines level
     across both columns instead of drifting out of sync down the page. */
  .grid{
    display:grid;
    grid-template-columns:1fr 1fr;
    column-gap:0;
    row-gap:0;
  }
  .card{
    display:flex;
    gap:14px;
    padding:13px 0;
    border-bottom:1px solid var(--line);
  }
  .card:nth-child(odd){padding-right:18px;border-right:1px solid var(--line);}
  .card:nth-child(even){padding-left:18px;}
  .card:nth-child(-n+2){padding-top:6px;}
  .card.last-row{border-bottom:none;}
  .card-num{
    font-family:'Cormorant Garamond',serif;
    font-weight:600;
    font-size:19px;
    color:var(--gold-soft);
    width:20px;
    flex-shrink:0;
    padding-top:2px;
  }
  .card-img{
    width:66px;
    height:92px;
    flex-shrink:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#fff;
    border:1px solid var(--line);
  }
  .card-img img{
    max-width:100%;
    max-height:100%;
    object-fit:contain;
  }
  .card-body{
    flex:1;
    min-width:0;
  }
  .card-head{margin-bottom:2px;}
  .card-name{
    font-family:'Cormorant Garamond',serif;
    font-weight:600;
    font-size:15px;
    line-height:1.15;
    text-transform:uppercase;
    letter-spacing:.01em;
  }
  .card-brand{
    font-size:8.5px;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:var(--grey);
    margin-top:1px;
  }
  .inspired{margin-top:5px;}
  .inspired-label{
    font-size:7.5px;
    letter-spacing:.14em;
    text-transform:uppercase;
    color:var(--gold);
    font-weight:700;
  }
  .inspired-name{
    font-family:'Cormorant Garamond',serif;
    font-style:italic;
    font-size:12.5px;
    line-height:1.2;
    margin-top:1px;
  }
  .notes{
    font-size:7.5px;
    letter-spacing:.06em;
    text-transform:uppercase;
    color:var(--ink);
    margin-top:6px;
    line-height:1.5;
  }
  .rule{
    border-top:1px solid var(--line);
    margin:7px 0 6px;
  }
  .stat-row{
    display:flex;
    align-items:center;
    gap:6px;
    font-size:7.5px;
    letter-spacing:.1em;
    text-transform:uppercase;
    color:var(--grey);
    margin-bottom:3px;
  }
  .stat-label{width:58px;flex-shrink:0;}
  .dots{display:inline-flex;gap:2px;}
  .dot{
    width:6px;height:6px;
    border-radius:50%;
    border:1px solid var(--gold);
    background:transparent;
    display:inline-block;
  }
  .dot.on{background:var(--gold);}
  .stat-word{
    font-family:'DM Sans',sans-serif;
    font-size:8px;
    color:var(--ink);
    font-weight:500;
    text-transform:none;
    letter-spacing:0;
  }
  .price{
    margin-left:auto;
    font-family:'Cormorant Garamond',serif;
    font-size:16px;
    font-weight:700;
    color:var(--black);
    letter-spacing:0;
  }
  .footer{
    position:absolute;
    left:13mm;right:13mm;bottom:9mm;
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding-top:8px;
    border-top:1px solid var(--line);
    font-size:8px;
    letter-spacing:.08em;
    text-transform:uppercase;
    color:var(--grey);
  }
  .footer .tagline{
    color:var(--gold);
    letter-spacing:.16em;
  }
`;

function buildPage(pageNum, totalPages, pageProducts, startIdx, totalCount) {
  const startNum = startIdx + 1;
  const endNum = startIdx + pageProducts.length;
  const rangeLabel = String(startNum).padStart(2, '0') + '–' + String(endNum).padStart(2, '0');

  // Row-major reading order: 01/02 share row one, 03/04 row two, etc.
  const lastRowStart = (Math.ceil(pageProducts.length / 2) - 1) * 2;
  const cards = pageProducts
    .map((p, i) => buildCard(p, startIdx + i + 1, i >= lastRowStart ? 'last-row' : ''))
    .join('\n');

  return `<!doctype html>
<html lang="${T.htmlLang}">
<head>
<meta charset="utf-8" />
<title>YSP Collective — ${T.title} (${LANG === 'pt' ? 'Página' : 'Page'} ${pageNum})</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top-bar">${T.topBar}</div>
    <div class="header">
      <div class="logo">
        <div class="logo-ysp">YSP</div>
        <div class="logo-collective">COLLECTIVE</div>
      </div>
      <div class="title-block">
        <h1>${T.title}</h1>
        <div class="sub">${T.subtitle(totalCount)}</div>
      </div>
      <div class="page-badge">
        <div class="of">${T.pageOf(pageNum, totalPages)}</div>
        <div class="range">${rangeLabel}</div>
      </div>
    </div>

    <div class="grid">${cards}</div>

    <div class="footer">
      <span>yspcollective.com</span>
      <span class="tagline">${T.footerTagline}</span>
      <span>@ysp.collective</span>
    </div>
  </div>
</body>
</html>`;
}

// ---------- Run ----------
const PER_PAGE = 10;
const totalPages = Math.ceil(products.length / PER_PAGE);

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const suffix = LANG === 'pt' ? '-pt' : '';
for (let pg = 0; pg < totalPages; pg++) {
  const slice = products.slice(pg * PER_PAGE, pg * PER_PAGE + PER_PAGE);
  const html = buildPage(pg + 1, totalPages, slice, pg * PER_PAGE, products.length);
  const outPath = path.join(OUT_DIR, `ysp-tester-guide-page-${pg + 1}${suffix}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Wrote', outPath, `(${slice.length} products, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
}
