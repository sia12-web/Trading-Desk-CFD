-- Add structured monitoring columns to story_scenarios
-- These enable the scenario monitor bot to auto-resolve scenarios
-- based on candle close prices rather than spot prices.

ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS monitor_active BOOLEAN DEFAULT TRUE;
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS trigger_level NUMERIC;
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS trigger_direction VARCHAR(10); -- 'above' | 'below'
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS invalidation_level NUMERIC;
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS invalidation_direction VARCHAR(10); -- 'above' | 'below'
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS trigger_timeframe VARCHAR(5); -- 'H1' | 'H4' | 'D'
ALTER TABLE story_scenarios ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(20); -- 'manual' | 'bot' | 'expired'

-- Index for the scenario monitor cron job
CREATE INDEX IF NOT EXISTS idx_story_scenarios_monitor
    ON story_scenarios(status, monitor_active)
    WHERE status = 'active' AND monitor_active = TRUE;
