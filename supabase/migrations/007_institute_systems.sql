-- Migration 007: Institute Systems table (simplified - just a name/identifier)
DROP TABLE IF EXISTS public.institute_systems;

CREATE TABLE IF NOT EXISTS public.institute_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id UUID NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    system_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(institute_id, system_name)
);

ALTER TABLE public.institute_systems ENABLE ROW LEVEL SECURITY;
