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
import { createPrintJob } from "./lulu.js";
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
        return json(await closeForUser(user, env));
      }
      if (request.method === "POST" && pathname === "/rerender") {
        const number = Number(new URL(request.url).searchParams.get("issue"));
        return json(await rerenderIssue(user, env, number));
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

// GET /approve?key=… — the review email's magic link. Clicking it is what
// sends the issue to Lulu; nothing prints without it (auto-send at a deadline
// comes later, once the first manual print round-trips).
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
  if (issue.status !== "rendered") return page(`Issue № ${issue.number} isn't ready to print (status: ${issue.status}).`);
  if (!issue.cover_key) return page(`Issue № ${issue.number} has no cover PDF yet — can't print.`);

  const addressComplete = !!(user.ship_name && user.ship_street1 && user.ship_city && user.ship_state && user.ship_postcode && user.ship_phone);
  if (!addressComplete) {
    return page(
      `We need your shipping address first. <a href="${env.API_URL}/address?key=${user.address_key}">Add it here</a>, then come back to this link.`
    );
  }

  const interiorUrl = await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, issue.pdf_key);
  const coverUrl = await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, issue.cover_key);
  const job = await createPrintJob(env, { issue, user, interiorUrl, coverUrl });

  await env.DB.prepare(
    "UPDATE issues SET status = 'sent_to_print', lulu_job_id = ?, approved_at = ? WHERE id = ?"
  )
    .bind(String(job.id), new Date().toISOString(), issue.id)
    .run();
  await env.DB.prepare("UPDATE items SET status = 'printed' WHERE issue_id = ?").bind(issue.id).run();

  return page(
    `🌲 <strong>Issue № ${issue.number} is off to the printer.</strong><br><br>
     Lulu job <code>${job.id}</code> (status: ${job.status?.name ?? "created"}).<br>
     ${issue.page_count} pages, shipping US Mail to ${user.ship_city}, ${user.ship_state}.<br><br>
     <em>Ten trees are being planted to apologize.</em>`
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
}

async function checkUser(user, env) {
  const queued = await queuedItems(user, env);
  const est = queued.reduce((s, i) => s + i.estimated_pages * ESTIMATE_MARGIN, 0);
  const full = est >= user.page_cap;
  const sinceClose = daysSince(user.last_closed_at);
  const eligible = sinceClose >= user.min_interval_days;

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

async function closeForUser(user, env, queued = null) {
  queued ??= await queuedItems(user, env);
  if (queued.length === 0) return { action: "nothing-queued" };

  // Greedy pack against the cap; overflow seeds the next issue.
  const picked = [];
  let est = 0;
  for (const item of queued) {
    const cost = item.estimated_pages * ESTIMATE_MARGIN;
    if (picked.length > 0 && est + cost > user.page_cap) continue;
    picked.push(item);
    est += cost;
  }
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

  const interior = await renderPdf(
    env,
    issueHtml({ number, dateLabel, articles, ledger: { issuesShipped: number } }, { pagedJs })
  );
  const pageCount = interior.pages;

  let cover = null;
  if (pageCount) {
    try {
      cover = await renderPdf(
        env,
        coverHtml({ number, dateLabel, pageCount, articleCount: picked.length })
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
  await env.DB.prepare("UPDATE users SET last_closed_at = ? WHERE id = ?").bind(now, user.id).run();

  const emailed = await sendIssueFullEmail(env, user, {
    number,
    pageCount,
    picked,
    rolledOver,
    approveKey,
    previewUrl: await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, pdfKey),
    coverUrl: coverKey ? await signedFileUrl(env.FILE_SIGNING_SECRET, env.API_URL, coverKey) : null,
  });

  return {
    action: "closed",
    issue: number,
    items: picked.length,
    rolledOver,
    estimatedPages: round1(est),
    renderedPages: pageCount,
    pdfKey,
    coverKey,
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

  const interior = await renderPdf(
    env,
    issueHtml({ number, dateLabel, articles, ledger: { issuesShipped: number } }, { pagedJs })
  );
  const pageCount = interior.pages;
  const cover = await renderPdf(
    env,
    coverHtml({ number, dateLabel, pageCount, articleCount: items.length })
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

function sendIssueFullEmail(env, user, { number, pageCount, picked, rolledOver, approveKey, previewUrl, coverUrl }) {
  // No login exists — email is the interface. Preview links are signed file
  // URLs; the approve link is what actually sends the issue to the printer.
  const needsAddress = !(user.ship_street1 && user.ship_city && user.ship_state && user.ship_postcode);
  const addressUrl = `${env.API_URL}/address?key=${user.address_key}`;
  const approveUrl = `https://dtd-closer.keanan-75b.workers.dev/approve?key=${approveKey}`;

  const titles = picked.map((i) => `  • ${i.title}${i.byline ? ` — ${i.byline}` : ""}`).join("\n");
  const text =
    `You filled Issue № ${number}. ${pageCount ?? "?"} pages, ${picked.length} articles — typeset and ready.\n\n` +
    `${titles}\n\n` +
    `${rolledOver ? `${rolledOver} save(s) rolled over to start Issue № ${number + 1}.\n\n` : ""}` +
    `Preview the issue: ${previewUrl}\n${coverUrl ? `Preview the cover: ${coverUrl}\n` : ""}\n` +
    `${needsAddress ? `⚠ We need a shipping address first: ${addressUrl}\n\n` : ""}` +
    `Ready? Send it to print: ${approveUrl}\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">You filled Issue № ${number}</h2>
      <p><strong>${pageCount ?? "?"}</strong> pages · <strong>${picked.length}</strong> articles — typeset and ready.</p>
      <ul>${picked.map((i) => `<li>${escapeHtml(i.title)}${i.byline ? ` — ${escapeHtml(i.byline)}` : ""}</li>`).join("")}</ul>
      ${rolledOver ? `<p style="color:#4a4032;">${rolledOver} save(s) rolled over to start Issue № ${number + 1}.</p>` : ""}
      <p><a href="${previewUrl}" style="color:#1f4d38;">Preview the issue (PDF)</a>${coverUrl ? ` · <a href="${coverUrl}" style="color:#1f4d38;">the cover</a>` : ""}</p>
      ${needsAddress ? `<p style="background:#f1e6cf;border:2px solid #bf4e24;padding:10px 14px;"><strong>We need a shipping address first.</strong><br><a href="${addressUrl}" style="color:#bf4e24;">Add your address</a>, then approve below.</p>` : ""}
      <p style="margin-top:18px;"><a href="${approveUrl}" style="background:#1f4d38;color:#f1e6cf;padding:12px 22px;text-decoration:none;font-family:Helvetica,sans-serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;border:2px solid #2b2419;">Send it to print 🌲</a></p>
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `You filled Issue № ${number} — ${pageCount ?? "?"} pages`, text, html);
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
