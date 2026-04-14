/**
 * Killzone Detector — Automated institutional trap zone detection.
 *
 * Builds the Killzone box mechanically:
 * 1. H1 Elliott Wave state → identifies Wave 2 or 4 correction
 * 2. Fibonacci retracement grid from impulse swing (61.8-78.6% for W2, 38.2-50% for W4)
 * 3. M15 Volume Profile over pullback period → extracts POC
 * 4. POC/Fib confluence → 10-20 pip Killzone box
 * 5. M1 fakeout entry detection (volume climax + CHoCH) inside the box
 *
 * Pure algorithmic — no AI, no API calls. Typed return objects.
 */

import type { OandaCandle } from '@/lib/types/oanda'
import type { H1WaveState } from '@/lib/utils/elliott-wave-h1'
import { buildVolumeProfile } from '@/lib/utils/volume-profile'
import { detectCHoCH, detectVolumeClimax } from '@/lib/utils/m1-detectors'
import { getAssetConfig } from '@/lib/data/asset-config'

// ── Types ──

export interface KillzoneBox {
    high: number
    low: number
    center: number
    widthPips: number
}

export interface KillzoneFibZone {
    fibHigh: number                 // Top of targeted Fib zone
    fibLow: number                  // Bottom of targeted Fib zone
    fibLevels: {
        fib236: number
        fib382: number
        fib50: number
        fib618: number
        fib786: number
    }
    targetZone: 'wave2' | 'wave4'
}

export interface KillzonePOC {
    poc: number
    valueAreaHigh: number
    valueAreaLow: number
    pullbackVolume: number
    pocWithinFibZone: boolean
    pocDistanceToFibCenterPips: number
}

export interface KillzoneSetup {
    detected: boolean
    waveType: 2 | 4 | null
    direction: 'bullish' | 'bearish' | 'none'

    fibZone: KillzoneFibZone | null
    pullbackPOC: KillzonePOC | null
    box: KillzoneBox | null

    confidence: number              // 0-100
    confluenceFactors: string[]

    impulseStart: number | null
    impulseEnd: number | null

    priceInBox: boolean
    narrative: string
}

export interface KillzoneEntry {
    triggered: boolean
    direction: 'long' | 'short' | 'none'
    entryPrice: number | null
    stopLoss: number | null
    stopLossPips: number | null
    choch: { detected: boolean; breakPrice: number | null }
    volumeClimax: { detected: boolean; volumeRatio: number; rejectionCandle: boolean }
    confidence: number
    narrative: string
}

// ── Empty Returns ──

const EMPTY_SETUP: KillzoneSetup = {
    detected: false,
    waveType: null,
    direction: 'none',
    fibZone: null,
    pullbackPOC: null,
    box: null,
    confidence: 0,
    confluenceFactors: [],
    impulseStart: null,
    impulseEnd: null,
    priceInBox: false,
    narrative: 'No active Wave 2/4 correction detected — Killzone not applicable.',
}

const EMPTY_ENTRY: KillzoneEntry = {
    triggered: false,
    direction: 'none',
    entryPrice: null,
    stopLoss: null,
    stopLossPips: null,
    choch: { detected: false, breakPrice: null },
    volumeClimax: { detected: false, volumeRatio: 0, rejectionCandle: false },
    confidence: 0,
    narrative: 'No Killzone entry signal.',
}

// ── Main Detector ──

/**
 * Detect Killzone — the institutional trap zone where Fib correction levels
 * and Volume POC overlap during Wave 2/4 corrections.
 */
