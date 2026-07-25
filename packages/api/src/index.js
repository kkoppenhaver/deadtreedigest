// dtd-api: the library core. Clients (Chrome extension, email worker, curl)
// POST raw captures here; articles come out normalized, page-estimated, and
// queued for the next issue. The raw capture is retained in R2 so flagged
// items can be re-parsed after extractor fixes without re-saving.

import { parseArticle } from "@dtd/reader";
import { verifyKey, signedFileUrl } from "./sign.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function authedUser(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return env.DB.prepare("SELECT * FROM users WHERE save_token = ?").bind(token).first();
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") return json({ ok: true });

    // Public ledger totals for the static ledger page (CORS-open, GET only).
    // Global aggregates, no per-user data; safe to serve to anyone.
    if (request.method === "GET" && pathname === "/ledger") {
      return ledgerTotals(env);
    }

    // Public onboarding: the homepage form posts here (CORS-open), the
    // welcome email links to /setup.
    if (pathname === "/signup") {
      if (request.method === "OPTIONS") return corsPreflight();
      if (request.method === "POST") return signup(request, env);
    }
    if (request.method === "GET" && pathname === "/setup") {
      return setupPage(request, env);
    }

    // Billing: /subscribe bounces to Stripe Checkout (setup_key-authed, same
    // key the welcome email already carries); the webhook flips beta as
    // subscriptions start and stop.
    if (request.method === "GET" && pathname === "/subscribe") {
      return subscribePage(request, env);
    }
    if (request.method === "POST" && pathname === "/stripe/webhook") {
      return stripeWebhook(request, env);
    }

    // Magic-link address page: key-authed (emailed URL), browser-facing,
    // handled before the bearer gate. The key is scoped to the address only.
    if (pathname === "/address") {
      return addressPage(request, env);
    }

    // The library: queue status, parse previews, flagging, past issues.
    if (pathname === "/queue") {
      return queuePage(request, env, ctx);
    }
    if (pathname === "/queue/item") {
      return queueItemPage(request, env);
    }

    // HMAC-signed R2 file serving: how Lulu fetches printables and how the
    // review email's preview links work. Signature covers exactly one key.
    if (request.method === "GET" && pathname.startsWith("/files/")) {
      const r2Key = decodeURIComponent(pathname.slice("/files/".length));
      const sig = new URL(request.url).searchParams.get("sig");
      if (!(await verifyKey(env.FILE_SIGNING_SECRET, r2Key, sig))) {
        return json({ error: "bad signature" }, 403);
      }
      const obj = await env.RAW.get(r2Key);
      if (!obj) return json({ error: "not found" }, 404);
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
          "Content-Length": String(obj.size),
        },
      });
    }

    const user = await authedUser(request, env);
    if (!user) return json({ error: "missing or invalid bearer token" }, 401);

    if (request.method === "POST" && pathname === "/save") {
      return save(request, env, user, ctx);
    }
    if (request.method === "GET" && pathname === "/library") {
      return library(env, user);
    }
    if (request.method === "GET" && pathname === "/me") {
      return json(profile(user));
    }
    if (request.method === "PATCH" && pathname === "/me") {
      return updateMe(request, env, user);
    }
    if (request.method === "POST" && pathname.match(/^\/items\/[\w-]+\/flag$/)) {
      return flag(env, user, pathname.split("/")[2], ctx);
    }
    if (request.method === "POST" && pathname.match(/^\/items\/[\w-]+\/reparse$/)) {
      return reparse(env, user, pathname.split("/")[2]);
    }
    return json({ error: "not found" }, 404);
  },
};

async function save(request, env, user, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "body must be JSON: { url?, html, source?, email? }" }, 400);
  }
  if (!body.html) return json({ error: "html is required" }, 400);
  if (!body.url && !body.email) return json({ error: "url is required for non-email saves" }, 400);

  let article;
  try {
    article = parseArticle({ html: body.html, url: body.url ?? null, source: body.source ?? null, email: body.email ?? null });
  } catch (err) {
    return json({ error: `parse crashed: ${err.message}` }, 500);
  }
  if (!article) return json({ error: "nothing article-shaped found", needsReview: true }, 422);

  const id = crypto.randomUUID();
  const rawKey = `raw/${user.id}/${id}.html`;
  await env.RAW.put(rawKey, body.html, { httpMetadata: { contentType: "text/html" } });

  await env.DB.prepare(
    `INSERT INTO items (id, user_id, url, canonical_url, source, title, byline, site_name,
       published_at, excerpt, content_html, links_json, images_json, word_count,
       estimated_pages, needs_review, raw_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, user.id, article.url, article.canonicalUrl, article.source, article.title,
      article.byline, article.siteName, article.publishedAt, article.excerpt,
      article.contentHtml, JSON.stringify(article.links), JSON.stringify(article.images),
      article.wordCount, article.estimatedPages, article.needsReview ? 1 : 0, rawKey
    )
    .run();

  // Print-when-full: every save may be the one that fills the issue. The
  // closer decides (threshold + interval guard); fire-and-forget so the
  // popup isn't held hostage by a 10s render.
  ctx.waitUntil(
    env.CLOSER.fetch("https://closer/check", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.save_token}` },
    }).catch((err) => console.error(`closer check failed: ${err.message}`))
  );

  return json({
    id,
    title: article.title,
    source: article.source,
    byline: article.byline,
    wordCount: article.wordCount,
    estimatedPages: article.estimatedPages,
    needsReview: article.needsReview,
  }, 201);
}

