# Cover system — working doc (issue #12, CLOSED 2026-07-27)

## SHIPPED 2026-07-27

Full matrix Keanan-approved (final notes: solid arch window, simplified
rowboat, no birch snag). dtd-closer DEPLOYED with the season/time/locale
wiring — the next close prints a computed cover. Step-4 validation:
production /rerender of issue 1 is (correctly) refused — "already at the
printer" — so the page box was verified with local Chrome instead: three
new-style covers (100pp + 84pp) all emit MediaBox at/just over the integer-
point width, safely above Lulu's minimum, 630pt tall exactly. Issue № 2
(~2026-07-31) wears lakefront summer, day/night per close hour.

Session handoff, 2026-07-26. Everything decided + built so far, and exactly
what's left. Read alongside the plan of record + amendments on GH issue #12.

## The design (all decisions Keanan-approved)

**National Park poster series.** One visual language; variation within a
system. Assignment is fully deterministic so rerenders can never shuffle a
cover.

- **Season → palette.** Meteorological season of `closed_at` picks it:
  `seasonFor(date)` in `src/palettes.js`.
- **Day/night → edition.** LOCAL close hour, approximated from the
  subscriber's longitude (`users.geo_lat/geo_lng`, set by Find a Bench):
  `timeFor(date, lng)` — night is 19:00–05:59. Fill your issue at 11pm, it
  wears the night cover.
- **Locale → scene.** Sequential rotation: `LOCALE_ROSTER[(number - 1) %
  roster.length]` (roster order in `src/cover.js`). NOT WIRED YET — see
  remaining work.
