-- Email ingestion (#4): each user gets a unique save-by-email address,
-- save-<email_key>@deadtreedigest.com. Recipient-key matching is robust to
-- forwarding; plain save@ falls back to sender matching.

ALTER TABLE users ADD COLUMN email_key TEXT;
UPDATE users SET email_key = lower(hex(randomblob(6))) WHERE email_key IS NULL;
CREATE UNIQUE INDEX idx_users_email_key ON users(email_key);
