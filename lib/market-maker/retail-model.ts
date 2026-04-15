/**
 * Retail Crowd Simulator — Rules-Based State Machine
 *
 * Simulates the retail crowd's reaction to whale actions.
 * Pure functions, no API calls. Deterministic behavior.
 *
 * The retail crowd:
 * - Gets greedy when price rises (FOMO)
 * - Gets fearful when price drops
 * - Gets trapped by stop hunts (manipulation)
 * - Chases breakouts (Donchian channel breaks)
 */

import type { RetailState, WhaleAction, SessionPhase } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Initial State
// ═══════════════════════════════════════════════════════════════════════════

export function createInitialRetailState(): RetailState {
    return {
        sentiment: 50,
        breakoutBias: 'neutral',
        stopHuntVictims: 0,
        fomoIntensity: 0,
        narrative: 'Session starting. Retail is neutral, waiting for direction.',
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// State Update (called after each whale action)
// ═══════════════════════════════════════════════════════════════════════════

export function updateRetailState(
    current: RetailState,
    action: WhaleAction,
    currentPrice: number,
    donchianHigh: number,
    donchianLow: number,
    phase: SessionPhase
): RetailState {
    let sentiment = current.sentiment
    let fomoIntensity = current.fomoIntensity
    let victims = current.stopHuntVictims
    let bias: RetailState['breakoutBias'] = current.breakoutBias
    let narrative = current.narrative

    // ── React to whale manipulation ──
    if (action.type === 'manipulate') {
        if (action.manipulationDirection === 'up') {
            // Fake pump: retail gets greedy, goes long
            sentiment = clamp(sentiment + 20, 0, 100)
            fomoIntensity = clamp(fomoIntensity + 20, 0, 100)
            victims += 30
            bias = 'long'
            narrative = 'Price spiking up! Retail piling into longs, FOMO kicking in. Stop losses below getting hunted.'
        } else if (action.manipulationDirection === 'down') {
            // Fake dump: retail panics, goes short
            sentiment = clamp(sentiment - 20, 0, 100)
            fomoIntensity = clamp(fomoIntensity + 10, 0, 100)
            victims += 30
            bias = 'short'
            narrative = 'Price crashing! Retail panicking, longs liquidated. Stop losses above getting hunted.'
        }
    }

    // ── React to natural Donchian channel breaks ──
    else if (currentPrice > donchianHigh && bias !== 'long') {
        sentiment = clamp(sentiment + 10, 0, 100)
        fomoIntensity = clamp(fomoIntensity + 15, 0, 100)
        bias = 'long'
        narrative = 'Breakout above Donchian high! Retail sees "breakout" and jumps in long.'
    } else if (currentPrice < donchianLow && bias !== 'short') {
        sentiment = clamp(sentiment - 10, 0, 100)
        fomoIntensity = clamp(fomoIntensity + 15, 0, 100)
        bias = 'short'
        narrative = 'Breakdown below Donchian low! Retail panics and goes short.'
    }

    // ── React to distribution ──
    else if (action.type === 'distribute') {
        const sentimentDrain = Math.min(action.units / 1000, 10) * 5
        sentiment = clamp(sentiment - sentimentDrain, 0, 100)
        fomoIntensity = clamp(fomoIntensity - 5, 0, 100)
        narrative = 'Large selling pressure detected. Smart retail starting to notice, but most still holding.'
    }

    // ── React to accumulation (retail doesn't notice) ──
    else if (action.type === 'accumulate') {
        // Quiet accumulation — retail barely notices
        sentiment = clamp(sentiment + 2, 0, 100)
        narrative = 'Quiet session. Retail sees no clear direction, mostly sidelined.'
    }

    // ── Hold: sentiment decays toward neutral ──
    else if (action.type === 'hold') {
        sentiment = clamp(sentiment + (sentiment > 50 ? -3 : 3), 0, 100)
        fomoIntensity = clamp(fomoIntensity - 5, 0, 100)
        narrative = 'Nothing happening. Retail getting bored, some closing positions.'
    }

    // ── Phase-specific overrides ──
    if (phase === 'cleanup') {
        narrative = `Cleanup phase. ${narrative} Whale unwinding remaining position.`
        fomoIntensity = clamp(fomoIntensity - 10, 0, 100)
    }

    return {
        sentiment: Math.round(sentiment),
        breakoutBias: bias,
        stopHuntVictims: victims,
        fomoIntensity: Math.round(clamp(fomoIntensity, 0, 100)),
        narrative,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Whale Volatility Calculator (for ATR comparison)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate the volatility impact of whale actions across all candles.
 * Each manipulation creates a pip spike at the candle index,
 * with exponential decay over the next 5 candles.
 *
 * Returns array aligned with candle indices (same length as totalCandles).
 */
export function calculateWhaleVolatility(
    actions: WhaleAction[],
    totalCandles: number,
    pipMultiplier: number = 100  // 100 for JPY pairs
): number[] {
    const volatility = new Array(totalCandles).fill(0)
    const DECAY_CANDLES = 5
    const DECAY_RATE = 0.6  // Each candle retains 60% of previous

    for (const action of actions) {
        if (action.type !== 'manipulate') continue

        // Manipulation creates a volatility spike proportional to cost
        const spikePips = (action.manipulationCost ?? 5) * pipMultiplier / 100
        const idx = action.candleIndex

        for (let offset = 0; offset < DECAY_CANDLES && idx + offset < totalCandles; offset++) {
            const impact = spikePips * Math.pow(DECAY_RATE, offset)
            volatility[idx + offset] += impact
        }
    }

    return volatility
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}