- **Rainbow shelf.** Spine + back cover TINT with the palette (`spine`/
  `back` tokens); spine type, layout, and cream ink never change. Masthead
  flips to cream (#f1e6cf) on night covers via `mastInk`.
- **Motif constancy.** The stump, saplings, trunks, and the hero pine's
  POSITION are identical in every scene and never re-inked by season beyond
  their tree0/1/2 tokens. Light source (sun/moon) always at (352,170).
  Foreground grammar: stump lower-left (132,~584), big pine right (430),
  saplings receding along the path. This is the series glue — keep it.
- **Middle-path garnishes** (approved, not yet built): ONE conditional layer
  per locale, not four scene variants. Planned: aurora ONLY when boreal
  lands a winter night close (rare on purpose), fireflies in summer-night
  swamp, bare prairie oak in fall, snowline on the canyon in winter.

## Update 2026-07-26: Option B foregrounds (Keanan-approved)

The identical bottom half is gone. What stays constant in every scene: the
stump (STUMP_MOTIF, same spot), the S-curve path shape (TRAIL_D — only the
paving changes), the hero pine, and three witness saplings (witnessSaplings
helper, same triangle, per-scene anchor). Mountain keeps the original
ten-sapling meadow. Per-locale casts: lakefront boardwalk + driftwood + red
rowboat; prairie mown two-track + split-rail fence + coneflowers; boreal
needle trail + birch snag + mossy erratics + blueberries; swamp raised
boardwalk on pilings + cattails + heron; cityscape paved path + park bench
(the one from the copy) + pigeons + day/night windows; canyon dry wash +
trail sign + prickly pear. Arch opening is one solid midShade tone (review
note: rock ring must read solid).

## Update 2026-07-25: all 7 scenes built, closer wired (NOT deployed)

- Roster complete: mountain, lakefront, prairie, boreal, swamp, cityscape,
  canyon (rotation order in `LOCALE_ROSTER`). 56-cover matrix renders.
- All four garnishes in: prairie oak bare in fall (marcescent brown canopy
  in winter — burr oaks hold dead leaves), boreal aurora winter-night only,
  swamp fireflies summer-night only, canyon snowline all winter.
- Foreground rework (Keanan feedback 2026-07-25): trail winds PAST the
  stump, ten saplings hand-scattered (not a line), shared `trailAndMotif()`
  helper — this changed every scene incl. canonical mountain layout.
- Scene fns take `(palette, seasonKey)`. New tokens: `canopy0/1` in all 8
  palettes (deciduous: prairie oak + swamp cypress).
- Closer wiring (step 3) is CODED but NOT DEPLOYED: closeForUser computes
  season/time/locale at the close moment and stores that same moment as
  closed_at; rerenderIssue derives from issue.closed_at. issueSpot syncs
  geocoded geo_lng onto the in-memory user so a first close uses it.
- Rerender fidelity check: issue 1 closed 2026-07-17T06:30Z, geo_lng null →
  rerender = summer/day/mountain = exactly what printed. CAVEAT: once
  geo_lng gets set (first successful geocode), a rerender of issue 1 would
  compute hour 06:30−6 = 00:30 → NIGHT. If that ever matters, snapshot
  season/time/locale onto the issues row (small migration) instead.
- Still open: Keanan reviews full matrix → deploy closer → step 4 Lulu
  validation pass (/rerender a real issue) → close #12.

## Current state (as of session start, superseded above)

- `src/palettes.js` — 8 palettes (4 seasons × day/night) with full token
  docs at the top. Summer day = the EXACT hexes Issue № 1 shipped with
  (canonical, do not touch). Water tokens (`water0/water1`) exist in all 8.
  `seasonFor` + `timeFor` exported.
- `src/cover.js` — scenes as functions of a palette: `SCENES = { mountain,
  lakefront }`, `LOCALE_ROSTER = ["mountain", "lakefront"]`. `skyActors(p)`
  renders sun+birds (day) or cratered moon + fixed STARS field + glow
  (night). `coverHtml({..., season, time, locale })` — ALL DEFAULT to
  canonical summer-day mountain, so production is unchanged until the
  closer passes them.
- `cover-playground.mjs` — knobs (season/time/locale) on the full spread
  (spine + back tint visible there) + approval matrix of every locale ×
  season × time front panel. Review: `node
  packages/typeset/cover-playground.mjs && open
  packages/typeset/out/cover-playground.html`.
- 16 covers exist (mountain, lakefront × 8). Keanan approved the palette
  matrix and the lakefront.

## Remaining work

1. **Five scenes**, one checkpoint each (screenshot the matrix rows for
   approval before the next): prairie (lone burr oak, big sky), boreal
   (spruce wall; aurora garnish winter-night only), swamp (cypress, still
   water — reuse water tokens; firefly garnish summer night), cityscape
   (skyline band as `band`, city park foreground), southwest canyon
   (hoodoos/arch, snowline garnish in winter). Grammar rules above apply to
   every one.
2. **Garnish hooks** — implement as small conditionals inside each scene fn
   (they get palette + can check `p.night`; season needs passing or infer
   via a `seasonKey` param — add a second arg to scene fns when needed).
3. **Closer wiring (step 3)**: in `closeForUser` (packages/closer/src/
   index.js), compute `season = seasonFor(new Date())`, `time =
   timeFor(new Date(), user.geo_lng)`, `locale = LOCALE_ROSTER[(number - 1)
   % LOCALE_ROSTER.length]` and pass to BOTH `coverHtml` calls (close +
   rerenderIssue — rerender must derive from `issue.closed_at`, not now(),
   to reproduce the same cover). Import from `@dtd/typeset`.
4. **Lulu sanity**: cover PDF must still validate — the spine-flex
   constraint (integer-point page box, commit fd3bb49) is untouched by any
   of this, but do one `/rerender` + validation pass on a real issue before
   the first seasonal cover prints.
5. Close #12 when the matrix is 7×8 and the closer wires it.

## Gotchas discovered

- The playground strips ALL import lines from inlined sources (`/^import
  [^\n]+\n/gm`) and inlines palettes.js separately — a new import in
  cover.js needs a matching inline in cover-playground.mjs.
- Matrix cells render via `frontOnly()` = hide .back/.spine + `zoom: 0.5`
  (iframes crop rather than scale otherwise).
- Fall/spring KEEP evergreen pines green (only light + deciduous scenery
  turns); winter day reads snowy via palette alone.
- Issue № 2 closes ~2026-07-31 and will wear whatever the closer computes
  IF step 3 lands before then — otherwise canonical summer mountain. Either
  is fine; don't rush wiring past review.
