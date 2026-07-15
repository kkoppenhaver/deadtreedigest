-- Library core: users, items, issues.
-- Cadence and page cap are per-user settings (not constants) so the monthly
-- tier is a config row, not a refactor. Dates are ISO-8601 TEXT (UTC).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  save_token TEXT NOT NULL UNIQUE,          -- bearer token for extension/email/save clients
  cadence TEXT NOT NULL DEFAULT 'biweekly', -- 'biweekly' | 'monthly'
  page_cap INTEGER NOT NULL DEFAULT 100,
  next_issue_date TEXT,                     -- cron can't say "every other week"; we store the date
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE issues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open | closed | rendered | approved | sent
  page_count INTEGER,                       -- actual, from the render
  pdf_key TEXT,                             -- R2 key of rendered interior PDF
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  issue_id TEXT REFERENCES issues(id),      -- null while queued
  status TEXT NOT NULL DEFAULT 'queued',    -- queued | assigned | printed | skipped
  url TEXT,
  canonical_url TEXT,
  source TEXT NOT NULL,                     -- generic | substack | twitter | linkedin | email
  title TEXT NOT NULL,
  byline TEXT,
  site_name TEXT,
  published_at TEXT,
  excerpt TEXT,
  content_html TEXT NOT NULL,               -- digest HTML from @dtd/reader
  links_json TEXT NOT NULL DEFAULT '[]',    -- endnote candidates
  images_json TEXT NOT NULL DEFAULT '[]',
  word_count INTEGER NOT NULL,
  estimated_pages REAL NOT NULL,
  needs_review INTEGER NOT NULL DEFAULT 0,  -- parse-quality flag; backs the preview/feedback loop
  raw_key TEXT NOT NULL,                    -- R2 key of the original capture (re-parse without re-save)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_items_queue ON items (user_id, status, created_at);
CREATE INDEX idx_issues_user ON issues (user_id, number);
