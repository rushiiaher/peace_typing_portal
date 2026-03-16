-- Student Enrollments Table
CREATE TABLE IF NOT EXISTS public.student_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    course_id UUID REFERENCES public.courses(id),
    batch_id UUID REFERENCES public.batches(id),
    enrollment_date DATE DEFAULT CURRENT_DATE,
    course_fee_charged DECIMAL(10,2) NOT NULL,
    course_fee_status TEXT CHECK (course_fee_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
    course_fee_paid_amount DECIMAL(10,2) DEFAULT 0,
    course_fee_paid_at TIMESTAMP WITH TIME ZONE,
    exam_fee_status TEXT CHECK (exam_fee_status IN ('pending', 'paid')) DEFAULT 'pending',
    exam_fee_paid_amount DECIMAL(10,2) DEFAULT 0,
    exam_fee_paid_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- Student Fee Transactions Table
CREATE TABLE IF NOT EXISTS public.student_fee_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    enrollment_id UUID REFERENCES public.student_enrollments(id),
    transaction_type TEXT CHECK (transaction_type IN ('course_fee', 'exam_fee')),
    amount DECIMAL(10,2) NOT NULL,
    payment_mode TEXT CHECK (payment_mode IN ('cash', 'online', 'card')),
    transaction_reference TEXT,
    collected_by UUID REFERENCES public.institute_admins(id),
    transaction_date DATE DEFAULT CURRENT_DATE,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Institute Payments Table
CREATE TABLE IF NOT EXISTS public.institute_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID REFERENCES public.institutes(id),
    payment_type TEXT CHECK (payment_type IN ('exam_fee', 'delivery_fee')),
    batch_id UUID REFERENCES public.batches(id),
    student_count INTEGER,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Applications Table
CREATE TABLE IF NOT EXISTS public.exam_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    course_id UUID REFERENCES public.courses(id),
    batch_id UUID REFERENCES public.batches(id),
    exam_pattern_id UUID REFERENCES public.exam_patterns(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_date DATE,
    application_status TEXT CHECK (application_status IN ('submitted', 'scheduled', 'rescheduled', 'cancelled')) DEFAULT 'submitted',
    minimum_days_before_exam INTEGER DEFAULT 6,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Reschedule Requests Table
CREATE TABLE IF NOT EXISTS public.exam_reschedule_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_application_id UUID REFERENCES public.exam_applications(id),
    student_id UUID REFERENCES public.students(id),
    requested_by_institute_id UUID REFERENCES public.institute_admins(id),
    old_exam_date DATE NOT NULL,
    requested_new_date DATE NOT NULL,
    reason TEXT NOT NULL,
    request_status TEXT CHECK (request_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by_superadmin_id UUID,
    review_remarks TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exams Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_application_id UUID REFERENCES public.exam_applications(id),
    student_id UUID REFERENCES public.students(id),
    course_id UUID REFERENCES public.courses(id),
    exam_pattern_id UUID REFERENCES public.exam_patterns(id),
    exam_date DATE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')) DEFAULT 'scheduled',
    total_marks_obtained DECIMAL(5,2),
    grade TEXT,
    result TEXT CHECK (result IN ('pass', 'fail')),
    certificate_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student Practice Sessions Table
CREATE TABLE IF NOT EXISTS public.student_practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    practice_type TEXT CHECK (practice_type IN ('keyboard', 'speed', 'letter', 'statement', 'email', 'mcq')),
    content_id UUID,
    wpm INTEGER,
    accuracy_percentage DECIMAL(5,2),
    time_spent_seconds INTEGER,
    mistakes_count INTEGER,
    session_data JSONB,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institute_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_reschedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_practice_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_students_institute ON public.students(institute_id);
CREATE INDEX idx_students_batch ON public.students(batch_id);
CREATE INDEX idx_enrollments_student ON public.student_enrollments(student_id);
CREATE INDEX idx_exams_student ON public.exams(student_id);
CREATE INDEX idx_practice_student ON public.student_practice_sessions(student_id);
CREATE INDEX idx_exam_date ON public.exams(exam_date);
