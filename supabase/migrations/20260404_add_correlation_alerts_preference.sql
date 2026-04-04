-- Add correlation_alerts_enabled field to notification_preferences

ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS correlation_alerts_enabled BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN notification_preferences.correlation_alerts_enabled IS
'Enable real-time Telegram alerts when correlation patterns trigger (≥75% conditions met)';
