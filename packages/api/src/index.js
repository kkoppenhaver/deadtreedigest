// dtd-api: the library core. Clients (Chrome extension, email worker, curl)
// POST raw captures here; articles come out normalized, page-estimated, and
// queued for the next issue. The raw capture is retained in R2 so flagged
// items can be re-parsed after extractor fixes without re-saving.

import { parseArticle } from "@dtd/reader";
import { verifyKey } from "./sign.js";

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

    // Public onboarding: the homepage form posts here (CORS-open), the
    // welcome email links to /setup.
    if (pathname === "/signup") {
      if (request.method === "OPTIONS") return corsPreflight();
      if (request.method === "POST") return signup(request, env);
    }
    if (request.method === "GET" && pathname === "/setup") {
      return setupPage(request, env);
    }

    // Magic-link address page: key-authed (emailed URL), browser-facing,
    // handled before the bearer gate. The key is scoped to the address only.
    if (pathname === "/address") {
      return addressPage(request, env);
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
      return flag(env, user, pathname.split("/")[2]);
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
    queued: results,
    queuedCount: results.length,
    queuedPages: Math.round(queuedPages * 10) / 10,
    capRemaining: Math.round((user.page_cap - queuedPages) * 10) / 10,
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

// Normalizes to Lulu's picky formats: 2-letter state, "+1 XXX XXX XXXX" phone.
// Returns { error } or { updated } (column map ready to persist).
function validateAddress(a) {
  if (!a || typeof a !== "object") return { error: "address object is required" };

  let state = (a.state ?? "").trim();
  state = state.length === 2 ? state.toUpperCase() : US_STATES[state.toLowerCase()] ?? null;
  if (!state || !Object.values(US_STATES).includes(state))
    return { error: "state must be a US state (2-letter code or full name)" };

  const phoneDigits = (a.phone ?? "").replace(/\D/g, "").replace(/^1/, "");
  if (phoneDigits.length !== 10) return { error: "phone must be a 10-digit US number" };
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
      ship_country: "US",
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
        <label>State <input name="state" value="${v("state")}" placeholder="IL" required></label>
      </div>
      <div class="row">
        <label>ZIP <input name="postcode" value="${v("postcode")}" required></label>
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

  const setupUrl = `${new URL(request.url).origin}/setup?key=${user.setup_key}`;
  const sent = await sendWelcomeEmail(env, user, setupUrl);
  return corsJson({ ok: true, emailed: sent });
}

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
      <p style="font-size:13px;color:#6b5f4d;font-style:italic;margin: 0 0 30px;">The link connects your saving extension and tells us where issues should ship. After that, you just read the internet like normal.</p>
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
    <div id="dtd-credentials" data-token="${escapeHtml(user.save_token)}" data-api="${escapeHtml(apiBase)}" style="display:none;"></div>
    <div class="step">
      <div class="n">1</div>
      <div>
        <strong>Install the saving extension</strong>
        <p>Chrome only for now. During the beta it installs from source: <a href="https://github.com/kkoppenhaver/deadtreedigest" target="_blank">grab it here</a>, then load <code>packages/extension</code> via chrome://extensions → Load unpacked.</p>
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
        <strong>Go read the internet</strong>
        <p>Save anything worth keeping — one click in the extension, or forward any article or newsletter to your personal save address:</p>
        <p><code>save-${escapeHtml(user.email_key)}@deadtreedigest.com</code></p>
        <p>When you've saved about 100 pages worth, your issue prints itself and finds you. That's the whole system.</p>
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

// The "this didn't parse right" button.
async function flag(env, user, itemId) {
  const res = await env.DB.prepare(
    "UPDATE items SET needs_review = 1 WHERE id = ? AND user_id = ?"
  )
    .bind(itemId, user.id)
    .run();
  if (res.meta.changes === 0) return json({ error: "item not found" }, 404);
  return json({ ok: true, id: itemId, needsReview: true });
}
