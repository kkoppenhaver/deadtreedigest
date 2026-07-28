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
| Comped account (100% promo or subscription_status='comped') | ~$13.50–17.50/issue | −COGS | operator-funded |

The 14-day interval floor is what makes worst-case COGS equal the old
biweekly model — the margin floor is a config guarantee, not a hope.

## Second tier (designed, not launched)

200pp cap / 28-day floor ≈ one 200pp issue/mo = (8.43 + 5.00) × 1.103 + 1
= **$15.81 COGS** → supports ~$25–29/mo at similar margins. Just per-user
`page_cap` + `min_interval_days` rows; no new code path.

## Acquisition model (decided 2026-07-26)

Free first issue as the trial: card required at signup, subscription
auto-starts at ship + 7 days. US-only at launch — trial AND paid; Canada
waits for confirmed tax/customs economics. All priors below hold only
until the first two cohorts replace them with data.

### Why this trial is structurally cheap

The trial is earned, not timed: nothing prints until ~100 saved pages, so
a signup that never fills a queue costs ~$0. Dormant trials linger free
forever (they cost nothing and the door stays open); activation is
measured as shipped-within-90-days so the funnel numbers stay readable.
The program's only real cost is the shipped free issue (~$13.50), paid
only for users who demonstrably used the product. Sample cost per paid
subscriber = **$13.50 / c** — independent of activation. Tourists must
save 100 pages of articles with a card on file to extract one $13
magazine; one trial per Stripe card fingerprint closes the loop.

### Priors

| Prior | Value |
|---|---|
| c — ship→paid conversion | 50% planning / 25% stress |
| s — signup→ship (90-day window) | measure from cohort № 1 |
| Churn | 12%/mo (novelty-decay prior) |
| Billing anchor | ship + 7 days |
| Refund policy | instant, no questions (№ 1 arrived in 7d — some charges land at arrival) |

### The math

- LTV at 12% churn: 33.52 × 8.3 = **~$279** → CAC ceiling at 3:1 = **~$93**.
- Trial-only CAC = 13.50/c: **$27 plan / $54 stress**. Both clear the
  ceiling; payback 0.8 / 1.6 months.
- Self-funding line: **c = 40%** (13.50 = 0.40 × 33.52). Above it, the
  trial is cash-positive within each subscriber's first paid month.
- Per 100 organic trial starts at s = 55%: 55 issues ship ($743 COGS).
  Plan → ~28 paid, $939/mo contribution, ~10:1 LTV:CAC. Stress → ~14
  paid, CAC $53, still ~5:1.

### Channels vs the $93 ceiling

- **Organic first** (Pocket-refugee content, launch, the read-it-later
  comparison space): CAC ≈ trial-only. Cheapest cohorts, and the source
  of the c and churn data everything else is gated on.
- **Referral gift issue**: $13.50/attempt; converts ≥1-in-5 → ≤$67.50.
- **Newsletter sponsorships**: gated. Example $500 slot → 40 trial
  starts at s = 60%: plan $69/sub (clears), stress $137 (fails). Pilot
  only after observed c ≥ ~37%.
- **Paid social**: off the table under this prior (realistic CAC
  $150–500 vs the $93 ceiling). Revisit only if churn data beats 12%.

### Annual plan

$490/yr (2 months free), offered at trial conversion. Contribution ≈
490 − 161 (12 issues) − 17.94 (Stripe 3.6% + $0.30) = **~$311/yr** —
more than a monthly subscriber's entire expected LTV ($279) under the
12% prior, with instant CAC payback. Under pessimistic churn, every
annual taker strictly beats a monthly one; push it at conversion.

### Mechanics

- Stripe Checkout in trial mode at signup. `canPrint` already admits
  `trialing`, so the closer prints trial issues with no new code path.
- On first-issue ship the closer sets `trial_end = now + 7d` and sends
  the ONE legally required email (FTC negative-option rule +
  card-network physical-goods trial rules): "Your first issue is in the
  mail. $49/mo begins in 7 days unless you cancel — one click."
  Full-surprise resumes permanently from issue № 2.
- Idle months (billed, nothing shipped, ~$2.06 cost): bill normally.
  Instrument "billed months with zero issues" as the churn leading
  indicator; revisit auto-pause only if the data says it bites.

### Instrument from trial № 1

Four numbers replace every prior above: `s` (90-day), `c`, idle-month
churn, and cohort monthly churn.

## Known unknowns

- Canadian sales tax / customs handling on Lulu print jobs — resolves at the
  first real CA job (operator-gated, so it's reviewable before payment).
  Launch is US-only (2026-07-26), so the CA rows above are future-tier math.
- The acquisition model's c (ship→paid) and 12%/mo churn are priors, not
  data — the first two trial cohorts replace them.
- Page estimator runs ~15% under actual; the closer's 1.15 margin compensates.
  COGS math here uses *rendered* page counts, so it's unaffected.
- At real scale: POD has near-zero volume discount; margins move via pricing,
  print brokers, or USPS Periodicals class (permit required).
