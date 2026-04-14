/**
 * Tier 1 — Market State Detector
 *
 * Pre-filter that classifies market regime using:
 * 1. MA(50) crossover counting over last 100 candles
 * 2. ATR squeeze detection (shrinking volatility = accumulation)
 *
 * Only "complex_correction" regime proceeds to Tier 2 (W-X-Y projection).
 */

import type { OandaCandle } from '@/lib/types/oanda'
import { calculateSMA, calculateATR } from '@/lib/utils/indicators'

export type MarketRegime = 'trend' | 'correction' | 'complex_correction' | 'unknown'

export interface MarketStateResult {
    regime: MarketRegime
    maCrossCount: number
    atrSqueeze: boolean
    atrRatio: number
    diamondAccumulation: boolean
    proceedToTier2: boolean
    narrative: string
}

/**
 * Detect current market state/regime from candle data.
 *
 * Algorithm:
 * 1. Calculate SMA(50) and count how many times price crosses the MA in the lookback window
 * 2. 0-1 crosses = trend, 2-14 = correction, 15+ = complex_correction
 * 3. ATR squeeze: current ATR / avg ATR < 0.7 = volatility compression
 * 4. Diamond accumulation = complex_correction + ATR squeeze (institutional accumulation pattern)
 */
export function detectMarketState(
    candles: OandaCandle[],
    maPeriod: number = 50,
    lookback: number = 100,
    atrPeriod: number = 14,
): MarketStateResult {
    const unknown: MarketStateResult = {
        regime: 'unknown',
        maCrossCount: 0,
        atrSqueeze: false,
        atrRatio: 1,
        diamondAccumulation: false,
        proceedToTier2: false,
        narrative: 'Insufficient data for market state detection',
    }

    if (candles.length < maPeriod + 10) return unknown

    // Extract price arrays
    const closes = candles.map(c => parseFloat(c.mid.c))
    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))

    // ── Step 1: Calculate SMA and count crossovers ──
    const sma = calculateSMA(closes, maPeriod)

    // Count MA crossovers in the lookback window
    const startIdx = Math.max(maPeriod, closes.length - lookback)
    let maCrossCount = 0
    let previouslyAbove: boolean | null = null

    for (let i = startIdx; i < closes.length; i++) {
        if (isNaN(sma[i])) continue
        const currentlyAbove = closes[i] > sma[i]

        if (previouslyAbove !== null && currentlyAbove !== previouslyAbove) {
            maCrossCount++
        }
        previouslyAbove = currentlyAbove
    }

    // ── Step 2: Classify regime ──
    let regime: MarketRegime
    if (maCrossCount <= 1) {
        regime = 'trend'
    } else if (maCrossCount <= 14) {
        regime = 'correction'
    } else {
        regime = 'complex_correction'
    }

    // ── Step 3: ATR squeeze detection ──
    const atr = calculateATR(highs, lows, closes, atrPeriod)

    // Compare recent ATR (last 10) vs longer-term average ATR (last 100)
    const recentAtrWindow = atr.slice(-10).filter(v => !isNaN(v) && v > 0)
    const longAtrWindow = atr.slice(-lookback).filter(v => !isNaN(v) && v > 0)

    let atrRatio = 1
    let atrSqueeze = false

    if (recentAtrWindow.length > 0 && longAtrWindow.length > 0) {
        const recentAvgAtr = recentAtrWindow.reduce((s, v) => s + v, 0) / recentAtrWindow.length
        const longAvgAtr = longAtrWindow.reduce((s, v) => s + v, 0) / longAtrWindow.length

        atrRatio = longAvgAtr > 0 ? recentAvgAtr / longAvgAtr : 1
        atrSqueeze = atrRatio < 0.7
    }

    // ── Step 4: Diamond accumulation = complex_correction + ATR squeeze ──
    const diamondAccumulation = regime === 'complex_correction' && atrSqueeze

    // ── Step 5: Gate to Tier 2 ──
    const proceedToTier2 = regime === 'complex_correction'

    // ── Build narrative ──
    let narrative: string
    if (regime === 'trend') {
        narrative = `Clean trend detected (${maCrossCount} MA crosses). Price respecting SMA(${maPeriod}). No correction pattern — Tier 2 skipped.`
    } else if (regime === 'correction') {
        narrative = `Simple correction in progress (${maCrossCount} MA crosses). Not complex enough for W-X-Y projection — Tier 2 skipped.`
    } else {
        narrative = `Complex correction detected (${maCrossCount} MA crosses).${atrSqueeze ? ' ATR squeeze active — diamond accumulation pattern.' : ''} Proceeding to Tier 2 W-X-Y projection.`
    }

    return {
        regime,
        maCrossCount,
        atrSqueeze,
        atrRatio: Math.round(atrRatio * 100) / 100,
        diamondAccumulation,
        proceedToTier2,
        narrative,
    }
}
