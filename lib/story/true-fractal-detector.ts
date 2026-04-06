import type { OandaCandle } from '@/lib/types/oanda'
import type { CalculatedIndicators } from '@/lib/strategy/types'
import type { ElliottWaveAnalysis } from './elliott-wave-detector'
import type { FractalSetup } from './fractal-detector'
import type { TrueFractalSetup, TrueFractalPhase } from './types'

/**
 * True Fractal Detector — 4-Phase Wave 3 Hunting System
 *
 * Combines Elliott Wave, Fibonacci, momentum divergence, Bill Williams fractals,
 * and volume confirmation into a single cross-timeframe logic tree.
 *
 * Phase 1 (Macro Scanner): Daily — completed Wave 1 + Wave 2 retracement in 50-61.8% zone
 * Phase 2 (Momentum Validator): 4H — RSI/MACD divergence + structure shift + Alligator awakening
 * Phase 3 (Sniper Trigger): 1H — Sub-wave 1 + micro Fib entry + volume + fractal signal
 * Phase 4 (Risk/Reward): Pure math — SL below Wave 2, TP at 161.8% extension
 */

export function detectTrueFractal(
    dailyCandles: OandaCandle[],
    dailyIndicators: CalculatedIndicators,
    dailyElliottWave: ElliottWaveAnalysis | undefined,
    h4Candles: OandaCandle[],
    h4Indicators: CalculatedIndicators,
    h1Candles: OandaCandle[],
    h1Indicators: CalculatedIndicators,
    h1ElliottWave: ElliottWaveAnalysis | undefined,
    dailyFractalSetup: FractalSetup | undefined,
    pipLocation: number
): TrueFractalSetup {
    // ── Phase 1: Macro Scanner (Daily) ──
    const phase1 = detectPhase1(dailyCandles, dailyElliottWave)

    // ── Phase 2: Momentum Validator (4H) ──
    const phase2 = detectPhase2(h4Candles, h4Indicators, dailyFractalSetup)

    // ── Phase 3: Sniper Trigger (1H) ──
    const phase3 = detectPhase3(h1Candles, h1Indicators, h1ElliottWave, phase1.direction)

    // ── Phase 4: Risk/Reward (pure math) ──
    const phase4 = calculatePhase4(phase1, phase3, pipLocation, dailyCandles)

    // ── Overall scoring ──
    const phase1Score = phase1.confidence * 0.25
    const phase2Score = phase2.confidence * 0.25
    const phase3Score = phase3.confidence * 0.25
    const phase4Score = phase4.riskRewardRatio !== null && phase4.riskRewardRatio >= 3 ? 25 : phase4.riskRewardRatio !== null ? (phase4.riskRewardRatio / 3) * 25 : 0
    const overallScore = Math.round(phase1Score + phase2Score + phase3Score + phase4Score)

    // Determine highest confirmed phase
    let overallPhase: TrueFractalSetup['overallPhase'] = 0
    if (phase1.status === 'confirmed') overallPhase = 1
    if (overallPhase >= 1 && phase2.status === 'confirmed') overallPhase = 2
    if (overallPhase >= 2 && phase3.status === 'confirmed') overallPhase = 3
    if (overallPhase >= 3 && phase4.riskRewardRatio !== null && phase4.riskRewardRatio >= 2) overallPhase = 4

    // Direction from phase 1
    const direction = phase1.direction

    const narrative = buildNarrative(overallPhase, overallScore, direction, phase1, phase2, phase3, phase4)

    return {
        overallPhase,
        overallScore,
        direction,
        phase1: { ...phase1, status: phase1.status, confidence: phase1.confidence, details: phase1.details },
        phase2,
        phase3,
        phase4,
        narrative,
    }
}

// ────────────────────────────────────────────────────────────────
// Phase 1: Macro Scanner (Daily)
// ────────────────────────────────────────────────────────────────

