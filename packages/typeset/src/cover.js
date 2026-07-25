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
import { PALETTES, seasonFor, timeFor } from "./palettes.js";

// The locale scenes (issue #12). Each is a function of a season palette
// returning the full front-cover <svg>. The roster rotates by issue number
// in the closer; the spine and back cover never change.
// Day gets the sun and birds; night gets the moon, craters, and a fixed
// star field (deterministic — rerenders can't reshuffle the sky).
const STARS = [
  [46, 96, 1.6, 0.9], [92, 178, 1.1, 0.7], [138, 64, 1.3, 0.8], [176, 142, 1.0, 0.6],
  [216, 88, 1.5, 0.9], [252, 190, 1.1, 0.65], [286, 60, 1.2, 0.75], [312, 236, 1.0, 0.6],
  [388, 84, 1.4, 0.85], [420, 210, 1.1, 0.7], [72, 258, 1.2, 0.7], [232, 282, 1.0, 0.55],
  [412, 296, 1.3, 0.75], [148, 300, 1.0, 0.6],
];

function skyActors(p) {
  if (!p.night) {
    return `<!-- sun with glow halos, upper right; light source for the whole scene -->
    <circle cx="352" cy="170" r="78" fill="${p.sunGlow}" opacity="0.08"/>
    <circle cx="352" cy="170" r="56" fill="${p.sunGlow}" opacity="0.14"/>
    <circle cx="352" cy="170" r="36" fill="${p.sun}"/>
    <circle cx="352" cy="170" r="36" fill="none" stroke="${p.sky0}" stroke-width="1.5" opacity="0.5"/>
    <g stroke="${p.birds}" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round">
      <path d="M120 200 q6 -7 12 0 q6 -7 12 0"/>
      <path d="M165 224 q5 -6 10 0 q5 -6 10 0"/>
    </g>`;
  }
  return `<!-- moon with glow, upper right; the night's light source -->
    <circle cx="352" cy="170" r="70" fill="${p.sunGlow}" opacity="0.10"/>
    <circle cx="352" cy="170" r="48" fill="${p.sunGlow}" opacity="0.12"/>
    <circle cx="352" cy="170" r="32" fill="${p.sun}"/>
    <circle cx="340" cy="160" r="6" fill="${p.sunGlow}" opacity="0.45"/>
    <circle cx="360" cy="182" r="4" fill="${p.sunGlow}" opacity="0.4"/>
    <circle cx="349" cy="175" r="2.6" fill="${p.sunGlow}" opacity="0.4"/>
    <g>${STARS.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.stars}" opacity="${o}"/>`).join("")}</g>`;
}

function mountainScene(p) {
  return `<svg class="scene" viewBox="0 0 460 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.sky0}"/>
        <stop offset="0.55" stop-color="${p.sky1}"/>
        <stop offset="1" stop-color="${p.sky2}"/>
      </linearGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n"/>
        <feColorMatrix in="n" values="0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.05 0"/>
      </filter>
    </defs>

    <!-- sky -->
    <rect width="460" height="700" fill="url(#sky)"/>

