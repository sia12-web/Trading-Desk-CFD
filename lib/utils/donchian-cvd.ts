/**
 * Donchian Channel + Cumulative Volume Delta (CVD) Calculator
 *
 * Pure order flow indicators for the Operator's HUD strategy:
 * - Donchian Channel: 20-period high/low (retail stop-loss trigger zones)
 * - CVD: Cumulative Volume Delta (institutional absorption/distribution detection)
 */

import type { OandaCandle } from '@/lib/types/oanda'

// ═══════════════════════════════════════════════════════════════════════════
// Donchian Channel (20-period rolling high/low)
// ═══════════════════════════════════════════════════════════════════════════

export interface DonchianChannel {
    high: number[]      // Rolling 20-period high
    low: number[]       // Rolling 20-period low
    middle: number[]    // (high + low) / 2
    width: number[]     // high - low in pips
}

/**
 * Calculate Donchian Channel (20-period by default)
 *
 * The Donchian Channel marks the highest high and lowest low over the last N periods.
 * These levels represent retail stop-loss zones (breakout triggers).
 *
 * Algorithm:
 * - For each bar i where i >= period-1:
 *   - high[i] = max(highs[i-period+1...i])
 *   - low[i] = min(lows[i-period+1...i])
 *   - middle[i] = (high[i] + low[i]) / 2
 *   - width[i] = (high[i] - low[i]) * pipMultiplier
 *
 * @param highs - Array of high prices
 * @param lows - Array of low prices
 * @param period - Lookback period (default: 20)
 * @param pipMultiplier - Pip conversion factor (10000 for most pairs, 100 for JPY)
 */
export function calculateDonchianChannel(
    highs: number[],
    lows: number[],
    period: number = 20,
    pipMultiplier: number = 10000,
): DonchianChannel {
    const high: number[] = []
    const low: number[] = []
    const middle: number[] = []
    const width: number[] = []

    for (let i = 0; i < highs.length; i++) {
        if (i < period - 1) {
            // Not enough data yet — fill with NaN
            high.push(NaN)
            low.push(NaN)
            middle.push(NaN)
            width.push(NaN)
        } else {
            // Calculate rolling max high and min low over the period
            const windowHighs = highs.slice(i - period + 1, i + 1)
            const windowLows = lows.slice(i - period + 1, i + 1)

            const maxHigh = Math.max(...windowHighs)
            const minLow = Math.min(...windowLows)
            const mid = (maxHigh + minLow) / 2
            const widthPips = (maxHigh - minLow) * pipMultiplier

            high.push(maxHigh)
            low.push(minLow)
            middle.push(mid)
            width.push(widthPips)
        }
    }

    return { high, low, middle, width }
}

// ═══════════════════════════════════════════════════════════════════════════
// Cumulative Volume Delta (CVD) — Order Flow Analysis
// ═══════════════════════════════════════════════════════════════════════════

export interface CVDResult {
    cvd: number[]               // Cumulative delta (running total)
    delta: number[]             // Bar-by-bar delta
    trend: 'bullish' | 'bearish' | 'neutral'
    strength: number            // 0-100
    divergences: CVDDivergence[]
}

export interface CVDDivergence {
    type: 'bullish' | 'bearish'
    priceSwing: { start: number; end: number; startIdx: number; endIdx: number }
    cvdSwing: { start: number; end: number }
    narrative: string
}

/**
 * Calculate Cumulative Volume Delta (CVD)
 *
 * CVD tracks the cumulative difference between buying and selling pressure.
 * Since OANDA doesn't provide bid/ask volume, we use a close vs open proxy:
 * - If close > open: delta = +volume (bullish bar)
 * - If close < open: delta = -volume (bearish bar)
 * - If close === open: delta = 0 (neutral bar)
 *
 * Algorithm:
 * 1. For each candle, calculate delta based on close vs open
 * 2. cvd[i] = sum of all deltas from start to i
 * 3. Trend: compare last 10 cvd values vs previous 10 values
 * 4. Strength: |slope| of cvd over last 20 bars, normalized to 0-100
 * 5. Divergences: detect price makes lower low but CVD makes higher low (bullish divergence)
 *
 * @param candles - Array of OANDA candles
 * @param lookback - Number of candles to analyze for divergences (default: 50)
 */
