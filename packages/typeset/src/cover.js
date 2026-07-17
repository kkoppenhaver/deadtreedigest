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
    position: absolute; top: ${BLEED + 0.5}in; left: 0; right: 0; text-align: center;
    font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: normal; font-size: 34pt; line-height: 1.02;
    letter-spacing: 0.02em; text-transform: uppercase; color: var(--pine-deep);
  }
  .front .issue-strip {
    position: absolute; top: ${BLEED + 1.45}in; left: 0; right: 0; text-align: center;
    font-family: 'Courier Prime', 'Courier New', monospace; font-size: 9.5pt; letter-spacing: 0.28em; text-transform: uppercase; color: var(--rust);
  }
  /* paper chip so the strip survives crossing the sun */
  .front .issue-strip span { background: var(--paper); border: 1.5pt solid var(--ink); padding: 3pt 10pt; }
  .front .caption {
    position: absolute; bottom: ${BLEED + 0.42}in; left: ${BLEED + 0.5}in; right: ${BLEED + 0.5}in;
    background: var(--paper); border: 2.5pt solid var(--ink); padding: 8pt 12pt; text-align: center;
  }
  .front .caption .big { font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: bold; font-size: 13pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--pine-deep); }
  .front .caption .small { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: var(--rust); margin-top: 3pt; }

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
    <rect y="80" width="460" height="34" fill="#e3ba62"/>
    <rect y="150" width="460" height="34" fill="#dfb04e"/>
    <g fill="#bf4e24">
      <circle cx="340" cy="180" r="52"/>
      <g stroke="#bf4e24" stroke-width="8" opacity="0.75">
        <line x1="340" y1="92" x2="340" y2="114"/>
        <line x1="271" y1="117" x2="287" y2="133"/>
        <line x1="409" y1="117" x2="393" y2="133"/>
        <line x1="248" y1="180" x2="272" y2="180"/>
        <line x1="432" y1="180" x2="408" y2="180"/>
      </g>
    </g>
    <path d="M0 360 L90 270 L170 350 L260 260 L350 355 L460 280 L460 470 L0 470 Z" fill="#8f9e6b"/>
    <path d="M0 430 L120 330 L230 430 L330 340 L460 440 L460 560 L0 560 Z" fill="#4f7a53"/>
    <g>
      <g transform="translate(52,330)">
        <polygon points="30,0 58,52 2,52" fill="#1f4d38"/>
        <polygon points="30,28 64,90 -4,90" fill="#1a4231"/>
        <polygon points="30,60 72,135 -12,135" fill="#14352a"/>
        <rect x="25" y="135" width="10" height="24" fill="#5b3a25"/>
      </g>
      <g transform="translate(360,318) scale(1.05)">
        <polygon points="30,0 58,52 2,52" fill="#1f4d38"/>
        <polygon points="30,28 64,90 -4,90" fill="#1a4231"/>
        <polygon points="30,60 72,135 -12,135" fill="#14352a"/>
        <rect x="25" y="135" width="10" height="24" fill="#5b3a25"/>
      </g>
    </g>
    <path d="M0 545 Q 120 518 240 542 Q 360 564 460 538 L460 700 L0 700 Z" fill="#c9a94f"/>
    <path d="M0 590 Q 150 566 300 590 Q 400 606 460 592 L460 700 L0 700 Z" fill="#b98f3c"/>
    <g transform="translate(206,548)">
      <ellipse cx="22" cy="34" rx="30" ry="9" fill="#8a5a33" opacity="0.35"/>
      <path d="M4 6 Q 2 26 6 32 L38 32 Q 42 24 40 6 Z" fill="#7a4a2a"/>
      <ellipse cx="22" cy="6" rx="18" ry="7" fill="#c99e6a"/>
      <ellipse cx="22" cy="6" rx="11" ry="4.2" fill="none" stroke="#7a4a2a" stroke-width="1.6"/>
      <ellipse cx="22" cy="6" rx="5" ry="2" fill="none" stroke="#7a4a2a" stroke-width="1.4"/>
    </g>
    <g fill="#2b6248">
      <g transform="translate(46,592)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(86,610) scale(0.9)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(128,598)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(166,616) scale(1.1)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(252,614) scale(0.95)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(290,600)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(326,618) scale(0.9)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(366,604) scale(1.1)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(408,620) scale(0.85)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
      <g transform="translate(222,626) scale(0.95)"><polygon points="8,0 15,16 1,16"/><rect x="6.5" y="16" width="3" height="6" fill="#5b3a25"/></g>
    </g>
  </svg>
  <div class="mast">Dead Tree Digest</div>
  <div class="issue-strip"><span>Issue № ${number}${dateLabel ? ` — ${dateLabel}` : ""}</span></div>
  <div class="caption">
    <div class="big">Read what you meant to read.</div>
    <div class="small">deadtreedigest.com</div>
  </div>
</div>

</body>
</html>`;
}
