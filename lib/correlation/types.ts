/**
 * Correlation Scenario Analysis Types
 *
 * Types for multi-currency correlation pattern detection across forex pairs.
 * Supports discovering 2-pair, 3-pair, and 4-pair correlation patterns.
 */

import type { OandaCandle } from '@/lib/types/oanda'

/**
 * Represents a significant price movement in a forex pair
 */
export interface MovementSignal {
  pair: string // e.g., 'USD/JPY'
  movement: string // e.g., 'jpy_weak', 'usd_strong', 'eur_weak'
  percentChange: number // Actual percentage change (e.g., 0.82 for 0.82%)
  threshold: number // Minimum threshold that was met (e.g., 0.5 for 0.5%)
  candle: OandaCandle // The candle where this movement occurred
}

/**
 * A condition in a correlation pattern
 */
export interface PatternCondition {
  pair: string
  movement: string
  threshold: number // Minimum percent change required
}

/**
 * Expected outcome when pattern conditions are met
 */
export interface PatternOutcome {
  pair: string
  direction: 'up' | 'down'
  minMove: number // Minimum percentage move to consider success (e.g., 0.3)
}

/**
 * A hypothesis about how multiple pair movements correlate
 */
export interface PatternHypothesis {
  conditions: PatternCondition[]
  outcome: PatternOutcome
}

/**
 * Result of validating a hypothesis outcome
 */
export interface OutcomeResult {
  success: boolean // Whether the expected outcome occurred
  pips: number // Actual pip movement in the target pair
  timeToOutcome: number // Hours until outcome materialized (or max window if failed)
  actualPercentChange: number // Actual percentage change in target pair
}

/**
 * A single occurrence of a pattern in historical data
 */
export interface PatternOccurrence {
  date: string // ISO date string
  dayOfWeek: string // 'Monday', 'Tuesday', etc.
  conditionValues: Array<{
    pair: string
    actualMove: number // Actual percentage change
  }>
  success: boolean
  pips: number
  timeToOutcome: number
}

/**
 * A discovered correlation pattern with all its historical data
 */
export interface DiscoveredPattern {
  hash: string // SHA256 hash of normalized pattern
  conditions: PatternCondition[]
  outcome: PatternOutcome
  occurrences: PatternOccurrence[]
  successCount: number
  failCount: number
  accuracy: number // 0-100 percentage
  dayDistribution: Record<string, number> // e.g., {monday: 12, tuesday: 8, ...}
}

/**
 * Accumulator for tracking pattern occurrences during discovery
 */
export interface PatternAccumulator {
  hypothesis: PatternHypothesis
  occurrences: PatternOccurrence[]
  successCount: number
  failCount: number
  dayDistribution: Record<string, number>
}

/**
 * Options for pattern discovery
 */
export interface DiscoveryOptions {
  minAccuracy: number // Minimum accuracy percentage (0-100)
  minOccurrences: number // Minimum number of historical occurrences
  maxConditions: number // Maximum number of conditions per pattern (2-4)
  moveThreshold: number // Minimum percent change to consider significant (e.g., 0.5)
  outcomeThreshold: number // Minimum percent change in outcome to consider success (e.g., 0.3)
  lookaheadDays: number // How many days to check for outcome (e.g., 5)
}

/**
 * Currency strength calculation result
 */
export interface CurrencyStrength {
  currency: string // e.g., 'USD', 'EUR', 'JPY'
  strength: number // -100 to +100
  confidence: number // 0-100 based on data quality
  contributingPairs: Array<{
    pair: string
    contribution: number
  }>
}

/**
 * Database row from correlation_scenarios table
 */
export interface CorrelationScenarioRow {
  id: string
  user_id: string
  pattern_type: 'two_pair' | 'three_pair' | 'four_pair'
  conditions: PatternCondition[]
  expected_outcome: PatternOutcome
  pattern_description: string
  pattern_hash: string
  total_occurrences: number
  successful_outcomes: number
  failed_outcomes: number
  accuracy_percentage: number
  day_distribution: Record<string, number>
  best_day: string
  avg_outcome_pips: number | null
  max_outcome_pips: number | null
  avg_time_to_outcome_hours: number | null
  first_occurrence_date: string
  last_occurrence_date: string
  date_range_analyzed: {
    start: string
    end: string
    days: number
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Database row from correlation_scenario_occurrences table
 */
export interface CorrelationOccurrenceRow {
  id: string
  scenario_id: string
  occurrence_date: string
  day_of_week: string
  condition_values: Array<{
    pair: string
    actualMove: number
  }>
  outcome_success: boolean
  outcome_pips: number | null
  outcome_time_hours: number | null
  created_at: string
}

/**
 * Database row from correlation_analysis_cache table
 */
export interface CorrelationCacheRow {
  id: string
  user_id: string
  pairs_analyzed: string[]
  date_range_start: string
  date_range_end: string
  total_patterns_discovered: number
  high_accuracy_count: number
  medium_accuracy_count: number
  low_accuracy_count: number
  computation_duration_seconds: number | null
  created_at: string
  expires_at: string
}
