-- Stripe subscription state. beta stays the single print-gate flag; the
-- webhook flips it as subscriptions start and stop. Users with no Stripe ids
-- (operator-comped accounts) are invisible to the webhook by construction.
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT;
