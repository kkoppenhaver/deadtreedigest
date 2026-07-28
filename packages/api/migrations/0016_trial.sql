-- The free first issue (decided 2026-07-26): first-time subscribers start in
-- an open-ended Stripe trial (card up front); when their first issue ships,
-- the closer pins trial_end to ship + 7 days and the one required notice goes
-- out. These columns are the trial's bookkeeping and the acquisition model's
-- instrumentation: s = trial_started_at -> a shipped issue within 90 days,
-- c = trial_converts_at -> trial_converted_at.
ALTER TABLE users ADD COLUMN trial_started_at TEXT;     -- trial checkout completed
ALTER TABLE users ADD COLUMN trial_converts_at TEXT;    -- billing starts (ship + 7d), set by the ship hook
ALTER TABLE users ADD COLUMN trial_notice_sent_at TEXT; -- the one required email went out
ALTER TABLE users ADD COLUMN trial_converted_at TEXT;   -- webhook saw trialing -> active
ALTER TABLE users ADD COLUMN card_fingerprint TEXT;     -- one free issue per card
