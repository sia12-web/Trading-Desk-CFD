/**
 * Whale Campaign Planner — Strategic Goal Selection
 *
 * Determines the whale's campaign goal UPFRONT based on:
 * 1. Institutional Bias (from Operator's 3-Step Protocol)
 * 2. Fair Value Proximity (is price at discount, fair, or premium?)
 * 3. London Session Analysis
 *
 * Campaign Goals:
 * - ACCUMULATE_LONG: Buy cheap → manipulate → sell expensive (bullish campaign)
 * - DISTRIBUTE_SHORT: Sell expensive → manipulate → buy cheap (bearish campaign)
 * - OPPORTUNISTIC: Trade both directions around fair value (no bias)
 */

import type { InstitutionalBias, FairValueProfile, WhaleStrategy, CampaignGoal, BiasDirection } from './types'

const DEFAULT_TARGET_SIZE = 10000  // 10,000 units default campaign size
const DEFAULT_MANIPULATION_BUDGET = 15  // 15 pips max manipulation cost

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export function planCampaign(
    bias: InstitutionalBias,
    fairValue: FairValueProfile,
    currentPrice: number,
    pipMultiplier: number
): WhaleStrategy {
    const priceVsFairValue = analyzePricePosition(currentPrice, fairValue, pipMultiplier)
    const goal = selectCampaignGoal(bias.finalBias, priceVsFairValue.zone, bias.consensusScore)

    const strategy = buildStrategy(goal, currentPrice, fairValue, priceVsFairValue, bias, pipMultiplier)

    console.log(`[CampaignPlanner] Goal: ${goal} | Target: ${strategy.targetSize} units | Entry: ${strategy.entryZone.min.toFixed(3)}-${strategy.entryZone.max.toFixed(3)} | Exit: ${strategy.exitZone.min.toFixed(3)}-${strategy.exitZone.max.toFixed(3)}`)

    return strategy
}

// ═══════════════════════════════════════════════════════════════════════════
// Price Position Analysis
// ═══════════════════════════════════════════════════════════════════════════

interface PricePosition {
    zone: 'deep_discount' | 'discount' | 'fair' | 'premium' | 'deep_premium'
    distanceFromFV: number  // pips (positive = above FV, negative = below FV)
    inEntryZone: boolean    // Good zone for accumulation
    inExitZone: boolean     // Good zone for distribution
}

