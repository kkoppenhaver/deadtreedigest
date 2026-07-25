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
import { sanitize, textOf, dedupeLead, excerptDuplicatesLead, foldFootnoteMarkers, repairSplitFootnotes, wrapNotesSections, markNoIndent } from "./sanitize.js";
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

  const sanitized = sanitize(extracted.contentHtml, url);
  const { links } = sanitized;

  let title = extracted.title?.trim() || null;
  const deduped = dedupeLead(sanitized.html, {
    title,
    publishedAt: extracted.publishedAt ?? null,
  });
  const contentHtml = markNoIndent(wrapNotesSections(foldFootnoteMarkers(repairSplitFootnotes(deduped.html))));
  // The lead cleanup may have removed images; keep the inventory honest.
  const images = sanitized.images.filter((src) => contentHtml.includes(src));

  const text = textOf(contentHtml);
  const wordCount = text ? text.split(/\s+/).length : 0;
  if (wordCount < 20) needsReview = true;

  if (!title) {
    title = text.slice(0, 80).trimEnd() + (text.length > 80 ? "…" : "");
  }
  // Pages saved from inside webmail carry the account in the document title
  // ("Subject - user@example.com - Gmail") — strip the suffix chain.
  title = title
    .replace(/\s*[-–—|]\s*[\w.+-]+@[\w.-]+\.\w+\s*(?:[-–—|]\s*Gmail)?$/i, "")
    .replace(/\s*[-–—|]\s*Gmail$/i, "")
    .trim() || title;
  // Sites declare their name as a <title> suffix ("Article | Site"); some
  // extraction paths keep the suffix but eat the separator, baking the site
  // name into the title ("… Career Advice Kalzumeus Software"). When the
  // document's own <title> shows a separated trailing segment and our title
  // ends with it, drop it — the kicker already names the site.
  title = stripDeclaredSiteSuffix(title, html);

  // Excerpts need enough substance to earn standfirst treatment: not empty
  // punctuation, not a stray date line (< 4 words), not a copy of the lead.
  let excerpt = extracted.excerpt?.trim() || null;
  if (excerpt && (excerpt.replace(/[.…\s]/g, "").length === 0 || excerpt.split(/\s+/).length < 4)) {
    excerpt = null;
  }
  if (excerptDuplicatesLead(excerpt, contentHtml)) excerpt = null;

  // A bare hostname beats an empty kicker when the page declares no site name.
  let siteName = extracted.siteName ?? null;
  if (!siteName && url) {
    try {
      siteName = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* keep null */
    }
  }

  return {
    source: kind,
    url,
    canonicalUrl: extracted.canonicalUrl ?? url,
    title,
    byline: extracted.byline ?? null,
    siteName,
    publishedAt: deduped.publishedAt,
    excerpt,
    contentHtml,
    links,
    images,
    wordCount,
    estimatedPages: estimatePages(wordCount, images.length),
    needsReview: needsReview || extracted.needsReview === true,
  };
}

const decodeBasicEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");

function stripDeclaredSiteSuffix(title, html) {
  if (!title) return title;
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  if (!m) return title;
  const docTitle = decodeBasicEntities(m[1]).replace(/\s+/g, " ").trim();
  // Only strong separators split segments; bare colons stay (real titles use
  // them: "Salary Negotiation: Make More Money…").
  const segments = docTitle.split(/\s*\|\s*|\s*»\s*|\s+[–—-]\s+/);
  if (segments.length < 2) return title;
  const suffix = segments[segments.length - 1].trim();
  if (!suffix) return title;
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = title.replace(new RegExp(`\\s*[|»:·–—-]*\\s*${escaped}\\s*$`, "i"), "").trim();
  if (!stripped || stripped === title) return title;
  // Never amputate a title down to a fragment.
  if (stripped.split(/\s+/).length < 3 && stripped.length < 15) return title;
  return stripped;
}
