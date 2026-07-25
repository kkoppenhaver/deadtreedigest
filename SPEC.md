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
- **Cadence — print-when-full (decided 2026-07-16, supersedes fixed biweekly)**: an issue closes the moment the queue's estimated pages reach the page cap, but never sooner than `min_interval_days` (default 14) after the last close. The 14-day floor makes worst-case COGS identical to the old biweekly model, so the economics hold; delight comes from "you filled Issue № N" landing the moment it happens. No thin issues, no skip cycles — an unfilled queue just keeps filling (subscribers who never save can cancel). **Email philosophy (2026-07-16): minimal.** No nudge emails, no auto-send warnings — the only routine email is "you filled Issue № N" with preview + approve. Arrival of the printed issue stays unannounced (no shipped/tracking email by default) to preserve the surprise of it showing up.
- **Format**: Perfect-bound, always (decided 2026-07-15 from real Lulu quotes — PB is cheaper than saddle stitch at every page count and coil is ~2×; no per-issue binding knob needed).
- **Print spec**: B&W interior, color cover.
- **Volume**: ~5–10 articles/week → ~10–20 articles ≈ 60–100 printed pages per biweekly issue.
- **Page cap (locked 2026-07-15)**: 100 printed pages per issue (~15–17 articles at ~5–6pp each). Overflow rolls to the next issue, same mechanic as the thin-issue rollover. Framed editorially ("each issue holds about 100 pages"), not as a limit. Marginal pages cost only 2.5¢ — the cap is for product feel and worst-case bounding (newsletter floods), not savings.
- **Price target**: $49/mo. At the 100pp cap, COGS is $21.86/mo + ~$1.72 Stripe + ~$0.83 trees → ~50% gross margin.
- **Product tiers (updated 2026-07-16)**: two tiers, both print-when-full. Primary — 100pp cap, 14-day floor, $49/mo (worst case ~2.2 issues/mo = old biweekly COGS). Second tier — chunkier/cheaper: 200pp cap, 28-day floor, ~$25–29/mo. Both are just per-user `page_cap` + `min_interval_days` config rows; no separate code path.
- **Budget**: under $10/issue all-in was the weekly target; biweekly issues are bigger (~$9–13 all-in) but monthly total drops to ~$18–26.
- **Automation (updated 2026-07-16): auto-approve + full surprise.** When an issue fills, it renders and goes straight to the press — and when everything works, **nobody gets an email**. The magazine's arrival IS the notification. Email exists only for exceptions: the user gets the address magic link when we can't ship without it (auto-prints via daily cron once filled, content deliberately unmentioned), and the operator (ADMIN_EMAIL) gets print-failure alerts with the manual /approve lever. No review gate, no tracking, no spoilers.
- **Minimum issue rule**: subsumed by print-when-full — an issue only ever ships at (near) cap, so thin issues are structurally impossible.
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
- **Tax-inclusive (authenticated quote, real IL address, 2026-07-16)**: PB 60/80/100pp = **$10.95 / $11.51 / $12.06 all-in per issue** (IL sales tax adds ~10%). Worst case at print-when-full (2.2 issues/mo at 100pp) = **~$26.5/mo COGS** → ~45% gross margin at $49/mo after Stripe + trees. Full table in `spike/lulu-quotes-2026-07-16.json`.
- **Binding decision is settled: always perfect-bound.** PB is cheaper than saddle stitch even at 40pp ($3.0x vs $4.78) and coil is ~2× PB ($7.86–8.86). The per-issue binding knob is unnecessary; PB min page count (~32pp) is covered by the ≥5-item gate.
- ⚠️ **Transit lag**: Mail takes 11–14 days — each issue arrives around the time the next one closes. Acceptable as a steady-state rolling pipeline (an issue is always in the mail), but the "fresh off the press" framing should account for it. Faster shipping starts at $13.74 (Ground) and blows the budget.

