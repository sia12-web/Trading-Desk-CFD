-- Fundamental Analysis Sessions
-- AI-powered macro discussion system for currency pairs

-- fundamental_sessions: track macro discussion sessions
CREATE TABLE IF NOT EXISTS fundamental_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pair VARCHAR(10) NOT NULL,
    title TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    conclusion TEXT,
    created_episode_id UUID REFERENCES story_episodes(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- fundamental_messages: chat messages in each session
CREATE TABLE IF NOT EXISTS fundamental_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES fundamental_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    macro_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fundamental_sessions_user_pair
    ON fundamental_sessions(user_id, pair, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_sessions_status
    ON fundamental_sessions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fundamental_messages_session
    ON fundamental_messages(session_id, created_at ASC);

-- RLS Policies
ALTER TABLE fundamental_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundamental_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
    ON fundamental_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
    ON fundamental_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON fundamental_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON fundamental_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- Users can only see messages from their sessions
CREATE POLICY "Users can view messages from own sessions"
    ON fundamental_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM fundamental_sessions
            WHERE fundamental_sessions.id = fundamental_messages.session_id
            AND fundamental_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own sessions"
    ON fundamental_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM fundamental_sessions
            WHERE fundamental_sessions.id = fundamental_messages.session_id
            AND fundamental_sessions.user_id = auth.uid()
        )
    );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_fundamental_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fundamental_session_timestamp
    BEFORE UPDATE ON fundamental_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_fundamental_session_timestamp();
