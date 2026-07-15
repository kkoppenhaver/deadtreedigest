# Dead Tree Digest — personal print magazine pipeline

A Printernet-style service: save articles as you read, get a printed magazine shipped every two weeks. Built for me first, architected as a product.

## Brand

- **Name**: Dead Tree Digest — deadtreedigest.com (registered 2026-07-15, Cloudflare Registrar). Decision: root domain for everything — save address is save@deadtreedigest.com; printed.fyi dropped.
- **Thesis**: the name's self-awareness is the brand's integrity — "We killed a tree for this. We planted ten to apologize."

## Environmental program (part of the product, not a footnote)

- **Commitment**: plant 10x more trees than the product consumes. Biweekly ~60–100pp digest ≈ 15–25 sheets/issue → ~400–650 sheets/subscriber/yr ≈ 5–8% of a tree (a tree yields ~8,000 sheets). Planting 10 trees/subscriber/yr via One Tree Planted / Eden Reforestation (~$0.25–1/tree) costs $2.50–10/yr — 100x+ their actual footprint, a rounding error vs print+shipping COGS.
- **The ledger page**: printed in every issue — running tally of subscribers, trees consumed to date, trees planted. The physical artifact is the receipt; shareable proof of the claim.
- **Paper**: 100% recycled or FSC-certified stock where the POD vendor offers it (fun colophon footnote: the dead tree is partly fiction).
- **Trees, not carbon credits**: credits have credibility problems (Verra scandals); "10 trees" is legible, "0.4 tonnes CO2e" is not. Rainforest protection donations are a legible secondary option.
- **Claims discipline (FTC Green Guides)**: publish the math (the ledger page does this); avoid unsubstantiated terms like "carbon neutral" / "eco-friendly."

## Decisions so far

- **Scope**: Product, me first — single-user pipeline as MVP, but multi-tenant-friendly architecture and real unit economics.
- **Cadence**: Biweekly — two issues per month.
- **Format**: Perfect-bound, always (decided 2026-07-15 from real Lulu quotes — PB is cheaper than saddle stitch at every page count and coil is ~2×; no per-issue binding knob needed).
- **Print spec**: B&W interior, color cover.
- **Volume**: ~5–10 articles/week → ~10–20 articles ≈ 60–100 printed pages per biweekly issue.
- **Page cap (locked 2026-07-15)**: 100 printed pages per issue (~15–17 articles at ~5–6pp each). Overflow rolls to the next issue, same mechanic as the thin-issue rollover. Framed editorially ("each issue holds about 100 pages"), not as a limit. Marginal pages cost only 2.5¢ — the cap is for product feel and worst-case bounding (newsletter floods), not savings.
- **Price target**: $49/mo. At the 100pp cap, COGS is $21.86/mo + ~$1.72 Stripe + ~$0.83 trees → ~50% gross margin.
- **Product tiers (decided 2026-07-15)**: two tiers. Primary — biweekly, 100pp cap, $49/mo. Second tier — monthly single edition (~$25–29/mo, COGS $13.43 at 200pp): same pipeline, different close cadence and page cap. MVP builds the biweekly; the monthly tier is a config variation (issue close date + cap per user), so architect the closer/cap as per-user settings, not constants.
- **Budget**: under $10/issue all-in was the weekly target; biweekly issues are bigger (~$9–13 all-in) but monthly total drops to ~$18–26.
- **Automation**: review-before-print — rendered PDF sent for approval Sunday night, auto-sends at a deadline if no response.
- **Minimum issue rule**: if fewer than 5 items were saved that week, skip the issue (roll saves into next week). No thin issues, no wasted print runs.
- **Stack**: Cloudflare Workers + D1 (library) + R2 (PDFs) + Email Workers (forward-to-save) + Cron Triggers (weekly close). PDF rendering is the one piece that may need Browser Rendering API or an external service.

## Ingestion channels

- [ ] Chrome extension — save current page to library
- [ ] **Email forwarding** — dedicated address (e.g. save@domain); inbound email matched to account by sender address, article/newsletter parsed and saved to library. Natural fit for Cloudflare Email Routing + Email Workers.

