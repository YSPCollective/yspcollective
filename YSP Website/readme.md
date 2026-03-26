# YSP Collective Website — Editing Guide

## File Structure
```
ysp-site/
├── index.html                          ← Main homepage
├── products/
│   ├── beauty-of-joseon-spf.html       ← Product detail page (template)
│   └── (duplicate this for each new product)
├── images/                             ← Create this folder
│   ├── hero-1.jpg                      ← Hero carousel images (1920×1080 min)
│   ├── hero-2.jpg
│   ├── hero-3.jpg
│   ├── og-image.jpg                    ← Social sharing image (1200×630)
│   ├── brand-lifestyle.jpg             ← Philosophy section image
│   └── products/
│       ├── joseon-spf.jpg              ← Product card images (600×800, 3:4 ratio)
│       ├── joseon-spf-1.jpg            ← Product detail images (800×800, 1:1 ratio)
│       ├── joseon-spf-2.jpg
│       └── ...
└── README.md                           ← This file
```

## How to Add Images

### Hero Carousel (index.html)
Find each `.hero-slide-bg` and add an inline style:
```html
<div class="hero-slide-bg" style="background: url('images/hero-1.jpg') center/cover no-repeat;"></div>
```

### Product Cards (index.html)
Inside each `.product-card-image`, uncomment the `<img>` tag and remove the placeholder:
```html
<div class="product-card-image">
  <!-- Remove this line: -->  <span class="placeholder-icon">✦</span>
  <!-- Uncomment this: -->
  <img src="images/products/joseon-spf.jpg" alt="Product name" loading="lazy">
  <span class="product-badge badge-bestseller">Bestseller</span>
</div>
```

### Philosophy Section (index.html)
Find `.philosophy-image` and replace the placeholder with an `<img>` tag.

### Category Cards (index.html)
Add a background image via inline style on each `.category-card`:
```html
<a href="#featured" class="category-card" style="background: url('images/category-beauty.jpg') center/cover;">
```

## How to Add a New Product Page

1. **Duplicate** `products/beauty-of-joseon-spf.html`
2. **Rename** to your product slug, e.g. `products/niacinamide-serum.html`
3. **Search and replace** these sections (marked with `<!-- EDIT: -->` comments):
   - `<title>` tag
   - `<meta name="description">`
   - `<link rel="canonical">`
   - Breadcrumb text
   - `.pd-category` — category label
   - `.pd-name` — product name (h1)
   - `.pd-price` — price
   - `.pd-badge` — badge text and class
   - `.pd-short-desc` — short description
   - `.pd-details-grid` — key details (condition, size, brand, origin)
   - `.pd-actions` — update enquiry subject in the URL
   - **YSP's Thoughts** — write your editorial for this product
   - **Product Details** — full description and specs list
   - **Related Products** — update the 4 related product cards
   - JSON-LD structured data in `<head>`
4. **Add the product card** on index.html linking to the new page
5. **Add product images** to the images/products/ folder

## How to Add a New Product Card on the Homepage

Find the `.products-grid` section in index.html and copy this block:
```html
<a href="products/YOUR-PRODUCT.html" class="product-card reveal">
  <div class="product-card-image">
    <img src="images/products/YOUR-IMAGE.jpg" alt="Product Name" loading="lazy">
    <span class="product-badge">Badge Text</span>
  </div>
  <div class="product-card-cat">Category · Subcategory</div>
  <div class="product-card-name">Product Name</div>
  <div class="product-card-price">€XX</div>
</a>
```

### Badge classes:
- `product-badge` — gold (default, for Grade A / Curated)
- `product-badge badge-new` — black (New)
- `product-badge badge-bestseller` — rose (Bestseller / Popular)
- Remove the badge span entirely if not needed

## SEO Notes

- Each product page includes JSON-LD structured data — update it for each product
- The homepage has Open Graph meta tags — update the og:image
- All images should use descriptive `alt` text
- Product pages have canonical URLs — update for your domain
- The homepage meta description covers the main keywords

## CMS Upgrade Path

When you're ready to move beyond static HTML, consider:
1. **Shopify** — Best if you want full e-commerce with cart/checkout
2. **WordPress + WooCommerce** — Flexible, lots of themes available
3. **Webflow** — Visual editor, good design control, e-commerce built in

The current site structure (product data, layout, copy) will transfer cleanly to any of these.
