/**
 * H1 Elliott Wave Detection System
 * Identifies which wave (1-5) and position within wave (0-100%)
 * Only trades beginning of Wave 3 and Wave 5 (0-20% progress)
 */

import type { OandaCandle } from '@/lib/types/oanda'

export interface H1WaveState {
    currentWave: 1 | 2 | 3 | 4 | 5 | 'unknown'
    waveProgress: number           // 0-100% completion
    tradeEligible: boolean         // true only if Wave 3 or 5 at 0-20%
    direction: 'bullish' | 'bearish' | 'unclear'

    // Wave structure
    wave1Start: number | null
    wave1End: number | null
    wave2End: number | null
    wave3Target: number | null
    wave4End: number | null
    wave5Target: number | null

    // Current position
    currentPrice: number
    waveStartPrice: number | null
    waveTargetPrice: number | null
    invalidationPrice: number | null   // Stop level - if hit, wave is wrong

    // Confirmations
    confidence: number              // 0-100%
    confirmations: {
        fibRatio: boolean           // Wave length matches Fibonacci
        volumeConfirm: boolean      // Volume pattern correct
        rsiConfirm: boolean         // RSI behavior correct
        macdConfirm: boolean        // MACD alignment
        structureIntact: boolean    // No invalidation
        wave2Complete: boolean      // Wave 2 correction finished (if in Wave 3)
        wave4Complete: boolean      // Wave 4 correction finished (if in Wave 5)
    }

    // Corrective wave analysis (for Wave 2/4)
    correctivePattern: 'abc' | 'zigzag' | 'flat' | 'triangle' | 'simple' | 'unknown'
    correctiveCompleteConfidence: number  // 0-100% confidence that Wave 2/4 is truly finished

    // Details
    narrative: string
    signals: string[]
}

interface SwingPoint {
    index: number
    price: number
    type: 'high' | 'low'
    volume: number
}

/**
 * Detect H1 Elliott Wave structure
 */
export function detectH1ElliottWave(
    candles: OandaCandle[],
    rsi: number[],
    macdLine: number[],
    macdSignal: number[]
): H1WaveState {
    if (candles.length < 50) {
        return createUnknownWaveState(candles)
    }

    // Step 1: Find swing points (zigzag)
    const swings = findSwingPoints(candles, 5) // 5-candle swing detection

    if (swings.length < 5) {
        return createUnknownWaveState(candles)
    }

    // Step 2: Identify wave structure
    const direction = determineDirection(swings)

    if (direction === 'unclear') {
        return createUnknownWaveState(candles)
    }

    // Step 3: Map swings to Elliott Wave structure
    const waveStructure = mapSwingsToWaves(swings, direction, candles)

    // Step 4: Validate with Fibonacci ratios
    const fibValidation = validateFibonacciRatios(waveStructure, direction)

    // Step 4.5: Check if Wave 2/4 corrections are complete
    const correctiveCompletion = detectCorrectiveCompletion(candles, rsi, macdLine, waveStructure, direction)

    // Step 5: Confirm with volume, RSI, MACD
    const confirmations = validateConfirmations(
        waveStructure,
        candles,
        rsi,
        macdLine,
        macdSignal,
        direction,
        correctiveCompletion
    )

    // Step 6: Calculate wave progress
    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)
    const waveProgress = calculateWaveProgress(waveStructure, currentPrice, direction)

    // Step 7: Determine trade eligibility
    const tradeEligible = isTradeEligible(
        waveStructure.currentWave,
        waveProgress,
        confirmations,
        fibValidation.confidence
    )

    return {
        currentWave: waveStructure.currentWave,
        waveProgress,
        tradeEligible,
        direction,

        wave1Start: waveStructure.wave1Start,
        wave1End: waveStructure.wave1End,
        wave2End: waveStructure.wave2End,
        wave3Target: waveStructure.wave3Target,
        wave4End: waveStructure.wave4End,
        wave5Target: waveStructure.wave5Target,

        currentPrice,
        waveStartPrice: waveStructure.waveStartPrice,
        waveTargetPrice: waveStructure.waveTargetPrice,
        invalidationPrice: waveStructure.invalidationPrice,

        confidence: fibValidation.confidence,
        confirmations,

        correctivePattern: correctiveCompletion.pattern,
        correctiveCompleteConfidence: correctiveCompletion.confidence,

        narrative: buildNarrative(waveStructure, waveProgress, tradeEligible, direction),
        signals: buildSignals(waveStructure, waveProgress, confirmations, tradeEligible)
    }
}