async function library(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, byline, site_name, source, url, estimated_pages, word_count,
            needs_review, created_at
     FROM items WHERE user_id = ? AND status = 'queued' ORDER BY created_at`
  )
    .bind(user.id)
    .all();

  const queuedPages = results.reduce((s, r) => s + r.estimated_pages, 0);
  return json({
    user: { email: user.email, cadence: user.cadence, pageCap: user.page_cap, nextIssueDate: user.next_issue_date },
    queueUrl: `https://api.deadtreedigest.com/queue?key=${user.library_key}`,
    queued: results,
    queuedCount: results.length,
    queuedPages: Math.round(queuedPages * 10) / 10,
    capRemaining: Math.round((user.page_cap - queuedPages) * 10) / 10,
  });
}

// One grown tree ≈ 8,000 letter-size sheets ≈ 16,000 sheets at our
// half-letter trim. "sheets" below counts our trim (pages/2), so the
// denominator matches (decided 2026-07-25: our paper size is the unit).
const SHEETS_PER_TREE = 16000;

// GET /ledger — the running math the static ledger page renders. Global
// totals only: how many of us there are, what we've printed, what that cost
// in paper, and what we've planted. Basis is *printed* issues (paper is spent
// at print time, and trees are planted per print job), not shipped ones.
async function ledgerTotals(env) {
  // Everyone who has signed up (Keanan's call 2026-07-19: count all signups,
  // not just beta users or shipped-to readers).
  const subscribers = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  const printed = await env.DB.prepare(
    `SELECT COUNT(*) AS issues,
            COALESCE(SUM(page_count), 0) AS pages,
            COALESCE(SUM(trees_planted), 0) AS planted
     FROM issues WHERE lulu_job_id IS NOT NULL`
  ).first();

  const sheets = Math.ceil((printed.pages || 0) / 2); // duplex: 2 pages/sheet
  const treesConsumed = Math.round((sheets / SHEETS_PER_TREE) * 1000) / 1000;

  // Planting receipts, one per printed issue — the trees page shows them
  // live. DigitalHumani request ids only; no user data.
  const { results: plantings } = await env.DB.prepare(
    "SELECT trees_planted AS trees, tree_request_id AS receipt, closed_at FROM issues WHERE tree_request_id IS NOT NULL ORDER BY closed_at"
  ).all();

  return corsJson({
    subscribers: subscribers.n,
    issuesPrinted: printed.issues,
    sheets,
    treesConsumed,
    treesPlanted: printed.planted,
    plantings: plantings.map((p) => ({
      trees: p.trees,
      receipt: p.receipt,
      date: (p.closed_at ?? "").slice(0, 10),
    })),
    updatedAt: new Date().toISOString(),
  });
}

const US_STATES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC",
};

// No 2-letter collisions with US_STATES, so the province match doubles as
// country detection (Lulu wants country_code = CA for these).
const CA_PROVINCES = {
  alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
  "newfoundland and labrador": "NL", newfoundland: "NL", "nova scotia": "NS",
  "northwest territories": "NT", nunavut: "NU", ontario: "ON",
  "prince edward island": "PE", quebec: "QC", "québec": "QC",
  saskatchewan: "SK", yukon: "YT",
};

function profile(user) {
  return {
    email: user.email,
    pageCap: user.page_cap,
    minIntervalDays: user.min_interval_days,
    address: {
      name: user.ship_name,
      street1: user.ship_street1,
      street2: user.ship_street2,
      city: user.ship_city,
      state: user.ship_state,
      postcode: user.ship_postcode,
      country: user.ship_country,
      phone: user.ship_phone,
    },
    addressComplete: !!(user.ship_name && user.ship_street1 && user.ship_city && user.ship_state && user.ship_postcode),
  };
}

// Normalizes to Lulu's picky formats: 2-letter state/province, "+1 XXX XXX
// XXXX" phone (US and Canada are both NANP, so one phone shape covers both).
// Country is inferred from the state match. Returns { error } or { updated }
// (column map ready to persist).
function validateAddress(a) {
  if (!a || typeof a !== "object") return { error: "address object is required" };

  let state = (a.state ?? "").trim();
  state = state.length === 2
    ? state.toUpperCase()
    : US_STATES[state.toLowerCase()] ?? CA_PROVINCES[state.toLowerCase()] ?? null;
  const country = !state ? null
    : Object.values(US_STATES).includes(state) ? "US"
    : Object.values(CA_PROVINCES).includes(state) ? "CA"
    : null;
  if (!country)
    return { error: "state must be a US state or Canadian province (2-letter code or full name)" };

  const phoneDigits = (a.phone ?? "").replace(/\D/g, "").replace(/^1/, "");
  if (phoneDigits.length !== 10) return { error: "phone must be a 10-digit US or Canadian number" };
  const phone = `+1 ${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3, 6)} ${phoneDigits.slice(6)}`;

  for (const field of ["name", "street1", "city", "postcode"]) {
    if (!a[field]?.trim()) return { error: `${field} is required` };
  }
  if (a.name.includes("@")) {
    return { error: "that name looks like an email address — we need a name for the mailing label" };
  }

  return {
    updated: {
      ship_name: a.name.trim(),
      ship_street1: a.street1.trim(),
      ship_street2: a.street2?.trim() || null,
      ship_city: a.city.trim(),
      ship_state: state,
      ship_postcode: a.postcode.trim(),
      ship_country: country,
      ship_phone: phone,
    },
  };
}

