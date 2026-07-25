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

// The shared foreground motif: the winding trail, the hero stump BESIDE it
// (never in it), and ten saplings hand-scattered across the meadow — some
// clustered, some loners, both sides of the trail — so the grove reads as
// planted by wind, not by grid. One stump, ten saplings: the brand. Shared
// by every scene so the series reads as one place. trailDy nudges the
// trailhead down for scenes whose foreground crest sits lower (lakefront).
const sapling = (x, y, s, dark, lit) =>
  `<g transform="translate(${x},${y}) scale(${s})"><polygon points="8,0 15,17 1,17" fill="${dark}"/>${lit ? `<polygon points="8,0 15,17 8,17" fill="${lit}"/>` : ""}<rect x="6.8" y="17" width="2.6" height="6" fill="#5b3a25"/></g>`;

function trailAndMotif(p, trailDy = 0) {
  return `<!-- the trail, winding down past the stump -->
    <path d="M310 576 Q 262 592 224 606 Q 186 622 178 652 Q 172 674 184 700 L 252 700 Q 240 670 252 648 Q 268 622 304 606 Q 338 592 350 580 Z" fill="${p.path}" opacity="0.9"${trailDy ? ` transform="translate(0,${trailDy})"` : ""}/>

    <!-- hero stump, lower left, beside the trail -->
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

    <!-- ten saplings scattered across the meadow, far to near (brand motif —
         constant greens in every season) -->
    <g>
      ${sapling(176, 576, 0.55, "#4d8d6b")}
      ${sapling(358, 584, 0.5, "#579573")}
      ${sapling(218, 580, 0.66, "#3b7a5c")}
      ${sapling(385, 608, 0.62, "#448463")}
      ${sapling(36, 598, 0.78, "#337054")}
      ${sapling(68, 588, 0.8, "#337054")}
      ${sapling(58, 630, 1.05, "#2f6a4e", "#397a5a")}
      ${sapling(338, 620, 1.15, "#2f6a4e", "#397a5a")}
      ${sapling(24, 664, 1.3, "#2b6248", "#357254")}
      ${sapling(296, 648, 1.5, "#2b6248", "#357254")}
    </g>`;
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

    <!-- L4: valley floor -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>

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

    ${trailAndMotif(p)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Lakefront: big water, a breakwater beacon, the sun/moon glitter path on
// the surface. Same series grammar as every locale — light source upper
// right, stump lower left, hero pine right, saplings scattered across the
// foreground — so the shelf reads as one collection.
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

    ${trailAndMotif(p, 8)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Prairie: a lone burr oak on a grass swell under the biggest sky in the
// series — the horizon drops low and the clouds do the landscaping. Same
// grammar as every locale: light upper right, stump lower left, hero pine
// right, saplings scattered across the field. Garnish: the oak stands bare in
// fall; in winter it keeps a marcescent brown canopy (burr oaks really do
// hold their dead leaves until spring).
function prairieScene(p, seasonKey) {
  const bare = seasonKey === "fall";
  const trunk = `<path d="M158 514 L164 448 L180 448 L188 514 Z" fill="#4a3524"/>
    <path d="M173 514 L173 448 L180 448 L188 514 Z" fill="#5e442c"/>`;
  const oak = bare
    ? `<!-- the burr oak, bare for fall: crooked skeleton against the harvest sky -->
    <g stroke="#4a3524" fill="none" stroke-linecap="round">
      <path d="M172 462 L148 424 Q 128 406 116 386" stroke-width="7"/>
      <path d="M148 424 L136 396" stroke-width="4"/>
      <path d="M116 386 L102 372 M116 386 L122 364" stroke-width="2.5"/>
      <path d="M136 396 L126 380 M136 396 L144 374" stroke-width="2.5"/>
      <path d="M172 456 L176 408 Q 174 388 164 368" stroke-width="7"/>
      <path d="M176 412 L194 382" stroke-width="4"/>
      <path d="M164 368 L152 352 M164 368 L172 346" stroke-width="2.5"/>
      <path d="M194 382 L188 360 M194 382 L206 366" stroke-width="2.5"/>
      <path d="M176 460 L206 428 Q 228 412 242 392" stroke-width="6"/>
      <path d="M206 428 L218 400" stroke-width="4"/>
      <path d="M242 392 L254 378 M242 392 L236 370" stroke-width="2.5"/>
      <path d="M218 400 L228 382 M218 400 L208 378" stroke-width="2.5"/>
    </g>
    ${trunk}`
    : `<!-- the burr oak in leaf, low-poly clumps lit from the upper right -->
    ${trunk}
    <g stroke="#4a3524" stroke-linecap="round" fill="none">
      <path d="M170 458 L146 426" stroke-width="6"/>
      <path d="M176 456 L204 426" stroke-width="5"/>
    </g>
    <g>
      <polygon points="150,384 202,384 206,416 152,418" fill="${p.canopy1}"/>
      <polygon points="96,414 106,360 158,342 174,396 140,426" fill="${p.canopy1}"/>
      <polygon points="158,342 174,396 140,426" fill="${p.canopy0}"/>
      <polygon points="130,364 176,318 226,348 214,400 146,396" fill="${p.canopy1}"/>
      <polygon points="176,318 226,348 214,400 178,398" fill="${p.canopy0}"/>
      <polygon points="178,412 192,352 248,358 258,402 216,428" fill="${p.canopy1}"/>
      <polygon points="206,356 248,358 258,402 216,428" fill="${p.canopy0}"/>
    </g>`;
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
    ${p.night ? "" : `<!-- big-sky clouds, flat WPA stacks, kept clear of the sun -->
    <g fill="${p.sky0}" opacity="0.9">
      <path d="M48 250 q8 -20 30 -20 q8 -14 28 -12 q20 -2 28 12 q18 0 16 20 Z"/>
      <path d="M138 302 q6 -16 24 -16 q8 -10 22 -8 q16 0 20 12 q12 0 10 12 Z"/>
    </g>`}

    <!-- far rise + windbreak row, hugging a LOW horizon (the big sky) -->
    <path d="M0 452 L90 442 L200 450 L320 440 L460 448 L460 486 L0 486 Z" fill="${p.far}"/>
    <path d="M90 442 L200 450 L140 450 Z" fill="${p.farLit}" opacity="0.9"/>
    <g fill="${p.band}" opacity="0.75">
      <path d="M10 447 q7 -14 14 0 Z M27 445 q5 -10 10 0 Z M40 446 q6 -13 12 0 Z M70 446 q5 -9 10 0 Z M83 444 q7 -15 14 0 Z M118 447 q5 -10 10 0 Z"/>
    </g>

    <!-- mid swell -->
    <path d="M0 486 Q 150 464 300 482 Q 400 492 460 484 L460 544 L0 544 Z" fill="${p.mid}"/>
    <path d="M0 486 Q 150 464 300 482 L300 490 Q 150 474 0 494 Z" fill="${p.midLit}" opacity="0.8"/>

    <!-- near swell — the oak's rise -->
    <path d="M0 528 Q 120 504 240 516 Q 360 528 460 518 L460 604 L0 604 Z" fill="${p.near}"/>
    <path d="M0 528 Q 120 504 240 516 L240 524 Q 120 514 0 538 Z" fill="${p.nearLit}" opacity="0.8"/>
    <g stroke="${p.nearShade}" stroke-width="2" stroke-linecap="round" opacity="0.7">
      <path d="M52 542 l4 -10 M60 544 l0 -11 M252 534 l4 -10 M260 536 l0 -11 M356 540 l4 -9 M364 542 l0 -10"/>
    </g>

    ${oak}

    <!-- foreground field with the winding path (series constants) -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>
    <!-- tall-grass seed heads along the field crest -->
    <g stroke="${p.band}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85">
      <path d="M24 584 l-3 -12 M30 584 l0 -14 M36 584 l3 -11"/>
      <path d="M96 576 l-3 -11 M102 576 l0 -13 M108 576 l3 -10"/>
      <path d="M248 596 l-3 -11 M254 596 l0 -13 M260 596 l3 -10"/>
      <path d="M390 668 l-4 -14 M398 668 l0 -16 M406 668 l4 -13"/>
    </g>

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

    ${trailAndMotif(p)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Boreal: two ragged walls of spruce under low glacial hills — the forest
// is the landscape. Same grammar as every locale. Garnish: the aurora, and
// ONLY when a winter close lands at night — the rarest cover in the roster,
// on purpose.
function borealScene(p, seasonKey) {
  // Irregular spruce silhouettes: [halfWidth, height] pairs, hand-varied so
  // no two spires repeat in rhythm.
  const wall = (base, drop, pairs, fill) => {
    let x = 0, d = `M0 ${base}`;
    for (const [w, h] of pairs) { d += ` L${x + w} ${base - h} L${x + 2 * w} ${base}`; x += 2 * w; }
    d += ` L460 ${base} L460 ${base + drop} L0 ${base + drop} Z`;
    return `<path d="${d}" fill="${fill}"/>`;
  };
  // The back wall fades out toward its spire tips (gradient fill below) so
  // distance reads as haze, not a hard sawtooth against the sky.
  const backWall = wall(512, 62, [[11,58],[9,26],[13,74],[10,38],[12,60],[8,20],[14,84],[10,44],[12,66],[9,30],[13,78],[10,40],[11,54],[8,24],[14,88],[10,48],[12,62],[9,34],[13,72],[10,42],[12,58]], "url(#wallfade)");
  const frontWall = wall(560, 44, [[9,42],[7,18],[11,56],[8,28],[10,48],[6,14],[12,66],[9,36],[11,52],[7,22],[10,44],[8,30],[12,62],[9,38],[10,50],[7,20],[11,58],[8,26],[10,46],[9,34],[12,60],[8,24],[11,54],[15,40]], p.band);
  const aurora = p.night && seasonKey === "winter" ? `<!-- the aurora — winter night only, the rarest cover in the roster -->
    <g filter="url(#soften)" stroke-linecap="round" fill="none">
      <path d="M-20 320 Q 90 240 190 262 Q 290 284 352 208 Q 400 148 480 132" stroke="#6fd8a8" stroke-width="30" opacity="0.28"/>
      <path d="M-20 282 Q 100 216 200 234 Q 300 252 368 182 Q 412 136 480 108" stroke="#9fe8c8" stroke-width="12" opacity="0.3"/>
      <path d="M-20 352 Q 110 286 216 300 Q 320 316 480 212" stroke="#8f9fd8" stroke-width="18" opacity="0.18"/>
    </g>` : "";
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
      <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
      <linearGradient id="wallfade" gradientUnits="userSpaceOnUse" x1="0" y1="424" x2="0" y2="512">
        <stop offset="0" stop-color="${p.mid}" stop-opacity="0.35"/>
        <stop offset="1" stop-color="${p.mid}" stop-opacity="1"/>
      </linearGradient>
    </defs>

    <!-- sky -->
    <rect width="460" height="700" fill="url(#sky)"/>
    ${aurora}
${skyActors(p)}

    <!-- low glacial hills, worn round -->
    <path d="M0 420 Q 90 386 190 408 Q 290 428 370 400 Q 420 388 460 398 L460 480 L0 480 Z" fill="${p.far}"/>
    <path d="M0 420 Q 90 386 190 408 L190 416 Q 90 396 0 428 Z" fill="${p.farLit}" opacity="0.8"/>

    <!-- the spruce walls, back then front, with a breath of mist between -->
    ${backWall}
    <rect y="498" width="460" height="24" fill="${p.sky1}" opacity="0.22"/>
    ${frontWall}

    <!-- clearing floor -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>

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

    ${trailAndMotif(p)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Swamp: bald cypress standing in still water, Spanish moss, lily pads.
// The canopy tokens do the seasonal work for free — bald cypress really
// does turn rust in fall. Garnish: fireflies, and ONLY on a summer night
// close. Moss hangs in farLit so it goes hazy-light by day, muted by night.
function swampScene(p, seasonKey) {
  const fireflies = p.night && seasonKey === "summer" ? `<!-- fireflies — summer night only -->
    <g fill="#ffe27a">
      ${[[70, 520], [150, 560], [210, 500], [250, 590], [310, 545], [180, 620], [340, 610], [120, 640], [390, 570]]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" opacity="0.18"/><circle cx="${x}" cy="${y}" r="1.8" opacity="0.95"/>`).join("")}
    </g>` : "";
  const cypress = (tx, s) => `<g transform="translate(${tx},0) scale(${s})" transform-origin="110 540">
      <!-- branches, then the flat-topped canopy over them -->
      <g stroke="#4a3524" stroke-linecap="round" fill="none">
        <path d="M106 442 L74 420" stroke-width="5"/>
        <path d="M114 438 L148 416" stroke-width="4.5"/>
        <path d="M108 430 L110 404" stroke-width="5"/>
      </g>
      <polygon points="54,424 70,388 118,378 128,414 96,432" fill="${p.canopy1}"/>
      <polygon points="118,378 128,414 96,432" fill="${p.canopy0}"/>
      <polygon points="88,392 128,364 172,382 160,418 116,414" fill="${p.canopy1}"/>
      <polygon points="128,364 172,382 160,418 130,414" fill="${p.canopy0}"/>
      <!-- spanish moss, hanging in the haze color -->
      <g stroke="${p.farLit}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85">
        <path d="M84 420 q3 14 -1 26"/>
        <path d="M122 414 q3 12 0 24"/>
        <path d="M150 420 q3 14 -2 24"/>
        <path d="M64 424 q2 10 -1 18"/>
      </g>
      <!-- flared buttress trunk, standing in the water -->
      <path d="M103 404 C101 460 98 500 88 540 L112 540 Q108 470 111 404 Z" fill="#4a3524"/>
      <path d="M111 404 C112 470 112 500 124 540 L112 540 Q108 470 111 404 Z" fill="#5e442c"/>
      <path d="M80 542 Q96 522 100 504 L114 504 Q120 524 134 542 Q108 550 80 542 Z" fill="#4a3524"/>
      <!-- cypress knees -->
      <path d="M64 544 l4 -9 4 9 Z M140 546 l4 -8 4 8 Z" fill="#5e442c"/>
      <!-- still-water reflection -->
      <g stroke="#3a3128" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.22">
        <path d="M102 550 q4 8 -2 16"/>
        <path d="M104 570 q3 6 -1 12" stroke-width="4"/>
      </g>
    </g>`;
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

    <!-- far swamp-forest canopy, rounded bumps emerging from the water -->
    <path d="M0 436 q18 -26 36 0 q6 -18 24 -12 q14 -22 30 -4 q10 -16 26 -8 q16 -20 32 -2 q8 -14 22 -8 q18 -22 34 -2 q10 -16 26 -6 q16 -18 32 0 q8 -12 22 -8 q18 -20 34 -2 q12 -14 26 -6 q16 -16 32 0 q10 -12 24 -6 q14 -14 30 0 L460 436 L460 466 L0 466 Z" fill="${p.far}"/>

    <!-- still water -->
    <rect x="0" y="448" width="460" height="126" fill="${p.water0}"/>
    <path d="M0 520 Q 140 512 260 520 Q 380 528 460 518 L460 574 L0 574 Z" fill="${p.water1}"/>
    ${cypress(0, 1)}
    ${cypress(178, 0.62)}

    <!-- lily pads near the bank -->
    <g fill="${p.tree0l}" opacity="0.85">
      <ellipse cx="206" cy="562" rx="11" ry="3.4"/>
      <ellipse cx="238" cy="568" rx="8" ry="2.8"/>
      <ellipse cx="178" cy="570" rx="9" ry="3"/>
      <ellipse cx="330" cy="566" rx="10" ry="3.2"/>
    </g>
    <circle cx="238" cy="565" r="2.2" fill="#e8dcc0" opacity="0.9"/>

    <!-- the bank -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>
    <!-- reeds at the waterline -->
    <g stroke="${p.band}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.85">
      <path d="M40 580 l-2 -16 M46 580 l1 -19 M52 580 l3 -14"/>
      <path d="M282 584 l-2 -15 M288 584 l1 -18 M294 584 l3 -13"/>
      <path d="M400 660 l-3 -17 M408 660 l0 -20 M416 660 l3 -15"/>
    </g>

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

    ${trailAndMotif(p)}
    ${fireflies}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Cityscape: the reader's park in the middle of a city — two skyline layers
// behind a rounded park treeline, a lamppost by the trail. At night the
// office windows stay lit (deterministic, like everything else) and the
// lamp comes on. No seasonal garnish; the palette does the work.
function cityscapeScene(p) {
  const bldg = (x, w, h, base, fill) => `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${fill}"/>`;
  const farBase = 460, bandBase = 478;
  const farRow = [[0, 38, 66], [44, 26, 90], [76, 30, 54], [112, 22, 110], [140, 34, 70], [180, 26, 96], [212, 30, 60], [248, 24, 120], [278, 32, 76], [316, 26, 58], [348, 30, 88], [384, 24, 64], [414, 46, 72]]
    .map(([x, w, h]) => bldg(x, w, h, farBase, p.far)).join("");
  const bandRow = [[12, 30, 58], [52, 24, 84], [84, 34, 48], [126, 20, 100], [154, 28, 64], [190, 24, 44], [222, 32, 78], [262, 22, 54], [292, 30, 92], [330, 24, 48], [360, 28, 68], [396, 22, 40], [424, 36, 58]]
    .map(([x, w, h]) => bldg(x, w, h, bandBase, p.band)).join("");
  // Windows always: office-light amber at night, a lighter shade of the
  // silhouette by day so the towers read as buildings, not slabs.
  const windows = `<g fill="${p.night ? p.sun : p.near}" opacity="${p.night ? 0.7 : 0.9}">
      ${[[58, 404], [66, 418], [58, 432], [298, 398], [306, 412], [298, 426], [306, 440], [131, 390], [131, 408], [366, 420], [374, 434], [230, 410], [240, 424], [18, 430], [26, 444], [160, 424], [168, 438], [430, 430], [438, 444], [90, 440], [98, 452]]
        .map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="6"/>`).join("")}
    </g>`;
  const lamp = `<g>
      <rect x="188" y="544" width="4" height="62" fill="#2b2419"/>
      <path d="M182 606 h16 l-2 6 h-12 Z" fill="#2b2419"/>
      <path d="M184 544 h12 l-2 -10 h-8 Z" fill="#2b2419"/>
      ${p.night ? `<circle cx="190" cy="538" r="10" fill="${p.sun}" opacity="0.25"/><circle cx="190" cy="538" r="4.5" fill="${p.sun}"/>` : `<circle cx="190" cy="538" r="4.5" fill="#e8dcc0" opacity="0.85"/>`}
    </g>`;
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

    <!-- skylines: hazy distance, then the near silhouette with its furniture -->
    ${farRow}
    ${bandRow}
    <!-- antenna on the tallest, water tower on the mid-block -->
    <line x1="136" y1="378" x2="136" y2="356" stroke="${p.band}" stroke-width="2.5"/>
    <circle cx="136" cy="354" r="2.5" fill="${p.band}"/>
    <g fill="${p.band}">
      <path d="M228 400 l2 -12 h16 l2 12 Z"/>
      <ellipse cx="237" cy="388" rx="10" ry="4"/>
      <path d="M230 400 l-2 8 M244 400 l2 8" stroke="${p.band}" stroke-width="2"/>
    </g>
    ${windows}

    <!-- the park treeline, rounded and unbothered by the towers -->
    <path d="M0 546 q20 -22 40 0 q16 -18 36 -2 q18 -20 38 0 q14 -14 32 -4 q18 -18 38 0 q16 -16 36 -2 q18 -18 38 0 q14 -12 32 -4 q16 -16 36 0 q18 -18 40 0 q16 -14 34 -2 q20 -18 40 0 L460 546 L460 582 L0 582 Z" fill="${p.near}"/>
    <path d="M0 546 q20 -22 40 0 q16 -18 36 -2 q18 -20 38 0 L114 552 L0 552 Z" fill="${p.nearLit}" opacity="0.5"/>

    <!-- the lawn -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>

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

    ${lamp}
    ${trailAndMotif(p)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

// Southwest canyon: a window arch on the left, a family of hoodoos on the
// right, strata lines in the rock. The opening in the arch shows hazy
// distance, not sky, so the desert reads deep. Garnish: a snowline dusts
// the arch and hoodoo caps in winter (day and night — desert snow lingers).
function canyonScene(p, seasonKey) {
  const snow = seasonKey === "winter" ? `<!-- the snowline — winter closes only -->
    <g fill="${p.ground0}" opacity="0.95">
      <path d="M34 470 Q 40 428 92 420 Q 150 414 196 438 L 190 448 Q 148 426 96 431 Q 48 439 44 472 Z"/>
      <path d="M246 464 L250 452 L272 452 L276 464 L268 468 L254 468 Z"/>
      <path d="M288 488 L294 478 L324 478 L330 488 L320 492 L298 492 Z"/>
      <path d="M342 454 L346 440 L362 440 L366 454 L360 458 L348 458 Z"/>
    </g>` : "";
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

    <!-- far mesas, flat-topped, haze-lit rims -->
    <path d="M0 388 L60 388 L74 402 L150 402 L164 388 L250 388 L262 404 L330 404 L344 390 L460 390 L460 452 L0 452 Z" fill="${p.far}"/>
    <g fill="${p.farLit}">
      <rect x="0" y="388" width="60" height="5"/>
      <rect x="74" y="402" width="76" height="5"/>
      <rect x="164" y="388" width="86" height="5"/>
      <rect x="262" y="404" width="68" height="5"/>
      <rect x="344" y="390" width="116" height="5"/>
    </g>

    <!-- canyon wall with strata -->
    <path d="M0 430 L40 430 L52 444 L96 444 L108 428 L150 428 L160 446 L210 446 L222 430 L270 430 L280 448 L326 448 L338 432 L390 432 L400 450 L460 450 L460 540 L0 540 Z" fill="${p.mid}"/>
    <g stroke="${p.midShade}" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
      <path d="M14 468 h52 M110 462 h64 M226 470 h58 M338 466 h70"/>
      <path d="M40 496 h70 M160 502 h54 M262 494 h66 M382 500 h50"/>
    </g>

    <!-- the window arch -->
    <path d="M30 570 L34 470 Q 40 428 92 420 Q 150 414 196 438 Q 212 448 210 570 Z" fill="${p.near}"/>
    <path d="M196 438 Q 212 448 210 570 L 196 570 Q 198 452 186 444 Z" fill="${p.nearLit}" opacity="0.9"/>
    <!-- the window: the canyon wall and desert floor show THROUGH the arch -->
    <path d="M78 570 L80 500 Q 84 466 116 462 Q 150 460 162 486 Q 168 500 166 570 Z" fill="${p.mid}"/>
    <g stroke="${p.midShade}" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
      <path d="M96 486 h52 M92 516 h60"/>
    </g>
    <path d="M80 546 Q 122 538 166 544 L 166 570 L 80 570 Z" fill="${p.ground0}"/>
    <g stroke="${p.nearShade}" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
      <path d="M40 520 h30 M176 516 h26"/>
    </g>

    <!-- the hoodoo family -->
    <path d="M250 566 L254 470 L246 464 L250 452 L272 452 L276 464 L268 470 L272 566 Z" fill="${p.near}"/>
    <path d="M261 566 L261 452 L272 452 L276 464 L268 470 L272 566 Z" fill="${p.nearLit}" opacity="0.85"/>
    <path d="M296 566 L298 494 L288 488 L294 478 L324 478 L330 488 L320 494 L324 566 Z" fill="${p.near}"/>
    <path d="M310 566 L310 478 L324 478 L330 488 L320 494 L324 566 Z" fill="${p.nearLit}" opacity="0.85"/>
    <path d="M346 566 L348 460 L342 454 L346 440 L362 440 L366 454 L360 460 L362 566 Z" fill="${p.near}"/>
    <path d="M354 566 L354 440 L362 440 L366 454 L360 460 L362 566 Z" fill="${p.nearLit}" opacity="0.85"/>
    <g stroke="${p.nearShade}" stroke-width="2" stroke-linecap="round" opacity="0.6">
      <path d="M252 510 h18 M298 520 h24 M348 508 h13"/>
    </g>
    ${snow}

    <!-- desert floor -->
    <path d="M0 574 Q 120 552 250 572 Q 370 590 460 570 L460 700 L0 700 Z" fill="${p.ground0}"/>
    <path d="M0 636 Q 150 610 320 634 Q 410 646 460 636 L460 700 L0 700 Z" fill="${p.ground1}"/>
    <!-- fallen rocks by the trail -->
    <g fill="${p.nearShade}" opacity="0.9">
      <path d="M236 668 l8 -10 12 2 6 8 -4 6 -18 0 Z"/>
      <path d="M352 636 l6 -8 10 2 4 6 -3 5 -14 0 Z"/>
    </g>

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

    ${trailAndMotif(p)}

    <!-- film grain -->
    <rect width="460" height="700" filter="url(#grain)"/>
  </svg>`;
}

export const SCENES = { mountain: mountainScene, lakefront: lakefrontScene, prairie: prairieScene, boreal: borealScene, swamp: swampScene, cityscape: cityscapeScene, canyon: canyonScene };
export const LOCALE_ROSTER = ["mountain", "lakefront", "prairie", "boreal", "swamp", "cityscape", "canyon"]; // issue #12's full roster

export function coverHtml({ number, dateLabel = "", pageCount, articleCount, treesPlanted = 1, treesTotal = null, season = null, time = "day", locale = "mountain" }) {
  const seasonKey = PALETTES[season] ? season : "summer";
  const palette = PALETTES[seasonKey][time] ?? PALETTES.summer.day;
  const scene = (SCENES[locale] ?? mountainScene)(palette, seasonKey);
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
