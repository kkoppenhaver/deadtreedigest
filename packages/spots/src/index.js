// @dtd/spots — Find a Bench. One core, two surfaces: the public generator
// page (POST /spot on dtd-api) and the small printed map in each issue's
// front pages (closer + typesetter).
//
//   findSpot({ lat, lng, home, exclude, apiKey }) ->
//     { spot, copy, svg, directions, route, source, candidateCount } | null
//
// With `home` the map frames the whole walk (house doodle -> pin, dashed
// route, labeled streets) and `directions` carries MapQuest-style steps.
// Never throws for "no spots here" (returns null); network errors do throw —
// callers that must not fail (the closer) wrap it. Routing and reverse
// geocoding failures degrade silently (spot-centered map, no directions).

import { findCandidates, mapLayers, routeLandmarks } from "./overpass.js";
import { pickSpot, annotateDirections } from "./pick.js";
import { renderSpotMap, computeFrame } from "./map.js";
import { reverseGeocode } from "./geocode.js";
import { footRoute, formatDirections } from "./route.js";
import QRCode from "qrcode-svg";

export { geocode, reverseGeocode } from "./geocode.js";
export { findCandidates, mapLayers, routeLandmarks } from "./overpass.js";
export { pickSpot, annotateDirections } from "./pick.js";
export { renderSpotMap, computeFrame } from "./map.js";
export { footRoute, formatDirections } from "./route.js";

// Small QR to walking directions (origin = wherever the phone is). The
// print page keeps it tiny and last — the escape hatch, not the feature.
export function directionsQr(lat, lng) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
  return new QRCode({ content: url, padding: 0, width: 60, height: 60, ecl: "M", join: true }).svg();
}

const KIND_DEST = {
  bench: "Your bench",
  park: "The park",
  viewpoint: "The lookout",
  pier: "The pier",
  lighthouse: "The lighthouse",
  cemetery: "The gate",
  "ferry terminal": "The terminal",
};

export async function findSpot({ lat, lng, home = null, exclude = [], apiKey = null, candidates = null }) {
  // Default radius ~2km (a 25 minute walk), widening once if sparse.
  let pool = candidates ?? (await findCandidates({ lat, lng, radius: 2000 }));
  if (pool.length < 3) pool = await findCandidates({ lat, lng, radius: 5000 });

  const excluded = new Set(exclude);
  const eligible = pool.filter((c) => !excluded.has(c.osmId));
  if (!eligible.length) return null;

  const pick = await pickSpot({ candidates: eligible, apiKey });
  if (!pick) return null;

  // The map needs identifying information — a name is not enough to find an
  // unnamed bench, so reverse-geocode a street reference for the label chip.
  const addr = await reverseGeocode(pick.spot.lat, pick.spot.lng).catch(() => null);
  pick.spot.address = addr?.short ?? null;

  // The journey: walking route + turn-by-turn when we know the origin.
  let route = null;
  let directions = [];
  if (home) {
    try {
      route = await footRoute(home, { lat: pick.spot.lat, lng: pick.spot.lng });
      if (route) {
        directions = formatDirections(route, KIND_DEST[pick.spot.kind] ?? "Your spot");
        // The fallback copy guesses the walk from straight-line distance;
        // once we have a real route, correct it to the routed minutes.
        pick.copy = pick.copy.replace(/about a \d+ minute walk/, `about a ${route.minutes} minute walk`);
        // Wayfinding color: landmarks along the corridor become validated
        // parentheticals on the steps that pass them.
        if (apiKey && directions.length) {
          try {
            const landmarks = await routeLandmarks(route.geometry);
            if (landmarks.length) directions = await annotateDirections({ directions, landmarks, apiKey });
          } catch (err) {
            console.error(`landmarks skipped: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`routing skipped: ${err.message}`);
    }
  }

  const frame = computeFrame({ spot: pick.spot, home: route ? home : null, route });
  const layers = await mapLayers({ lat: frame.lat, lng: frame.lng, spanMeters: frame.spanMeters });
  const svg = renderSpotMap({
    spot: pick.spot,
    layers,
    frame,
    home: route ? home : null,
    route,
    label: {
      title: pick.spot.name ?? `a ${pick.spot.kind}`,
      sub: addr?.short ?? null,
    },
  });

  return {
    spot: pick.spot,
    copy: pick.copy,
    svg,
    directions,
    route: route ? { meters: route.meters, minutes: route.minutes } : null,
    source: pick.source,
    candidateCount: eligible.length,
    pool,
  };
}
