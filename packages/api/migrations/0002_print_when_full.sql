-- Print-when-full model (decided 2026-07-16): issues close when the queue
-- reaches page_cap, never sooner than min_interval_days after the last close.
-- No thin issues, no skip cycles — the queue just keeps filling.
-- next_issue_date is retired (kept for history); cadence becomes 'threshold'.

ALTER TABLE users ADD COLUMN min_interval_days INTEGER NOT NULL DEFAULT 14;
ALTER TABLE users ADD COLUMN last_closed_at TEXT;
ALTER TABLE users ADD COLUMN last_nudge_at TEXT;

UPDATE users SET cadence = 'threshold';

-- Backfill last_closed_at from the most recent rendered issue, so the
-- interval guard is armed correctly from day one.
UPDATE users SET last_closed_at = (
  SELECT MAX(closed_at) FROM issues
  WHERE issues.user_id = users.id AND issues.status IN ('rendered', 'approved', 'sent')
);
