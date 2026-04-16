/**
 * Whale Simulator — Institutional Bias Detector (Operator's 3-Step Protocol)
 *
 * Determines if NY institutions will hunt Longs or Shorts for the day.
 *
 * Step 1: H1 Donchian Proximity (Macro Map)
 * Step 2: London Handoff (Overnight Inventory)
 * Step 3: Daily CVD X-Ray (24-hour institutional flow)
 *
 * Final Bias:
 *  - LONG: Every M1 drop is a trap to buy
 *  - SHORT: Every M1 rally is a trap to sell
 *  - NEUTRAL: No clear bias, whale will opportunistically trade both sides
 */

import { calculateDonchianChannel, calculateCVD } from '@/lib/utils/donchian-cvd'
import type { OandaCandle } from '@/lib/types/oanda'

export type BiasDirection = 'LONG' | 'SHORT' | 'NEUTRAL'

export interface InstitutionalBias {
    // Step 1: H1 Macro Map
    h1Proximity: {
        donchianHigh: number
        donchianLow: number
        donchianMiddle: number
        currentPrice: number
        distanceToFloor: number  // pips
        distanceToCeiling: number  // pips
        bias: BiasDirection
        confidence: number  // 0-100
        reasoning: string
    }

    // Step 2: London Handoff
    londonHandoff: {
        londonOpen: number
        londonClose: number
        londonHigh: number
        londonLow: number
        londonRange: number  // pips
        londonDirection: 'bullish' | 'bearish' | 'ranging'
        londonTrend: 'strong' | 'moderate' | 'weak'
        bias: BiasDirection
        confidence: number
        reasoning: string
    }

    // Step 3: Daily CVD X-Ray
    cvdDivergence: {
        priceChange: number  // pips (overnight to NY open)
        cvdChange: number
        divergence: 'bearish' | 'bullish' | 'none'  // Price up + CVD flat/down = bearish divergence
        bias: BiasDirection
        confidence: number
        reasoning: string
    }

    // Final Verdict
    finalBias: BiasDirection
    finalConfidence: number
    consensusScore: number  // How many steps agree (0-3)
    summary: string
}

