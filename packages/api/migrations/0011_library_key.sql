-- Library page (#3): keyed queue view — see what's queued, read each parse,
-- flag bad ones, download past issues. Same magic-link pattern as address/setup.

ALTER TABLE users ADD COLUMN library_key TEXT;
UPDATE users SET library_key = lower(hex(randomblob(16))) WHERE library_key IS NULL;
CREATE UNIQUE INDEX idx_users_library_key ON users(library_key);
