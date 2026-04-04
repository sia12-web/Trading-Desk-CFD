/**
 * Data Fetcher for Correlation Analysis
 *
 * Fetches historical daily candles for all forex pairs in parallel from OANDA.
 */

import { getCandles } from '@/lib/oanda/client'
import type { OandaCandle } from '@/lib/types/oanda'

/**
 * Fetches historical daily candles for all specified pairs in parallel
 *
 * @param pairs - Array of pair names in format 'EUR/USD', 'GBP/JPY', etc.
 * @param lookbackDays - Number of daily candles to fetch (default: 200)
 * @returns Map of pair name to candle array
 */
export async function fetchAllPairCandles(
  pairs: string[],
  lookbackDays: number = 200
): Promise<Map<string, OandaCandle[]>> {
  const results = new Map<string, OandaCandle[]>()

  console.log(`[CorrelationDataFetcher] Fetching ${lookbackDays} daily candles for ${pairs.length} pairs...`)

  // Fetch all pairs in parallel for maximum performance
  const fetchPromises = pairs.map(async (pair) => {
    const instrument = pair.replace('/', '_')

    try {
      const { data, error } = await getCandles({
        instrument,
        granularity: 'D', // Daily candles
        count: lookbackDays,
        price: 'M' // Mid prices
      })

      if (error) {
        console.error(`[CorrelationDataFetcher] Error fetching ${pair}:`, error)
        return { pair, candles: [] }
      }

      if (!data || data.length === 0) {
        console.warn(`[CorrelationDataFetcher] No candles returned for ${pair}`)
        return { pair, candles: [] }
      }

      console.log(`[CorrelationDataFetcher] ✓ Fetched ${data.length} candles for ${pair}`)
      return { pair, candles: data }
    } catch (err) {
      console.error(`[CorrelationDataFetcher] Exception fetching ${pair}:`, err)
      return { pair, candles: [] }
    }
  })

  // Wait for all fetches to complete
  const fetchResults = await Promise.all(fetchPromises)

  // Build results map
  for (const { pair, candles } of fetchResults) {
    results.set(pair, candles)
  }

  const successCount = Array.from(results.values()).filter(c => c.length > 0).length
  console.log(`[CorrelationDataFetcher] Completed: ${successCount}/${pairs.length} pairs fetched successfully`)

  return results
}

/**
 * Validates that all pairs have sufficient candle data for analysis
 *
 * @param candleMap - Map of pair to candles
 * @param minCandles - Minimum required candles per pair (default: 100)
 * @returns Object with isValid flag and list of insufficient pairs
 */
export function validateCandleData(
  candleMap: Map<string, OandaCandle[]>,
  minCandles: number = 100
): { isValid: boolean; insufficientPairs: string[]; message: string } {
  const insufficientPairs: string[] = []

  for (const [pair, candles] of candleMap.entries()) {
    if (candles.length < minCandles) {
      insufficientPairs.push(`${pair} (${candles.length} candles)`)
    }
  }

  const isValid = insufficientPairs.length === 0

  const message = isValid
    ? `All ${candleMap.size} pairs have sufficient data (≥${minCandles} candles)`
    : `${insufficientPairs.length} pairs have insufficient data: ${insufficientPairs.join(', ')}`

  return { isValid, insufficientPairs, message }
}
