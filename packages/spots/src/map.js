// The field-notes map: hand-drawn sketch styling (thick ink card, offset
// shadow, dot-grid paper, a lollipop pin, coherent low-frequency wobble)
// drawn straight from OSM vector geometry. When a home point and route are
// provided the frame contains the whole journey — house doodle to pin, with
// a dashed rust route and labeled streets, so the page is walkable without
// research. Grayscale-safe (the printed interior is B&W). © OpenStreetMap
// contributors small print is required by ODbL — never remove it.

const INK = "#2b2419";
const PAPER = "#faf5ea";
const GREEN = "rgba(31,77,56,0.13)";
const WATER = "rgba(43,74,105,0.18)";
const RUST = "#bf4e24";

const WIDTHS = { major: 2.6, mid: 1.8, minor: 1.1, path: 0.7 };

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Deterministic wobble: same map in, same sketch out (rerenders must not
// shift the linework). LOW-frequency and coherent — neighboring points drift
// together, so long streets take slow gentle bends like a steady hand
// copying a map, instead of per-vertex scribble.
const wob = (x, y, salt) =>
  (Math.sin((x + salt * 31.7) / 55) + Math.sin((y - salt * 17.3) / 63)) / 2;

// The square window the map shows: spot-centered by default, or sized to
// contain home + route + spot with breathing room. Compute this FIRST and
// feed it to both mapLayers (what to fetch) and renderSpotMap (how to draw).
export function computeFrame({ spot, home = null, route = null }) {
  if (!home) return { lat: spot.lat, lng: spot.lng, spanMeters: 900 };
  const pts = [[spot.lat, spot.lng], [home.lat, home.lng], ...(route?.geometry ?? [])];
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const latMid = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lngMid = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const spanLat = (Math.max(...lats) - Math.min(...lats)) * 111_320;
  const spanLng =
    (Math.max(...lngs) - Math.min(...lngs)) * 111_320 * Math.cos((latMid * Math.PI) / 180);
  const spanMeters = Math.max(600, Math.max(spanLat, spanLng) * 1.3 + 120);
  return { lat: latMid, lng: lngMid, spanMeters };
}

export function renderSpotMap({ spot, layers, frame = null, home = null, route = null, label = null, size = 320 }) {
  const f = frame ?? computeFrame({ spot, home, route });
  const lat0 = f.lat;
  const lng0 = f.lng;
  const spanMeters = f.spanMeters;
  const metersPerPx = spanMeters / size;
  const kx = (111_320 * Math.cos((lat0 * Math.PI) / 180)) / metersPerPx;
  const ky = 111_320 / metersPerPx;
  const pxRaw = ([lat, lng]) => [size / 2 + (lng - lng0) * kx, size / 2 - (lat - lat0) * ky];
  const px = (pt, salt = 0) => {
    const [x, y] = pxRaw(pt);
    return [(x + wob(x, y, salt) * 1.4).toFixed(1), (y + wob(y, x, salt + 1) * 1.4).toFixed(1)];
  };
  const path = (pts, salt = 0) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + px(p, salt).join(",")).join("");

  const green = (layers.green ?? [])
    .filter((g) => g.closed)
    .map((g, i) => `<path d="${path(g.pts, i)}Z" fill="${GREEN}" stroke="none"/>`)
    .join("");
  const water = (layers.water ?? [])
    .map((w, i) =>
      w.closed
        ? `<path d="${path(w.pts, 40 + i)}Z" fill="${WATER}" stroke="none"/>`
        : `<path d="${path(w.pts, 40 + i)}" fill="none" stroke="${WATER}" stroke-width="3.5"/>`
    )
    .join("");
  const streets = (layers.streets ?? [])
    .map(
      (s, i) =>
        `<path d="${path(s.pts, 80 + i)}" fill="none" stroke="${INK}" stroke-width="${WIDTHS[s.cls]}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.cls === "path" ? 0.5 : 0.85}"${s.cls === "path" ? ' stroke-dasharray="3,4"' : ""}/>`
    )
    .join("");

  // Street name labels: the biggest named streets in frame, set along their
  // own line with a paper halo — the difference between "a grid" and "oh,
  // that's Fullerton".
  const inFrame = ([lat, lng]) => {
    const [x, y] = pxRaw([lat, lng]);
    return x > 10 && x < size - 10 && y > 10 && y < size - 10;
  };
  const namedStreets = [];
  const seenNames = new Set();
  const byLength = [...(layers.streets ?? [])]
    .filter((s) => s.name && s.cls !== "path" && s.pts.length >= 2)
    .sort((a, b) => b.pts.length - a.pts.length);
  for (const s of byLength) {
    if (seenNames.has(s.name) || namedStreets.length >= 4) continue;
    const mid = Math.floor(s.pts.length / 2);
    const a = s.pts[Math.max(0, mid - 1)];
    const b = s.pts[Math.min(s.pts.length - 1, mid + 1)];
    if (!inFrame(s.pts[mid])) continue;
    const [ax, ay] = pxRaw(a);
    const [bx, by] = pxRaw(b);
    let angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    const [mx, my] = pxRaw(s.pts[mid]);
    seenNames.add(s.name);
    namedStreets.push(
      `<text x="0" y="-3" transform="translate(${mx.toFixed(0)},${my.toFixed(0)}) rotate(${angle.toFixed(0)})" font-family="Courier, monospace" font-size="8" letter-spacing="0.5" fill="${INK}" opacity="0.85" text-anchor="middle" stroke="${PAPER}" stroke-width="2.5" paint-order="stroke">${esc(s.name)}</text>`
    );
  }

  // The journey: dashed rust route from the house doodle to the pin.
  const routeLine = route?.geometry?.length
    ? `<path d="${path(route.geometry, 5)}" fill="none" stroke="${RUST}" stroke-width="2.2" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.9"/>`
    : "";
  let homeGlyph = "";
  if (home) {
    const [hx, hy] = pxRaw([home.lat, home.lng]);
    homeGlyph = `
    <g transform="translate(${hx.toFixed(0)},${hy.toFixed(0)})" stroke="${INK}" stroke-width="2" stroke-linejoin="round">
      <rect x="-6" y="-4" width="12" height="9" fill="${PAPER}"/>
      <path d="M-8,-4 L0,-11 L8,-4" fill="${PAPER}"/>
      <rect x="-1.8" y="0" width="3.6" height="5" fill="${INK}" stroke="none"/>
    </g>`;
  }

  // The lollipop pin: stick down to the exact point, circled head above it.
  const [sx, sy] = pxRaw([spot.lat, spot.lng]);
  const pin = `
    <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${sx.toFixed(1)}" y2="${(sy - 22).toFixed(1)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="${sx.toFixed(1)}" cy="${(sy - 30).toFixed(1)}" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="2.6"/>
    <circle cx="${sx.toFixed(1)}" cy="${(sy - 30).toFixed(1)}" r="3.2" fill="${RUST}"/>
    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.4" fill="${INK}"/>`;

  // Compass doodle, top right, on a paper chip.
  const compass = `
    <g transform="translate(${size - 30}, 30)" stroke="${INK}" fill="none" stroke-width="1.6" stroke-linecap="round">
      <circle cx="0" cy="-2" r="20" fill="${PAPER}" opacity="0.9" stroke="none"/>
      <line x1="0" y1="12" x2="0" y2="-10"/>
      <path d="M-4.5,-4 L0,-11 L4.5,-4" fill="${PAPER}"/>
      <text x="0" y="-15" font-family="Courier, monospace" font-size="9.5" font-weight="bold" fill="${INK}" stroke="none" text-anchor="middle">N</text>
    </g>`;

  // Identity chip: who this spot is, where to find it, and the exact
  // coordinates — national-park trailhead-sign style, and paste-able into
  // any maps app. Anchored to the pin but kept inside the card.
  const c = size / 2;
  const coords =
    `${Math.abs(spot.lat).toFixed(5)}° ${spot.lat >= 0 ? "N" : "S"}, ` +
    `${Math.abs(spot.lng).toFixed(5)}° ${spot.lng >= 0 ? "E" : "W"}`;
  const lines = [
    ...(label?.title ? [{ t: label.title, size: 10, bold: true }] : []),
    ...(label?.sub ? [{ t: label.sub, size: 9, dim: true }] : []),
    { t: coords, size: 9, dim: true },
  ].map((l) => ({ ...l, t: String(l.t).slice(0, 42) }));
  const wch = Math.max(...lines.map((l) => l.t.length));
  const w = Math.min(wch * 6.1 + 20, size - 24);
  const h = 10 + lines.length * 13;
  const lx = Math.max(10, Math.min(size - w - 10, sx - w / 2));
  const ly = Math.min(size - h - 34, sy + 12);
  const labelChip = `
    <g font-family="Courier, monospace" fill="${INK}">
      <rect x="${lx.toFixed(0)}" y="${ly.toFixed(0)}" width="${w.toFixed(0)}" height="${h}" rx="5" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>
      ${lines
        .map(
          (l, i) =>
            `<text x="${(lx + w / 2).toFixed(0)}" y="${(ly + 15 + i * 13).toFixed(0)}" font-size="${l.size}"${l.bold ? ' font-weight="bold"' : ""}${l.dim ? ' opacity="0.8"' : ""} text-anchor="middle">${esc(l.t)}</text>`
        )
        .join("")}
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
  const S = size + 16;
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
      ${green}${water}${streets}${namedStreets.join("")}${routeLine}${homeGlyph}${pin}${labelChip}${compass}${scale}
    </g>
    <rect x="0" y="0" width="${size}" height="${size}" rx="12" fill="none" stroke="${INK}" stroke-width="3"/>
  </g>
</svg>`;
}
