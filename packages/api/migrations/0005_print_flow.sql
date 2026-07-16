-- Print flow (milestone 5): the approve magic link creates the Lulu print
-- job. cover_key formalizes what the closer was storing by convention.

ALTER TABLE issues ADD COLUMN cover_key TEXT;
ALTER TABLE issues ADD COLUMN approve_key TEXT;
ALTER TABLE issues ADD COLUMN approved_at TEXT;
ALTER TABLE issues ADD COLUMN lulu_job_id TEXT;

CREATE UNIQUE INDEX idx_issues_approve_key ON issues(approve_key);
