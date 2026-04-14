/**
 * Momentum / Breakout Bot — Trend-Following Strategy
 *
 * FROZEN parameters — no dynamic tuning. Activated only when
 * the Regime Classifier determines: trending_strong or trending_mild.
 *
 * Entry logic: VWAP + EMA(20/50) alignment + ADX > 30 + MACD momentum
 * SL: wider of 1.5x ATR or Donchian opposite boundary
 * TP: 2x ATR (TP1, close 50%) + 3x ATR (TP2, close 50%)
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type { MomentumSetup } from './types'
import { calculateEMA, calculateATR, calculateADX, calculateMACD } from '@/lib/utils/indicators'
import { calculateVWAP } from '@/lib/utils/volume-profile'
import { calculateDonchianChannel } from '@/lib/utils/donchian-cvd'
import { getAssetConfig } from '@/lib/data/asset-config'

// ═══════════════════════════════════════════════════════════════════════════
// Empty Return
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_SETUP: MomentumSetup = {
    detected: false,
    direction: 'none',
    priceAboveVWAP: false,
    emaAlignment: false,
    adxAboveThreshold: false,
    momentumPositive: false,
    entryPrice: null,
    stopLoss: null,
    takeProfit1: null,
    takeProfit2: null,
    trailingStopDistance: null,
    trailingActivation: null,
    atrValue: 0,
    vwapValue: 0,
    adxValue: 0,
    ema5: 0,
    ema13: 0,
    ema50: 0,
    confidence: 0,
    confluenceFactors: [],
    narrative: 'No momentum setup detected.',
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Detector
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect Momentum/Breakout trade setup.
 *
 * LONG conditions (ALL 5 must be true):
 * 1. Current price > VWAP
 * 2. EMA(20) > EMA(50)
 * 3. ADX > 30 (trend has strength)
 * 4. MACD histogram > 0 (momentum positive)
 * 5. EMA(20) slope > 0 over last 5 bars (trend accelerating)
 *
 * SHORT conditions: inverse of all 5.
 *
 * @param candles - M15 candles (need 60+ for EMA(50) warm-up)
 * @param pair - Display format pair name
 */