export function calculateCVD(
    candles: OandaCandle[],
    lookback: number = 50,
): CVDResult {
    const delta: number[] = []
    const cvd: number[] = []
    let cumulativeDelta = 0

    // Step 1: Calculate bar-by-bar delta and cumulative CVD
    for (const candle of candles) {
        const open = parseFloat(candle.mid.o)
        const close = parseFloat(candle.mid.c)
        const volume = candle.volume ?? 1 // Default to 1 if volume is missing

        let barDelta = 0
        if (close > open) {
            barDelta = volume // Bullish bar
        } else if (close < open) {
            barDelta = -volume // Bearish bar
        }
        // If close === open, barDelta = 0 (neutral)

        delta.push(barDelta)
        cumulativeDelta += barDelta
        cvd.push(cumulativeDelta)
    }

    // Step 2: Determine CVD trend (compare recent vs previous)
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (cvd.length >= 20) {
        const last10 = cvd.slice(-10)
        const previous10 = cvd.slice(-20, -10)
        const avgLast10 = last10.reduce((sum, v) => sum + v, 0) / 10
        const avgPrevious10 = previous10.reduce((sum, v) => sum + v, 0) / 10

        if (avgLast10 > avgPrevious10 * 1.05) {
            trend = 'bullish'
        } else if (avgLast10 < avgPrevious10 * 0.95) {
            trend = 'bearish'
        }
    }

    // Step 3: Calculate CVD strength (slope over last 20 bars)
    let strength = 0
    if (cvd.length >= 20) {
        const start = cvd[cvd.length - 20]
        const end = cvd[cvd.length - 1]
        const slope = (end - start) / 20

        // Normalize to 0-100 (arbitrary scaling factor based on typical CVD values)
        const maxSlope = 1000 // Adjust based on typical volume values
        strength = Math.min(100, Math.abs(slope) / maxSlope * 100)
    }

    // Step 4: Detect CVD divergences
    const divergences = detectCVDDivergence(
        candles.map(c => parseFloat(c.mid.c)),
        cvd,
        lookback
    )

    return {
        cvd,
        delta,
        trend,
        strength: Math.round(strength * 10) / 10,
        divergences,
    }
}

/**
 * Detect CVD divergences (price vs CVD mismatch = institutional action)
 *
 * Bullish Divergence: Price makes lower low, but CVD makes higher low
 * → Institutional accumulation (buying pressure despite price drop)
 *
 * Bearish Divergence: Price makes higher high, but CVD makes lower high
 * → Institutional distribution (selling pressure despite price rise)
 *
 * Algorithm:
 * 1. Find swing lows in price (local minima with 3-bar lookback)
 * 2. Find swing highs in price (local maxima with 3-bar lookback)
 * 3. Compare consecutive swing points with their corresponding CVD values
 * 4. If price[swing2] < price[swing1] BUT cvd[swing2] > cvd[swing1]:
 *    → Bullish divergence (institutional accumulation)
 * 5. If price[swing2] > price[swing1] BUT cvd[swing2] < cvd[swing1]:
 *    → Bearish divergence (institutional distribution)
 *
 * @param prices - Array of close prices
 * @param cvd - Array of CVD values
 * @param lookback - Number of candles to scan for swing points (default: 50)
 */
