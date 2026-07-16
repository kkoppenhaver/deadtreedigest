-- Magic-link key for the address page: emailed as a unique URL when we need
-- a shipping address (no login system exists — email IS the interface).
-- Scoped: the key can only read/write the shipping address, never the library.

ALTER TABLE users ADD COLUMN address_key TEXT;
UPDATE users SET address_key = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX idx_users_address_key ON users(address_key);
