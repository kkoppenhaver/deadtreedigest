// Issue template: normalized articles (@dtd/reader output) -> one HTML
// document typeset for print with Paged.js. This is the digest interior:
// 5.5x8.5 trim, mirrored margins with a binding gutter, running headers,
// folios, and a TOC with real page references.
//
// B&W interior per spec: everything is ink-on-paper monochrome; images are
// forced grayscale.

export { coverHtml, spineWidthIn } from "./cover.js";
import { FONTS_CSS } from "./fonts.css.js";

const escape = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const cleanSite = (s) =>
  String(s ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

// some sites put their URL where an author name belongs
const cleanByline = (b) => (/^https?:\/\//.test(b ?? "") ? cleanSite(b) : b);

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.valueOf())
    ? null
    : // timeZone UTC: date-only strings parse as UTC midnight, and rendering
      // them in a western local zone walks them back a day
      d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const STYLES = `
  ${FONTS_CSS}

  :root { --ink: #1a1a1a; --rule: #767676; }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  @page {
    size: 5.5in 8.5in;
    margin-top: 0.62in;
    margin-bottom: 0.66in;
    @bottom-center { content: counter(page); font-family: 'Lora', Georgia, serif; font-size: 8pt; }
  }
  /* Mirrored margins: the extra 0.25in rides the binding edge. */
  @page :left {
    margin-left: 0.5in;
    margin-right: 0.75in;
    @top-left { content: "DEAD TREE DIGEST"; font-family: 'Fjalla One', Helvetica, sans-serif; font-size: 6.5pt; letter-spacing: 0.18em; }
  }
  @page :right {
    margin-left: 0.75in;
    margin-right: 0.5in;
    @top-right { content: string(article-title); font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 7.5pt; }
  }
  /* Front & back matter run headerless and folio-less. */
  @page plain {
    @top-left { content: none; }
    @top-right { content: none; }
    @bottom-center { content: none; }
  }

  body { font-family: 'Lora', Georgia, serif; font-size: 9.75pt; line-height: 1.45; color: var(--ink); }

  /* ---------- front matter ---------- */
  .titlepage { page: plain; break-after: page; display: flex; flex-direction: column; justify-content: center; height: 100%; text-align: center; }
  .titlepage .mast { font-family: 'Fjalla One', Helvetica, sans-serif; font-weight: normal; font-size: 26pt; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.05; }
  .titlepage .issue-no { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 11pt; margin-top: 10pt; }
  .titlepage .rule { width: 60pt; border-top: 2pt solid var(--ink); margin: 18pt auto; }
  .titlepage .motto { font-size: 9pt; font-style: italic; color: #333; }

  .toc { page: plain; break-after: page; }
  .toc h2 { font-family: 'Fjalla One', Helvetica, sans-serif; text-transform: uppercase; letter-spacing: 0.14em; font-size: 10pt; border-bottom: 1.5pt solid var(--ink); padding-bottom: 6pt; margin-bottom: 12pt; }
  .toc ol { list-style: none; }
  .toc li { margin-bottom: 5.5pt; }
  .toc .t { display: block; font-size: 9.75pt; font-weight: bold; line-height: 1.25; }
  .toc .m { font-size: 7.25pt; color: #444; font-style: italic; }
  .toc a { text-decoration: none; color: inherit; }
  /* NB: Paged.js doesn't implement leader(); and attr(href) must live on the
     <a> itself — a pseudo-element on an inner span reads the span's (absent)
     attribute and the whole content silently fails to render. */
  .toc a::after { content: "page " target-counter(attr(href url), page); font-family: 'Fjalla One', Helvetica, sans-serif; font-size: 7.5pt; letter-spacing: 0.08em; }

  /* ---------- articles ---------- */
  section.article { break-before: page; }
  .article-head { margin-bottom: 14pt; }
  .article-head .kicker { font-family: 'Fjalla One', Helvetica, sans-serif; font-size: 7pt; letter-spacing: 0.16em; text-transform: uppercase; color: #333; border-top: 3pt solid var(--ink); padding-top: 5pt; }
  .article-head h1 { string-set: article-title content(text); font-family: 'Lora', Georgia, serif; font-size: 17pt; line-height: 1.15; margin-top: 7pt; font-weight: bold; }
  .article-head .standfirst { font-size: 10.5pt; font-style: italic; color: #2e2e2e; margin-top: 7pt; line-height: 1.35; }
  .article-head .byline { font-family: 'Fjalla One', Helvetica, sans-serif; font-size: 7.5pt; letter-spacing: 0.06em; margin-top: 8pt; color: #333; text-transform: uppercase; }

  .content p { text-align: justify; hyphens: auto; -webkit-hyphens: auto; orphans: 2; widows: 2; margin-bottom: 0; text-indent: 1.2em; }
  /* Book convention: no indent on openers or after headings/figures/breaks.
     The .ni class comes from the reader — adjacent-sibling selectors (h2 + p)
     crash Paged.js fragmentation, so the rule lives in markup. */
  .content p:first-of-type, .content p.ni { text-indent: 0; }
  .content sup { font-size: 0.7em; line-height: 0; }
  .content h2, .content h3, .content h4 { font-family: 'Fjalla One', Helvetica, sans-serif; break-after: avoid; margin: 13pt 0 5pt; line-height: 1.2; }
  .content h2 { font-size: 11.5pt; }
  .content h3 { font-size: 10pt; }
  .content h4 { font-size: 9pt; font-style: italic; }
  .content blockquote { margin: 9pt 0 9pt 14pt; padding-left: 9pt; border-left: 1.5pt solid var(--rule); font-style: italic; }
  .content blockquote p { text-indent: 0; }
  .content ul, .content ol { margin: 8pt 0 8pt 18pt; }
  .content li { margin-bottom: 3pt; }
  .content figure { break-inside: avoid; margin: 11pt 0; text-align: center; }
  .content img { max-width: 100%; max-height: 4.2in; filter: grayscale(1) contrast(1.05); }
  .content figcaption { font-size: 7.5pt; font-style: italic; color: #444; margin-top: 4pt; }
  .content pre { break-inside: avoid; font-family: 'Courier Prime', 'Courier New', monospace; font-size: 7.5pt; line-height: 1.35; background: #f2f2f2; padding: 7pt; margin: 9pt 0; white-space: pre-wrap; overflow-wrap: break-word; }
  .content code { font-family: 'Courier Prime', 'Courier New', monospace; font-size: 8.5pt; }
  .content hr { border: none; text-align: center; margin: 11pt 0; }
  .content hr::after { content: "* * *"; font-size: 9pt; letter-spacing: 0.4em; color: #333; }
  .content a { color: inherit; text-decoration: none; } /* endnotes come later; ink stays quiet */
  .content table { border-collapse: collapse; font-size: 8pt; margin: 9pt 0; width: 100%; }
  .content th, .content td { border: 0.5pt solid var(--rule); padding: 3pt 5pt; text-align: left; }

  /* Endnotes: ~2pt down from body, tighter leading, thin rule, hanging
     indents — standard back-matter treatment. */
  .content .notes { margin-top: 14pt; border-top: 0.75pt solid var(--rule); padding-top: 7pt; }
  /* Hanging indent via negative text-indent — NOT float: floated markers
     crossing a page boundary stall Paged.js's fragmenter. */
  .content .notes p { font-size: 7.75pt; line-height: 1.4; padding-left: 11pt; text-indent: -11pt; margin-bottom: 3.5pt; }
  .content .notes p sup { font-weight: bold; }

  .article-end { text-align: center; font-size: 9pt; letter-spacing: 0.3em; margin-top: 12pt; }

`;

function articleSection(a, i) {
  // The kicker owns the source; the byline row carries only author + date.
  const meta = [cleanByline(a.byline), fmtDate(a.publishedAt)].filter(Boolean).join(" · ");
  return `
  <section class="article" id="a${i}">
    <header class="article-head">
      <div class="kicker">${escape(cleanSite(a.siteName) || "From the library")}</div>
      <h1>${escape(a.title)}</h1>
      ${a.excerpt ? `<p class="standfirst">${escape(a.excerpt)}</p>` : ""}
      ${meta ? `<div class="byline">${escape(meta)}</div>` : ""}
    </header>
    <div class="content">${a.contentHtml}</div>
    <div class="article-end">◆</div>
  </section>`;
}

export function issueHtml(issue, { pagedJs }) {
  const { number = 1, dateLabel = "", articles = [] } = issue;

  const toc = articles
    .map((a, i) => {
      const meta = [cleanSite(a.siteName), cleanByline(a.byline)].filter(Boolean).join(" · ");
      return `<li><a href="#a${i}"><span class="t">${escape(a.title)}</span></a>
        ${meta ? `<span class="m">${escape(meta)}</span>` : ""}</li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Dead Tree Digest — Issue ${escape(number)}</title>
<style>${STYLES}</style>
<script>
  window.__pagedDone = 0;
  window.PagedConfig = {
    auto: true,
    after: (flow) => { window.__pagedDone = flow.total; },
  };
</script>
<script>${pagedJs}</script>
</head>
<body>

<div class="titlepage">
  <div class="mast">Dead Tree<br>Digest</div>
  <div class="issue-no">Issue № ${escape(number)}${dateLabel ? ` — ${escape(dateLabel)}` : ""}</div>
  <div class="rule"></div>
  <div class="motto">The articles you saved,<br>finally read.</div>
</div>

<nav class="toc">
  <h2>In this issue</h2>
  <ol>${toc}</ol>
</nav>

${articles.map(articleSection).join("\n")}

</body>
</html>`;
}
