/**
 * M1 Detectors — Fast Matrix execution-layer detection on 1-minute candles.
 * CHoCH (Change of Character), Volume Climax, and Diamond Box (1/Price equilibrium).
 */
import type { OandaCandle } from '@/lib/types/oanda'
import type { CHoCHSignal, VolumeClimax, DiamondBox } from '@/lib/desk/types'

// ── Helper: find swing highs/lows on candle data ──

interface SwingPoint {
    index: number
    price: number
    time: string
}

function findSwingHighs(candles: OandaCandle[], lookback: number = 3): SwingPoint[] {
    const result: SwingPoint[] = []
    for (let i = lookback; i < candles.length - lookback; i++) {
        const high = parseFloat(candles[i].mid.h)
        let isHigh = true
        for (let j = 1; j <= lookback; j++) {
            if (high <= parseFloat(candles[i - j].mid.h) || high <= parseFloat(candles[i + j].mid.h)) {
                isHigh = false
                break
            }
        }
        if (isHigh) result.push({ index: i, price: high, time: candles[i].time })
    }
    return result
}

function findSwingLows(candles: OandaCandle[], lookback: number = 3): SwingPoint[] {
    const result: SwingPoint[] = []
    for (let i = lookback; i < candles.length - lookback; i++) {
        const low = parseFloat(candles[i].mid.l)
        let isLow = true
        for (let j = 1; j <= lookback; j++) {
            if (low >= parseFloat(candles[i - j].mid.l) || low >= parseFloat(candles[i + j].mid.l)) {
                isLow = false
                break
            }
        }
        if (isLow) result.push({ index: i, price: low, time: candles[i].time })
    }
    return result
}

/**
 * Detect Change of Character (CHoCH) on M1 candles.
 * Bullish CHoCH: price breaks above the most recent Lower High in a downtrend sequence.
 * Bearish CHoCH: price breaks below the most recent Higher Low in an uptrend sequence.
 */
export function detectCHoCH(
    m1Candles: OandaCandle[],
    isBullish: boolean,
    swingLookback: number = 3
): CHoCHSignal {
    const none: CHoCHSignal = { detected: false, direction: 'none', breakPrice: null, breakTime: null, previousSwingPrice: null }
    if (m1Candles.length < 20) return none

    // Use the last 60 candles (1 hour of M1 data) for structure
    const recent = m1Candles.slice(-60)

    if (isBullish) {
        // Find swing highs in the recent downtrend — look for Lower Highs
        const swingHighs = findSwingHighs(recent, swingLookback)
        if (swingHighs.length < 2) return none

        // Find the most recent Lower High (a high that is lower than the one before it)
        let lastLowerHigh: SwingPoint | null = null
        for (let i = swingHighs.length - 1; i >= 1; i--) {
            if (swingHighs[i].price < swingHighs[i - 1].price) {
                lastLowerHigh = swingHighs[i]
                break
            }
        }
        if (!lastLowerHigh) return none

        // Check if any candle AFTER the Lower High closes above it (CHoCH)
        for (let i = lastLowerHigh.index + 1; i < recent.length; i++) {
            const close = parseFloat(recent[i].mid.c)
            if (close > lastLowerHigh.price) {
                return {
                    detected: true,
                    direction: 'bullish',
                    breakPrice: close,
                    breakTime: recent[i].time,
                    previousSwingPrice: lastLowerHigh.price,
                }
            }
        }
    } else {
        // Find swing lows in the recent uptrend — look for Higher Lows
        const swingLows = findSwingLows(recent, swingLookback)
        if (swingLows.length < 2) return none

        // Find the most recent Higher Low
        let lastHigherLow: SwingPoint | null = null
        for (let i = swingLows.length - 1; i >= 1; i--) {
            if (swingLows[i].price > swingLows[i - 1].price) {
                lastHigherLow = swingLows[i]
                break
            }
        }
        if (!lastHigherLow) return none

        // Check if any candle AFTER the Higher Low closes below it (CHoCH)
        for (let i = lastHigherLow.index + 1; i < recent.length; i++) {
            const close = parseFloat(recent[i].mid.c)
            if (close < lastHigherLow.price) {
                return {
                    detected: true,
                    direction: 'bearish',
                    breakPrice: close,
                    breakTime: recent[i].time,
                    previousSwingPrice: lastHigherLow.price,
                }
            }
        }
    }

    return none
}

