// Combines the per-page HTML (from build-tester-guide.js) into one
// multi-page PDF per language, using headless Chrome/Edge already on the
// machine — no extra dependencies needed.
//
// Usage:
//   node marketing/tester-guide/build-pdf.js          -> ysp-tester-guide-en.pdf
//   node marketing/tester-guide/build-pdf.js pt        -> ysp-tester-guide-pt.pdf
//
// Run build-tester-guide.js first (or after) so the page-N.html files are
// up to date — this script just merges + prints whatever's already there.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = __dirname;
const LANG = process.argv[2] === 'pt' ? 'pt' : 'en';
const suffix = LANG === 'pt' ? '-pt' : '';

// ---------- 1. merge the 4 page files into one HTML with page breaks ----------
let styleBlock = null;
const pageDivs = [];
for (let i = 1; i <= 4; i++) {
  const p = path.join(DIR, `ysp-tester-guide-page-${i}${suffix}.html`);
  if (!fs.existsSync(p)) continue;
  const html = fs.readFileSync(p, 'utf8');
  if (!styleBlock) styleBlock = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const pageDiv = html.match(/<div class="page">[\s\S]*?<\/div>\s*<\/body>/)[0].replace(/<\/body>$/, '');
  pageDivs.push(pageDiv);
}
if (!pageDivs.length) {
  console.error(`No ysp-tester-guide-page-N${suffix}.html files found — run build-tester-guide.js first.`);
  process.exit(1);
}

const combinedHtml = `<!doctype html>
<html lang="${LANG === 'pt' ? 'pt-PT' : 'en'}">
<head><meta charset="utf-8" /><title>YSP Tester Guide</title>
${styleBlock}
<style>.page:not(:last-child){break-after:page;page-break-after:always;} body{background:#fff;}</style>
</head>
<body>
${pageDivs.join('\n')}
</body>
</html>`;

const combinedPath = path.join(DIR, `.tmp-combined${suffix}.html`);
fs.writeFileSync(combinedPath, combinedHtml, 'utf8');

// ---------- 2. find a Chromium-based browser ----------
const candidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find(p => fs.existsSync(p));
if (!browser) {
  console.error('No Chrome/Edge install found. Set CHROME_PATH env var to your browser .exe and re-run.');
  process.exit(1);
}

// ---------- 3. print to PDF ----------
const outPath = path.join(DIR, `ysp-tester-guide-${LANG}.pdf`);
const fileUrl = 'file:///' + combinedPath.replace(/\\/g, '/');
execFileSync(browser, [
  '--headless', '--disable-gpu', '--no-pdf-header-footer',
  `--print-to-pdf=${outPath}`, fileUrl,
], { stdio: 'inherit' });

fs.unlinkSync(combinedPath);
console.log('Wrote', outPath, `(${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB, ${pageDivs.length} pages)`);
