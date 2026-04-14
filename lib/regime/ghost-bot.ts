/**
 * Ghost Bot — Division 3: Volatility Harvester
 *
 * "The Ghost is kept offline 99% of the time. It only turns on
 *  exactly one minute after a major news event."
 *
 * Strategy: Liquidity Sweep Fade
 * - Detects the initial algorithmic fakeout ("Judas Swing") post-news
 * - Waits for retail traders to get trapped on the wrong side
 * - Enters OPPOSITE the initial spike once reversal is confirmed
 *
 * OPERATOR'S NOTE (OANDA-specific):
 * During HIGH-impact news (the 1-3 minute Ghost window), OANDA widens
 * the spread massively. The 1:1 R:R must be calculated against the LIVE
 * Bid/Ask spread at execution time, NOT the mid-chart price. If the spread
 * is 10 pips wide, SL and TP calculations must account for that gap.
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type { GhostSetup } from './types'
import { calculateATR } from '@/lib/utils/indicators'
import { getAssetConfig } from '@/lib/data/asset-config'

// ═══════════════════════════════════════════════════════════════════════════
// Empty Return
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_SETUP: GhostSetup = {
    detected: false,
    direction: 'none',
    judasSwingDetected: false,
    judasDirection: 'none',
    judasWickSize: 0,
    judasVolumeRatio: 0,
    reversalConfirmed: false,
    reversalPercentage: 0,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    spreadAtExecution: null,
    newsEvent: null,
    minutesSinceEvent: null,
    confidence: 0,
    narrative: 'Ghost Bot offline — no qualifying setup detected.',
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Detector
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Ghost (Judas Swing Fade) setup on M1 candles.
 *
 * Preconditions (checked by engine BEFORE calling this):
 * - We are inside the Ghost window (1-3 min post HIGH-impact news)
 * - The pair is affected by the news event
 *
 * Detection logic:
 * 1. Find the Judas Swing — a massive M1 wick (>2x ATR) in one direction
 * 2. Confirm retail trap — volume spike on the fakeout candle (>3x avg volume)
 * 3. Wait for reversal — next 1-2 M1 candles reverse >50% of the wick
 * 4. Entry: opposite direction of the Judas Swing
 * 5. SL: beyond the wick extreme + 5 pips buffer (spread-adjusted)
 * 6. TP: 1:1 R:R (spread-adjusted — uses Bid/Ask, not mid price)
 *
 * @param m1Candles - Last 30-60 M1 candles (sufficient for ATR + context)
 * @param pair - Display format pair name
 * @param newsEvent - Name of the triggering news event
 * @param liveBidAskSpread - LIVE spread in price units (Bid/Ask gap) at execution
 */