export function detectKillzone(
    h1WaveState: H1WaveState,
    m15Candles: OandaCandle[],
    pair: string,
): KillzoneSetup {
    // Guard: must be in Wave 2 or Wave 4
    if (h1WaveState.currentWave !== 2 && h1WaveState.currentWave !== 4) {
        return EMPTY_SETUP
    }
    if (h1WaveState.direction === 'unclear') return EMPTY_SETUP
    if (m15Candles.length < 20) return EMPTY_SETUP

    const waveType = h1WaveState.currentWave as 2 | 4
    const direction = h1WaveState.direction

    // Step 1: Extract impulse endpoints
    let impulseStart: number | null = null
    let impulseEnd: number | null = null

    if (waveType === 2) {
        // Wave 2 = correction after Wave 1. Impulse is wave1Start → wave1End.
        impulseStart = h1WaveState.wave1Start
        impulseEnd = h1WaveState.wave1End
    } else {
        // Wave 4 = correction after Wave 3. Impulse is wave2End (W3 start) → actual W3 peak.
        impulseStart = h1WaveState.wave2End
        // Use wave3Target as proxy for Wave 3 peak. For bullish, find actual max in M15.
        impulseEnd = h1WaveState.wave3Target
    }

    if (impulseStart === null || impulseEnd === null) {
        return { ...EMPTY_SETUP, narrative: 'Wave structure incomplete — missing impulse endpoints.' }
    }

    // Ensure impulseStart < impulseEnd for bullish, impulseStart > impulseEnd for bearish
    const isBullish = direction === 'bullish'
    const swingLow = isBullish ? Math.min(impulseStart, impulseEnd) : Math.min(impulseStart, impulseEnd)
    const swingHigh = isBullish ? Math.max(impulseStart, impulseEnd) : Math.max(impulseStart, impulseEnd)

    if (swingHigh <= swingLow) {
        return { ...EMPTY_SETUP, narrative: 'Invalid impulse range — swingHigh equals swingLow.' }
    }

    // Step 2: Compute Fibonacci grid
    const range = swingHigh - swingLow
    const fibLevels = {
        fib236: swingHigh - range * 0.236,
        fib382: swingHigh - range * 0.382,
        fib50: swingHigh - range * 0.5,
        fib618: swingHigh - range * 0.618,
        fib786: swingHigh - range * 0.786,
    }

    // Target zone depends on wave type
    let fibHigh: number
    let fibLow: number
    let targetZone: 'wave2' | 'wave4'

    if (waveType === 2) {
        // Wave 2: deep correction → 61.8% to 78.6%
        fibHigh = fibLevels.fib618
        fibLow = fibLevels.fib786
        targetZone = 'wave2'
    } else {
        // Wave 4: shallow correction → 38.2% to 50%
        fibHigh = fibLevels.fib382
        fibLow = fibLevels.fib50
        targetZone = 'wave4'
    }

    // For bearish impulses, Fib retracement goes UP (correction rallies)
    if (!isBullish) {
        // Invert: correction retraces UP from impulse low
        const fibLevelsInv = {
            fib236: swingLow + range * 0.236,
            fib382: swingLow + range * 0.382,
            fib50: swingLow + range * 0.5,
            fib618: swingLow + range * 0.618,
            fib786: swingLow + range * 0.786,
        }
        if (waveType === 2) {
            fibHigh = fibLevelsInv.fib786
            fibLow = fibLevelsInv.fib618
        } else {
            fibHigh = fibLevelsInv.fib50
            fibLow = fibLevelsInv.fib382
        }
        Object.assign(fibLevels, fibLevelsInv)
    }

    // Ensure fibHigh > fibLow
    if (fibHigh < fibLow) [fibHigh, fibLow] = [fibLow, fibHigh]

    const fibZone: KillzoneFibZone = {
        fibHigh,
        fibLow,
        fibLevels,
        targetZone,
    }

    // Step 3: Slice M15 candles to pullback period and build volume profile
    const pullbackCandles = slicePullbackCandles(m15Candles, impulseEnd, isBullish)
    if (pullbackCandles.length < 10) {
        return { ...EMPTY_SETUP, fibZone, narrative: 'Insufficient pullback candles for volume profile.' }
    }

    const volumeProfile = buildVolumeProfile(pullbackCandles, 30)
    const poc = volumeProfile.vpoc
    const assetConfig = getAssetConfig(pair)
    const pipMult = assetConfig.pointMultiplier

    // Step 4: Check POC/Fib confluence
    const fibCenter = (fibHigh + fibLow) / 2
    const pocDistancePips = Math.abs(poc - fibCenter) * pipMult
    const fibZoneWidthPips = (fibHigh - fibLow) * pipMult
    const pocWithinFibZone = poc >= fibLow && poc <= fibHigh
    const pocNearFibZone = pocDistancePips <= Math.max(10, fibZoneWidthPips)

    const pullbackPOC: KillzonePOC = {
        poc,
        valueAreaHigh: volumeProfile.valueAreaHigh,
        valueAreaLow: volumeProfile.valueAreaLow,
        pullbackVolume: volumeProfile.totalVolume,
        pocWithinFibZone,
        pocDistanceToFibCenterPips: Math.round(pocDistancePips * 10) / 10,
    }

    if (!pocWithinFibZone && !pocNearFibZone) {
        return {
            ...EMPTY_SETUP,
            fibZone,
            pullbackPOC,
            impulseStart,
            impulseEnd,
            narrative: `POC at ${poc.toFixed(assetConfig.decimalPlaces)} is ${pocDistancePips.toFixed(1)} ${assetConfig.pointLabel} from Fib zone — no confluence.`,
        }
    }

    // Step 5: Build the Killzone box
    // Center on the average of POC and the nearest Fib boundary
    const nearestFibBoundary = Math.abs(poc - fibHigh) < Math.abs(poc - fibLow) ? fibHigh : fibLow
    const boxCenter = (poc + nearestFibBoundary) / 2
    // Width: clamp between 10 and 20 pips (or the fib zone width if smaller)
    const rawWidthPips = Math.max(10, Math.min(20, fibZoneWidthPips))
    const halfWidth = (rawWidthPips / pipMult) / 2

    const box: KillzoneBox = {
        high: boxCenter + halfWidth,
        low: boxCenter - halfWidth,
        center: boxCenter,
        widthPips: Math.round(rawWidthPips * 10) / 10,
    }

    // Step 6: Confidence scoring
    let confidence = 0
    const confluenceFactors: string[] = []

    if (pocWithinFibZone) {
        confidence += 30
        confluenceFactors.push('POC inside Fib zone')
    } else if (pocNearFibZone) {
        confidence += 15
        confluenceFactors.push(`POC within ${pocDistancePips.toFixed(1)} ${assetConfig.pointLabel} of Fib zone`)
    }

    if (h1WaveState.confidence > 70) {
        confidence += 15
        confluenceFactors.push(`H1 wave confidence ${h1WaveState.confidence}%`)
    }

    // Clear POC: POC volume significantly above average bin volume
    const avgBinVol = volumeProfile.totalVolume / 30
    const pocLevel = volumeProfile.levels.find(l => Math.abs(l.price - poc) < (fibHigh - fibLow) / 30)
    if (pocLevel && pocLevel.volume > avgBinVol * 2) {
        confidence += 15
        confluenceFactors.push('Strong POC (>2x avg bin volume)')
    }

    if (h1WaveState.correctiveCompleteConfidence > 50) {
        confidence += 10
        confluenceFactors.push(`Correction ${h1WaveState.correctiveCompleteConfidence}% complete`)
    }

    // HVN nodes near the box
    const hvnNearBox = volumeProfile.hvn.filter(h => h >= box.low && h <= box.high).length
    if (hvnNearBox >= 1) {
        confidence += 15
        confluenceFactors.push(`${hvnNearBox} HVN node(s) inside box`)
    }

    // Step 7: Check if current price is in the box
    const currentPrice = parseFloat(m15Candles[m15Candles.length - 1].mid.c)
    const priceInBox = currentPrice >= box.low && currentPrice <= box.high

    const dp = assetConfig.decimalPlaces
    const narrative = `Wave ${waveType} Killzone detected: ${box.high.toFixed(dp)} - ${box.low.toFixed(dp)} (${box.widthPips} ${assetConfig.pointLabel}). ` +
        `Fib ${targetZone === 'wave2' ? '61.8-78.6%' : '38.2-50%'} zone with POC confluence. ` +
        `Confidence: ${confidence}%. ` +
        (priceInBox ? 'Price IS inside the box — watch M1 for entry.' : 'Price outside box — waiting for price to enter.')

    return {
        detected: true,
        waveType,
        direction,
        fibZone,
        pullbackPOC,
        box,
        confidence,
        confluenceFactors,
        impulseStart,
        impulseEnd,
        priceInBox,
        narrative,
    }
}