interface Phase1Result extends TrueFractalPhase {
    wave1Complete: boolean
    wave2Depth: number | null
    wave2InZone: boolean
    keyLevels: { wave1Top: number | null; wave2Bottom: number | null }
    direction: 'bullish' | 'bearish' | 'none'
}

function detectPhase1(dailyCandles: OandaCandle[], ew: ElliottWaveAnalysis | undefined): Phase1Result {
    const empty: Phase1Result = {
        status: 'not_detected', confidence: 0, details: 'Insufficient Elliott Wave data on Daily',
        wave1Complete: false, wave2Depth: null, wave2InZone: false,
        keyLevels: { wave1Top: null, wave2Bottom: null },
        direction: 'none',
    }

    if (!ew || dailyCandles.length < 50) return empty

    // Check for impulsive wave structure (Wave 1 completed or Wave 3 forming)
    const isImpulsive = ew.waveType === 'impulsive'
    const currentWave = ew.currentWave.toLowerCase()

    // We want: Wave 1 complete (5-wave impulse detected) and currently in Wave 2 correction
    // OR: corrective structure after impulsive = Wave 2 forming
    const wave1Scenarios = [
        currentWave.includes('wave 3') || currentWave.includes('wave 4'), // Already past wave 2
        currentWave.includes('early impulse'),                             // Wave 1-2 area
        currentWave.includes('wave 5') || currentWave.includes('completion'), // Full cycle
    ]

    const correctiveAfterImpulse = ew.waveType === 'corrective' && (
        currentWave.includes('wave a') || currentWave.includes('wave b') || currentWave.includes('wave c')
    )

    // Determine direction from the swing structure
    const fib = ew.fibonacciLevels
    const swingRange = fib.swingHigh - fib.swingLow
    if (swingRange <= 0) return empty

    const currentPrice = parseFloat(dailyCandles[dailyCandles.length - 1].mid.c)

    // Bullish Wave 3 hunt: Wave 1 went UP, Wave 2 retraces DOWN
    // Bearish Wave 3 hunt: Wave 1 went DOWN, Wave 2 retraces UP
    const isBullish = ew.projectedMove === 'bullish' || (isImpulsive && currentPrice > fib.swingLow + swingRange * 0.3)
    const isBearish = ew.projectedMove === 'bearish' || (isImpulsive && currentPrice < fib.swingHigh - swingRange * 0.3)

    let direction: 'bullish' | 'bearish' | 'none' = 'none'
    let wave1Top: number | null = null
    let wave2Bottom: number | null = null
    let wave2Depth: number | null = null

    if (isBullish) {
        direction = 'bullish'
        wave1Top = fib.swingHigh
        // Wave 2 bottom = how far price retraced from Wave 1 top
        // Check where current price sits relative to Fibonacci retracements
        wave2Bottom = fib.swingLow
        // Calculate retracement depth: how much of Wave 1 was retraced
        const retracementFromTop = (wave1Top - currentPrice) / swingRange
        wave2Depth = Math.max(0, Math.min(1, retracementFromTop))
    } else if (isBearish) {
        direction = 'bearish'
        wave1Top = fib.swingLow // In bearish: Wave 1 top = lowest point
        wave2Bottom = fib.swingHigh // Wave 2 retraces back up
        const retracementFromBottom = (currentPrice - wave1Top) / swingRange
        wave2Depth = Math.max(0, Math.min(1, retracementFromBottom))
    }

    if (direction === 'none') return empty

    // Check if Wave 2 retracement is in the golden zone (50-61.8%)
    const wave2InZone = wave2Depth !== null && wave2Depth >= 0.45 && wave2Depth <= 0.68

    // Score confidence
    let confidence = 0
    const wave1Complete = isImpulsive || correctiveAfterImpulse || wave1Scenarios.some(Boolean)

    if (wave1Complete) confidence += 40
    if (wave2InZone) confidence += 40
    else if (wave2Depth !== null && wave2Depth >= 0.382 && wave2Depth <= 0.786) confidence += 20
    if (ew.confidence > 60) confidence += 10
    if (isImpulsive) confidence += 10

    confidence = Math.min(100, confidence)

    let status: TrueFractalPhase['status'] = 'not_detected'
    if (confidence >= 70) status = 'confirmed'
    else if (confidence >= 40) status = 'forming'

    const details = wave1Complete
        ? `Daily ${direction} impulse detected. Wave 2 retracement: ${wave2Depth !== null ? (wave2Depth * 100).toFixed(1) : '?'}%${wave2InZone ? ' (IN GOLDEN ZONE)' : ''}`
        : `Monitoring for ${direction} impulsive Wave 1 completion on Daily`

    return {
        status, confidence, details,
        wave1Complete, wave2Depth, wave2InZone,
        keyLevels: { wave1Top, wave2Bottom },
        direction,
    }
}