/**
 * Find swing highs and lows (ZigZag)
 */
function findSwingPoints(candles: OandaCandle[], lookback: number): SwingPoint[] {
    const swings: SwingPoint[] = []

    for (let i = lookback; i < candles.length - lookback; i++) {
        const high = parseFloat(candles[i].mid.h)
        const low = parseFloat(candles[i].mid.l)
        const volume = candles[i].volume

        // Check for swing high
        let isSwingHigh = true
        for (let j = 1; j <= lookback; j++) {
            if (high <= parseFloat(candles[i - j].mid.h) || high <= parseFloat(candles[i + j].mid.h)) {
                isSwingHigh = false
                break
            }
        }
        if (isSwingHigh) {
            swings.push({ index: i, price: high, type: 'high', volume })
        }

        // Check for swing low
        let isSwingLow = true
        for (let j = 1; j <= lookback; j++) {
            if (low >= parseFloat(candles[i - j].mid.l) || low >= parseFloat(candles[i + j].mid.l)) {
                isSwingLow = false
                break
            }
        }
        if (isSwingLow) {
            swings.push({ index: i, price: low, type: 'low', volume })
        }
    }

    return swings.sort((a, b) => a.index - b.index)
}

/**
 * Determine overall trend direction
 */
function determineDirection(swings: SwingPoint[]): 'bullish' | 'bearish' | 'unclear' {
    if (swings.length < 4) return 'unclear'

    const recentSwings = swings.slice(-6) // Last 6 swings
    const highs = recentSwings.filter(s => s.type === 'high')
    const lows = recentSwings.filter(s => s.type === 'low')

    if (highs.length < 2 || lows.length < 2) return 'unclear'

    // Check for higher highs and higher lows (bullish)
    const lastHigh = highs[highs.length - 1].price
    const prevHigh = highs[highs.length - 2].price
    const lastLow = lows[lows.length - 1].price
    const prevLow = lows[lows.length - 2].price

    if (lastHigh > prevHigh && lastLow > prevLow) return 'bullish'
    if (lastHigh < prevHigh && lastLow < prevLow) return 'bearish'

    return 'unclear'
}

interface WaveStructure {
    currentWave: 1 | 2 | 3 | 4 | 5 | 'unknown'
    wave1Start: number | null
    wave1End: number | null
    wave2End: number | null
    wave3Target: number | null
    wave4End: number | null
    wave5Target: number | null
    waveStartPrice: number | null
    waveTargetPrice: number | null
    invalidationPrice: number | null
}

/**
 * Map swing points to Elliott Wave labels
 */
