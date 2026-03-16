-- Migration 009: Add Razorpay support to institute_payments
-- 1. Update checkout constraint for payment_mode to allow 'razorpay'
ALTER TABLE public.institute_payments DROP CONSTRAINT IF EXISTS institute_payments_payment_mode_check;
ALTER TABLE public.institute_payments ADD CONSTRAINT institute_payments_payment_mode_check 
    CHECK (payment_mode IN ('cash', 'online', 'cheque', 'neft', 'upi', 'razorpay'));

-- 2. Add Razorpay specific tracking columns
ALTER TABLE public.institute_payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.institute_payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
-- razorpay_payment_id will be stored in payment_reference
