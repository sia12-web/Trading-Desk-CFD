-- GIN index for efficient JSONB containment queries on desk_messages.context_data
CREATE INDEX IF NOT EXISTS idx_desk_messages_context_gin ON desk_messages USING GIN (context_data);