function mapSwingsToWaves(
    swings: SwingPoint[],
    direction: 'bullish' | 'bearish' | 'unclear',
    candles: OandaCandle[]
): WaveStructure {
    if (swings.length < 5 || direction === 'unclear') {
        return {
            currentWave: 'unknown',
            wave1Start: null,
            wave1End: null,
            wave2End: null,
            wave3Target: null,
            wave4End: null,
            wave5Target: null,
            waveStartPrice: null,
            waveTargetPrice: null,
            invalidationPrice: null
        }
    }

    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)

    // Take last 5 significant swings
    const relevantSwings = swings.slice(-5)

    if (direction === 'bullish') {
        // Bullish: Low, High, Low, High, Low pattern
        // Wave 0 (start), Wave 1 peak, Wave 2 low, Wave 3 peak, Wave 4 low
        const wave0 = relevantSwings.find(s => s.type === 'low')?.price ?? currentPrice
        const wave1Peak = relevantSwings.find(s => s.type === 'high')?.price ?? null
        const wave2Low = relevantSwings.filter(s => s.type === 'low')[1]?.price ?? null
        const wave3Peak = relevantSwings.filter(s => s.type === 'high')[1]?.price ?? null
        const wave4Low = relevantSwings.filter(s => s.type === 'low')[2]?.price ?? null

        // Determine current wave based on price position
        let currentWave: 1 | 2 | 3 | 4 | 5 | 'unknown' = 'unknown'
        let waveStartPrice: number | null = null
        let waveTargetPrice: number | null = null
        let invalidationPrice: number | null = null

        if (wave1Peak && !wave2Low) {
            // In Wave 1
            currentWave = 1
            waveStartPrice = wave0
            waveTargetPrice = wave0 + (wave0 * 0.05) // Estimate 5% move
            invalidationPrice = wave0
        } else if (wave1Peak && wave2Low && currentPrice < wave1Peak && currentPrice >= wave2Low) {
            // In Wave 2
            currentWave = 2
            waveStartPrice = wave1Peak
            waveTargetPrice = wave1Peak - ((wave1Peak - wave0) * 0.618) // 61.8% retrace target
            invalidationPrice = wave0 // If price goes below Wave 0, structure invalid
        } else if (wave2Low && currentPrice > wave1Peak!) {
            // In Wave 3
            currentWave = 3
            waveStartPrice = wave2Low
            const wave1Length = wave1Peak! - wave0
            waveTargetPrice = wave2Low + (wave1Length * 1.618) // 161.8% extension
            invalidationPrice = wave2Low
        } else if (wave3Peak && wave4Low && currentPrice < wave3Peak) {
            // In Wave 4
            currentWave = 4
            waveStartPrice = wave3Peak
            const wave3Length = wave3Peak - wave2Low!
            waveTargetPrice = wave3Peak - (wave3Length * 0.382) // 38.2% retrace target
            invalidationPrice = wave1Peak! // Wave 4 must not overlap Wave 1
        } else if (wave4Low && currentPrice > wave3Peak!) {
            // In Wave 5
            currentWave = 5
            waveStartPrice = wave4Low
            const fullRange = wave3Peak! - wave0
            waveTargetPrice = wave4Low + fullRange // 100% projection
            invalidationPrice = wave4Low
        }

        const wave3Target = wave2Low ? wave2Low + ((wave1Peak! - wave0) * 1.618) : null
        const wave5Target = wave4Low && wave3Peak ? wave4Low + (wave3Peak - wave0) : null

        return {
            currentWave,
            wave1Start: wave0,
            wave1End: wave1Peak,
            wave2End: wave2Low,
            wave3Target,
            wave4End: wave4Low,
            wave5Target,
            waveStartPrice,
            waveTargetPrice,
            invalidationPrice
        }
    } else {
        // Bearish: High, Low, High, Low, High pattern
        const wave0 = relevantSwings.find(s => s.type === 'high')?.price ?? currentPrice
        const wave1Low = relevantSwings.find(s => s.type === 'low')?.price ?? null
        const wave2High = relevantSwings.filter(s => s.type === 'high')[1]?.price ?? null
        const wave3Low = relevantSwings.filter(s => s.type === 'low')[1]?.price ?? null
        const wave4High = relevantSwings.filter(s => s.type === 'high')[2]?.price ?? null

        let currentWave: 1 | 2 | 3 | 4 | 5 | 'unknown' = 'unknown'
        let waveStartPrice: number | null = null
        let waveTargetPrice: number | null = null
        let invalidationPrice: number | null = null

        if (wave1Low && !wave2High) {
            currentWave = 1
            waveStartPrice = wave0
            waveTargetPrice = wave0 - (wave0 * 0.05)
            invalidationPrice = wave0
        } else if (wave1Low && wave2High && currentPrice > wave1Low && currentPrice <= wave2High) {
            currentWave = 2
            waveStartPrice = wave1Low
            waveTargetPrice = wave1Low + ((wave0 - wave1Low) * 0.618)
            invalidationPrice = wave0
        } else if (wave2High && currentPrice < wave1Low!) {
            currentWave = 3
            waveStartPrice = wave2High
            const wave1Length = wave0 - wave1Low!
            waveTargetPrice = wave2High - (wave1Length * 1.618)
            invalidationPrice = wave2High
        } else if (wave3Low && wave4High && currentPrice > wave3Low) {
            currentWave = 4
            waveStartPrice = wave3Low
            const wave3Length = wave2High! - wave3Low
            waveTargetPrice = wave3Low + (wave3Length * 0.382)
            invalidationPrice = wave1Low!
        } else if (wave4High && currentPrice < wave3Low!) {
            currentWave = 5
            waveStartPrice = wave4High
            const fullRange = wave0 - wave3Low!
            waveTargetPrice = wave4High - fullRange
            invalidationPrice = wave4High
        }

        const wave3Target = wave2High ? wave2High - ((wave0 - wave1Low!) * 1.618) : null
        const wave5Target = wave4High && wave3Low ? wave4High - (wave0 - wave3Low) : null

        return {
            currentWave,
            wave1Start: wave0,
            wave1End: wave1Low,
            wave2End: wave2High,
            wave3Target,
            wave4End: wave4High,
            wave5Target,
            waveStartPrice,
            waveTargetPrice,
            invalidationPrice
        }
    }
}

