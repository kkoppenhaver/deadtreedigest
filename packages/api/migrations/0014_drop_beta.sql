-- beta's job is done by subscription_status now: Stripe statuses from the
-- webhook, or 'comped' set by the operator for house accounts and gifts.
-- One column, one source of truth for "does the press print for this user".
UPDATE users SET subscription_status = 'comped' WHERE beta = 1 AND subscription_status IS NULL;
ALTER TABLE users DROP COLUMN beta;
