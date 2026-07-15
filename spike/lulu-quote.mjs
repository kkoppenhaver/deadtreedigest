#!/usr/bin/env node
// Milestone 1 quote spike: hit Lulu's print-job-cost-calculations API with our
// exact spec across page counts and bindings, and print the real per-issue cost.
//
// Usage: cp .env.example .env, fill in Lulu credentials + shipping address, then:
//   node spike/lulu-quote.mjs
//
// Spec under test (SPEC.md): digest trim 5.5x8.5, B&W standard interior on
// 60# uncoated, color matte cover, quantity 1, cheapest mail shipping.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  try {
    for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env — rely on real env vars */
  }
}
loadEnv();

const {
  LULU_CLIENT_KEY,
  LULU_CLIENT_SECRET,
  LULU_ENV = "production",
  SHIP_CITY,
  SHIP_STATE,
  SHIP_POSTCODE,
  SHIP_STREET1,
  SHIP_PHONE = "+1 555 555 5555",
} = process.env;

if (!LULU_CLIENT_KEY || !LULU_CLIENT_SECRET) {
  console.error(
    "Missing LULU_CLIENT_KEY / LULU_CLIENT_SECRET.\n" +
      "Create a free account at https://developers.lulu.com (or developers.sandbox.lulu.com\n" +
      "for sandbox keys), then: cp .env.example .env and fill it in."
  );
  process.exit(1);
}
for (const [k, v] of Object.entries({ SHIP_CITY, SHIP_STATE, SHIP_POSTCODE, SHIP_STREET1 })) {
  if (!v) {
    console.error(`Missing ${k} in .env — shipping address is required for a real quote.`);
    process.exit(1);
  }
}

const BASE = LULU_ENV === "sandbox" ? "https://api.sandbox.lulu.com" : "https://api.lulu.com";

// pod_package_id: [Trim].[Ink].[Quality].[Binding].[Paper].[Finish]
const TRIM = "0550X0850"; // digest 5.5" x 8.5"
const INTERIOR = "BW.STD"; // B&W, standard quality
const PAPER = "060UW444"; // 60# uncoated white
const FINISH = "MXX"; // matte cover
const pkg = (binding) => `${TRIM}.${INTERIOR}.${binding}.${PAPER}.${FINISH}`;

// Bindings: PB = perfect bound (min ~32pp), CO = coil, SS = saddle stitch (max ~48pp)
const MATRIX = [
  { binding: "SS", pages: 40 },
  { binding: "SS", pages: 48 },
  { binding: "PB", pages: 60 },
  { binding: "PB", pages: 80 },
  { binding: "PB", pages: 100 },
  { binding: "CO", pages: 60 },
  { binding: "CO", pages: 80 },
  { binding: "CO", pages: 100 },
];

const SHIPPING_LEVELS = ["MAIL", "GROUND"];

const shipping_address = {
  street1: SHIP_STREET1,
  city: SHIP_CITY,
  state_code: SHIP_STATE,
  postcode: SHIP_POSTCODE,
  country_code: "US",
  phone_number: SHIP_PHONE,
};

async function getToken() {
  const res = await fetch(`${BASE}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${LULU_CLIENT_KEY}:${LULU_CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function quote(token, { binding, pages }, shipping_option) {
  const body = {
    line_items: [{ pod_package_id: pkg(binding), page_count: pages, quantity: 1 }],
    shipping_address,
    shipping_option,
  };
  const res = await fetch(`${BASE}/print-job-cost-calculations/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { binding, pages, shipping_option, error: JSON.stringify(json) };
  return {
    binding,
    pages,
    shipping_option,
    print: Number(json.line_item_costs?.[0]?.total_cost_incl_tax),
    shipping: Number(json.shipping_cost?.total_cost_incl_tax),
    fulfillment: Number(json.fulfillment_cost?.total_cost_incl_tax ?? 0),
    total: Number(json.total_cost_incl_tax),
    raw: json,
  };
}

const token = await getToken();
console.log(`Authenticated against ${BASE}\n`);

const results = [];
for (const combo of MATRIX) {
  for (const level of SHIPPING_LEVELS) {
    const r = await quote(token, combo, level);
    results.push(r);
    if (r.error) {
      console.log(`✗ ${combo.binding} ${combo.pages}pp ${level}: ${r.error}`);
    } else {
      console.log(
        `✓ ${combo.binding} ${String(combo.pages).padStart(3)}pp ${level.padEnd(6)}` +
          ` print $${r.print.toFixed(2)}  ship $${r.shipping.toFixed(2)}` +
          `  ffmt $${r.fulfillment.toFixed(2)}  TOTAL $${r.total.toFixed(2)}`
      );
    }
  }
}

const ok = results.filter((r) => !r.error);
if (ok.length) {
  console.log("\n| Binding | Pages | Shipping | Print | Ship | Total/issue | /month (x2) | /year (x26) |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of ok) {
    console.log(
      `| ${r.binding} | ${r.pages} | ${r.shipping_option} | $${r.print.toFixed(2)} | $${r.shipping.toFixed(
        2
      )} | $${r.total.toFixed(2)} | $${(r.total * 2).toFixed(2)} | $${(r.total * 26).toFixed(2)} |`
    );
  }
}

const out = resolve(root, "spike", `lulu-quotes-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nFull responses saved to ${out}`);
