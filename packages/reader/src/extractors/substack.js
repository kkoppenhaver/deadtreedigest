// Substack extractor: posts have a stable content container; the work is
// stripping the growth chrome (subscribe widgets, share buttons, paywall
// upsells) that Readability sometimes lets through. Falls back to generic
// when the expected structure is missing (old themes, heavy customization).

import { parseHTML } from "linkedom";
import { pageMeta, mergeMeta } from "../meta.js";
import { generic } from "./generic.js";

const CRUFT = [
  ".subscription-widget-wrap",
  ".subscription-widget",
  ".subscribe-widget",
  ".captioned-button-wrap",
  '[class*="button-wrapper"]',
  ".image-link-expand",
  ".poll-embed",
  ".community-chat-embed",
  ".digest-post-embed",
  ".install-substack-app",
  ".paywall-jump",
  ".footer-wrap",
  'a[href*="/subscribe"]',
  'a[href*="action=share"]',
];

export function substack(html, url) {
  const { document } = parseHTML(html);
  const body =
    document.querySelector(".available-content .body.markup") ||
    document.querySelector("article .body.markup") ||
    document.querySelector(".body.markup");
  if (!body) return generic(html, url);

  for (const sel of CRUFT) for (const el of body.querySelectorAll(sel)) el.remove();

  const meta = pageMeta(document);
  const subtitle = document.querySelector(".subtitle, h3.subtitle")?.textContent?.trim() || null;
  const paywalled = !!document.querySelector(".paywall, [data-testid='paywall']");

  return mergeMeta(
    {
      // NB: don't add a bare `h1` fallback to this selector list — the site
      // header's h1 precedes the post title in document order and wins.
      title:
        document.querySelector('h1.post-title, h1[class*="post-title"]')?.textContent?.trim() || null,
      byline: document.querySelector('.byline-names a, a[href*="/@"]')?.textContent?.trim() || null,
      excerpt: subtitle,
      contentHtml: body.innerHTML,
      needsReview: paywalled, // truncated free preview — flag rather than print half an article
    },
    meta
  );
}
