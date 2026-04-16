/**
 * Whale Psychology Simulator — Individual Retail Trader Simulation
 *
 * 50 simulated retail traders, each with unique personality:
 *   - 20 Novice (high FOMO, chase breakouts, tight stops)
 *   - 20 Intermediate (moderate FOMO, pullback entries, medium stops)
 *   - 10 Advanced (low FOMO, contrarian/fade entries, wide stops)
 *
 * The whale exploits their predictable behavior:
 *   Novice stops at Donchian middle → easy stop hunts
 *   Intermediate stops at Donchian low/high → standard stop hunts
 *   Advanced stops outside value area → harder to hunt, but less common
 */

import type {
    RetailTrader, RetailPosition, RetailEvent, RetailTraderSnapshot,
    ExperienceLevel, MarketSnapshot, WhaleAction,
} from './types'

// Seeded random for reproducible simulations within a session
let seed = 42
function seededRandom(): number {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
}

export function resetSeed(s: number = 42): void {
    seed = s
}

const PIP_MULTIPLIER = 100 // EUR/JPY

// ═══════════════════════════════════════════════════════════════════════════
// Trader Names
// ═══════════════════════════════════════════════════════════════════════════

const ADJECTIVES = [
    'Eager', 'Hopeful', 'Nervous', 'Confident', 'Reckless',
    'Cautious', 'Greedy', 'Fearful', 'Impatient', 'Stubborn',
]

const NOUNS = [
    'Bull', 'Bear', 'Trader', 'Scalper', 'Gambler',
    'Newbie', 'Investor', 'Punter', 'Dreamer', 'Speculator',
]

