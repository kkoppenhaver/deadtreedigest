-- Find a Bench, print surface. The closer geocodes the shipping address once
-- (cached on the user row; cleared when the address changes) and each printed
-- issue records its spot so the pick never repeats — over years the table
-- becomes a slow tour of everywhere near you.
ALTER TABLE users ADD COLUMN geo_lat REAL;
ALTER TABLE users ADD COLUMN geo_lng REAL;
CREATE TABLE printed_spots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  osm_id TEXT NOT NULL,
  kind TEXT,
  name TEXT,
  lat REAL,
  lng REAL,
  copy TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_printed_spots_user ON printed_spots (user_id);