**2026-07-17 — model confirmed by production + trees repriced.** Issue № 1's real Lulu invoice (job 2959024, 113pp, IL): **$12.42 all-in** — $4.82 print + $0.75 fulfillment + $5.69 Mail + $1.16 tax, matching the quoted model ($8.43 fixed + 2.5¢/page, ×1.103 IL tax) to the cent. Reconciling it surfaced a spec/code drift: the spec budgeted 10 trees per subscriber-*year* (~$0.83/mo) but the closer planted 10 per *issue* ($10/issue at DigitalHumani's real $1/tree) — at worst-case cadence that ate the entire $49/mo margin. **Decision: TREES_PER_ISSUE = 1.** Still ~300x an issue's actual footprint (25 sheets ≈ 0.3% of a tree), keeps per-issue legibility ("a whole tree, every issue"), and restores the model: typical month (1 issue) ≈ $12.42 + $1 tree + $1.72 Stripe ≈ $15 COGS → ~69% gross margin at $49/mo; worst case (2.2 issues) ≈ $31 → ~37%. Issue № 1 shipped with 10 under the old constant; the back-cover tally is cumulative, so subscriber № 1's count reads 10, 11, 12…

Product-scale notes:

- POD has near-zero volume discount; margins come from pricing, not scale, until you can move to a print broker / short-run offset (~100+ copies of shared layouts — which fully personalized mags can't share except covers).
- At ~$11 COGS per issue (~$22/mo), the $49/mo target price gives ~50% gross margin after payment processing and tree planting — healthy for a premium personalized print product.
- Cost structure insight: $8.43 of every issue is fixed (shipping $5.69 + print base $1.99 + fulfillment $0.75); pages are 2.5¢ each. The lever is shipment count, not page count — e.g. a monthly 200pp edition costs $13.43/mo all-in (vs $21.86 biweekly), enabling a cheaper ~$25/mo tier at similar margins.
- At real scale, USPS Periodicals-class mail (requires permit) is the structural shipping advantage real magazines have.

## Find a Bench (scoped 2026-07-25)

The digest gets you off screens; this points you somewhere to sit. Two surfaces
sharing one core, new package `@dtd/spots` (bundled like `@dtd/reader` — no new
worker):

- **What counts as a spot**: benches and parks first (OSM maps individual
  benches — `amenity=bench`, with `backrest` and `direction`), plus a curated
  tag-list of overlooked places: viewpoints, piers, cemeteries, lighthouses,
  ferry terminals. No cafes/third-places — that drifts into "places near me"
  genericism.
- **Sourcing — OSM + LLM editorial pass**: Overpass API query near a lat/lng
  (default radius ~2 km / a 25-minute walk, widening to ~5 km if sparse) →
  candidates + exclusion list to an LLM (Anthropic API, Haiku-class; new
  worker secret) which picks ONE spot and writes one line in house voice.
  Scales to any address, still reads hand-picked.
- **The map**: monochrome field-guide SVG drawn from the Overpass vector
  geometry itself — thin street lines, shaded green, water, an ✕ at the spot.
  Crisp at print DPI (raster tiles are not), fully in our control, no tile
  service. Small-print "© OpenStreetMap contributors" (required, and owed for
  the data anyway).
- **Print surface**: at close time the closer geocodes the shipping address
  and calls the core with that user's already-printed spots excluded; the
  typesetter places the small map on one of the first pages. Liner copy:
  "Let's get reading! We found a bench for you..." **Never blocks a close** —
  any failure (Overpass down, LLM error, no candidates) and the issue simply
  prints without the page. Spot recorded in D1 only after successful render,
  consistent with renders-before-DB-writes.
- **No repeats**: new `printed_spots` table (user, issue, OSM id, name,
  lat/lng, copy). It's the exclusion list at pick time, and over years it
  becomes part of the product — a slow tour of everywhere near you.
- **Web surface — "Find a Bench"**: public one-spot generator page in
  `prototype/` calling new `POST /spot` on dtd-api. Geolocate or type a place,
  get one spot with map + copy, "try another" link. A slot machine, not a
  map view. No auth; doubles as marketing for the product's whole philosophy.
- **Geocoding + fair use (decided)**: public Nominatim for place/address →
  lat/lng, respecting its policy: identifying User-Agent, ≤1 req/s, results
  cached (geocode stored on the user row — one request per address change),
  submit-on-enter input (no autocomplete), rate limit on `/spot`. Same
  politeness for Overpass (cache candidates per area; "try another" re-picks
  from cache, no re-query). At current scale this is comfortably in policy;
  if the page ever gets real traffic, swap in a paid geocoder (Geoapify /
  LocationIQ) behind the same interface in `@dtd/spots` — a one-file change.
- **No framework (decided)**: the site is four static pages (~1,300 lines);
  one interactive page doesn't justify a migration. All intelligence lives
  server-side (the closer needs it too), so the page is ~100 lines of vanilla
  JS: input → fetch → inject SVG. Revisit (Astro) only if the site grows
  pages, not because of this feature.

## Milestones

0. **Register domains**: deadtreedigest.com (+ printed.fyi if using it for save@ email). ✅ deadtreedigest.com registered 2026-07-15 (Cloudflare Registrar); printed.fyi still open.
1. **Quote spike**: hit Lulu price calculator API with our exact spec (also Peecho); lock the real per-issue number. ✅ Done 2026-07-15 via Lulu's public pricing GraphQL (`spike/lulu-public-quote.mjs`): $9.93–10.93/issue all-in. Peecho comparison skipped — Lulu is comfortably in budget. Authenticated REST spike (`spike/lulu-quote.mjs`) ready for when we need tax-inclusive quotes / real print jobs (needs developers.lulu.com keys).
2. **Library core**: Workers API + D1 schema (users, items, issues) + Chrome extension (save current page, capture DOM). 🟡 **API + schema live 2026-07-15** (`packages/api`, deployed as dtd-api at https://dtd-api.keanan-75b.workers.dev): D1 `dtd-library` (users with per-user cadence/page_cap/next_issue_date, items, issues), R2 `dtd-raw` for raw captures, `@dtd/reader` running at the edge (linkedom Workers-compat confirmed by deployment). Endpoints: `POST /save` (bearer save_token; url+html → parsed, estimated, queued, raw retained), `GET /library` (queue + cap math), `POST /items/:id/flag` (the bad-parse button). Verified end-to-end with live saves. Save token in local `.env` (SAVE_TOKEN). **Still open: the Chrome extension.**
3. **Render spike**: one saved article -> typeset PDF via Browser Rendering + Paged.js. This is the highest-risk piece; do it early. ✅ **PASSED 2026-07-15, both layers.** Local (`packages/typeset/render.mjs`): 55pp issue in 1.9s, 159pp stress in 3.2s — title page, TOC with live page refs (`target-counter`), mirrored margins + gutter, running heads, folios, grayscale images, ledger page. Cloudflare Browser Rendering (`packages/typeset/worker`, deployed as dtd-render-spike; renamed dtd-render 2026-07-19): 52pp in 7.8s, 150pp stress in 9s — far inside the 60s limit; free tier's 10 browser-min/day covers biweekly production trivially. **The Cloudflare-only architecture stands; no external render service needed.** Findings: (a) fonts must be embedded via @font-face — Worker Chrome substitutes system fonts, shifting page counts (159→150), and Lulu requires embedded fonts anyway; (b) Paged.js's "Layout repeated" guard truncates silently on malformed HTML — renderer treats it as failure, and the reader's sanitizer now guarantees block-only roots and no orphaned table fragments (the two triggers found); (c) the page estimator runs ~15% under actual — cap logic needs margin or a re-estimate from real renders.
4. **Issue pipeline**: weekly cron, ≥5-item gate, cover generation, review email with approve link. 🟡 **Core live 2026-07-16** (`packages/closer`, deployed as dtd-closer): print-when-full triggers — `/check` called by dtd-api after every save (service binding) + daily cron backstop at 17:00 UTC; threshold + 14-day interval guard both verified live; page-cap packing with 1.15 estimate margin and overflow rollover; render via service binding; PDF to R2; "you filled Issue № N" + monthly nudge emails written (delivery pending Email Sending onboarding — needs fresh `wrangler login` scopes). **Issue № 1 rendered: 5 articles, 56pp, `issues/u_keanan/issue-1.pdf`.** Still open: cover generation, review/approve flow (lands with print integration).
5. **Print integration**: Lulu Print API sandbox -> first real printed issue shipped to the apartment.
6. **Email ingestion**: Email Routing + Email Worker (forward-to-save).
7. **Ledger + trees**: tree-planting donation integration (One Tree Planted / Eden) and the auto-generated ledger page in every issue's layout.
8. **Find a Bench**: `@dtd/spots` core (Overpass → LLM pick → SVG map),
   `POST /spot` + public generator page, closer/typesetter wiring +
   `printed_spots` migration. Both surfaces together (scoped 2026-07-25,
   section above).
9. **Productization**: multi-tenant auth, billing. ~~Recommendations ("Librarian")~~ — **cut 2026-07-16**: every issue contains only content the user themselves saved. This is a copyright-posture decision, not just scope: user-initiated single copies to the saving user (Cablevision-style volition) is the defensible architecture, and a feature where WE select and distribute third-party content would forfeit it. Any future discovery feature must be licensing-based or excerpt/link-only.
