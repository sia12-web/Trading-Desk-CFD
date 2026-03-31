-- =============================================================================
-- Trading Desk: JP Morgan-Style AI Trading Floor
-- Tables: desk_meetings, desk_messages, process_scores, desk_state
-- =============================================================================

-- 1. DESK MEETINGS — Stores each morning meeting / desk session
CREATE TABLE desk_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meeting_type VARCHAR(30) NOT NULL, -- 'morning_meeting', 'trade_review', 'end_of_day', 'ad_hoc'
    trigger_context JSONB,

    -- Each character's contribution (structured JSON)
    alex_brief JSONB,
    ray_analysis JSONB,
    sarah_report JSONB,
    marcus_directive JSONB,

    -- Raw context fed to AI (for debugging/replay)
    context_snapshot JSONB,

    -- Metadata
    ai_model VARCHAR(50) DEFAULT 'gemini-3-flash-preview',
    generation_duration_ms INTEGER,
    token_count INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE desk_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own desk meetings" ON desk_meetings
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_desk_meetings_user_date ON desk_meetings(user_id, created_at DESC);

-- 2. DESK MESSAGES — Individual messages in desk chat
CREATE TABLE desk_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES desk_meetings(id) ON DELETE CASCADE,

    speaker VARCHAR(20) NOT NULL, -- 'marcus', 'sarah', 'ray', 'alex', 'trader'
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'comment', -- 'comment', 'challenge', 'approval', 'block', 'alert'
    context_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE desk_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own desk messages" ON desk_messages
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_desk_messages_meeting ON desk_messages(meeting_id, created_at);
CREATE INDEX idx_desk_messages_user ON desk_messages(user_id, created_at DESC);

-- 3. PROCESS SCORES — Trade-level process grading
CREATE TABLE process_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,

    entry_criteria_score INTEGER,
    stop_loss_discipline INTEGER,
    rr_compliance INTEGER,
    size_discipline INTEGER,
    patience_score INTEGER,

    overall_score NUMERIC(3,1),
    sarah_commentary TEXT,
    marcus_commentary TEXT,

    scored_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE process_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own process scores" ON process_scores
    FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_process_scores_user ON process_scores(user_id, scored_at DESC);
CREATE INDEX idx_process_scores_trade ON process_scores(trade_id);

-- 4. DESK STATE — Persistent desk state per user
CREATE TABLE desk_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Character memory
    marcus_memory JSONB DEFAULT '{}',
    sarah_memory JSONB DEFAULT '{}',
    ray_memory JSONB DEFAULT '{}',
    alex_memory JSONB DEFAULT '{}',

    -- Desk metrics
    current_streak INTEGER DEFAULT 0,
    weekly_process_average NUMERIC(3,1),
    monthly_process_average NUMERIC(3,1),
    total_meetings_attended INTEGER DEFAULT 0,
    last_meeting_at TIMESTAMPTZ,

    -- Discipline tracking
    violations_this_week INTEGER DEFAULT 0,
    cooldown_until TIMESTAMPTZ,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE desk_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own desk state" ON desk_state
    FOR ALL USING (auth.uid() = user_id);

-- Auto-update timestamp trigger for desk_state
CREATE OR REPLACE FUNCTION update_desk_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER desk_state_updated_at
    BEFORE UPDATE ON desk_state
    FOR EACH ROW EXECUTE FUNCTION update_desk_state_timestamp();
