/**
 * Operator's HUD Strategy Detector
 *
 * Pure order flow strategy based on Volume, Liquidity, and Time:
 * 1. Donchian Channel (20-period) — Identifies retail stop-loss trigger zones
 * 2. CVD Divergence — Detects institutional absorption (price down, CVD up) or distribution (price up, CVD down)
 * 3. Volume POC Alignment — "Left Page" historical POC vs "Right Page" current POC
 * 4. Volume Voids (LVN) — Target levels for take-profit
 *
 * Execution: Price breaks Donchian boundary + CVD divergence + POC alignment = Trap detected
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type { CVDDivergence } from '@/lib/utils/donchian-cvd'
import { calculateDonchianChannel, calculateCVD } from '@/lib/utils/donchian-cvd'
import { buildVolumeProfile } from '@/lib/utils/volume-profile'
import { getAssetConfig } from '@/lib/data/asset-config'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface OperatorSetup {
    detected: boolean
    operatorType: 'donchian_buy_trap' | 'donchian_sell_trap' | 'none'
    direction: 'long' | 'short' | 'none'

    // Donchian levels
    donchianHigh: number
    donchianLow: number
    donchianMiddle: number
    breakoutLevel: number | null        // Which boundary was pierced
    breakoutDirection: 'above' | 'below' | 'none'

    // CVD state
    cvdTrend: 'bullish' | 'bearish' | 'neutral'
    cvdStrength: number                 // 0-100
    cvdDivergence: CVDDivergence | null // The key signal

    // Volume Profile (Left Page vs Right Page)
    leftPagePOC: number                 // Historical POC from older candles
    currentPOC: number                  // Recent POC
    pocAlignment: boolean               // Is breakout near historical POC?
    volumeVoids: number[]               // LVN levels (fast move targets)

    // Entry mechanics
    entryPrice: number | null
    stopLoss: number | null
    takeProfit: number | null

    confidence: number                  // 0-100
    confluenceFactors: string[]
    narrative: string
}

export interface OperatorEntry {
    triggered: boolean
    direction: 'long' | 'short' | 'none'
    entryPrice: number | null
    stopLoss: number | null
    takeProfit: number | null
    confidence: number
    narrative: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Empty Returns
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_SETUP: OperatorSetup = {
    detected: false,
    operatorType: 'none',
    direction: 'none',
    donchianHigh: 0,
    donchianLow: 0,
    donchianMiddle: 0,
    breakoutLevel: null,
    breakoutDirection: 'none',
    cvdTrend: 'neutral',
    cvdStrength: 0,
    cvdDivergence: null,
    leftPagePOC: 0,
    currentPOC: 0,
    pocAlignment: false,
    volumeVoids: [],
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    confidence: 0,
    confluenceFactors: [],
    narrative: 'No Operator setup detected.',
}

const EMPTY_ENTRY: OperatorEntry = {
    triggered: false,
    direction: 'none',
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    confidence: 0,
    narrative: 'No Operator entry triggered.',
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Detector: Donchian Breakout + CVD Divergence + POC Alignment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Operator Strategy Setup
 *
 * Algorithm:
 * 1. Calculate Donchian Channel (20-period)
 * 2. Calculate CVD for full candle array
 * 3. Build Volume Profile:
 *    - "Left Page": VP for first 60% of candles (historical reference)
 *    - "Right Page": VP for last 40% of candles (current action)
 * 4. Detect Donchian breakout:
 *    - price < donchianLow - 2 pips = bearish breakout (retail panic sell)
 *    - price > donchianHigh + 2 pips = bullish breakout (retail FOMO buy)
 * 5. Check CVD divergence:
 *    - Bearish breakout + bullish CVD divergence = BUY TRAP (institutional absorption)
 *    - Bullish breakout + bearish CVD divergence = SELL TRAP (institutional distribution)
 * 6. Verify POC alignment:
 *    - Is current price near leftPagePOC? (+30 confidence)
 * 7. Identify volume voids (LVN from Left Page) for TP targets
 * 8. Calculate entry, SL, TP:
 *    - Entry: current price (trap trigger point)
 *    - SL: beyond opposite Donchian boundary (15-20 pips)
 *    - TP: nearest volume void in profit direction
 *
 * @param candles - M15 or H1 candles (recommend M15 for precision)
 * @param pair - Display format (EUR/USD, BTC/USD, etc.)
 * @param timeframe - H1 or M15 (default M15)
 */
