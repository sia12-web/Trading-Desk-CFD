/**
 * Pattern Detector Engine for Correlation Analysis
 *
 * Discovers multi-currency correlation patterns by analyzing historical movements
 * across all forex pairs simultaneously.
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type {
  MovementSignal,
  PatternCondition,
  PatternOutcome,
  PatternHypothesis,
  OutcomeResult,
  DiscoveredPattern,
  PatternOccurrence,
  PatternAccumulator,
  DiscoveryOptions,
  CurrencyStrength
} from './types'
import crypto from 'crypto'

// Currency list for strength calculations
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD']

/**
 * Calculate the strength of a currency based on its performance across all pairs
 */
export function calculateCurrencyStrength(
  currency: string,
  allPairCandles: Map<string, OandaCandle[]>,
  dayIndex: number
): CurrencyStrength {
  const contributingPairs: Array<{ pair: string; contribution: number }> = []
  let totalContribution = 0
  let pairCount = 0

  for (const [pair, candles] of allPairCandles.entries()) {
    if (dayIndex >= candles.length) continue

    const candle = candles[dayIndex]
    const open = parseFloat(candle.mid.o)
    const close = parseFloat(candle.mid.c)
    const change = ((close - open) / open) * 100

    // Check if currency is base or quote
    const [base, quote] = pair.split('/')

    let contribution = 0
    if (base === currency) {
      // If base currency strengthens, pair goes up
      contribution = change
    } else if (quote === currency) {
      // If quote currency strengthens, pair goes down
      contribution = -change
    } else {
      continue // Currency not in this pair
    }

    contributingPairs.push({ pair, contribution })
    totalContribution += contribution
    pairCount++
  }

  // Average strength across all pairs
  const avgStrength = pairCount > 0 ? totalContribution / pairCount : 0
  const normalizedStrength = Math.max(-100, Math.min(100, avgStrength * 20)) // Scale to -100 to +100

  // Confidence based on number of pairs analyzed
  const confidence = Math.min(100, (pairCount / 5) * 100)

  return {
    currency,
    strength: normalizedStrength,
    confidence,
    contributingPairs
  }
}

/**
 * Detect significant price movements on a given day
 */
export function detectSignificantMoves(
  allPairCandles: Map<string, OandaCandle[]>,
  dayIndex: number,
  threshold: number = 0.5
): MovementSignal[] {
  const signals: MovementSignal[] = []

  for (const [pair, candles] of allPairCandles.entries()) {
    if (dayIndex >= candles.length) continue

    const candle = candles[dayIndex]
    const open = parseFloat(candle.mid.o)
    const close = parseFloat(candle.mid.c)
    const percentChange = ((close - open) / open) * 100

    if (Math.abs(percentChange) >= threshold) {
      const [base, quote] = pair.split('/')

      // Determine movement type
      let movement: string
      if (percentChange > 0) {
        movement = `${base.toLowerCase()}_strong_${quote.toLowerCase()}_weak`
      } else {
        movement = `${base.toLowerCase()}_weak_${quote.toLowerCase()}_strong`
      }

      signals.push({
        pair,
        movement,
        percentChange: Math.abs(percentChange),
        threshold,
        candle
      })
    }
  }

  return signals
}

/**
 * Generate pattern hypotheses from multiple moving pairs
 */
export function generateHypotheses(
  movingPairs: MovementSignal[],
  allPairs: string[],
  maxConditions: number = 4
): PatternHypothesis[] {
  const hypotheses: PatternHypothesis[] = []

  // Generate 2-pair, 3-pair, and 4-pair combinations
  for (let conditionCount = 2; conditionCount <= Math.min(maxConditions, movingPairs.length); conditionCount++) {
    const combinations = getCombinations(movingPairs, conditionCount)

    for (const combo of combinations) {
      const conditions: PatternCondition[] = combo.map(signal => ({
        pair: signal.pair,
        movement: signal.movement,
        threshold: signal.threshold
      }))

      // For each combination, generate hypotheses for other pairs
      const conditionPairs = new Set(combo.map(s => s.pair))
      const targetPairs = allPairs.filter(p => !conditionPairs.has(p))

      for (const targetPair of targetPairs) {
        // Predict direction based on currency correlations
        const predictedDirection = predictOutcomeDirection(combo, targetPair)

        if (predictedDirection) {
          hypotheses.push({
            conditions,
            outcome: {
              pair: targetPair,
              direction: predictedDirection,
              minMove: 0.3 // 0.3% minimum movement to consider success
            }
          })
        }
      }
    }
  }

  return hypotheses
}