export function detectCVDDivergence(
    prices: number[],
    cvd: number[],
    lookback: number = 50,
): CVDDivergence[] {
    const divergences: CVDDivergence[] = []

    if (prices.length < lookback || cvd.length < lookback) {
        return divergences
    }

    // Use the most recent lookback candles
    const recentPrices = prices.slice(-lookback)
    const recentCVD = cvd.slice(-lookback)

    // Find swing lows (local minima with 3-bar lookback)
    const swingLows = findSwingLows(recentPrices, 3)

    // Find swing highs (local maxima with 3-bar lookback)
    const swingHighs = findSwingHighs(recentPrices, 3)

    // Check for bullish divergences (lower low in price, higher low in CVD)
    for (let i = 1; i < swingLows.length; i++) {
        const prevSwing = swingLows[i - 1]
        const currSwing = swingLows[i]

        if (currSwing.price < prevSwing.price && recentCVD[currSwing.index] > recentCVD[prevSwing.index]) {
            divergences.push({
                type: 'bullish',
                priceSwing: {
                    start: prevSwing.price,
                    end: currSwing.price,
                    startIdx: prevSwing.index,
                    endIdx: currSwing.index,
                },
                cvdSwing: {
                    start: recentCVD[prevSwing.index],
                    end: recentCVD[currSwing.index],
                },
                narrative: `Bullish CVD divergence: Price dropped from ${prevSwing.price.toFixed(5)} to ${currSwing.price.toFixed(5)}, but CVD rose from ${recentCVD[prevSwing.index].toFixed(0)} to ${recentCVD[currSwing.index].toFixed(0)}. Institutional absorption likely.`,
            })
        }
    }

    // Check for bearish divergences (higher high in price, lower high in CVD)
    for (let i = 1; i < swingHighs.length; i++) {
        const prevSwing = swingHighs[i - 1]
        const currSwing = swingHighs[i]

        if (currSwing.price > prevSwing.price && recentCVD[currSwing.index] < recentCVD[prevSwing.index]) {
            divergences.push({
                type: 'bearish',
                priceSwing: {
                    start: prevSwing.price,
                    end: currSwing.price,
                    startIdx: prevSwing.index,
                    endIdx: currSwing.index,
                },
                cvdSwing: {
                    start: recentCVD[prevSwing.index],
                    end: recentCVD[currSwing.index],
                },
                narrative: `Bearish CVD divergence: Price rose from ${prevSwing.price.toFixed(5)} to ${currSwing.price.toFixed(5)}, but CVD dropped from ${recentCVD[prevSwing.index].toFixed(0)} to ${recentCVD[currSwing.index].toFixed(0)}. Institutional distribution likely.`,
            })
        }
    }

    return divergences
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Swing Point Detection (reused from m1-detectors.ts pattern)
// ═══════════════════════════════════════════════════════════════════════════

interface SwingPoint {
    index: number
    price: number
}

/**
 * Find swing highs (local maxima) in price array
 *
 * A swing high is a price that is higher than N bars before and N bars after it.
 *
 * @param prices - Array of prices
 * @param lookback - Number of bars to compare on each side (default: 3)
 */
function findSwingHighs(prices: number[], lookback: number = 3): SwingPoint[] {
    const result: SwingPoint[] = []

    for (let i = lookback; i < prices.length - lookback; i++) {
        const price = prices[i]
        let isHigh = true

        for (let j = 1; j <= lookback; j++) {
            if (price <= prices[i - j] || price <= prices[i + j]) {
                isHigh = false
                break
            }
        }

        if (isHigh) {
            result.push({ index: i, price })
        }
    }

    return result
}

/**
 * Find swing lows (local minima) in price array
 *
 * A swing low is a price that is lower than N bars before and N bars after it.
 *
 * @param prices - Array of prices
 * @param lookback - Number of bars to compare on each side (default: 3)
 */
function findSwingLows(prices: number[], lookback: number = 3): SwingPoint[] {
    const result: SwingPoint[] = []

    for (let i = lookback; i < prices.length - lookback; i++) {
        const price = prices[i]
        let isLow = true

        for (let j = 1; j <= lookback; j++) {
            if (price >= prices[i - j] || price >= prices[i + j]) {
                isLow = false
                break
            }
        }

        if (isLow) {
            result.push({ index: i, price })
        }
    }

    return result
}
