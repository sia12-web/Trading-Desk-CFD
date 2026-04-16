/**
 * Whale Manipulation Tactics — Inventory-Based Strategic Manipulation
 *
 * The whale uses its inventory as ammunition for manipulation:
 * - Larger inventory = more aggressive manipulation capability
 * - Stop loss cluster analysis to identify high-value targets
 * - Phase-specific tactics (improving entry vs protecting profits)
 * - Dynamic sizing based on retail positioning
 */

import type { RetailTrader, MarketSnapshot, WhaleBook, CampaignPhase } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Stop Loss Analysis (Find the juiciest targets)
// ═══════════════════════════════════════════════════════════════════════════

export interface StopCluster {
    level: number           // Price level
    count: number           // Number of stops at this level
    direction: 'long' | 'short'  // Which direction gets stopped
    pipsAway: number        // Distance from current price
    expectedLiquidation: number  // Total units that would be force-closed
}

export interface StopAnalysis {
    clusters: StopCluster[]
    bestTargetUp: StopCluster | null    // Best stop hunt target above current price
    bestTargetDown: StopCluster | null  // Best stop hunt target below current price
    totalLongsExposed: number           // Total long positions vulnerable
    totalShortsExposed: number          // Total short positions vulnerable
}

export function analyzeStopClusters(
    retailers: RetailTrader[],
    market: MarketSnapshot,
    pipMultiplier: number
): StopAnalysis {
    const currentPrice = market.currentPrice
    const stopMap = new Map<string, { count: number; direction: 'long' | 'short'; totalUnits: number }>()

    // Build stop loss map
    for (const trader of retailers) {
        if (!trader.position) continue

        const sl = trader.position.stopLoss
        const key = sl.toFixed(3)  // Group by 0.001 precision
        const existing = stopMap.get(key) || { count: 0, direction: trader.position.direction, totalUnits: 0 }
        existing.count++
        existing.totalUnits += trader.position.units
        stopMap.set(key, existing)
    }

    // Convert to clusters
    const clusters: StopCluster[] = Array.from(stopMap.entries()).map(([levelStr, data]) => {
        const level = parseFloat(levelStr)
        return {
            level,
            count: data.count,
            direction: data.direction,
            pipsAway: Math.abs(level - currentPrice) * pipMultiplier,
            expectedLiquidation: data.totalUnits,
        }
    })

    // Sort by count (density)
    clusters.sort((a, b) => b.count - a.count)

    // Find best targets
    const aboveClusters = clusters.filter(c => c.level > currentPrice && c.direction === 'long')
    const belowClusters = clusters.filter(c => c.level < currentPrice && c.direction === 'short')

    const bestTargetUp = aboveClusters.length > 0 ? aboveClusters[0] : null
    const bestTargetDown = belowClusters.length > 0 ? belowClusters[0] : null

    const totalLongsExposed = clusters.filter(c => c.direction === 'long').reduce((sum, c) => sum + c.count, 0)
    const totalShortsExposed = clusters.filter(c => c.direction === 'short').reduce((sum, c) => sum + c.count, 0)

    return {
        clusters,
        bestTargetUp,
        bestTargetDown,
        totalLongsExposed,
        totalShortsExposed,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Manipulation Decision Engine
// ═══════════════════════════════════════════════════════════════════════════

export interface ManipulationDecision {
    shouldManipulate: boolean
    direction: 'up' | 'down' | null
    intensity: 'light' | 'medium' | 'heavy'
    targetCluster: StopCluster | null
    reasoning: string
    expectedGain: string  // What the whale gains from this manipulation
}

export function analyzeManipulationOpportunity(
    market: MarketSnapshot,
    book: WhaleBook,
    phase: CampaignPhase,
    retailers: RetailTrader[],
    pipMultiplier: number,
    goal: 'improve_entry' | 'protect_profit' | 'trigger_exits'
): ManipulationDecision {
    const stopAnalysis = analyzeStopClusters(retailers, market, pipMultiplier)
    const inventory = book.positionSize
    const inventoryPct = inventory / 10000  // As % of typical 10K target

    // ──────────────────────────────────────────────────────────────────────
    // 1. IMPROVE ENTRY (Building phase — whale wants to buy cheaper)
    // ──────────────────────────────────────────────────────────────────────
    if (goal === 'improve_entry' && phase === 'building') {
        // If whale is accumulating LONG, push price DOWN to:
        // - Trigger long stop losses (forced sells = cheap liquidity)
        // - Scare retail into panic selling
        // - Buy at lower avg price

        if (stopAnalysis.bestTargetDown && stopAnalysis.bestTargetDown.count >= 3) {
            const cluster = stopAnalysis.bestTargetDown
            const canAfford = inventory >= 2000  // Need at least 2000 units to manipulate effectively

            if (canAfford || inventory === 0) {
                const intensity: 'light' | 'medium' | 'heavy' =
                    cluster.count >= 10 ? 'heavy' :
                    cluster.count >= 6 ? 'medium' :
                    'light'

                return {
                    shouldManipulate: true,
                    direction: 'down',
                    intensity,
                    targetCluster: cluster,
                    reasoning: `BUILDING phase — Push DOWN to trigger ${cluster.count} long stops at ${cluster.level.toFixed(3)} (${cluster.pipsAway.toFixed(1)} pips away). Their forced sells = our cheap buy opportunity.`,
                    expectedGain: `Absorb ${cluster.expectedLiquidation} units from forced liquidations, lower avg entry by ~${(cluster.pipsAway * 0.5).toFixed(1)} pips.`,
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 2. PROTECT PROFIT (Manipulating phase — whale improving position)
    // ──────────────────────────────────────────────────────────────────────
    if (goal === 'protect_profit' && phase === 'manipulating') {
        // Whale has significant inventory. Use it as ammunition.
        // Push price in EITHER direction to:
        // - Trigger stops (force-close retail positions)
        // - Create volatility that scares retail
        // - Improve avg entry or avg exit price

        const upTarget = stopAnalysis.bestTargetUp
        const downTarget = stopAnalysis.bestTargetDown

        // Choose the juicier target
        if (upTarget && downTarget) {
            const upValue = upTarget.count * upTarget.expectedLiquidation
            const downValue = downTarget.count * downTarget.expectedLiquidation

            if (upValue > downValue && upTarget.count >= 5) {
                return {
                    shouldManipulate: true,
                    direction: 'up',
                    intensity: inventory > 6000 ? 'heavy' : inventory > 3000 ? 'medium' : 'light',
                    targetCluster: upTarget,
                    reasoning: `MANIPULATING phase — Use ${inventory} units inventory as ammunition. Push UP to trigger ${upTarget.count} long stops. High-density cluster at ${upTarget.level.toFixed(3)}.`,
                    expectedGain: `Force-close ${upTarget.count} longs, absorb ${upTarget.expectedLiquidation} units, improve position quality.`,
                }
            } else if (downTarget.count >= 5) {
                return {
                    shouldManipulate: true,
                    direction: 'down',
                    intensity: inventory > 6000 ? 'heavy' : inventory > 3000 ? 'medium' : 'light',
                    targetCluster: downTarget,
                    reasoning: `MANIPULATING phase — Inventory: ${inventory} units. Push DOWN to trigger ${downTarget.count} short stops. Dense cluster at ${downTarget.level.toFixed(3)}.`,
                    expectedGain: `Liquidate ${downTarget.count} shorts, absorb ${downTarget.expectedLiquidation} units of forced covering.`,
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // 3. TRIGGER EXITS (Distributing phase — whale wants retail to panic)
    // ──────────────────────────────────────────────────────────────────────
    if (goal === 'trigger_exits' && phase === 'distributing') {
        // Whale is selling. Push price DOWN to:
        // - Trigger long stops (create panic)
        // - Force retail to sell into the whale's bid
        // - Distribute inventory faster

        if (stopAnalysis.bestTargetDown && stopAnalysis.bestTargetDown.count >= 4) {
            const cluster = stopAnalysis.bestTargetDown
            const intensity: 'light' | 'medium' | 'heavy' =
                inventory > 7000 ? 'heavy' :  // Whale has large inventory to distribute
                inventory > 4000 ? 'medium' :
                'light'

            return {
                shouldManipulate: true,
                direction: 'down',
                intensity,
                targetCluster: cluster,
                reasoning: `DISTRIBUTING phase — Push DOWN to trigger ${cluster.count} stops at ${cluster.level.toFixed(3)}. Panic selling = fast distribution of our ${inventory} units.`,
                expectedGain: `Accelerate distribution into ${cluster.count} forced sellers and panic exits. Clear ${inventory} units faster.`,
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // NO MANIPULATION NEEDED
    // ──────────────────────────────────────────────────────────────────────
    return {
        shouldManipulate: false,
        direction: null,
        intensity: 'light',
        targetCluster: null,
        reasoning: 'No high-value stop clusters detected or inventory too small for effective manipulation.',
        expectedGain: 'N/A',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Manipulation Cost Estimation (Based on intensity)
// ═══════════════════════════════════════════════════════════════════════════

export function estimateManipulationCost(
    intensity: 'light' | 'medium' | 'heavy',
    market: MarketSnapshot,
    pipMultiplier: number
): number {
    const baseRangePips = (market.donchianHigh - market.donchianLow) * pipMultiplier

    // Cost scales with intensity
    switch (intensity) {
        case 'light':
            return Math.max(2, Math.min(5, baseRangePips * 0.1))   // 10% of range, 2-5 pips
        case 'medium':
            return Math.max(4, Math.min(8, baseRangePips * 0.15))  // 15% of range, 4-8 pips
        case 'heavy':
            return Math.max(6, Math.min(12, baseRangePips * 0.25)) // 25% of range, 6-12 pips
    }
}
