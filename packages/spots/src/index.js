// @dtd/spots — Find a Bench. One core, two surfaces: the public generator
// page (POST /spot on dtd-api) and the small printed map in each issue's
// front pages (closer + typesetter).
//
//   findSpot({ lat, lng, exclude, apiKey }) ->
//     { spot, copy, svg, source, candidateCount } | null
//
// Never throws for "no spots here" (returns null); network errors do throw —
// callers that must not fail (the closer) wrap it.

import { findCandidates, mapLayers } from "./overpass.js";
import { pickSpot } from "./pick.js";
import { renderSpotMap } from "./map.js";

export { geocode } from "./geocode.js";
export { findCandidates, mapLayers } from "./overpass.js";
export { pickSpot } from "./pick.js";
export { renderSpotMap } from "./map.js";

export async function findSpot({ lat, lng, exclude = [], apiKey = null, candidates = null }) {
  // Default radius ~2km (a 25 minute walk), widening once if sparse.
  let pool = candidates ?? (await findCandidates({ lat, lng, radius: 2000 }));
  if (pool.length < 3) pool = await findCandidates({ lat, lng, radius: 5000 });

  const excluded = new Set(exclude);
  const eligible = pool.filter((c) => !excluded.has(c.osmId));
  if (!eligible.length) return null;

  const pick = await pickSpot({ candidates: eligible, apiKey });
  if (!pick) return null;

  const layers = await mapLayers({ lat: pick.spot.lat, lng: pick.spot.lng, spanMeters: 900 });
  const svg = renderSpotMap({ spot: pick.spot, layers, spanMeters: 900 });

  return {
    spot: pick.spot,
    copy: pick.copy,
    svg,
    source: pick.source,
    candidateCount: eligible.length,
    pool,
  };
}
