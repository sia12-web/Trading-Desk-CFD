import { OandaCandle } from '@/lib/types/oanda'

/**
 * Elliott Wave Theory Detector
 * Identifies impulsive (5-wave) and corrective (3-wave) patterns
 * Helps narrow down market projections for fractal strategy
 */

export interface ElliottWaveAnalysis {
    waveType: 'impulsive' | 'corrective' | 'unclear'
    confidence: number // 0-100
    currentWave: string // e.g., "Wave 3", "Wave C", "Unknown"
    correctiveShape?: 'zigzag' | 'flat' | 'triangle' | 'complex' | null
    waveStructure: {
        phase: string
        description: string
    }
    projectedMove: 'bullish' | 'bearish' | 'neutral'
    keyLevels: {
        support: number[]
        resistance: number[]
    }
    fibonacciLevels: FibonacciLevels
    reasoning: string
}

export interface FibonacciLevels {
    retracements: {
        level_236: number
        level_382: number
        level_500: number
        level_618: number
        level_786: number
    }
    extensions: {
        level_1272: number
        level_1618: number
        level_2618: number
    }
    swingHigh: number
    swingLow: number
}

interface Pivot {
    index: number
    price: number
    type: 'high' | 'low'
    time: string
}

/**
 * Detect Elliott Wave patterns and classify market structure
 */
export function detectElliottWave(candles: OandaCandle[]): ElliottWaveAnalysis {
    if (candles.length < 50) {
        return getDefaultAnalysis(candles)
    }

    // Find significant pivots (swing highs and lows)
    const pivots = findSignificantPivots(candles)

    if (pivots.length < 5) {
        return getDefaultAnalysis(candles)
    }

    // Calculate Fibonacci levels from recent swing
    const fibLevels = calculateFibonacciLevels(candles)

    // Analyze wave structure
    const waveAnalysis = analyzeWaveStructure(pivots, candles)

    // Determine if impulsive or corrective
    const { waveType, correctiveShape, confidence } = classifyWaveType(pivots, candles)

    // Identify current wave position
    const currentWave = identifyCurrentWave(pivots, waveType, candles)

    // Determine projected move
    const projectedMove = determineProjectedMove(pivots, waveType, candles)

    // Extract key levels
    const keyLevels = extractKeyLevels(pivots, fibLevels)

    // Generate reasoning
    const reasoning = generateReasoning(waveType, correctiveShape, currentWave, pivots, fibLevels)

    return {
        waveType,
        confidence,
        currentWave,
        correctiveShape,
        waveStructure: waveAnalysis,
        projectedMove,
        keyLevels,
        fibonacciLevels: fibLevels,
        reasoning
    }
}

/**
 * Find significant swing pivots using zigzag-like approach
 */
function findSignificantPivots(candles: OandaCandle[], threshold: number = 0.003): Pivot[] {
    const pivots: Pivot[] = []
    const closes = candles.map(c => parseFloat(c.mid.c))
    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))

    let lastPivotType: 'high' | 'low' | null = null
    let lastPivotPrice = closes[0]

    for (let i = 5; i < candles.length - 5; i++) {
        const isHigh = highs[i] > highs[i - 1] && highs[i] > highs[i + 1] &&
                       highs[i] > highs[i - 2] && highs[i] > highs[i + 2]
        const isLow = lows[i] < lows[i - 1] && lows[i] < lows[i + 1] &&
                      lows[i] < lows[i - 2] && lows[i] < lows[i + 2]

        if (isHigh) {
            const change = Math.abs(highs[i] - lastPivotPrice) / lastPivotPrice
            if (change >= threshold && lastPivotType !== 'high') {
                pivots.push({
                    index: i,
                    price: highs[i],
                    type: 'high',
                    time: candles[i].time
                })
                lastPivotPrice = highs[i]
                lastPivotType = 'high'
            }
        } else if (isLow) {
            const change = Math.abs(lows[i] - lastPivotPrice) / lastPivotPrice
            if (change >= threshold && lastPivotType !== 'low') {
                pivots.push({
                    index: i,
                    price: lows[i],
                    type: 'low',
                    time: candles[i].time
                })
                lastPivotPrice = lows[i]
                lastPivotType = 'low'
            }
        }
    }

    return pivots.slice(-10) // Keep last 10 significant pivots
}

/**
 * Calculate Fibonacci retracement and extension levels
 */
