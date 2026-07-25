// Nominatim place -> lat/lng, under their fair-use policy: identifying
// User-Agent, one request per lookup, and callers cache results (the closer
// stores the geocode on the user row; the site rate-limits /spot).
// If the page ever gets real traffic, swap this file for a paid geocoder
// behind the same signature.

const UA = "DeadTreeDigest/1.0 (press@mail.deadtreedigest.com)";

// lat/lng -> a short human street reference for the map label ("Kedzie Blvd
// & Palmer St" territory). Same fair-use rules; called once per pick.
export async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&zoom=17&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`reverse geocode failed (${res.status})`);
  const hit = await res.json();
  const a = hit?.address ?? {};
  const road = a.road ?? a.pedestrian ?? a.footway ?? a.cycleway ?? null;
  const locality = a.neighbourhood ?? a.suburb ?? a.city_district ?? a.town ?? a.city ?? null;
  const street = road ? (a.house_number ? `${a.house_number} ${road}` : road) : null;
  return {
    street,
    locality,
    short: [street, locality].filter(Boolean).join(", ") || hit?.display_name?.split(",").slice(0, 2).join(",") || null,
  };
}

export async function geocode(place) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
    encodeURIComponent(place);
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`geocode failed (${res.status})`);
  const [hit] = await res.json();
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name };
}
