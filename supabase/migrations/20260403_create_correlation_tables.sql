-- Correlation Scenario Analysis Tables
-- Stores multi-currency correlation patterns discovered through historical data mining

-- Table 1: correlation_scenarios
-- Stores discovered patterns with historical performance metrics
CREATE TABLE correlation_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Pattern structure
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('two_pair', 'three_pair', 'four_pair')),
    conditions JSONB NOT NULL, -- [{pair: 'USD/JPY', movement: 'jpy_weak', threshold: 0.5}, ...]
    expected_outcome JSONB NOT NULL, -- {pair: 'EUR/JPY', direction: 'down', minMove: 0.3}
    pattern_description TEXT NOT NULL, -- Human-readable explanation
    pattern_hash VARCHAR(64) NOT NULL, -- SHA256 for deduplication

    -- Performance metrics
    total_occurrences INTEGER NOT NULL DEFAULT 0,
    successful_outcomes INTEGER NOT NULL DEFAULT 0,
    failed_outcomes INTEGER NOT NULL DEFAULT 0,
    accuracy_percentage NUMERIC(5,2) NOT NULL,

    -- Day-of-week analytics
    day_distribution JSONB NOT NULL DEFAULT '{}', -- {monday: 12, tuesday: 8, ...}
    best_day VARCHAR(10),

    -- Movement analytics
    avg_outcome_pips NUMERIC(8,2),
    max_outcome_pips NUMERIC(8,2),
    avg_time_to_outcome_hours INTEGER,

    -- Date range
    first_occurrence_date DATE,
    last_occurrence_date DATE,
    date_range_analyzed JSONB, -- {start: '2024-06-01', end: '2026-04-03', days: 200}

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per user (allow same pattern hash for different users)
    CONSTRAINT unique_user_pattern_hash UNIQUE (user_id, pattern_hash)
);

-- RLS for correlation_scenarios
ALTER TABLE correlation_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own scenarios"
    ON correlation_scenarios
    FOR ALL
    USING (auth.uid() = user_id);

-- Indexes for correlation_scenarios
CREATE INDEX idx_correlation_scenarios_user_active
    ON correlation_scenarios(user_id, is_active);
CREATE INDEX idx_correlation_scenarios_accuracy
    ON correlation_scenarios(accuracy_percentage DESC)
    WHERE accuracy_percentage >= 55.0;
CREATE INDEX idx_correlation_scenarios_type
    ON correlation_scenarios(pattern_type);
CREATE INDEX idx_correlation_scenarios_hash
    ON correlation_scenarios(pattern_hash);
CREATE INDEX idx_correlation_scenarios_best_day
    ON correlation_scenarios(best_day)
    WHERE best_day IS NOT NULL;

-- Table 2: correlation_scenario_occurrences
-- Stores individual historical occurrences for drill-down analysis
CREATE TABLE correlation_scenario_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES correlation_scenarios(id) ON DELETE CASCADE,

    occurrence_date DATE NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,

    -- Condition values at occurrence
    condition_values JSONB NOT NULL, -- [{pair: 'USD/JPY', actualMove: 0.82}, ...]

    -- Outcome tracking
    outcome_success BOOLEAN NOT NULL,
    outcome_pips NUMERIC(8,2),
    outcome_time_hours INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for correlation_scenario_occurrences
ALTER TABLE correlation_scenario_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own occurrences"
    ON correlation_scenario_occurrences
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM correlation_scenarios
        WHERE correlation_scenarios.id = scenario_id
        AND correlation_scenarios.user_id = auth.uid()
    ));

-- Indexes for correlation_scenario_occurrences
CREATE INDEX idx_correlation_occurrences_scenario
    ON correlation_scenario_occurrences(scenario_id);
CREATE INDEX idx_correlation_occurrences_date
    ON correlation_scenario_occurrences(occurrence_date DESC);
CREATE INDEX idx_correlation_occurrences_day
    ON correlation_scenario_occurrences(day_of_week);

-- Table 3: correlation_analysis_cache
-- Tracks when analysis was last run to enable 7-day caching
CREATE TABLE correlation_analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    pairs_analyzed TEXT[] NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,

    total_patterns_discovered INTEGER NOT NULL,
    high_accuracy_count INTEGER NOT NULL, -- ≥70%
    medium_accuracy_count INTEGER NOT NULL, -- 60-69%
    low_accuracy_count INTEGER NOT NULL, -- 55-59%

    computation_duration_seconds INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL, -- created_at + 7 days

    CONSTRAINT unique_user_cache UNIQUE(user_id)
);

-- RLS for correlation_analysis_cache
ALTER TABLE correlation_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own cache"
    ON correlation_analysis_cache
    FOR ALL
    USING (auth.uid() = user_id);

-- Index for correlation_analysis_cache
CREATE INDEX idx_correlation_cache_expires
    ON correlation_analysis_cache(expires_at);
CREATE INDEX idx_correlation_cache_user
    ON correlation_analysis_cache(user_id);
