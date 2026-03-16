-- Keyboard Lessons Table
CREATE TABLE IF NOT EXISTS public.keyboard_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    lesson_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_text TEXT NOT NULL,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    target_keys JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Speed Passages Table
CREATE TABLE IF NOT EXISTS public.speed_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    title TEXT NOT NULL,
    passage_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Letter Templates Table
CREATE TABLE IF NOT EXISTS public.letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    category TEXT CHECK (category IN ('official', 'personal', 'business')),
    title TEXT NOT NULL,
    template_content TEXT NOT NULL,
    sample_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Statement Templates Table
CREATE TABLE IF NOT EXISTS public.statement_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    title TEXT NOT NULL,
    template_content TEXT NOT NULL,
    sample_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    category TEXT CHECK (category IN ('formal', 'informal')),
    title TEXT NOT NULL,
    template_content TEXT NOT NULL,
    sample_content TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MCQ Question Bank Table
CREATE TABLE IF NOT EXISTS public.mcq_question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    category TEXT CHECK (category IN ('typing_theory', 'computer_basics', 'language_grammar')),
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
    explanation TEXT,
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam Patterns Table
CREATE TABLE IF NOT EXISTS public.exam_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id),
    pattern_name TEXT NOT NULL,
    keyboard_lesson_count INTEGER DEFAULT 0,
    speed_passage_count INTEGER DEFAULT 0,
    letter_count INTEGER DEFAULT 0,
    statement_count INTEGER DEFAULT 0,
    email_count INTEGER DEFAULT 0,
    mcq_count INTEGER DEFAULT 0,
    total_marks INTEGER NOT NULL,
    passing_marks INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.keyboard_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcq_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Super Admin full access, Students read-only)
CREATE POLICY "Super admins manage content" ON public.keyboard_lessons FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view keyboard lessons" ON public.keyboard_lessons FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage speed passages" ON public.speed_passages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view speed passages" ON public.speed_passages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage letter templates" ON public.letter_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view letter templates" ON public.letter_templates FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage statement templates" ON public.statement_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view statement templates" ON public.statement_templates FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage email templates" ON public.email_templates FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view email templates" ON public.email_templates FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage mcq questions" ON public.mcq_question_bank FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Students view mcq questions" ON public.mcq_question_bank FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student')
);

CREATE POLICY "Super admins manage exam patterns" ON public.exam_patterns FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
