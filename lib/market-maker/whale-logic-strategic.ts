/**
 * Whale Psychology Simulator — Strategic Decision Engine
 *
 * Goal-oriented whale that executes a campaign to achieve its objective:
 * - ACCUMULATE_LONG: Buy cheap → manipulate → sell expensive
 * - DISTRIBUTE_SHORT: Sell expensive → manipulate → buy cheap
 * - OPPORTUNISTIC: Trade both directions around fair value
 *
 * The whale KNOWS what it wants and finds ways to get it using:
 * - Inventory management
 * - Stop hunts (manipulation)
 * - Retail psychology exploitation (FOMO, fear)
 */

import { analyzeManipulationOpportunity, estimateManipulationCost as calcManipCost } from './manipulation-tactics'
import type {
    WhaleDecision, WhaleBook, MarketSnapshot, WhaleStrategy,
    RetailTrader, CampaignGoal, CampaignPhase,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Main Strategic Decision Function
// ═══════════════════════════════════════════════════════════════════════════

export function makeStrategicDecision(
    market: MarketSnapshot,
    book: WhaleBook,
    strategy: WhaleStrategy,
    retailers: RetailTrader[],
    minutesElapsed: number,
    pipMultiplier: number
): WhaleDecision {
    const progress = strategy.progress

    // Emergency cleanup if near session end
    if (minutesElapsed > 165) {  // 2h 45m elapsed, 15 min left
        return forceCleanup(book, market, strategy)
    }

    // Execute campaign based on goal
    switch (strategy.goal) {
        case 'accumulate_long':
            return executeLongCampaign(market, book, strategy, retailers, pipMultiplier)
        case 'distribute_short':
            return executeShortCampaign(market, book, strategy, retailers, pipMultiplier)
        case 'opportunistic':
            return executeOpportunisticCampaign(market, book, strategy, retailers, pipMultiplier)
        default:
            return { action: 'hold', units: 0, reasoning: 'Unknown campaign goal', confidence: 0, retailImpact: 'None' }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LONG Campaign (Accumulate cheap → Distribute expensive)
// ═══════════════════════════════════════════════════════════════════════════

function executeLongCampaign(
    market: MarketSnapshot,
    book: WhaleBook,
    strategy: WhaleStrategy,
    retailers: RetailTrader[],
    pipMultiplier: number
): WhaleDecision {
    const { currentPhase, progress, targetSize, entryZone, exitZone } = strategy
    const currentPrice = market.currentPrice
    const inEntryZone = currentPrice >= entryZone.min && currentPrice <= entryZone.max
    const inExitZone = currentPrice >= exitZone.min && currentPrice <= exitZone.max

    // PHASE 1: BUILDING (accumulate toward target)
    if (currentPhase === 'building') {
        // If in entry zone → accumulate
        if (inEntryZone) {
            const needed = targetSize - progress.accumulated
            const buySize = Math.min(needed, 3000)  // Max 3000 per step
            return {
                action: 'accumulate',
                units: buySize,
                reasoning: `BUILDING phase: Accumulating ${buySize} units in entry zone (${currentPrice.toFixed(3)} in ${entryZone.min.toFixed(3)}-${entryZone.max.toFixed(3)}). Progress: ${progress.accumulated}/${targetSize} units.`,
                confidence: 85,
                retailImpact: 'Whale quietly buying at the floor. Retail sees a "dead market" and ignores it.',
            }
        }

        // If above entry zone → manipulate down to improve entry
        if (currentPrice > entryZone.max) {
            const manipAnalysis = analyzeManipulationOpportunity(
                market, book, 'building', retailers, pipMultiplier, 'improve_entry'
            )

            if (manipAnalysis.shouldManipulate && manipAnalysis.direction === 'down') {
                return {
                    action: 'manipulate',
                    units: 0,
                    manipulationDirection: 'down',
                    reasoning: `Price above entry zone (${currentPrice.toFixed(3)} > ${entryZone.max.toFixed(3)}). ${manipAnalysis.reasoning}`,
                    confidence: 80,
                    retailImpact: `${manipAnalysis.expectedGain} Pushing price into buy zone.`,
                }
            }

            return {
                action: 'hold',
                units: 0,
                reasoning: `Price above entry zone. Waiting for pullback to ${entryZone.max.toFixed(3)} or retail stop clusters to form.`,
                confidence: 60,
                retailImpact: 'Whale watching. Retail building positions that will be targeted later.',
            }
        }

        // If below entry zone (deep discount) → accumulate aggressively
        const buySize = Math.min(targetSize - progress.accumulated, 5000)
        return {
            action: 'accumulate',
            units: buySize,
            reasoning: `Price at deep discount (${currentPrice.toFixed(3)} < ${entryZone.min.toFixed(3)}). Aggressive accumulation.`,
            confidence: 95,
            retailImpact: 'Whale absorbing all selling pressure. This is the floor.',
        }
    }

    // PHASE 2: MANIPULATING (improve avg entry via stop hunts)
    if (currentPhase === 'manipulating') {
        // Use sophisticated inventory-based manipulation tactics
        const manipAnalysis = analyzeManipulationOpportunity(
            market, book, 'manipulating', retailers, pipMultiplier, 'protect_profit'
        )

        // Execute manipulation if opportunity exists
        if (manipAnalysis.shouldManipulate && manipAnalysis.direction && manipAnalysis.targetCluster) {
            return {
                action: 'manipulate',
                units: 0,
                manipulationDirection: manipAnalysis.direction,
                reasoning: `${manipAnalysis.reasoning} Inventory: ${book.positionSize} units. ${manipAnalysis.intensity.toUpperCase()} manipulation.`,
                confidence: 90,
                retailImpact: `${manipAnalysis.expectedGain} Whale using ${book.positionSize} units as ammunition.`,
            }
        }

        // After manipulation, accumulate more at better prices
        if (currentPrice < book.averageEntry && inEntryZone && progress.accumulated < targetSize) {
            const buySize = Math.min(2000, targetSize - progress.accumulated)
            return {
                action: 'accumulate',
                units: buySize,
                reasoning: `Post-manipulation accumulation at ${currentPrice.toFixed(3)} (below avg entry ${book.averageEntry.toFixed(3)}). Improving average entry.`,
                confidence: 85,
                retailImpact: 'Whale buying from retail stop-outs at improved prices.',
            }
        }

        // Transition to distribution if price enters exit zone
        if (inExitZone) {
            const fomoCount = retailers.filter(t => t.position?.direction === 'long' && t.fomoScore > 60).length
            if (fomoCount >= 8) {
                const sellSize = Math.min(book.positionSize, 3000)
                return {
                    action: 'distribute',
                    units: sellSize,
                    reasoning: `Price entered exit zone (${currentPrice.toFixed(3)} in ${exitZone.min.toFixed(3)}-${exitZone.max.toFixed(3)}). ${fomoCount} retail FOMO longs detected. Starting distribution.`,
                    confidence: 90,
                    retailImpact: `Whale selling into ${fomoCount} FOMO buyers. They think it's a breakout — it's the whale's exit.`,
                }
            }
        }

        // Default: hold and wait for distribution opportunity
        return {
            action: 'hold',
            units: 0,
            reasoning: `Manipulation complete. Position: ${book.positionSize} units @ ${book.averageEntry.toFixed(3)}. Waiting for price to reach exit zone.`,
            confidence: 70,
            retailImpact: 'Whale watching. Inventory loaded, ready to distribute.',
        }
    }

    // PHASE 3: DISTRIBUTING (sell into retail FOMO at premium)
    if (currentPhase === 'distributing') {
        // Check if we should manipulate to trigger panic exits
        const manipAnalysis = analyzeManipulationOpportunity(
            market, book, 'distributing', retailers, pipMultiplier, 'trigger_exits'
        )

        if (manipAnalysis.shouldManipulate && book.positionSize > targetSize * 0.5) {
            return {
                action: 'manipulate',
                units: 0,
                manipulationDirection: manipAnalysis.direction!,
                reasoning: `DISTRIBUTION phase with ${book.positionSize} units to unload. ${manipAnalysis.reasoning}`,
                confidence: 85,
                retailImpact: `${manipAnalysis.expectedGain} Accelerating distribution.`,
            }
        }

        if (inExitZone && book.positionSize > 0) {
            const fomoLongs = retailers.filter(t => t.position?.direction === 'long').length
            const exitLiquidityRatio = fomoLongs / 50
            const sellPct = 0.3 + exitLiquidityRatio * 0.4  // 30-70% based on retail longs
            const sellSize = Math.min(book.positionSize, Math.floor(book.positionSize * sellPct))

            return {
                action: 'distribute',
                units: Math.max(sellSize, 500),
                reasoning: `DISTRIBUTION phase: Selling ${sellSize} units at premium (${currentPrice.toFixed(3)} in ${exitZone.min.toFixed(3)}-${exitZone.max.toFixed(3)}). ${fomoLongs} retail longs provide exit liquidity.`,
                confidence: 95,
                retailImpact: `Whale dumping ${sellSize} units into ${fomoLongs} retail buy orders. Every FOMO long is absorbing whale inventory at premium prices.`,
            }
        }

        // If price drops below exit zone, manipulate up to create more FOMO
        if (currentPrice < exitZone.min && book.positionSize > 0) {
            return {
                action: 'manipulate',
                units: 0,
                manipulationDirection: 'up',
                reasoning: `Price dropped below exit zone. Manipulating UP to push back into distribution zone and create retail FOMO.`,
                confidence: 80,
                retailImpact: 'Whale creating fake breakout rally to lure more retail buyers before final distribution.',
            }
        }

        // If position mostly distributed, hold
        if (book.positionSize < targetSize * 0.2) {
            return {
                action: 'hold',
                units: 0,
                reasoning: `Distribution nearly complete. Position: ${book.positionSize} units remaining. Campaign success.`,
                confidence: 100,
                retailImpact: 'Whale has successfully distributed inventory. Retail holding bags at premium prices.',
            }
        }
    }

    // PHASE 4: COMPLETED
    if (currentPhase === 'completed') {
        return {
            action: 'hold',
            units: 0,
            reasoning: `Campaign completed. Total accumulated: ${progress.accumulated}, distributed: ${progress.distributed}. Net PnL: ${book.realizedPnl.toFixed(1)} pips.`,
            confidence: 100,
            retailImpact: 'Campaign complete. Whale is out. Retail traders left with the aftermath.',
        }
    }

    // Default hold
    return {
        action: 'hold',
        units: 0,
        reasoning: 'No clear action in current market conditions.',
        confidence: 50,
        retailImpact: 'Neutral.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHORT Campaign (Distribute expensive → Buy back cheap)
// ═══════════════════════════════════════════════════════════════════════════

function executeShortCampaign(
    market: MarketSnapshot,
    book: WhaleBook,
    strategy: WhaleStrategy,
    retailers: RetailTrader[],
    pipMultiplier: number
): WhaleDecision {
    const { currentPhase, progress, targetSize, entryZone, exitZone } = strategy
    const currentPrice = market.currentPrice
    const inEntryZone = currentPrice >= entryZone.min && currentPrice <= entryZone.max
    const inExitZone = currentPrice >= exitZone.min && currentPrice <= exitZone.max

    // SHORT campaign logic (mirror of LONG, but inverted)
    // Entry zone = premium (sell high), Exit zone = discount (buy low)

    if (currentPhase === 'building') {
        // Sell at premium
        if (inEntryZone) {
            const needed = targetSize - progress.distributed
            const sellSize = Math.min(needed, 3000)
            return {
                action: 'distribute',
                units: sellSize,
                reasoning: `SHORT BUILDING: Distributing ${sellSize} units at premium (${currentPrice.toFixed(3)} in ${entryZone.min.toFixed(3)}-${entryZone.max.toFixed(3)}). Progress: ${progress.distributed}/${targetSize} units short.`,
                confidence: 85,
                retailImpact: 'Whale selling at the ceiling. Retail thinks it\'s a breakout — they\'re providing the whale\'s exit liquidity.',
            }
        }

        if (currentPrice < entryZone.min) {
            const manipAnalysis = analyzeManipulationOpportunity(
                market, book, 'building', retailers, pipMultiplier, 'improve_entry'
            )

            if (manipAnalysis.shouldManipulate && manipAnalysis.direction === 'up') {
                return {
                    action: 'manipulate',
                    units: 0,
                    manipulationDirection: 'up',
                    reasoning: `Price below premium zone. ${manipAnalysis.reasoning}`,
                    confidence: 80,
                    retailImpact: `${manipAnalysis.expectedGain} Pushing price into short entry zone.`,
                }
            }
        }

        return {
            action: 'hold',
            units: 0,
            reasoning: 'Waiting for price to reach premium zone for short distribution.',
            confidence: 60,
            retailImpact: 'Whale waiting for the rally.',
        }
    }

    if (currentPhase === 'distributing') {
        // Covering shorts at discount
        if (inExitZone && Math.abs(book.positionSize) > 0) {
            const panicSellers = retailers.filter(t => t.position?.direction === 'short' || t.status === 'stopped_out').length
            const coverSize = Math.min(Math.abs(book.positionSize), 3000)

            return {
                action: 'accumulate',
                units: coverSize,
                reasoning: `Covering ${coverSize} units of short position at discount (${currentPrice.toFixed(3)} in ${exitZone.min.toFixed(3)}-${exitZone.max.toFixed(3)}). ${panicSellers} retail panic/stops detected.`,
                confidence: 95,
                retailImpact: `Whale buying back shorts from retail panic at cheap prices. Short campaign success.`,
            }
        }
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: 'Short campaign in progress.',
        confidence: 50,
        retailImpact: 'Neutral.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNISTIC Campaign (Trade both directions)
// ═══════════════════════════════════════════════════════════════════════════

function executeOpportunisticCampaign(
    market: MarketSnapshot,
    book: WhaleBook,
    strategy: WhaleStrategy,
    retailers: RetailTrader[],
    pipMultiplier: number
): WhaleDecision {
    const { entryZone, exitZone } = strategy
    const currentPrice = market.currentPrice

    // Simple logic: buy at discount, sell at premium, repeat
    if (currentPrice <= entryZone.max && book.positionSize < 3000) {
        return {
            action: 'accumulate',
            units: 1500,
            reasoning: `OPPORTUNISTIC: Price at discount (${currentPrice.toFixed(3)}). Buying for mean reversion trade.`,
            confidence: 70,
            retailImpact: 'Whale buying at the floor.',
        }
    }

    if (currentPrice >= exitZone.min && book.positionSize > 0) {
        const sellSize = Math.min(book.positionSize, 2000)
        return {
            action: 'distribute',
            units: sellSize,
            reasoning: `OPPORTUNISTIC: Price at premium (${currentPrice.toFixed(3)}). Selling ${sellSize} units for profit.`,
            confidence: 75,
            retailImpact: 'Whale taking profits at premium.',
        }
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: 'Price mid-range. Waiting for discount or premium zone.',
        confidence: 60,
        retailImpact: 'Neutral.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Force Cleanup (near session end)
// ═══════════════════════════════════════════════════════════════════════════

function forceCleanup(book: WhaleBook, market: MarketSnapshot, strategy: WhaleStrategy): WhaleDecision {
    if (book.positionSize > 0) {
        const sellSize = Math.min(book.positionSize, Math.ceil(book.positionSize * 0.5))
        return {
            action: 'distribute',
            units: sellSize,
            reasoning: `Session ending — forced distribution of ${sellSize} units. Must close position before market close.`,
            confidence: 100,
            retailImpact: 'Whale dumping inventory. Late retail longs absorbing selling pressure.',
        }
    }

    if (book.positionSize < 0) {
        const coverSize = Math.min(Math.abs(book.positionSize), Math.ceil(Math.abs(book.positionSize) * 0.5))
        return {
            action: 'accumulate',
            units: coverSize,
            reasoning: `Session ending — forced cover of ${coverSize} units short. Must close position.`,
            confidence: 100,
            retailImpact: 'Whale covering shorts at any price.',
        }
    }

    return {
        action: 'hold',
        units: 0,
        reasoning: 'Position flat. Campaign complete.',
        confidence: 100,
        retailImpact: 'Session ending. Whale is out.',
    }
}

// Old analyzeRetailStops() removed — replaced by sophisticated analyzeStopClusters() in manipulation-tactics.ts
