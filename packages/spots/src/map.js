// The field-notes map: hand-drawn sketch styling (thick ink card, offset
// shadow, dot-grid paper, a lollipop pin, deterministic wobble on the
// linework) drawn straight from OSM vector geometry. Grayscale-safe — the
// printed interior is B&W. © OpenStreetMap contributors small print is
// required by ODbL — never remove it.

const INK = "#2b2419";
const PAPER = "#faf5ea";
const GREEN = "rgba(31,77,56,0.13)";
const WATER = "rgba(43,74,105,0.18)";
const RUST = "#bf4e24";

const WIDTHS = { major: 2.6, mid: 1.8, minor: 1.1, path: 0.7 };

// Deterministic wobble: same map in, same sketch out (rerenders must not
// shift the linework). Amplitude ~1px reads as hand-drawn at print size.
const wob = (x, y, salt) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return (h - Math.floor(h)) * 2 - 1;
};

export function renderSpotMap({ spot, layers, spanMeters = 900, size = 320 }) {
  const lat0 = spot.lat;
  const lng0 = spot.lng;
  const metersPerPx = spanMeters / size;
  const kx = (111_320 * Math.cos((lat0 * Math.PI) / 180)) / metersPerPx;
  const ky = 111_320 / metersPerPx;
  const px = ([lat, lng], salt = 0) => {
    const x = size / 2 + (lng - lng0) * kx;
    const y = size / 2 - (lat - lat0) * ky;
    return [(x + wob(x, y, salt) * 1.1).toFixed(1), (y + wob(y, x, salt + 1) * 1.1).toFixed(1)];
  };
  const path = (pts, salt = 0) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + px(p, salt).join(",")).join("");

  const green = (layers.green ?? [])
    .filter((g) => g.closed)
    .map((g, i) => `<path d="${path(g.pts, i)}Z" fill="${GREEN}" stroke="${INK}" stroke-width="0.7" stroke-dasharray="4,3" opacity="0.9"/>`)
    .join("");
  const water = (layers.water ?? [])
    .map((w, i) =>
      w.closed
        ? `<path d="${path(w.pts, 40 + i)}Z" fill="${WATER}" stroke="${INK}" stroke-width="0.7"/>`
        : `<path d="${path(w.pts, 40 + i)}" fill="none" stroke="${WATER}" stroke-width="3.5"/>`
    )
    .join("");
  const streets = (layers.streets ?? [])
    .map(
      (s, i) =>
        `<path d="${path(s.pts, 80 + i)}" fill="none" stroke="${INK}" stroke-width="${WIDTHS[s.cls]}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.cls === "path" ? 0.5 : 0.85}"${s.cls === "path" ? ' stroke-dasharray="3,4"' : ""}/>`
    )
    .join("");

  // The lollipop pin: stick down to the exact point, circled head above it.
  const c = size / 2;
  const pin = `
    <line x1="${c}" y1="${c}" x2="${c}" y2="${c - 22}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="${c}" cy="${c - 30}" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="${c}" cy="${c - 30}" r="3.2" fill="${RUST}"/>
    <circle cx="${c}" cy="${c}" r="2.4" fill="${INK}"/>`;

  // Compass doodle, top right.
  const compass = `
    <g transform="translate(${size - 30}, 30)" stroke="${INK}" fill="none" stroke-width="1.6" stroke-linecap="round">
      <circle cx="0" cy="-2" r="20" fill="${PAPER}" opacity="0.9" stroke="none"/>
      <line x1="0" y1="12" x2="0" y2="-10"/>
      <path d="M-4.5,-4 L0,-11 L4.5,-4" fill="${PAPER}"/>
      <text x="0" y="-15" font-family="Courier, monospace" font-size="9.5" font-weight="bold" fill="${INK}" stroke="none" text-anchor="middle">N</text>
    </g>`;

  const scaleMeters = Math.round(spanMeters / 4 / 50) * 50 || 100;
  const scalePx = (scaleMeters / spanMeters) * size;
  const scale = `
  <g font-family="Courier, monospace" fill="${INK}">
    <rect x="8" y="${size - 28}" width="${(scalePx + 52).toFixed(0)}" height="20" rx="4" fill="${PAPER}" opacity="0.9"/>
    <line x1="14" y1="${size - 16}" x2="${(14 + scalePx).toFixed(0)}" y2="${size - 16}" stroke="${INK}" stroke-width="1.6"/>
    <line x1="14" y1="${size - 21}" x2="14" y2="${size - 11}" stroke="${INK}" stroke-width="1.6"/>
    <line x1="${(14 + scalePx).toFixed(0)}" y1="${size - 21}" x2="${(14 + scalePx).toFixed(0)}" y2="${size - 11}" stroke="${INK}" stroke-width="1.6"/>
    <text x="${(18 + scalePx).toFixed(0)}" y="${size - 12}" font-size="9">${scaleMeters} m</text>
    <rect x="${size - 132}" y="${size - 17}" width="126" height="12" fill="${PAPER}" opacity="0.9"/>
    <text x="${size - 10}" y="${size - 9}" font-size="7" text-anchor="end" opacity="0.7">© OpenStreetMap contributors</text>
  </g>`;

  // Card chrome: offset solid shadow behind a rounded thick-ink frame, the
  // map clipped inside, dot-grid paper underneath the geometry.
  const S = size + 16; // viewBox with room for the shadow
  const dots = [];
  for (let dy = 14; dy < size; dy += 22) {
    for (let dx = 14; dx < size; dx += 22) {
      dots.push(`<circle cx="${dx}" cy="${dy}" r="0.9" fill="${INK}" opacity="0.14"/>`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="A small hand-drawn map with a pin marking the spot">
  <defs><clipPath id="card"><rect x="0" y="0" width="${size}" height="${size}" rx="12"/></clipPath></defs>
  <rect x="10" y="10" width="${size}" height="${size}" rx="12" fill="${INK}" opacity="0.85"/>
  <g transform="translate(3,3)">
    <rect x="0" y="0" width="${size}" height="${size}" rx="12" fill="${PAPER}"/>
    <g clip-path="url(#card)">
      ${dots.join("")}
      ${green}${water}${streets}${pin}${compass}${scale}
    </g>
    <rect x="0" y="0" width="${size}" height="${size}" rx="12" fill="none" stroke="${INK}" stroke-width="3"/>
  </g>
</svg>`;
}
