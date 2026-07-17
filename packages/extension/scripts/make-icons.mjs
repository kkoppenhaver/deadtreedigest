#!/usr/bin/env node
// Generates the extension icon set (16/32/48/128) from the brand mark:
// stacked pine on paper, ink border — readable down to 16px.
//   node packages/extension/scripts/make-icons.mjs

import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../icons");
mkdirSync(outDir, { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect x="4" y="4" width="120" height="120" rx="20" fill="#f1e6cf" stroke="#2b2419" stroke-width="8"/>
  <polygon points="64,18 96,62 32,62" fill="#1f4d38"/>
  <polygon points="64,42 102,94 26,94" fill="#14352a"/>
  <rect x="56" y="94" width="16" height="16" fill="#bf4e24"/>
</svg>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();

for (const size of [16, 32, 48, 128]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<body style="margin:0"><div style="width:${size}px;height:${size}px">${svg.replace('width="128" height="128"', `width="${size}" height="${size}"`)}</div></body>`
  );
  await page.screenshot({ path: resolve(outDir, `icon${size}.png`), omitBackground: true });
  console.log(`icon${size}.png`);
}
await browser.close();
