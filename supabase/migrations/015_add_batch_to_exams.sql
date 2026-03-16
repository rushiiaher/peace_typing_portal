-- Migration 015: Add batch_id to exams table so batch info is tracked per exam
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;

-- Index for batch lookups
CREATE INDEX IF NOT EXISTS idx_exams_batch ON public.exams(batch_id);