// ────────────────────────────────────────────────────────────────
// Phase 2: Momentum Validator (4H)
// ────────────────────────────────────────────────────────────────

function detectPhase2(
    h4Candles: OandaCandle[],
    h4Indicators: CalculatedIndicators,
    dailyFractalSetup: FractalSetup | undefined
): TrueFractalPhase & { rsiDivergence: boolean; macdDivergence: boolean; structureShift: boolean; alligatorAwakening: boolean } {
    const empty = {
        status: 'not_detected' as const, confidence: 0, details: 'Insufficient 4H data',
        rsiDivergence: false, macdDivergence: false, structureShift: false, alligatorAwakening: false,
    }

    if (h4Candles.length < 30) return empty

    const rsi = h4Indicators.rsi
    const macdHist = h4Indicators.macd.histogram
    const closes = h4Candles.map(c => parseFloat(c.mid.c))
    const highs = h4Candles.map(c => parseFloat(c.mid.h))
    const lastIdx = h4Candles.length - 1

    // ── RSI Bullish Divergence: price lower low + RSI higher low ──
    const rsiDivergence = detectBullishDivergence(closes, rsi, 20)

    // ── MACD Histogram Divergence ──
    const macdDivergence = detectBullishDivergence(closes, macdHist, 20)

    // ── Structure Shift: break of recent swing high ──
    const structureShift = detectStructureShift(h4Candles, 20)

    // ── Alligator Awakening from Daily fractal setup ──
    const alligatorAwakening = dailyFractalSetup
        ? (dailyFractalSetup.alligatorState === 'awakening' || dailyFractalSetup.alligatorState === 'eating')
        : false

    // Score
    let confidence = 0
    if (rsiDivergence) confidence += 30
    if (macdDivergence) confidence += 25
    if (structureShift) confidence += 25
    if (alligatorAwakening) confidence += 20
    confidence = Math.min(100, confidence)

    let status: TrueFractalPhase['status'] = 'not_detected'
    if (confidence >= 70) status = 'confirmed'
    else if (confidence >= 35) status = 'forming'

    const signals: string[] = []
    if (rsiDivergence) signals.push('RSI bullish divergence')
    if (macdDivergence) signals.push('MACD histogram divergence')
    if (structureShift) signals.push('structure shift (swing high broken)')
    if (alligatorAwakening) signals.push(`Alligator ${dailyFractalSetup?.alligatorState}`)

    const details = signals.length > 0
        ? `4H momentum: ${signals.join(', ')}`
        : 'No 4H momentum confirmation signals detected'

    return { status, confidence, details, rsiDivergence, macdDivergence, structureShift, alligatorAwakening }
}

/**
 * Detect bullish divergence: price makes lower low but indicator makes higher low
 * Works for both RSI and MACD histogram
 */
