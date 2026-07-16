// Normalizes extracted article HTML down to a single small vocabulary of tags
// ("digest HTML") that the typesetting layer can style exhaustively. Everything
// else is unwrapped or dropped. Also resolves URLs, rescues lazy-loaded images,
// strips tracking pixels, and collects links/images for the print pipeline
// (links become endnote candidates — URLs are invisible on paper).

import { parseHTML } from "linkedom";

const ALLOWED = new Set([
  "p", "h2", "h3", "h4", "blockquote", "ul", "ol", "li",
  "figure", "figcaption", "img", "pre", "code",
  "em", "strong", "a", "hr", "br", "sup", "sub", "cite",
  "table", "thead", "tbody", "tr", "th", "td",
]);

// Structural demotions: a saved article is one story inside an issue, so its
// h1 becomes h2; the deep end of the ladder flattens to h4.
const RENAME = { h1: "h2", h5: "h4", h6: "h4", b: "strong", i: "em" };

const DROP = new Set([
  "script", "style", "noscript", "template", "link", "meta", "title",
  "form", "button", "input", "select", "textarea", "label",
  "nav", "svg", "canvas", "dialog", "slot", "object",
]);

// Embeds can't print; they become a visible pointer instead of silently vanishing.
const EMBED = new Set(["iframe", "video", "audio", "embed"]);

const VOID_TAGS = new Set(["img", "hr", "br"]);