${skyActors(p)}

    <!-- L1: far ridge — hazy, near sky value (atmospheric perspective) -->
    <path d="M0 340 L70 296 L128 330 L205 282 L268 326 L332 296 L395 330 L460 302 L460 420 L0 420 Z" fill="${p.far}"/>
    <path d="M205 282 L268 326 L232 326 Z" fill="${p.farLit}" opacity="0.9"/>
    <path d="M70 296 L128 330 L96 330 Z" fill="${p.farLit}" opacity="0.9"/>

    <!-- L2: mid ridge — faceted lit/shadow -->
    <path d="M0 408 L58 352 L120 402 L196 336 L262 398 L338 352 L410 400 L460 370 L460 500 L0 500 Z" fill="${p.mid}"/>
    <path d="M196 336 L262 398 L214 398 Z" fill="${p.midLit}"/>
    <path d="M338 352 L410 400 L362 400 Z" fill="${p.midLit}"/>
    <path d="M58 352 L120 402 L58 402 Z" fill="${p.midShade}"/>

    <!-- L3: near ridge — stronger contrast -->
    <path d="M0 490 L88 428 L170 486 L258 420 L336 482 L406 440 L460 474 L460 580 L0 580 Z" fill="${p.near}"/>
    <path d="M258 420 L336 482 L282 482 Z" fill="${p.nearLit}"/>
    <path d="M88 428 L170 486 L104 486 Z" fill="${p.nearShade}"/>
    <!-- pine silhouette band along its base -->
    <path d="M0 540 l14 -22 12 22 6 -10 10 18 12 -24 12 24 8 -14 10 16 14 -26 12 26 8 -12 10 14 12 -22 12 22 6 -10 10 16 14 -24 12 24 8 -14 12 18 12 -20 12 20 8 -12 10 14 14 -22 12 22 6 -8 8 10 V585 H0 Z" fill="${p.band}"/>

    <!-- L4: valley floor with winding path leading to the stump -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>
    <path d="M300 574 Q 250 596 180 606 Q 110 616 88 648 Q 76 668 92 700 L150 700 Q 138 668 156 650 Q 186 622 250 612 Q 310 602 330 578 Z" fill="${p.path}" opacity="0.9"/>

    <!-- big pine, right, faceted with sun-side lighting -->
    <g>
      <polygon points="430,388 462,452 398,452" fill="${p.tree0d}"/>
      <polygon points="430,388 462,452 430,452" fill="${p.tree0l}"/>
      <polygon points="430,424 472,502 388,502" fill="${p.tree1d}"/>
      <polygon points="430,424 472,502 430,502" fill="${p.tree1l}"/>
      <polygon points="430,464 484,560 376,560" fill="${p.tree2d}"/>
      <polygon points="430,464 484,560 430,560" fill="${p.tree2l}"/>
      <polygon points="424,560 436,560 438,592 422,592" fill="#5b3a25"/>
      <polygon points="430,560 436,560 438,592 430,592" fill="#6d472c"/>
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

    <!-- saplings along the path, receding toward the ridge (brand motif —
         constant greens in every season) -->
    <g>
      <g transform="translate(196,616) scale(1.35)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(232,606) scale(1.2)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(266,598) scale(1.05)"><polygon points="8,0 15,17 1,17" fill="#2f6a4e"/><polygon points="8,0 15,17 8,17" fill="#397a5a"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(296,590) scale(0.9)"><polygon points="8,0 15,17 1,17" fill="#337054"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(318,586) scale(0.78)"><polygon points="8,0 15,17 1,17" fill="#3b7a5c"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(338,582) scale(0.66)"><polygon points="8,0 15,17 1,17" fill="#448463"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(354,578) scale(0.56)"><polygon points="8,0 15,17 1,17" fill="#4d8d6b"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(368,575) scale(0.47)"><polygon points="8,0 15,17 1,17" fill="#579573"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(380,572) scale(0.4)"><polygon points="8,0 15,17 1,17" fill="#619c7b"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(390,570) scale(0.34)"><polygon points="8,0 15,17 1,17" fill="#6ba383"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
    </g>

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Lakefront: big water, a breakwater beacon, the sun/moon glitter path on
// the surface. Same series grammar as every locale — light source upper
// right, stump lower left, hero pine right, saplings receding along the
// path — so the shelf reads as one collection.
function lakefrontScene(p) {
  return `<svg class="scene" viewBox="0 0 460 700" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${p.sky0}"/>
        <stop offset="0.55" stop-color="${p.sky1}"/>
        <stop offset="1" stop-color="${p.sky2}"/>
      </linearGradient>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="n"/>
        <feColorMatrix in="n" values="0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.05 0"/>
      </filter>
    </defs>

    <!-- sky -->
    <rect width="460" height="700" fill="url(#sky)"/>
${skyActors(p)}

    <!-- distant headland, left, hugging the horizon -->
    <path d="M0 342 L52 330 L118 340 L168 334 L214 344 L214 356 L0 356 Z" fill="${p.far}"/>
    <path d="M52 330 L118 340 L84 340 Z" fill="${p.farLit}" opacity="0.9"/>

    <!-- the lake -->
    <rect x="0" y="356" width="460" height="238" fill="${p.water0}"/>
    <path d="M0 470 Q 140 462 260 470 Q 380 478 460 468 L460 594 L0 594 Z" fill="${p.water1}"/>
    <!-- wave lines -->
    <g stroke="${p.water1}" stroke-width="2" stroke-linecap="round" opacity="0.75">
      <path d="M36 392 h34 M118 386 h22 M196 396 h30 M420 388 h24"/>
      <path d="M66 424 h26 M262 428 h34 M148 440 h22 M388 434 h28"/>
    </g>
    <g stroke="${p.farLit}" stroke-width="2" stroke-linecap="round" opacity="0.5">
      <path d="M90 508 h30 M228 522 h26 M330 500 h34 M52 548 h24 M406 540 h22"/>
    </g>
    <!-- glitter path: the light source reflected on the water -->
    <g stroke="${p.sun}" stroke-linecap="round" opacity="0.6">
      <path d="M346 366 h12" stroke-width="3"/>
      <path d="M340 384 h22" stroke-width="3"/>
      <path d="M348 404 h14" stroke-width="3.5"/>
      <path d="M336 428 h28" stroke-width="3.5"/>
      <path d="M344 456 h18" stroke-width="4"/>
      <path d="M334 488 h32" stroke-width="4"/>
      <path d="M342 522 h22" stroke-width="4.5"/>
      <path d="M330 556 h38" stroke-width="4.5"/>
    </g>

    <!-- breakwater with its beacon, running in from the right -->
    <path d="M262 414 L460 406 L460 424 L262 424 Z" fill="${p.band}"/>
    <path d="M262 414 L460 406 L460 412 L262 419 Z" fill="${p.nearLit}" opacity="0.5"/>
    <g>
      <path d="M282 414 L288 378 L304 378 L310 414 Z" fill="#e8dcc0"/>
      <path d="M296 414 L296 378 L304 378 L310 414 Z" fill="#d3c4a0"/>
      <rect x="286" y="370" width="20" height="10" fill="#bf4e24"/>
      <path d="M284 370 L296 360 L308 370 Z" fill="#a63f1c"/>
      ${p.night ? `<circle cx="296" cy="374" r="7" fill="${p.sun}" opacity="0.55"/><circle cx="296" cy="374" r="3" fill="${p.sun}"/>` : ""}
    </g>

    ${p.night ? "" : `<!-- sails out on the water -->
    <g>
      <path d="M128 430 L128 400 L146 430 Z" fill="#f1e6cf"/>
      <path d="M124 430 L112 430 L118 422 Z" fill="#e4d5b4"/>
      <path d="M110 434 Q 128 442 150 434 L146 430 L114 430 Z" fill="${p.band}"/>
      <path d="M212 398 L212 378 L224 398 Z" fill="#f1e6cf" opacity="0.9"/>
      <path d="M206 401 Q 216 406 230 401 L226 398 L210 398 Z" fill="${p.band}" opacity="0.9"/>
    </g>`}

    <!-- the beach: dune grass band, then sand down to the trim -->
    <path d="M0 584 Q 130 572 250 582 Q 370 592 460 580 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 648 Q 150 624 320 644 Q 410 654 460 646 L460 700 L0 700 Z" fill="${p.ground1}"/>
    <!-- grass tufts along the bluff line -->
    <g stroke="${p.band}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85">
      <path d="M24 584 l-3 -10 M30 584 l0 -12 M36 584 l3 -9"/>
      <path d="M92 578 l-3 -9 M98 578 l0 -11 M104 578 l3 -8"/>
      <path d="M204 582 l-3 -10 M210 582 l0 -12 M216 582 l3 -9"/>
      <path d="M330 586 l-3 -9 M336 586 l0 -11 M342 586 l3 -8"/>
    </g>
    <!-- the path, winding from the stump toward the water -->
    <path d="M300 582 Q 250 600 180 610 Q 110 620 88 650 Q 76 670 92 700 L150 700 Q 138 670 156 652 Q 186 626 250 616 Q 310 606 330 586 Z" fill="${p.path}" opacity="0.9"/>

    <!-- big pine, right (series constant) -->
    <g>
      <polygon points="430,388 462,452 398,452" fill="${p.tree0d}"/>
      <polygon points="430,388 462,452 430,452" fill="${p.tree0l}"/>
      <polygon points="430,424 472,502 388,502" fill="${p.tree1d}"/>
      <polygon points="430,424 472,502 430,502" fill="${p.tree1l}"/>
      <polygon points="430,464 484,560 376,560" fill="${p.tree2d}"/>
      <polygon points="430,464 484,560 430,560" fill="${p.tree2l}"/>
      <polygon points="424,560 436,560 438,592 422,592" fill="#5b3a25"/>
      <polygon points="430,560 436,560 438,592 430,592" fill="#6d472c"/>
    </g>

    <!-- hero stump (series constant) -->
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

    <!-- saplings along the path (series constant) -->
    <g>
      <g transform="translate(196,616) scale(1.35)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(232,606) scale(1.2)"><polygon points="8,0 15,17 1,17" fill="#2b6248"/><polygon points="8,0 15,17 8,17" fill="#357254"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(266,598) scale(1.05)"><polygon points="8,0 15,17 1,17" fill="#2f6a4e"/><polygon points="8,0 15,17 8,17" fill="#397a5a"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(296,590) scale(0.9)"><polygon points="8,0 15,17 1,17" fill="#337054"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(318,586) scale(0.78)"><polygon points="8,0 15,17 1,17" fill="#3b7a5c"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
      <g transform="translate(338,582) scale(0.66)"><polygon points="8,0 15,17 1,17" fill="#448463"/><rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>
    </g>

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

export const SCENES = { mountain: mountainScene, lakefront: lakefrontScene };
export const LOCALE_ROSTER = ["mountain", "lakefront"]; // grows with issue #12's scene batch

export function coverHtml({ number, dateLabel = "", pageCount, articleCount, treesPlanted = 1, treesTotal = null, season = null, time = "day", locale = "mountain" }) {
  const palette = PALETTES[season ?? "summer"]?.[time] ?? PALETTES.summer.day;
  const scene = (SCENES[locale] ?? mountainScene)(palette);
  const mastInk = palette.night ? "#f1e6cf" : "var(--pine-deep)";
  // Chrome truncates the PDF page box to whole points (Lulu rejected job
  // 2959013: 11.5045in CSS came out as exactly 11.500in, 0.002 under Lulu's
  // minimum). Size the sheet in integer points, rounded UP, and let the
  // solid-color spine absorb the sub-point remainder.
  const wPt = Math.ceil((BLEED + TRIM_W + spineWidthIn(pageCount) + TRIM_W + BLEED) * 72);
  const hPt = Math.round((BLEED + TRIM_H + BLEED) * 72); // 8.75in = 630pt exactly
  const spine = wPt / 72 - 2 * (BLEED + TRIM_W); // rendered spine, >= nominal
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
  @page { size: ${wPt}pt ${hPt}pt; margin: 0; }
  body { width: ${wPt}pt; height: ${hPt}pt; font-family: 'Lora', Georgia, serif; color: var(--ink); display: flex; }

  .back  { width: ${(BLEED + TRIM_W).toFixed(4)}in; height: 100%; background: ${palette.back}; color: var(--paper); padding: ${BLEED + 0.55}in ${BLEED + 0.45}in; padding-left: ${0.45 + BLEED}in; display: flex; flex-direction: column; justify-content: space-between; }
  .spine { flex: 1; height: 100%; background: ${palette.spine}; color: var(--paper); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .front { width: ${(BLEED + TRIM_W).toFixed(4)}in; height: 100%; background: var(--sky); position: relative; overflow: hidden; }

  .spine .txt { transform: rotate(90deg); white-space: nowrap; font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: bold; font-size: ${Math.min(11, spine * 44)}pt; letter-spacing: 0.14em; text-transform: uppercase; }

  /* front */
  .front svg.scene { position: absolute; inset: 0; width: 100%; height: 100%; }
  .front .mast {
    position: absolute; top: ${BLEED + 0.42}in; left: 0; right: 0; text-align: center;
    font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: normal; font-size: 33pt; line-height: 1;
    letter-spacing: 0.02em; text-transform: uppercase; color: ${mastInk};
  }
  .front .issue-line {
    position: absolute; top: ${BLEED + 0.96}in; left: 0; right: 0; text-align: center;
    font-family: 'Courier Prime', monospace; font-size: 8pt; letter-spacing: 0.34em; text-transform: uppercase; color: ${mastInk}; opacity: 0.75;
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
    <div class="tc">tree${(treesTotal ?? treesPlanted) === 1 ? "" : "s"} planted in your name</div>
    <div class="tp">And more to come</div>
  </div>
  <div class="foot">
    <div class="url">deadtreedigest.com</div>
  </div>
</div>

<div class="spine">${spineText ? `<div class="txt">Dead Tree Digest · Issue № ${number}${dateLabel ? ` · ${dateLabel}` : ""}</div>` : ""}</div>

<div class="front">
  ${scene}
  <div class="mast">Dead Tree Digest</div>
  ${dateLabel ? `<div class="issue-line">${dateLabel}</div>` : ""}
</div>

</body>
</html>`;
}