async function persistAddress(env, userId, updated) {
  await env.DB.prepare(
    `UPDATE users SET ship_name=?, ship_street1=?, ship_street2=?, ship_city=?,
       ship_state=?, ship_postcode=?, ship_country=?, ship_phone=? WHERE id=?`
  )
    .bind(...Object.values(updated), userId)
    .run();
}

// PATCH /me — currently only the shipping address is user-editable.
async function updateMe(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  const { error, updated } = validateAddress(body.address);
  if (error) return json({ error }, 400);
  await persistAddress(env, user.id, updated);
  return json(profile({ ...user, ...updated }));
}

// GET/POST /address?key=… — the emailed magic-link page. No login; the key
// is the credential, and it can only touch the shipping address.
async function addressPage(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  const user = key
    ? await env.DB.prepare("SELECT * FROM users WHERE address_key = ?").bind(key).first()
    : null;
  if (!user) return htmlResponse(addressShell("<p class='err'>This link isn't valid. Check the URL from your email.</p>"), 404);

  if (request.method === "POST") {
    const form = await request.formData();
    const a = Object.fromEntries(["name", "street1", "street2", "city", "state", "postcode", "phone"].map((f) => [f, form.get(f) ?? ""]));
    const { error, updated } = validateAddress(a);
    if (error) return htmlResponse(addressShell(addressForm(key, a, error)));
    await persistAddress(env, user.id, updated);
    const origin = new URL(request.url).origin;
    return htmlResponse(
      addressShell(
        `<p class="ok">✓ Address saved. Your issues will ship to:</p>
         <p class="addr">${escapeHtml(updated.ship_name)}<br>${escapeHtml(updated.ship_street1)}${updated.ship_street2 ? `<br>${escapeHtml(updated.ship_street2)}` : ""}<br>${escapeHtml(updated.ship_city)}, ${updated.ship_state} ${escapeHtml(updated.ship_postcode)}</p>
         <p style="margin-top:22px;"><a href="${origin}/setup?key=${user.setup_key}" style="display:inline-block;background:#1f4d38;color:#f1e6cf;padding:11px 20px;text-decoration:none;font-family:Helvetica,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;border:2px solid #2b2419;box-shadow:3px 3px 0 #2b2419;">Continue setup →</a></p>
         <p style="font-size:13px;font-style:italic;color:#6b5f4d;margin-top:14px;">Already set up? Then you're done here — go read something worth saving.</p>`
      )
    );
  }

  const current = {
    name: user.ship_name, street1: user.ship_street1, street2: user.ship_street2,
    city: user.ship_city, state: user.ship_state, postcode: user.ship_postcode, phone: user.ship_phone,
  };
  return htmlResponse(addressShell(addressForm(key, current)));
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const htmlResponse = (html, status = 200) =>
  new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

function addressForm(key, a = {}, error = null) {
  const v = (f) => escapeHtml(a[f] ?? "");
  return `
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <form method="POST" action="/address?key=${escapeHtml(key)}">
      <label>Full name <input name="name" value="${v("name")}" required></label>
      <label>Street <input name="street1" value="${v("street1")}" required></label>
      <label>Apt / unit (optional) <input name="street2" value="${v("street2")}"></label>
      <div class="row">
        <label>City <input name="city" value="${v("city")}" required></label>
        <label>State / Province <input name="state" value="${v("state")}" placeholder="IL or ON" required></label>
      </div>
      <div class="row">
        <label>ZIP / Postal code <input name="postcode" value="${v("postcode")}" required></label>
        <label>Phone <input name="phone" type="tel" value="${v("phone")}" placeholder="847 555 0100" required></label>
      </div>
      <button type="submit">Save address</button>
    </form>`;
}

function addressShell(inner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dead Tree Digest — Shipping address</title>
<style>
  body { background: #f1e6cf; color: #2b2419; font-family: Georgia, serif; margin: 0; padding: 24px; display: flex; justify-content: center; }
  .card { max-width: 420px; width: 100%; background: #faf3e3; border: 2.5px solid #2b2419; box-shadow: 6px 6px 0 rgba(31,77,56,0.25); padding: 24px; }
  h1 { font-family: Helvetica, Arial, sans-serif; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 2px solid #2b2419; padding-bottom: 8px; margin: 0 0 6px; }
  .sub { font-style: italic; font-size: 13px; color: #6b5f4d; margin-bottom: 10px; }
  label { display: block; margin-top: 12px; font-weight: bold; font-size: 13px; }
  input { width: 100%; margin-top: 4px; padding: 8px; font-family: "Courier New", monospace; font-size: 13px; border: 1.5px solid #2b2419; background: #fff; box-sizing: border-box; }
  .row { display: flex; gap: 10px; } .row label { flex: 1; }
  button { margin-top: 16px; font-family: Helvetica, Arial, sans-serif; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; padding: 10px 16px; border: 2px solid #2b2419; background: #1f4d38; color: #f1e6cf; cursor: pointer; box-shadow: 3px 3px 0 #2b2419; }
  .err { color: #bf4e24; font-style: italic; }
  .ok { color: #1f4d38; font-weight: bold; }
  .addr { font-family: "Courier New", monospace; border: 1.5px solid #2b2419; padding: 12px; background: #fff; }
</style></head>
<body><div class="card">
  <h1>🌲 Dead Tree Digest</h1>
  <div class="sub">Where should your printed issues go?</div>
  ${inner}
</div></body></html>`;
}

// ---------------------------------------------------------------------------
// The library page

async function libraryUser(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return null;
  return env.DB.prepare("SELECT * FROM users WHERE library_key = ?").bind(key).first();
}

async function queuePage(request, env, ctx) {
  const user = await libraryUser(request, env);
  if (!user) return htmlResponse(libShell("<p class='err'>This link isn't valid.</p>"), 404);
  const key = user.library_key;

  // flag action via keyed form post
  if (request.method === "POST") {
    const form = await request.formData();
    const itemId = form.get("flag");
    if (itemId) {
      const res = await env.DB.prepare("UPDATE items SET needs_review = 1 WHERE id = ? AND user_id = ?")
        .bind(itemId, user.id)
        .run();
      if (res.meta.changes > 0) ctx?.waitUntil(sendFlagAlert(env, user, itemId));
    }
    const removeId = form.get("remove");
    if (removeId) {
      await env.DB.prepare("UPDATE items SET status = 'skipped' WHERE id = ? AND user_id = ? AND status = 'queued'")
        .bind(removeId, user.id)
        .run();
    }
    return Response.redirect(new URL(request.url).origin + "/queue?key=" + key, 303);
  }

  const { results: queued } = await env.DB.prepare(
    "SELECT * FROM items WHERE user_id = ? AND status = 'queued' ORDER BY created_at DESC"
  ).bind(user.id).all();
  const { results: issues } = await env.DB.prepare(
    "SELECT * FROM issues WHERE user_id = ? ORDER BY number DESC"
  ).bind(user.id).all();

  // Flagged items are on hold: they don't count toward the cap and the
  // closer won't print them (mirrors checkUser/closeForUser).
  const countable = queued.filter((i) => !i.needs_review);
  const est = countable.reduce((t, i) => t + i.estimated_pages * 1.15, 0);
  const pct = Math.min(100, Math.round((est / user.page_cap) * 100));

  // A full queue prints at the next opening: min_interval_days after the
  // last close (the closer's cost guard). Name the date when it's known.
  const openAt = user.last_closed_at
    ? new Date(new Date(user.last_closed_at).valueOf() + user.min_interval_days * 86_400_000)
    : null;
  const fullNote =
    openAt && openAt > new Date()
      ? `full — prints on or after ${openAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
      : "full — printing at the next opening";

  const rowHtml = (i) => `
    <div class="row">
      <div class="grow">
        <a class="t" href="/queue/item?key=${key}&id=${i.id}">${escapeHtml(i.title)}</a>
        <div class="m">${escapeHtml([i.site_name, i.byline].filter(Boolean).join(" · "))} · ~${i.estimated_pages}pp${i.needs_review ? ' · <span class="warn">needs review</span>' : ""} · saved ${escapeHtml((i.created_at ?? "").slice(0, 10))} · <a href="/queue/item?key=${key}&id=${i.id}">preview</a>${i.url ? ` · <a href="${escapeHtml(i.url)}" target="_blank" rel="noopener">original</a>` : ""}</div>
      </div>
      <form method="POST" action="/queue?key=${key}"><input type="hidden" name="flag" value="${i.id}"><button ${i.needs_review ? "disabled" : ""}>${i.needs_review ? "flagged" : "flag parse"}</button></form>
      <form method="POST" action="/queue?key=${key}" onsubmit="return confirm('Remove from your next issue? It won\'t print.')"><input type="hidden" name="remove" value="${i.id}"><button>remove</button></form>
    </div>`;

  // Mirror the closer's greedy pack (save order, same 1.15 margin) so the
  // page shows the same split the close will make: what fits under the cap
  // prints in the next issue, the rest rolls over to the one after.
  const pickedIds = new Set();
  let packed = 0;
  for (const item of [...queued].reverse()) {
    if (item.needs_review) continue; // held until the parse is fixed
    const cost = item.estimated_pages * 1.15;
    if (pickedIds.size > 0 && packed + cost > user.page_cap) continue;
    pickedIds.add(item.id);
    packed += cost;
  }
  const pickedRows = queued.filter((i) => pickedIds.has(i.id)).map(rowHtml).join("");
  const rolledRows = queued.filter((i) => !pickedIds.has(i.id)).map(rowHtml).join("");
  const nextNumber = (issues[0]?.number ?? 0) + 1;

  const issueRows = await Promise.all(issues.map(async (iss) => {
    const pdf = iss.pdf_key ? await signedFileUrl(env.FILE_SIGNING_SECRET, new URL(request.url).origin, iss.pdf_key) : null;
    const cover = iss.cover_key ? await signedFileUrl(env.FILE_SIGNING_SECRET, new URL(request.url).origin, iss.cover_key) : null;
    return `<div class="row"><div class="grow"><span class="t">Issue № ${iss.number}</span>
      <div class="m">${escapeHtml(iss.status)}${iss.page_count ? ` · ${iss.page_count}pp` : ""}${iss.lulu_status ? ` · press: ${escapeHtml(iss.lulu_status)}` : ""}</div></div>
      <div class="links">${pdf ? `<a href="${pdf}">PDF</a>` : ""} ${cover ? `<a href="${cover}">cover</a>` : ""}</div></div>`;
  }));

  return htmlResponse(libShell(`
    <div class="fill"><div class="bar"><span style="width:${pct}%"></span></div>
      <div class="cap">${queued.length} article${queued.length === 1 ? "" : "s"} queued · ~${Math.round(est)} of ${user.page_cap} pages${pct >= 100 ? ` · ${fullNote}` : ""}</div>
    </div>
    ${rolledRows
      ? `<h2>In Issue № ${nextNumber}</h2>
    ${pickedRows}
    <h2>Rolling over to Issue № ${nextNumber + 1}</h2>
    <p class="m">These don't fit under the ${user.page_cap}-page cap, so they lead off the next issue instead.${queued.some((i) => i.needs_review) ? " Flagged items wait here too, until their parse is fixed." : ""}</p>
    ${rolledRows}`
      : `<h2>In the queue</h2>
    ${pickedRows || '<p class="m">Nothing yet. Go read something worth saving.</p>'}`}
    <h2>Issues</h2>
    ${issueRows.join("") || '<p class="m">None yet — your first fills the bar above.</p>'}
    <p class="m" style="margin-top:26px;">Save by email: <code>${escapeHtml(saveAddress(user))}</code></p>`));
}

async function queueItemPage(request, env) {
  const user = await libraryUser(request, env);
  if (!user) return htmlResponse(libShell("<p class='err'>This link isn't valid.</p>"), 404);
  const id = new URL(request.url).searchParams.get("id");
  const item = await env.DB.prepare("SELECT * FROM items WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!item) return htmlResponse(libShell("<p class='err'>No such item.</p>"), 404);

  return htmlResponse(libShell(`
    <a href="/queue?key=${user.library_key}">← back to the queue</a>
    <article class="preview">
      <h1>${escapeHtml(item.title)}</h1>
      <div class="m">${escapeHtml([item.site_name, item.byline].filter(Boolean).join(" · "))} · ~${item.estimated_pages}pp · this is how it will typeset</div>
      ${item.content_html}
    </article>`));
}

function libShell(inner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Your library — Dead Tree Digest</title>
<style>
  body { background: #f1e6cf; color: #2b2419; font-family: Georgia, serif; margin: 0; padding: 32px 16px 80px; display: flex; justify-content: center; }
  .card { max-width: 640px; width: 100%; }
  h1.masthead { font-family: Helvetica, Arial, sans-serif; font-size: 16px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 2.5px solid #2b2419; padding-bottom: 10px; margin: 0 0 22px; }
  h2 { font-family: Helvetica, Arial, sans-serif; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #14352a; margin: 30px 0 12px; }
  .fill .bar { height: 12px; border: 2px solid #2b2419; background: #faf3e3; }
  .fill .bar span { display: block; height: 100%; background: #1f4d38; }
  .fill .cap { font-family: 'Courier New', monospace; font-size: 12.5px; margin-top: 7px; color: #4a4032; }
  .row { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px dotted #a89877; }
  .grow { flex: 1; min-width: 0; }
  .t { font-weight: bold; font-size: 15px; color: inherit; text-decoration: none; }
  a.t:hover { color: #bf4e24; }
  .m { font-size: 12.5px; color: #6b5f4d; margin-top: 3px; }
  .warn { color: #bf4e24; font-weight: bold; }
  .links a, a { color: #bf4e24; }
  button { font-family: Helvetica, sans-serif; font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase; padding: 6px 10px; border: 1.5px solid #2b2419; background: #faf3e3; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  code { background: #faf3e3; border: 1px solid #cdb98f; padding: 2px 6px; font-size: 13px; }
  .err { color: #bf4e24; font-style: italic; }
  .preview { background: #faf3e3; border: 2.5px solid #2b2419; padding: 28px; margin-top: 18px; box-shadow: 6px 6px 0 rgba(31,77,56,0.2); }
  .preview h1 { font-size: 24px; line-height: 1.2; margin: 0 0 6px; }
  .preview p { text-align: justify; margin: 0 0 0; text-indent: 1.2em; font-size: 15px; line-height: 1.55; }
  .preview img { max-width: 100%; height: auto; filter: grayscale(1); }
  .preview .notes p { font-size: 12px; }
</style></head>
<body><div class="card"><h1 class="masthead">🌲 Your library</h1>${inner}</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Onboarding

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const corsPreflight = () => new Response(null, { status: 204, headers: CORS });
const corsJson = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// POST /signup { email } — mints a user (or re-welcomes an existing one,
// idempotently) and sends the welcome email with the magic setup link.
async function signup(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: "body must be JSON: { email }" }, 400);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsJson({ error: "that doesn't look like an email address" }, 400);
  }
  if (body.website) return corsJson({ ok: true }); // honeypot: bots fill hidden fields

  let user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  const requestedHandle = sanitizeHandle(body.handle);
  if (!user) {
    const id = "u_" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const saveToken = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const addressKey = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const setupKey = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(
      "INSERT INTO users (id, email, save_token, address_key, setup_key, signed_up_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, email, saveToken, addressKey, setupKey, new Date().toISOString())
      .run();
    user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  }

  // Vanity save address: requested handle, else derived from the email's
  // local part; collisions get digits; reserved names fall through to derived.
  if (!user.handle) {
    const candidates = [requestedHandle, sanitizeHandle(email.split("@")[0])].filter(Boolean);
    for (let base of candidates) {
      for (const attempt of [base, base + Math.floor(10 + Math.random() * 90)]) {
        const taken = await env.DB.prepare("SELECT 1 FROM users WHERE handle = ?").bind(attempt).first();
        if (!taken) {
          await env.DB.prepare("UPDATE users SET handle = ? WHERE id = ?").bind(attempt, user.id).run();
          user = { ...user, handle: attempt };
          break;
        }
      }
      if (user.handle) break;
    }
  }

  const setupUrl = `${new URL(request.url).origin}/setup?key=${user.setup_key}`;
  const sent = await sendWelcomeEmail(env, user, setupUrl);
  return corsJson({ ok: true, emailed: sent });
}

const RESERVED_HANDLES = new Set([
  "save", "press", "admin", "administrator", "info", "hello", "mail", "email",
  "postmaster", "hostmaster", "webmaster", "abuse", "noreply", "no-reply",
  "support", "billing", "legal", "privacy", "security", "root", "help",
  "contact", "team", "api", "www", "ledger", "setup", "test",
]);

function sanitizeHandle(raw) {
  if (!raw) return null;
  const h = String(raw).toLowerCase().trim().replace(/[^a-z0-9.-]/g, "").replace(/^[.-]+|[.-]+$/g, "").slice(0, 30);
  if (h.length < 3 || RESERVED_HANDLES.has(h)) return null;
  return h;
}

const saveAddress = (user) =>
  user.handle ? `${user.handle}@deadtreedigest.com` : `save-${user.email_key}@deadtreedigest.com`;

async function sendWelcomeEmail(env, user, setupUrl) {
  const text =
    `Welcome to Dead Tree Digest.\n\n` +
    `Your first issue starts building the moment you save your first article. Two minutes of setup:\n\n` +
    `${setupUrl}\n\n` +
    `That link installs your press credentials: the browser extension for saving, and where your issues should ship.\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px; margin-bottom: 20px;">🌲 Welcome to Dead Tree Digest</h2>
      <p style="margin: 0 0 26px;">Your first issue starts building the moment you save your first article. Setup takes about two minutes.</p>
      <p style="margin: 30px 0;"><a href="${setupUrl}" style="background:#1f4d38;color:#f1e6cf;padding:12px 22px;text-decoration:none;font-family:Helvetica,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;border:2px solid #2b2419;">Set up my press credentials</a></p>
      <p style="font-size:13px;color:#6b5f4d;font-style:italic;margin: 0 0 30px;">The link connects your saving extension and tells us where issues should ship. After that, you just read the internet like normal — and anything you'd rather forward, send to <strong>${saveAddress(user)}</strong>.</p>
      <p style="font-style: italic; color: #4a4032; margin: 0;">— Dead Tree Digest</p>
    </div>`;
  try {
    await env.EMAIL.send({
      to: user.email,
      from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
      subject: "Welcome to Dead Tree Digest — two minutes of setup",
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error(`welcome email failed: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Billing (Stripe Checkout + webhook). No SDK: two REST calls and an HMAC.

async function stripePost(env, path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message ?? `stripe ${path} failed (${res.status})`);
  return body;
}

// GET /subscribe?key=<setup_key> — create a Checkout session and bounce.
// Checkout collects the shipping address (US + CA) and phone, so for a
// paying user this replaces the /address step too.
async function subscribePage(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  const user = key
    ? await env.DB.prepare("SELECT * FROM users WHERE setup_key = ?").bind(key).first()
    : null;
  if (!user) return htmlResponse(setupShell("<p class='err'>This link isn't valid. Use the one from your welcome email.</p>"), 404);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return htmlResponse(setupShell("<p class='err'>Subscriptions aren't switched on yet. During the beta the operator flips the press by hand.</p>"), 503);
  }
  if (canPrint(user)) {
    return htmlResponse(setupShell(`<p>You're already active — the press prints when your queue fills. <a href="/setup?key=${user.setup_key}">Back to setup</a></p>`));
  }

  const origin = new URL(request.url).origin;
  const session = await stripePost(env, "checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    ...(user.stripe_customer_id
      ? { customer: user.stripe_customer_id }
      : { customer_email: user.email }),
    allow_promotion_codes: "true",
    "shipping_address_collection[allowed_countries][0]": "US",
    "shipping_address_collection[allowed_countries][1]": "CA",
    "phone_number_collection[enabled]": "true",
    success_url: `${origin}/setup?key=${user.setup_key}`,
    cancel_url: `${origin}/setup?key=${user.setup_key}`,
  });
  return Response.redirect(session.url, 303);
}

// Stripe-Signature: t=<ts>,v1=<hmac>[,v1=…] over `${t}.${payload}`.
async function verifyStripeSignature(payload, header, secret) {
  const parts = header.split(",").map((kv) => kv.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((sig) => {
    if (sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  });
}

async function sendAdminEmail(env, subject, text) {
  if (!env.ADMIN_EMAIL) return false;
  try {
    await env.EMAIL.send({
      to: env.ADMIN_EMAIL,
      from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
      subject, text,
    });
    return true;
  } catch (err) {
    console.error(`admin email failed: ${err.message}`);
    return false;
  }
}

// Subscription statuses that keep the press running. 'comped' is the
// operator's value (never written by the webhook — set it by hand for
// house accounts and gifts); past_due stays on (be forgiving mid-dunning)
// but alerts the operator.
const PRINTING_STATUSES = ["comped", "active", "trialing", "past_due"];
const canPrint = (user) => PRINTING_STATUSES.includes(user.subscription_status);

async function stripeWebhook(request, env) {
  const payload = await request.text();
  const ok =
    env.STRIPE_WEBHOOK_SECRET &&
    (await verifyStripeSignature(payload, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET));
  if (!ok) return json({ error: "bad signature" }, 400);

  const event = JSON.parse(payload);
  const obj = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    const user = obj.client_reference_id
      ? await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(obj.client_reference_id).first()
      : await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(obj.customer_details?.email?.toLowerCase() ?? "").first();
    if (!user) {
      await sendAdminEmail(env, "[DTD] Stripe checkout with no matching user", JSON.stringify(obj, null, 2).slice(0, 2000));
      return json({ received: true });
    }

    await env.DB.prepare(
      "UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, subscription_status = 'active' WHERE id = ?"
    ).bind(obj.customer, obj.subscription, user.id).run();

    // Checkout collected shipping + phone; persist it if it validates. A
    // rejected address isn't fatal (the address magic-link flow still
    // exists), it just gets flagged to the operator.
    const ship = obj.collected_information?.shipping_details ?? obj.shipping_details;
    if (ship?.address) {
      const result = validateAddress({
        name: ship.name,
        street1: ship.address.line1,
        street2: ship.address.line2,
        city: ship.address.city,
        state: ship.address.state,
        postcode: ship.address.postal_code,
        phone: obj.customer_details?.phone ?? "",
      });
      if (result.updated) await persistAddress(env, user.id, result.updated);
      else await sendAdminEmail(env, `[DTD] subscriber address needs a look: ${user.email}`, `Checkout address didn't validate (${result.error}). The user can fix it at the /address magic link.`);
    }

    await sendAdminEmail(env, `[DTD] new subscriber: ${user.email}`, `Subscription ${obj.subscription} is live. Press armed.`);
    return json({ received: true });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const status = event.type === "customer.subscription.deleted" ? "canceled" : obj.status;
    const printing = PRINTING_STATUSES.includes(status);
    const { meta } = await env.DB.prepare(
      "UPDATE users SET subscription_status = ? WHERE stripe_subscription_id = ?"
    ).bind(status, obj.id).run();
    if (meta.changes > 0 && (!printing || status === "past_due")) {
      await sendAdminEmail(env, `[DTD] subscription ${status}: ${obj.id}`, `Press is ${printing ? "still armed (dunning)" : "disarmed"}. Customer ${obj.customer}.`);
    }
    return json({ received: true });
  }

  if (event.type === "invoice.payment_failed") {
    await sendAdminEmail(env, "[DTD] payment failed", `Customer ${obj.customer}, invoice ${obj.id}, attempt ${obj.attempt_count}.`);
    return json({ received: true });
  }

  return json({ received: true });
}

// GET /setup?key=… — the onboarding page. Carries the save token in a data
// attribute; the extension's content script spots this page, stores the
// credentials, and flips the status to connected. No copy-pasting.
async function setupPage(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  const user = key
    ? await env.DB.prepare("SELECT * FROM users WHERE setup_key = ?").bind(key).first()
    : null;
  if (!user) return htmlResponse(setupShell("<p class='err'>This setup link isn't valid. Check the URL from your welcome email.</p>"), 404);

  const apiBase = new URL(request.url).origin;
  const addressDone = !!(user.ship_street1 && user.ship_city && user.ship_state && user.ship_postcode);
  const inner = `
    <div id="dtd-credentials" data-token="${escapeHtml(user.save_token)}" data-api="${escapeHtml(apiBase)}" data-email="${escapeHtml(user.email)}" style="display:none;"></div>
    <p class="who">Setting up the library of <strong>${escapeHtml(user.email)}</strong>. Not you? Close this page and use the setup link from your own welcome email.</p>
    <div class="step">
      <div class="n">1</div>
      <div>
        <strong>Install the saving extension</strong>
        <p>Chrome only for now. <a href="https://chromewebstore.google.com/detail/dead-tree-digest/ocpajbflahmfjalabcdodjapmcfalacb" target="_blank">Install it from the Chrome Web Store</a>, then come back to this page.</p>
      </div>
    </div>
    <div class="step">
      <div class="n">2</div>
      <div>
        <strong>Connect it</strong>
        <p id="connect-status" class="wait">Waiting for the extension… (install it, then reload this page)</p>
      </div>
    </div>
    <div class="step">
      <div class="n">3</div>
      <div>
        <strong>Tell us where issues ship</strong>
        <p>${addressDone ? "✓ We have your address on file." : `<a href="${apiBase}/address?key=${user.address_key}">Add your shipping address</a> — takes thirty seconds.`}</p>
      </div>
    </div>
    <div class="step">
      <div class="n">4</div>
      <div>
        <strong>Start your subscription</strong>
        <p>${canPrint(user)
          ? "✓ You're active — the press prints when your queue fills."
          : `$49 a month: printing, shipping, and the tree we plant, all included. <a href="${apiBase}/subscribe?key=${user.setup_key}">Subscribe</a> — there's a box for a code if you have one. Just finished? Give it a minute and reload.`}</p>
      </div>
    </div>
    <div class="step">
      <div class="n">5</div>
      <div>
        <strong>Go read the internet</strong>
        <p>Save anything worth keeping — one click in the extension, or forward any article or newsletter to your personal save address:</p>
        <p><code>${escapeHtml(saveAddress(user))}</code></p>
        <p>When you've saved about 100 pages worth, your issue prints itself and finds you. That's the whole system.</p>
        <p>Check on your queue anytime: <a href="${apiBase}/queue?key=${user.library_key}">your library</a> (bookmark it).</p>
      </div>
    </div>`;
  return htmlResponse(setupShell(inner));
}

function setupShell(inner) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dead Tree Digest — Setup</title>
<style>
  body { background: #f1e6cf; color: #2b2419; font-family: Georgia, serif; margin: 0; padding: 32px 16px; display: flex; justify-content: center; }
  .card { max-width: 520px; width: 100%; background: #faf3e3; border: 2.5px solid #2b2419; box-shadow: 6px 6px 0 rgba(31,77,56,0.25); padding: 28px; font-size: 15px; line-height: 1.55; }
  h1 { font-family: Helvetica, Arial, sans-serif; font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 2px solid #2b2419; padding-bottom: 8px; margin: 0 0 20px; }
  .step { display: flex; gap: 14px; margin-bottom: 20px; }
  .step .n { flex: none; width: 30px; height: 30px; border-radius: 50%; background: #1f4d38; color: #f1e6cf; border: 2px solid #2b2419; display: flex; align-items: center; justify-content: center; font-family: Helvetica, sans-serif; font-weight: bold; font-size: 14px; }
  .step p { margin: 4px 0 0; color: #4a4032; }
  a { color: #bf4e24; } code { background: #f1e6cf; padding: 1px 5px; font-size: 13px; }
  .wait { font-style: italic; }
  .who { background: #f1e6cf; border: 1.5px solid #cdb98f; padding: 10px 12px; font-size: 13.5px; margin: 0 0 20px; }
  .ok { color: #1f4d38; font-weight: bold; }
  .err { color: #bf4e24; font-style: italic; }
</style></head>
<body><div class="card"><h1>🌲 Press credentials</h1>${inner}</div></body></html>`;
}

// Re-run the current reader against the preserved raw capture — the payoff
// of keeping originals in R2: extractor fixes apply to old saves without
// re-saving. Keeps id, issue assignment, and status; refreshes the parse.
async function reparse(env, user, itemId) {
  const item = await env.DB.prepare("SELECT * FROM items WHERE id = ? AND user_id = ?")
    .bind(itemId, user.id)
    .first();
  if (!item) return json({ error: "item not found" }, 404);

  const raw = await env.RAW.get(item.raw_key);
  if (!raw) return json({ error: "raw capture missing" }, 410);

  const article = parseArticle({
    html: await raw.text(),
    url: item.url,
    source: item.source === "generic" ? null : item.source,
  });
  if (!article) return json({ error: "reparse produced nothing article-shaped" }, 422);

  await env.DB.prepare(
    `UPDATE items SET title=?, byline=?, site_name=?, published_at=?, excerpt=?,
       content_html=?, links_json=?, images_json=?, word_count=?, estimated_pages=?,
       needs_review=? WHERE id=?`
  )
    .bind(
      article.title, article.byline, article.siteName, article.publishedAt, article.excerpt,
      article.contentHtml, JSON.stringify(article.links), JSON.stringify(article.images),
      article.wordCount, article.estimatedPages, article.needsReview ? 1 : 0, itemId
    )
    .run();

  return json({
    id: itemId,
    title: article.title,
    byline: article.byline,
    siteName: article.siteName,
    publishedAt: article.publishedAt,
    wordCount: article.wordCount,
    estimatedPages: article.estimatedPages,
    needsReview: article.needsReview,
  });
}

// The "this didn't parse right" button. Flagging holds the item out of the
// pack (closer skips needs_review) and tells the operator, whose reparse is
// currently the only repair path.
async function flag(env, user, itemId, ctx) {
  const res = await env.DB.prepare(
    "UPDATE items SET needs_review = 1 WHERE id = ? AND user_id = ?"
  )
    .bind(itemId, user.id)
    .run();
  if (res.meta.changes === 0) return json({ error: "item not found" }, 404);
  ctx?.waitUntil(sendFlagAlert(env, user, itemId));
  return json({ ok: true, id: itemId, needsReview: true });
}

async function sendFlagAlert(env, user, itemId) {
  const item = await env.DB.prepare("SELECT title, url, source FROM items WHERE id = ?").bind(itemId).first();
  await sendAdminEmail(
    env,
    `[DTD] parse flagged: ${item?.title ?? itemId}`,
    `${user.email} flagged "${item?.title ?? "?"}" (source: ${item?.source ?? "?"}).\n` +
      `${item?.url ?? "(email save, no url)"}\n\n` +
      `The item is held out of the pack until fixed. After an extractor fix:\n` +
      `curl -s -X POST https://api.deadtreedigest.com/items/${itemId}/reparse -H "Authorization: Bearer ${user.save_token}"`
  );
}
