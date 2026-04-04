/**
 * Correlation Integration for Story AI
 *
 * Fetches active correlation patterns and predictions to enhance
 * Desk analysis and position guidance.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CorrelationInsight } from './types'
import type { OandaPrice } from '@/lib/types/oanda'
import { getCurrentPrices, getCandles } from '@/lib/oanda/client'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'
import { predictTomorrow } from '@/lib/correlation/predictor'

/**
 * Fetch correlation insights for the Story AI system
 */
export async function getCorrelationInsights(
  client: SupabaseClient,
  userId: string,
  currentPair: string
): Promise<CorrelationInsight | null> {
  try {
    // Step 1: Fetch high-accuracy patterns (≥60%)
    const { data: scenarios, error } = await client
      .from('correlation_scenarios')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('accuracy_percentage', 60)
      .order('accuracy_percentage', { ascending: false, nullsFirst: false })
      .limit(50) // Top 50 patterns

    if (error || !scenarios || scenarios.length === 0) {
      console.log('[CorrelationIntegrator] No patterns found')
      return null
    }

    // Step 2: Fetch current market prices
    const instruments = VALID_PAIRS.map(p => p.replace('/', '_'))
    const { data: pricesData } = await getCurrentPrices(instruments)

    if (!pricesData) {
      console.log('[CorrelationIntegrator] Failed to fetch prices')
      return null
    }

    const currentPrices = new Map(
      pricesData.map(p => [p.instrument.replace('_', '/'), p])
    )

    // Step 3: Fetch previous close for each pair
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
          // Skip this pair if candles fail
        }
      })
    )

    // Step 4: Find active patterns (conditions currently met)
    const activePatterns = []

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

      // Include patterns with ≥50% conditions met (looser for Story context)
      if (matchPercentage >= 50) {
        const outcome = scenario.expected_outcome as {
          pair: string
          direction: string
          minMove: number
        }

        activePatterns.push({
          id: scenario.id,
          description: scenario.pattern_description,
          accuracy: scenario.accuracy_percentage,
          occurrences: scenario.total_occurrences,
          expectedOutcome: outcome,
          conditionsMet,
          totalConditions: conditions.length,
          matchPercentage
        })
      }
    }

    console.log(`[CorrelationIntegrator] Found ${activePatterns.length} active patterns`)

    // Step 5: Get tomorrow's predictions (only if we have active patterns)
    let tomorrowPredictions

    if (activePatterns.length > 0) {
      try {
        const prediction = await predictTomorrow(scenarios, currentPrices, previousClose)

        if (prediction.topPredictions.length > 0) {
          tomorrowPredictions = {
            topPredictions: prediction.topPredictions,
            confidence: prediction.confidence,
            aiSynthesis: prediction.aiSynthesis
          }
        }
      } catch (error) {
        console.error('[CorrelationIntegrator] Prediction failed:', error)
        // Continue without predictions
      }
    }

    return {
      activePatterns,
      tomorrowPredictions
    }
  } catch (error) {
    console.error('[CorrelationIntegrator] Error:', error)
    return null
  }
}
