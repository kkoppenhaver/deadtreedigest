#!/usr/bin/env node
// Local harness: node packages/spots/cli.mjs "Logan Square, Chicago"
//            or: node packages/spots/cli.mjs 41.9227,-87.7012
// Writes the map to packages/spots/out/spot.svg. Uses ANTHROPIC_API_KEY
// from the environment when present; falls back deterministically otherwise.

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findSpot, geocode, directionsQr } from "./src/index.js";

const arg = process.argv[2];
if (!arg) {
  console.error('usage: cli.mjs "<place>" | <lat>,<lng>');
  process.exit(1);
}

let lat, lng, label;
const m = arg.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
if (m) {
  [lat, lng] = [Number(m[1]), Number(m[2])];
  label = arg;
} else {
  const hit = await geocode(arg);
  if (!hit) {
    console.error("no geocode result");
    process.exit(1);
  }
  ({ lat, lng } = hit);
  label = hit.label;
  console.log(`geocoded: ${label} -> ${lat}, ${lng}`);
}

const t0 = Date.now();
// --home makes it a journey map: framed from your door, with turn-by-turn.
const home = process.argv.includes("--home") ? { lat, lng } : null;
const result = await findSpot({ lat, lng, home, apiKey: process.env.ANTHROPIC_API_KEY ?? null });
if (!result) {
  console.log("no spots found nearby");
  process.exit(0);
}

console.log(`\n${result.copy}\n`);
console.log(
  `spot: ${result.spot.kind}${result.spot.name ? ` "${result.spot.name}"` : ""} (${result.spot.osmId}) ` +
    `${result.spot.meters}m away · picked by ${result.source} from ${result.candidateCount} candidates · ${Date.now() - t0}ms`
);

if (result.directions.length) console.log("\n" + result.directions.map((d, i) => `  ${i + 1}. ${d}`).join("\n"));

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "spot.svg"), result.svg);
// The full bundle render.mjs --spot consumes for print previews.
writeFileSync(
  resolve(outDir, "spot.json"),
  JSON.stringify({
    copy: result.copy,
    svg: result.svg,
    directions: result.directions,
    qr: directionsQr(result.spot.lat, result.spot.lng),
  }, null, 2)
);
console.log(`map: packages/spots/out/spot.svg (+ spot.json for render.mjs --spot)`);