function detectBullishDivergence(prices: number[], indicator: number[], lookback: number): boolean {
    if (prices.length < lookback || indicator.length < lookback) return false

    const startIdx = prices.length - lookback
    const recentPrices = prices.slice(startIdx)
    const recentIndicator = indicator.slice(startIdx)

    // Find two lowest price points
    let lowestIdx1 = 0
    let lowestIdx2 = -1
    for (let i = 1; i < recentPrices.length; i++) {
        if (recentPrices[i] < recentPrices[lowestIdx1]) {
            lowestIdx2 = lowestIdx1
            lowestIdx1 = i
        } else if (lowestIdx2 === -1 || recentPrices[i] < recentPrices[lowestIdx2]) {
            if (Math.abs(i - lowestIdx1) > 3) { // Ensure separation
                lowestIdx2 = i
            }
        }
    }

    if (lowestIdx2 === -1) return false

    // Ensure chronological order
    const [firstIdx, secondIdx] = lowestIdx1 < lowestIdx2 ? [lowestIdx1, lowestIdx2] : [lowestIdx2, lowestIdx1]

    // Price: lower low (second low is lower than first)
    const priceLowerLow = recentPrices[secondIdx] < recentPrices[firstIdx]

    // Indicator: higher low (second low is higher than first)
    const validFirst = !isNaN(recentIndicator[firstIdx])
    const validSecond = !isNaN(recentIndicator[secondIdx])
    if (!validFirst || !validSecond) return false

    const indicatorHigherLow = recentIndicator[secondIdx] > recentIndicator[firstIdx]

    return priceLowerLow && indicatorHigherLow
}

/**
 * Detect structure shift: price breaks above the most recent swing high
 */
function detectStructureShift(candles: OandaCandle[], lookback: number): boolean {
    if (candles.length < lookback) return false

    const recent = candles.slice(-lookback)
    const highs = recent.map(c => parseFloat(c.mid.h))
    const currentClose = parseFloat(candles[candles.length - 1].mid.c)

    // Find the highest swing high in the lookback (excluding last 3 bars)
    const swingHighs: number[] = []
    for (let i = 2; i < highs.length - 3; i++) {
        if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1] &&
            highs[i] > highs[i - 2] && highs[i] > highs[i + 2]) {
            swingHighs.push(highs[i])
        }
    }

    if (swingHighs.length === 0) return false

    // Most recent swing high
    const recentSwingHigh = swingHighs[swingHighs.length - 1]

    // Structure shift = current close breaks above the swing high
    return currentClose > recentSwingHigh
}

// ────────────────────────────────────────────────────────────────
// Phase 3: Sniper Trigger (1H)
// ────────────────────────────────────────────────────────────────

