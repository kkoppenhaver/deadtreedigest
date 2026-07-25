// The field-guide map: monochrome-friendly SVG drawn straight from OSM
// vector geometry. Thin ink streets, shaded green, water, an X at the spot.
// Grayscale-safe (the printed interior is B&W); the palette is the house
// paper/ink/pine/rust set on the web. © OpenStreetMap contributors small
// print is required by ODbL — never remove it.

const INK = "#2b2419";
const PAPER = "#f7efdd";
const GREEN = "rgba(31,77,56,0.16)";
const WATER = "rgba(43,74,105,0.22)";
const RUST = "#bf4e24";

const WIDTHS = { major: 2.4, mid: 1.6, minor: 1.0, path: 0.55 };

export function renderSpotMap({ spot, layers, spanMeters = 900, size = 320 }) {
  const lat0 = spot.lat;
  const lng0 = spot.lng;
  const metersPerPx = spanMeters / size;
  const kx = (111_320 * Math.cos((lat0 * Math.PI) / 180)) / metersPerPx;
  const ky = 111_320 / metersPerPx;
  const px = ([lat, lng]) => [
    (size / 2 + (lng - lng0) * kx).toFixed(1),
    (size / 2 - (lat - lat0) * ky).toFixed(1),
  ];
  const path = (pts) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + px(p).join(",")).join("") ;

  const green = (layers.green ?? [])
    .filter((g) => g.closed)
    .map((g) => `<path d="${path(g.pts)}Z" fill="${GREEN}" stroke="none"/>`)
    .join("");
  const water = (layers.water ?? [])
    .map((w) =>
      w.closed
        ? `<path d="${path(w.pts)}Z" fill="${WATER}" stroke="none"/>`
        : `<path d="${path(w.pts)}" fill="none" stroke="${WATER}" stroke-width="3"/>`
    )
    .join("");
  const streets = (layers.streets ?? [])
    .map(
      (s) =>
        `<path d="${path(s.pts)}" fill="none" stroke="${INK}" stroke-width="${WIDTHS[s.cls]}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.cls === "path" ? 0.45 : 0.8}"${s.cls === "path" ? ' stroke-dasharray="2.5,2.5"' : ""}/>`
    )
    .join("");

  const c = size / 2;
  const marker = `
    <circle cx="${c}" cy="${c}" r="11" fill="${PAPER}" stroke="${RUST}" stroke-width="2"/>
    <path d="M${c - 4.5},${c - 4.5} L${c + 4.5},${c + 4.5} M${c + 4.5},${c - 4.5} L${c - 4.5},${c + 4.5}" stroke="${RUST}" stroke-width="2.4" stroke-linecap="round"/>`;

  const scaleMeters = Math.round(spanMeters / 4 / 50) * 50 || 100;
  const scalePx = (scaleMeters / spanMeters) * size;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="A small map with an X marking the spot">
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  ${green}${water}${streets}${marker}
  <rect x="6" y="${size - 26}" width="${(scalePx + 50).toFixed(0)}" height="20" fill="${PAPER}" opacity="0.85"/>
  <rect x="${size - 128}" y="${size - 15}" width="124" height="11" fill="${PAPER}" opacity="0.85"/>
  <g font-family="Courier, monospace" fill="${INK}">
    <line x1="12" y1="${size - 14}" x2="${(12 + scalePx).toFixed(0)}" y2="${size - 14}" stroke="${INK}" stroke-width="1.4"/>
    <line x1="12" y1="${size - 18}" x2="12" y2="${size - 10}" stroke="${INK}" stroke-width="1.4"/>
    <line x1="${(12 + scalePx).toFixed(0)}" y1="${size - 18}" x2="${(12 + scalePx).toFixed(0)}" y2="${size - 10}" stroke="${INK}" stroke-width="1.4"/>
    <text x="${(14 + scalePx).toFixed(0)}" y="${size - 11}" font-size="9">${scaleMeters} m</text>
    <text x="${size - 8}" y="${size - 8}" font-size="7" text-anchor="end" opacity="0.65">© OpenStreetMap contributors</text>
  </g>
  <rect width="${size}" height="${size}" fill="none" stroke="${INK}" stroke-width="2"/>
</svg>`;
}
