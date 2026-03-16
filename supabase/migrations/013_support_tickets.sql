-- Support Tickets System
-- Allows institute admins and students to raise support tickets to the super admin

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Who raised the ticket
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('institute_admin', 'student')),

    -- Optional: link to an institute for context
    institute_id UUID REFERENCES institutes(id) ON DELETE SET NULL,

    -- Ticket details
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'payment', 'account', 'exam', 'content', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

    -- Status tracking
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    admin_reply TEXT,
    resolved_at TIMESTAMPTZ
);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own tickets
CREATE POLICY "users_own_tickets" ON support_tickets
    FOR ALL USING (auth.uid() = user_id);

-- Super admins (service role) can see all tickets — handled server-side with service role key
