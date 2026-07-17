-- Onboarding (dogfood round): public signup mints a user + a setup_key.
-- The emailed setup page (keyed by setup_key) hands the save_token to the
-- extension automatically — save_token itself stays out of URLs.

ALTER TABLE users ADD COLUMN setup_key TEXT;
ALTER TABLE users ADD COLUMN signed_up_at TEXT;
CREATE UNIQUE INDEX idx_users_setup_key ON users(setup_key);

UPDATE users SET setup_key = lower(hex(randomblob(16))) WHERE setup_key IS NULL;
