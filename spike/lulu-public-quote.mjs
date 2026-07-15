#!/usr/bin/env node
// Milestone 1 quote spike, no credentials needed: Lulu's public pricing GraphQL
// endpoint (the one behind developers.lulu.com/price-calculator) exposes
// manufacturing cost + Print API total price per unit. Shipping is quoted
// separately via the authenticated REST spike (spike/lulu-quote.mjs).
//
// Usage: node spike/lulu-public-quote.mjs

const ENDPOINT = "https://api.lulu.com/graphql/";

const TRIM = "0550X0850"; // digest 5.5" x 8.5"
const pkg = (binding) => `${TRIM}.BW.STD.${binding}.060UW444.MXX`;

const MATRIX = [
  ["SS", 40],
  ["SS", 48],
  ["PB", 60],
  ["PB", 80],
  ["PB", 100],
  ["CO", 60],
  ["CO", 80],
  ["CO", 100],
];

const QUERY = `query TotalPrices($podPackageId: String!, $pageCount: Int!, $quantity: Int, $currency: CurrencyEnum) {
  totalPrices(podPackageId: $podPackageId, pageCount: $pageCount, quantity: $quantity, lineOfBusiness: "PRINTAPI", currency: $currency) {
    basePrice { amount }
    totalPrice { amount }
    handlingFee { amount }
    fulfillmentFee { amount }
    totalDiscounts { discountType percentage description discount { amount } }
  }
}`;

async function totalPrices(binding, pageCount) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "TotalPrices",
      query: QUERY,
      variables: { podPackageId: pkg(binding), pageCount, quantity: 1, currency: "USD" },
    }),
  });
  const json = await res.json();
  if (json.errors) return { binding, pageCount, error: json.errors.map((e) => e.message).join("; ") };
  const t = json.data.totalPrices;
  return {
    binding,
    pageCount,
    base: t.basePrice?.amount,
    total: t.totalPrice?.amount,
    handling: t.handlingFee?.amount,
    fulfillment: t.fulfillmentFee?.amount,
    discounts: t.totalDiscounts,
  };
}

const SHIPPING_QUERY = `query DispatcherShippingMethods($input: ShippingMethodsInput!) {
  dispatcherShippingMethods(input: $input) { id cost currency name traceable daysMin daysMax }
}`;

// Destination only affects tax + carrier zones; Mail pricing is flat-ish within US.
// Override with SHIP_CITY/SHIP_STATE/SHIP_POSTCODE env vars for your address.
const address = {
  city: process.env.SHIP_CITY || "Chicago",
  state: process.env.SHIP_STATE || "IL",
  postalCode: process.env.SHIP_POSTCODE || "60614",
  country: "US",
};

async function shippingMethods(binding, pageCount) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "DispatcherShippingMethods",
      query: SHIPPING_QUERY,
      variables: {
        input: {
          shippingAddress: address,
          lineItems: [{ podPackageId: pkg(binding), pageCount, quantity: 1 }],
          currency: "USD",
        },
      },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data.dispatcherShippingMethods;
}

const rows = [];
for (const [binding, pages] of MATRIX) {
  rows.push(await totalPrices(binding, pages));
}

console.log("## Print cost (per unit, qty 1)\n");
console.log("| Binding | Pages | Base | Handling | Fulfillment | Total print cost |");
console.log("|---|---|---|---|---|---|");
for (const r of rows) {
  if (r.error) {
    console.log(`| ${r.binding} | ${r.pageCount} | — | — | — | ERROR: ${r.error} |`);
  } else {
    const f = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
    console.log(
      `| ${r.binding} | ${r.pageCount} | ${f(r.base)} | ${f(r.handling)} | ${f(r.fulfillment)} | ${f(r.total)} |`
    );
    if (r.discounts?.length) console.log(`  discounts: ${JSON.stringify(r.discounts)}`);
  }
}

const methods = await shippingMethods("PB", 80);
console.log(`\n## Shipping (80pp PB to ${address.city}, ${address.state})\n`);
console.log("| Method | Cost | Transit |");
console.log("|---|---|---|");
for (const m of methods) {
  console.log(`| ${m.name} | $${m.cost.toFixed(2)} | ${m.daysMin}–${m.daysMax} days |`);
}

const mail = methods.find((m) => m.name === "Mail");
console.log("\n## Per-issue all-in (print + $0.75 fulfillment + Mail shipping, pre-tax)\n");
console.log("| Binding | Pages | All-in/issue | /month (x2) | /year (x26) |");
console.log("|---|---|---|---|---|");
for (const r of rows.filter((r) => !r.error)) {
  const allIn = Number(r.total) + Number(r.fulfillment ?? 0.75) + mail.cost;
  console.log(
    `| ${r.binding} | ${r.pageCount} | $${allIn.toFixed(2)} | $${(allIn * 2).toFixed(2)} | $${(
      allIn * 26
    ).toFixed(2)} |`
  );
}
