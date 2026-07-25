// Walking route + old-school turn-by-turn via the FOSSGIS Valhalla instance.
// Valhalla over OSRM-foot deliberately: its pedestrian costing can be told
// to avoid alleys and unnamed sidewalk segments (walkway/alley factors), so
// directions read "Turn right onto West Palmer Boulevard" instead of eleven
// lines of "continue along the path" through Chicago's alley grid. Same
// politeness rules as the other free services: identifying UA, one request
// per pick, failure means "no directions", never an error.

const VALHALLA = "https://valhalla1.openstreetmap.de/route";
const UA = "DeadTreeDigest/1.0 (press@mail.deadtreedigest.com)";

export async function footRoute(from, to) {
  const res = await fetch(VALHALLA, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [
        { lat: from.lat, lon: from.lng },
        { lat: to.lat, lon: to.lng },
      ],
      costing: "pedestrian",
      costing_options: {
        pedestrian: { walkway_factor: 6, sidewalk_factor: 2, alley_factor: 25, driveway_factor: 25 },
      },
      directions_options: { units: "kilometers" },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`routing failed (${res.status})`);
  const trip = (await res.json())?.trip;
  const leg = trip?.legs?.[0];
  if (!leg) return null;
  return {
    meters: Math.round(trip.summary.length * 1000),
    minutes: Math.max(1, Math.round(trip.summary.time / 60)),
    geometry: decodePolyline(leg.shape),
    maneuvers: (leg.maneuvers ?? []).map((m) => ({
      instruction: m.instruction ?? "",
      meters: Math.round((m.length ?? 0) * 1000),
      type: m.type ?? 0,
    })),
  };
}

const fmtDist = (m) => (m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`);
const PATHY = /(the walkway|the crosswalk|the cycleway|the path\b|Access Point|pedestrian crossing|the steps)/i;

// Valhalla maneuvers -> printable MapQuest lines. Fold the noise a walker
// doesn't count: sub-25m shuffles, "stay on" continuations, and short
// walkway hops all merge into the previous step's distance.
export function formatDirections(route, destLabel = "Your spot") {
  const steps = [];
  for (const m of route.maneuvers ?? []) {
    if (m.type >= 4 && m.type <= 6) {
      const side = /left/i.test(m.instruction) ? "on your left" : /right/i.test(m.instruction) ? "on your right" : "just ahead";
      steps.push({ text: `${destLabel} is ${side}`, meters: 0, arrive: true });
      continue;
    }
    let text = m.instruction.replace(/\.\s*$/, "");
    text = text.replace(/^Walk\b/i, "Head");
    const pathy = PATHY.test(text);
    const last = steps[steps.length - 1];
    if (last && !last.arrive && (m.meters < 25 || /stay on|^Keep (left|right)$/i.test(text) || (pathy && m.meters < 90))) {
      last.meters += m.meters;
      continue;
    }
    if (pathy) text = steps.length === 0 ? text.replace(/ on the .*$/i, "") : "Follow the paths";
    steps.push({ text, meters: m.meters });
  }
  return steps
    .map((s) => (s.arrive ? s.text : `${s.text} — ${fmtDist(s.meters)}`))
    .slice(0, 9); // a printed list longer than nine steps is a hike, not a walk
}

// Valhalla encodes its shape as a precision-6 polyline.
function decodePolyline(str) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const pts = [];
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    pts.push([lat / 1e6, lng / 1e6]);
  }
  return pts;
}
