// LinkedIn extractor: two shapes. /pulse/ articles are real articles and
// Readability handles them (minus the "| LinkedIn" title suffix). Feed posts
// (/posts/, /feed/update/) are short-form; grab the post text container from
// the public-page markup, fall back to generic + review flag when LinkedIn
// inevitably renames things.

import { parseHTML } from "linkedom";
import { pageMeta, mergeMeta } from "../meta.js";
import { generic } from "./generic.js";

const POST_TEXT_SELECTORS = [
  '[data-test-id="main-feed-activity-card"] .attributed-text-segment-list__container',
  ".attributed-text-segment-list__container",
  '[class*="feed-shared-inline-show-more-text"]',
  '[data-test-id="main-feed-activity-card__commentary"]',
];

export function linkedin(html, url) {
  const isArticle = /\/pulse\//.test(url ?? "");
  if (isArticle) {
    const res = generic(html, url);
    if (res?.title) res.title = res.title.replace(/\s*\|\s*LinkedIn\s*$/, "");
    if (res) res.siteName = "LinkedIn";
    return res;
  }

  const { document } = parseHTML(html);
  let container = null;
  for (const sel of POST_TEXT_SELECTORS) {
    container = document.querySelector(sel);
    if (container) break;
  }
  if (!container) {
    const res = generic(html, url);
    if (res) {
      res.siteName = "LinkedIn";
      res.needsReview = true; // unknown post markup — verify before printing
    }
    return res;
  }

  const meta = pageMeta(document);
  const byline =
    document.querySelector('[data-test-id="main-feed-activity-card"] a[href*="/in/"]')?.textContent?.trim() ||
    null;
  const text = container.innerHTML;

  return mergeMeta(
    {
      title: null, // posts are untitled; index.js derives one from the excerpt
      byline,
      siteName: "LinkedIn",
      contentHtml: text,
    },
    meta
  );
}
