const { syncAllProducts } = require('./stripe-sync.js');

module.exports = function(eleventyConfig) {

  // Sync products to Stripe on every build
  eleventyConfig.on('eleventy.before', async () => {
    try {
      await syncAllProducts();
    } catch(e) {
      console.warn('Stripe sync skipped:', e.message);
    }
  });

  // Pass through static assets
  eleventyConfig.addPassthroughCopy({ "admin": "admin" });
  eleventyConfig.addPassthroughCopy({ "images": "images" });
  eleventyConfig.addPassthroughCopy({ "products": "products" });
  eleventyConfig.addPassthroughCopy("src/*.js");
  eleventyConfig.addPassthroughCopy({ "src/yspcart.js": "yspcart.js" });

  // Favicon files (root → _site root)
  eleventyConfig.addPassthroughCopy({ "favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "favicon-16.png": "favicon-16.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-32.png": "favicon-32.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-180.png": "favicon-180.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-192.png": "favicon-192.png" });

  const PRODUCT_FIELDS = [
    'name','slug','badge','custom_badge','price','rrp','brand','gender',
    'category','image_main','gallery','description_short','description_full','ysp_thoughts','date_added',
    'concentration','size','fragrance_family','top_notes','heart_notes','base_notes',
    'accords','accords_text','longevity','projection','best_for','origin','launched','vegan',
    'skin_type','key_ingredients','free_from','spf_rating','amazon_url','published',
    'stock_status','expected_date','featured','avg_rating','review_count',
    'inspired_by_name','inspired_by_note',
    'blind_buy_rating','blind_buy_note','season',
    'char_sweet','char_fresh','char_masculine','char_unique','char_versatile',
    'gtin','exclude_from_feed','google_product_category',
    'pt','es'
  ];

  function extractProduct(item, type) {
    const d = { type };
    PRODUCT_FIELDS.forEach(f => { if (item.data[f] !== undefined) d[f] = item.data[f]; });
    d.url = `/products/${item.data.slug}.html`;
    d.accords = parseAccords(item.data);
    d.seasons = parseSeasons(item.data);
    return d;
  }

  function parseAccords(data) {
    if (data.accords_text && typeof data.accords_text === 'string') {
      return data.accords_text.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    }
    if (Array.isArray(data.accords)) {
      return data.accords.map(a => (typeof a === 'object' ? a.accord : a)).filter(Boolean);
    }
    return [];
  }

  const SEASONS = ['spring','summer','autumn','winter'];
  const SEASON_EMOJI = { spring: '🌱', summer: '☀️', autumn: '🍂', winter: '❄️' };

  // Season is a multi-select in the CMS (array), but may also arrive as a
  // comma-separated string from hand-written frontmatter. Returns lowercased,
  // known seasons only.
  function parseSeasons(data) {
    if (!data) return [];
    const raw = data.season;
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === 'string') list = raw.split(',');
    return list
      .map(s => String(s).trim().toLowerCase())
      .filter(s => SEASONS.includes(s));
  }

  // Collections
  eleventyConfig.addCollection("fragrances", function(col) {
    return col.getFilteredByGlob("src/_products/fragrances/*.md")
      .filter(i => i.data.published !== false)
      .sort((a,b) => (a.data.name||'').localeCompare(b.data.name||''));
  });

  eleventyConfig.addCollection("beauty", function(col) {
    return col.getFilteredByGlob("src/_products/beauty/*.md")
      .filter(i => i.data.published !== false)
      .sort((a,b) => (a.data.name||'').localeCompare(b.data.name||''));
  });

  eleventyConfig.addCollection("posts", function(col) {
    return col.getFilteredByGlob("src/_posts/*.md")
      .filter(p => p.data.published !== false)
      .sort((a, b) => b.date - a.date);
  });

  // Blog post image shortcode
  // Usage: {% image "filename.jpg", "Alt text", "size" %}
  // Sizes: full | wide | half | left | right
  eleventyConfig.addShortcode("image", function(src, alt, size) {
    const altText = alt || '';
    const sizeClass = size || 'full';
    const sizeStyles = {
      full:  'width:100%;margin:2rem 0;',
      wide:  'width:110%;margin-left:-5%;margin:2rem -5%;',
      half:  'width:50%;margin:1.5rem auto;display:block;',
      left:  'width:45%;float:left;margin:0.5rem 1.5rem 1rem 0;',
      right: 'width:45%;float:right;margin:0.5rem 0 1rem 1.5rem;'
    };
    const style = sizeStyles[sizeClass] || sizeStyles.full;
    // If src starts with / or http use as-is, otherwise prefix with /images/uploads/
    const imgSrc = (src.startsWith('/') || src.startsWith('http')) ? src : `/images/uploads/${src}`;
    return `<figure style="${style}"><img src="${imgSrc}" alt="${altText}" loading="lazy" style="width:100%;height:auto;display:block;"><figcaption style="font-size:0.75rem;color:#8a847a;text-align:center;margin-top:0.4rem;font-style:italic;">${altText}</figcaption></figure>`;
  });

  eleventyConfig.addCollection("allProducts", function(col) {
    const fragrances = col.getFilteredByGlob("src/_products/fragrances/*.md")
      .filter(i => i.data.published !== false)
      .map(i => extractProduct(i, 'fragrance'));
    const beauty = col.getFilteredByGlob("src/_products/beauty/*.md")
      .filter(i => i.data.published !== false)
      .map(i => extractProduct(i, 'beauty'));
    return [...fragrances, ...beauty].sort((a, b) => {
      const da = a.date_added ? new Date(a.date_added) : new Date(0);
      const db = b.date_added ? new Date(b.date_added) : new Date(0);
      if (db - da !== 0) return db - da; // newest first
      return (a.name || '').localeCompare(b.name || ''); // alphabetical tiebreak
    });
  });

  // Filters
  eleventyConfig.addFilter("date", function(date, format) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();
    if (!format || format === 'd MMMM yyyy') return `${day} ${months[month]} ${year}`;
    if (format === 'd MMM yyyy') return `${day} ${monthsShort[month]} ${year}`;
    if (format === 'YYYY-MM-DD') return `${year}-${String(d.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return d.toLocaleDateString();
  });

  // Coerce undefined/null to "" so a missing key never emits a bare hole into
  // inline JS (e.g. "name_es: ," which is a syntax error and kills the script).
  // Renders a markdown string to HTML. Post translations are stored as
  // markdown in frontmatter, so they need the same treatment the body gets.
  const md = require('markdown-it')({ html: true, breaks: false, linkify: true });
  eleventyConfig.addFilter("markdown", value => (value ? md.render(String(value)) : ''));

  eleventyConfig.addFilter("jsonify", value => JSON.stringify(value === undefined || value === null ? '' : value));
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));

  eleventyConfig.addFilter("selectattr", (arr, attr) => {
    const keys = attr.split('.');
    return arr.filter(item => {
      let val = item;
      for (const k of keys) val = val ? val[k] : undefined;
      return !!val;
    });
  });

  eleventyConfig.addFilter("parseAccords", function(data) {
    return parseAccords(data);
  });

  eleventyConfig.addFilter("relatedProducts", function(allProducts, currentSlug, currentType, currentAccords, currentBrand, currentScentFamily) {
    const sameType = allProducts.filter(p => p.type === currentType && p.slug !== currentSlug);
    let accordsList = [];
    if (Array.isArray(currentAccords)) {
      accordsList = currentAccords;
    } else if (typeof currentAccords === 'string') {
      accordsList = currentAccords.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    }
    const scentFamilyLower = (currentScentFamily || '').toLowerCase();
    return sameType.map(p => {
      let score = 0;
      if (currentType === 'fragrance' && accordsList.length) {
        score += (p.accords||[]).filter(a => accordsList.includes(a)).length;
      }
      if (currentBrand && p.brand === currentBrand) score += 3;
      if (scentFamilyLower && (p.fragrance_family||'').toLowerCase() === scentFamilyLower) score += 2;
      return { ...p, score };
    }).sort((a, b) => b.score - a.score).slice(0, 4);
  });

  eleventyConfig.addFilter("detailsJson", function(data) {
    const rows = [];
    // key: i18n key for the label. vkey: i18n key for the value. perf: value
    // goes through the longevity/projection translation map.
    if (data.concentration) {
      if (data.name) rows.push({key:'det_name',label:'Product Name',value:data.name});
      if (data.concentration) rows.push({key:'pdp_concentration',label:'Concentration',value:data.concentration});
      if (data.size) rows.push({key:'pdp_size',label:'Size',value:data.size});
      if (data.fragrance_family) rows.push({key:'det_family',label:'Fragrance Family',value:data.fragrance_family,family:true});
      if (data.top_notes) rows.push({key:'pdp_notes_top',label:'Top Notes',value:data.top_notes,notes:true});
      if (data.heart_notes) rows.push({key:'pdp_notes_heart',label:'Heart Notes',value:data.heart_notes,notes:true});
      if (data.base_notes) rows.push({key:'pdp_notes_base',label:'Base Notes',value:data.base_notes,notes:true});
      if (data.longevity) rows.push({key:'pdp_longevity',label:'Longevity',value:data.longevity,perf:true});
      if (data.projection) rows.push({key:'pdp_projection',label:'Projection',value:data.projection,perf:true});
      if (data.best_for) rows.push({key:'det_best_for',label:'Best For',value:data.best_for});
      if (data.gender) rows.push({key:'det_gender',label:'Gender',value:data.gender,vkey:'gender_'+String(data.gender).toLowerCase()});
      if (data.origin) rows.push({key:'det_origin',label:'Origin',value:data.origin});
      if (data.launched) rows.push({key:'det_launched',label:'Launched',value:data.launched});
      rows.push({key:'det_vegan',label:'Vegan & Cruelty-Free',value:data.vegan?'Yes':'No',vkey:data.vegan?'val_yes':'val_no'});
    } else {
      if (data.name) rows.push({key:'det_name',label:'Product Name',value:data.name});
      if (data.size) rows.push({key:'pdp_size',label:'Size',value:data.size});
      if (data.skin_type) rows.push({key:'det_skin_type',label:'Skin Type',value:data.skin_type});
      if (data.key_ingredients) rows.push({key:'det_key_ingredients',label:'Key Ingredients',value:data.key_ingredients});
      if (data.free_from) rows.push({key:'det_free_from',label:'Free From',value:data.free_from});
      if (data.spf_rating) rows.push({key:'det_spf',label:'SPF Rating',value:data.spf_rating});
      rows.push({key:'det_origin',label:'Origin',value:data.origin||'South Korea'});
      rows.push({key:'det_vegan',label:'Vegan & Cruelty-Free',value:data.vegan?'Yes':'No',vkey:data.vegan?'val_yes':'val_no'});
    }
    return JSON.stringify(rows);
  });

  eleventyConfig.addFilter("badgeClass", badge => {
    if (!badge) return '';
    const b = badge.toLowerCase();
    if (b === 'bestseller') return 'badge-bestseller';
    if (b === 'popular') return 'badge-popular';
    if (b === 'trending') return 'badge-trending';
    if (b === 'viral') return 'badge-viral';
    if (b === 'curated') return 'badge-curated';
    if (b === 'new') return 'badge-new';
    if (b === 'premium') return 'badge-premium';
    if (b === 'limited') return 'badge-limited';
    return '';
  });


  // Brand filter for brand pages
  eleventyConfig.addFilter("selectBrand", function(products, brandName) {
    return products.filter(p => p.brand === brandName);
  });


  // Brands data collection
// Filter products by brand name
  eleventyConfig.addFilter("selectByBrand", function(allProducts, brandName) {
    return allProducts.filter(p => p.brand === brandName);
  });

  // Filter products by season — mirrors selectByBrand above
  eleventyConfig.addFilter("selectBySeason", function(allProducts, seasonName) {
    const target = (seasonName || '').toLowerCase();
    return allProducts.filter(p => parseSeasons(p).includes(target));
  });

  // Normalised, lowercased season list for a product
  eleventyConfig.addFilter("parseSeasons", function(data) {
    return parseSeasons(data);
  });

  // "summer" -> "season_summer", the i18n key for that badge
  eleventyConfig.addFilter("seasonKey", function(season) {
    const s = String(season || '').trim().toLowerCase();
    return s ? 'season_' + s : '';
  });

  // blind buy rating -> i18n key
  eleventyConfig.addFilter("blindBuyKey", function(rating) {
    if (!rating) return '';
    const r = rating.toLowerCase();
    if (r.indexOf('universal') === 0) return 'bb_universal';
    if (r.indexOf('know') === 0) return 'bb_know';
    if (r.indexOf('niche') === 0) return 'bb_niche';
    return '';
  });

  // "summer" → "☀️ Summer" for the season badges
  eleventyConfig.addFilter("seasonLabel", function(season) {
    const s = String(season || '').trim().toLowerCase();
    if (!s) return '';
    const emoji = SEASON_EMOJI[s];
    return (emoji ? emoji + ' ' : '') + s.charAt(0).toUpperCase() + s.slice(1);
  });

  // Blind buy rating → modifier class, same pattern as badgeClass
  eleventyConfig.addFilter("blindBuyClass", function(rating) {
    if (!rating) return '';
    const r = rating.toLowerCase();
    if (r.indexOf('universal') === 0) return 'bb-universal';
    if (r.indexOf('know') === 0) return 'bb-know';
    if (r.indexOf('niche') === 0) return 'bb-niche';
    return '';
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
