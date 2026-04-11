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

  // Favicon files (root → _site root)
  eleventyConfig.addPassthroughCopy({ "favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "favicon-16.png": "favicon-16.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-32.png": "favicon-32.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-180.png": "favicon-180.png" });
  eleventyConfig.addPassthroughCopy({ "favicon-192.png": "favicon-192.png" });

  const PRODUCT_FIELDS = [
    'name','slug','badge','custom_badge','price','rrp','brand','gender',
    'category','image_main','gallery','description_short','description_full','ysp_thoughts',
    'concentration','size','fragrance_family','top_notes','heart_notes','base_notes',
    'accords','accords_text','longevity','projection','best_for','origin','launched','vegan',
    'skin_type','key_ingredients','free_from','spf_rating','amazon_url','published',
    'stock_status','expected_date','featured',
    'inspired_by_name','inspired_by_note',
    'gtin','exclude_from_feed','google_product_category',
    'pt','es',
    'name_pt','description_short_pt','description_full_pt','ysp_thoughts_pt',
    'name_es','description_short_es','description_full_es','ysp_thoughts_es'
  ];

  function extractProduct(item, type) {
    const d = { type };
    PRODUCT_FIELDS.forEach(f => { if (item.data[f] !== undefined) d[f] = item.data[f]; });
    d.url = `/products/${item.data.slug}.html`;
    d.accords = parseAccords(item.data);
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
    return [...fragrances, ...beauty];
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

  eleventyConfig.addFilter("jsonify", value => JSON.stringify(value));
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

  eleventyConfig.addFilter("relatedProducts", function(allProducts, currentSlug, currentType, currentAccords) {
    const sameType = allProducts.filter(p => p.type === currentType && p.slug !== currentSlug);
    let accordsList = [];
    if (Array.isArray(currentAccords)) {
      accordsList = currentAccords;
    } else if (typeof currentAccords === 'string') {
      accordsList = currentAccords.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    }
    if (currentType === 'fragrance' && accordsList.length) {
      return sameType.map(p => ({
        ...p,
        score: (p.accords||[]).filter(a => accordsList.includes(a)).length
      })).sort((a,b) => b.score - a.score).slice(0,4);
    }
    return sameType.slice(0,4);
  });

  eleventyConfig.addFilter("detailsJson", function(data) {
    const rows = [];
    if (data.concentration) {
      if (data.name) rows.push({label:'Product Name',value:data.name});
      if (data.concentration) rows.push({label:'Concentration',value:data.concentration});
      if (data.size) rows.push({label:'Size',value:data.size});
      if (data.fragrance_family) rows.push({label:'Fragrance Family',value:data.fragrance_family});
      if (data.top_notes) rows.push({label:'Top Notes',value:data.top_notes});
      if (data.heart_notes) rows.push({label:'Heart Notes',value:data.heart_notes});
      if (data.base_notes) rows.push({label:'Base Notes',value:data.base_notes});
      if (data.longevity) rows.push({label:'Longevity',value:data.longevity});
      if (data.projection) rows.push({label:'Projection',value:data.projection});
      if (data.best_for) rows.push({label:'Best For',value:data.best_for});
      if (data.gender) rows.push({label:'Gender',value:data.gender});
      if (data.origin) rows.push({label:'Origin',value:data.origin});
      if (data.launched) rows.push({label:'Launched',value:data.launched});
      rows.push({label:'Vegan & Cruelty-Free',value:data.vegan?'Yes':'No'});
    } else {
      if (data.name) rows.push({label:'Product Name',value:data.name});
      if (data.size) rows.push({label:'Size',value:data.size});
      if (data.skin_type) rows.push({label:'Skin Type',value:data.skin_type});
      if (data.key_ingredients) rows.push({label:'Key Ingredients',value:data.key_ingredients});
      if (data.free_from) rows.push({label:'Free From',value:data.free_from});
      if (data.spf_rating) rows.push({label:'SPF Rating',value:data.spf_rating});
      rows.push({label:'Origin',value:data.origin||'South Korea'});
      rows.push({label:'Vegan & Cruelty-Free',value:data.vegan?'Yes':'No'});
    }
    return JSON.stringify(rows);
  });

  eleventyConfig.addFilter("badgeClass", badge => {
    if (!badge) return '';
    const b = badge.toLowerCase();
    if (b === 'popular') return 'badge-popular';
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