function detectPhase3(
    h1Candles: OandaCandle[],
    h1Indicators: CalculatedIndicators,
    h1ElliottWave: ElliottWaveAnalysis | undefined,
    direction: 'bullish' | 'bearish' | 'none'
): TrueFractalPhase & { subWave1Detected: boolean; microFibEntry: number | null; volumeConfirmed: boolean; fractalSignal: boolean } {
    const empty = {
        status: 'not_detected' as const, confidence: 0, details: 'Insufficient 1H data',
        subWave1Detected: false, microFibEntry: null, volumeConfirmed: false, fractalSignal: false,
    }

    if (h1Candles.length < 30 || direction === 'none') return empty

    const lastIdx = h1Candles.length - 1

    // ── Sub-Wave 1 on 1H (using Elliott Wave detection) ──
    const subWave1Detected = h1ElliottWave
        ? (h1ElliottWave.waveType === 'impulsive' && (
            h1ElliottWave.currentWave.toLowerCase().includes('early impulse') ||
            h1ElliottWave.currentWave.toLowerCase().includes('wave 3') ||
            h1ElliottWave.currentWave.toLowerCase().includes('wave 2')
        ))
        : false

    // ── Micro Fibonacci Entry (50-61.8% of sub-wave on 1H) ──
    let microFibEntry: number | null = null
    if (h1ElliottWave) {
        const fib = h1ElliottWave.fibonacciLevels
        const range = fib.swingHigh - fib.swingLow
        if (range > 0) {
            if (direction === 'bullish') {
                // Entry zone: between 50% and 61.8% retracement from the swing high
                microFibEntry = (fib.retracements.level_500 + fib.retracements.level_618) / 2
            } else {
                // Bearish: inverse retracement
                microFibEntry = fib.swingLow + range * 0.559 // Midpoint of 50-61.8%
            }
        }
    }

    // ── Volume Confirmation ──
    const volumeFlow = h1Indicators.volumeFlow
    const volumeConfirmed = volumeFlow
        ? !volumeFlow.exhaustion.detected || volumeFlow.exhaustion.type === 'none'
        : false

    // Also check raw volume above average
    const vol = h1Indicators.volume[lastIdx]
    const volSma = h1Indicators.volumeSma[lastIdx]
    const volumeAboveAvg = vol && volSma ? vol > volSma * 1.1 : false

    // ── Fractal Signal at entry zone ──
    const fractals = h1Indicators.fractals
    const currentPrice = parseFloat(h1Candles[lastIdx].mid.c)
    let fractalSignal = false

    if (direction === 'bullish') {
        // Look for bullish fractal near the micro Fib entry
        const recentBullish = fractals.filter(f => f.type === 'bullish').slice(-5)
        fractalSignal = recentBullish.some(f => {
            if (!microFibEntry) return false
            const tolerance = Math.abs(currentPrice - microFibEntry) * 0.3
            return Math.abs(f.price - microFibEntry) < tolerance
        })
        // Also accept if there's any recent bullish fractal
        if (!fractalSignal && recentBullish.length > 0) {
            const latestFractal = recentBullish[recentBullish.length - 1]
            fractalSignal = latestFractal.price < currentPrice // Bullish fractal below current price
        }
    } else {
        const recentBearish = fractals.filter(f => f.type === 'bearish').slice(-5)
        fractalSignal = recentBearish.some(f => {
            if (!microFibEntry) return false
            const tolerance = Math.abs(currentPrice - microFibEntry) * 0.3
            return Math.abs(f.price - microFibEntry) < tolerance
        })
        if (!fractalSignal && recentBearish.length > 0) {
            const latestFractal = recentBearish[recentBearish.length - 1]
            fractalSignal = latestFractal.price > currentPrice
        }
    }

    // Score
    let confidence = 0
    if (subWave1Detected) confidence += 30
    if (microFibEntry !== null) confidence += 20
    if (volumeConfirmed || volumeAboveAvg) confidence += 25
    if (fractalSignal) confidence += 25
    confidence = Math.min(100, confidence)

    let status: TrueFractalPhase['status'] = 'not_detected'
    if (confidence >= 70) status = 'confirmed'
    else if (confidence >= 35) status = 'forming'

    const signals: string[] = []
    if (subWave1Detected) signals.push('sub-Wave 1 on 1H')
    if (microFibEntry) signals.push(`micro Fib entry at ${microFibEntry.toFixed(5)}`)
    if (volumeConfirmed || volumeAboveAvg) signals.push('volume confirmed')
    if (fractalSignal) signals.push('fractal signal at zone')

    const details = signals.length > 0
        ? `1H sniper: ${signals.join(', ')}`
        : 'No 1H trigger signals detected'

    return { status, confidence, details, subWave1Detected, microFibEntry, volumeConfirmed: volumeConfirmed || volumeAboveAvg, fractalSignal }
}

// ────────────────────────────────────────────────────────────────
// Phase 4: Risk/Reward (pure math)
// ────────────────────────────────────────────────────────────────

