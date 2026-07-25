// Nominatim place -> lat/lng, under their fair-use policy: identifying
// User-Agent, one request per lookup, and callers cache results (the closer
// stores the geocode on the user row; the site rate-limits /spot).
// If the page ever gets real traffic, swap this file for a paid geocoder
// behind the same signature.

const UA = "DeadTreeDigest/1.0 (press@mail.deadtreedigest.com)";

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
