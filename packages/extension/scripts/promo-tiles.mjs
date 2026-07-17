#!/usr/bin/env node
// Chrome Web Store promo tiles: small 440x280 + marquee 1400x560 (JPEG, no alpha).
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

mkdirSync("dist", { recursive: true });
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Fjalla+One&family=Lora:ital@1&family=Courier+Prime&display=block" rel="stylesheet">`;

const scene = (w, h) => `
<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMax slice" style="display:block">
  <rect width="${w}" height="${h}" fill="#e8c579"/>
  <rect y="${h*0.12}" width="${w}" height="${h*0.06}" fill="#e3ba62"/>
  <circle cx="${w*0.78}" cy="${h*0.22}" r="${h*0.13}" fill="#bf4e24"/>
  <path d="M0 ${h*0.52} L${w*0.22} ${h*0.34} L${w*0.45} ${h*0.52} L${w*0.68} ${h*0.36} L${w} ${h*0.5} L${w} ${h} L0 ${h} Z" fill="#8f9e6b"/>
  <path d="M0 ${h*0.66} L${w*0.3} ${h*0.5} L${w*0.6} ${h*0.66} L${w} ${h*0.54} L${w} ${h} L0 ${h} Z" fill="#4f7a53"/>
  <g transform="translate(${w*0.08},${h*0.42}) scale(${h/340})">
    <polygon points="30,0 58,52 2,52" fill="#1f4d38"/><polygon points="30,28 64,90 -4,90" fill="#1a4231"/><polygon points="30,60 72,135 -12,135" fill="#14352a"/><rect x="25" y="135" width="10" height="24" fill="#5b3a25"/>
  </g>
  <g transform="translate(${w*0.86},${h*0.4}) scale(${h/320})">
    <polygon points="30,0 58,52 2,52" fill="#1f4d38"/><polygon points="30,28 64,90 -4,90" fill="#1a4231"/><polygon points="30,60 72,135 -12,135" fill="#14352a"/><rect x="25" y="135" width="10" height="24" fill="#5b3a25"/>
  </g>
  <path d="M0 ${h*0.85} Q ${w*0.3} ${h*0.78} ${w*0.6} ${h*0.85} Q ${w*0.82} ${h*0.9} ${w} ${h*0.86} L${w} ${h} L0 ${h} Z" fill="#c9a94f"/>
</svg>`;

async function shot(html, path, w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html><head>${FONTS}<style>*{margin:0;padding:0;box-sizing:border-box}</style></head><body>${html}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type: "jpeg", quality: 95 });
  console.log(path);
}

// Marquee 1400x560
await shot(`
<div style="width:1400px;height:560px;background:#f1e6cf;display:flex;overflow:hidden;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 20px 0 90px;">
    <div style="font-family:'Courier Prime',monospace;font-size:17px;letter-spacing:0.3em;text-transform:uppercase;color:#bf4e24;margin-bottom:18px;">“Read later” usually means read never</div>
    <div style="font-family:'Fjalla One',sans-serif;font-size:96px;line-height:0.98;text-transform:uppercase;color:#14352a;">Dead Tree<br>Digest</div>
    <div style="font-family:'Lora',Georgia,serif;font-style:italic;font-size:29px;color:#4a4032;margin-top:22px;">The articles you save, printed &amp; delivered.</div>
  </div>
  <div style="width:600px;border-left:4px solid #2b2419;">${scene(600, 560)}</div>
</div>`, "dist/promo-marquee-1400x560.jpg", 1400, 560);

// Small 440x280
await shot(`
<div style="width:440px;height:280px;background:#f1e6cf;display:flex;flex-direction:column;overflow:hidden;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
    <div style="font-family:'Fjalla One',sans-serif;font-size:44px;line-height:1;text-transform:uppercase;color:#14352a;">Dead Tree<br>Digest</div>
    <div style="font-family:'Lora',Georgia,serif;font-style:italic;font-size:16px;color:#4a4032;margin-top:10px;">Your saved articles, printed.</div>
  </div>
  <div style="height:86px;border-top:3px solid #2b2419;">${scene(440, 86)}</div>
</div>`, "dist/promo-small-440x280.jpg", 440, 280);

await browser.close();