/**
 * Predict outcome direction based on currency correlations
 */
function predictOutcomeDirection(
  conditions: MovementSignal[],
  targetPair: string
): 'up' | 'down' | null {
  const [targetBase, targetQuote] = targetPair.split('/')

  let baseScore = 0
  let quoteScore = 0

  for (const condition of conditions) {
    const [condBase, condQuote] = condition.pair.split('/')
    const isStrong = condition.percentChange > 0

    // Analyze effect on target base currency
    if (condBase === targetBase) {
      baseScore += isStrong ? 1 : -1
    } else if (condQuote === targetBase) {
      baseScore += isStrong ? -1 : 1
    }

    // Analyze effect on target quote currency
    if (condBase === targetQuote) {
      quoteScore += isStrong ? 1 : -1
    } else if (condQuote === targetQuote) {
      quoteScore += isStrong ? -1 : 1
    }
  }

  const netScore = baseScore - quoteScore

  if (netScore > 0) return 'up' // Base strengthening relative to quote
  if (netScore < 0) return 'down' // Quote strengthening relative to base
  return null // No clear direction
}

/**
 * Get all combinations of N items from array
 */
function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size > arr.length) return []
  if (size === 1) return arr.map(item => [item])

  const result: T[][] = []

  for (let i = 0; i < arr.length - size + 1; i++) {
    const head = arr[i]
    const tailCombos = getCombinations(arr.slice(i + 1), size - 1)
    for (const combo of tailCombos) {
      result.push([head, ...combo])
    }
  }

  return result
}

/**
 * Validate hypothesis outcome over next N days
 */
export function validateOutcome(
  hypothesis: PatternHypothesis,
  allPairCandles: Map<string, OandaCandle[]>,
  startIndex: number,
  lookaheadDays: number = 5
): OutcomeResult {
  const targetCandles = allPairCandles.get(hypothesis.outcome.pair)
  if (!targetCandles || startIndex >= targetCandles.length - 1) {
    return { success: false, pips: 0, timeToOutcome: lookaheadDays * 24, actualPercentChange: 0 }
  }

  const startCandle = targetCandles[startIndex]
  const startPrice = parseFloat(startCandle.mid.c)

  // Check each subsequent day for outcome
  for (let offset = 1; offset <= lookaheadDays && (startIndex + offset) < targetCandles.length; offset++) {
    const futureCandle = targetCandles[startIndex + offset]
    const futurePrice = parseFloat(futureCandle.mid.c)
    const percentChange = ((futurePrice - startPrice) / startPrice) * 100

    const actualDirection = percentChange > 0 ? 'up' : 'down'
    const expectedDirection = hypothesis.outcome.direction

    if (
      actualDirection === expectedDirection &&
      Math.abs(percentChange) >= hypothesis.outcome.minMove
    ) {
      // Success!
      const pips = calculatePips(hypothesis.outcome.pair, Math.abs(futurePrice - startPrice))
      return {
        success: true,
        pips,
        timeToOutcome: offset * 24,
        actualPercentChange: percentChange
      }
    }
  }

  // Failed to meet outcome within window
  return { success: false, pips: 0, timeToOutcome: lookaheadDays * 24, actualPercentChange: 0 }
}

/**
 * Calculate pips from price difference
 */
function calculatePips(pair: string, priceDiff: number): number {
  if (pair.includes('JPY')) {
    return priceDiff * 100 // JPY pairs: 0.01 = 1 pip
  } else if (pair.includes('XAU') || pair.includes('NAS100') || pair.includes('SPX500') || pair.includes('US30') || pair.includes('DE30')) {
    return priceDiff * 10 // Indices/Gold: 0.1 = 1 point
  } else {
    return priceDiff * 10000 // Standard pairs: 0.0001 = 1 pip
  }
}

/**
 * Hash a pattern hypothesis for deduplication
 */
export function hashPattern(hypothesis: PatternHypothesis): string {
  // Normalize: sort conditions alphabetically, round thresholds
  const normalized = {
    conditions: hypothesis.conditions
      .map(c => ({
        pair: c.pair,
        movement: c.movement,
        threshold: Math.round(c.threshold * 10) / 10
      }))
      .sort((a, b) => a.pair.localeCompare(b.pair)),
    outcome: {
      pair: hypothesis.outcome.pair,
      direction: hypothesis.outcome.direction,
      minMove: Math.round(hypothesis.outcome.minMove * 10) / 10
    }
  }

  const str = JSON.stringify(normalized)
  return crypto.createHash('sha256').update(str).digest('hex')
}

/**
 * Main pattern discovery function
 */
