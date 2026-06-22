/**
 * seed-stock.js
 *
 * Reads all product markdown files and syncs stock_quantity to the Worker KV
 * via the /admin/stock/bulk endpoint. Run automatically by GitHub Actions on
 * every push to main, making the CMS the single source of truth for stock.
 *
 * Usage:
 *   node scripts/seed-stock.js --token <AUTH_SECRET> [--dry-run] [--force]
 *
 * Options:
 *   --token   Your AUTH_SECRET (required). Find it in Cloudflare Worker env vars.
 *   --dry-run Print what would be sent without calling the API.
 *   --force   Overwrite existing KV entries (always used in CI).
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://ysp-ai-proxy.rapid-shadow-439d.workers.dev';
const PRODUCTS_DIR = path.join(__dirname, '..', 'src', '_products');

// ── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}
const token  = getArg('--token');
const dryRun = args.includes('--dry-run');
const force  = args.includes('--force');

if (!token && !dryRun) {
  console.error('Error: --token is required (your AUTH_SECRET).');
  console.error('       Use --dry-run to preview without calling the API.');
  process.exit(1);
}

// ── Minimal frontmatter parser ───────────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  match[1].split('\n').forEach(line => {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
    if (!kv) return;
    const [, key, val] = kv;
    const v = val.trim().replace(/^["']|["']$/g, '');
    if (v === 'true')  { data[key] = true; return; }
    if (v === 'false') { data[key] = false; return; }
    data[key] = v;
  });
  return data;
}

// ── Collect slugs from product markdown files ────────────────────────────────
function collectSlugs() {
  const items = [];
  for (const subdir of ['fragrances', 'beauty']) {
    const dir = path.join(PRODUCTS_DIR, subdir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const raw  = fs.readFileSync(path.join(dir, file), 'utf8');
      const data = parseFrontmatter(raw);
      if (data.published === false) continue;
      const slug = data.slug || file.replace('.md', '');
      if (!slug) continue;
      const stock = parseInt(data.stock_quantity) || 0;
      items.push({ slug, stock });
    }
  }
  return items;
}

// ── Fetch existing KV stock (to avoid overwriting) ──────────────────────────
function fetchExistingStock() {
  return new Promise((resolve) => {
    if (force || dryRun) { resolve({}); return; }
    const url = new URL(API_URL + '/admin/stock');
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body).stock || {}); }
        catch (_) { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

// ── POST bulk set ────────────────────────────────────────────────────────────
function bulkSet(items) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ items });
    const url  = new URL(API_URL + '/admin/stock/bulk');
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, res => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(resp));
        else reject(new Error('HTTP ' + res.statusCode + ': ' + resp));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const products = collectSlugs();
  console.log(`Found ${products.length} published products.`);

  const existing = await fetchExistingStock();
  const existingCount = Object.keys(existing).length;
  if (existingCount && !force) {
    console.log(`${existingCount} slugs already in KV — skipping those (use --force to overwrite).`);
  }

  const toSeed = products.filter(p => force || existing[p.slug] === undefined);

  if (!toSeed.length) {
    console.log('Nothing to seed — all products already have stock entries. Use --force to reset.');
    return;
  }

  console.log(`\nSeeding ${toSeed.length} product(s) (default qty: ${defaultQty}):\n`);
  toSeed.forEach(p => {
    const note = p.soldOut ? ' [sold_out → 0]' : '';
    console.log(`  · ${p.slug}  →  ${p.stock}${note}`);
  });

  if (dryRun) {
    console.log('\n[Dry run] No changes made.');
    return;
  }

  console.log('\nSending to API…');
  const result = await bulkSet(toSeed.map(p => ({ slug: p.slug, stock: p.stock })));
  console.log(`✓ Seeded ${result.updated} product(s) successfully.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
