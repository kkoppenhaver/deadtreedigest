// dtd-closer: print-when-full (decided 2026-07-16). An issue closes when the
// queue's estimated pages reach the user's page_cap — but never sooner than
// min_interval_days after the last close (the cost guard: at the default 14
// days, worst-case COGS equals the modeled biweekly economics). No thin
// issues, no skip cycles: an unfilled queue just keeps filling. If nothing
// has shipped in a while, a gentle nudge email reports queue progress.
//
// Triggers:
//   - POST /check (bearer save_token): close if full + eligible. Called by
//     dtd-api after every save — this is what makes "you filled your issue"
//     land the moment it happens.
//   - daily cron: same check for every user (catches interval windows opening
//     while nobody saves), plus the nudge.
//   - POST /run (bearer save_token): force-close whatever is queued. Test lever.

import { issueHtml, coverHtml } from "@dtd/typeset";
import pagedJs from "./paged.polyfill.txt";

// The page estimator runs ~15% under real renders (measured in the render spike).
const ESTIMATE_MARGIN = 1.15;
const NUDGE_AFTER_DAYS = 28;

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
    } catch (err) {
      return json({ error: err.message }, 500);
    }
    return json({ error: "POST /check or /run" }, 404);
  },
};

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

  // Long-quiet queue: reassure, don't ship thin.
  if (
    queued.length > 0 &&
    !full &&
    sinceClose >= NUDGE_AFTER_DAYS &&
    daysSince(user.last_nudge_at) >= NUDGE_AFTER_DAYS
  ) {
    const emailed = await sendNudgeEmail(env, user, queued, est);
    await env.DB.prepare("UPDATE users SET last_nudge_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), user.id)
      .run();
    return { action: "nudged", queuedPages: round1(est), cap: user.page_cap, emailed };
  }

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
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO issues (id, user_id, number, status, page_count, pdf_key, closed_at) VALUES (?, ?, ?, 'rendered', ?, ?, ?)"
  )
    .bind(issueId, user.id, number, pageCount, pdfKey, now)
    .run();
  for (const item of picked) {
    await env.DB.prepare("UPDATE items SET issue_id = ?, status = 'assigned' WHERE id = ?")
      .bind(issueId, item.id)
      .run();
  }
  await env.DB.prepare("UPDATE users SET last_closed_at = ? WHERE id = ?").bind(now, user.id).run();

  const emailed = await sendIssueFullEmail(env, user, { number, pageCount, picked, rolledOver });

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

function sendIssueFullEmail(env, user, { number, pageCount, picked, rolledOver }) {
  const titles = picked.map((i) => `  • ${i.title}${i.byline ? ` — ${i.byline}` : ""}`).join("\n");
  const text =
    `You filled Issue № ${number}. ${pageCount ?? "?"} pages, ${picked.length} articles — typeset and ready.\n\n` +
    `${titles}\n\n` +
    `${rolledOver ? `${rolledOver} save(s) rolled over to start Issue № ${number + 1}.\n\n` : ""}` +
    `— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">You filled Issue № ${number}</h2>
      <p><strong>${pageCount ?? "?"}</strong> pages · <strong>${picked.length}</strong> articles — typeset and ready.</p>
      <ul>${picked.map((i) => `<li>${escapeHtml(i.title)}${i.byline ? ` — ${escapeHtml(i.byline)}` : ""}</li>`).join("")}</ul>
      ${rolledOver ? `<p style="color:#4a4032;">${rolledOver} save(s) rolled over to start Issue № ${number + 1}.</p>` : ""}
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `You filled Issue № ${number} — ${pageCount ?? "?"} pages`, text, html);
}

function sendNudgeEmail(env, user, queued, est) {
  const pct = Math.min(100, Math.round((est / user.page_cap) * 100));
  const titles = queued.map((q) => `  • ${q.title}`).join("\n");
  const text =
    `Your next issue is ${pct}% full (${round1(est)} of ${user.page_cap} pages).\n\n` +
    `Everything you've saved is safe and waiting:\n${titles}\n\n` +
    `Keep saving — the moment it's full, it prints.\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">Your next issue is ${pct}% full</h2>
      <p>${round1(est)} of ${user.page_cap} pages. Everything you've saved is safe and waiting:</p>
      <ul>${queued.map((q) => `<li>${escapeHtml(q.title)}</li>`).join("")}</ul>
      <p>Keep saving — the moment it's full, it prints.</p>
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `Your next issue is ${pct}% full`, text, html);
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