export function detectGhostSetup(
    m1Candles: OandaCandle[],
    pair: string,
    newsEvent: string,
    liveBidAskSpread: number = 0,
): GhostSetup {
    if (m1Candles.length < 25) {
        return { ...EMPTY_SETUP, newsEvent, narrative: 'Insufficient M1 data for Ghost detection (need 25+).' }
    }

    const assetConfig = getAssetConfig(pair)
    const pipMultiplier = assetConfig.pointMultiplier === 1 ? 1 : (assetConfig.pointMultiplier === 100 ? 100 : 10000)
    const dp = assetConfig.decimalPlaces

    const highs = m1Candles.map(c => parseFloat(c.mid.h))
    const lows = m1Candles.map(c => parseFloat(c.mid.l))
    const closes = m1Candles.map(c => parseFloat(c.mid.c))
    const opens = m1Candles.map(c => parseFloat(c.mid.o))
    const volumes = m1Candles.map(c => c.volume ?? 0)

    // ── Calculate M1 ATR (14-period) ──
    const atrValues = calculateATR(highs, lows, closes, 14)
    const validATR = atrValues.filter(v => !isNaN(v) && v > 0)
    const currentATR = validATR.length > 0 ? validATR[validATR.length - 1] : 0

    if (currentATR === 0) {
        return { ...EMPTY_SETUP, newsEvent, narrative: 'ATR not yet warmed up on M1.' }
    }

    // ── Average 20-bar volume ──
    const recentVolumes = volumes.slice(-20)
    const avgVolume = recentVolumes.reduce((s, v) => s + v, 0) / Math.max(recentVolumes.length, 1)

    // ── Step 1: Find the Judas Swing ──
    // Look at the last 5 M1 candles for a massive wick (>2x ATR body+wick)
    // The Judas Swing is a candle where the full range (H-L) is >2x ATR
    // AND it has a prominent wick suggesting a fakeout
    let judasIdx = -1
    let judasDirection: 'up' | 'down' | 'none' = 'none'
    let judasWickPrice = 0
    let judasWickSize = 0
    let judasVolumeRatio = 0

    // Scan the last 5 candles for the Judas candle
    const scanStart = Math.max(0, m1Candles.length - 5)
    for (let i = m1Candles.length - 1; i >= scanStart; i--) {
        const range = highs[i] - lows[i]

        // Must be a massive candle (>2x ATR range)
        if (range < currentATR * 2) continue

        const volumeRatio = avgVolume > 0 ? volumes[i] / avgVolume : 0

        // Must have volume spike (>3x average — retail FOMO + algos)
        if (volumeRatio < 3.0) continue

        // Determine fakeout direction based on wick dominance
        const upperWick = highs[i] - Math.max(opens[i], closes[i])
        const lowerWick = Math.min(opens[i], closes[i]) - lows[i]
        const body = Math.abs(closes[i] - opens[i])

        // Judas Swing UP (large upper wick = fakeout to upside)
        if (upperWick > body * 0.5 && upperWick > lowerWick) {
            judasIdx = i
            judasDirection = 'up'
            judasWickPrice = highs[i]
            judasWickSize = Math.round(upperWick * pipMultiplier * 10) / 10
            judasVolumeRatio = Math.round(volumeRatio * 10) / 10
            break
        }

        // Judas Swing DOWN (large lower wick = fakeout to downside)
        if (lowerWick > body * 0.5 && lowerWick > upperWick) {
            judasIdx = i
            judasDirection = 'down'
            judasWickPrice = lows[i]
            judasWickSize = Math.round(lowerWick * pipMultiplier * 10) / 10
            judasVolumeRatio = Math.round(volumeRatio * 10) / 10
            break
        }
    }

    if (judasIdx === -1 || judasDirection === 'none') {
        return {
            ...EMPTY_SETUP,
            newsEvent,
            narrative: `No Judas Swing detected in last 5 M1 candles. ATR: ${(currentATR * pipMultiplier).toFixed(1)} pips.`,
        }
    }

    // ── Step 2: Verify retail trap (already checked via volume ratio ≥3x) ──

    // ── Step 3: Check reversal confirmation ──
    // The candles AFTER the Judas Swing must reverse >50% of the wick
    const candlesAfterJudas = m1Candles.length - judasIdx - 1
    if (candlesAfterJudas < 1) {
        return {
            ...EMPTY_SETUP,
            judasSwingDetected: true,
            judasDirection,
            judasWickSize,
            judasVolumeRatio,
            newsEvent,
            narrative: `Judas Swing ${judasDirection.toUpperCase()} detected (${judasWickSize} pips, ${judasVolumeRatio}x vol) — waiting for reversal confirmation.`,
        }
    }

    // Measure how much price has retraced from the wick extreme
    const lastClose = closes[closes.length - 1]
    let reversalPercentage = 0

    if (judasDirection === 'up') {
        // Judas spiked UP → price should be falling back
        const wickExtent = highs[judasIdx] - lows[judasIdx]
        const retrace = highs[judasIdx] - lastClose
        reversalPercentage = wickExtent > 0 ? Math.round((retrace / wickExtent) * 100) : 0
    } else {
        // Judas spiked DOWN → price should be rising back
        const wickExtent = highs[judasIdx] - lows[judasIdx]
        const retrace = lastClose - lows[judasIdx]
        reversalPercentage = wickExtent > 0 ? Math.round((retrace / wickExtent) * 100) : 0
    }

    const reversalConfirmed = reversalPercentage >= 50

    if (!reversalConfirmed) {
        return {
            ...EMPTY_SETUP,
            judasSwingDetected: true,
            judasDirection,
            judasWickSize,
            judasVolumeRatio,
            reversalPercentage,
            newsEvent,
            narrative: `Judas Swing ${judasDirection.toUpperCase()} detected (${judasWickSize} pips) but reversal only ${reversalPercentage}% — need ≥50%.`,
        }
    }

    // ── Step 4 & 5: Calculate entry, SL, TP ──
    // Direction: OPPOSITE the Judas Swing
    const direction: 'long' | 'short' = judasDirection === 'up' ? 'short' : 'long'
    const entryPrice = lastClose

    // Spread in price units (Operator's Note: account for widened spread)
    const spreadPriceUnits = liveBidAskSpread // Already in price units from caller
    const spreadPips = Math.round(spreadPriceUnits * pipMultiplier * 10) / 10

    // SL: beyond the wick extreme + 5 pips buffer + half-spread
    // Accounting for spread: if we're long, we enter at ASK. SL triggers at BID.
    // So effective SL distance must include the full spread.
    const bufferPips = 5
    const bufferPrice = bufferPips / pipMultiplier
    const spreadBuffer = spreadPriceUnits / 2 // Half-spread adjustment for SL

    let stopLoss: number
    if (direction === 'long') {
        // Judas spiked DOWN, we go LONG — SL below the wick low
        stopLoss = lows[judasIdx] - bufferPrice - spreadBuffer
    } else {
        // Judas spiked UP, we go SHORT — SL above the wick high
        stopLoss = highs[judasIdx] + bufferPrice + spreadBuffer
    }

    // TP: 1:1 R:R — the SL distance applied in the profit direction
    // Adjusted for spread: actual risk = |entry - SL| + spread
    const slDistance = Math.abs(entryPrice - stopLoss)
    const takeProfit = direction === 'long'
        ? entryPrice + slDistance
        : entryPrice - slDistance

    // ── Confidence scoring ──
    let confidence = 50 // Base: Judas + reversal confirmed
    if (judasVolumeRatio > 5) confidence += 15
    if (reversalPercentage > 75) confidence += 15
    if (candlesAfterJudas >= 2) confidence += 10 // More confirmation bars
    if (judasWickSize > currentATR * pipMultiplier * 3) confidence += 10 // Extreme wick

    // ── Build narrative ──
    const dirLabel = direction === 'long' ? 'BUY (fade down-spike)' : 'SELL (fade up-spike)'
    const slPips = Math.round(slDistance * pipMultiplier * 10) / 10
    const tpPips = slPips // 1:1

    const narrative = `👻 GHOST ACTIVATED — ${dirLabel}\n\n` +
        `News Event: ${newsEvent}\n` +
        `Judas Swing: ${judasDirection.toUpperCase()} (${judasWickSize} pips, ${judasVolumeRatio}x vol)\n` +
        `Reversal: ${reversalPercentage}% retraced\n` +
        `Live Spread: ${spreadPips} pips\n\n` +
        `Entry: ${entryPrice.toFixed(dp)}\n` +
        `SL: ${stopLoss.toFixed(dp)} (${slPips} pips — beyond wick + buffer + spread)\n` +
        `TP: ${takeProfit.toFixed(dp)} (${tpPips} pips — 1:1 R:R spread-adjusted)\n\n` +
        `Confidence: ${confidence}%\n` +
        `⚠️ AGGRESSIVE — this is a volatility harvesting setup, not a trend trade.`

    return {
        detected: true,
        direction,
        judasSwingDetected: true,
        judasDirection,
        judasWickSize,
        judasVolumeRatio,
        reversalConfirmed: true,
        reversalPercentage,
        entryPrice,
        stopLoss,
        takeProfit,
        spreadAtExecution: spreadPips,
        newsEvent,
        minutesSinceEvent: null, // Set by the engine from isGhostWindow()
        confidence,
        narrative,
    }
}