export function detectMomentum(
    candles: OandaCandle[],
    pair: string,
): MomentumSetup {
    if (candles.length < 60) {
        return { ...EMPTY_SETUP, narrative: 'Insufficient candle data for momentum detection (need 60+).' }
    }

    const highs = candles.map(c => parseFloat(c.mid.h))
    const lows = candles.map(c => parseFloat(c.mid.l))
    const closes = candles.map(c => parseFloat(c.mid.c))
    const volumes = candles.map(c => c.volume ?? 0)

    const assetConfig = getAssetConfig(pair)
    const pipMultiplier = assetConfig.pointMultiplier === 1 ? 1 : (assetConfig.pointMultiplier === 100 ? 100 : 10000)
    const dp = assetConfig.decimalPlaces

    const currentPrice = closes[closes.length - 1]

    // ── Calculate indicators (FROZEN params) ──
    const ema5 = calculateEMA(closes, 5)
    const ema13 = calculateEMA(closes, 13)
    const ema50 = calculateEMA(closes, 50)
    const atrValues = calculateATR(highs, lows, closes, 14)
    const adxResult = calculateADX(highs, lows, closes, 14)
    const macdResult = calculateMACD(closes, 12, 26, 9)
    const vwap = calculateVWAP(candles)
    const donchian = calculateDonchianChannel(highs, lows, 20, pipMultiplier)

    // Get current values
    const lastIdx = closes.length - 1
    const currentEma5 = ema5[lastIdx]
    const currentEma13 = ema13[lastIdx]
    const currentEma50 = ema50[lastIdx]
    const currentATR = atrValues.filter(v => !isNaN(v)).pop() ?? 0
    const currentADX = adxResult.adx.filter(v => !isNaN(v)).pop() ?? 0
    const currentHistogram = macdResult.histogram[macdResult.histogram.length - 1] ?? 0
    const currentVWAP = vwap[vwap.length - 1] ?? currentPrice
    const donchianHigh = donchian.high[lastIdx]
    const donchianLow = donchian.low[lastIdx]

    if (isNaN(currentEma5) || isNaN(currentEma13) || isNaN(currentEma50) || currentATR === 0) {
        return { ...EMPTY_SETUP, narrative: 'Indicators not yet warmed up.' }
    }

    // ── EMA confirm slope ──
    const validEma5 = ema5.filter(v => !isNaN(v))
    const emaSlope = validEma5.length >= 5
        ? validEma5[validEma5.length - 1] - validEma5[validEma5.length - 5]
        : 0

    // ── Check conditions (Triple EMA alignment) ──
    const priceAboveVWAP = currentPrice > currentVWAP
    const priceBelowVWAP = currentPrice < currentVWAP
    const ema5Above13 = currentEma5 > currentEma13
    const ema13Above50 = currentEma13 > currentEma50
    const ema5Below13 = currentEma5 < currentEma13
    const ema13Below50 = currentEma13 < currentEma50
    
    const adxAboveThreshold = currentADX > 30
    const histogramBullish = currentHistogram > 0
    const histogramBearish = currentHistogram < 0
    
    // SPX Energy threshold: ATR must be > 12 pips (approx)
    const isSPX = pair.includes('SPX')
    const hasEnergy = isSPX ? (currentATR * pipMultiplier >= 12) : true

    // LONG: Triple alignment + energy
    const isLong = priceAboveVWAP && ema5Above13 && ema13Above50 && adxAboveThreshold && histogramBullish && emaSlope > 0 && hasEnergy
    // SHORT: Triple alignment + energy
    const isShort = priceBelowVWAP && ema5Below13 && ema13Below50 && adxAboveThreshold && histogramBearish && emaSlope < 0 && hasEnergy

    if (!isLong && !isShort) {
        return {
            ...EMPTY_SETUP,
            atrValue: currentATR,
            vwapValue: currentVWAP,
            adxValue: currentADX,
            ema5: currentEma5,
            ema13: currentEma13,
            ema50: currentEma50,
            priceAboveVWAP: priceAboveVWAP,
            emaAlignment: (ema5Above13 && ema13Above50) || (ema5Below13 && ema13Below50),
            adxAboveThreshold,
            momentumPositive: histogramBullish || histogramBearish,
            narrative: `Momentum conditions not met. VWAP: ${priceAboveVWAP ? 'above' : 'below'}, EMA(5/13/50): ${(ema5Above13 && ema13Above50) ? 'bullish' : (ema5Below13 && ema13Below50) ? 'bearish' : 'mixed'}, ADX: ${currentADX.toFixed(1)} (${adxAboveThreshold ? 'strong' : 'weak'}).`,
        }
    }

    const direction: 'long' | 'short' = isLong ? 'long' : 'short'

    // ── Calculate SL: wider of 1.5x ATR or Donchian opposite ──
    const atrSL = currentATR * 1.5
    let donchianSL: number

    if (direction === 'long') {
        donchianSL = !isNaN(donchianLow) ? currentPrice - donchianLow : atrSL
    } else {
        donchianSL = !isNaN(donchianHigh) ? donchianHigh - currentPrice : atrSL
    }

    // Use the wider SL (gives trend room to breathe)
    const slDistance = Math.max(atrSL, donchianSL)
    const stopLoss = direction === 'long'
        ? currentPrice - slDistance
        : currentPrice + slDistance

    // ── Calculate TP: 2x ATR (TP1), 3x ATR (TP2) ──
    const takeProfit1 = direction === 'long'
        ? currentPrice + currentATR * 2
        : currentPrice - currentATR * 2

    const takeProfit2 = direction === 'long'
        ? currentPrice + currentATR * 3
        : currentPrice - currentATR * 3

    // ── Confidence scoring ──
    let confidence = 40 // Base: all 5 conditions met
    const confluenceFactors: string[] = [`All 5 momentum conditions met (${direction.toUpperCase()})`]

    if (currentADX > 50) {
        confidence += 15
        confluenceFactors.push(`Very strong trend (ADX ${currentADX.toFixed(1)})`)
    }

    // Volume expanding
    const recent10Vol = volumes.slice(-10).reduce((s, v) => s + v, 0) / 10
    const avg50Vol = volumes.slice(-50).reduce((s, v) => s + v, 0) / Math.min(volumes.length, 50)
    if (avg50Vol > 0 && recent10Vol / avg50Vol > 1.3) {
        confidence += 15
        confluenceFactors.push(`Volume expanding (${(recent10Vol / avg50Vol).toFixed(1)}x avg)`)
    }

    // Donchian expanding
    const validWidth = donchian.width.filter(v => !isNaN(v) && v > 0)
    const avgWidth = validWidth.length >= 50
        ? validWidth.slice(-50).reduce((s, v) => s + v, 0) / 50
        : validWidth.reduce((s, v) => s + v, 0) / Math.max(validWidth.length, 1)
    const currentWidth = validWidth.length > 0 ? validWidth[validWidth.length - 1] : 0
    if (avgWidth > 0 && currentWidth > avgWidth * 1.5) {
        confidence += 10
        confluenceFactors.push('Donchian channel expanding')
    }

    // MACD histogram growing (last 3 bars)
    const hist = macdResult.histogram
    if (hist.length >= 3) {
        const h1 = Math.abs(hist[hist.length - 1])
        const h2 = Math.abs(hist[hist.length - 2])
        const h3 = Math.abs(hist[hist.length - 3])
        if (h1 > h2 && h2 > h3) {
            confidence += 10
            confluenceFactors.push('MACD histogram accelerating')
        }
    }

    // ATR expanding
    const validATR = atrValues.filter(v => !isNaN(v))
    const avgATR = validATR.length >= 50
        ? validATR.slice(-50).reduce((s, v) => s + v, 0) / 50
        : validATR.reduce((s, v) => s + v, 0) / Math.max(validATR.length, 1)
    if (avgATR > 0 && currentATR > avgATR * 1.2) {
        confidence += 10
        confluenceFactors.push('ATR expanding (volatility rising)')
    }

    // ── Build narrative ──
    const dirLabel = direction === 'long' ? 'BUY' : 'SELL'
    const slPips = Math.round(slDistance * pipMultiplier * 10) / 10
    const tp1Pips = Math.round(Math.abs(takeProfit1 - currentPrice) * pipMultiplier * 10) / 10
    const tp2Pips = Math.round(Math.abs(takeProfit2 - currentPrice) * pipMultiplier * 10) / 10

    const narrative = `Momentum ${dirLabel} detected!\n\n` +
        `VWAP: ${currentVWAP.toFixed(dp)} (price ${direction === 'long' ? 'above' : 'below'})\n` +
        `EMA(5/13/50): Bullish ? ${ema5Above13 && ema13Above50} | Bearish ? ${ema5Below13 && ema13Below50}\n` +
        `ADX: ${currentADX.toFixed(1)} (strong trend)\n` +
        `MACD: ${currentHistogram > 0 ? '+' : ''}${currentHistogram.toFixed(5)}\n\n` +
        `Entry: ${currentPrice.toFixed(dp)}\n` +
        `SL: ${stopLoss.toFixed(dp)} (${slPips} pips — ${donchianSL > atrSL ? 'Donchian-based' : 'ATR-based'})\n` +
        `TP1: ${takeProfit1.toFixed(dp)} (${tp1Pips} pips — 2x ATR, close 50%)\n` +
        `TP2: ${takeProfit2.toFixed(dp)} (${tp2Pips} pips — 3x ATR, runner target)\n` +
        `Trailing Stop: ${(currentATR * 1.5 * pipMultiplier).toFixed(1)} pips (activates after ${(currentATR * pipMultiplier).toFixed(1)} pips profit)\n\n` +
        `Confidence: ${confidence}%\n` +
        `Confluence: ${confluenceFactors.join('; ')}`

    // Trailing stop distance (Operator's Note: Widened for Index noise)
    const isVolatile = pair.includes('NAS') || pair.includes('SPX') || pair.includes('US30') || pair.includes('Crypto') || pair.includes('BTC')
    const trailingStopDistance = currentATR * (isVolatile ? 2.5 : 1.5)
    const trailingActivation = currentATR * 1.5 // Trailing activates after 1.5x ATR in profit

    return {
        detected: true,
        direction,
        priceAboveVWAP: direction === 'long',
        emaAlignment: true,
        adxAboveThreshold: true,
        momentumPositive: true,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit1,
        takeProfit2,
        trailingStopDistance,
        trailingActivation,
        atrValue: currentATR,
        vwapValue: currentVWAP,
        adxValue: currentADX,
        ema5: currentEma5,
        ema13: currentEma13,
        ema50: currentEma50,
        confidence,
        confluenceFactors,
        narrative,
    }
}
