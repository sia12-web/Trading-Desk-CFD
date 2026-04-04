/**
 * Correlation Analysis Pipeline
 *
 * Orchestrates the full correlation analysis workflow as a background task.
 */

import { createClient } from '@/lib/supabase/server'
import { updateProgress, completeTask, failTask } from '@/lib/background-tasks/manager'
import { fetchAllPairCandles, validateCandleData } from './data-fetcher'
import { discoverCorrelationPatterns } from './pattern-detector'
import { storePatterns, updateCache } from './storage'
import type { DiscoveryOptions } from './types'

/**
 * Run the complete correlation analysis pipeline
 *
 * @param userId - User ID running the analysis
 * @param pairs - Array of pair names to analyze
 * @param lookbackDays - Number of days to analyze (default: 200)
 * @param taskId - Background task ID for progress tracking
 */
export async function runCorrelationAnalysis(
  userId: string,
  pairs: string[],
  lookbackDays: number,
  taskId: string
): Promise<void> {
  const client = await createClient()
  const startTime = Date.now()

  console.log(`[CorrelationPipeline] Starting analysis for user ${userId}`)
  console.log(`[CorrelationPipeline] Pairs: ${pairs.length}, Lookback: ${lookbackDays} days`)

  try {
    // Step 1: Fetch historical candles (0% → 20%)
    await updateProgress(taskId, 5, 'Fetching historical data from OANDA...', client)
    const allCandles = await fetchAllPairCandles(pairs, lookbackDays)

    // Validate data
    const validation = validateCandleData(allCandles, 100)
    if (!validation.isValid) {
      throw new Error(`Insufficient candle data: ${validation.message}`)
    }

    console.log(`[CorrelationPipeline] ✓ ${validation.message}`)
    await updateProgress(taskId, 20, 'Historical data fetched successfully', client)

    // Step 2: Discover patterns (20% → 90%)
    await updateProgress(taskId, 25, 'Mining correlation patterns...', client)

    const options: DiscoveryOptions = {
      minAccuracy: 55,
      minOccurrences: 15,
      maxConditions: 4,
      moveThreshold: 0.5,
      outcomeThreshold: 0.3,
      lookaheadDays: 5
    }

    const patterns = await discoverCorrelationPatterns(allCandles, options)

    await updateProgress(taskId, 85, `Discovered ${patterns.length} patterns`, client)

    // Step 3: Store patterns in database (90% → 95%)
    await updateProgress(taskId, 90, 'Storing patterns in database...', client)

    // Determine date range from candles
    const firstPairCandles = allCandles.get(pairs[0])
    if (!firstPairCandles || firstPairCandles.length === 0) {
      throw new Error('No candles available for date range calculation')
    }

    const dateRangeStart = firstPairCandles[0].time.split('T')[0]
    const dateRangeEnd = firstPairCandles[firstPairCandles.length - 1].time.split('T')[0]

    await storePatterns(
      client,
      userId,
      patterns,
      dateRangeStart,
      dateRangeEnd,
      firstPairCandles.length
    )

    await updateProgress(taskId, 95, 'Patterns stored successfully', client)

    // Step 4: Update cache (95% → 100%)
    await updateProgress(taskId, 97, 'Updating cache...', client)

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000)

    await updateCache(
      client,
      userId,
      pairs,
      dateRangeStart,
      dateRangeEnd,
      patterns,
      durationSeconds
    )

    // Complete task
    await completeTask(
      taskId,
      {
        total_patterns: patterns.length,
        high_accuracy_patterns: patterns.filter(p => p.accuracy >= 70).length,
        medium_accuracy_patterns: patterns.filter(p => p.accuracy >= 60 && p.accuracy < 70).length,
        low_accuracy_patterns: patterns.filter(p => p.accuracy >= 55 && p.accuracy < 60).length,
        duration_seconds: durationSeconds,
        pairs_analyzed: pairs.length,
        date_range: {
          start: dateRangeStart,
          end: dateRangeEnd,
          days: firstPairCandles.length
        }
      },
      client
    )

    console.log(`[CorrelationPipeline] ✓ Analysis complete in ${durationSeconds}s`)
    console.log(`[CorrelationPipeline] Discovered ${patterns.length} patterns`)
  } catch (error) {
    console.error('[CorrelationPipeline] Analysis failed:', error)

    await failTask(
      taskId,
      error instanceof Error ? error.message : 'Unknown error occurred',
      client
    )

    throw error
  }
}
