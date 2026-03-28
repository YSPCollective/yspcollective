/**
 * YSP Collective — Stripe Product Sync
 * Runs at build time via eleventy.config.js
 * Creates/updates Stripe products from CMS data
 * Generates _data/stripe_prices.json for use in templates
 */

const fs = require('fs');
const path = require('path');

const WORKER_URL = 'https://ysp-ai-proxy.rapid-shadow-439d.workers.dev';
const PRICES_FILE = path.join(__dirname, 'src/_data/stripe_prices.json');

async function syncProduct(product) {
  try {
    const res = await fetch(`${WORKER_URL}/sync-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://yspcollective.com'
      },
      body: JSON.stringify({
        name: product.name,
        price: product.price,
        currency: 'eur',
        slug: product.slug,
        image: product.image_main
      })
    });
    const data = await res.json();
    if (data.error) {
      console.warn(`⚠ Stripe sync failed for ${product.slug}: ${data.error}`);
      return null;
    }
    console.log(`✓ Stripe synced: ${product.name} → ${data.priceId}`);
    return { slug: product.slug, priceId: data.priceId, productId: data.productId };
  } catch (err) {
    console.warn(`⚠ Stripe sync error for ${product.slug}: ${err.message}`);
    return null;
  }
}

async function syncAllProducts() {
  // Load existing prices to avoid unnecessary API calls
  let existing = {};
  if (fs.existsSync(PRICES_FILE)) {
    try {
      existing = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
    } catch(e) {}
  }

  // Read all product MD files
  const products = [];
  const fragrancesDir = path.join(__dirname, 'src/_products/fragrances');
  const beautyDir = path.join(__dirname, 'src/_products/beauty');

  function readProductsFromDir(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      if (!file.endsWith('.md')) return;
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const product = parseYamlFrontmatter(content);
      if (product && product.published !== false && product.slug && product.price) {
        products.push(product);
      }
    });
  }

  readProductsFromDir(fragrancesDir);
  readProductsFromDir(beautyDir);

  console.log(`\nSyncing ${products.length} products to Stripe...`);

  const results = {};
  for (const product of products) {
    // Skip if price hasn't changed
    if (existing[product.slug] && existing[product.slug].price === product.price) {
      results[product.slug] = existing[product.slug];
      console.log(`→ Skipped (unchanged): ${product.name}`);
      continue;
    }
    const result = await syncProduct(product);
    if (result) {
      results[product.slug] = { ...result, price: product.price };
    } else if (existing[product.slug]) {
      // Keep existing if sync failed
      results[product.slug] = existing[product.slug];
    }
  }

  // Save prices file
  fs.mkdirSync(path.dirname(PRICES_FILE), { recursive: true });
  fs.writeFileSync(PRICES_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✓ Stripe prices saved to ${PRICES_FILE}\n`);
  return results;
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yaml = match[1];
  const result = {};
  yaml.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    // Remove quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    result[key] = val;
  });
  return result;
}

// Run if called directly
if (require.main === module) {
  syncAllProducts().catch(console.error);
}

module.exports = { syncAllProducts };
