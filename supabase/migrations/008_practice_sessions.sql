-- ============================================================
-- 008_practice_sessions.sql
-- Tracks every student practice attempt across all 6 modes
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    institute_id      UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,

    -- Which type of practice
    practice_type     TEXT NOT NULL CHECK (practice_type IN (
                          'keyboard_lesson',
                          'speed_passage',
                          'letter_template',
                          'statement_template',
                          'email_template',
                          'mcq'
                      )),

    -- Which content was practiced (FK to respective table by type)
    content_id        UUID,   -- lesson id / passage id / template id / mcq_set id

    -- Typing stats (for typing modes)
    wpm               INTEGER DEFAULT 0,
    accuracy          NUMERIC(5,2) DEFAULT 0,
    mistakes          INTEGER DEFAULT 0,
    duration_seconds  INTEGER DEFAULT 0,
    raw_keystrokes    INTEGER,

    -- MCQ stats (for mcq mode)
    total_questions   INTEGER,
    correct_answers   INTEGER,
    score_percent     NUMERIC(5,2),

    -- Metadata
    completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ps_student     ON practice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_ps_type        ON practice_sessions(practice_type);
CREATE INDEX IF NOT EXISTS idx_ps_content     ON practice_sessions(content_id);
CREATE INDEX IF NOT EXISTS idx_ps_completed   ON practice_sessions(completed_at DESC);

-- Row Level Security
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

-- Students can only read their own sessions
CREATE POLICY "student_read_own_sessions" ON practice_sessions
    FOR SELECT USING (auth.uid() = student_id);

-- Service role (API) can insert / read all
CREATE POLICY "service_all" ON practice_sessions
    FOR ALL USING (auth.role() = 'service_role');