// ── M1 Entry Detection ──

/**
 * Detect Killzone entry — M1 fakeout wick inside the Killzone box.
 * Uses existing CHoCH and Volume Climax detectors.
 */
export function detectKillzoneEntry(
    killzone: KillzoneSetup,
    m1Candles: OandaCandle[],
    pair: string,
): KillzoneEntry {
    if (!killzone.detected || !killzone.box || m1Candles.length < 25) {
        return EMPTY_ENTRY
    }

    // Determine entry direction based on wave type and macro direction
    // Wave 2 bullish: price retraces down → entry is LONG (buy the dip)
    // Wave 2 bearish: price retraces up → entry is SHORT (sell the rally)
    // Wave 4 follows same logic
    const isBullish = killzone.direction === 'bullish'
    const entryDirection: 'long' | 'short' = isBullish ? 'long' : 'short'

    // Check M1 signals
    const choch = detectCHoCH(m1Candles, isBullish)
    const volClimax = detectVolumeClimax(m1Candles)

    const chochDetected = choch.detected
    const climaxDetected = volClimax.detected && volClimax.rejectionCandle

    if (!chochDetected && !climaxDetected) {
        return { ...EMPTY_ENTRY, narrative: 'Price in Killzone but no M1 confirmation yet — waiting for volume climax + CHoCH.' }
    }

    // Calculate entry and stop loss
    const assetConfig = getAssetConfig(pair)
    const pipMult = assetConfig.pointMultiplier
    const entryPrice = choch.breakPrice ?? parseFloat(m1Candles[m1Candles.length - 1].mid.c)

    // SL: find the rejection wick extreme
    let stopLoss: number | null = null
    if (volClimax.time) {
        // Find the climax candle
        const climaxCandle = m1Candles.find(c => c.time === volClimax.time)
        if (climaxCandle) {
            const buffer = 2 / pipMult  // 2 pips buffer
            if (isBullish) {
                stopLoss = parseFloat(climaxCandle.mid.l) - buffer
            } else {
                stopLoss = parseFloat(climaxCandle.mid.h) + buffer
            }
        }
    }
    // Fallback SL: below/above the killzone box
    if (stopLoss === null) {
        const buffer = 2 / pipMult
        stopLoss = isBullish ? killzone.box.low - buffer : killzone.box.high + buffer
    }

    const stopLossPips = Math.round(Math.abs(entryPrice - stopLoss) * pipMult * 10) / 10

    // Confidence scoring
    let confidence = 0
    if (climaxDetected) confidence += 40
    if (chochDetected) confidence += 40
    if (climaxDetected && chochDetected) confidence += 20  // bonus for both

    const dp = assetConfig.decimalPlaces
    const narrative = `Killzone ${entryDirection.toUpperCase()} entry: ${entryPrice.toFixed(dp)}. ` +
        `SL: ${stopLoss.toFixed(dp)} (${stopLossPips} ${assetConfig.pointLabel}). ` +
        (climaxDetected ? `Volume climax ${volClimax.volumeRatio.toFixed(1)}x avg with rejection wick. ` : '') +
        (chochDetected ? `CHoCH confirmed at ${choch.breakPrice?.toFixed(dp)}. ` : '') +
        `Confidence: ${confidence}%.`

    return {
        triggered: confidence >= 40,
        direction: entryDirection,
        entryPrice,
        stopLoss,
        stopLossPips,
        choch: { detected: chochDetected, breakPrice: choch.breakPrice },
        volumeClimax: { detected: climaxDetected, volumeRatio: volClimax.volumeRatio, rejectionCandle: volClimax.rejectionCandle },
        confidence,
        narrative,
    }
}

