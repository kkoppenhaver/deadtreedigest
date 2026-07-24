# Dead Tree Digest — the financial model

Canonical unit economics. `SPEC.md` is the decision log; this file is the
model those decisions produced. Grounded in Issue № 1's real Lulu invoice
(job 2959024, 2026-07-17) — the quoted model matched it to the cent.

## Parameters (update these, the rest is arithmetic)

| Parameter | Value | Source |
|---|---|---|
| Print base (PB, B&W 60# uncoated, 5.5×8.5) | $1.99 | Lulu pricing GraphQL |
| Per-page | $0.025 | Lulu pricing GraphQL |
| Fulfillment fee | $0.75/order | Lulu |
| Shipping, US Mail | $5.69 (11–14d; №1 arrived in 7) | Lulu, invoice-confirmed |
| Shipping, Canada Mail | $10.92 (6–8d, traceable) | Lulu quote 2026-07-24 |
| Sales tax multiplier (IL destination) | ×1.103 | invoice-confirmed; varies by destination, CA unknown until first job |
| Tree | $1.00/issue | DigitalHumani TIST Kenya, TREES_PER_ISSUE = 1 |
| Stripe processing | 2.9% + $0.30 | stripe.com/pricing |
| Stripe Billing (subscriptions) | +0.7% of billing volume | stripe.com/billing/pricing (current-gen accounts) |
| Stripe international card | +1.5% | applies to Canadian cards |
| Price | $49/mo | positioning target |
| Page cap / interval | 100pp / 14 days | per-user config; caps worst-case issues at ~2.2/mo |

## Per-issue cost

```
issue(pages, shipping) = (1.99 + 0.75 + shipping + 0.025 × pages) × tax + 1.00 tree
```

- **US, 113pp (Issue № 1 actuals)**: (8.43 + 2.83) × 1.103 = $12.42 + $1 tree = **$13.42**
- **US, at the 100pp cap**: (8.43 + 2.50) × 1.103 = $12.06 + $1 = **$13.06**
- **Canada, 113pp, pre-tax**: (13.66 + 2.83) = $16.49 + $1 = **~$17.50** (tax TBD at first CA print job)

The structure that matters: ~$8.43 (US) / ~$13.66 (CA) of every issue is
fixed; pages cost 2.5¢. The lever is **shipment count**, not page count.

## Per-subscriber month at $49

Stripe on a $49 US-card charge: 49 × (2.9% + 0.7%) + $0.30 = **$2.06**.
Canadian card adds 1.5% → **$2.80**. A 100%-off promo bills $0 → no fees.

| Scenario | COGS | Margin | % |
|---|---|---|---|
| Typical US (1 issue/mo, ~113pp) | 13.42 + 2.06 = $15.48 | $33.52 | **68%** |
| Worst-case US (2.2 issues at cap) | 2.2 × 13.06 + 2.06 = $30.79 | $18.21 | **37%** |
| Typical Canada (1 issue, paid, CA card) | ~17.50 + 2.80 = ~$20.30 | ~$28.70 | **~59%** |
| Comped account (100% promo or hand-flipped beta) | ~$13.50–17.50/issue | −COGS | operator-funded |

The 14-day interval floor is what makes worst-case COGS equal the old
biweekly model — the margin floor is a config guarantee, not a hope.

## Second tier (designed, not launched)

200pp cap / 28-day floor ≈ one 200pp issue/mo = (8.43 + 5.00) × 1.103 + 1
= **$15.81 COGS** → supports ~$25–29/mo at similar margins. Just per-user
`page_cap` + `min_interval_days` rows; no new code path.

## Known unknowns

- Canadian sales tax / customs handling on Lulu print jobs — resolves at the
  first real CA job (operator-gated, so it's reviewable before payment).
- Page estimator runs ~15% under actual; the closer's 1.15 margin compensates.
  COGS math here uses *rendered* page counts, so it's unaffected.
- At real scale: POD has near-zero volume discount; margins move via pricing,
  print brokers, or USPS Periodicals class (permit required).
