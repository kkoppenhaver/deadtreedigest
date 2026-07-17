// Perfect-bound cover: one landscape spread — back cover | spine | front
// cover — sized to Lulu's spec with 0.125in bleed on every outside edge.
// Spine width comes from the interior page count: 060UW444 paper is 444
// pages-per-inch, so spine = pages / 444.
//
// The front is the brand's WPA poster (one stump, ten saplings) in full
// color — the interior is B&W, the cover is where the palette lives.

const BLEED = 0.125;
const TRIM_W = 5.5;
const TRIM_H = 8.5;
const PAGES_PER_INCH = 444;
// Lulu guideline: spine text needs ~80+ pages of spine to sit safely.
const SPINE_TEXT_MIN_PAGES = 80;

const escapeCover = (t) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function spineWidthIn(pageCount) {
  return pageCount / PAGES_PER_INCH;
}

import { FONTS_CSS } from "./fonts.css.js";

export function coverHtml({ number, dateLabel = "", pageCount, articleCount, treesPlanted = 10 }) {
  const spine = spineWidthIn(pageCount);
  const W = (BLEED + TRIM_W + spine + TRIM_W + BLEED).toFixed(4);
  const H = (BLEED + TRIM_H + BLEED).toFixed(4);
  const spineText = pageCount >= SPINE_TEXT_MIN_PAGES;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>DTD Cover — Issue ${number}</title>
<style>
  ${FONTS_CSS}
  :root {
    --paper: #f1e6cf; --ink: #2b2419; --pine: #1f4d38; --pine-deep: #14352a;
    --rust: #bf4e24; --ochre: #d9a13b; --sky: #e8c579;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: ${W}in ${H}in; margin: 0; }
  body { width: ${W}in; height: ${H}in; font-family: 'Lora', Georgia, serif; color: var(--ink); display: flex; }

  .back  { width: ${(BLEED + TRIM_W).toFixed(4)}in; height: 100%; background: var(--pine-deep); color: var(--paper); padding: ${BLEED + 0.55}in ${BLEED + 0.45}in; padding-left: ${0.45 + BLEED}in; display: flex; flex-direction: column; justify-content: space-between; }
  .spine { width: ${spine.toFixed(4)}in; height: 100%; background: var(--rust); color: var(--paper); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .front { width: ${(BLEED + TRIM_W).toFixed(4)}in; height: 100%; background: var(--sky); position: relative; overflow: hidden; }

  .spine .txt { transform: rotate(90deg); white-space: nowrap; font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: bold; font-size: ${Math.min(11, spine * 44)}pt; letter-spacing: 0.14em; text-transform: uppercase; }

  /* front */
  .front svg.scene { position: absolute; inset: 0; width: 100%; height: 100%; }
  .front .mast {
    position: absolute; top: ${BLEED + 0.42}in; left: 0; right: 0; text-align: center;
    font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: normal; font-size: 33pt; line-height: 1;
    letter-spacing: 0.02em; text-transform: uppercase; color: var(--pine-deep);
  }
  .front .issue-line {
    position: absolute; top: ${BLEED + 0.96}in; left: 0; right: 0; text-align: center;
    font-family: 'Courier Prime', monospace; font-size: 8pt; letter-spacing: 0.34em; text-transform: uppercase; color: var(--pine-deep); opacity: 0.75;
  }

  /* back */
  .back .tagline { font-style: italic; font-size: 13pt; line-height: 1.5; }
  .back .tagline strong { color: var(--ochre); font-style: normal; }
  .back .ledger { border: 2pt solid var(--paper); padding: 12pt 14pt; font-family: 'Courier Prime', 'Courier New', monospace; font-size: 9pt; }
  .back .ledger .h { text-align: center; font-weight: bold; letter-spacing: 0.2em; margin-bottom: 8pt; }
  .back .ledger .row { display: flex; justify-content: space-between; padding: 3pt 0; border-bottom: 0.5pt dotted rgba(241,230,207,0.4); }
  .back .ledger .row:last-child { border-bottom: none; font-weight: bold; }
  .back .foot { font-size: 8pt; font-style: italic; color: #cbbf9f; text-align: center; }
  .back .foot .url { font-family: 'Fjalla One', Helvetica, sans-serif; font-style: normal; font-size: 9.5pt; letter-spacing: 0.12em; color: var(--paper); margin-top: 6pt; text-transform: lowercase; }
</style>
<script>window.__pagedDone = 1;</script>
</head>
<body>

<div class="back">
  <div class="tagline">The articles you saved,<br><strong>finally read.</strong></div>
  <div class="ledger">
    <div class="h">★ THE LEDGER ★</div>
    <div class="row"><span>This issue</span><span>${pageCount} pages · ${articleCount} article${articleCount === 1 ? "" : "s"}</span></div>
    <div class="row"><span>Trees consumed</span><span>${(pageCount / 2 / 8000).toFixed(4)}</span></div>
    <div class="row"><span>Trees planted</span><span>${treesPlanted}</span></div>
  </div>
  <div class="foot">
    Printed on recycled or FSC-certified stock.<br>The dead tree is partly fiction; the ten trees planted with TIST Kenya are not.
    <div class="url">deadtreedigest.com</div>
  </div>
</div>

<div class="spine">${spineText ? `<div class="txt">Dead Tree Digest · Issue № ${number}${dateLabel ? ` · ${dateLabel}` : ""}</div>` : ""}</div>

<div class="front">
  <svg class="scene" viewBox="0 0 460 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <rect width="460" height="700" fill="#e8c579"/>
    <rect y="120" width="460" height="26" fill="#e3ba62"/>
    <rect y="180" width="460" height="26" fill="#dfb04e"/>
    <g fill="#bf4e24">
      <circle cx="385" cy="175" r="38"/>
      <g stroke="#bf4e24" stroke-width="6" opacity="0.75">
        <line x1="385" y1="112" x2="385" y2="128"/>
        <line x1="335" y1="132" x2="347" y2="144"/>
        <line x1="435" y1="132" x2="423" y2="144"/>
        <line x1="318" y1="175" x2="336" y2="175"/>
      </g>
    </g>
    <path d="M0 420 L110 340 L230 420 L340 350 L460 415 L460 700 L0 700 Z" fill="#8f9e6b"/>
    <path d="M0 470 L140 400 L300 475 L460 420 L460 700 L0 700 Z" fill="#4f7a53"/>
    <g transform="translate(368,380) scale(1.15)">
      <polygon points="30,0 58,52 2,52" fill="#1f4d38"/>
      <polygon points="30,28 64,90 -4,90" fill="#1a4231"/>
      <polygon points="30,60 72,135 -12,135" fill="#14352a"/>
      <rect x="25" y="135" width="10" height="26" fill="#5b3a25"/>
    </g>
    <path d="M0 560 Q 130 535 260 558 Q 380 578 460 556 L460 700 L0 700 Z" fill="#c9a94f"/>
    <path d="M0 615 Q 150 592 310 615 Q 410 630 460 618 L460 700 L0 700 Z" fill="#b98f3c"/>
    <g transform="translate(58,540) scale(2)">
      <ellipse cx="22" cy="34" rx="30" ry="9" fill="#8a5a33" opacity="0.35"/>
      <path d="M4 6 Q 2 26 6 32 L38 32 Q 42 24 40 6 Z" fill="#7a4a2a"/>
      <ellipse cx="22" cy="6" rx="18" ry="7" fill="#c99e6a"/>
      <ellipse cx="22" cy="6" rx="11" ry="4.2" fill="none" stroke="#7a4a2a" stroke-width="1.6"/>
      <ellipse cx="22" cy="6" rx="5" ry="2" fill="none" stroke="#7a4a2a" stroke-width="1.4"/>
    </g>
    <g fill="#2b6248">
      <g transform="translate(180,585) scale(1.3)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(220,596) scale(1.15)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(258,588) scale(1.05)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(294,600) scale(0.95)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(328,592) scale(0.85)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(358,602) scale(0.75)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(384,595) scale(0.65)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(406,604) scale(0.6)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(426,598) scale(0.55)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(443,606) scale(0.5)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
    </g>
  </svg>
  <div class="mast">Dead Tree Digest</div>
  ${dateLabel ? `<div class="issue-line">${dateLabel}</div>` : ""}
</div>

</body>
</html>`;
}
