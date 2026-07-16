import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArticle } from "../src/index.js";
import { sanitize } from "../src/sanitize.js";
import { detectSource } from "../src/detect.js";

const fixture = (name) =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf8");

describe("detectSource", () => {
  it("detects platforms by hostname", () => {
    expect(detectSource("https://x.com/janemaker/status/1", "")).toBe("twitter");
    expect(detectSource("https://twitter.com/janemaker/status/1", "")).toBe("twitter");
    expect(detectSource("https://www.linkedin.com/posts/someone_x", "")).toBe("linkedin");
    expect(detectSource("https://foo.substack.com/p/bar", "")).toBe("substack");
    expect(detectSource("https://example.com/article", "")).toBe("generic");
  });

  it("detects Substack custom domains from the DOM", () => {
    expect(detectSource("https://papertrail.example.com/p/x", fixture("substack-post.html"))).toBe(
      "substack"
    );
  });
});

describe("twitter extractor", () => {
  const article = parseArticle({
    html: fixture("twitter-thread.html"),
    url: "https://x.com/janemaker/status/123",
  });

  it("keeps only the thread author's tweets", () => {
    expect(article.contentHtml).toContain("shipping costs more than printing");
    expect(article.contentHtml).toContain("Perfect binding beats saddle stitch");
    expect(article.contentHtml).not.toContain("Following for more");
  });

  it("builds title and byline from the focal tweet", () => {
    expect(article.title).toMatch(/print-on-demand magazine pipeline/);
    expect(article.byline).toBe("Jane Maker (@janemaker)");
    expect(article.publishedAt).toBe("2026-07-10T14:00:00.000Z");
    expect(article.source).toBe("twitter");
  });

  it("preserves tweet photos and inlines emoji alt text", () => {
    expect(article.images).toContain("https://pbs.twimg.com/media/abc123?format=jpg");
    expect(article.contentHtml).toContain("🧵");
  });

  it("flags dropped replies for review", () => {
    expect(article.needsReview).toBe(true);
  });
});

describe("substack extractor", () => {
  const article = parseArticle({
    html: fixture("substack-post.html"),
    url: "https://papertrail.example.com/p/why-print-refuses-to-die",
  });

  it("takes the post title, not the site header h1", () => {
    expect(article.title).toBe("Why Print Refuses to Die");
  });

  it("strips subscribe widgets and buttons", () => {
    expect(article.contentHtml).not.toContain("Subscribe");
    expect(article.contentHtml).toContain("Paper remembers.");
  });

  it("fills byline and date from JSON-LD", () => {
    expect(article.byline).toBe("Alex Printer");
    expect(article.publishedAt).toBe("2026-07-01T09:00:00+00:00");
  });

  it("keeps figures with captions", () => {
    expect(article.contentHtml).toContain("<figcaption>The original content pipeline.</figcaption>");
  });
});

describe("email extractor", () => {
  const article = parseArticle({
    html: fixture("newsletter-email.html"),
    email: { subject: "Weekly Dispatch #42", from: "The Dispatch" },
  });

  it("drops hidden preheader text and tracking pixels", () => {
    expect(article.contentHtml).not.toContain("teaser");
    expect(article.images).toHaveLength(0);
  });

  it("unwraps layout tables into readable prose", () => {
    expect(article.contentHtml).not.toContain("<table>");
    expect(article.contentHtml).toContain("an ending is a gift");
  });

  it("uses email subject/from as metadata fallbacks", () => {
    expect(article.title).toContain("Weekly Dispatch #42");
    expect(article.source).toBe("email");
  });
});