// ── Tier 2: W-X-Y Institutional Killzone ──

import type { MarketStateResult } from '@/lib/utils/market-state'

export interface WXYProjection {
    waveW: { start: number; end: number; distancePips: number }
    xWave: { peak: number }
    waveYProjection: number
    waveYZone: { high: number; low: number }
}

export interface InstitutionalKillzoneSetup extends KillzoneSetup {
    marketState: MarketStateResult | null
    wxyProjection: WXYProjection | null
    institutionalBox: KillzoneBox | null
}

const EMPTY_INSTITUTIONAL: InstitutionalKillzoneSetup = {
    ...EMPTY_SETUP,
    marketState: null,
    wxyProjection: null,
    institutionalBox: null,
}

/**
 * Detect Institutional Killzone — enhanced with W-X-Y wave projection.
 *
 * Only runs when Tier 1 detects complex_correction (proceedToTier2 === true).
 *
 * Algorithm:
 * 1. Call existing detectKillzone() for base setup
 * 2. Find Wave W: first major swing inside the correction
 * 3. Find X-Wave peak: opposing swing after Wave W
 * 4. Project Wave Y: xWavePeak ± waveWDistance
 * 5. Build Volume Profile over full M15 window (extended POC)
 * 6. Institutional box = intersection of Wave Y zone and Volume POC
 */
