// Email extractor: newsletters arrive as table-soup HTML. Layout tables get
// unwrapped (email tables are scaffolding, not data), hidden preheader text
// and tracking pixels get dropped, then Readability finds the story. Substack
// newsletters short-circuit to the Substack extractor.

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { pageMeta, mergeMeta } from "../meta.js";
import { substack } from "./substack.js";

export function email(html, url, { subject = null, from = null } = {}) {
  if (html.includes("substackcdn.com")) {
    const res = substack(html, url);
    if (res) return withEmailMeta(res, subject, from);
  }

  const { document } = parseHTML(html);

  // Preheader/hidden content: invisible in mail clients, garbage in print.
  for (const el of document.querySelectorAll("[style]")) {
    const style = el.getAttribute("style") ?? "";
    if (/display\s*:\s*none|max-height\s*:\s*0|font-size\s*:\s*[01]px|opacity\s*:\s*0(?!\.)/i.test(style)) {
      el.remove();
    }
  }

  // Unwrap layout tables so Readability sees prose, not grid scaffolding.
  for (const tag of ["table", "tbody", "thead", "tr", "td", "th", "center"]) {
    for (const el of [...document.querySelectorAll(tag)]) {
      el.replaceWith(...el.childNodes);
    }
  }

  const meta = pageMeta(document);
  const article = new Readability(document, { keepClasses: false, charThreshold: 100 }).parse();
  const contentHtml = article?.content ?? document.body?.innerHTML ?? null;
  if (!contentHtml) return null;

  return withEmailMeta(
    mergeMeta(
      {
        title: article?.title || null,
        byline: article?.byline || null,
        excerpt: article?.excerpt || null,
        contentHtml,
        needsReview: !article, // raw-body fallback: check it before it ships
      },
      meta
    ),
    subject,
    from
  );
}

function withEmailMeta(res, subject, from) {
  if (!res.title && subject) res.title = subject;
  if (!res.byline && from) res.byline = from;
  return res;
}
