// dtd-closer: print-when-full (decided 2026-07-16). An issue closes when the
// queue's estimated pages reach the user's page_cap — but never sooner than
// min_interval_days after the last close (the cost guard: at the default 14
// days, worst-case COGS equals the modeled biweekly economics). No thin
// issues, no skip cycles, no nudges: an unfilled queue just keeps filling
// quietly until it is full.
//
// Triggers:
//   - POST /check (bearer save_token): close if full + eligible. Called by
//     dtd-api after every save — this is what makes "you filled your issue"
//     land the moment it happens.
//   - daily cron: same check for every user (catches interval windows opening
//     while nobody saves).
//   - POST /run (bearer save_token): force-close whatever is queued. Test lever.

import { issueHtml, coverHtml } from "@dtd/typeset";
import {
  findSpot, geocode, reverseGeocode, mapLayers, renderSpotMap,
  directionsQr, footRoute, formatDirections, computeFrame,
  routeLandmarks, annotateDirections,
} from "@dtd/spots";
import { createPrintJob, getPrintJob } from "./lulu.js";
import { plantTrees, TREES_PER_ISSUE } from "./trees.js";
import { signedFileUrl } from "../../api/src/sign.js";
import pagedJs from "./paged.polyfill.txt";

// The page estimator runs ~15% under real renders (measured in the render spike).
const ESTIMATE_MARGIN = 1.15;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).valueOf()) / 86_400_000 : Infinity);

// Who the press prints for: paying subscriptions in good standing (the api
// worker's Stripe webhook maintains the status) plus operator-comped
// accounts ('comped' is only ever set by hand).
const canPrint = (user) =>
  ["comped", "active", "trialing", "past_due"].includes(user.subscription_status);

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sweep(env));
  },

  async fetch(request, env) {
    // Browser-facing magic link — key-authed, ahead of the bearer gate.
    if (request.method === "GET" && new URL(request.url).pathname === "/approve") {
      try {
        return await approve(request, env);
      } catch (err) {
        return page(`Something went wrong sending this to print: ${err.message}`, 500);
      }
    }

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = token
      ? await env.DB.prepare("SELECT * FROM users WHERE save_token = ?").bind(token).first()
      : null;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { pathname } = new URL(request.url);
    try {
      if (request.method === "POST" && pathname === "/check") {
        return json(await checkUser(user, env));
      }
      if (request.method === "POST" && pathname === "/run") {
        // Test lever: does NOT auto-print unless ?print=1 — forcing a close
        // must never quietly spend money.
        const autoPrint = new URL(request.url).searchParams.get("print") === "1";
        return json(await closeForUser(user, env, null, { autoPrint }));
      }
      if (request.method === "POST" && pathname === "/rerender") {
        const number = Number(new URL(request.url).searchParams.get("issue"));
        return json(await rerenderIssue(user, env, number));
      }
      if (request.method === "POST" && pathname === "/poll-status") {
        const { results: users } = await env.DB.prepare("SELECT * FROM users").all();
        const { results: before } = await env.DB.prepare(
          "SELECT number, lulu_status FROM issues WHERE status = 'sent_to_print'"
        ).all();
        // Trees owed: printed issues that haven't planted yet (transient failures).
  const { results: owed } = await env.DB.prepare(
    "SELECT * FROM issues WHERE lulu_job_id IS NOT NULL AND trees_planted IS NULL"
  ).all();
  for (const issue of owed) {
    try {
      const planted = await plantTrees(env, { userId: issue.user_id });
      await env.DB.prepare("UPDATE issues SET trees_planted = ?, tree_request_id = ? WHERE id = ?")
        .bind(planted.treeCount ?? TREES_PER_ISSUE, planted.uuid ?? null, issue.id)
        .run();
      console.log(`planted owed trees for issue ${issue.number}`);
    } catch (err) {
      console.error(`owed-tree retry failed for issue ${issue.number}: ${err.message}`);
    }
  }

  await pollPrintJobs(env, users);
        const { results: after } = await env.DB.prepare(
          "SELECT number, status, lulu_status, tracking_url FROM issues WHERE lulu_job_id IS NOT NULL"
        ).all();
        return json({ polled: before.length, jobs: after });
      }
      if (request.method === "POST" && pathname === "/email-test") {
        const sent = await sendEmail(
          env,
          user.email,
          "Dead Tree Digest — the presses have a voice",
          "This is the email pipeline's first breath. If you're reading this on paper, something has gone wonderfully wrong.\n\n— Dead Tree Digest",
          `<div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
             <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">The presses have a voice</h2>
             <p>This is the email pipeline's first breath. If you're reading this on paper, something has gone wonderfully wrong.</p>
             <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
           </div>`
        );
        return json({ sent, to: user.email, from: env.FROM_EMAIL });
      }
    } catch (err) {
      return json({ error: err.message }, 500);
    }
    return json({ error: "POST /check, /run, or /rerender?issue=N" }, 404);
  },
};

