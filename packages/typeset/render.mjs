#!/usr/bin/env node
// Render spike, layer 1: normalized articles -> paginated PDF via Paged.js in
// headless Chrome (the same engine Cloudflare Browser Rendering runs).
//
//   node packages/typeset/render.mjs <url> [url...] [--stress <pages>]
//
// --stress duplicates the article list until the estimated page count reaches
// the target, to time a full-size (~100pp) issue before trusting the Worker path.

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { parseArticle } from "../reader/src/index.js";
import { issueHtml } from "./src/template.js";

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// pagedjs's exports map hides dist/, so read it by path from the hoisted workspace root
const pagedJs = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../node_modules/pagedjs/dist/paged.polyfill.js"),
  "utf8"
);

const args = process.argv.slice(2);
const stressIdx = args.indexOf("--stress");
const stressTarget = stressIdx !== -1 ? Number(args[stressIdx + 1]) : null;
const stressValueIdx = stressIdx === -1 ? -1 : stressIdx + 1;
const urls = args.filter((a, i) => !a.startsWith("--") && i !== stressValueIdx);
if (urls.length === 0) {
  console.error("usage: node packages/typeset/render.mjs <url> [url...] [--stress <pages>]");
  process.exit(1);
}

// 1. Ingest through the reader.
const articles = [];
for (const url of urls) {
  process.stdout.write(`reading ${url} ... `);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" },
  });
  const article = parseArticle({ html: await res.text(), url });
  if (!article) {
    console.log("FAILED — skipping");
    continue;
  }
  console.log(`ok: "${article.title}" ~${article.estimatedPages}pp`);
  articles.push(article);
}
if (articles.length === 0) {
  console.error("no articles extracted");
  process.exit(1);
}

let issueArticles = [...articles];
if (stressTarget) {
  let estimated = articles.reduce((s, a) => s + a.estimatedPages, 0);
  let n = 1;
  while (estimated < stressTarget) {
    issueArticles.push(...articles.map((a) => ({ ...a, title: `${a.title} (copy ${n})` })));
    estimated += articles.reduce((s, a) => s + a.estimatedPages, 0);
    n++;
  }
  console.log(`stress mode: ${issueArticles.length} articles, ~${Math.round(estimated)}pp estimated`);
}

// 2. Typeset. --spot includes a Find a Bench page using the last map the
// spots CLI generated (packages/spots/.out/spot.svg) — the Paged.js proof
// that the spot page paginates cleanly.
let spot = null;
if (process.argv.includes("--spot")) {
  const svgPath = resolve(dirname(fileURLToPath(import.meta.url)), "../spots/.out/spot.svg");
  spot = {
    copy: "A bench with a backrest under the elms at Palmer Square, eight minutes north. The squirrels are pushy but literate.",
    svg: readFileSync(svgPath, "utf8"),
  };
}

const html = issueHtml(
  { number: 1, dateLabel: "July 2026", articles: issueArticles, spot },
  { pagedJs }
);
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), ".out");
mkdirSync(outDir, { recursive: true });
const htmlFile = resolve(outDir, stressTarget ? "issue-stress.html" : "issue.html");
writeFileSync(htmlFile, html);

// 3. Paginate + print in headless Chrome.
const t0 = Date.now();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const page = await browser.newPage();
  let layoutStalled = false;
  page.on("pageerror", (err) => console.error("page error:", err.message));
  page.on("console", (msg) => {
    // Paged.js aborts pagination via its infinite-loop guard and reports it
    // only on the console — treat it as a render failure, not a short issue.
    if (msg.text().includes("Layout repeated")) layoutStalled = true;
    if (msg.type() === "error" || msg.type() === "warning")
      console.error(`console.${msg.type()}:`, msg.text().slice(0, 300));
  });
  await page.goto(`file://${htmlFile}`, { waitUntil: "load", timeout: 60_000 });

  await page.waitForFunction(() => window.__pagedDone > 0, { timeout: 300_000, polling: 250 });
  const pages = await page.evaluate(() => window.__pagedDone);
  const tPaginated = Date.now();

  const pdfFile = htmlFile.replace(/\.html$/, ".pdf");
  await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true, timeout: 120_000 });
  const tDone = Date.now();

  console.log(`\npaginated: ${pages} pages in ${((tPaginated - t0) / 1000).toFixed(1)}s`);
  console.log(`pdf written in ${((tDone - tPaginated) / 1000).toFixed(1)}s -> ${pdfFile}`);
  if (layoutStalled) {
    console.error("\n✗ RENDER INCOMPLETE: Paged.js hit its layout-repeat guard and truncated the issue.");
    process.exit(2);
  }
} finally {
  await browser.close();
}
