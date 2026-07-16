// Render spike, layer 2: the same Paged.js pagination, but inside Cloudflare
// Browser Rendering. POST fully-built issue HTML (Paged.js inlined), get the
// PDF back. Timing and page count come back in headers so we can compare
// against the local layer-1 numbers.

import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("POST issue HTML to render", { status: 405 });
    }
    if (env.RENDER_TOKEN && request.headers.get("x-render-token") !== env.RENDER_TOKEN) {
      return new Response("missing or bad x-render-token", { status: 401 });
    }

    const html = await request.text();
    const t0 = Date.now();

    let browser;
    try {
      // launch inside the try: a rate-limited launch (free tier: 1 new
      // browser / 20s) must surface as a 500, not an uncaught crash
      browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });

      await page.waitForFunction("window.__pagedDone > 0", { timeout: 60_000, polling: 250 });
      const pages = await page.evaluate("window.__pagedDone");
      const tPaginated = Date.now();

      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });

      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "X-Pages": String(pages),
          "X-Paginate-Ms": String(tPaginated - t0),
          "X-Total-Ms": String(Date.now() - t0),
        },
      });
    } catch (err) {
      return new Response(`render failed: ${err.message}`, { status: 500 });
    } finally {
      await browser?.close();
    }
  },
};