/**
 * Detect if Wave 2 or Wave 4 correction is complete
 * Wave 2/4 can be complex (ABC, zigzag, flat, triangle)
 * We need to ensure they're FINISHED before signaling Wave 3/5 entry
 */
function detectCorrectiveCompletion(
    candles: OandaCandle[],
    rsi: number[],
    macdLine: number[],
    structure: WaveStructure,
    direction: 'bullish' | 'bearish' | 'unclear'
): {
    wave2Complete: boolean
    wave4Complete: boolean
    pattern: 'abc' | 'zigzag' | 'flat' | 'triangle' | 'simple' | 'unknown'
    confidence: number
} {
    if (direction === 'unclear') {
        return { wave2Complete: false, wave4Complete: false, pattern: 'unknown', confidence: 0 }
    }

    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)
    const latestRSI = rsi[rsi.length - 1]
    const latestMACD = macdLine[macdLine.length - 1]

    // Check Wave 2 completion (if we're in or past Wave 2)
    let wave2Complete = false
    let wave2Confidence = 0
    if (typeof structure.currentWave === 'number' && structure.currentWave >= 2 && structure.wave1End && structure.wave2End) {
        const wave1Length = Math.abs(structure.wave1End - structure.wave1Start!)
        const wave2Retrace = Math.abs(structure.wave2End - structure.wave1End) / wave1Length

        // Wave 2 complete if:
        // 1. Retraced 50-78.6% (deep enough)
        // 2. Price reversed back in Wave 1 direction
        // 3. RSI showing reversal
        // 4. MACD showing reversal

        const retracedEnough = wave2Retrace >= 0.50 && wave2Retrace <= 0.786

        let priceReversed = false
        if (direction === 'bullish') {
            priceReversed = currentPrice > structure.wave2End
        } else {
            priceReversed = currentPrice < structure.wave2End
        }

        const rsiReversed = direction === 'bullish' ? latestRSI > 50 : latestRSI < 50
        const macdReversed = direction === 'bullish'
            ? latestMACD > macdLine[macdLine.length - 2]
            : latestMACD < macdLine[macdLine.length - 2]

        wave2Confidence = [retracedEnough, priceReversed, rsiReversed, macdReversed]
            .filter(Boolean).length * 25

        wave2Complete = wave2Confidence >= 75 // Need 3 of 4 confirmations
    }

    // Check Wave 4 completion (if we're in or past Wave 4)
    let wave4Complete = false
    let wave4Confidence = 0
    if (typeof structure.currentWave === 'number' && structure.currentWave >= 4 && structure.wave3Target && structure.wave4End) {
        const wave3Length = structure.wave3Target - structure.wave2End!
        const wave4Retrace = Math.abs(structure.wave4End - structure.wave3Target) / wave3Length

        // Wave 4 complete if:
        // 1. Retraced 23.6-50% (shallower than Wave 2)
        // 2. Did NOT overlap Wave 1 (Elliott Rule)
        // 3. Price reversed back in Wave 3 direction
        // 4. RSI/MACD showing reversal

        const retracedEnough = wave4Retrace >= 0.236 && wave4Retrace <= 0.50

        const noOverlap = direction === 'bullish'
            ? structure.wave4End > structure.wave1End!
            : structure.wave4End < structure.wave1End!

        let priceReversed = false
        if (direction === 'bullish') {
            priceReversed = currentPrice > structure.wave4End
        } else {
            priceReversed = currentPrice < structure.wave4End
        }

        const rsiReversed = direction === 'bullish' ? latestRSI > 50 : latestRSI < 50

        wave4Confidence = [retracedEnough, noOverlap, priceReversed, rsiReversed]
            .filter(Boolean).length * 25

        wave4Complete = wave4Confidence >= 75 // Need 3 of 4 confirmations
    }

    // Detect corrective pattern type (simplified - full detection would need more data)
    let pattern: 'abc' | 'zigzag' | 'flat' | 'triangle' | 'simple' | 'unknown' = 'simple'
    if (structure.currentWave === 2 || structure.currentWave === 4) {
        const retrace = structure.currentWave === 2
            ? (structure.wave2End && structure.wave1End ? Math.abs(structure.wave2End - structure.wave1End) / Math.abs(structure.wave1End - structure.wave1Start!) : 0)
            : 0

        if (retrace > 0.618) pattern = 'zigzag' // Deep sharp correction
        else if (retrace > 0.50) pattern = 'abc' // Regular ABC
        else if (retrace > 0.236) pattern = 'flat' // Shallow consolidation
        else pattern = 'simple'
    }

    const overallConfidence = Math.max(wave2Confidence, wave4Confidence)

    return {
        wave2Complete,
        wave4Complete,
        pattern,
        confidence: overallConfidence
    }
}