const hasAddress = (user) =>
  !!(user.ship_name && user.ship_street1 && user.ship_city && user.ship_state && user.ship_postcode && user.ship_phone);

// Create the Lulu job and advance issue/items state. Shared by the auto-print
// path (close + cron retry) and the manual /approve lever.
async function printIssue(env, issue, user) {
  const interiorUrl = await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, issue.pdf_key);
  const coverUrl = await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, issue.cover_key);
  const job = await createPrintJob(env, { issue, user, interiorUrl, coverUrl });

  await env.DB.prepare(
    "UPDATE issues SET status = 'sent_to_print', lulu_job_id = ?, approved_at = ? WHERE id = ?"
  )
    .bind(String(job.id), new Date().toISOString(), issue.id)
    .run();
  await env.DB.prepare("UPDATE items SET status = 'printed' WHERE issue_id = ?").bind(issue.id).run();

  // A tree, planted in the subscriber's name. Failures never block a
  // print — the daily sweep retries any issue with a job but no trees.
  // Guard: a canceled-and-reprinted issue must not plant twice.
  if (issue.trees_planted) return job;
  try {
    const planted = await plantTrees(env, { userId: user.id });
    await env.DB.prepare("UPDATE issues SET trees_planted = ?, tree_request_id = ? WHERE id = ?")
      .bind(planted.treeCount ?? TREES_PER_ISSUE, planted.uuid ?? null, issue.id)
      .run();
  } catch (err) {
    console.error(`tree planting failed for issue ${issue.number ?? issue.id}: ${err.message}`);
  }
  return job;
}

// GET /approve?key=… — manual print trigger. Issues auto-print on close now
// (decided 2026-07-16); this remains as the lever for parked issues
// ('awaiting_approval') and as a retry when auto-print hit a snag.
async function approve(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  const issue = key
    ? await env.DB.prepare("SELECT * FROM issues WHERE approve_key = ?").bind(key).first()
    : null;
  if (!issue) return page("That approval link isn't valid.", 404);

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(issue.user_id).first();

  if (issue.lulu_job_id) {
    return page(
      `Issue № ${issue.number} is already at the printer (job ${issue.lulu_job_id}). Nothing more to do.`
    );
  }
  if (!["rendered", "awaiting_approval"].includes(issue.status)) {
    return page(`Issue № ${issue.number} isn't ready to print (status: ${issue.status}).`);
  }
  if (!issue.cover_key) return page(`Issue № ${issue.number} has no cover PDF yet — can't print.`);

  if (!hasAddress(user)) {
    return page(
      `We need your shipping address first. <a href="${env.API_URL}/address?key=${user.address_key}">Add it here</a>, then come back to this link.`
    );
  }

  const job = await printIssue(env, issue, user);
  return page(
    `🌲 <strong>Issue № ${issue.number} is off to the printer.</strong><br><br>
     Lulu job <code>${job.id}</code> (status: ${job.status?.name ?? "created"}).<br>
     ${issue.page_count} pages, shipping US Mail to ${user.ship_city}, ${user.ship_state}.<br><br>
     ${issue.trees_planted
       ? `<em>Your tree${issue.trees_planted === 1 ? " was" : "s were"} already planted for this issue.</em>`
       : `<em>A tree is being planted in your name.</em>`}`
  );
}