## Architecture (v1)

```
Chrome extension ──┐
                   ├──> Workers API ──> D1 (library: users, items, issues)
Email Worker ──────┘         │
(save@domain)                │  biweekly close (weekly cron + next-issue
                             │  date stored in D1, since cron can't
                             │  express "every other week")
                             v
                   Issue closer: ≥5 items? ──no──> roll over, skip week
                             │ yes
                             v
                   Render pipeline: Readability-extracted article HTML
                   -> typeset HTML -> PDF (Browser Rendering + Paged.js)
                   -> interior PDF + color cover PDF -> R2
                             │
                             v
                   Review email with preview link + approve button
                   (auto-approve at deadline, e.g. Mon 9am)
                             │
                             v
                   Lulu Print API: create print job (saddle-stitch,
                   B&W interior / color cover) -> webhook status -> ships
```

- Article extraction: Readability-style parse at save time (extension sends both URL and captured DOM to survive paywalls/login walls).
- **Reading mode — `packages/reader` (built 2026-07-15)**: `@dtd/reader` normalizes every save into a small "digest HTML" tag vocabulary the print stylesheet can style exhaustively. Extractors: generic (Mozilla Readability), Substack (incl. custom domains via substackcdn fingerprint), Twitter/X threads (DOM capture; keeps author tweets only), LinkedIn (/pulse/ articles + feed posts), email newsletters (layout-table unwrapping, preheader/tracking-pixel stripping). Output: `{title, byline, siteName, publishedAt, excerpt, contentHtml, links, images, wordCount, estimatedPages, needsReview}` — `estimatedPages` feeds the 100pp cap; `links` are endnote candidates for print. Workers-compatible (linkedom, no Node APIs). Try it: `node packages/reader/cli.mjs <url>`.
- **Save preview + bad-parse feedback (decided 2026-07-15)**: every save shows a reader-mode preview; a "this didn't parse right" action flags the item `needs_review`. `needsReview` is also auto-set when a source extractor falls back to generic, content is suspiciously thin, or a paywall is detected. Raw captured HTML is retained (R2) so flagged items can be re-parsed after extractor fixes without re-saving.
- **Extraction ladder (decided 2026-07-15)**: no server-side browsing of social platforms — login walls, bot defenses, and ToS make it a losing arms race, and the extension's DOM capture already provides the authenticated, fully-rendered view. Instead: (1) CSS-selector extractors first (free, deterministic, the 90% case); (2) **LLM extraction fallback** on the captured DOM when `needsReview` fires — small model (Workers AI or Claude Haiku), structured output schema (title/byline/date/content HTML), resilient to markup churn and covers the long tail (Mastodon, Threads, Bluesky, forums) with zero per-site code; (3) the "report bad parse" button re-runs the flagged item through the LLM path from the R2 raw capture. Implement as `packages/reader/src/extractors/llm.js` behind the same extractor interface; wire in at productization (single-user MVP: the user is the review loop).
- Email ingestion: Cloudflare Email Routing -> Email Worker; match `from` to account; if body contains a link, extract the article; otherwise typeset the email itself (newsletters).
- PDF rendering is the one serverless-hostile piece: use Cloudflare Browser Rendering with Paged.js, or fall back to an external render service.

## Economics (REAL numbers — Lulu public pricing GraphQL, quoted 2026-07-15)

