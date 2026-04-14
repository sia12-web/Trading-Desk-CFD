/**
 * Regime Classifier — The Overseer
 *
 * Multi-dimensional regime classification using 5 indicator groups simultaneously.
 * This is the ONLY intelligent component in the system.
 *
 * "You do not tweak the weapon. You change the weapon."
 *
 * Dimensions:
 * 1. ATR percentile (volatility)
 * 2. ADX value (trend strength)
 * 3. Donchian width (range compression/expansion)
 * 4. MA slope alignment (trend direction)
 * 5. Volume ratio (activity level)
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type { RegimeType, RegimeClassification, RegimeIndicators, ActiveBot } from './types'
import { calculateSMA, calculateATR, calculateADX } from '@/lib/utils/indicators'
import { calculateDonchianChannel, calculateCVD } from '@/lib/utils/donchian-cvd'
import { detectMarketState } from '@/lib/utils/market-state'
import { getAssetConfig } from '@/lib/data/asset-config'

// ═══════════════════════════════════════════════════════════════════════════
// Main Classifier
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify the current market regime for a pair.
 *
 * @param candles - M15 candles (need 100+ for indicator warm-up)
 * @param pair - Display format pair name (EUR/USD, etc.)
 * @returns RegimeClassification with regime, active bot, and confidence
 */