function generateTraderName(id: number): string {
    const adj = ADJECTIVES[(id - 1) % ADJECTIVES.length]
    const noun = NOUNS[Math.floor((id - 1) / ADJECTIVES.length) % NOUNS.length]
    return `${adj} ${noun} #${id}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Create Traders
// ═══════════════════════════════════════════════════════════════════════════

export function createRetailTraders(count: number = 50): RetailTrader[] {
    resetSeed(42)
    const traders: RetailTrader[] = []

    for (let i = 1; i <= count; i++) {
        // 40% novice (1-20), 40% intermediate (21-40), 20% advanced (41-50)
        const experience: ExperienceLevel =
            i <= Math.floor(count * 0.4) ? 'novice' :
            i <= Math.floor(count * 0.8) ? 'intermediate' :
            'advanced'

        const fomoScore =
            experience === 'novice' ? Math.round(70 + seededRandom() * 30) :       // 70-100
            experience === 'intermediate' ? Math.round(40 + seededRandom() * 40) :  // 40-80
            Math.round(10 + seededRandom() * 30)                                     // 10-40

        const riskTolerance =
            experience === 'novice' ? 3 + seededRandom() * 2 :         // 3-5%
            experience === 'intermediate' ? 1.5 + seededRandom() * 1.5 : // 1.5-3%
            1 + seededRandom() * 1                                       // 1-2%

        traders.push({
            id: i,
            name: generateTraderName(i),
            accountSize: 1000 + seededRandom() * 4000,
            riskTolerance: Math.round(riskTolerance * 10) / 10,
            fomoScore,
            experience,
            position: null,
            totalPnl: 0,
            totalTrades: 0,
            status: 'watching',
        })
    }

    return traders
}

// ═══════════════════════════════════════════════════════════════════════════
// Update Traders (called per candle)
// ═══════════════════════════════════════════════════════════════════════════

interface OandaCandleLike {
    time: string
    mid: { o: string | number; h: string | number; l: string | number; c: string | number }
    volume: number
}

export function updateRetailTraders(
    traders: RetailTrader[],
    candle: OandaCandleLike,
    market: MarketSnapshot,
    whaleAction: WhaleAction
): { traders: RetailTrader[]; events: RetailEvent[] } {

    const events: RetailEvent[] = []
    const currentPrice = typeof candle.mid.c === 'string' ? parseFloat(candle.mid.c) : candle.mid.c
    const high = typeof candle.mid.h === 'string' ? parseFloat(candle.mid.h) : candle.mid.h
    const low = typeof candle.mid.l === 'string' ? parseFloat(candle.mid.l) : candle.mid.l

    const updated = traders.map(trader => {
        const t = { ...trader, position: trader.position ? { ...trader.position } : null }

        // ── 1. Check stop-outs for existing positions ──
        if (t.position) {
            const stoppedLong = t.position.direction === 'long' && low <= t.position.stopLoss
            const stoppedShort = t.position.direction === 'short' && high >= t.position.stopLoss

            if (stoppedLong || stoppedShort) {
                const exitPrice = t.position.stopLoss
                const pnl = calculatePnL(t.position, exitPrice)
                t.totalPnl += pnl
                t.totalTrades++
                t.status = 'stopped_out'

                events.push({
                    traderId: t.id,
                    traderName: t.name,
                    timestamp: candle.time,
                    type: 'stop_out',
                    price: exitPrice,
                    pnl,
                    reason: `STOPPED OUT at ${exitPrice.toFixed(3)} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)} pips) — ${t.position.reason}`,
                })

                t.position = null
                return t
            }

            // Check take-profit
            const tpLong = t.position.direction === 'long' && high >= t.position.takeProfit
            const tpShort = t.position.direction === 'short' && low <= t.position.takeProfit

            if (tpLong || tpShort) {
                const exitPrice = t.position.takeProfit
                const pnl = calculatePnL(t.position, exitPrice)
                t.totalPnl += pnl
                t.totalTrades++
                t.status = 'took_profit'

                events.push({
                    traderId: t.id,
                    traderName: t.name,
                    timestamp: candle.time,
                    type: 'take_profit',
                    price: exitPrice,
                    pnl,
                    reason: `TAKE PROFIT at ${exitPrice.toFixed(3)} (+${pnl.toFixed(1)} pips)`,
                })

                t.position = null
                return t
            }
        }

        // ── 2. Entry logic for traders without positions ──
        if (!t.position) {
            t.status = 'watching'
            const roll = seededRandom()

            // NOVICE: Chase Donchian breakouts (high FOMO)
            if (t.experience === 'novice') {
                // Bullish breakout chase
                if (currentPrice > market.donchianHigh && roll < 0.6) {
                    const sl = market.donchianMiddle
                    const tp = currentPrice + (currentPrice - sl) * 1.5
                    t.position = {
                        direction: 'long',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'FOMO breakout chase',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'fomo',
                        price: currentPrice,
                        reason: `FOMO LONG at ${currentPrice.toFixed(3)} — chasing Donchian breakout, SL at ${sl.toFixed(3)}`,
                    })
                }
                // Bearish panic short
                else if (currentPrice < market.donchianLow && roll < 0.5) {
                    const sl = market.donchianMiddle
                    const tp = currentPrice - (sl - currentPrice) * 1.5
                    t.position = {
                        direction: 'short',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Panic breakdown sell',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'panic',
                        price: currentPrice,
                        reason: `PANIC SHORT at ${currentPrice.toFixed(3)} — breakdown below Donchian, SL at ${sl.toFixed(3)}`,
                    })
                }
                // Manipulation reaction: novices jump on momentum
                else if (whaleAction.type === 'manipulate' && whaleAction.manipulationDirection === 'up' && roll < 0.4) {
                    const sl = market.donchianMiddle
                    const tp = currentPrice + (currentPrice - sl) * 2
                    t.position = {
                        direction: 'long',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Chasing whale-created momentum',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'fomo',
                        price: currentPrice,
                        reason: `FOMO LONG at ${currentPrice.toFixed(3)} — chasing sudden price spike (whale's manipulation)`,
                    })
                }
            }

            // INTERMEDIATE: Pullback entries, value area awareness
            else if (t.experience === 'intermediate') {
                // Buy pullback to value area (smarter entry)
                if (market.cvdTrend === 'rising' &&
                    currentPrice > market.valueAreaLow &&
                    currentPrice < market.volumePOC &&
                    roll < 0.35) {
                    const sl = market.donchianLow
                    const tp = currentPrice + (currentPrice - sl) * 2.5
                    t.position = {
                        direction: 'long',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Pullback to value area with rising CVD',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'entry',
                        price: currentPrice,
                        reason: `LONG at ${currentPrice.toFixed(3)} — pullback to VA with rising CVD, SL at Donchian ${sl.toFixed(3)}`,
                    })
                }
                // Sell at resistance
                else if (market.cvdTrend === 'falling' &&
                    currentPrice > market.volumePOC &&
                    currentPrice < market.valueAreaHigh &&
                    roll < 0.3) {
                    const sl = market.donchianHigh
                    const tp = currentPrice - (sl - currentPrice) * 2.5
                    t.position = {
                        direction: 'short',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Resistance rejection with falling CVD',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'entry',
                        price: currentPrice,
                        reason: `SHORT at ${currentPrice.toFixed(3)} — resistance rejection, falling CVD, SL at ${sl.toFixed(3)}`,
                    })
                }
            }

            // ADVANCED: Contrarian/fade entries
            else if (t.experience === 'advanced') {
                // Fade breakout above Donchian (contrarian — "this is a stop hunt")
                if (currentPrice > market.donchianHigh &&
                    whaleAction.type === 'manipulate' &&
                    roll < 0.25) {
                    const sl = market.donchianHigh + (market.donchianHigh - market.donchianLow) * 0.15
                    const tp = market.volumePOC
                    t.position = {
                        direction: 'short',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Fading the stop hunt — contrarian',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'entry',
                        price: currentPrice,
                        reason: `CONTRARIAN SHORT at ${currentPrice.toFixed(3)} — fading the fake breakout, targeting POC ${tp.toFixed(3)}`,
                    })
                }
                // Buy the stop hunt low (contrarian buy)
                else if (currentPrice < market.donchianLow &&
                    whaleAction.type === 'manipulate' &&
                    roll < 0.25) {
                    const sl = market.donchianLow - (market.donchianHigh - market.donchianLow) * 0.15
                    const tp = market.volumePOC
                    t.position = {
                        direction: 'long',
                        entryPrice: currentPrice,
                        units: calculateUnits(t, currentPrice, sl),
                        stopLoss: sl,
                        takeProfit: tp,
                        enteredAt: candle.time,
                        reason: 'Buying the stop hunt dip — contrarian',
                    }
                    t.status = 'in_position'
                    events.push({
                        traderId: t.id,
                        traderName: t.name,
                        timestamp: candle.time,
                        type: 'entry',
                        price: currentPrice,
                        reason: `CONTRARIAN LONG at ${currentPrice.toFixed(3)} — buying the fake breakdown, targeting POC ${tp.toFixed(3)}`,
                    })
                }
            }
        }

        return t
    })

    return { traders: updated, events }
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function calculateUnits(trader: RetailTrader, entry: number, sl: number): number {
    const riskDollars = trader.accountSize * (trader.riskTolerance / 100)
    const slDistancePips = Math.abs(entry - sl) * PIP_MULTIPLIER
    if (slDistancePips <= 0) return 100
    return Math.max(100, Math.floor(riskDollars / slDistancePips * 100))
}

function calculatePnL(position: RetailPosition, exitPrice: number): number {
    return position.direction === 'long'
        ? (exitPrice - position.entryPrice) * PIP_MULTIPLIER
        : (position.entryPrice - exitPrice) * PIP_MULTIPLIER
}

export function snapshotTraders(traders: RetailTrader[]): RetailTraderSnapshot[] {
    return traders.map(t => ({
        traderId: t.id,
        name: t.name,
        experience: t.experience,
        position: t.position ? { ...t.position } : null,
        totalPnl: t.totalPnl,
        status: t.status,
    }))
}
