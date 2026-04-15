-- ═══════════════════════════════════════════════════════════════════
-- Managed Trades — Split TP1/TP2 Lifecycle Tracking
--
-- Tracks auto-executed OANDA trades through their full lifecycle:
-- open → tp1_partial_closed → tp2_closed (or stopped_out / manually_closed)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS managed_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source: which auto-executor created this trade
    source TEXT NOT NULL CHECK (source IN ('regime', 'killzone')),
    source_execution_id UUID NOT NULL,

    -- Broker ID: the REAL OANDA trade ID (from tradeOpened.tradeID)
    oanda_trade_id TEXT NOT NULL,

    -- Instrument
    pair TEXT NOT NULL,
    instrument TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),

    -- Price levels
    entry_price NUMERIC NOT NULL,
    stop_loss NUMERIC NOT NULL,
    original_stop_loss NUMERIC NOT NULL,
    take_profit_1 NUMERIC NOT NULL,
    take_profit_2 NUMERIC NOT NULL,

    -- Position size
    initial_units INTEGER NOT NULL,
    current_units INTEGER NOT NULL,

    -- Lifecycle status
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'tp1_partial_closed', 'tp2_closed', 'stopped_out', 'manually_closed')),

    -- TP1 lifecycle
    tp1_hit_at TIMESTAMPTZ,
    tp1_close_price NUMERIC,
    tp1_units_closed INTEGER,
    tp1_pnl NUMERIC,

    -- Breakeven lifecycle
    breakeven_moved_at TIMESTAMPTZ,

    -- TP2 lifecycle
    tp2_hit_at TIMESTAMPTZ,
    tp2_close_price NUMERIC,
    tp2_pnl NUMERIC,

    -- Final PnL (tp1_pnl + tp2_pnl)
    final_pnl NUMERIC,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the main monitor query (runs every 1 minute)
CREATE INDEX idx_managed_trades_active ON managed_trades (status)
    WHERE status IN ('open', 'tp1_partial_closed');

-- Lookup by OANDA trade ID
CREATE INDEX idx_managed_trades_oanda_id ON managed_trades (oanda_trade_id);

-- Lookup by pair for cooldown checks
CREATE INDEX idx_managed_trades_pair ON managed_trades (pair);

-- Lookup by source execution
CREATE INDEX idx_managed_trades_source ON managed_trades (source, source_execution_id);

-- Recent trades for UI display
CREATE INDEX idx_managed_trades_created ON managed_trades (created_at DESC);
