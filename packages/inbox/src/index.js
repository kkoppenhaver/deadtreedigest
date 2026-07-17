// dtd-inbox: the email() handler behind Cloudflare Email Routing's catch-all.
// Forward an article or newsletter to your save address and it lands in your
// library like any other save — same reader, same queue, same print-when-full.
//
// Matching, in order:
//   1. save-<email_key>@…  — the user's unique address (survives forwarding
//      services and works no matter what From address the mail arrives with)
//   2. save@…              — convenience address, matched by sender email
// Anything else bounces with a reason.

import PostalMime from "postal-mime";

export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer(); // single-use stream: buffer first
    const mail = await PostalMime.parse(raw);

    const rcpt = (message.to ?? "").toLowerCase();
    const local = rcpt.split("@")[0].split("+")[0]; // keanan+newsletters@ still lands

    let user = null;
    const keyed = local.match(/^save-([a-z0-9]+)$/);
    if (keyed) {
      user = await env.DB.prepare("SELECT * FROM users WHERE email_key = ?").bind(keyed[1]).first();
    } else if (local === "save") {
      const sender = (message.from ?? "").toLowerCase();
      user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(sender).first();
    } else {
      user = await env.DB.prepare("SELECT * FROM users WHERE handle = ?").bind(local).first();
      if (!user) {
        message.setReject("No such address");
        return;
      }
    }
    if (!user) {
      message.setReject("This address isn't connected to a Dead Tree Digest account");
      return;
    }

    // Prefer the HTML part; fall back to text wrapped in paragraphs so
    // plain-text newsletters still typeset.
    const html =
      mail.html ??
      `<article>${(mail.text ?? "")
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join("")}</article>`;

    const from = mail.from?.name || mail.from?.address || message.from;
    const res = await env.API.fetch("https://api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.save_token}`,
      },
      body: JSON.stringify({
        html,
        email: { subject: mail.subject ?? null, from },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`inbox save failed for ${user.id}: ${res.status} ${body.slice(0, 200)}`);
      // 422 = nothing article-shaped; let the sender know rather than silently eating it
      if (res.status === 422) message.setReject("Couldn't find an article in that email");
      else message.setReject("Something went wrong saving that — try again shortly");
      return;
    }
    const saved = await res.json();
    console.log(`inbox save ok for ${user.id}: "${saved.title}" ~${saved.estimatedPages}pp`);
  },
};

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
