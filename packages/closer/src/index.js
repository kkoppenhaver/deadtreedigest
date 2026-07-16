// dtd-closer: the issue pipeline's clock. A daily cron sweeps users whose
// next_issue_date has arrived (cron can't express "every other week", so the
// date lives in D1 and advances by the user's cadence):
//
//   < 5 queued items -> skip the issue, roll saves forward, and email the
//     user that their articles are safe — the issue would just be too thin.
//   >= 5             -> create the issue, assign items up to the page cap
//     (overflow rolls to the next issue), render the PDF via the Browser
//     Rendering worker, store it in R2, and email the issue-ready notice.
//
// POST /run (bearer save_token) force-runs the pipeline for one user — the
// manual test lever.

import { issueHtml } from "@dtd/typeset";
import pagedJs from "./paged.polyfill.txt";

// The page estimator runs ~15% under real renders (measured in the render
// spike), so budget with that margin when packing against the cap.
const ESTIMATE_MARGIN = 1.15;
const MIN_ITEMS = 5;

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(closeDueIssues(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/run") {
      return new Response("POST /run with bearer save_token", { status: 405 });
    }
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const user = token
      ? await env.DB.prepare("SELECT * FROM users WHERE save_token = ?").bind(token).first()
      : null;
    if (!user) return new Response("unauthorized", { status: 401 });

    try {
      const result = await closeForUser(user, env, { force: true });
      return new Response(JSON.stringify(result, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

async function closeDueIssues(env) {
  const today = new Date().toISOString().slice(0, 10);
  const { results: due } = await env.DB.prepare(
    "SELECT * FROM users WHERE next_issue_date IS NOT NULL AND next_issue_date <= ?"
  )
    .bind(today)
    .all();
  for (const user of due) {
    try {
      await closeForUser(user, env, { force: false });
    } catch (err) {
      console.error(`close failed for ${user.id}: ${err.message}`);
    }
  }
}

async function closeForUser(user, env, { force }) {
  const { results: queued } = await env.DB.prepare(
    "SELECT * FROM items WHERE user_id = ? AND status = 'queued' ORDER BY created_at"
  )
    .bind(user.id)
    .all();

  // The thin-issue gate: articles stay saved, no issue ships.
  if (queued.length < MIN_ITEMS) {
    await advanceIssueDate(user, env);
    const emailed = await sendSkipEmail(env, user, queued);
    return { action: "skipped", queued: queued.length, minimum: MIN_ITEMS, emailed };
  }

  // Greedy pack against the cap; overflow stays queued for next issue.
  const budget = user.page_cap;
  const picked = [];
  let est = 0;
  for (const item of queued) {
    const cost = item.estimated_pages * ESTIMATE_MARGIN;
    if (picked.length > 0 && est + cost > budget) continue;
    picked.push(item);
    est += cost;
  }
  const rolledOver = queued.length - picked.length;

  const number =
    ((await env.DB.prepare("SELECT MAX(number) AS n FROM issues WHERE user_id = ?").bind(user.id).first())
      ?.n ?? 0) + 1;
  const issueId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO issues (id, user_id, number, status, closed_at) VALUES (?, ?, ?, 'closed', ?)"
  )
    .bind(issueId, user.id, number, new Date().toISOString())
    .run();
  for (const item of picked) {
    await env.DB.prepare("UPDATE items SET issue_id = ?, status = 'assigned' WHERE id = ?")
      .bind(issueId, item.id)
      .run();
  }

  // Typeset + render via the Browser Rendering worker.
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
  const html = issueHtml(
    { number, dateLabel, articles, ledger: { issuesShipped: number } },
    { pagedJs }
  );

  // Service binding: same-account workers.dev URLs can't be fetched directly.
  const renderRes = await env.RENDER.fetch("https://render/", { method: "POST", body: html });
  if (!renderRes.ok) {
    await env.DB.prepare("UPDATE issues SET status = 'render_failed' WHERE id = ?").bind(issueId).run();
    throw new Error(`render failed: ${renderRes.status} ${await renderRes.text()}`);
  }
  const pdf = await renderRes.arrayBuffer();
  const pageCount = Number(renderRes.headers.get("x-pages")) || null;

  const pdfKey = `issues/${user.id}/issue-${number}.pdf`;
  await env.RAW.put(pdfKey, pdf, { httpMetadata: { contentType: "application/pdf" } });
  await env.DB.prepare(
    "UPDATE issues SET status = 'rendered', page_count = ?, pdf_key = ? WHERE id = ?"
  )
    .bind(pageCount, pdfKey, issueId)
    .run();

  await advanceIssueDate(user, env);
  const emailed = await sendIssueReadyEmail(env, user, { number, pageCount, picked, rolledOver });

  return {
    action: "closed",
    issue: number,
    items: picked.length,
    rolledOver,
    estimatedPages: Math.round(est * 10) / 10,
    renderedPages: pageCount,
    pdfKey,
    emailed,
  };
}

async function advanceIssueDate(user, env) {
  const base = user.next_issue_date ? new Date(`${user.next_issue_date}T00:00:00Z`) : new Date();
  if (user.cadence === "monthly") base.setUTCMonth(base.getUTCMonth() + 1);
  else base.setUTCDate(base.getUTCDate() + 14);
  await env.DB.prepare("UPDATE users SET next_issue_date = ? WHERE id = ?")
    .bind(base.toISOString().slice(0, 10), user.id)
    .run();
}

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

function sendSkipEmail(env, user, queued) {
  const n = queued.length;
  const titles = queued.map((q) => `  • ${q.title}`).join("\n");
  const text =
    `No issue this cycle — you saved ${n} article${n === 1 ? "" : "s"}, and we don't print anything ` +
    `thinner than ${MIN_ITEMS}. Nothing is lost: your saves are safe in the library and roll into your ` +
    `next issue.\n\n${n ? `Waiting in your queue:\n${titles}\n\n` : ""}` +
    `Next close: ${user.next_issue_date ? "two weeks out" : "soon"}. Save a few more good reads and ` +
    `the presses will roll.\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">No issue this cycle</h2>
      <p>You saved <strong>${n}</strong> article${n === 1 ? "" : "s"} — we don't print anything thinner than ${MIN_ITEMS}.</p>
      <p><strong>Nothing is lost.</strong> Your saves are safe in the library and roll straight into your next issue.</p>
      ${n ? `<p style="color:#4a4032;">Waiting in your queue:</p><ul>${queued.map((q) => `<li>${escapeHtml(q.title)}</li>`).join("")}</ul>` : ""}
      <p>Save a few more good reads and the presses will roll.</p>
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `No issue this cycle — your ${n} save${n === 1 ? " is" : "s are"} rolling forward`, text, html);
}

function sendIssueReadyEmail(env, user, { number, pageCount, picked, rolledOver }) {
  const titles = picked.map((i) => `  • ${i.title}${i.byline ? ` — ${i.byline}` : ""}`).join("\n");
  const text =
    `Issue № ${number} is typeset: ${pageCount ?? "?"} pages, ${picked.length} articles.\n\n${titles}\n\n` +
    `${rolledOver ? `${rolledOver} item(s) rolled over to the next issue (page cap).\n\n` : ""}` +
    `The PDF is rendered and stored. Print integration comes next — for now this is your preview notice.\n\n— Dead Tree Digest`;
  const html = `
    <div style="font-family: Georgia, serif; color: #2b2419; max-width: 34em;">
      <h2 style="font-family: Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.1em; font-size: 15px;">Issue № ${number} is typeset</h2>
      <p><strong>${pageCount ?? "?"}</strong> pages · <strong>${picked.length}</strong> articles</p>
      <ul>${picked.map((i) => `<li>${escapeHtml(i.title)}${i.byline ? ` — ${escapeHtml(i.byline)}` : ""}</li>`).join("")}</ul>
      ${rolledOver ? `<p style="color:#4a4032;">${rolledOver} item(s) rolled over to the next issue (page cap).</p>` : ""}
      <p style="font-style: italic; color: #4a4032;">— Dead Tree Digest</p>
    </div>`;
  return sendEmail(env, user.email, `Issue № ${number} is typeset — ${pageCount ?? "?"} pages`, text, html);
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
