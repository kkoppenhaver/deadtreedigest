-- Tree planting (DigitalHumani → TIST Kenya): 10 trees per print job,
-- recorded on the issue for the ledger's real numbers.

ALTER TABLE issues ADD COLUMN trees_planted INTEGER;
ALTER TABLE issues ADD COLUMN tree_request_id TEXT;
