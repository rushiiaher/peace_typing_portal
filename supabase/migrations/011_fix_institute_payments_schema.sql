-- Migration 011: Fix institute_payments schema mismatch
-- Migration 004 created institute_payments with a different schema (amount_due, amount_paid, payment_status).
-- Migration 006 tried to recreate it with the correct schema (amount, payment_type per-student, etc.)
-- but was skipped because the table already existed. This migration adds the missing columns.

-- Add the columns the API (razorpay/verify and payment-to-admin POST) expects
ALTER TABLE public.institute_payments
    ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

-- Fix the payment_type CHECK constraint: 004 used 'delivery_fee' but 006/API uses 'delivery_charge'
ALTER TABLE public.institute_payments
    DROP CONSTRAINT IF EXISTS institute_payments_payment_type_check;

ALTER TABLE public.institute_payments
    ADD CONSTRAINT institute_payments_payment_type_check
    CHECK (payment_type IN ('exam_fee', 'delivery_charge'));

-- Fix the payment_mode CHECK constraint to match what the API sends
ALTER TABLE public.institute_payments
    DROP CONSTRAINT IF EXISTS institute_payments_payment_mode_check;

ALTER TABLE public.institute_payments
    ADD CONSTRAINT institute_payments_payment_mode_check
    CHECK (payment_mode IN ('cash', 'online', 'cheque', 'neft', 'upi', 'razorpay'));

-- Razorpay columns (in case migration 009 also ran before this fix and left a duplicate)
ALTER TABLE public.institute_payments
    ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

-- Refresh the schema cache (PostgREST picks this up automatically after a schema reload)
NOTIFY pgrst, 'reload schema';