export function detectOperator(
    candles: OandaCandle[],
    pair: string,
    timeframe: 'H1' | 'M15' = 'M15',
): OperatorSetup {
    // ── Validation ──
    if (candles.length < 100) {
        return { ...EMPTY_SETUP, narrative: 'Insufficient candle data for Operator detection (need 100+ candles).' }
    }

    const assetConfig = getAssetConfig(pair)
    const pipMultiplier = assetConfig.pointMultiplier === 1 ? 1 : (assetConfig.pointMultiplier === 100 ? 100 : 10000)
    const pipBuffer = 1 // Tighten breakout buffer
    const adrThreshold = 250 // ADR filter from Trio AI briefing

    // ── Step 1: Calculate Donchian Channel (20-period) ──
    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))
    const closes = candles.map(c => parseFloat(c.mid.c))

    const isNAS = pair.includes('NAS')
    const isDE30 = pair.includes('DE30')
    const donchianPeriod = (isNAS || isDE30) ? 30 : 20 // Widen to 30 as per Trio briefing
    const donchian = calculateDonchianChannel(highs, lows, donchianPeriod, pipMultiplier)

    // Get current Donchian levels (most recent bar)
    const currentIdx = donchian.high.length - 1
    const donchianHigh = donchian.high[currentIdx]
    const donchianLow = donchian.low[currentIdx]
    const donchianMiddle = donchian.middle[currentIdx]

    if (isNaN(donchianHigh) || isNaN(donchianLow)) {
        return { ...EMPTY_SETUP, narrative: 'Donchian Channel not yet established (need 20+ candles).' }
    }

    // ── Step 2: Calculate CVD (Matrix Rule: Rolling Anchor matches Donchian Window) ──
    const cvdResult = calculateCVD(candles, donchianPeriod)

    // ── Step 3: Build Volume Profile (Left Page vs Right Page) ──
    const leftPageSplit = Math.floor(candles.length * 0.6)
    const leftPageCandles = candles.slice(0, leftPageSplit)
    const rightPageCandles = candles.slice(leftPageSplit)

    const leftPageVP = buildVolumeProfile(leftPageCandles)
    const rightPageVP = buildVolumeProfile(rightPageCandles)

    const leftPagePOC = leftPageVP.vpoc
    const currentPOC = rightPageVP.vpoc
    const volumeVoids = leftPageVP.lvn // LVN from historical data (volume voids)

    // Step 4: Detect Donchian Breakout with Candle Close Confirmation
    const lastCandle = candles[candles.length - 1]
    const currentPrice = parseFloat(lastCandle.mid.c)
    const prevCandle = candles[candles.length - 2]
    const breakoutThresholdPips = pipBuffer / pipMultiplier

    let breakoutDirection: 'above' | 'below' | 'none' = 'none'
    let breakoutLevel: number | null = null

    // TRIO REQUIREMENT: Full candle close beyond band
    if (parseFloat(lastCandle.mid.c) < donchianLow - breakoutThresholdPips) {
        breakoutDirection = 'below'
        breakoutLevel = donchianLow
    } else if (parseFloat(lastCandle.mid.c) > donchianHigh + breakoutThresholdPips) {
        breakoutDirection = 'above'
        breakoutLevel = donchianHigh
    }

    if (breakoutDirection === 'none') {
        return {
            ...EMPTY_SETUP,
            donchianHigh,
            donchianLow,
            donchianMiddle,
            cvdTrend: cvdResult.trend,
            cvdStrength: cvdResult.strength,
            leftPagePOC,
            currentPOC,
            volumeVoids,
            narrative: 'Price has not broken Donchian Channel boundaries — no trap detected yet.',
        }
    }

    // ── Step 5: Check CVD Divergence (the key institutional signal) ──
    // Find the most recent divergence (if any)
    const recentDivergence = cvdResult.divergences.length > 0
        ? cvdResult.divergences[cvdResult.divergences.length - 1]
        : null

    let operatorType: 'donchian_buy_trap' | 'donchian_sell_trap' | 'none' = 'none'
    let direction: 'long' | 'short' | 'none' = 'none'

    // BUY TRAP: Bearish breakout (price drops below Donchian low) + Bullish CVD divergence
    if (breakoutDirection === 'below' && recentDivergence?.type === 'bullish') {
        operatorType = 'donchian_buy_trap'
        direction = 'long'
    }

    // SELL TRAP: Bullish breakout (price rises above Donchian high) + Bearish CVD divergence
    if (breakoutDirection === 'above' && recentDivergence?.type === 'bearish') {
        operatorType = 'donchian_sell_trap'
        direction = 'short'
    }

    if (operatorType === 'none') {
        return {
            ...EMPTY_SETUP,
            donchianHigh,
            donchianLow,
            donchianMiddle,
            breakoutDirection,
            breakoutLevel,
            cvdTrend: cvdResult.trend,
            cvdStrength: cvdResult.strength,
            leftPagePOC,
            currentPOC,
            volumeVoids,
            narrative: `Donchian breakout detected (${breakoutDirection}), but no CVD divergence found — trap conditions not met.`,
        }
    }

    // ── Step 6: Verify POC Alignment & ADR Filter ──
    const currentATR = candles[candles.length - 1].mid ? parseFloat(candles[candles.length - 1].mid.h) - parseFloat(candles[candles.length - 1].mid.l) : 0 // rough ATR
    const dailyCandles = candles.slice(-80) // rough proxy for 5-day ADR on M15
    const adrPips = (Math.max(...dailyCandles.map(c => parseFloat(c.mid.h))) - Math.min(...dailyCandles.map(c => parseFloat(c.mid.l)))) * pipMultiplier
    
    // TRIO REQUIREMENT: ADR Filter (Volatitity Kill Switch)
    if (adrPips > adrThreshold) {
        return {
            ...EMPTY_SETUP,
            narrative: `Sniper disabled: 5-day ADR too high (${Math.round(adrPips)} > ${adrThreshold} pts). Division standing down.`,
        }
    }

    // NAS100 Volatility Kill Switch
    if (isNAS && currentATR * pipMultiplier > 100) {
        return {
            ...EMPTY_SETUP,
            narrative: `Sniper disabled: NAS100 volatility too high (ATR: ${Math.round(currentATR * pipMultiplier)} > 100 pts).`,
        }
    }
    const pocAlignmentThresholdPips = 10 / pipMultiplier
    const pocAlignment = Math.abs(currentPrice - leftPagePOC) < pocAlignmentThresholdPips

    // ── Step 7: Calculate Confidence ──
    let confidence = 40 // Base score for Donchian breakout + CVD divergence
    const confluenceFactors: string[] = []

    if (pocAlignment) {
        confidence += 30
        confluenceFactors.push(`Price near historical POC (${leftPagePOC.toFixed(5)})`)
    }

    if (cvdResult.strength >= 50) {
        confidence += 15
        confluenceFactors.push(`Strong CVD trend (${cvdResult.strength.toFixed(0)}%)`)
    }

    if (volumeVoids.length >= 2) {
        confidence += 10
        confluenceFactors.push(`${volumeVoids.length} volume voids identified (LVN targets)`)
    }

    if (recentDivergence) {
        confidence += 5
        confluenceFactors.push(`Recent CVD divergence: ${recentDivergence.narrative}`)
    }

    // ── Step 8: Calculate Entry, SL, TP ──
    const entryPrice = currentPrice

    // Stop Loss: Tighten to 0.75x ATR equivalent (approx 10 pips for SPX noise)
    const slBuffer = (pair.includes('SPX') ? 10 : 15) / pipMultiplier
    const stopLoss = direction === 'long'
        ? donchianLow - slBuffer
        : donchianHigh + slBuffer

    // Take Profit: Nearest volume void in profit direction
    let takeProfit: number | null = null
    if (volumeVoids.length > 0) {
        if (direction === 'long') {
            // Find nearest LVN above current price
            const voidsAbove = volumeVoids.filter(v => v > currentPrice).sort((a, b) => a - b)
            takeProfit = voidsAbove.length > 0 ? voidsAbove[0] : currentPrice + (50 / pipMultiplier)
        } else {
            // Find nearest LVN below current price
            const voidsBelow = volumeVoids.filter(v => v < currentPrice).sort((a, b) => b - a)
            takeProfit = voidsBelow.length > 0 ? voidsBelow[0] : currentPrice - (50 / pipMultiplier)
        }
    } else {
        // Default TP: 50 pips in profit direction
        takeProfit = direction === 'long'
            ? currentPrice + (50 / pipMultiplier)
            : currentPrice - (50 / pipMultiplier)
    }

    // ── Step 9: Build Narrative ──
    const directionLabel = direction === 'long' ? 'BUY' : 'SELL'
    const trapType = operatorType === 'donchian_buy_trap'
        ? 'Retail panic sell below Donchian low — institutions absorbing (bullish trap)'
        : 'Retail FOMO buy above Donchian high — institutions distributing (bearish trap)'

    const narrative = `🎯 ${directionLabel} TRAP DETECTED!\n\n` +
        `${trapType}\n\n` +
        `Donchian: ${donchianLow.toFixed(5)} - ${donchianHigh.toFixed(5)}\n` +
        `Breakout: ${currentPrice.toFixed(5)} (${breakoutDirection} ${breakoutLevel?.toFixed(5)})\n` +
        `CVD Divergence: ${recentDivergence?.type} (${recentDivergence?.narrative})\n` +
        `Left Page POC: ${leftPagePOC.toFixed(5)} | Current POC: ${currentPOC.toFixed(5)}\n\n` +
        `Entry: ${entryPrice.toFixed(5)}\n` +
        `SL: ${stopLoss.toFixed(5)} (${Math.round(Math.abs(entryPrice - stopLoss) * pipMultiplier * 10) / 10} pips)\n` +
        `TP: ${takeProfit.toFixed(5)} (${Math.round(Math.abs(takeProfit - entryPrice) * pipMultiplier * 10) / 10} pips)\n\n` +
        `Confidence: ${confidence}%\n` +
        `Confluence: ${confluenceFactors.join('; ')}`

    return {
        detected: true,
        operatorType,
        direction,
        donchianHigh,
        donchianLow,
        donchianMiddle,
        breakoutLevel,
        breakoutDirection,
        cvdTrend: cvdResult.trend,
        cvdStrength: cvdResult.strength,
        cvdDivergence: recentDivergence,
        leftPagePOC,
        currentPOC,
        pocAlignment,
        volumeVoids,
        entryPrice,
        stopLoss,
        takeProfit,
        confidence,
        confluenceFactors,
        narrative,
    }
}

