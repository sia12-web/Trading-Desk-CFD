-- ═══════════════════════════════════════════════════════════════════
-- Three-Tier Institutional Killzone — Auto Execution Log
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS killzone_auto_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair TEXT NOT NULL,

    -- Tier 1: Market State
    tier1_regime TEXT,
    tier1_cross_count INTEGER,
    tier1_atr_squeeze BOOLEAN,

    -- Tier 2: Institutional Killzone
    tier2_detected BOOLEAN,
    tier2_confidence INTEGER,
    tier2_box_high NUMERIC,
    tier2_box_low NUMERIC,
    tier2_wxy_projection NUMERIC,

    -- Tier 3: Wyckoff Spring
    tier3_triggered BOOLEAN,
    tier3_spring_volume_ratio NUMERIC,

    -- Execution
    executed BOOLEAN DEFAULT FALSE,
    dry_run BOOLEAN DEFAULT TRUE,
    direction TEXT,
    entry_price NUMERIC,
    stop_loss NUMERIC,
    take_profit_1 NUMERIC,
    take_profit_2 NUMERIC,
    units INTEGER,
    lots NUMERIC,
    risk_amount NUMERIC,
    order_id TEXT,
    blocked_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kz_auto_exec_pair ON killzone_auto_executions (pair);
CREATE INDEX idx_kz_auto_exec_created ON killzone_auto_executions (created_at DESC);
CREATE INDEX idx_kz_auto_exec_executed ON killzone_auto_executions (executed);

-- ═══════════════════════════════════════════════════════════════════
-- Extend notification_preferences with auto-execution settings
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS auto_execution_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_execution_dry_run BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_execution_max_trades_per_day INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS auto_execution_risk_amount NUMERIC DEFAULT 17,
ADD COLUMN IF NOT EXISTS auto_execution_min_confidence INTEGER DEFAULT 60;

-- ═══════════════════════════════════════════════════════════════════
-- Extend killzone_monitor_results with Tier 1 market state fields
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE killzone_monitor_results
ADD COLUMN IF NOT EXISTS market_regime TEXT,
ADD COLUMN IF NOT EXISTS ma_cross_count INTEGER,
ADD COLUMN IF NOT EXISTS atr_squeeze BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS wxy_projection NUMERIC;
