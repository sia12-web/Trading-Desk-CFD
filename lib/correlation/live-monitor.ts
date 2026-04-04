/**
 * Live Pattern Monitor
 *
 * Checks current market conditions against discovered patterns
 * to detect when pattern conditions are being met in real-time.
 */

import { getCurrentPrices } from '@/lib/oanda/client'
import type { OandaPrice } from '@/lib/types/oanda'
import type { CorrelationScenarioRow, PatternCondition } from './types'
import { createClient } from '@/lib/supabase/server'

export interface ActivePattern {
  scenario: CorrelationScenarioRow
  conditionsMet: number // 0 to conditions.length
  conditionsMetPercent: number
  currentValues: Array<{
    pair: string
    currentChange: number
    required: number
    met: boolean
  }>
  readyToTrade: boolean // All conditions met
}

/**
 * Check all high-accuracy patterns against current market conditions
 */
export async function monitorActivePatterns(
  userId: string,
  minAccuracy: number = 70
): Promise<ActivePattern[]> {
  const client = await createClient()

  // Get high-accuracy patterns
  const { data: scenarios, error } = await client
    .from('correlation_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gte('accuracy_percentage', minAccuracy)
    .order('accuracy_percentage', { ascending: false })

  if (error || !scenarios) {
    console.error('[LiveMonitor] Error fetching scenarios:', error)
    return []
  }

  // Get all unique pairs from all patterns
  const allPairs = new Set<string>()
  for (const scenario of scenarios) {
    for (const condition of scenario.conditions as PatternCondition[]) {
      allPairs.add(condition.pair)
    }
  }

  // Fetch current prices for all pairs
  const instruments = Array.from(allPairs).map(p => p.replace('/', '_'))
  const { data: prices } = await getCurrentPrices(instruments)

  if (!prices) {
    console.error('[LiveMonitor] Failed to fetch current prices')
    return []
  }

  // Create price map for quick lookup
  const priceMap = new Map<string, OandaPrice>()
  for (const price of prices) {
    const pair = price.instrument.replace('_', '/')
    priceMap.set(pair, price)
  }

  // Check each pattern
  const activePatterns: ActivePattern[] = []

  for (const scenario of scenarios) {
    const conditions = scenario.conditions as PatternCondition[]
    let conditionsMet = 0
    const currentValues: ActivePattern['currentValues'] = []

    for (const condition of conditions) {
      const price = priceMap.get(condition.pair)
      if (!price) continue

      // Calculate daily change percentage
      // Note: For real-time, we'd need previous day's close
      // For now, using ask-bid spread as proxy for movement detection
      const mid = (parseFloat(price.asks[0].price) + parseFloat(price.bids[0].price)) / 2

      // TODO: Store previous close in Redis cache for accurate daily % calculation
      // For now, mark as "pending" if price exists
      const currentChange = 0 // Placeholder - needs historical close

      const met = Math.abs(currentChange) >= condition.threshold
      if (met) conditionsMet++

      currentValues.push({
        pair: condition.pair,
        currentChange,
        required: condition.threshold,
        met
      })
    }

    const conditionsMetPercent = (conditionsMet / conditions.length) * 100
    const readyToTrade = conditionsMet === conditions.length

    activePatterns.push({
      scenario,
      conditionsMet,
      conditionsMetPercent,
      currentValues,
      readyToTrade
    })
  }

  // Sort by conditions met (most complete first)
  return activePatterns.sort((a, b) => b.conditionsMetPercent - a.conditionsMetPercent)
}

/**
 * Calculate daily percentage change for a pair
 * Requires previous close price (stored in cache/database)
 */
export function calculateDailyChange(
  currentPrice: number,
  previousClose: number
): number {
  return ((currentPrice - previousClose) / previousClose) * 100
}

/**
 * Store pattern trigger alert
 */
export async function recordPatternTrigger(
  userId: string,
  scenarioId: string,
  currentValues: ActivePattern['currentValues']
): Promise<void> {
  const client = await createClient()

  await client.from('pattern_triggers').insert({
    user_id: userId,
    scenario_id: scenarioId,
    trigger_time: new Date().toISOString(),
    condition_values: currentValues,
    status: 'triggered'
  })
}
