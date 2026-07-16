// dtd-api: the library core. Clients (Chrome extension, email worker, curl)
// POST raw captures here; articles come out normalized, page-estimated, and
// queued for the next issue. The raw capture is retained in R2 so flagged
// items can be re-parsed after extractor fixes without re-saving.

import { parseArticle } from "@dtd/reader";

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

    const user = await authedUser(request, env);
    if (!user) return json({ error: "missing or invalid bearer token" }, 401);

    if (request.method === "POST" && pathname === "/save") {
      return save(request, env, user, ctx);
    }
    if (request.method === "GET" && pathname === "/library") {
      return library(env, user);
    }
    if (request.method === "POST" && pathname.match(/^\/items\/[\w-]+\/flag$/)) {
      return flag(env, user, pathname.split("/")[2]);
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