const TABLE_PARTS = new Set(["thead", "tbody", "tr", "th", "td"]);

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function absolute(href, base) {
  try {
    const url = new URL(href, base ?? undefined);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function imageSrc(el, base) {
  let src = el.getAttribute("src") || el.getAttribute("data-src") || el.getAttribute("data-original");
  if (!src || src.startsWith("blob:")) {
    // last resort: largest srcset candidate
    const srcset = el.getAttribute("srcset") || el.getAttribute("data-srcset");
    if (srcset) src = srcset.split(",").pop()?.trim().split(/\s+/)[0];
  }
  if (!src) return null;
  if (src.startsWith("data:")) return src.startsWith("data:image/") ? src : null;
  return absolute(src, base);
}

function isTrackingPixel(el) {
  const w = parseInt(el.getAttribute("width") ?? "", 10);
  const h = parseInt(el.getAttribute("height") ?? "", 10);
  return (Number.isFinite(w) && w <= 2) || (Number.isFinite(h) && h <= 2);
}

// linkedom's parseHTML does not synthesize <html>/<body> around fragments the
// way a browser's DOMParser does — without the full skeleton, document.body
// comes back empty.
const parseFragment = (html) => parseHTML(`<html><head></head><body>${html ?? ""}</body></html>`);

export function sanitize(html, baseUrl) {
  const { document } = parseFragment(html);
  const links = [];
  const images = [];

  function serialize(node) {
    if (node.nodeType === 3) return escape(node.textContent);
    if (node.nodeType !== 1) return "";

    let tag = node.localName;
    if (DROP.has(tag)) return "";
    if (node.getAttribute && /display\s*:\s*none/i.test(node.getAttribute("style") ?? "")) return "";

    if (EMBED.has(tag)) {
      const src = absolute(node.getAttribute("src") ?? "", baseUrl);
      return src ? `<p><em>[Embedded media: ${escape(src)}]</em></p>` : "";
    }

    tag = RENAME[tag] ?? tag;
    const children = [...node.childNodes].map(serialize).join("");

    if (!ALLOWED.has(tag)) return children; // unwrap unknown elements

    // Table fragments without a surviving <table> ancestor (Readability
    // sometimes strips layout tables but keeps rows/cells) parse as invalid
    // HTML downstream — the browser discards the orphan <tr>/<td> and hoists
    // their children loose, which stalls Paged.js. Unwrap them instead.
    if (TABLE_PARTS.has(tag) && !node.closest("table")) return children;

    let attrs = "";
    if (tag === "a") {
      const href = absolute(node.getAttribute("href") ?? "", baseUrl);
      if (!href) return children;
      links.push({ href, text: node.textContent.trim().slice(0, 200) });
      attrs = ` href="${escape(href)}"`;
    } else if (tag === "img") {
      if (isTrackingPixel(node)) return "";
      const src = imageSrc(node, baseUrl);
      if (!src) return "";
      images.push(src);
      const alt = node.getAttribute("alt") ?? "";
      return `<img src="${escape(src)}" alt="${escape(alt)}">`;
    }

    if (VOID_TAGS.has(tag)) return `<${tag}>`;
    return `<${tag}${attrs}>${children}</${tag}>`;
  }

  let out = [...document.body.childNodes].map(serialize).join("");

  // Collapse paragraphs with no visible content and squeeze whitespace runs.
  out = out
    .replace(/<(p|figure|blockquote)>(\s|&nbsp;|<br>)*<\/\1>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  out = blockify(out);

  return { html: out, links, images: [...new Set(images)] };
}

// Digest HTML's root must contain only block elements. Loose inline content
// between paragraphs (e.g. Paul Graham's footnote markers: `</p>[<a …>18</a>]<p>`)
// stalls Paged.js fragmentation when it lands on a page boundary — the
// paginator hits its "Layout repeated" guard and silently truncates the issue.
const BLOCK = new Set([
  "p", "h2", "h3", "h4", "blockquote", "ul", "ol", "figure", "pre", "hr", "table",
]);

function blockify(html) {
  const { document } = parseFragment(html);
  const parts = [];
  let run = "";
  const flush = () => {
    if (run.replace(/&nbsp;|<br>|\s/g, "") !== "") parts.push(`<p>${run.trim()}</p>`);
    run = "";
  };
  for (const node of document.body.childNodes) {
    if (node.nodeType === 1 && BLOCK.has(node.localName)) {
      flush();
      parts.push(node.outerHTML);
    } else if (node.nodeType === 1) {
      run += node.outerHTML;
    } else if (node.nodeType === 3) {
      run += escape(node.textContent);
    }
  }
  flush();
  return parts.join("");
}

export function textOf(html) {
  const { document } = parseFragment(html);
  return document.body.textContent.replace(/\s+/g, " ").trim();
}

const normText = (s) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const BARE_DATE =
  /^(?:[A-Z][a-z]+ \d{4}|[A-Z][a-z]+ \d{1,2},? \d{4}|\d{1,2} [A-Z][a-z]+ \d{4})$/;

// Old-web pages open their body with a repeat of the title (sometimes as an
// image — paulgraham.com renders its titles as GIFs) and a bare date line.
// The article header already carries both, so strip the duplicates from the
// lead and promote a found date to publishedAt if we don't have one.
export function dedupeLead(html, { title, publishedAt = null }) {
  const { document } = parseFragment(html);
  const t = normText(title);
  let published = publishedAt;

  const leads = [...document.body.children].slice(0, 3);
  for (const el of leads) {
    if (t) {
      for (const img of el.querySelectorAll?.("img") ?? []) {
        if (normText(img.getAttribute("alt")) === t) img.remove();
      }
    }
    const text = el.textContent.trim();
    if (t && normText(text) === t) {
      el.remove();
    } else if (BARE_DATE.test(text)) {
      const d = new Date(text);
      if (!Number.isNaN(d.valueOf())) {
        if (!published) published = d.toISOString().slice(0, 10);
        el.remove();
      }
    } else if (!text && !el.querySelector?.("img")) {
      el.remove(); // hollowed out by the title-image removal
    } else if (text) {
      break; // real content begins; stop sniffing
    }
  }

  return { html: document.body.innerHTML, publishedAt: published };
}

// Footnote markers that arrive as their own blocks (`<p>[1]</p>` — Paul
// Graham's essays, older blogs) typeset as stranded one-line paragraphs.
// Fold them into the tail of the preceding paragraph as a superscript.
export function foldFootnoteMarkers(html) {
  const { document } = parseFragment(html);
  for (const el of [...document.body.children]) {
    if (el.localName !== "p") continue;
    const text = el.textContent.trim();
    if (!/^\[\d+\]$/.test(text)) continue;
    const prev = el.previousElementSibling;
    if (prev?.localName === "p") {
      const sup = document.createElement("sup");
      // keep the link if the marker had one
      sup.innerHTML = el.querySelector("a") ? el.innerHTML.trim() : escape(text);
      prev.append(sup);
      el.remove();
    }
  }
  return document.body.innerHTML;
}

// Readability's br-chain conversion sometimes splits a footnote entry between
// the bracket and the number (`<p>…[</p><p>5] text…</p>` — Paul Graham's
// footnote sections). Rejoin them before any marker handling.
export function repairSplitFootnotes(html) {
  const { document } = parseFragment(html);
  for (const el of [...document.body.children]) {
    if (el.localName !== "p" || !el.textContent.trim().endsWith("[")) continue;
    const next = el.nextElementSibling;
    if (next?.localName === "p" && /^\d+\]/.test(next.textContent.trim())) {
      next.insertBefore(document.createTextNode(el.textContent.trim()), next.firstChild);
      el.remove();
    }
  }
  return document.body.innerHTML;
}

// Endnote sections: a run of 2+ paragraphs shaped like "[5] text…" gets
// wrapped in <section class="notes"> with the marker converted to a
// superscript number — the typesetter styles these smaller, tighter, with
// hanging indents (standard back-matter treatment).
export function wrapNotesSections(html) {
  const { document } = parseFragment(html);
  const isNote = (el) => el?.localName === "p" && /^\[\d+\]\s+\S/.test(el.textContent.trim());

  let cursor = document.body.firstElementChild;
  while (cursor) {
    if (!isNote(cursor)) {
      cursor = cursor.nextElementSibling;
      continue;
    }
    const run = [cursor];
    while (isNote(run.at(-1).nextElementSibling)) run.push(run.at(-1).nextElementSibling);
    cursor = run.at(-1).nextElementSibling;
    if (run.length < 2) continue;

    const section = document.createElement("section");
    section.setAttribute("class", "notes");
    run[0].before(section);
    for (const p of run) {
      // "[5] text" -> "<sup>5</sup> text"; drop any marker-internal links
      const m = p.innerHTML.match(/^\s*\[(?:<a[^>]*>)?(\d+)(?:<\/a>)?\]\s*/);
      if (m) {
        p.innerHTML = `<sup>${m[1]}</sup> ${p.innerHTML.slice(m[0].length)}`;
      }
      section.append(p);
    }
  }
  return document.body.innerHTML;
}

// Book convention: paragraphs are first-line-indented EXCEPT after a heading,
// figure, list, blockquote, or break. Encoded as a class in the markup
// because adjacent-sibling selectors (h2 + p) crash Paged.js's fragmenter
// ("item doesn't belong to list") when the siblings split across pages.
const NO_INDENT_AFTER = new Set(["h2", "h3", "h4", "figure", "blockquote", "ul", "ol", "pre", "hr", "table", "section"]);

export function markNoIndent(html) {
  const { document } = parseFragment(html);
  for (const p of document.querySelectorAll("p")) {
    const prev = p.previousElementSibling;
    if (prev && NO_INDENT_AFTER.has(prev.localName)) p.setAttribute("class", "ni");
  }
  return document.body.innerHTML;
}

// og:description is often just the article's opening sentences; printing it
// as a standfirst duplicates the first paragraph verbatim.
export function excerptDuplicatesLead(excerpt, contentHtml) {
  if (!excerpt) return false;
  const e = normText(excerpt).replace(/\s*(…|\.\.\.)$/, "");
  if (e.length < 20) return false;
  return normText(textOf(contentHtml)).startsWith(e.slice(0, Math.min(e.length, 160)));
}
