// Generic extractor: Mozilla Readability (the engine behind Firefox reader
// view; Safari Reader works the same way) over the captured DOM.

import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { pageMeta, mergeMeta } from "../meta.js";

export function generic(html, url) {
  const { document } = parseHTML(html);
  const meta = pageMeta(document);

  const readerable = isProbablyReaderable(document);
  const article = new Readability(document, { keepClasses: false }).parse();
  if (!article?.content) return null;

  return mergeMeta(
    {
      title: article.title || null,
      byline: article.byline || null,
      siteName: article.siteName || null,
      publishedAt: article.publishedTime || null,
      excerpt: article.excerpt || null,
      contentHtml: article.content,
      lang: article.lang || null,
      needsReview: !readerable,
    },
    meta
  );
}
