-- Migration 006: Fee management tables
-- Student fee collection: tracks what institute collects FROM student
CREATE TABLE IF NOT EXISTS public.student_fee_collection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    institute_id UUID REFERENCES public.institutes(id),
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
    course_fee_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
    exam_fee_collected DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_collected DECIMAL(10,2) GENERATED ALWAYS AS (course_fee_collected + exam_fee_collected) STORED,
    payment_mode TEXT DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online', 'cheque', 'neft', 'upi')),
    receipt_number TEXT,
    notes TEXT,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Institute payments to super admin (exam fee per student + delivery charge per batch)
CREATE TABLE IF NOT EXISTS public.institute_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES public.institutes(id),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('exam_fee', 'delivery_charge')),
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL, -- populated for exam_fee type
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,    -- populated for delivery_charge type
    amount DECIMAL(10,2) NOT NULL,
    payment_mode TEXT DEFAULT 'online' CHECK (payment_mode IN ('cash', 'online', 'cheque', 'neft', 'upi')),
    payment_reference TEXT,
    notes TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.student_fee_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_payments ENABLE ROW LEVEL SECURITY;

-- New students default to is_active = false so login is blocked until exam fee is paid
-- We do NOT change existing students, only new ones going forward
-- The INSERT in the students API will set is_active = false
