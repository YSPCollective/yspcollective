/**
 * build-worker-products.js
 *
 * Reads every product markdown file from src/_products/, parses the
 * frontmatter, and injects the resulting PRODUCTS array into worker.js
 * between the marker comments:
 *   // ── PRODUCT CATALOGUE: AUTO-GENERATED START ──
 *   // ── PRODUCT CATALOGUE: AUTO-GENERATED END ──
 *
 * Run via:  node scripts/build-worker-products.js
 * Hooked into:  npm run deploy:api  (runs automatically before deploying)
 */

const fs   = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'src', '_products');
const WORKER_FILE  = path.join(__dirname, '..', 'worker.js');
const START_MARKER = '// ── PRODUCT CATALOGUE: AUTO-GENERATED START ──';
const END_MARKER   = '// ── PRODUCT CATALOGUE: AUTO-GENERATED END ──';

// ── Minimal frontmatter parser ───────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  let currentKey = null;
  let inBlock = false;

  match[1].split('\n').forEach(line => {
    // Multi-line block scalar (>) — collect until next key
    if (inBlock) {
      if (/^\s+/.test(line)) {
        data[currentKey] = ((data[currentKey] || '') + ' ' + line.trim()).trim();
        return;
      }
      inBlock = false;
    }

    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
    if (!kv) return;
    const [, key, val] = kv;
    currentKey = key;

    if (val.trim() === '>-' || val.trim() === '>') {
      data[key] = '';
      inBlock = true;
      return;
    }

    // Array item on same line: "key: item1, item2" — handled as string
    // Quoted string
    const quoted = val.match(/^["'](.*)["']$/);
    if (quoted) { data[key] = quoted[1]; return; }

    // Bare boolean / number
    if (val.trim() === 'true')  { data[key] = true;  return; }
    if (val.trim() === 'false') { data[key] = false; return; }
    if (val.trim() !== '' && !isNaN(Number(val.trim()))) {
      data[key] = Number(val.trim()); return;
    }

    data[key] = val.trim();
  });

  return data;
}

// ── Walk product directories ─────────────────────────────────────────────────
function collectProducts() {
  const products = [];

  for (const subdir of ['fragrances', 'beauty']) {
    const dir = path.join(PRODUCTS_DIR, subdir);
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw  = fs.readFileSync(path.join(dir, file), 'utf8');
      const data = parseFrontmatter(raw);

      // Skip unpublished
      if (data.published === false) continue;

      const isFragrance = !!data.concentration;

      // Parse accords from accords_text
      const accords = data.accords_text
        ? String(data.accords_text).split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
        : [];

      const product = {
        name:       data.name        || file.replace('.md', ''),
        slug:       data.slug        || '',
        url:        `https://yspcollective.com/products/${data.slug || ''}.html`,
        price:      `€${data.price}` || '',
        brand:      data.brand       || '',
        gender:     data.gender      || '',
        accords,
      };

      if (isFragrance) {
        product.concentration = data.concentration || '';
        product.size          = data.size          || '';
        product.family        = data.fragrance_family || '';
        product.top           = data.top_notes     || '';
        product.heart         = data.heart_notes   || '';
        product.base          = data.base_notes    || '';
        product.longevity     = data.longevity     || '';
        product.projection    = data.projection    || '';
        product.best_for      = data.best_for      || '';
        if (data.inspired_by_name) {
          product.inspired_by = data.inspired_by_name;
        }
      } else {
        product.type     = 'beauty';
        product.category = data.category || subdir;
        product.size     = data.size     || '';
      }

      if (data.description_short) product.summary     = String(data.description_short).replace(/\s+/g, ' ').trim();
      if (data.ysp_thoughts)      product.ysp_thoughts = String(data.ysp_thoughts).replace(/\s+/g, ' ').trim();

      products.push(product);
    }
  }

  // Sort: fragrances first, then beauty; within each group by slug
  products.sort((a, b) => {
    const aFrag = !a.type;
    const bFrag = !b.type;
    if (aFrag !== bFrag) return aFrag ? -1 : 1;
    return a.slug.localeCompare(b.slug);
  });

  return products;
}

// ── Inject into worker.js ────────────────────────────────────────────────────
function injectIntoWorker(products) {
  const workerSrc = fs.readFileSync(WORKER_FILE, 'utf8');

  const startIdx = workerSrc.indexOf(START_MARKER);
  const endIdx   = workerSrc.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error('ERROR: Could not find marker comments in worker.js');
    console.error('Add these two lines around the PRODUCTS declaration:');
    console.error(`  ${START_MARKER}`);
    console.error(`  ${END_MARKER}`);
    process.exit(1);
  }

  const before = workerSrc.slice(0, startIdx + START_MARKER.length);
  const after  = workerSrc.slice(endIdx);

  const catalogueBlock = `\nconst PRODUCTS = ${JSON.stringify(products, null, 2)};\n`;

  const updated = before + catalogueBlock + after;
  fs.writeFileSync(WORKER_FILE, updated, 'utf8');

  console.log(`✓ Injected ${products.length} products into worker.js`);
  products.forEach(p => console.log(`  · ${p.name}`));
}

// ── Run ──────────────────────────────────────────────────────────────────────
const products = collectProducts();
injectIntoWorker(products);
