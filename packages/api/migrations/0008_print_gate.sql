-- Print gate: signups are open, printing is not. Non-beta users can save and
-- watch their queue fill; when it's full the operator gets a review email
-- instead of Lulu getting a job. Flipping beta=1 is the approval.

ALTER TABLE users ADD COLUMN beta INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN gate_alerted_at TEXT;

UPDATE users SET beta = 1 WHERE id = 'u_keanan';
