// @dtd/reader — reading-mode normalizer.
//
// parseArticle({ html, url, source?, email? }) takes raw saved HTML (extension
// DOM capture or inbound email body) and returns one normalized shape ready
// for the library (D1) and the typesetter:
//
//   { source, url, canonicalUrl, title, byline, siteName, publishedAt,
//     excerpt, contentHtml, links, images, wordCount, estimatedPages,
//     needsReview }
//
// contentHtml uses only the small "digest HTML" tag vocabulary (see
// sanitize.js), so the print stylesheet can style it exhaustively.
// Workers-compatible: linkedom + @mozilla/readability, no Node APIs.

import { detectSource } from "./detect.js";
import { generic } from "./extractors/generic.js";
import { substack } from "./extractors/substack.js";
import { twitter } from "./extractors/twitter.js";
import { linkedin } from "./extractors/linkedin.js";
import { email } from "./extractors/email.js";
import { sanitize, textOf } from "./sanitize.js";
import { estimatePages } from "./estimate.js";

const EXTRACTORS = { generic, substack, twitter, linkedin, email };

export function parseArticle({ html, url = null, source = null, email: emailMeta = null }) {
  if (!html) throw new Error("parseArticle: html is required");

  const kind = source ?? (emailMeta ? "email" : detectSource(url, html));
  const extract = EXTRACTORS[kind] ?? generic;

  let extracted =
    kind === "email" ? extract(html, url, emailMeta) : extract(html, url);

  let needsReview = extracted?.needsReview ?? false;
  if (!extracted?.contentHtml && kind !== "generic") {
    extracted = generic(html, url);
    needsReview = true; // source-specific extraction failed; eyeball the fallback
  }
  if (!extracted?.contentHtml) return null;

  const { html: contentHtml, links, images } = sanitize(extracted.contentHtml, url);
  const text = textOf(contentHtml);
  const wordCount = text ? text.split(/\s+/).length : 0;
  if (wordCount < 20) needsReview = true;

  let title = extracted.title?.trim() || null;
  if (!title) {
    title = text.slice(0, 80).trimEnd() + (text.length > 80 ? "…" : "");
  }

  return {
    source: kind,
    url,
    canonicalUrl: extracted.canonicalUrl ?? url,
    title,
    byline: extracted.byline ?? null,
    siteName: extracted.siteName ?? null,
    publishedAt: extracted.publishedAt ?? null,
    excerpt: extracted.excerpt && extracted.excerpt.replace(/[.…\s]/g, "").length > 0 ? extracted.excerpt : null,
    contentHtml,
    links,
    images,
    wordCount,
    estimatedPages: estimatePages(wordCount, images.length),
    needsReview: needsReview || extracted.needsReview === true,
  };
}