function calculateFibonacciLevels(candles: OandaCandle[]): FibonacciLevels {
    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))

    // Find recent swing high and low (last 50 candles)
    const recentCandles = candles.slice(-50)
    const recentHighs = recentCandles.map(c => parseFloat(c.mid.h))
    const recentLows = recentCandles.map(c => parseFloat(c.mid.l))

    const swingHigh = Math.max(...recentHighs)
    const swingLow = Math.min(...recentLows)
    const range = swingHigh - swingLow

    return {
        retracements: {
            level_236: swingHigh - (range * 0.236),
            level_382: swingHigh - (range * 0.382),
            level_500: swingHigh - (range * 0.500),
            level_618: swingHigh - (range * 0.618),
            level_786: swingHigh - (range * 0.786),
        },
        extensions: {
            level_1272: swingHigh + (range * 0.272),
            level_1618: swingHigh + (range * 0.618),
            level_2618: swingHigh + (range * 1.618),
        },
        swingHigh,
        swingLow
    }
}

/**
 * Analyze wave structure and provide description
 */
function analyzeWaveStructure(pivots: Pivot[], candles: OandaCandle[]) {
    const recentPivots = pivots.slice(-5)
    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)

    if (recentPivots.length < 3) {
        return { phase: 'Early', description: 'Insufficient pivot data for wave analysis' }
    }

    const lastPivot = recentPivots[recentPivots.length - 1]
    const isUptrend = lastPivot.type === 'high'

    if (recentPivots.length === 5) {
        return {
            phase: 'Potential 5-Wave Complete',
            description: `Five pivot structure detected. ${isUptrend ? 'Upward' : 'Downward'} impulsive pattern may be completing.`
        }
    }

    return {
        phase: 'In Progress',
        description: `${recentPivots.length} pivots identified. Wave structure developing.`
    }
}

/**
 * Classify wave type: impulsive (5-wave) or corrective (3-wave)
 */
function classifyWaveType(pivots: Pivot[], candles: OandaCandle[]) {
    const recentPivots = pivots.slice(-7)

    if (recentPivots.length < 5) {
        return { waveType: 'unclear' as const, correctiveShape: null, confidence: 30 }
    }

    // Check for 5-wave impulsive structure
    // Impulsive: alternating high-low pattern with strong directional bias
    const isImpulsive = checkImpulsivePattern(recentPivots)
    if (isImpulsive) {
        return { waveType: 'impulsive' as const, correctiveShape: null, confidence: 70 }
    }

    // Check for 3-wave corrective structure
    const correctiveShape = identifyCorrectiveShape(recentPivots)
    if (correctiveShape) {
        return { waveType: 'corrective' as const, correctiveShape, confidence: 65 }
    }

    return { waveType: 'unclear' as const, correctiveShape: null, confidence: 40 }
}

/**
 * Check if pivot pattern matches impulsive 5-wave structure
 */
function checkImpulsivePattern(pivots: Pivot[]): boolean {
    if (pivots.length < 5) return false

    const last5 = pivots.slice(-5)

    // Impulsive: strong directional movement with clear impulse waves
    // Wave 3 should be strongest, Wave 4 shouldn't overlap Wave 1
    const moves = []
    for (let i = 1; i < last5.length; i++) {
        moves.push(Math.abs(last5[i].price - last5[i - 1].price))
    }

    // Wave 3 typically longest
    const maxMove = Math.max(...moves)
    const maxMoveIndex = moves.indexOf(maxMove)

    // Wave 3 is usually in the middle (index 2 of 4 moves)
    return maxMoveIndex === 2 || maxMoveIndex === 1
}

/**
 * Identify corrective wave shape (Zigzag, Flat, Triangle, Complex)
 */
function identifyCorrectiveShape(pivots: Pivot[]): 'zigzag' | 'flat' | 'triangle' | 'complex' | null {
    if (pivots.length < 3) return null

    const last3 = pivots.slice(-3)
    const rangeA = Math.abs(last3[1].price - last3[0].price)
    const rangeB = Math.abs(last3[2].price - last3[1].price)
    const ratio = rangeB / rangeA

    // Zigzag: sharp correction (A-B-C where C extends beyond A)
    if (ratio > 0.8 && ratio < 1.2) {
        return 'zigzag'
    }

    // Flat: sideways correction (A-B-C approximately equal)
    if (ratio > 0.6 && ratio < 0.9) {
        return 'flat'
    }

    // Triangle: contracting ranges
    if (ratio < 0.6) {
        return 'triangle'
    }

    // Complex: irregular structure
    return 'complex'
}

/**
 * Identify current wave position
 */
function identifyCurrentWave(pivots: Pivot[], waveType: string, candles: OandaCandle[]): string {
    if (waveType === 'impulsive') {
        const pivotCount = pivots.length
        if (pivotCount >= 5) return 'Wave 5 or completion'
        if (pivotCount === 4) return 'Wave 4'
        if (pivotCount === 3) return 'Wave 3'
        return 'Early impulse (Wave 1-2)'
    }

    if (waveType === 'corrective') {
        const pivotCount = pivots.length
        if (pivotCount >= 3) return 'Wave C or completion'
        if (pivotCount === 2) return 'Wave B'
        return 'Wave A'
    }

    return 'Unknown'
}

