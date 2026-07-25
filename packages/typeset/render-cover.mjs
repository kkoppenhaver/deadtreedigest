#!/usr/bin/env node
// Local cover render: node packages/typeset/render-cover.mjs <pages> <articles> [issueNo]
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { coverHtml, spineWidthIn } from "./src/cover.js";

const [pages = "56", articles = "5", number = "1"] = process.argv.slice(2);
const html = coverHtml({ number: Number(number), dateLabel: "July 2026", pageCount: Number(pages), articleCount: Number(articles) });

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });
const htmlFile = resolve(outDir, `cover-${number}.html`);
writeFileSync(htmlFile, html);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.goto(`file://${htmlFile}`, { waitUntil: "networkidle0" });
const pdfFile = htmlFile.replace(/\.html$/, ".pdf");
await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`spine: ${spineWidthIn(Number(pages)).toFixed(3)}in -> ${pdfFile}`);
