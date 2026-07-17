# Dead Tree Digest

Save articles as you browse; when you've saved ~100 pages, they print
themselves into a perfect-bound magazine that shows up in your mailbox.
Single-user production system (Keanan is subscriber № 1), architected
multi-tenant. `SPEC.md` is the decision log; `marketing/POSITIONING.md` is the
copy source of truth.

## Architecture (all Cloudflare, one account)

| Piece | Package | Deployed as | Domain |
|---|---|---|---|
| Homepage + ledger + privacy (static) | `prototype/` | dtd-site | deadtreedigest.com |
| API: save/signup/setup/address/queue/files | `packages/api` | dtd-api | api.deadtreedigest.com |
| Closer: print-when-full, approve, status, trees | `packages/closer` | dtd-closer | press.deadtreedigest.com |
| Render: HTML→PDF via Browser Rendering + Paged.js | `packages/typeset/worker` | dtd-render-spike | (service binding only) |
| Email ingestion (forward-to-save) | `packages/inbox` | dtd-inbox | Email Routing catch-all |
| Reader: HTML→digest-HTML normalizer | `packages/reader` | (bundled into api) | — |
| Typesetter: issue + cover templates | `packages/typeset` | (bundled into closer) | — |
| Chrome extension (MV3) | `packages/extension` | Web Store (pending review) | — |

Data: D1 `dtd-library` (users/items/issues; migrations in `packages/api/migrations/`),
R2 `dtd-raw` (raw captures at `raw/{user}/{item}.html`, PDFs at `issues/{user}/issue-N[-cover].pdf`).

## Core flows

- **Save**: extension popup (dashboard + explicit save button) or email to
  `<handle>@deadtreedigest.com` → `POST /save` → `@dtd/reader` parses → D1 +
  raw capture to R2 → `waitUntil` pokes closer `/check`.
- **Print-when-full**: queue est×1.15 ≥ page_cap AND ≥min_interval_days since
  last close AND user.beta → close, typeset interior+cover (cover after
  interior: spine = pages/444), Lulu print job, 10 trees via DigitalHumani
  (TIST Kenya, project 81818183), NO email on success (full-surprise).
  Non-beta full queues hold + email ADMIN_EMAIL once. Daily cron 17:00 UTC:
  same check, pending-print retry, owed-trees retry, Lulu status polling
  (bad states alert admin; SHIPPED recorded silently).
- **Auth**: no logins. Bearer save_token for clients; scoped magic-link keys
  in URLs for browser pages (setup_key, address_key, library_key,
  approve_key). Email is the interface.

## Commands

- Deploy: `npx wrangler deploy -c packages/<pkg>/wrangler.jsonc` (always -c with absolute-ish path; cwd tricks wrangler)
- Migrations: `npx wrangler d1 migrations apply dtd-library --remote -c packages/api/wrangler.jsonc`
- D1/R2 CLI defaults to LOCAL simulation — always `--remote`
- Tests: `cd packages/reader && npx vitest run`
- Local render: `node packages/typeset/render.mjs <url...> [--stress N]`
- Cover playground: `node packages/typeset/cover-playground.mjs && open packages/typeset/.out/cover-playground.html`
- Extension pack: `zsh packages/extension/scripts/pack.sh`
- Ops levers (bearer SAVE_TOKEN from .env): closer `POST /check | /run (?print=1) | /rerender?issue=N | /poll-status | /email-test`; api `POST /items/:id/reparse | /items/:id/flag`

## Gotchas (hard-won; details in memory)

- Paged.js: no adjacent-sibling selectors, no floats in content, no leader();
  loose root inlines/orphan `<tr>` silently truncate ("Layout repeated" is
  console-only). Bisect on the REAL document, not synthetic repros.
- Same-account workers.dev fetches are blocked → service bindings.
- Browser Rendering free tier: 1 launch/20s → renderPdf retries (close = 2 renders).
- Email Sending: FROM must be @mail.deadtreedigest.com; onboarded via
  dashboard only (wrangler 2036s). Email Routing catch-all→worker is
  dashboard-only too.
- Lulu: state = 2-letter, phone = "+1 XXX XXX XXXX"; PRODUCTION_DELAYED means
  payment already ran (cancel auto-refunds). Pricing is public GraphQL at
  api.lulu.com/graphql/ (no auth).
- Closer renders BEFORE DB writes (no orphaned issues); `/run` never prints
  without `?print=1`; printIssue skips trees if issue already has them.
- `.env` (gitignored): SAVE_TOKEN, LULU_*, SHIP_*, FILE_SIGNING_SECRET,
  APPROVE_KEY, DH_* (DigitalHumani). Secrets also live on workers.

## Voice (see marketing/POSITIONING.md + memory)

Question-first headlines, plain product description, conversational spooling
sentences, concrete scenes (the park bench), italics on the load-bearing
word. No em dashes, no "It's not just X" constructions, no "apologize"
framing (banned). Dry wit lives in small print only.