describe("sanitize", () => {
  it("reduces to the digest tag vocabulary and demotes headings", () => {
    const { html } = sanitize(
      '<div><h1>Big</h1><h6>Tiny</h6><span data-x="1">text</span><script>evil()</script></div>',
      null
    );
    expect(html).toBe("<h2>Big</h2><h4>Tiny</h4><p>text</p>");
  });

  it("wraps loose inline content between paragraphs (stalls Paged.js otherwise)", () => {
    const { html } = sanitize('<p>one</p>[<a href="https://x.com/#f1">1</a>]<p>two</p>', "https://x.com");
    expect(html).toBe('<p>one</p><p>[<a href="https://x.com/#f1">1</a>]</p><p>two</p>');
  });

  it("unwraps orphaned table fragments but keeps real tables", () => {
    const orphan = sanitize("<tr><td><p>essay</p></td></tr>", null);
    expect(orphan.html).toBe("<p>essay</p>");
    const real = sanitize("<table><tbody><tr><td>cell</td></tr></tbody></table>", null);
    expect(real.html).toBe("<table><tbody><tr><td>cell</td></tr></tbody></table>");
  });

  it("resolves relative URLs against the article URL", () => {
    const { html, links } = sanitize('<p><a href="/about">about</a></p>', "https://example.com/post/1");
    expect(html).toContain('href="https://example.com/about"');
    expect(links[0]).toEqual({ href: "https://example.com/about", text: "about" });
  });

  it("rescues lazy-loaded images and drops javascript: links", () => {
    const { html, images } = sanitize(
      '<p><a href="javascript:alert(1)">bad</a></p><img data-src="https://cdn.example.com/real.jpg" alt="x">',
      "https://example.com"
    );
    expect(html).not.toContain("javascript:");
    expect(html).toContain("bad"); // link text survives, href does not
    expect(images).toEqual(["https://cdn.example.com/real.jpg"]);
  });

  it("replaces embeds with a visible pointer", () => {
    const { html } = sanitize('<iframe src="https://youtube.com/embed/abc"></iframe>', null);
    expect(html).toContain("[Embedded media: https://youtube.com/embed/abc]");
  });

  it("drops empty paragraphs", () => {
    const { html } = sanitize("<p>  </p><p><br></p><p>real</p>", null);
    expect(html).toBe("<p>real</p>");
  });
});

describe("lead cleanup (old-web pages)", () => {
  const html = `<html><head><title>How to Do Great Work</title></head><body><article>
    <p><img src="https://example.com/how-to-do-great-work-2.gif" alt="How to Do Great Work">July 2023</p>
    <p>If you collected lists of techniques for doing great work in a lot of different fields, what would the intersection look like? I decided to find out by making it. This opening paragraph continues with plenty of words so extraction is confident.</p>
    <p>Partly my goal was to create a guide that could be followed without deep context.</p>
  </article></body></html>`;

  const article = parseArticle({ html, url: "https://paulgraham.com/greatwork.html" });

  it("strips the title-image + bare-date lead block", () => {
    expect(article.contentHtml).not.toContain("great-work-2.gif");
    expect(article.contentHtml).not.toContain("July 2023");
    expect(article.contentHtml).toContain("If you collected lists");
    expect(article.images).toHaveLength(0);
  });

  it("promotes the stripped date to publishedAt", () => {
    expect(article.publishedAt).toBe("2023-07-01");
  });

  it("falls back to the hostname for siteName", () => {
    expect(article.siteName).toBe("paulgraham.com");
  });

  it("drops an excerpt that duplicates the opening paragraph", () => {
    // og:description commonly IS the first paragraph
    expect(article.excerpt).toBeNull();
  });
});

describe("footnote sections", () => {
  const body = `
    <p>Main text of the essay with enough words to be an article opener paragraph here.</p>
    <p>[</p><p><a href="https://x.com/#f5n">5</a>] First note text explaining something.</p>
    <p>[6] Second note text with more detail.</p>
    <p>[7] Third note.</p>`;
  const article = parseArticle({
    html: `<html><body><article><h1>Notes Test</h1>${body}</article></body></html>`,
    url: "https://example.com/notes",
  });

  it("repairs bracket/number splits from br-chain conversion", () => {
    expect(article.contentHtml).not.toContain("<p>[</p>");
  });

  it("wraps note runs in a notes section with superscript markers", () => {
    expect(article.contentHtml).toContain('<section class="notes">');
    expect(article.contentHtml).toContain("<sup>5</sup> First note text");
    expect(article.contentHtml).toContain("<sup>7</sup> Third note.");
    expect(article.contentHtml).not.toContain("[6]");
  });
});

describe("page estimation", () => {
  it("estimates pages from word count for the 100pp cap", () => {
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`).join(" ");
    const article = parseArticle({
      html: `<html><body><article><h1>Long read</h1><p>${words}</p></article></body></html>`,
      url: "https://example.com/long",
    });
    expect(article.wordCount).toBeGreaterThan(1900);
    expect(article.estimatedPages).toBeGreaterThan(4.5);
    expect(article.estimatedPages).toBeLessThan(6);
  });
});
