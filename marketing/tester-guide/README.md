# YSP Collective — Fragrance Tester Guide

Printable A4 tester guide (2 cols × 5 rows per page), generated straight from
the live product data in `src/_products/fragrances/*.md` — so it's always
pulling real stock status, prices, and inspired-by info, not a hand-maintained
copy.

## Files

- `ysp-tester-guide-page-N.html` — English, one file per page.
- `ysp-tester-guide-page-N-pt.html` — European Portuguese translation (UI
  labels, accord/notes vocabulary, gender). Brand names, product names, and
  "inspired by" reference fragrance names are intentionally left untranslated
  — they're proper nouns, not descriptive copy.
- `build-tester-guide.js` — the generator. Self-contained, no dependencies
  beyond `js-yaml` (already in the repo's `node_modules`).

Images are embedded as base64 data URIs, so each HTML file is fully
self-contained — safe to email, print, or open with no internet connection.

## Regenerating

Run from anywhere inside the repo:

```bash
node marketing/tester-guide/build-tester-guide.js          # English, 4 pages
node marketing/tester-guide/build-tester-guide.js . pt      # Portuguese, 4 pages
```

Re-run whenever stock changes meaningfully (new arrivals, restocks going
live, prices changing) — it always reflects whatever's currently in
`src/_products/fragrances/`.

## What counts as "in the guide"

`stock_status` values `in_stock`, `low_stock`, `last_one`, and `on_order` are
included (on_order = confirmed restock, shown so the guide reflects the
shelf about to arrive). `sold_out` and `coming_soon` are excluded. Only
`published: true` products are considered.

## Design notes

- Pricing shows the current price only — no strikethrough RRP.
- Longevity and Projection each show a 5-dot rating plus a short text label
  (e.g. "8-10 hrs", "Strong").
- "Inspired By" only renders when a product actually has a verified
  `inspired_by_name` set — never invented for originals.