export function classifyRegime(
    candles: OandaCandle[],
    pair: string,
): RegimeClassification {
    const now = new Date().toISOString()

    if (candles.length < 60) {
        return {
            regime: 'unknown_dangerous',
            activeBot: 'none',
            indicators: emptyIndicators(),
            confidence: 0,
            sizeMultiplier: 0,
            narrative: 'Insufficient candle data for regime classification (need 60+).',
            classifiedAt: now,
            conditionBlack: false,
        }
    }

    // Step 1: Compute all 5 indicator dimensions
    const indicators = computeRegimeIndicators(candles, pair)

    // Step 2: Check for Condition Black — spread too wide or CVD erratic
    const isConditionBlack = indicators.spreadWidthRatio > 3 || indicators.cvdErratic

    // Step 3: Check for complex correction first (from existing market-state)
    if (indicators.maCrossCount >= 15) {
        return {
            regime: 'complex_correction',
            activeBot: 'killzone',
            indicators,
            confidence: 70 + Math.min(30, indicators.maCrossCount - 15),
            sizeMultiplier: 1.0,
            narrative: `Complex correction detected (${indicators.maCrossCount} MA crosses). Killzone Bot activated for W-X-Y trap detection.`,
            classifiedAt: now,
            conditionBlack: false,
        }
    }

    // Step 3: Score each regime
    const scores = scoreRegimes(indicators)

    // Step 4: Pick highest-scoring regime
    let bestRegime: RegimeType = 'unknown_dangerous'
    let bestScore = 0

    for (const [regime, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score
            bestRegime = regime as RegimeType
        }
    }

    // Step 5: Minimum confidence threshold — if best score < 40 OR Condition Black, mark as unknown
    if (bestScore < 40 || isConditionBlack) {
        const blackReason = indicators.spreadWidthRatio > 3
            ? `Spread ${indicators.spreadWidthRatio.toFixed(1)}x normal`
            : indicators.cvdErratic
            ? 'CVD direction changes erratic'
            : `best score: ${bestScore}`

        return {
            regime: 'unknown_dangerous',
            activeBot: 'none',
            indicators,
            confidence: bestScore,
            sizeMultiplier: 0,
            narrative: isConditionBlack
                ? `\u26d4 CONDITION BLACK \u2014 ${blackReason}. ALL BOTS OFF. Cash is a position.`
                : `Conflicting signals (best score: ${bestScore}). All bots OFF. ATR percentile: ${indicators.atrPercentile.toFixed(0)}, ADX: ${indicators.adxValue.toFixed(1)}, slopes aligned: ${indicators.slopesAligned}.`,
            classifiedAt: now,
            conditionBlack: isConditionBlack,
        }
    }

    // Step 6: Map regime → active bot + size multiplier
    const { bot, sizeMultiplier } = mapRegimeToBot(bestRegime)

    // Step 7: Build narrative
    const narrative = buildNarrative(bestRegime, bot, indicators, bestScore)

    return {
        regime: bestRegime,
        activeBot: bot,
        indicators,
        confidence: bestScore,
        sizeMultiplier,
        narrative,
        classifiedAt: now,
        conditionBlack: false,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Indicator Computation
// ═══════════════════════════════════════════════════════════════════════════

function computeRegimeIndicators(
    candles: OandaCandle[],
    pair: string,
): RegimeIndicators {
    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))
    const closes = candles.map(c => parseFloat(c.mid.c))
    const volumes = candles.map(c => c.volume ?? 0)

    const assetConfig = getAssetConfig(pair)
    const pipMultiplier = assetConfig.pointMultiplier === 1 ? 1 : (assetConfig.pointMultiplier === 100 ? 100 : 10000)

    // ── ATR dimension ──
    const atrValues = calculateATR(highs, lows, closes, 14)
    const validATR = atrValues.filter(v => !isNaN(v) && v > 0)
    const currentATR = validATR.length > 0 ? validATR[validATR.length - 1] : 0
    const atr50Avg = validATR.length >= 50
        ? validATR.slice(-50).reduce((s, v) => s + v, 0) / 50
        : validATR.reduce((s, v) => s + v, 0) / Math.max(validATR.length, 1)

    // Percentile: where does current ATR sit vs last 50 values?
    let atrPercentile = 50
    if (validATR.length >= 20) {
        const window = validATR.slice(-50)
        const belowCount = window.filter(v => v <= currentATR).length
        atrPercentile = Math.round((belowCount / window.length) * 100)
    }

    const atrExpanding = validATR.length >= 5
        ? validATR[validATR.length - 1] > validATR[validATR.length - 5] * 1.1
        : false

    // ── ADX dimension ──
    const adxResult = calculateADX(highs, lows, closes, 14)
    const validADX = adxResult.adx.filter(v => !isNaN(v))
    const adxValue = validADX.length > 0 ? validADX[validADX.length - 1] : 0
    const adxRising = validADX.length >= 5
        ? validADX[validADX.length - 1] > validADX[validADX.length - 5]
        : false

    // ── Donchian dimension ──
    const donchian = calculateDonchianChannel(highs, lows, 20, pipMultiplier)
    const validWidth = donchian.width.filter(v => !isNaN(v) && v > 0)
    const currentWidth = validWidth.length > 0 ? validWidth[validWidth.length - 1] : 0
    const avgWidth = validWidth.length >= 50
        ? validWidth.slice(-50).reduce((s, v) => s + v, 0) / 50
        : validWidth.reduce((s, v) => s + v, 0) / Math.max(validWidth.length, 1)

    const donchianCompression = avgWidth > 0 && currentWidth < avgWidth * 0.6
    const donchianExpansion = avgWidth > 0 && currentWidth > avgWidth * 1.5

    // ── MA slope dimension ──
    const sma20 = calculateSMA(closes, 20)
    const sma50 = calculateSMA(closes, 50)

    let ma20Slope = 0
    let ma50Slope = 0
    const validSma20 = sma20.filter(v => !isNaN(v))
    const validSma50 = sma50.filter(v => !isNaN(v))

    if (validSma20.length >= 10) {
        ma20Slope = validSma20[validSma20.length - 1] - validSma20[validSma20.length - 10]
    }
    if (validSma50.length >= 10) {
        ma50Slope = validSma50[validSma50.length - 1] - validSma50[validSma50.length - 10]
    }

    const slopesAligned = (ma20Slope > 0 && ma50Slope > 0) || (ma20Slope < 0 && ma50Slope < 0)

    // ── Volume dimension ──
    const recent10Vol = volumes.slice(-10).reduce((s, v) => s + v, 0) / 10
    const avg50Vol = volumes.slice(-50).reduce((s, v) => s + v, 0) / Math.min(volumes.length, 50)
    const volumeRatio = avg50Vol > 0 ? recent10Vol / avg50Vol : 1
    const volumeExpanding = volumeRatio > 1.3

    // ── MA cross count (from existing market-state) ──
    const marketState = detectMarketState(candles)

    // ── CVD erratic detection (Condition Black signal) ──
    const cvdResult = calculateCVD(candles.slice(-30), 30)
    let cvdDirectionChanges = 0
    if (cvdResult.delta.length >= 20) {
        const recentDeltas = cvdResult.delta.slice(-20)
        for (let i = 1; i < recentDeltas.length; i++) {
            const prevSign = Math.sign(recentDeltas[i - 1])
            const currSign = Math.sign(recentDeltas[i])
            if (prevSign !== 0 && currSign !== 0 && prevSign !== currSign) {
                cvdDirectionChanges++
            }
        }
    }
    const cvdErratic = cvdDirectionChanges > 12

    // ── Spread width ratio ──
    // Since OANDA doesn't provide spread in candle data, estimate from ATR behavior
    // A sudden ATR spike with no directional movement suggests spread widening
    // For now, set to 1.0 (normal) — the War Room API will pass live spread from OANDA pricing
    const spreadWidthRatio = 1.0  // Updated by engine when live pricing is available

    return {
        atrPercentile,
        adxValue,
        adxRising,
        donchianCompression,
        donchianExpansion,
        slopesAligned,
        maCrossCount: marketState.maCrossCount,
        volumeExpanding,
        spreadWidthRatio,
        cvdErratic,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Regime Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scoreRegimes(ind: RegimeIndicators): Record<RegimeType, number> {
    let rangingScore = 0
    let trendingStrongScore = 0
    let trendingMildScore = 0

    // ── Ranging Quiet ──
    // ADX < 25 + Donchian compression + low ATR + MA crosses 2-14
    if (ind.adxValue < 25) rangingScore += 30
    else if (ind.adxValue < 30) rangingScore += 15
    if (ind.donchianCompression) rangingScore += 25
    if (ind.atrPercentile < 30) rangingScore += 20
    else if (ind.atrPercentile < 50) rangingScore += 10
    if (ind.maCrossCount >= 2 && ind.maCrossCount < 15) rangingScore += 15
    if (!ind.slopesAligned) rangingScore += 10
    if (!ind.volumeExpanding) rangingScore += 5

    // ── Trending Strong ──
    // ADX > 40 + Donchian expansion + high ATR + slopes aligned + volume expanding
    if (ind.adxValue > 40) trendingStrongScore += 25
    else if (ind.adxValue > 35) trendingStrongScore += 15
    if (ind.donchianExpansion) trendingStrongScore += 20
    if (ind.atrPercentile > 70) trendingStrongScore += 20
    else if (ind.atrPercentile > 50) trendingStrongScore += 10
    if (ind.slopesAligned) trendingStrongScore += 20
    if (ind.volumeExpanding) trendingStrongScore += 15
    if (ind.adxRising) trendingStrongScore += 5

    // ── Trending Mild ──
    // ADX 25-40 + slopes aligned + moderate ATR
    if (ind.adxValue >= 25 && ind.adxValue <= 40) trendingMildScore += 30
    else if (ind.adxValue > 20 && ind.adxValue < 25) trendingMildScore += 15
    if (ind.slopesAligned) trendingMildScore += 25
    if (ind.atrPercentile >= 30 && ind.atrPercentile <= 70) trendingMildScore += 20
    if (!ind.donchianCompression && !ind.donchianExpansion) trendingMildScore += 15
    if (ind.maCrossCount <= 3) trendingMildScore += 10

    return {
        ranging_quiet: rangingScore,
        trending_strong: trendingStrongScore,
        trending_mild: trendingMildScore,
        complex_correction: 0, // Handled separately (maCrossCount >= 15)
        news_chaos: 0,         // Handled by Ghost Bot via news-guard (not scored)
        unknown_dangerous: 0,  // Fallback if all scores < 40
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Regime → Bot Mapping
// ═══════════════════════════════════════════════════════════════════════════

function mapRegimeToBot(regime: RegimeType): { bot: ActiveBot; sizeMultiplier: number } {
    switch (regime) {
        case 'ranging_quiet':
            return { bot: 'trap', sizeMultiplier: 1.0 }
        case 'trending_strong':
            return { bot: 'momentum', sizeMultiplier: 1.0 }
        case 'trending_mild':
            return { bot: 'momentum', sizeMultiplier: 0.5 }
        case 'complex_correction':
            return { bot: 'killzone', sizeMultiplier: 1.0 }
        case 'news_chaos':
            return { bot: 'ghost', sizeMultiplier: 1.0 }
        case 'unknown_dangerous':
        default:
            return { bot: 'none', sizeMultiplier: 0 }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Narrative Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildNarrative(regime: RegimeType, bot: ActiveBot, ind: RegimeIndicators, score: number): string {
    const botNames: Record<ActiveBot, string> = {
        trap: 'Trap Bot (Donchian+CVD)',
        killzone: 'Killzone Bot (Wave 2/4 Institutional)',
        momentum: 'Momentum Bot (VWAP Trend-Following)',
        ghost: 'Ghost Bot (News Judas Swing)',
        none: 'ALL BOTS OFF',
    }

    const lines = [
        `Regime: ${regime.replace(/_/g, ' ').toUpperCase()} (${score}% confidence)`,
        `Active: ${botNames[bot]}`,
        ``,
        `Indicators:`,
        `  ATR percentile: ${ind.atrPercentile.toFixed(0)}%`,
        `  ADX: ${ind.adxValue.toFixed(1)} (${ind.adxRising ? 'rising' : 'falling'})`,
        `  Donchian: ${ind.donchianCompression ? 'COMPRESSED' : ind.donchianExpansion ? 'EXPANDING' : 'normal'}`,
        `  MA slopes: ${ind.slopesAligned ? 'ALIGNED' : 'divergent'}`,
        `  Volume: ${ind.volumeExpanding ? 'EXPANDING' : 'normal'}`,
        `  MA crosses: ${ind.maCrossCount}`,
    ]

    return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function emptyIndicators(): RegimeIndicators {
    return {
        atrPercentile: 50,
        adxValue: 0,
        adxRising: false,
        donchianCompression: false,
        donchianExpansion: false,
        slopesAligned: false,
        maCrossCount: 0,
        volumeExpanding: false,
        spreadWidthRatio: 1.0,
        cvdErratic: false,
    }
}
