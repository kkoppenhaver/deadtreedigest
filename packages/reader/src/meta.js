// Shared page-metadata scraping: og:/article:/JSON-LD-free fallbacks used to
// fill whatever a source-specific extractor couldn't determine.

// JSON-LD is where a lot of platforms (Substack included) put the only
// machine-readable publish date and author.
function jsonLd(document) {
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      for (const node of Array.isArray(data) ? data : [data]) {
        if (/Article|Posting/i.test(node?.["@type"] ?? "")) return node;
      }
    } catch {
      /* malformed blocks are common; skip */
    }
  }
  return null;
}

export function pageMeta(document) {
  const meta = (sel, attr = "content") => document.querySelector(sel)?.getAttribute(attr)?.trim() || null;
  const ld = jsonLd(document);
  const ldAuthor = [ld?.author].flat().map((a) => a?.name).filter(Boolean).join(", ") || null;
  return {
    title:
      meta('meta[property="og:title"]') ||
      meta('meta[name="twitter:title"]') ||
      document.querySelector("title")?.textContent?.trim() ||
      null,
    byline: meta('meta[name="author"]') || meta('meta[property="article:author"]') || ldAuthor,
    siteName: meta('meta[property="og:site_name"]') || ld?.publisher?.name || null,
    publishedAt:
      meta('meta[property="article:published_time"]') ||
      meta('meta[name="date"]') ||
      ld?.datePublished ||
      document.querySelector("time[datetime]")?.getAttribute("datetime") ||
      null,
    excerpt: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
    canonicalUrl: meta('link[rel="canonical"]', "href") || meta('meta[property="og:url"]'),
  };
}

export function mergeMeta(primary, fallback) {
  const out = { ...primary };
  for (const k of ["title", "byline", "siteName", "publishedAt", "excerpt", "canonicalUrl"]) {
    if (!out[k] && fallback[k]) out[k] = fallback[k];
  }
  return out;
}