export function detectInstitutionalKillzone(
    h1WaveState: H1WaveState,
    m15Candles: OandaCandle[],
    pair: string,
    marketState: MarketStateResult,
): InstitutionalKillzoneSetup {
    // Guard: only run if Tier 1 says complex correction
    if (!marketState.proceedToTier2) {
        return { ...EMPTY_INSTITUTIONAL, marketState, narrative: 'Tier 1: Not complex correction — institutional killzone skipped.' }
    }

    // Get base killzone setup first
    const baseSetup = detectKillzone(h1WaveState, m15Candles, pair)

    // Build result extending base setup
    const result: InstitutionalKillzoneSetup = {
        ...baseSetup,
        marketState,
        wxyProjection: null,
        institutionalBox: null,
    }

    if (m15Candles.length < 50) {
        result.narrative = baseSetup.narrative + ' (Insufficient M15 data for W-X-Y projection.)'
        return result
    }

    const isBullish = h1WaveState.direction === 'bullish'
    const assetConfig = getAssetConfig(pair)
    const pipMult = assetConfig.pointMultiplier

    // ── Find swing points in M15 data for W-X-Y detection ──
    const swingLookback = 5
    const swingHighs: Array<{ index: number; price: number }> = []
    const swingLows: Array<{ index: number; price: number }> = []

    for (let i = swingLookback; i < m15Candles.length - swingLookback; i++) {
        const high = parseFloat(m15Candles[i].mid.h)
        const low = parseFloat(m15Candles[i].mid.l)
        let isSwingHigh = true
        let isSwingLow = true

        for (let j = 1; j <= swingLookback; j++) {
            if (high <= parseFloat(m15Candles[i - j].mid.h) || high <= parseFloat(m15Candles[i + j].mid.h)) {
                isSwingHigh = false
            }
            if (low >= parseFloat(m15Candles[i - j].mid.l) || low >= parseFloat(m15Candles[i + j].mid.l)) {
                isSwingLow = false
            }
        }

        if (isSwingHigh) swingHighs.push({ index: i, price: high })
        if (isSwingLow) swingLows.push({ index: i, price: low })
    }

    // ── W-X-Y Detection ──
    // For bullish correction (price dropping): Wave W = swing low, X = swing high, Y = projected low
    // For bearish correction (price rising):  Wave W = swing high, X = swing low, Y = projected high
    let wxyProjection: WXYProjection | null = null

    if (isBullish && swingLows.length >= 1 && swingHighs.length >= 1) {
        // Bullish macro → correction goes DOWN
        // Wave W: first significant swing low (deepest drop in first half)
        const halfIdx = Math.floor(m15Candles.length / 2)
        const firstHalfLows = swingLows.filter(s => s.index < halfIdx)
        const waveWPoint = firstHalfLows.length > 0
            ? firstHalfLows.reduce((min, s) => s.price < min.price ? s : min, firstHalfLows[0])
            : swingLows[0]

        const waveWStart = parseFloat(m15Candles[0].mid.c)
        const waveWEnd = waveWPoint.price
        const wDistance = Math.abs(waveWStart - waveWEnd)

        // X-Wave peak: highest swing high after Wave W
        const postWHighs = swingHighs.filter(s => s.index > waveWPoint.index)
        const xWavePoint = postWHighs.length > 0
            ? postWHighs.reduce((max, s) => s.price > max.price ? s : max, postWHighs[0])
            : null

        if (xWavePoint && wDistance > 0) {
            const yProjection = xWavePoint.price - wDistance
            const yZoneHalf = wDistance * 0.1 // ±10% of W distance

            wxyProjection = {
                waveW: { start: waveWStart, end: waveWEnd, distancePips: Math.round(wDistance * pipMult * 10) / 10 },
                xWave: { peak: xWavePoint.price },
                waveYProjection: yProjection,
                waveYZone: { high: yProjection + yZoneHalf, low: yProjection - yZoneHalf },
            }
        }
    } else if (!isBullish && swingHighs.length >= 1 && swingLows.length >= 1) {
        // Bearish macro → correction goes UP
        const halfIdx = Math.floor(m15Candles.length / 2)
        const firstHalfHighs = swingHighs.filter(s => s.index < halfIdx)
        const waveWPoint = firstHalfHighs.length > 0
            ? firstHalfHighs.reduce((max, s) => s.price > max.price ? s : max, firstHalfHighs[0])
            : swingHighs[0]

        const waveWStart = parseFloat(m15Candles[0].mid.c)
        const waveWEnd = waveWPoint.price
        const wDistance = Math.abs(waveWEnd - waveWStart)

        // X-Wave trough: lowest swing low after Wave W
        const postWLows = swingLows.filter(s => s.index > waveWPoint.index)
        const xWavePoint = postWLows.length > 0
            ? postWLows.reduce((min, s) => s.price < min.price ? s : min, postWLows[0])
            : null

        if (xWavePoint && wDistance > 0) {
            const yProjection = xWavePoint.price + wDistance
            const yZoneHalf = wDistance * 0.1

            wxyProjection = {
                waveW: { start: waveWStart, end: waveWEnd, distancePips: Math.round(wDistance * pipMult * 10) / 10 },
                xWave: { peak: xWavePoint.price },
                waveYProjection: yProjection,
                waveYZone: { high: yProjection + yZoneHalf, low: yProjection - yZoneHalf },
            }
        }
    }

    result.wxyProjection = wxyProjection

    if (!wxyProjection) {
        result.narrative = baseSetup.narrative + ' (Unable to project W-X-Y — insufficient swing structure.)'
        return result
    }

    // ── Build extended Volume Profile over all M15 candles ──
    const extendedProfile = buildVolumeProfile(m15Candles, 50)
    const extendedPOC = extendedProfile.vpoc

    // ── Build Institutional Box ──
    // Intersection of Wave Y zone and extended POC
    const yZone = wxyProjection.waveYZone
    const pocInsideYZone = extendedPOC >= yZone.low && extendedPOC <= yZone.high
    const pocNearYZone = Math.abs(extendedPOC - wxyProjection.waveYProjection) * pipMult <= 30

    if (pocInsideYZone || pocNearYZone) {
        // Center institutional box on the POC/Y-projection midpoint
        const instCenter = (extendedPOC + wxyProjection.waveYProjection) / 2
        const rawWidth = Math.max(10, Math.min(25, (yZone.high - yZone.low) * pipMult))
        const halfW = (rawWidth / pipMult) / 2

        result.institutionalBox = {
            high: instCenter + halfW,
            low: instCenter - halfW,
            center: instCenter,
            widthPips: Math.round(rawWidth * 10) / 10,
        }

        // Boost confidence for W-X-Y alignment
        let extraConfidence = 0
        const extraFactors: string[] = []

        if (pocInsideYZone) {
            extraConfidence += 20
            extraFactors.push('POC inside Wave Y zone')
        } else {
            extraConfidence += 10
            extraFactors.push('POC near Wave Y zone')
        }

        if (marketState.atrSqueeze) {
            extraConfidence += 15
            extraFactors.push('ATR squeeze active (diamond accumulation)')
        }

        // Check for HVN near Y zone
        const hvnNearY = extendedProfile.hvn.filter(h => h >= yZone.low && h <= yZone.high).length
        if (hvnNearY >= 1) {
            extraConfidence += 10
            extraFactors.push(`${hvnNearY} HVN near Wave Y zone`)
        }

        result.confidence = Math.min(100, baseSetup.confidence + extraConfidence)
        result.confluenceFactors = [...baseSetup.confluenceFactors, ...extraFactors]

        // Use institutional box as the primary box if it has higher confluence
        if (result.institutionalBox && extraConfidence > 20) {
            result.box = result.institutionalBox
        }
    }

    const dp = assetConfig.decimalPlaces
    result.narrative = `Institutional Killzone (Tier 2): W-X-Y projection → Y target at ${wxyProjection.waveYProjection.toFixed(dp)}. ` +
        (result.institutionalBox
            ? `Institutional box: ${result.institutionalBox.high.toFixed(dp)} - ${result.institutionalBox.low.toFixed(dp)} (${result.institutionalBox.widthPips} ${assetConfig.pointLabel}). `
            : 'No institutional box — POC too far from Y zone. ') +
        `Confidence: ${result.confidence}%.${marketState.diamondAccumulation ? ' Diamond accumulation pattern active.' : ''}`

    return result
}

// ── Helpers ──

/**
 * Slice M15 candles to the pullback period only.
 * Scans backward from the latest candle to find the impulse peak,
 * then returns all candles from that point to current.
 */
function slicePullbackCandles(
    m15Candles: OandaCandle[],
    impulseEndPrice: number,
    isBullish: boolean,
    maxLookback: number = 80,
): OandaCandle[] {
    const startIdx = Math.max(0, m15Candles.length - maxLookback)
    const searchCandles = m15Candles.slice(startIdx)

    // Find the candle closest to the impulse peak price
    let bestIdx = 0
    let bestDistance = Infinity

    for (let i = 0; i < searchCandles.length; i++) {
        const price = isBullish
            ? parseFloat(searchCandles[i].mid.h)  // Bullish impulse peaks at high
            : parseFloat(searchCandles[i].mid.l)   // Bearish impulse troughs at low
        const distance = Math.abs(price - impulseEndPrice)
        if (distance < bestDistance) {
            bestDistance = distance
            bestIdx = i
        }
    }

    // Return all candles from the peak to current (the pullback)
    return searchCandles.slice(bestIdx)
}