function analyzePricePosition(
    currentPrice: number,
    fairValue: FairValueProfile,
    pipMultiplier: number
): PricePosition {
    const fv = fairValue.fairValue
    const distanceFromFV = (currentPrice - fv) * pipMultiplier

    let zone: PricePosition['zone']
    if (currentPrice < fairValue.discountZone - (fairValue.fairValue - fairValue.discountZone) * 0.5) {
        zone = 'deep_discount'
    } else if (currentPrice < fairValue.discountZone) {
        zone = 'discount'
    } else if (currentPrice > fairValue.premiumZone + (fairValue.premiumZone - fairValue.fairValue) * 0.5) {
        zone = 'deep_premium'
    } else if (currentPrice > fairValue.premiumZone) {
        zone = 'premium'
    } else {
        zone = 'fair'
    }

    const inEntryZone = currentPrice <= fv  // At or below fair value = good entry
    const inExitZone = currentPrice >= fv   // At or above fair value = good exit

    return { zone, distanceFromFV, inEntryZone, inExitZone }
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaign Goal Selection
// ═══════════════════════════════════════════════════════════════════════════

function selectCampaignGoal(
    bias: BiasDirection,
    priceZone: PricePosition['zone'],
    consensusScore: number
): CampaignGoal {
    // Strong consensus + price alignment → directional campaign
    if (consensusScore >= 2) {
        if (bias === 'LONG' && (priceZone === 'discount' || priceZone === 'deep_discount' || priceZone === 'fair')) {
            return 'accumulate_long'
        }
        if (bias === 'SHORT' && (priceZone === 'premium' || priceZone === 'deep_premium' || priceZone === 'fair')) {
            return 'distribute_short'
        }
    }

    // Moderate bias + good price → directional campaign with caution
    if (consensusScore === 1) {
        if (bias === 'LONG' && priceZone === 'deep_discount') {
            return 'accumulate_long'  // Too cheap to ignore
        }
        if (bias === 'SHORT' && priceZone === 'deep_premium') {
            return 'distribute_short'  // Too expensive to ignore
        }
    }

    // Default: opportunistic (trade both directions)
    return 'opportunistic'
}

// ═══════════════════════════════════════════════════════════════════════════
// Strategy Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildStrategy(
    goal: CampaignGoal,
    currentPrice: number,
    fairValue: FairValueProfile,
    pricePos: PricePosition,
    bias: InstitutionalBias,
    pipMultiplier: number
): WhaleStrategy {
    const fv = fairValue.fairValue
    const discountZone = fairValue.discountZone
    const premiumZone = fairValue.premiumZone

    let strategy: WhaleStrategy

    switch (goal) {
        case 'accumulate_long': {
            // Entry zone: discount zone to fair value
            // Exit zone: fair value to premium zone
            // Target: 10,000 units
            const entryMin = discountZone - (fv - discountZone) * 0.3  // Slightly below discount zone
            const entryMax = fv
            const exitMin = fv
            const exitMax = premiumZone + (premiumZone - fv) * 0.3  // Slightly above premium zone

            strategy = {
                goal,
                targetSize: DEFAULT_TARGET_SIZE,
                entryZone: { min: entryMin, max: entryMax },
                exitZone: { min: exitMin, max: exitMax },
                manipulationBudget: DEFAULT_MANIPULATION_BUDGET,
                reasoning: `LONG Campaign: Bias = ${bias.finalBias} (${bias.consensusScore}/3 consensus), Price at ${pricePos.zone} (${pricePos.distanceFromFV.toFixed(1)} pips ${pricePos.distanceFromFV >= 0 ? 'above' : 'below'} FV). Plan: Accumulate ${DEFAULT_TARGET_SIZE} units at discount/fair → manipulate DOWN to improve entry → distribute at premium into retail FOMO.`,
                currentPhase: 'building',
                progress: {
                    accumulated: 0,
                    distributed: 0,
                    netPosition: 0,
                    avgEntry: 0,
                    targetReached: false,
                },
            }
            break
        }

        case 'distribute_short': {
            // Entry zone: premium zone (sell expensive)
            // Exit zone: discount zone (buy back cheap)
            // Target: 10,000 units short
            const entryMin = fv
            const entryMax = premiumZone + (premiumZone - fv) * 0.3
            const exitMin = discountZone - (fv - discountZone) * 0.3
            const exitMax = fv

            strategy = {
                goal,
                targetSize: DEFAULT_TARGET_SIZE,
                entryZone: { min: entryMin, max: entryMax },
                exitZone: { min: exitMin, max: exitMax },
                manipulationBudget: DEFAULT_MANIPULATION_BUDGET,
                reasoning: `SHORT Campaign: Bias = ${bias.finalBias} (${bias.consensusScore}/3 consensus), Price at ${pricePos.zone} (${pricePos.distanceFromFV.toFixed(1)} pips ${pricePos.distanceFromFV >= 0 ? 'above' : 'below'} FV). Plan: Distribute ${DEFAULT_TARGET_SIZE} units at premium → manipulate UP to improve avg short entry → buy back at discount from retail capitulation.`,
                currentPhase: 'building',
                progress: {
                    accumulated: 0,
                    distributed: 0,
                    netPosition: 0,
                    avgEntry: 0,
                    targetReached: false,
                },
            }
            break
        }

        case 'opportunistic': {
            // Entry zone: below fair value
            // Exit zone: above fair value
            // Target: 5,000 units (smaller, more flexible)
            const entryMin = discountZone
            const entryMax = fv
            const exitMin = fv
            const exitMax = premiumZone

            strategy = {
                goal,
                targetSize: 5000,  // Smaller target for opportunistic
                entryZone: { min: entryMin, max: entryMax },
                exitZone: { min: exitMin, max: exitMax },
                manipulationBudget: 10,  // Lower budget for opportunistic
                reasoning: `OPPORTUNISTIC Campaign: Bias = ${bias.finalBias} (${bias.consensusScore}/3 consensus, weak/mixed signals), Price at ${pricePos.zone}. Plan: Trade both directions around fair value. Buy at discount, sell at premium, repeat. Use manipulation to widen the range.`,
                currentPhase: 'building',
                progress: {
                    accumulated: 0,
                    distributed: 0,
                    netPosition: 0,
                    avgEntry: 0,
                    targetReached: false,
                },
            }
            break
        }
    }

    return strategy
}

// ═══════════════════════════════════════════════════════════════════════════
// Strategy Update (called each step to track progress)
// ═══════════════════════════════════════════════════════════════════════════

export function updateStrategyProgress(
    strategy: WhaleStrategy,
    accumulated: number,
    distributed: number,
    netPosition: number,
    avgEntry: number
): WhaleStrategy {
    const updated = { ...strategy }

    updated.progress = {
        accumulated,
        distributed,
        netPosition,
        avgEntry,
        targetReached: accumulated >= strategy.targetSize,
    }

    // Update campaign phase based on progress
    if (strategy.goal === 'accumulate_long') {
        if (netPosition === 0 && accumulated >= strategy.targetSize) {
            updated.currentPhase = 'completed'
        } else if (netPosition >= strategy.targetSize * 0.8) {
            updated.currentPhase = 'distributing'
        } else if (accumulated >= strategy.targetSize * 0.5) {
            updated.currentPhase = 'manipulating'
        } else {
            updated.currentPhase = 'building'
        }
    } else if (strategy.goal === 'distribute_short') {
        if (netPosition === 0 && distributed >= strategy.targetSize) {
            updated.currentPhase = 'completed'
        } else if (distributed >= strategy.targetSize * 0.8) {
            updated.currentPhase = 'distributing'  // Covering shorts
        } else if (distributed >= strategy.targetSize * 0.5) {
            updated.currentPhase = 'manipulating'
        } else {
            updated.currentPhase = 'building'  // Building short position
        }
    } else {
        // Opportunistic: simpler phase logic
        if (netPosition === 0) {
            updated.currentPhase = 'building'
        } else if (Math.abs(netPosition) >= strategy.targetSize * 0.7) {
            updated.currentPhase = 'distributing'
        } else {
            updated.currentPhase = 'manipulating'
        }
    }

    return updated
}
