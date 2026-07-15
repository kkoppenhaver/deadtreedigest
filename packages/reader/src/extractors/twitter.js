// Twitter/X extractor: a thread is not an article, so Readability is useless
// here. Works off the extension's DOM capture of a tweet/thread page
// (data-testid hooks are the most stable thing X has). Keeps only tweets by
// the thread author, typesets each tweet as its own block, and flags the
// result for review when the selectors come up empty — X markup churns.

import { parseHTML } from "linkedom";

export function twitter(html, url) {
  const { document } = parseHTML(html);
  const nodes = [...document.querySelectorAll('article[data-testid="tweet"]')];
  if (nodes.length === 0) return null; // caller falls back to generic + needsReview

  const tweets = nodes.map((node) => {
    const handle =
      [...node.querySelectorAll('[data-testid="User-Name"] span')]
        .map((s) => s.textContent.trim())
        .find((t) => t.startsWith("@")) ?? null;
    const name = node.querySelector('[data-testid="User-Name"] span')?.textContent?.trim() ?? null;
    const text = tweetText(node.querySelector('[data-testid="tweetText"]'));
    const photos = [...node.querySelectorAll('[data-testid="tweetPhoto"] img')]
      .map((img) => img.getAttribute("src"))
      .filter(Boolean);
    const time = node.querySelector("time[datetime]")?.getAttribute("datetime") ?? null;
    return { handle, name, text, photos, time };
  });

  // The focal tweet is first; keep the author's own thread, drop replies.
  const author = tweets[0];
  const thread = tweets.filter((t) => t.handle && t.handle === author.handle);

  const contentHtml = thread
    .map((t) => {
      const paras = t.text
        .split(/\n{2,}|\n/)
        .filter((p) => p.trim())
        .map((p) => `<p>${p}</p>`)
        .join("");
      const figs = t.photos.map((src) => `<figure><img src="${src}" alt=""></figure>`).join("");
      return paras + figs;
    })
    .join("<hr>");

  const firstLine = author.text.split("\n")[0] ?? "";
  return {
    title: firstLine.length > 8 ? truncate(firstLine, 80) : `Thread by ${author.handle}`,
    byline: author.name ? `${author.name} (${author.handle})` : author.handle,
    siteName: "X (Twitter)",
    publishedAt: author.time,
    excerpt: truncate(author.text, 200),
    contentHtml,
    needsReview: thread.length !== tweets.length, // dropped foreign replies: worth a glance
  };
}

// tweetText children mix text spans with <img> emojis whose alt is the emoji.
function tweetText(el) {
  if (!el) return "";
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === 3) out += node.textContent;
    else if (node.localName === "img") out += node.getAttribute("alt") ?? "";
    else out += node.textContent;
  }
  return out.trim();
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