export async function discoverCorrelationPatterns(
  allPairCandles: Map<string, OandaCandle[]>,
  options: DiscoveryOptions
): Promise<DiscoveredPattern[]> {
  console.log('[PatternDetector] Starting correlation pattern discovery...')
  console.log('[PatternDetector] Options:', options)

  const patterns = new Map<string, PatternAccumulator>()
  const allPairs = Array.from(allPairCandles.keys())

  // Determine minimum candle count across all pairs
  let minCandleCount = Infinity
  for (const candles of allPairCandles.values()) {
    minCandleCount = Math.min(minCandleCount, candles.length)
  }

  console.log(`[PatternDetector] Analyzing ${minCandleCount} days across ${allPairs.length} pairs...`)

  // Analyze each day
  for (let dayIndex = 0; dayIndex < minCandleCount - options.lookaheadDays; dayIndex++) {
    if (dayIndex % 20 === 0) {
      console.log(`[PatternDetector] Progress: ${dayIndex}/${minCandleCount} days analyzed...`)
    }

    // Step 1: Detect significant moves
    const moves = detectSignificantMoves(allPairCandles, dayIndex, options.moveThreshold)

    if (moves.length < 2) continue // Need at least 2 moving pairs

    // Step 2: Generate hypotheses
    const hypotheses = generateHypotheses(moves, allPairs, options.maxConditions)

    // Step 3: Validate each hypothesis
    for (const hypothesis of hypotheses) {
      const outcome = validateOutcome(hypothesis, allPairCandles, dayIndex, options.lookaheadDays)

      // Step 4: Track occurrence
      const hash = hashPattern(hypothesis)
      if (!patterns.has(hash)) {
        patterns.set(hash, {
          hypothesis,
          occurrences: [],
          successCount: 0,
          failCount: 0,
          dayDistribution: {}
        })
      }

      const pattern = patterns.get(hash)!
      const candle = allPairCandles.get(allPairs[0])![dayIndex]
      const date = candle.time.split('T')[0]
      const dayOfWeek = new Date(candle.time).toLocaleDateString('en-US', { weekday: 'long' })

      pattern.occurrences.push({
        date,
        dayOfWeek,
        conditionValues: hypothesis.conditions.map(c => ({
          pair: c.pair,
          actualMove: moves.find(m => m.pair === c.pair)?.percentChange || 0
        })),
        success: outcome.success,
        pips: outcome.pips,
        timeToOutcome: outcome.timeToOutcome
      })

      if (outcome.success) pattern.successCount++
      else pattern.failCount++

      pattern.dayDistribution[dayOfWeek.toLowerCase()] =
        (pattern.dayDistribution[dayOfWeek.toLowerCase()] || 0) + 1
    }
  }

  console.log(`[PatternDetector] Found ${patterns.size} unique patterns before filtering`)

  // Step 5: Filter and format results
  const discoveredPatterns: DiscoveredPattern[] = []

  for (const [hash, accumulator] of patterns.entries()) {
    const totalOccurrences = accumulator.occurrences.length
    if (totalOccurrences < options.minOccurrences) continue

    const accuracy = (accumulator.successCount / totalOccurrences) * 100
    if (accuracy < options.minAccuracy) continue

    discoveredPatterns.push({
      hash,
      conditions: accumulator.hypothesis.conditions,
      outcome: accumulator.hypothesis.outcome,
      occurrences: accumulator.occurrences,
      successCount: accumulator.successCount,
      failCount: accumulator.failCount,
      accuracy,
      dayDistribution: accumulator.dayDistribution
    })
  }

  console.log(`[PatternDetector] ✓ Discovered ${discoveredPatterns.length} patterns meeting criteria`)
  console.log(`[PatternDetector] Accuracy ≥${options.minAccuracy}%, Occurrences ≥${options.minOccurrences}`)

  return discoveredPatterns
}

/**
 * Generate human-readable description of a pattern
 */
export function generatePatternDescription(pattern: DiscoveredPattern): string {
  const conditionDescriptions = pattern.conditions.map(c => {
    const [base, quote] = c.pair.split('/')
    if (c.movement.includes('strong')) {
      const strong = c.movement.includes(base.toLowerCase() + '_strong') ? base : quote
      const weak = strong === base ? quote : base
      return `${strong} strengthens vs ${weak}`
    }
    return `${c.pair} moves`
  })

  const outcomeDesc = `${pattern.outcome.pair} moves ${pattern.outcome.direction}`

  return `When ${conditionDescriptions.join(' AND ')}, then ${outcomeDesc}`
}
