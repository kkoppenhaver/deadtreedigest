// Overpass API: candidate spots near a point, and the vector geometry the
// map is drawn from. Same politeness rules as geocode.js — identifying UA,
// and callers cache per area so "try another" never re-queries.

// Main instance first, public mirrors as fallback — Overpass 504s under
// load routinely enough that a single-endpoint dependency would flake.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const UA = "DeadTreeDigest/1.0 (press@mail.deadtreedigest.com)";

async function query(q) {
  const errors = [];
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (err) {
      errors.push(`${new URL(endpoint).hostname}: ${err.message}`);
    }
  }
  throw new Error(`overpass exhausted (${errors.join("; ")})`);
}

// What counts as a spot: benches and parks first, plus a curated list of
// overlooked places. Deliberately no cafes — that drifts into "places near
// me" genericism.
const kindOf = (tags = {}) => {
  if (tags.amenity === "bench") return "bench";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.man_made === "lighthouse") return "lighthouse";
  if (tags.man_made === "pier") return "pier";
  if (tags.amenity === "ferry_terminal") return "ferry terminal";
  if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") return "cemetery";
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  return null;
};

export async function findCandidates({ lat, lng, radius = 2000 }) {
  const around = `(around:${radius},${lat},${lng})`;
  const q = `[out:json][timeout:15];
(
  node["amenity"="bench"]${around};
  node["tourism"="viewpoint"]${around};
  node["man_made"="lighthouse"]${around};
  node["man_made"="pier"]${around};
  way["man_made"="pier"]${around};
  node["amenity"="ferry_terminal"]${around};
  way["leisure"="park"]${around};
  way["leisure"="garden"]${around};
  way["landuse"="cemetery"]${around};
  way["amenity"="grave_yard"]${around};
);
out center tags 80;`;

  const data = await query(q);
  const seen = new Set();
  const out = [];
  for (const el of data.elements ?? []) {
    const kind = kindOf(el.tags);
    if (!kind) continue;
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const elat = el.lat ?? el.center?.lat;
    const elng = el.lon ?? el.center?.lon;
    if (elat == null || elng == null) continue;
    out.push({
      osmId: id,
      kind,
      name: el.tags?.name ?? null,
      lat: elat,
      lng: elng,
      backrest: el.tags?.backrest ?? null,
      direction: el.tags?.direction ?? null,
      meters: Math.round(haversine(lat, lng, elat, elng)),
    });
  }
  out.sort((a, b) => a.meters - b.meters);
  return out;
}

// Vector layers for the map: streets, water, green — raw geometry from OSM,
// which is what keeps the print crisp (raster tiles are not).
export async function mapLayers({ lat, lng, spanMeters = 900 }) {
  const dLat = spanMeters / 2 / 111_320;
  const dLng = spanMeters / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `(${lat - dLat},${lng - dLng},${lat + dLat},${lng + dLng})`;
  const q = `[out:json][timeout:15];
(
  way["highway"]${bbox};
  way["natural"="water"]${bbox};
  way["waterway"]${bbox};
  way["leisure"~"^(park|garden)$"]${bbox};
  way["landuse"~"^(grass|forest|cemetery|recreation_ground)$"]${bbox};
);
out geom 600;`;

  const data = await query(q);
  const layers = { streets: [], water: [], green: [] };
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || !el.geometry?.length) continue;
    const pts = el.geometry.map((g) => [g.lat, g.lon]);
    const t = el.tags ?? {};
    if (t.natural === "water" || t.waterway) layers.water.push({ pts, closed: isClosed(pts) });
    else if (t.leisure || t.landuse) layers.green.push({ pts, closed: isClosed(pts) });
    else if (t.highway) {
      const cls = streetClass(t.highway);
      if (cls) layers.streets.push({ pts, cls });
    }
  }
  return layers;
}

const isClosed = (pts) =>
  pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];

const streetClass = (hw) => {
  if (/^(motorway|trunk|primary)/.test(hw)) return "major";
  if (/^(secondary|tertiary)/.test(hw)) return "mid";
  if (/^(footway|path|cycleway|steps|pedestrian|track)/.test(hw)) return "path";
  if (/^(service|parking)/.test(hw)) return null; // alleys and lot aisles are clutter at this scale
  return "minor";
};

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