/**
 * Validate Fibonacci ratios
 */
function validateFibonacciRatios(
    structure: WaveStructure,
    direction: 'bullish' | 'bearish' | 'unclear'
): { valid: boolean; confidence: number } {
    if (structure.currentWave === 'unknown' || !structure.wave1Start || !structure.wave1End) {
        return { valid: false, confidence: 0 }
    }

    const wave1Length = Math.abs(structure.wave1End - structure.wave1Start)
    let confidence = 50 // Base confidence

    // Check Wave 2 retrace (should be 50-61.8% of Wave 1)
    if (structure.wave2End && structure.currentWave >= 2) {
        const wave2Retrace = Math.abs(structure.wave2End - structure.wave1End) / wave1Length
        if (wave2Retrace >= 0.50 && wave2Retrace <= 0.618) {
            confidence += 15
        } else if (wave2Retrace >= 0.382 && wave2Retrace <= 0.786) {
            confidence += 5
        }
    }

    // Check Wave 3 extension (should be ~161.8% of Wave 1)
    if (structure.wave3Target && structure.currentWave >= 3 && structure.wave2End) {
        const wave3Length = Math.abs(structure.wave3Target - structure.wave2End)
        const wave3Ratio = wave3Length / wave1Length
        if (wave3Ratio >= 1.50 && wave3Ratio <= 1.80) {
            confidence += 20
        } else if (wave3Ratio >= 1.00 && wave3Ratio <= 2.00) {
            confidence += 10
        }
    }

    // Check Wave 4 retrace (should be 38.2% of Wave 3, not overlap Wave 1)
    if (structure.wave4End && structure.currentWave >= 4) {
        // Wave 4 should not overlap Wave 1 peak/trough
        const noOverlap = direction === 'bullish'
            ? structure.wave4End > structure.wave1End
            : structure.wave4End < structure.wave1End

        if (noOverlap) {
            confidence += 15
        } else {
            confidence -= 20 // Major violation
        }
    }

    return {
        valid: confidence >= 60,
        confidence: Math.min(100, Math.max(0, confidence))
    }
}

/**
 * Validate confirmations (volume, RSI, MACD, structure)
 */