function calculatePhase4(
    phase1: Phase1Result,
    phase3: ReturnType<typeof detectPhase3>,
    pipLocation: number,
    dailyCandles: OandaCandle[]
): TrueFractalSetup['phase4'] {
    const empty = { stopLoss: null, takeProfit: null, riskRewardRatio: null, positionSizeUnits: null }

    if (phase1.direction === 'none') return empty

    const { wave1Top, wave2Bottom } = phase1.keyLevels
    if (wave1Top === null || wave2Bottom === null) return empty

    const pipValue = Math.pow(10, pipLocation) // e.g. 0.0001 for forex
    const buffer = pipValue * 10 // 10 pip buffer

    let stopLoss: number
    let takeProfit: number
    const wave1Range = Math.abs(wave1Top - wave2Bottom)

    if (phase1.direction === 'bullish') {
        stopLoss = wave2Bottom - buffer
        // TP at 161.8% Fibonacci extension of Wave 1 range from Wave 2 bottom
        takeProfit = wave2Bottom + wave1Range * 1.618
    } else {
        stopLoss = wave2Bottom + buffer // wave2Bottom is swingHigh in bearish
        takeProfit = wave2Bottom - wave1Range * 1.618
    }

    // Entry price: use micro Fib entry from phase 3 or current price
    const entryPrice = phase3.microFibEntry || parseFloat(dailyCandles[dailyCandles.length - 1].mid.c)
    const riskPips = Math.abs(entryPrice - stopLoss)
    const rewardPips = Math.abs(takeProfit - entryPrice)
    const riskRewardRatio = riskPips > 0 ? Math.round((rewardPips / riskPips) * 100) / 100 : null

    // Position sizing: assume 2% risk, $10k account, approximate
    // This is illustrative — actual sizing happens in the trade terminal
    const positionSizeUnits = riskPips > 0 ? Math.round(200 / riskPips) : null // ~$200 risk / riskInPrice

    return { stopLoss, takeProfit, riskRewardRatio, positionSizeUnits }
}

// ────────────────────────────────────────────────────────────────
// Narrative builder
// ────────────────────────────────────────────────────────────────

function buildNarrative(
    phase: TrueFractalSetup['overallPhase'],
    score: number,
    direction: TrueFractalSetup['direction'],
    phase1: Phase1Result,
    phase2: ReturnType<typeof detectPhase2>,
    phase3: ReturnType<typeof detectPhase3>,
    phase4: TrueFractalSetup['phase4']
): string {
    if (phase === 0) return 'No True Fractal setup detected. Monitoring for Wave 1 impulse on Daily.'
    if (phase === 1) return `Phase 1 active: ${direction} Wave 1 complete on Daily. Wave 2 retracement at ${phase1.wave2Depth !== null ? (phase1.wave2Depth * 100).toFixed(0) : '?'}%.${phase1.wave2InZone ? ' IN GOLDEN ZONE — advancing to Phase 2.' : ' Waiting for 50-61.8% zone.'}`
    if (phase === 2) return `Phase 2 confirmed: 4H momentum validating ${direction} thesis. ${phase2.rsiDivergence ? 'RSI div + ' : ''}${phase2.structureShift ? 'structure shift + ' : ''}${phase2.alligatorAwakening ? 'Alligator awakening' : ''}. Watching 1H for sniper entry.`
    if (phase === 3) return `Phase 3 TRIGGERED: 1H sniper entry for ${direction} Wave 3.${phase3.microFibEntry ? ` Entry zone: ${phase3.microFibEntry.toFixed(5)}.` : ''}${phase3.fractalSignal ? ' Fractal signal confirmed.' : ''} Score: ${score}/100.`
    if (phase === 4) return `Phase 4 READY: Full ${direction} True Fractal setup. SL: ${phase4.stopLoss?.toFixed(5)}, TP: ${phase4.takeProfit?.toFixed(5)}, R:R ${phase4.riskRewardRatio?.toFixed(1)}:1. Score: ${score}/100. EXECUTE THE PLAN.`
    return `True Fractal score: ${score}/100.`
}
