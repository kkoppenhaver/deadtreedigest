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

export function coverHtml({ number, dateLabel = "", pageCount, articleCount, treesPlanted = 10, treesTotal = null }) {
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
  .back .tagline { font-style: italic; font-size: 16pt; line-height: 1.55; }
  .back .tagline strong { font-size: 17pt; }
  .back .tagline strong { color: var(--ochre); font-style: normal; }
  .back .trees { text-align: center; }
  .back .trees .tn { font-family: 'Fjalla One', Helvetica, sans-serif; font-size: 64pt; line-height: 1; color: var(--ochre); }
  .back .trees .tc { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 9.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: #cbbf9f; margin-top: 10pt; }
  .back .trees .tp { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: #8d8168; margin-top: 4pt; }
  .back .foot { font-size: 8pt; font-style: italic; color: #cbbf9f; text-align: center; }
  .back .foot .url { font-family: 'Fjalla One', Helvetica, sans-serif; font-style: normal; font-size: 9.5pt; letter-spacing: 0.12em; color: var(--paper); margin-top: 6pt; text-transform: lowercase; }
</style>
<script>window.__pagedDone = 1;</script>
</head>
<body>

<div class="back">
  <div class="tagline"><strong>You did it.</strong></div>
  <div class="trees">
    <div class="tn">${treesTotal ?? treesPlanted}</div>
    <div class="tc">trees planted in your name</div>
    <div class="tp">And more to come</div>
  </div>
  <div class="foot">
    <div class="url">deadtreedigest.com</div>
  </div>
</div>

<div class="spine">${spineText ? `<div class="txt">Dead Tree Digest · Issue № ${number}${dateLabel ? ` · ${dateLabel}` : ""}</div>` : ""}</div>

<div class="front">
  <svg class="scene" viewBox="0 0 460 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f2ddaa"/>
        <stop offset="0.55" stop-color="#e8c579"/>
        <stop offset="1" stop-color="#dcaa55"/>
      </linearGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n"/>
        <feColorMatrix in="n" values="0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.05 0"/>
      </filter>
    </defs>

    <!-- sky -->
    <rect width="460" height="700" fill="url(#sky)"/>

    <!-- sun with glow halos, upper right; light source for the whole scene -->
    <circle cx="352" cy="170" r="78" fill="#bf4e24" opacity="0.08"/>
    <circle cx="352" cy="170" r="56" fill="#bf4e24" opacity="0.14"/>
    <circle cx="352" cy="170" r="36" fill="#c65a2e"/>
    <circle cx="352" cy="170" r="36" fill="none" stroke="#f2ddaa" stroke-width="1.5" opacity="0.5"/>

    <!-- birds -->
    <g stroke="#8a5a33" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round">
      <path d="M120 200 q6 -7 12 0 q6 -7 12 0"/>
      <path d="M165 224 q5 -6 10 0 q5 -6 10 0"/>
    </g>

    <!-- L1: far ridge — hazy, near sky value (atmospheric perspective) -->
    <path d="M0 340 L70 296 L128 330 L205 282 L268 326 L332 296 L395 330 L460 302 L460 420 L0 420 Z" fill="#d3bd85"/>
    <path d="M205 282 L268 326 L232 326 Z" fill="#dcc794" opacity="0.9"/>
    <path d="M70 296 L128 330 L96 330 Z" fill="#dcc794" opacity="0.9"/>

    <!-- L2: mid ridge — sage, faceted lit/shadow -->
    <path d="M0 408 L58 352 L120 402 L196 336 L262 398 L338 352 L410 400 L460 370 L460 500 L0 500 Z" fill="#a3ad7c"/>
    <path d="M196 336 L262 398 L214 398 Z" fill="#b1ba8a"/>
    <path d="M338 352 L410 400 L362 400 Z" fill="#b1ba8a"/>
    <path d="M58 352 L120 402 L58 402 Z" fill="#95a06f"/>

    <!-- L3: near ridge — deep green, stronger contrast -->
    <path d="M0 490 L88 428 L170 486 L258 420 L336 482 L406 440 L460 474 L460 580 L0 580 Z" fill="#5d7a55"/>
    <path d="M258 420 L336 482 L282 482 Z" fill="#6a8961"/>
    <path d="M88 428 L170 486 L104 486 Z" fill="#516d4b"/>
    <!-- pine silhouette band along its base -->
    <path d="M0 540 l14 -22 12 22 6 -10 10 18 12 -24 12 24 8 -14 10 16 14 -26 12 26 8 -12 10 14 12 -22 12 22 6 -10 10 16 14 -24 12 24 8 -14 12 18 12 -20 12 20 8 -12 10 14 14 -22 12 22 6 -8 8 10 V585 H0 Z" fill="#31543f"/>

    <!-- L4: valley floor with winding path leading to the stump -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="#c9a94f"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="#b8923e"/>
    <path d="M300 574 Q 250 596 180 606 Q 110 616 88 648 Q 76 668 92 700 L150 700 Q 138 668 156 650 Q 186 622 250 612 Q 310 602 330 578 Z" fill="#dcc17a" opacity="0.9"/>

    <!-- big pine, right, faceted with sun-side lighting -->
    <g>
      <polygon points="392,388 424,452 360,452" fill="#1f4d38"/>
      <polygon points="392,388 424,452 392,452" fill="#2b6248"/>
      <polygon points="392,424 434,502 350,502" fill="#193f2e"/>
      <polygon points="392,424 434,502 392,502" fill="#26573f"/>
      <polygon points="392,464 446,560 338,560" fill="#14352a"/>
      <polygon points="392,464 446,560 392,560" fill="#1f4d38"/>
      <polygon points="386,560 398,560 400,592 384,592" fill="#5b3a25"/>
      <polygon points="392,560 398,560 400,592 392,592" fill="#6d472c"/>
    </g>

    <!-- hero stump, low-poly faceted, casting a long evening shadow -->
    <g>
      <ellipse cx="132" cy="646" rx="64" ry="12" fill="#8a5a33" opacity="0.3"/>
      <path d="M96 586 L100 636 Q 116 646 132 646 L132 582 Z" fill="#6b3f23"/>
      <path d="M132 582 L132 646 Q 148 646 164 636 L168 586 Z" fill="#8a5a33"/>
      <path d="M120 584 L122 644 L142 644 L144 584 Z" fill="#7a4a2a"/>
      <ellipse cx="132" cy="584" rx="36" ry="13" fill="#d3a873"/>
      <ellipse cx="134" cy="583" rx="26" ry="9" fill="none" stroke="#8a5a33" stroke-width="1.8" opacity="0.7"/>
      <ellipse cx="136" cy="582" rx="16" ry="5.5" fill="none" stroke="#8a5a33" stroke-width="1.5" opacity="0.7"/>
      <ellipse cx="138" cy="581" rx="7" ry="2.5" fill="none" stroke="#8a5a33" stroke-width="1.2" opacity="0.7"/>
    </g>

    <!-- ten saplings along the path, receding toward the ridge -->
    <g>
      <g transform="translate(196,616) scale(1.35)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(232,606) scale(1.2)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(266,598) scale(1.05)"><polygon points="8,0 15,17 1,17" fill="#2f6a4e"/><polygon points="8,0 15,17 8,17" fill="#397a5a"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(296,590) scale(0.9)"><polygon points="8,0 15,17 1,17" fill="#33705427"/><polygon points="8,0 15,17 1,17" fill="#337054"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(322,584) scale(0.78)"><polygon points="8,0 15,17 1,17" fill="#3b7a5c"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(344,578) scale(0.66)"><polygon points="8,0 15,17 1,17" fill="#448463"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(362,574) scale(0.56)"><polygon points="8,0 15,17 1,17" fill="#4d8d6b"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(377,570) scale(0.47)"><polygon points="8,0 15,17 1,17" fill="#579573"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(389,567) scale(0.4)"><polygon points="8,0 15,17 1,17" fill="#619c7b"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(399,564) scale(0.34)"><polygon points="8,0 15,17 1,17" fill="#6ba383"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
    </g>

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>
  <div class="mast">Dead Tree Digest</div>
  ${dateLabel ? `<div class="issue-line">${dateLabel}</div>` : ""}
</div>

</body>
</html>`;
}
