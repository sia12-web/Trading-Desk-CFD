-- Add AI explanation fields to correlation_scenarios table

ALTER TABLE correlation_scenarios
ADD COLUMN IF NOT EXISTS pattern_explanation JSONB,
ADD COLUMN IF NOT EXISTS explanation_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN correlation_scenarios.pattern_explanation IS 'AI-generated explanation with fundamental_factors, narrative, confidence, key_drivers';
COMMENT ON COLUMN correlation_scenarios.explanation_generated_at IS 'When the AI explanation was last generated';