/**
 * Determine projected move based on wave structure
 */
function determineProjectedMove(pivots: Pivot[], waveType: string, candles: OandaCandle[]): 'bullish' | 'bearish' | 'neutral' {
    if (pivots.length < 2) return 'neutral'

    const lastPivot = pivots[pivots.length - 1]
    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)

    if (waveType === 'impulsive') {
        // If recent high pivot, expect continuation or reversal at Wave 5
        if (lastPivot.type === 'high') return 'bearish' // Potential reversal
        return 'bullish' // Continuation expected
    }

    if (waveType === 'corrective') {
        // Corrections move against the trend, then resume
        if (lastPivot.type === 'low') return 'bullish' // Correction ending
        return 'bearish' // Correction continuing
    }

    return 'neutral'
}

/**
 * Extract key support and resistance levels
 */
function extractKeyLevels(pivots: Pivot[], fib: FibonacciLevels) {
    const resistance = pivots
        .filter(p => p.type === 'high')
        .map(p => p.price)
        .sort((a, b) => b - a)
        .slice(0, 3)

    const support = pivots
        .filter(p => p.type === 'low')
        .map(p => p.price)
        .sort((a, b) => a - b)
        .slice(0, 3)

    // Add Fibonacci levels to key levels
    resistance.push(fib.extensions.level_1618, fib.extensions.level_1272)
    support.push(fib.retracements.level_618, fib.retracements.level_500, fib.retracements.level_382)

    return {
        resistance: [...new Set(resistance)].sort((a, b) => b - a).slice(0, 5),
        support: [...new Set(support)].sort((a, b) => a - b).slice(0, 5)
    }
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
    waveType: string,
    correctiveShape: string | null | undefined,
    currentWave: string,
    pivots: Pivot[],
    fib: FibonacciLevels
): string {
    const parts = []

    if (waveType === 'impulsive') {
        parts.push(`Market shows impulsive 5-wave structure (${currentWave}).`)
        parts.push(`Strong directional movement suggests trend continuation or completion.`)
    } else if (waveType === 'corrective') {
        parts.push(`Market in corrective phase (${correctiveShape} pattern, ${currentWave}).`)
        parts.push(`Expect counter-trend movement before resuming primary trend.`)
    } else {
        parts.push(`Wave structure unclear. Monitoring for clearer pattern development.`)
    }

    // Add Fibonacci context
    const lastPivotPrice = pivots[pivots.length - 1]?.price || 0
    const currentInFibZone = checkFibonacciZone(lastPivotPrice, fib)
    if (currentInFibZone) {
        parts.push(`Price near key Fibonacci ${currentInFibZone} level - watch for reaction.`)
    }

    return parts.join(' ')
}

/**
 * Check if price is near a Fibonacci level
 */
function checkFibonacciZone(price: number, fib: FibonacciLevels): string | null {
    const tolerance = (fib.swingHigh - fib.swingLow) * 0.02 // 2% tolerance

    if (Math.abs(price - fib.retracements.level_618) < tolerance) return '61.8% retracement'
    if (Math.abs(price - fib.retracements.level_500) < tolerance) return '50% retracement'
    if (Math.abs(price - fib.retracements.level_382) < tolerance) return '38.2% retracement'
    if (Math.abs(price - fib.extensions.level_1618) < tolerance) return '161.8% extension'

    return null
}

/**
 * Default analysis when insufficient data
 */
function getDefaultAnalysis(candles: OandaCandle[]): ElliottWaveAnalysis {
    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)

    return {
        waveType: 'unclear',
        confidence: 20,
        currentWave: 'Insufficient data',
        correctiveShape: null,
        waveStructure: {
            phase: 'Early',
            description: 'Not enough price data for Elliott Wave analysis'
        },
        projectedMove: 'neutral',
        keyLevels: { support: [], resistance: [] },
        fibonacciLevels: {
            retracements: {
                level_236: currentPrice,
                level_382: currentPrice,
                level_500: currentPrice,
                level_618: currentPrice,
                level_786: currentPrice,
            },
            extensions: {
                level_1272: currentPrice,
                level_1618: currentPrice,
                level_2618: currentPrice,
            },
            swingHigh: currentPrice,
            swingLow: currentPrice
        },
        reasoning: 'Insufficient historical data for Elliott Wave analysis. Need more price history.'
    }
}
