/**
 * Real-Time Pattern Monitor
 *
 * Detects when correlation patterns trigger and sends Telegram alerts
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentPrices, getCandles } from '@/lib/oanda/client'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'
import type { CorrelationScenarioRow } from './types'

export interface PatternTrigger {
  pattern: CorrelationScenarioRow
  matchPercentage: number
  conditionsMet: number
  totalConditions: number
  expectedOutcome: {
    pair: string
    direction: string
    expectedMove: number
  }
  currentSession: 'asian' | 'london' | 'newyork' | 'overlap'
  urgency: 'immediate' | 'high' | 'medium'
  triggerTime: string
}

/**
 * Get current trading session based on UTC time
 */
function getCurrentSession(): 'asian' | 'london' | 'newyork' | 'overlap' {
  const now = new Date()
  const utcHour = now.getUTCHours()

  // Asian session: 23:00 - 08:00 UTC
  if (utcHour >= 23 || utcHour < 8) {
    // Check for London overlap (06:00-08:00 UTC)
    if (utcHour >= 6 && utcHour < 8) return 'overlap'
    return 'asian'
  }

  // London session: 08:00 - 17:00 UTC
  if (utcHour >= 8 && utcHour < 17) {
    // Check for NY overlap (13:00-17:00 UTC)
    if (utcHour >= 13 && utcHour < 17) return 'overlap'
    return 'london'
  }

  // New York session: 13:00 - 22:00 UTC
  if (utcHour >= 13 && utcHour < 22) return 'newyork'

  return 'london' // fallback
}

/**
 * Monitor patterns and detect triggers
 */
export async function monitorPatternTriggers(
  userId: string
): Promise<PatternTrigger[]> {
  const client = await createClient()

  // Fetch high-accuracy patterns
  const { data: scenarios, error } = await client
    .from('correlation_scenarios')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gte('accuracy_percentage', 65) // Only monitor patterns ≥65% accurate
    .order('accuracy_percentage', { ascending: false, nullsFirst: false })

  if (error || !scenarios || scenarios.length === 0) {
    return []
  }

  // Fetch current prices
  const instruments = VALID_PAIRS.map(p => p.replace('/', '_'))
  const { data: pricesData } = await getCurrentPrices(instruments)

  if (!pricesData) return []

  const currentPrices = new Map(
    pricesData.map(p => [p.instrument.replace('_', '/'), p])
  )

  // Fetch previous close
  const previousClose = new Map<string, number>()

  await Promise.all(
    VALID_PAIRS.map(async pair => {
      try {
        const { data: candles } = await getCandles({
          instrument: pair.replace('/', '_'),
          granularity: 'D',
          count: 2,
          price: 'M'
        })

        if (candles && candles.length >= 2) {
          const prevClose = parseFloat(candles[candles.length - 2].mid.c)
          previousClose.set(pair, prevClose)
        }
      } catch (error) {
        // Skip
      }
    })
  )

  // Detect triggers
  const triggers: PatternTrigger[] = []
  const currentSession = getCurrentSession()

  for (const scenario of scenarios) {
    const conditions = scenario.conditions as Array<{
      pair: string
      movement: string
      threshold: number
    }>

    let conditionsMet = 0

    for (const condition of conditions) {
      const price = currentPrices.get(condition.pair)
      const prevClose = previousClose.get(condition.pair)

      if (!price || !prevClose) continue

      const mid = (parseFloat(price.asks[0].price) + parseFloat(price.bids[0].price)) / 2
      const changePercent = ((mid - prevClose) / prevClose) * 100

      const movement = condition.movement
      const isNegative = movement.includes('weak') || movement.includes('down')
      const expectedSign = isNegative ? -1 : 1
      const actualSign = changePercent < 0 ? -1 : 1

      const met =
        expectedSign === actualSign &&
        Math.abs(changePercent) >= condition.threshold

      if (met) conditionsMet++
    }

    const matchPercentage = (conditionsMet / conditions.length) * 100

    // Trigger threshold: 75% of conditions met
    if (matchPercentage >= 75) {
      const outcome = scenario.expected_outcome as {
        pair: string
        direction: string
        minMove: number
      }

      // Determine urgency
      let urgency: 'immediate' | 'high' | 'medium' = 'medium'
      if (matchPercentage >= 90) urgency = 'immediate'
      else if (matchPercentage >= 80) urgency = 'high'

      triggers.push({
        pattern: scenario,
        matchPercentage,
        conditionsMet,
        totalConditions: conditions.length,
        expectedOutcome: {
          pair: outcome.pair,
          direction: outcome.direction,
          expectedMove: outcome.minMove * 100 // Convert to percentage
        },
        currentSession,
        urgency,
        triggerTime: new Date().toISOString()
      })
    }
  }

  return triggers
}

/**
 * Format pattern trigger for Telegram message
 */
export function formatTriggerMessage(trigger: PatternTrigger): string {
  const { pattern, matchPercentage, conditionsMet, totalConditions, expectedOutcome, currentSession, urgency } = trigger

  const urgencyEmoji = urgency === 'immediate' ? '🚨' : urgency === 'high' ? '⚡' : '📊'
  const sessionEmoji = currentSession === 'overlap' ? '🔥' : currentSession === 'london' ? '🇬🇧' : currentSession === 'newyork' ? '🇺🇸' : '🌏'

  return `${urgencyEmoji} **PATTERN TRIGGER** ${urgencyEmoji}

**${pattern.pattern_description}**

📍 **Expected Outcome:**
${expectedOutcome.pair} → ${expectedOutcome.direction.toUpperCase()} by ~${expectedOutcome.expectedMove.toFixed(1)}%

✅ **Pattern Strength:**
• Accuracy: ${pattern.accuracy_percentage.toFixed(1)}% (${pattern.total_occurrences} occurrences)
• Conditions Met: ${conditionsMet}/${totalConditions} (${matchPercentage.toFixed(0)}%)
• Urgency: ${urgency.toUpperCase()}

🌍 **Trading Session:** ${currentSession.toUpperCase()}${currentSession === 'overlap' ? ' (High Volatility!)' : ''}

⏰ **Act Fast:** Patterns triggered during session overlaps often move quickly. Consider entering within the next 1-2 hours.

📈 **Historical Stats:**
• Win Rate: ${pattern.accuracy_percentage.toFixed(1)}%
• Avg Move: ${pattern.avg_outcome_pips?.toFixed(1) || 'N/A'} pips
• Best Day: ${pattern.best_day}

🎯 **Action:** Review this pattern in Correlation Scenarios → Consider position entry`
}
