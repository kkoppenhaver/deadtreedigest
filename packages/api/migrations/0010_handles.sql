-- Vanity save addresses: users pick their own local part at signup
-- (keanan@deadtreedigest.com). Keyed save-<email_key>@ remains as fallback.

ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_users_handle ON users(handle);

UPDATE users SET handle = 'keanan' WHERE id = 'u_keanan';
