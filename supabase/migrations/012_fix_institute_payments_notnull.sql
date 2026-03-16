-- Migration 012: Drop NOT NULL from legacy columns in institute_payments
-- Migration 004 created institute_payments with amount_due NOT NULL and amount_paid NOT NULL.
-- The current API uses the 'amount' column added in migration 011 instead.
-- Inserting without amount_due causes a NOT NULL violation, so we make it optional.

ALTER TABLE public.institute_payments
    ALTER COLUMN amount_due DROP NOT NULL;

-- amount_paid already has DEFAULT 0 so it's fine, but tidy it up anyway
ALTER TABLE public.institute_payments
    ALTER COLUMN amount_paid SET DEFAULT 0;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
