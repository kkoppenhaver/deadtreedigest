#!/usr/bin/env node
// Try the reader on a live URL:  node packages/reader/cli.mjs <url>
// Prints the normalized summary and writes a print-preview HTML file to
// packages/reader/.out/ so you can eyeball the digest HTML.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle } from "./src/index.js";

const url = process.argv[2];
if (!url) {
  console.error("usage: node packages/reader/cli.mjs <url>");
  process.exit(1);
}

const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
  },
  redirect: "follow",
});
if (!res.ok) {
  console.error(`Fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const article = parseArticle({ html: await res.text(), url });
if (!article) {
  console.error("Extraction failed — nothing article-shaped found.");
  process.exit(1);
}

const { contentHtml, links, images, ...summary } = article;
console.log(JSON.stringify({ ...summary, links: links.length, images: images.length }, null, 2));

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), ".out");
mkdirSync(outDir, { recursive: true });
const slug = (article.title ?? "article").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
const file = resolve(outDir, `${slug}.html`);
writeFileSync(
  file,
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${article.title}</title>
<style>
  body { font-family: Georgia, serif; max-width: 34em; margin: 3em auto; line-height: 1.55; color: #222; }
  h2, h3, h4 { line-height: 1.2; }
  .meta { color: #777; font-size: 0.85em; border-bottom: 1px solid #ddd; padding-bottom: 1em; }
  img { max-width: 100%; height: auto; }
  figure { margin: 1.5em 0; } figcaption { font-size: 0.85em; color: #777; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #444; }
  pre { overflow-x: auto; background: #f6f6f4; padding: 1em; font-size: 0.85em; }
</style></head><body>
<div class="meta">${article.byline ?? ""} · ${article.siteName ?? ""} · ~${article.estimatedPages}pp · ${
    article.wordCount
  } words${article.needsReview ? " · ⚠ NEEDS REVIEW" : ""}</div>
<h1>${article.title}</h1>
${contentHtml}
</body></html>`
);
console.log(`\nPreview: ${file}`);