function validateConfirmations(
    structure: WaveStructure,
    candles: OandaCandle[],
    rsi: number[],
    macdLine: number[],
    macdSignal: number[],
    direction: 'bullish' | 'bearish' | 'unclear',
    correctiveCompletion: ReturnType<typeof detectCorrectiveCompletion>
): H1WaveState['confirmations'] {
    const latestRSI = rsi[rsi.length - 1]
    const latestMACD = macdLine[macdLine.length - 1]
    const latestSignal = macdSignal[macdSignal.length - 1]

    // Volume confirmation
    const recentVolumes = candles.slice(-10).map(c => c.volume)
    const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length
    const currentVolume = candles[candles.length - 1].volume

    let volumeConfirm = false
    if (structure.currentWave === 3) {
        volumeConfirm = currentVolume > avgVolume * 1.3 // Wave 3 should have strong volume
    } else if (structure.currentWave === 5) {
        volumeConfirm = currentVolume < avgVolume * 1.5 // Wave 5 often has lower volume (divergence)
    } else {
        volumeConfirm = true // Neutral for other waves
    }

    // RSI confirmation
    let rsiConfirm = false
    if (direction === 'bullish') {
        if (structure.currentWave === 3) {
            rsiConfirm = latestRSI > 50 && latestRSI < 80 // Strong but not overbought
        } else if (structure.currentWave === 5) {
            rsiConfirm = latestRSI > 50 // May show divergence
        } else {
            rsiConfirm = true
        }
    } else {
        if (structure.currentWave === 3) {
            rsiConfirm = latestRSI < 50 && latestRSI > 20
        } else if (structure.currentWave === 5) {
            rsiConfirm = latestRSI < 50
        } else {
            rsiConfirm = true
        }
    }

    // MACD confirmation
    const macdConfirm = direction === 'bullish'
        ? latestMACD > latestSignal
        : latestMACD < latestSignal

    // Structure intact (price hasn't hit invalidation level)
    const currentPrice = parseFloat(candles[candles.length - 1].mid.c)
    let structureIntact = true
    if (structure.invalidationPrice) {
        if (direction === 'bullish') {
            structureIntact = currentPrice > structure.invalidationPrice
        } else {
            structureIntact = currentPrice < structure.invalidationPrice
        }
    }

    // Fibonacci ratio validation
    const { valid: fibRatio } = validateFibonacciRatios(structure, direction)

    return {
        fibRatio,
        volumeConfirm,
        rsiConfirm,
        macdConfirm,
        structureIntact,
        wave2Complete: correctiveCompletion.wave2Complete,
        wave4Complete: correctiveCompletion.wave4Complete
    }
}

/**
 * Calculate wave progress (0-100%)
 */
function calculateWaveProgress(
    structure: WaveStructure,
    currentPrice: number,
    direction: 'bullish' | 'bearish' | 'unclear'
): number {
    if (!structure.waveStartPrice || !structure.waveTargetPrice) return 0

    const waveRange = Math.abs(structure.waveTargetPrice - structure.waveStartPrice)
    const currentProgress = Math.abs(currentPrice - structure.waveStartPrice)

    const progress = (currentProgress / waveRange) * 100
    return Math.min(100, Math.max(0, progress))
}

/**
 * Determine if trade eligible
 * Only Wave 3 or 5 at 0-20% progress with high confidence
 * CRITICAL: Wave 2 or Wave 4 must be COMPLETE before entering Wave 3 or Wave 5
 */
