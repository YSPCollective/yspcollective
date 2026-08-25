// Applies to every file under src/_products/**.
// Unpublished products (published: false) are already excluded from the
// fragrances/beauty/allProducts collections used to build the real product-page
// URLs (via product-pages.njk's pagination). Without this, though, Eleventy still
// writes each source .md file out at its own raw permalink (e.g.
// /_products/beauty/some-slug/), so an unpublished product stays reachable at an
// unlinked but live URL. Setting permalink: false here stops that output entirely,
// while leaving the source file (and its published flag) untouched for later.
module.exports = {
  eleventyComputed: {
    permalink: (data) => (data.published === false ? false : data.permalink),
  },
};
