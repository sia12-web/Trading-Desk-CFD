/**
 * Whale Psychology Simulator — Deterministic Decision Engine
 *
 * Pure rule-based logic. No AI calls. Instant execution.
 * Simulates how an institutional market maker THINKS:
 *
 *   1. Accumulate cheap inventory at/below fair value
 *   2. Manipulate price to trigger retail stops → absorb their sells
 *   3. Distribute inventory into retail FOMO at premium prices
 *   4. Cleanup: close everything before session ends
 *
 * Profit = (avg distribution price - avg accumulation price) × position - manipulation cost
 */

import type {
    WhaleDecision, WhaleBook, MarketSnapshot, SessionPhase,
    RetailTrader,
} from './types'

const PIP_MULTIPLIER = 100 // EUR/JPY

// ═══════════════════════════════════════════════════════════════════════════
// Main Decision Function
// ═══════════════════════════════════════════════════════════════════════════

export function makeWhaleDecision(
    market: MarketSnapshot,
    book: WhaleBook,
    retailers: RetailTrader[],
    phase: SessionPhase
): WhaleDecision {

    // ── CLEANUP: Force sell everything ──
    if (phase === 'cleanup') {
        if (book.positionSize > 0) {
            const sellSize = Math.min(book.positionSize, Math.max(1000, Math.ceil(book.positionSize * 0.4)))
            return {
                action: 'distribute',
                units: sellSize,
                reasoning: `Cleanup phase — ${book.positionSize} units remaining. Forced distribution to close before session end.`,
                confidence: 100,
                retailImpact: 'Whale dumping inventory. Late retail longs absorbing the selling pressure.',
            }
        }
        return {
            action: 'hold',
            units: 0,
            reasoning: 'Position fully closed. Watching the carnage.',
            confidence: 100,
            retailImpact: 'Session winding down. Retail left holding bags from the FOMO buys.',
        }
    }

    // ── ACCUMULATION: Buy at discount ──
    if (phase === 'accumulation') {
        return accumulationLogic(market, book)
    }

    // ── MANIPULATION: Target retail stops ──
    if (phase === 'manipulation') {
        return manipulationLogic(market, book, retailers)
    }

    // ── DISTRIBUTION: Sell into FOMO ──
    if (phase === 'distribution') {
        return distributionLogic(market, book, retailers)
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: 'Unknown phase.',
        confidence: 0,
        retailImpact: 'No impact.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Accumulation Logic
// ═══════════════════════════════════════════════════════════════════════════

function accumulationLogic(market: MarketSnapshot, book: WhaleBook): WhaleDecision {
    const fairValue = market.fairValueProfile.fairValue
    const discountZone = market.fairValueProfile.discountZone

    // If fair value is 0 (no historical data), use session POC
    const targetValue = fairValue > 0 ? fairValue : market.volumePOC

    if (targetValue === 0) {
        // No reference — accumulate small at current price
        return {
            action: 'accumulate',
            units: 1000,
            reasoning: 'No fair value reference available. Small accumulation to start building inventory.',
            confidence: 40,
            retailImpact: 'Quiet buying. Retail does not notice.',
        }
    }

    const priceRelativeToFV = market.currentPrice - targetValue
    const discountPips = -priceRelativeToFV * PIP_MULTIPLIER

    // Deep discount: aggressive accumulation
    if (market.currentPrice < discountZone || discountPips > 10) {
        const size = Math.min(5000, 2000 + Math.floor(discountPips * 200))
        return {
            action: 'accumulate',
            units: size,
            reasoning: `Price ${market.currentPrice.toFixed(3)} is ${discountPips.toFixed(1)} pips below fair value ${targetValue.toFixed(3)}. Deep discount — aggressive accumulation.`,
            confidence: 90,
            retailImpact: 'Whale buying quietly at the floor. Retail thinks the market is "dead" and ignores it.',
        }
    }

    // Moderate discount
    if (market.currentPrice < targetValue) {
        const size = Math.min(3000, 1000 + Math.floor(discountPips * 150))
        return {
            action: 'accumulate',
            units: size,
            reasoning: `Price ${market.currentPrice.toFixed(3)} is ${discountPips.toFixed(1)} pips below fair value. Steady accumulation.`,
            confidence: 75,
            retailImpact: 'Quiet accumulation. Some retail selling into the whale\'s bids — providing cheap inventory.',
        }
    }

    // At or above fair value — hold
    if (book.positionSize < 3000) {
        // Still need more inventory, buy small even at fair
        return {
            action: 'accumulate',
            units: 1000,
            reasoning: `Position only ${book.positionSize} units. Need more inventory. Buying at fair value.`,
            confidence: 55,
            retailImpact: 'Whale absorbing small order flow. Market looks quiet.',
        }
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: `Price at/above fair value ${targetValue.toFixed(3)} and position already ${book.positionSize} units. Waiting for manipulation phase.`,
        confidence: 70,
        retailImpact: 'No impact. Whale is done accumulating, preparing for next phase.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Manipulation Logic
// ═══════════════════════════════════════════════════════════════════════════

function manipulationLogic(
    market: MarketSnapshot,
    book: WhaleBook,
    retailers: RetailTrader[]
): WhaleDecision {
    const stopAnalysis = analyzeRetailStops(retailers, market)
    const { below, above } = stopAnalysis

    // If we don't have enough inventory yet, accumulate more during manipulation
    if (book.positionSize < 2000) {
        if (market.currentPrice <= market.fairValueProfile.fairValue) {
            return {
                action: 'accumulate',
                units: 2000,
                reasoning: `Still building inventory (${book.positionSize} units). Accumulating before running stop hunts.`,
                confidence: 70,
                retailImpact: 'Whale still buying. Retail getting comfortable in their positions.',
            }
        }
    }

    // Target the side with more retail stops
    if (below.count >= above.count && below.count >= 3) {
        // More long stops below — push DOWN to trigger them
        const estimatedCost = 3 + Math.random() * 5 // 3-8 pips
        return {
            action: 'manipulate',
            units: 0,
            manipulationDirection: 'down',
            reasoning: `${below.count} retail longs have stops clustered near ${below.level.toFixed(3)}. Pushing price DOWN to trigger their stops and absorb cheap inventory. Estimated cost: ${estimatedCost.toFixed(1)} pips.`,
            confidence: 85,
            retailImpact: `Stop hunt DOWN targeting ${below.count} retail longs. Their panic selling = whale's cheap inventory.`,
        }
    }

    if (above.count > below.count && above.count >= 3) {
        // More short stops above — push UP to trigger them
        const estimatedCost = 3 + Math.random() * 5
        return {
            action: 'manipulate',
            units: 0,
            manipulationDirection: 'up',
            reasoning: `${above.count} retail shorts have stops near ${above.level.toFixed(3)}. Pushing price UP to trigger their stops. This creates upward momentum for later distribution.`,
            confidence: 80,
            retailImpact: `Stop hunt UP targeting ${above.count} retail shorts. Their forced covering = price spike for distribution.`,
        }
    }

    // No clear stop cluster — push toward retail breakout bias
    if (book.positionSize > 3000) {
        // We have inventory, push up to prep for distribution
        return {
            action: 'manipulate',
            units: 0,
            manipulationDirection: 'up',
            reasoning: 'No clear stop cluster, but we have inventory. Pushing price UP to create FOMO for distribution phase.',
            confidence: 65,
            retailImpact: 'Price rising on thin volume. Retail starting to notice — "is this a breakout?"',
        }
    }

    // Still accumulating
    if (market.currentPrice <= market.volumePOC) {
        return {
            action: 'accumulate',
            units: 1500,
            reasoning: `Price near POC ${market.volumePOC.toFixed(3)}. Continuing accumulation during quiet manipulation phase.`,
            confidence: 60,
            retailImpact: 'Market choppy. Retail frustrated — perfect for whale to accumulate.',
        }
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: 'No clear manipulation target. Waiting for retail to set more stops.',
        confidence: 50,
        retailImpact: 'Chop zone. Retail getting bored — their stops are tightening, which is exactly what the whale wants.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Distribution Logic
// ═══════════════════════════════════════════════════════════════════════════

function distributionLogic(
    market: MarketSnapshot,
    book: WhaleBook,
    retailers: RetailTrader[]
): WhaleDecision {
    if (book.positionSize <= 0) {
        return {
            action: 'hold',
            units: 0,
            reasoning: 'No inventory to distribute. Position already flat.',
            confidence: 100,
            retailImpact: 'Whale is out. Retail left playing musical chairs.',
        }
    }

    const fairValue = market.fairValueProfile.fairValue || market.volumePOC
    const premiumZone = market.fairValueProfile.premiumZone
    const premiumPips = (market.currentPrice - fairValue) * PIP_MULTIPLIER

    // Count retail FOMO longs (exit liquidity)
    const fomoLongs = retailers.filter(t =>
        t.position?.direction === 'long' && t.fomoScore > 50
    ).length

    const allLongs = retailers.filter(t => t.position?.direction === 'long').length

    // Price at premium AND retail longs available — aggressive distribution
    if ((market.currentPrice > premiumZone || premiumPips > 5) && allLongs >= 5) {
        const exitLiquidityRatio = allLongs / 50
        const sellPct = 0.3 + exitLiquidityRatio * 0.4 // 30-70% of position
        const sellSize = Math.min(book.positionSize, Math.floor(book.positionSize * sellPct))

        return {
            action: 'distribute',
            units: Math.max(sellSize, 500),
            reasoning: `Price ${premiumPips.toFixed(1)} pips above fair value. ${allLongs} retail longs provide exit liquidity (${fomoLongs} are FOMO buyers). Selling ${sellPct.toFixed(0)}% of position.`,
            confidence: 90,
            retailImpact: `Whale selling into ${allLongs} retail buy orders. Every FOMO long is absorbing whale inventory at premium prices.`,
        }
    }

    // FOMO is building even if not yet at premium — start distributing
    if (fomoLongs >= 10) {
        const sellSize = Math.min(book.positionSize, Math.floor(book.positionSize * 0.25))
        return {
            action: 'distribute',
            units: Math.max(sellSize, 500),
            reasoning: `${fomoLongs} FOMO longs detected — retail greed is peaking. Starting distribution even though not at full premium.`,
            confidence: 75,
            retailImpact: `Retail FOMO at fever pitch. ${fomoLongs} traders buying into the rally — they ARE the exit liquidity.`,
        }
    }

    // Not enough exit liquidity yet — try pushing up more
    if (allLongs < 5) {
        return {
            action: 'manipulate',
            units: 0,
            manipulationDirection: 'up',
            reasoning: `Only ${allLongs} retail longs — not enough exit liquidity. Pushing price UP to create more FOMO buyers.`,
            confidence: 65,
            retailImpact: 'Whale engineering a "breakout" to lure more retail buyers before the dump.',
        }
    }

    // Moderate distribution
    const sellSize = Math.min(book.positionSize, 2000)
    return {
        action: 'distribute',
        units: sellSize,
        reasoning: `Distributing ${sellSize} units into ${allLongs} retail long positions. Avg entry: ${book.averageEntry.toFixed(3)}, current: ${market.currentPrice.toFixed(3)}.`,
        confidence: 70,
        retailImpact: 'Steady selling. Retail doesn\'t realize the rally is being sold into.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Stop Analysis Helper
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeRetailStops(
    retailers: RetailTrader[],
    market: MarketSnapshot
): {
    below: { level: number; count: number }
    above: { level: number; count: number }
} {
    const longStops: number[] = []
    const shortStops: number[] = []

    for (const trader of retailers) {
        if (!trader.position) continue

        if (trader.position.direction === 'long') {
            longStops.push(trader.position.stopLoss)
        } else {
            shortStops.push(trader.position.stopLoss)
        }
    }

    // Average long stop level (below current price)
    const belowLevel = longStops.length > 0
        ? longStops.reduce((a, b) => a + b, 0) / longStops.length
        : market.donchianLow

    // Average short stop level (above current price)
    const aboveLevel = shortStops.length > 0
        ? shortStops.reduce((a, b) => a + b, 0) / shortStops.length
        : market.donchianHigh

    return {
        below: { level: belowLevel, count: longStops.length },
        above: { level: aboveLevel, count: shortStops.length },
    }
}