function isTradeEligible(
    currentWave: 1 | 2 | 3 | 4 | 5 | 'unknown',
    waveProgress: number,
    confirmations: H1WaveState['confirmations'],
    confidence: number
): boolean {
    // Must be Wave 3 or 5
    if (currentWave !== 3 && currentWave !== 5) return false

    // CRITICAL: If Wave 3, Wave 2 must be COMPLETE
    // If Wave 5, Wave 4 must be COMPLETE
    // This prevents entering too early when correction is still ongoing
    if (currentWave === 3 && !confirmations.wave2Complete) return false
    if (currentWave === 5 && !confirmations.wave4Complete) return false

    // Must be in first 20% of wave (beginning only)
    if (waveProgress > 20) return false

    // Must have high confidence (70%+)
    if (confidence < 70) return false

    // Structure must be intact
    if (!confirmations.structureIntact) return false

    // Fibonacci ratios must validate
    if (!confirmations.fibRatio) return false

    // At least 2 of 3 other confirmations must pass
    const otherConfirms = [
        confirmations.volumeConfirm,
        confirmations.rsiConfirm,
        confirmations.macdConfirm
    ].filter(Boolean).length

    return otherConfirms >= 2
}

/**
 * Build narrative text
 */
function buildNarrative(
    structure: WaveStructure,
    progress: number,
    eligible: boolean,
    direction: 'bullish' | 'bearish' | 'unclear'
): string {
    if (structure.currentWave === 'unknown') {
        return 'H1 wave structure unclear. No Elliott Wave pattern detected. Standby.'
    }

    const dirLabel = direction === 'bullish' ? 'Bullish' : 'Bearish'
    const waveLabel = `Wave ${structure.currentWave}`
    const progressLabel = `${progress.toFixed(0)}% complete`

    let statusLabel = ''
    if (structure.currentWave === 1 || structure.currentWave === 2 || structure.currentWave === 4) {
        statusLabel = '❌ NO TRADE (correction/discovery phase)'
    } else if (eligible) {
        statusLabel = '✅ TRADE ELIGIBLE (beginning of impulse wave)'
    } else if (progress > 20) {
        statusLabel = '⚠️ TOO LATE (wave already in progress)'
    } else {
        statusLabel = '⚠️ WAITING (insufficient confirmation)'
    }

    return `${dirLabel} ${waveLabel} ${progressLabel}. ${statusLabel}`
}

/**
 * Build signal array
 */
function buildSignals(
    structure: WaveStructure,
    progress: number,
    confirmations: H1WaveState['confirmations'],
    eligible: boolean
): string[] {
    const signals: string[] = []

    if (structure.currentWave !== 'unknown') {
        signals.push(`H1 Wave ${structure.currentWave} (${progress.toFixed(0)}% complete)`)
    }

    if (eligible) {
        signals.push('✅ TRADE WINDOW OPEN')
    } else if (structure.currentWave === 3 || structure.currentWave === 5) {
        if (progress > 20) {
            signals.push('⏰ Entry window closed (>20%)')
        } else {
            signals.push('⏳ Awaiting full confirmation')
        }
    }

    if (confirmations.fibRatio) signals.push('Fibonacci ratios valid')
    if (confirmations.volumeConfirm) signals.push('Volume pattern confirms')
    if (confirmations.rsiConfirm) signals.push('RSI alignment correct')
    if (confirmations.macdConfirm) signals.push('MACD bullish cross')
    if (!confirmations.structureIntact) signals.push('⚠️ Wave structure invalidated')

    return signals
}

/**
 * Create unknown/unclear wave state
 */
function createUnknownWaveState(candles: OandaCandle[]): H1WaveState {
    const currentPrice = candles.length > 0 ? parseFloat(candles[candles.length - 1].mid.c) : 0

    return {
        currentWave: 'unknown',
        waveProgress: 0,
        tradeEligible: false,
        direction: 'unclear',
        wave1Start: null,
        wave1End: null,
        wave2End: null,
        wave3Target: null,
        wave4End: null,
        wave5Target: null,
        currentPrice,
        waveStartPrice: null,
        waveTargetPrice: null,
        invalidationPrice: null,
        confidence: 0,
        confirmations: {
            fibRatio: false,
            volumeConfirm: false,
            rsiConfirm: false,
            macdConfirm: false,
            structureIntact: false,
            wave2Complete: false,
            wave4Complete: false
        },
        correctivePattern: 'unknown',
        correctiveCompleteConfidence: 0,
        narrative: 'H1 Elliott Wave structure unclear. Insufficient data or ranging market. Standby.',
        signals: ['No clear wave pattern detected']
    }
}
