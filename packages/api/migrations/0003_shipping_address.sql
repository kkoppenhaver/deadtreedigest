-- Per-user shipping address (GitHub #2): print jobs ship to the user row,
-- not to .env. Field shapes follow Lulu's validation: 2-letter state code,
-- space-separated phone (+1 XXX XXX XXXX). US-only for now.

ALTER TABLE users ADD COLUMN ship_name TEXT;
ALTER TABLE users ADD COLUMN ship_street1 TEXT;
ALTER TABLE users ADD COLUMN ship_street2 TEXT;
ALTER TABLE users ADD COLUMN ship_city TEXT;
ALTER TABLE users ADD COLUMN ship_state TEXT;
ALTER TABLE users ADD COLUMN ship_postcode TEXT;
ALTER TABLE users ADD COLUMN ship_country TEXT NOT NULL DEFAULT 'US';
ALTER TABLE users ADD COLUMN ship_phone TEXT;