Quoted via `spike/lulu-public-quote.mjs` (Lulu's public `api.lulu.com/graphql/` pricing endpoint — no API keys needed; full output in `spike/results-2026-07-15.md`). Digest 5.5×8.5, B&W standard 60# uncoated, matte color cover, qty 1:

- Print, perfect-bound: **$3.49 (60pp) / $3.99 (80pp) / $4.49 (100pp)** — ≈ $1.99 base + $0.025/page
- Fulfillment fee: $0.75/order; Mail shipping (US): **$5.69**, 11–14 day transit
- **All-in: $9.93–10.93/issue → ~$20–22/mo** — mid-range of the old estimate, well under the $40/mo ceiling
- **Binding decision is settled: always perfect-bound.** PB is cheaper than saddle stitch even at 40pp ($3.0x vs $4.78) and coil is ~2× PB ($7.86–8.86). The per-issue binding knob is unnecessary; PB min page count (~32pp) is covered by the ≥5-item gate.
- ⚠️ **Transit lag**: Mail takes 11–14 days — each issue arrives around the time the next one closes. Acceptable as a steady-state rolling pipeline (an issue is always in the mail), but the "fresh off the press" framing should account for it. Faster shipping starts at $13.74 (Ground) and blows the budget.

Product-scale notes:

- POD has near-zero volume discount; margins come from pricing, not scale, until you can move to a print broker / short-run offset (~100+ copies of shared layouts, which personalized mags mostly can't share except covers/recommended sections).
- At ~$11 COGS per issue (~$22/mo), the $49/mo target price gives ~50% gross margin after payment processing and tree planting — healthy for a premium personalized print product.
- Cost structure insight: $8.43 of every issue is fixed (shipping $5.69 + print base $1.99 + fulfillment $0.75); pages are 2.5¢ each. The lever is shipment count, not page count — e.g. a monthly 200pp edition costs $13.43/mo all-in (vs $21.86 biweekly), enabling a cheaper ~$25/mo tier at similar margins.
- At real scale, USPS Periodicals-class mail (requires permit) is the structural shipping advantage real magazines have.

## Milestones

0. **Register domains**: deadtreedigest.com (+ printed.fyi if using it for save@ email). ✅ deadtreedigest.com registered 2026-07-15 (Cloudflare Registrar); printed.fyi still open.
1. **Quote spike**: hit Lulu price calculator API with our exact spec (also Peecho); lock the real per-issue number. ✅ Done 2026-07-15 via Lulu's public pricing GraphQL (`spike/lulu-public-quote.mjs`): $9.93–10.93/issue all-in. Peecho comparison skipped — Lulu is comfortably in budget. Authenticated REST spike (`spike/lulu-quote.mjs`) ready for when we need tax-inclusive quotes / real print jobs (needs developers.lulu.com keys).
2. **Library core**: Workers API + D1 schema (users, items, issues) + Chrome extension (save current page, capture DOM).
3. **Render spike**: one saved article -> typeset PDF via Browser Rendering + Paged.js. This is the highest-risk piece; do it early. ✅ **PASSED 2026-07-15, both layers.** Local (`packages/typeset/render.mjs`): 55pp issue in 1.9s, 159pp stress in 3.2s — title page, TOC with live page refs (`target-counter`), mirrored margins + gutter, running heads, folios, grayscale images, ledger page. Cloudflare Browser Rendering (`packages/typeset/worker`, deployed as dtd-render-spike): 52pp in 7.8s, 150pp stress in 9s — far inside the 60s limit; free tier's 10 browser-min/day covers biweekly production trivially. **The Cloudflare-only architecture stands; no external render service needed.** Findings: (a) fonts must be embedded via @font-face — Worker Chrome substitutes system fonts, shifting page counts (159→150), and Lulu requires embedded fonts anyway; (b) Paged.js's "Layout repeated" guard truncates silently on malformed HTML — renderer treats it as failure, and the reader's sanitizer now guarantees block-only roots and no orphaned table fragments (the two triggers found); (c) the page estimator runs ~15% under actual — cap logic needs margin or a re-estimate from real renders.
4. **Issue pipeline**: weekly cron, ≥5-item gate, cover generation, review email with approve link.
5. **Print integration**: Lulu Print API sandbox -> first real printed issue shipped to the apartment.
6. **Email ingestion**: Email Routing + Email Worker (forward-to-save).
7. **Ledger + trees**: tree-planting donation integration (One Tree Planted / Eden) and the auto-generated ledger page in every issue's layout.
8. **Productization**: multi-tenant auth, billing, recommendations ("Librarian").
