module.exports = function(eleventyConfig) {

  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy("src/_redirects");
  eleventyConfig.addPassthroughCopy("src/ysp-chat.js");
  eleventyConfig.addPassthroughCopy("src/ysp-config.js");

  const PRODUCT_FIELDS = ['name','slug','badge','custom_badge','price','rrp','brand','gender',
    'category','image_main','gallery','description_short','description_full','ysp_thoughts',
    'concentration','size','fragrance_family','top_notes','heart_notes','base_notes',
    'accords','longevity','projection','best_for','origin','launched','vegan',
    'skin_type','key_ingredients','free_from','spf_rating','amazon_url','published'];

  function extractProduct(item, type) {
    const d = { type };
    PRODUCT_FIELDS.forEach(f => { if (item.data[f] !== undefined) d[f] = item.data[f]; });
    d.url = `/products/${item.data.slug}.html`;
    return d;
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
  eleventyConfig.addFilter("jsonify", value => JSON.stringify(value));
  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));
  eleventyConfig.addFilter("selectattr", (arr, attr) => {
    // Usage: collection | selectattr("data.featured")
    const keys = attr.split('.');
    return arr.filter(item => {
      let val = item;
      for (const k of keys) val = val ? val[k] : undefined;
      return !!val;
    });
  });

  eleventyConfig.addFilter("relatedProducts", function(allProducts, currentSlug, currentType, currentAccords) {
    const sameType = allProducts.filter(p => p.type === currentType && p.slug !== currentSlug);
    if (currentType === 'fragrance' && currentAccords && currentAccords.length) {
      return sameType.map(p => ({
        ...p,
        score: (p.accords||[]).filter(a => currentAccords.includes(a)).length
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
