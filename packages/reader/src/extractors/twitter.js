// Twitter/X extractor: a thread is not an article, so Readability is useless
// here. Works off the extension's DOM capture of a tweet/thread page
// (data-testid hooks are the most stable thing X has). Keeps only tweets by
// the thread author, typesets each tweet as its own block, and flags the
// result for review when the selectors come up empty — X markup churns.

import { parseHTML } from "linkedom";

export function twitter(html, url) {
  const { document } = parseHTML(html);

  // X longform Articles (the blog-post feature) use different markup than
  // tweets: a titled rich-text view instead of tweetText nodes.
  const longform = document.querySelector('[data-testid="twitterArticleReadView"]');
  if (longform) {
    const title =
      document.querySelector('[data-testid="twitter-article-title"]')?.textContent?.trim() || null;
    const body =
      longform.querySelector('[data-testid="longformRichTextComponent"]') ??
      longform.querySelector('[data-testid="twitterArticleRichTextView"]');
    if (body) {
      // paragraphs are divs inside the densest container; wrap them as <p>
      // or the sanitizer's div-unwrapping merges the whole article into one block
      let container = body;
      for (const el of body.querySelectorAll("div")) {
        if (el.children.length > container.children.length) container = el;
      }
      const contentHtml = [...container.children].map((c) => `<p>${c.innerHTML}</p>`).join("");

      const spans = [...(document.querySelector('[data-testid="User-Name"]')?.querySelectorAll("span") ?? [])]
        .map((s) => s.textContent.trim())
        .filter(Boolean);
      const handle = spans.find((s) => s.startsWith("@")) ?? null;
      const name = spans.find((s) => !s.startsWith("@")) ?? null;
      const cover = document.querySelector('[data-testid="tweetPhoto"] img')?.getAttribute("src");
      const coverFig = cover && !contentHtml.includes(cover) ? `<figure><img src="${cover}" alt=""></figure>` : "";

      return {
        title: title ?? (handle ? `Article by ${handle}` : null),
        byline: name && handle ? `${name} (${handle})` : handle ?? name,
        siteName: "X (Twitter)",
        publishedAt: document.querySelector("time[datetime]")?.getAttribute("datetime") ?? null,
        excerpt: null,
        contentHtml: coverFig + contentHtml,
        needsReview: false,
      };
    }
  }

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