/**
 * Detect Operator M1 Entry (optional refinement layer)
 *
 * After Operator setup is detected on M15/H1, this function scans M1 candles
 * for precise entry confirmation using:
 * - M1 CHoCH (Change of Character)
 * - M1 volume spike (2x average)
 * - Tighter SL using M1 wick low/high
 *
 * @param operator - Operator setup from detectOperator()
 * @param m1Candles - M1 candles for entry confirmation
 * @param pair - Display format (EUR/USD, etc.)
 */
export function detectOperatorEntry(
    operator: OperatorSetup,
    m1Candles: OandaCandle[],
    pair: string,
): OperatorEntry {
    if (!operator.detected || operator.direction === 'none') {
        return EMPTY_ENTRY
    }

    if (m1Candles.length < 60) {
        return { ...EMPTY_ENTRY, narrative: 'Insufficient M1 data for entry refinement.' }
    }

    // Look for M1 volume spike (2x average) in recent candles
    const recent60 = m1Candles.slice(-60)
    const avgVolume = recent60.slice(0, -10).reduce((sum, c) => sum + (c.volume ?? 0), 0) / 50

    let volumeSpikeDetected = false
    let entryPrice: number | null = null

    for (let i = recent60.length - 10; i < recent60.length; i++) {
        const vol = recent60[i].volume ?? 0
        if (vol >= avgVolume * 2) {
            volumeSpikeDetected = true
            entryPrice = parseFloat(recent60[i].mid.c)
            break
        }
    }

    if (!volumeSpikeDetected) {
        return {
            ...EMPTY_ENTRY,
            narrative: 'Operator setup active, but no M1 volume spike detected yet — wait for confirmation.',
        }
    }

    // Use M1 wick for tighter SL
    const assetConfig = getAssetConfig(pair)
    const pipMultiplier = assetConfig.pointMultiplier === 1 ? 1 : (assetConfig.pointMultiplier === 100 ? 100 : 10000)

    const lastCandle = recent60[recent60.length - 1]
    const wickLow = parseFloat(lastCandle.mid.l)
    const wickHigh = parseFloat(lastCandle.mid.h)

    const stopLoss = operator.direction === 'long'
        ? wickLow - (5 / pipMultiplier) // 5 pip buffer below wick
        : wickHigh + (5 / pipMultiplier) // 5 pip buffer above wick

    const takeProfit = operator.takeProfit // Use original TP from M15/H1 setup

    const narrative = `✅ M1 Entry Confirmed!\n\n` +
        `Direction: ${operator.direction.toUpperCase()}\n` +
        `Entry: ${entryPrice?.toFixed(5)}\n` +
        `SL: ${stopLoss.toFixed(5)} (M1 wick-based)\n` +
        `TP: ${takeProfit?.toFixed(5)}\n\n` +
        `M1 volume spike detected — trade ready to execute!`

    return {
        triggered: true,
        direction: operator.direction,
        entryPrice,
        stopLoss,
        takeProfit,
        confidence: operator.confidence,
        narrative,
    }
}
