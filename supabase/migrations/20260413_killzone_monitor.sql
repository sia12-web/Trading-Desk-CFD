-- Killzone Monitor Tables
-- Automated multi-pair monitoring for Elliott Wave 2/4 completions with Telegram alerts

-- Table: killzone_monitor_results
-- Stores the latest scan results for each currency pair
-- Upserted every 15 minutes by the cron job
CREATE TABLE killzone_monitor_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- H1 Elliott Wave State
  current_wave INTEGER,  -- 1, 2, 3, 4, 5, or null
  wave_direction TEXT,   -- 'bullish', 'bearish', or null
  wave2_complete BOOLEAN DEFAULT FALSE,
  wave4_complete BOOLEAN DEFAULT FALSE,
  wave_confidence INTEGER, -- 0-100

  -- Killzone Detection
  killzone_detected BOOLEAN DEFAULT FALSE,
  killzone_box_high NUMERIC,
  killzone_box_low NUMERIC,
  killzone_box_width_pips NUMERIC,
  killzone_confidence INTEGER, -- 0-100
  killzone_fib_zone_high NUMERIC,
  killzone_fib_zone_low NUMERIC,
  killzone_volume_poc NUMERIC,
  price_in_box BOOLEAN DEFAULT FALSE,

  -- Alert Tracking (prevents duplicate alerts)
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMPTZ,

  UNIQUE(pair) -- One row per pair (upserted on each scan)
);

-- Indexes for performance
CREATE INDEX idx_killzone_monitor_pair ON killzone_monitor_results(pair);
CREATE INDEX idx_killzone_monitor_scanned ON killzone_monitor_results(scanned_at DESC);
CREATE INDEX idx_killzone_monitor_detected ON killzone_monitor_results(killzone_detected) WHERE killzone_detected = TRUE;
CREATE INDEX idx_killzone_monitor_complete ON killzone_monitor_results(wave2_complete, wave4_complete) WHERE wave2_complete = TRUE OR wave4_complete = TRUE;

-- Table: killzone_alerts
-- Historical log of all Killzone completion alerts sent
CREATE TABLE killzone_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair TEXT NOT NULL,
  wave_type INTEGER NOT NULL, -- 2 or 4
  direction TEXT NOT NULL,    -- 'bullish' or 'bearish'
  killzone_box_high NUMERIC NOT NULL,
  killzone_box_low NUMERIC NOT NULL,
  confidence INTEGER NOT NULL, -- 0-100
  telegram_sent BOOLEAN DEFAULT FALSE,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for alert history queries
CREATE INDEX idx_killzone_alerts_created ON killzone_alerts(created_at DESC);
CREATE INDEX idx_killzone_alerts_pair ON killzone_alerts(pair);
CREATE INDEX idx_killzone_alerts_wave_type ON killzone_alerts(wave_type);

-- Extend notification_preferences table
-- Add toggle for Killzone wave completion alerts
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS killzone_alerts_enabled BOOLEAN DEFAULT TRUE;

-- Comment documentation
COMMENT ON TABLE killzone_monitor_results IS 'Real-time Killzone detection results for all monitored pairs. Upserted every 15 minutes by cron job.';
COMMENT ON TABLE killzone_alerts IS 'Historical log of Telegram alerts sent when Wave 2/4 corrections complete.';
COMMENT ON COLUMN notification_preferences.killzone_alerts_enabled IS 'User opt-in for receiving Telegram alerts when Wave 2/4 corrections finish (Wave 3/5 setup ready).';
