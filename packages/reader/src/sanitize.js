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

  return { html: out, links, images: [...new Set(images)] };
}

export function textOf(html) {
  const { document } = parseFragment(html);
  return document.body.textContent.replace(/\s+/g, " ").trim();
}