/**
 * Detect Volume Climax on M1 candles.
 * A candle with volume >= 2x the recent average AND a rejection wick (Spring/Upthrust).
 * The rejection wick means: the body is in the opposite half of the candle range.
 */
export function detectVolumeClimax(
    m1Candles: OandaCandle[],
    lookback: number = 20
): VolumeClimax {
    const none: VolumeClimax = { detected: false, volumeRatio: 0, rejectionCandle: false, time: null }
    if (m1Candles.length < lookback + 5) return none

    // Calculate average volume over the lookback window (before the last 5 candles)
    const volumeWindow = m1Candles.slice(-lookback - 5, -5)
    const avgVolume = volumeWindow.reduce((sum, c) => sum + (c.volume ?? 0), 0) / volumeWindow.length
    if (avgVolume <= 0) return none

    // Check last 5 candles for a climax
    const recentCandles = m1Candles.slice(-5)
    for (let i = recentCandles.length - 1; i >= 0; i--) {
        const c = recentCandles[i]
        const vol = c.volume ?? 0
        const ratio = vol / avgVolume
        if (ratio < 2.0) continue

        // Check for rejection wick
        const open = parseFloat(c.mid.o)
        const high = parseFloat(c.mid.h)
        const low = parseFloat(c.mid.l)
        const close = parseFloat(c.mid.c)
        const range = high - low
        if (range <= 0) continue

        const body = Math.abs(close - open)
        const bodyRatio = body / range
        // Rejection = body is small relative to range (long wick) OR body is in one half
        const upperWick = high - Math.max(open, close)
        const lowerWick = Math.min(open, close) - low
        const hasRejection = (upperWick > body * 1.5) || (lowerWick > body * 1.5) || bodyRatio < 0.4

        if (hasRejection) {
            return { detected: true, volumeRatio: ratio, rejectionCandle: true, time: c.time }
        }
    }

    return none
}

/**
 * Detect a Diamond Box (Wave 4 consolidation zone) on M15 candles.
 * A horizontal range where price chops sideways after a Wave 3 impulse.
 * The "1/Price overlay" equilibrium is the midpoint of the range.
 * Box is "ready" when at least 6 candles have elapsed in the range.
 */
export function detectDiamondBox(
    m15Candles: OandaCandle[],
    lookback: number = 30
): DiamondBox {
    const none: DiamondBox = { boxHigh: 0, boxLow: 0, equilibriumPrice: 0, candlesInBox: 0, isReady: false }
    if (m15Candles.length < lookback) return none

    const recent = m15Candles.slice(-lookback)

    // Find the highest point (potential Wave 3 peak) in the first half
    const firstHalf = recent.slice(0, Math.floor(lookback / 2))
    let wave3High = -Infinity
    let wave3Low = Infinity
    for (const c of firstHalf) {
        const h = parseFloat(c.mid.h)
        const l = parseFloat(c.mid.l)
        if (h > wave3High) wave3High = h
        if (l < wave3Low) wave3Low = l
    }

    // The second half should be a consolidation (narrower range than first half)
    const secondHalf = recent.slice(Math.floor(lookback / 2))
    let boxHigh = -Infinity
    let boxLow = Infinity
    for (const c of secondHalf) {
        const h = parseFloat(c.mid.h)
        const l = parseFloat(c.mid.l)
        if (h > boxHigh) boxHigh = h
        if (l < boxLow) boxLow = l
    }

    const firstHalfRange = wave3High - wave3Low
    const boxRange = boxHigh - boxLow
    if (firstHalfRange <= 0 || boxRange <= 0) return none

    // Box should be narrower than the impulse (Wave 3 range > box range)
    if (boxRange >= firstHalfRange * 0.8) return none

    // Count candles within the box boundaries
    let candlesInBox = 0
    for (const c of secondHalf) {
        const h = parseFloat(c.mid.h)
        const l = parseFloat(c.mid.l)
        if (h <= boxHigh * 1.001 && l >= boxLow * 0.999) candlesInBox++
    }

    // 1/Price overlay equilibrium: midpoint of box
    // (In theory: sqrt(boxHigh * (1/boxLow)) normalized, but practically = midpoint)
    const equilibriumPrice = (boxHigh + boxLow) / 2

    return {
        boxHigh,
        boxLow,
        equilibriumPrice,
        candlesInBox,
        isReady: candlesInBox >= 6,
    }
}