function page(inner, status = 200) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Dead Tree Digest</title>
<style>
  body { background: #f1e6cf; color: #2b2419; font-family: Georgia, serif; margin: 0; padding: 32px 16px; display: flex; justify-content: center; }
  .card { max-width: 440px; background: #faf3e3; border: 2.5px solid #2b2419; box-shadow: 6px 6px 0 rgba(31,77,56,0.25); padding: 26px; font-size: 15px; line-height: 1.55; }
  h1 { font-family: Helvetica, Arial, sans-serif; font-size: 14px; letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 2px solid #2b2419; padding-bottom: 8px; margin: 0 0 14px; }
  a { color: #bf4e24; } code { background: #f1e6cf; padding: 1px 5px; }
</style></head>
<body><div class="card"><h1>🌲 Dead Tree Digest</h1>${inner}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function sweep(env) {
  const { results: users } = await env.DB.prepare("SELECT * FROM users").all();
  for (const user of users) {
    try {
      await checkUser(user, env);
    } catch (err) {
      console.error(`check failed for ${user.id}: ${err.message}`);
    }
  }

  // Auto-print retry: 'rendered' issues that couldn't print at close time
  // (missing address, transient Lulu failure) go to the press as soon as
  // they can. Parked issues ('awaiting_approval') are exempt — those wait
  // for their manual /approve link.
  const { results: pending } = await env.DB.prepare(
    "SELECT * FROM issues WHERE status = 'rendered' AND lulu_job_id IS NULL AND cover_key IS NOT NULL"
  ).all();
  for (const issue of pending) {
    const user = users.find((u) => u.id === issue.user_id);
    if (!user || !canPrint(user) || !hasAddress(user)) continue;
    try {
      await printIssue(env, issue, user);
      console.log(`auto-printed pending issue ${issue.number} for ${user.id}`);
    } catch (err) {
      console.error(`auto-print retry failed for issue ${issue.number}: ${err.message}`);
    }
  }

  await pollPrintJobs(env, users);
}

// Lulu jobs fail asynchronously (file validation, payment, production) —
// and in the full-surprise model, a silently dead job looks identical to a
// magazine in transit. Poll active jobs daily; alert the OPERATOR (never the
// user) on bad or stuck states; record SHIPPED quietly.
const BAD_LULU_STATUSES = new Set(["REJECTED", "CANCELED", "ERROR"]);
const STUCK_AFTER_HOURS = 24; // UNPAID/PAYMENT_IN_PROGRESS longer than this = payment problem

async function pollPrintJobs(env, users) {
  const { results: active } = await env.DB.prepare(
    "SELECT * FROM issues WHERE status = 'sent_to_print' AND lulu_job_id IS NOT NULL"
  ).all();

  for (const issue of active) {
    const user = users.find((u) => u.id === issue.user_id);
    try {
      const job = await getPrintJob(env, issue.lulu_job_id);
      const status = job.status?.name ?? "UNKNOWN";
      const message = job.status?.message ?? "";
      const now = new Date().toISOString();
      const tracking = job.line_items?.flatMap((li) => li.tracking_urls ?? [])[0] ?? null;

      if (status !== issue.lulu_status) {
        await env.DB.prepare(
          "UPDATE issues SET lulu_status = ?, lulu_status_at = ?, tracking_url = COALESCE(?, tracking_url) WHERE id = ?"
        )
          .bind(status, now, tracking, issue.id)
          .run();
      }

      if (status === "SHIPPED") {
        await env.DB.prepare("UPDATE issues SET status = 'shipped', shipped_at = ? WHERE id = ?")
          .bind(now, issue.id)
          .run();
        console.log(`issue ${issue.number} shipped (job ${issue.lulu_job_id})`);
        continue;
      }

      const stuckUnpaid =
        ["UNPAID", "PAYMENT_IN_PROGRESS"].includes(status) &&
        (Date.now() - new Date(issue.approved_at ?? issue.closed_at).valueOf()) / 3_600_000 > STUCK_AFTER_HOURS;

      if ((BAD_LULU_STATUSES.has(status) || stuckUnpaid) && issue.alerted_status !== status) {
        if (BAD_LULU_STATUSES.has(status)) {
          await env.DB.prepare("UPDATE issues SET status = 'print_failed' WHERE id = ?").bind(issue.id).run();
        }
        await sendStatusAlert(env, user, issue, { status, message, stuckUnpaid });
        await env.DB.prepare("UPDATE issues SET alerted_status = ? WHERE id = ?").bind(status, issue.id).run();
      }
    } catch (err) {
      console.error(`status poll failed for issue ${issue.number}: ${err.message}`);
    }
  }
}

function sendGateReviewEmail(env, user, queued, est) {
  const titles = queued.slice(0, 20).map((q) => `  • ${q.title}`).join("\n");
  const flipCmd = `npx wrangler d1 execute dtd-library --remote -c packages/api/wrangler.jsonc --command "UPDATE users SET subscription_status = 'comped' WHERE email = '${user.email}'"`;
  const text =
    `${user.email} filled an issue (${queued.length} items, ~${round1(est)}pp est) and is waiting at the print gate.\n\n` +
    `Signed up: ${user.signed_up_at ?? "unknown"}\nAddress on file: ${hasAddress(user) ? "yes" : "no"}\n\nQueue:\n${titles}\n\n` +
    `Approve them:\n${flipCmd}\n\nTheir issue closes and prints on their next save or tomorrow's sweep.\n\n— dtd-closer`;
  const html = `
    <div style="font-family: 'Courier New', monospace; color: #2b2419; max-width: 44em; font-size: 13px;">
      <p><strong>🌲 Print gate:</strong> ${escapeHtml(user.email)} filled an issue — ${queued.length} items, ~${round1(est)}pp estimated.</p>
      <p>Signed up: ${escapeHtml(user.signed_up_at ?? "unknown")} · Address on file: ${hasAddress(user) ? "yes" : "no"}</p>
      <ul>${queued.slice(0, 20).map((q) => `<li>${escapeHtml(q.title)}</li>`).join("")}</ul>
      <p>Approve them:</p>
      <p style="background:#f1e6cf;border:1px solid #2b2419;padding:8px 12px;word-break:break-all;">${escapeHtml(flipCmd)}</p>
      <p>Their issue closes and prints on their next save or tomorrow's sweep.</p>
    </div>`;
  return sendEmail(env, env.ADMIN_EMAIL, `[DTD] print gate: ${user.email} filled an issue`, text, html);
}

function sendStatusAlert(env, user, issue, { status, message, stuckUnpaid }) {
  const headline = stuckUnpaid
    ? `stuck in ${status} for ${STUCK_AFTER_HOURS}h+ — check the payment method on the Lulu account`
    : `entered ${status}`;
  const text =
    `Lulu job ${issue.lulu_job_id} (issue № ${issue.number}, ${user?.email ?? issue.user_id}) ${headline}.\n\n` +
    `${message ? `Lulu says: ${message}\n\n` : ""}` +
    `Dashboard: https://developers.lulu.com\n\n— dtd-closer`;
  const html = `
    <div style="font-family: 'Courier New', monospace; color: #2b2419; max-width: 40em; font-size: 13px;">
      <p><strong>⚠ Print job ${escapeHtml(status)}</strong> — issue № ${issue.number} for ${escapeHtml(user?.email ?? issue.user_id)} (job ${escapeHtml(String(issue.lulu_job_id))})</p>
      ${stuckUnpaid ? `<p>Stuck ${STUCK_AFTER_HOURS}h+ — likely no payment method on the Lulu account.</p>` : ""}
      ${message ? `<p style="background:#f1e6cf;border:1px solid #bf4e24;padding:8px 12px;">${escapeHtml(message)}</p>` : ""}
      <p><a href="https://developers.lulu.com">Lulu dashboard</a></p>
    </div>`;
  return sendEmail(env, env.ADMIN_EMAIL, `[DTD] print job ${status}: issue ${issue.number}`, text, html);
}

async function checkUser(user, env) {
  const queued = await queuedItems(user, env);
  // Flagged items are on hold: a user said the parse is broken, so they
  // neither fill the issue nor print until the operator reparses them.
  const printable = queued.filter((i) => !i.needs_review);
  const est = printable.reduce((s, i) => s + i.estimated_pages * ESTIMATE_MARGIN, 0);
  const full = est >= user.page_cap;
  const sinceClose = daysSince(user.last_closed_at);
  const eligible = sinceClose >= user.min_interval_days;

  // The print gate: without an active subscription (or a comped status set
  // by the operator) issues never close — the queue holds, nothing renders,
  // nothing prints, and the operator gets one review email.
  if (full && eligible && !canPrint(user)) {
    let emailed = false;
    if (!user.gate_alerted_at) {
      emailed = await sendGateReviewEmail(env, user, queued, est);
      await env.DB.prepare("UPDATE users SET gate_alerted_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), user.id)
        .run();
    }
    return { action: "gated", queuedPages: round1(est), cap: user.page_cap, emailed };
  }

  if (full && eligible) return closeForUser(user, env, queued);

  return {
    action: "waiting",
    queuedPages: round1(est),
    cap: user.page_cap,
    full,
    eligible,
    daysUntilEligible: eligible ? 0 : Math.ceil(user.min_interval_days - sinceClose),
  };
}

// Find a Bench, print surface: geocode the shipping address (cached on the
// user row, cleared by the api on address change), pick a spot this user
// hasn't been sent before. Returns null on ANY failure — the spot page is a
// bonus; it is never a reason an issue doesn't print.
async function issueSpot(env, user) {
  try {
    let lat = user.geo_lat;
    let lng = user.geo_lng;
    if (lat == null || lng == null) {
      if (!hasAddress(user)) return null;
      const geo = await geocode(
        `${user.ship_street1}, ${user.ship_city}, ${user.ship_state} ${user.ship_postcode}`
      );
      if (!geo) return null;
      ({ lat, lng } = geo);
      await env.DB.prepare("UPDATE users SET geo_lat = ?, geo_lng = ? WHERE id = ?")
        .bind(lat, lng, user.id)
        .run();
    }
    const { results: prior } = await env.DB.prepare(
      "SELECT osm_id FROM printed_spots WHERE user_id = ?"
    ).bind(user.id).all();
    const found = await findSpot({
      lat, lng,
      home: { lat, lng }, // journey framing + turn-by-turn from the front door
      exclude: prior.map((p) => p.osm_id),
      apiKey: env.ANTHROPIC_API_KEY ?? null,
    });
    if (!found) return null;
    return {
      copy: found.copy,
      svg: found.svg,
      directions: found.directions,
      qr: directionsQr(found.spot.lat, found.spot.lng),
      spot: found.spot,
    };
  } catch (err) {
    console.error(`spot page skipped: ${err.message}`);
    return null;
  }
}

async function closeForUser(user, env, queued = null, { autoPrint = true } = {}) {
  queued ??= await queuedItems(user, env);
  if (queued.length === 0) return { action: "nothing-queued" };

  // Greedy pack against the cap; overflow seeds the next issue. Flagged
  // items are skipped entirely — a known-broken parse never goes to print.
  const picked = [];
  let est = 0;
  for (const item of queued) {
    if (item.needs_review) continue;
    const cost = item.estimated_pages * ESTIMATE_MARGIN;
    if (picked.length > 0 && est + cost > user.page_cap) continue;
    picked.push(item);
    est += cost;
  }
  if (picked.length === 0) return { action: "nothing-printable" };
  const rolledOver = queued.length - picked.length;

  const number =
    ((await env.DB.prepare("SELECT MAX(number) AS n FROM issues WHERE user_id = ?").bind(user.id).first())
      ?.n ?? 0) + 1;

  // Render EVERYTHING before touching the database: a failed render must
  // leave no orphaned issue rows or assigned items behind.
  const articles = picked.map((i) => ({
    title: i.title,
    byline: i.byline,
    siteName: i.site_name,
    publishedAt: i.published_at,
    excerpt: i.excerpt,
    contentHtml: i.content_html,
    estimatedPages: i.estimated_pages,
  }));
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const spot = await issueSpot(env, user);
  const interior = await renderPdf(
    env,
    issueHtml({ number, dateLabel, articles, spot }, { pagedJs })
  );
  const pageCount = interior.pages;

  let cover = null;
  if (pageCount) {
    try {
      const past = await env.DB.prepare(
        "SELECT COALESCE(SUM(trees_planted), 0) AS t FROM issues WHERE user_id = ?"
      ).bind(user.id).first();
      cover = await renderPdf(
        env,
        coverHtml({
          number, dateLabel, pageCount, articleCount: picked.length,
          treesTotal: (past?.t ?? 0) + TREES_PER_ISSUE,
        })
      );
    } catch (err) {
      console.error(`cover render failed: ${err.message}`); // interior still ships to review
    }
  }

  const pdfKey = `issues/${user.id}/issue-${number}.pdf`;
  await env.RAW.put(pdfKey, interior.pdf, { httpMetadata: { contentType: "application/pdf" } });
  let coverKey = null;
  if (cover) {
    coverKey = `issues/${user.id}/issue-${number}-cover.pdf`;
    await env.RAW.put(coverKey, cover.pdf, { httpMetadata: { contentType: "application/pdf" } });
  }

  const issueId = crypto.randomUUID();
  const approveKey = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO issues (id, user_id, number, status, page_count, pdf_key, cover_key, approve_key, closed_at) VALUES (?, ?, ?, 'rendered', ?, ?, ?, ?, ?)"
  )
    .bind(issueId, user.id, number, pageCount, pdfKey, coverKey, approveKey, now)
    .run();
  for (const item of picked) {
    await env.DB.prepare("UPDATE items SET issue_id = ?, status = 'assigned' WHERE id = ?")
      .bind(issueId, item.id)
      .run();
  }
  // Recorded only after the successful render + issue insert (consistent
  // with renders-before-DB-writes): this is the no-repeat exclusion list,
  // and over years, a slow tour of everywhere near you.
  if (spot) {
    await env.DB.prepare(
      `INSERT INTO printed_spots (id, user_id, issue_id, osm_id, kind, name, lat, lng, copy, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(), user.id, issueId, spot.spot.osmId, spot.spot.kind,
        spot.spot.name, spot.spot.lat, spot.spot.lng, spot.copy, now
      )
      .run();
  }
  await env.DB.prepare("UPDATE users SET last_closed_at = ? WHERE id = ?").bind(now, user.id).run();

  // Auto-approve + full surprise (decided 2026-07-16): the issue goes to the
  // press the moment it's rendered, and when everything works NOBODY gets an
  // email — the magazine's arrival is the notification. Email exists only for
  // exceptions: the user when we can't print without their address, the
  // operator when the print run fails.
  let job = null;
  let emailed = false;
  if (autoPrint && coverKey && hasAddress(user)) {
    try {
      job = await printIssue(
        env,
        { id: issueId, number, pdf_key: pdfKey, cover_key: coverKey, page_count: pageCount },
        user
      );
    } catch (err) {
      console.error(`auto-print failed for issue ${number}: ${err.message}`);
      emailed = await sendPrintFailureAlert(env, user, { number, pageCount, approveKey, error: err.message });
    }
  } else if (autoPrint && !hasAddress(user)) {
    emailed = await sendAddressNeededEmail(env, user, { number });
  }

  return {
    action: "closed",
    issue: number,
    items: picked.length,
    rolledOver,
    estimatedPages: round1(est),
    renderedPages: pageCount,
    pdfKey,
    coverKey,
    luluJob: job ? String(job.id) : null,
    emailed,
  };
}

// Re-typeset an existing issue from its (possibly re-parsed) items and
// overwrite its PDFs — the tail end of the raw-capture re-parse loop.
// Refuses issues already at the printer.
async function rerenderIssue(user, env, number) {
  const issue = await env.DB.prepare("SELECT * FROM issues WHERE user_id = ? AND number = ?")
    .bind(user.id, number)
    .first();
  if (!issue) return { error: `no issue № ${number}` };
  if (issue.lulu_job_id) return { error: `issue № ${number} is already at the printer` };

  const { results: items } = await env.DB.prepare(
    "SELECT * FROM items WHERE issue_id = ? ORDER BY created_at"
  )
    .bind(issue.id)
    .all();
  if (items.length === 0) return { error: "issue has no items" };

  const articles = items.map((i) => ({
    title: i.title,
    byline: i.byline,
    siteName: i.site_name,
    publishedAt: i.published_at,
    excerpt: i.excerpt,
    contentHtml: i.content_html,
    estimatedPages: i.estimated_pages,
  }));
  const dateLabel = new Date(issue.closed_at ?? Date.now()).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  // A rerender keeps the issue's recorded spot (same pick, fresh map) —
  // choosing a new one here would burn an exclusion the user never saw.
  let spot = null;
  const rec = await env.DB.prepare("SELECT * FROM printed_spots WHERE issue_id = ?")
    .bind(issue.id)
    .first();
  if (rec) {
    try {
      const recSpot = { lat: rec.lat, lng: rec.lng };
      const home = user.geo_lat != null && user.geo_lng != null
        ? { lat: user.geo_lat, lng: user.geo_lng }
        : null;
      let route = null;
      let directions = [];
      if (home) {
        try {
          route = await footRoute(home, recSpot);
          if (route) {
            directions = formatDirections(route, rec.name ?? "Your spot");
            if (env.ANTHROPIC_API_KEY && directions.length) {
              const landmarks = await routeLandmarks(route.geometry).catch(() => []);
              if (landmarks.length) {
                directions = await annotateDirections({ directions, landmarks, apiKey: env.ANTHROPIC_API_KEY });
              }
            }
          }
        } catch (err) {
          console.error(`rerender routing skipped: ${err.message}`);
        }
      }
      const frame = computeFrame({ spot: recSpot, home: route ? home : null, route });
      const layers = await mapLayers({ lat: frame.lat, lng: frame.lng, spanMeters: frame.spanMeters });
      const addr = await reverseGeocode(rec.lat, rec.lng).catch(() => null);
      spot = {
        copy: rec.copy,
        svg: renderSpotMap({
          spot: recSpot,
          layers,
          frame,
          home: route ? home : null,
          route,
          label: { title: rec.name ?? `a ${rec.kind ?? "spot"}`, sub: addr?.short ?? null },
        }),
        directions,
        qr: directionsQr(rec.lat, rec.lng),
      };
    } catch (err) {
      console.error(`rerender spot skipped: ${err.message}`);
    }
  }

  const interior = await renderPdf(
    env,
    issueHtml({ number, dateLabel, articles, spot }, { pagedJs })
  );
  const pageCount = interior.pages;
  const past = await env.DB.prepare(
    "SELECT COALESCE(SUM(trees_planted), 0) AS t FROM issues WHERE user_id = ?"
  ).bind(user.id).first();
  const cover = await renderPdf(
    env,
    coverHtml({
      number, dateLabel, pageCount, articleCount: items.length,
      treesTotal: Math.max(past?.t ?? 0, TREES_PER_ISSUE),
    })
  );

  await env.RAW.put(issue.pdf_key, interior.pdf, { httpMetadata: { contentType: "application/pdf" } });
  const coverKey = issue.cover_key ?? `issues/${user.id}/issue-${number}-cover.pdf`;
  await env.RAW.put(coverKey, cover.pdf, { httpMetadata: { contentType: "application/pdf" } });
  await env.DB.prepare("UPDATE issues SET page_count = ?, cover_key = ? WHERE id = ?")
    .bind(pageCount, coverKey, issue.id)
    .run();

  return { action: "rerendered", issue: number, items: items.length, renderedPages: pageCount, pdfKey: issue.pdf_key, coverKey };
}

// Render via service binding (same-account workers.dev URLs can't be fetched
// directly). Browser Rendering's free tier allows one new browser per 20s, and
// a close needs two renders (interior + cover), so retry across the window.
async function renderPdf(env, html, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 22_000));
    try {
      const res = await env.RENDER.fetch("https://render/", { method: "POST", body: html });
      if (res.ok) {
        return { pdf: await res.arrayBuffer(), pages: Number(res.headers.get("x-pages")) || null };
      }
      lastErr = new Error(`render failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function queuedItems(user, env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM items WHERE user_id = ? AND status = 'queued' ORDER BY created_at"
  )
    .bind(user.id)
    .all();
  return results;
}

const round1 = (n) => Math.round(n * 10) / 10;

async function sendEmail(env, to, subject, text, html) {
  try {
    await env.EMAIL.send({
      to,
      from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    // Email Sending not onboarded yet (or transient failure): the pipeline
    // still runs; the notice just doesn't go out.
    console.error(`email failed: ${err.message}`);
    return false;
  }
}

// The one routine-adjacent user email: we literally cannot ship without an
// address. Deliberately says nothing about the issue's contents — the
// magazine itself is the reveal.
function sendAddressNeededEmail(env, user, { number }) {
  const addressUrl = `${env.API_URL}/address?key=${user.address_key}`;
  const text =
    `Issue № ${number} is printed and ready to ship — we just don't know where to send it.\n\n` +
    `Add your shipping address here: ${addressUrl}\n\n` +
    `It heads to the press automatically the moment that's filled in.\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">Where should Issue № ${number} go?</h2>
      <p>Your issue is typeset and ready — we just don't know where to send it.</p>
      <p style="background:#f1e6cf;border:2px solid #bf4e24;padding:10px 14px;"><a href="${addressUrl}" style="color:#bf4e24;"><strong>Add your shipping address</strong></a> — it heads to the press automatically the moment that's in.</p>
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `Where should Issue № ${number} go?`, text, html);
}

// Operator alert, not a user email: print failures go to ADMIN_EMAIL with
// the details and the manual print lever. The cron retries daily regardless.
function sendPrintFailureAlert(env, user, { number, pageCount, approveKey, error }) {
  const approveUrl = `${env.PRESS_URL}/approve?key=${approveKey}`;
  const text =
    `Print job failed for ${user.email}, issue № ${number} (${pageCount ?? "?"}pp).\n\n` +
    `Error: ${error}\n\nThe daily cron will retry. Manual trigger: ${approveUrl}\n\n— dtd-closer`;
  const html = `
    <div style="font-family: 'Courier New', monospace; color: #2b2419; max-width: 40em; font-size: 13px;">
      <p><strong>⚠ Print job failed</strong> — ${escapeHtml(user.email)}, issue № ${number} (${pageCount ?? "?"}pp)</p>
      <p style="background:#f1e6cf;border:1px solid #bf4e24;padding:8px 12px;">${escapeHtml(error)}</p>
      <p>The daily cron will retry. <a href="${approveUrl}">Manual trigger</a>.</p>
    </div>`;
  return sendEmail(env, env.ADMIN_EMAIL, `[DTD] print failed: issue ${number} for ${user.email}`, text, html);
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
