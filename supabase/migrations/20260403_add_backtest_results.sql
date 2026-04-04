-- Add backtest results field to correlation_scenarios table

ALTER TABLE correlation_scenarios
ADD COLUMN IF NOT EXISTS backtest_results JSONB;

COMMENT ON COLUMN correlation_scenarios.backtest_results IS 'Backtest metrics, DeepSeek analysis, recommendations, equity curve';