const PIP_MULTIPLIER = 100  // EUR/JPY

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export function detectInstitutionalBias(
    h1Candles: OandaCandle[],
    londonCandles: OandaCandle[],
    fullDayCandles: OandaCandle[],  // 24h window for CVD
    nyOpenPrice: number
): InstitutionalBias {
    const h1Prox = analyzeH1Proximity(h1Candles, nyOpenPrice)
    const londonHand = analyzeLondonHandoff(londonCandles, nyOpenPrice)
    const cvdDiv = analyzeCVDDivergence(fullDayCandles, nyOpenPrice)

    // Final bias: majority vote, weighted by confidence
    const biasVotes = [h1Prox.bias, londonHand.bias, cvdDiv.bias]
    const longVotes = biasVotes.filter(b => b === 'LONG').length
    const shortVotes = biasVotes.filter(b => b === 'SHORT').length
    const neutralVotes = biasVotes.filter(b => b === 'NEUTRAL').length

    let finalBias: BiasDirection
    let consensusScore = 0

    if (longVotes >= 2) {
        finalBias = 'LONG'
        consensusScore = longVotes
    } else if (shortVotes >= 2) {
        finalBias = 'SHORT'
        consensusScore = shortVotes
    } else if (neutralVotes === 3) {
        finalBias = 'NEUTRAL'
        consensusScore = 3
    } else {
        // Mixed signals — tie-break with highest confidence
        const confidences = [
            { bias: h1Prox.bias, conf: h1Prox.confidence },
            { bias: londonHand.bias, conf: londonHand.confidence },
            { bias: cvdDiv.bias, conf: cvdDiv.confidence },
        ]
        const winner = confidences.sort((a, b) => b.conf - a.conf)[0]
        finalBias = winner.bias
        consensusScore = 1
    }

    const finalConfidence = Math.round(
        (h1Prox.confidence + londonHand.confidence + cvdDiv.confidence) / 3
    )

    const summary = buildSummary(finalBias, consensusScore, h1Prox, londonHand, cvdDiv)

    return {
        h1Proximity: h1Prox,
        londonHandoff: londonHand,
        cvdDivergence: cvdDiv,
        finalBias,
        finalConfidence,
        consensusScore,
        summary,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 1: H1 Donchian Proximity
// ═══════════════════════════════════════════════════════════════════════════

function analyzeH1Proximity(h1Candles: OandaCandle[], nyOpenPrice: number) {
    if (h1Candles.length < 50) {
        return {
            donchianHigh: 0,
            donchianLow: 0,
            donchianMiddle: 0,
            currentPrice: nyOpenPrice,
            distanceToFloor: 0,
            distanceToCeiling: 0,
            bias: 'NEUTRAL' as BiasDirection,
            confidence: 0,
            reasoning: 'Insufficient H1 data for Donchian analysis',
        }
    }

    const highs = h1Candles.map(c => parseFloat(c.mid.h))
    const lows = h1Candles.map(c => parseFloat(c.mid.l))
    const donchian = calculateDonchianChannel(highs, lows, 50, PIP_MULTIPLIER)

    const lastIdx = donchian.high.length - 1
    const donchianHigh = donchian.high[lastIdx]
    const donchianLow = donchian.low[lastIdx]
    const donchianMiddle = donchian.middle[lastIdx]

    const distanceToFloor = (nyOpenPrice - donchianLow) * PIP_MULTIPLIER
    const distanceToCeiling = (donchianHigh - nyOpenPrice) * PIP_MULTIPLIER

    // Proximity threshold: within 20% of range from floor/ceiling
    const range = (donchianHigh - donchianLow) * PIP_MULTIPLIER
    const proximityThreshold = range * 0.2

    let bias: BiasDirection = 'NEUTRAL'
    let confidence = 0
    let reasoning = ''

    if (distanceToFloor < proximityThreshold) {
        bias = 'LONG'
        confidence = Math.round(100 * (1 - distanceToFloor / proximityThreshold))
        reasoning = `Price at H1 Floor (${distanceToFloor.toFixed(1)} pips from bottom). Institutions hunting longs. Every M1 drop is a trap to buy.`
    } else if (distanceToCeiling < proximityThreshold) {
        bias = 'SHORT'
        confidence = Math.round(100 * (1 - distanceToCeiling / proximityThreshold))
        reasoning = `Price at H1 Ceiling (${distanceToCeiling.toFixed(1)} pips from top). Institutions hunting shorts. Every M1 rally is a trap to sell.`
    } else {
        bias = 'NEUTRAL'
        confidence = 50
        reasoning = `Price in H1 mid-range (${distanceToFloor.toFixed(1)}p from floor, ${distanceToCeiling.toFixed(1)}p from ceiling). No clear H1 bias.`
    }

    return {
        donchianHigh,
        donchianLow,
        donchianMiddle,
        currentPrice: nyOpenPrice,
        distanceToFloor,
        distanceToCeiling,
        bias,
        confidence,
        reasoning,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 2: London Handoff
// ═══════════════════════════════════════════════════════════════════════════

function analyzeLondonHandoff(londonCandles: OandaCandle[], nyOpenPrice: number) {
    if (londonCandles.length < 60) {
        return {
            londonOpen: nyOpenPrice,
            londonClose: nyOpenPrice,
            londonHigh: nyOpenPrice,
            londonLow: nyOpenPrice,
            londonRange: 0,
            londonDirection: 'ranging' as const,
            londonTrend: 'weak' as const,
            bias: 'NEUTRAL' as BiasDirection,
            confidence: 0,
            reasoning: 'Insufficient London session data',
        }
    }

    const londonOpen = parseFloat(londonCandles[0].mid.o)
    const londonClose = parseFloat(londonCandles[londonCandles.length - 1].mid.c)
    const londonHigh = Math.max(...londonCandles.map(c => parseFloat(c.mid.h)))
    const londonLow = Math.min(...londonCandles.map(c => parseFloat(c.mid.l)))
    const londonRange = (londonHigh - londonLow) * PIP_MULTIPLIER

    const londonMove = (londonClose - londonOpen) * PIP_MULTIPLIER
    const londonDirection: 'bullish' | 'bearish' | 'ranging' =
        londonMove > 10 ? 'bullish' :
        londonMove < -10 ? 'bearish' :
        'ranging'

    // Trend strength: strong if move > 30 pips, moderate if 15-30, weak if < 15
    const londonTrend: 'strong' | 'moderate' | 'weak' =
        Math.abs(londonMove) > 30 ? 'strong' :
        Math.abs(londonMove) > 15 ? 'moderate' :
        'weak'

    // The Operator's Creed: "Asia Accumulates, London Manipulates, New York Distributes."
    // If London faked a massive move down → NY reverses LONG
    // If London faked a massive move up → NY reverses SHORT

    let bias: BiasDirection = 'NEUTRAL'
    let confidence = 0
    let reasoning = ''

    if (londonDirection === 'bearish' && londonTrend === 'strong') {
        bias = 'LONG'
        confidence = 85
        reasoning = `London drove price DOWN ${Math.abs(londonMove).toFixed(1)} pips (strong bearish trend). NY will reverse LONG. The morning panic = institutional trap.`
    } else if (londonDirection === 'bearish' && londonTrend === 'moderate') {
        bias = 'LONG'
        confidence = 65
        reasoning = `London drifted DOWN ${Math.abs(londonMove).toFixed(1)} pips (moderate bearish). NY likely reverses LONG, but less conviction.`
    } else if (londonDirection === 'bullish' && londonTrend === 'strong') {
        bias = 'SHORT'
        confidence = 85
        reasoning = `London drove price UP ${londonMove.toFixed(1)} pips (strong bullish trend). NY will reverse SHORT. The morning rally = institutional trap.`
    } else if (londonDirection === 'bullish' && londonTrend === 'moderate') {
        bias = 'SHORT'
        confidence = 65
        reasoning = `London drifted UP ${londonMove.toFixed(1)} pips (moderate bullish). NY likely reverses SHORT, but less conviction.`
    } else {
        bias = 'NEUTRAL'
        confidence = 40
        reasoning = `London ranged ${londonRange.toFixed(1)} pips with no clear direction. No handoff bias.`
    }

    return {
        londonOpen,
        londonClose,
        londonHigh,
        londonLow,
        londonRange,
        londonDirection,
        londonTrend,
        bias,
        confidence,
        reasoning,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Step 3: Daily CVD X-Ray
// ═══════════════════════════════════════════════════════════════════════════

function analyzeCVDDivergence(fullDayCandles: OandaCandle[], nyOpenPrice: number) {
    if (fullDayCandles.length < 50) {
        return {
            priceChange: 0,
            cvdChange: 0,
            divergence: 'none' as const,
            bias: 'NEUTRAL' as BiasDirection,
            confidence: 0,
            reasoning: 'Insufficient 24-hour data for CVD analysis',
        }
    }

    const cvdResult = calculateCVD(fullDayCandles, 50)
    const overnightOpen = parseFloat(fullDayCandles[0].mid.o)
    const priceChange = (nyOpenPrice - overnightOpen) * PIP_MULTIPLIER

    const cvdStart = cvdResult.cvd[0]
    const cvdEnd = cvdResult.cvd[cvdResult.cvd.length - 1]
    const cvdChange = cvdEnd - cvdStart

    // Divergence detection
    let divergence: 'bearish' | 'bullish' | 'none' = 'none'
    let bias: BiasDirection = 'NEUTRAL'
    let confidence = 0
    let reasoning = ''

    // Bearish Divergence: Price grinding higher BUT CVD flat or falling
    if (priceChange > 15 && cvdChange < 5) {
        divergence = 'bearish'
        bias = 'SHORT'
        confidence = Math.min(85, Math.round(priceChange * 2))
        reasoning = `Bearish divergence: Price up ${priceChange.toFixed(1)} pips overnight, but CVD ${cvdChange >= 0 ? 'flat' : 'falling'}. Institutions distributing into retail buying. NY bias = SHORT.`
    }
    // Bullish Divergence: Price grinding lower BUT CVD flat or rising
    else if (priceChange < -15 && cvdChange > -5) {
        divergence = 'bullish'
        bias = 'LONG'
        confidence = Math.min(85, Math.round(Math.abs(priceChange) * 2))
        reasoning = `Bullish divergence: Price down ${Math.abs(priceChange).toFixed(1)} pips overnight, but CVD ${cvdChange <= 0 ? 'flat' : 'rising'}. Institutions accumulating retail selling. NY bias = LONG.`
    }
    // No divergence
    else {
        divergence = 'none'
        bias = 'NEUTRAL'
        confidence = 50
        reasoning = `No CVD divergence detected. Price ${priceChange >= 0 ? 'up' : 'down'} ${Math.abs(priceChange).toFixed(1)} pips, CVD ${cvdChange >= 0 ? 'up' : 'down'} ${Math.abs(cvdChange).toFixed(1)}. Aligned flow.`
    }

    return {
        priceChange,
        cvdChange,
        divergence,
        bias,
        confidence,
        reasoning,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSummary(
    finalBias: BiasDirection,
    consensusScore: number,
    h1Prox: any,
    londonHand: any,
    cvdDiv: any
): string {
    const agreementLevel =
        consensusScore === 3 ? 'UNANIMOUS' :
        consensusScore === 2 ? 'STRONG CONSENSUS' :
        'SPLIT SIGNALS'

    const biasEmoji = finalBias === 'LONG' ? '📈' : finalBias === 'SHORT' ? '📉' : '⚖️'

    return `${biasEmoji} ${agreementLevel} — Final Bias: ${finalBias}

H1 Proximity: ${h1Prox.bias} (${h1Prox.confidence}%) — ${h1Prox.reasoning}

London Handoff: ${londonHand.bias} (${londonHand.confidence}%) — ${londonHand.reasoning}

CVD Divergence: ${cvdDiv.bias} (${cvdDiv.confidence}%) — ${cvdDiv.reasoning}

Operator's Verdict: ${finalBias === 'LONG' ? 'Institutions hunting LONGS. Every M1 drop is a trap to BUY. Accumulate at the floor, sell into rallies.' : finalBias === 'SHORT' ? 'Institutions hunting SHORTS. Every M1 rally is a trap to SELL. Distribute at the ceiling, buy panic dips.' : 'No clear institutional bias. Whale will trade opportunistically both directions.'}`
}
