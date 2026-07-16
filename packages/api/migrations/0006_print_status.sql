-- Print-job status tracking: the full-surprise model means silence is the
-- success signal, so the operator layer must guarantee a dead job would have
-- been noticed. The daily cron polls Lulu and records transitions here;
-- bad states alert ADMIN_EMAIL, SHIPPED is recorded quietly.

ALTER TABLE issues ADD COLUMN lulu_status TEXT;      -- last seen Lulu status name
ALTER TABLE issues ADD COLUMN lulu_status_at TEXT;   -- when it last changed
ALTER TABLE issues ADD COLUMN shipped_at TEXT;
ALTER TABLE issues ADD COLUMN tracking_url TEXT;     -- for the admin page; never emailed to users
ALTER TABLE issues ADD COLUMN alerted_status TEXT;   -- dedup: which status we've alerted on
