/**
 * Whale Psychology Simulator — Core Engine
 *
 * Runs a 12-step simulation of a whale fund operating on EUR/JPY M1 data
 * from 08:30-11:30 AM ET. Each step covers ~15 minutes (15 candles).
 *
 * NEW Architecture:
 *  1. Fetch data + pre-compute indicators (unchanged)
 *  2. Loop 12 steps:
 *     → Deterministic whale decision (instant, no AI)
 *     → Update 50 individual retail traders (instant)
 *     → DeepSeek narrator explains psychology (1 cheap LLM call)
 *  3. Return full SessionReplay
 *
 * Cost: ~$0.012 per simulation (was ~$0.50+ with AI Trio)
 */

import { fetchHistoricalCandles } from '@/lib/oanda/client'
import { calculateCVD, calculateDonchianChannel } from '@/lib/utils/donchian-cvd'
import { buildVolumeProfile } from '@/lib/utils/volume-profile'
import { calculateATR } from '@/lib/utils/indicators'
import { makeWhaleDecision } from './whale-logic'
import { createRetailTraders, updateRetailTraders, snapshotTraders } from './retail-traders'
import { generateNarrative } from './narrator'
import type { OandaCandle } from '@/lib/types/oanda'
import type {
    SessionReplay, SimulationStep, WhaleBook, WhaleAction, WhaleDecision,
    MarketSnapshot, SessionPhase, CandleChartPoint,
    SessionContext, FairValueProfile, RetailTrader, RetailEvent,
} from './types'

const PAIR = 'EUR/JPY'
const INSTRUMENT = 'EUR_JPY'
const PIP_MULTIPLIER = 100  // JPY pair
const STEPS = 12
const CANDLES_PER_STEP = 15
const SESSION_MINUTES = 180  // 3 hours

// ═══════════════════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════

export async function runWhaleSimulation(date: string): Promise<SessionReplay> {
    console.log(`[WhaleEngine] Starting simulation for ${date}`)

    // 1. Build UTC time windows
    const { from, to } = buildSessionWindow(date)
    console.log(`[WhaleEngine] NY session window: ${from} to ${to}`)

    const asianFrom = `${date}T00:00:00Z`
    const asianTo = `${date}T09:00:00Z`
    const londonFrom = `${date}T08:00:00Z`
    const londonTo = `${date}T13:00:00Z`

    const thirtyDaysAgo = new Date(date)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const historicalFrom = thirtyDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z'
    const historicalTo = `${date}T23:59:59Z`

    // 2. Fetch all candle data
    console.log(`[WhaleEngine] Fetching candle data...`)
    const [allCandles, asianCandles, londonCandles, historicalCandles] = await Promise.all([
        fetchHistoricalCandles({ instrument: INSTRUMENT, granularity: 'M1', from, to }),
        fetchHistoricalCandles({ instrument: INSTRUMENT, granularity: 'M1', from: asianFrom, to: asianTo }),
        fetchHistoricalCandles({ instrument: INSTRUMENT, granularity: 'M1', from: londonFrom, to: londonTo }),
        fetchHistoricalCandles({ instrument: INSTRUMENT, granularity: 'H1', from: historicalFrom, to: historicalTo }),
    ])
    console.log(`[WhaleEngine] NY: ${allCandles.length} | Asian: ${asianCandles.length} | London: ${londonCandles.length} | Historical: ${historicalCandles.length}`)

    if (allCandles.length < STEPS * CANDLES_PER_STEP) {
        throw new Error(`Insufficient candles: got ${allCandles.length}, need at least ${STEPS * CANDLES_PER_STEP}. Is ${date} a trading day?`)
    }

    // 3. Calculate session contexts + fair value
    const asianSession = calculateSessionContext(asianCandles, 'asian', PIP_MULTIPLIER)
    const londonSession = calculateSessionContext(londonCandles, 'london', PIP_MULTIPLIER)
    const fairValueProfile = calculateFairValueProfile(historicalCandles)
    console.log(`[WhaleEngine] Fair value: ${fairValueProfile.fairValue.toFixed(3)} (${fairValueProfile.daysCalculated} days)`)

    // 4. Pre-compute indicators on NY session
    const highs = allCandles.map(c => parseFloat(c.mid.h))
    const lows = allCandles.map(c => parseFloat(c.mid.l))
    const closes = allCandles.map(c => parseFloat(c.mid.c))

    const cvdResult = calculateCVD(allCandles, 50)
    const donchian = calculateDonchianChannel(highs, lows, 20, PIP_MULTIPLIER)
    const volumeProfile = buildVolumeProfile(allCandles, 30)
    const realATR = calculateATR(highs, lows, closes, 14)

    // 5. Initialize state
    let book = createInitialBook()
    let retailers = createRetailTraders(50)
    const steps: SimulationStep[] = []

    // 6. Run 12 steps
    console.log(`[WhaleEngine] Starting 12-step simulation...`)
    for (let step = 0; step < STEPS; step++) {
        console.log(`[WhaleEngine] Step ${step + 1}/12`)
        const startIdx = step * CANDLES_PER_STEP
        const endIdx = Math.min(startIdx + CANDLES_PER_STEP, allCandles.length)
        const minutesElapsed = step * (SESSION_MINUTES / STEPS)
        const phase = getPhase(minutesElapsed)

        // Build market snapshot
        const currentIdx = endIdx - 1
        const market = buildMarketSnapshot(
            allCandles, currentIdx, phase, minutesElapsed,
            cvdResult.cvd, cvdResult.trend === 'bullish' ? 'rising' : cvdResult.trend === 'bearish' ? 'falling' : 'flat',
            donchian, volumeProfile.vpoc, volumeProfile.valueAreaHigh, volumeProfile.valueAreaLow,
            asianSession, londonSession, fairValueProfile
        )

        // Update unrealized PnL
        if (book.positionSize > 0) {
            book.unrealizedPnl = (market.currentPrice - book.averageEntry) * PIP_MULTIPLIER
        }

        // Deterministic whale decision (instant — no AI)
        const decision = makeWhaleDecision(market, book, retailers, phase)
        console.log(`[WhaleEngine]   Whale: ${decision.action} ${decision.units}u | confidence ${decision.confidence}`)

        // Sanitize and apply
        const sanitized = sanitizeDecision(decision, book, market, phase)
        const action = applyDecision(sanitized, book, market, phase, currentIdx)
        book = updateBook(book, action, market.currentPrice)

        // Update retail traders (per candle for accurate stop-out detection)
        const stepCandles = allCandles.slice(startIdx, endIdx)
        const allRetailEvents: RetailEvent[] = []

        for (const candle of stepCandles) {
            const result = updateRetailTraders(retailers, candle, market, action)
            retailers = result.traders
            allRetailEvents.push(...result.events)
        }

        const stoppedOut = allRetailEvents.filter(e => e.type === 'stop_out').length
        const fomoEntries = allRetailEvents.filter(e => e.type === 'fomo').length
        console.log(`[WhaleEngine]   Retail: ${allRetailEvents.length} events (${stoppedOut} stopped, ${fomoEntries} FOMO)`)

        // DeepSeek narrator (1 cheap LLM call)
        console.log(`[WhaleEngine]   Narrating...`)
        const psychology = await generateNarrative(action, allRetailEvents, market, book)

        // Build stop loss heatmap
        const stopLossHeatmap = buildStopLossHeatmap(retailers)

        // Record step
        steps.push({
            stepIndex: step,
            phase,
            candleStartIndex: startIdx,
            candleEndIndex: endIdx,
            market: { ...market },
            book: { ...book, actions: [...book.actions] },
            decision: sanitized,
            psychology,
            retailEvents: allRetailEvents,
            retailSnapshots: snapshotTraders(retailers),
            stopLossHeatmap,
        })
    }

    // 7. Build outputs
    const whaleVolatility = calculateWhaleVolatility(book.actions, allCandles.length)
    const candleData = buildCandleChartData(allCandles, donchian, volumeProfile.vpoc, book.actions)

    const retailAggregateStats = {
        totalStoppedOut: retailers.filter(t => t.totalPnl < 0).length,
        totalProfitable: retailers.filter(t => t.totalPnl > 0).length,
        avgPnl: retailers.reduce((sum, t) => sum + t.totalPnl, 0) / retailers.length,
        totalVolumeLost: -retailers.reduce((sum, t) => sum + (t.totalPnl < 0 ? t.totalPnl : 0), 0),
    }

    const totalPnl = book.realizedPnl + book.unrealizedPnl - book.manipulationCost
    console.log(`[WhaleEngine] Complete! Whale: ${totalPnl.toFixed(1)} pips | Retail avg: ${retailAggregateStats.avgPnl.toFixed(1)} pips`)

    return {
        date,
        pair: PAIR,
        instrument: INSTRUMENT,
        sessionStart: from,
        sessionEnd: to,
        totalCandles: allCandles.length,
        steps,
        finalBook: book,
        finalRetailTraders: retailers,
        retailAggregateStats,
        atrComparison: { realATR, whaleVolatility },
        candleData,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase Mapping
// ═══════════════════════════════════════════════════════════════════════════

function getPhase(minutesElapsed: number): SessionPhase {
    if (minutesElapsed < 45) return 'accumulation'
    if (minutesElapsed < 90) return 'manipulation'
    if (minutesElapsed < 120) return 'distribution'
    return 'cleanup'
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Window Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSessionWindow(dateStr: string): { from: string; to: string } {
    const etOffset = 4  // EDT = UTC-4
    const startHour = 8
    const startMin = 30
    const endHour = 11
    const endMin = 30

    const fromUTC = new Date(`${dateStr}T${String(startHour + etOffset).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00.000Z`)
    const toUTC = new Date(`${dateStr}T${String(endHour + etOffset).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00.000Z`)

    return {
        from: fromUTC.toISOString(),
        to: toUTC.toISOString(),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Market Snapshot Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildMarketSnapshot(
    candles: OandaCandle[],
    currentIdx: number,
    phase: SessionPhase,
    minutesElapsed: number,
    cvd: number[],
    cvdTrend: 'rising' | 'falling' | 'flat',
    donchian: { high: number[]; low: number[]; middle: number[] },
    vpoc: number,
    vaHigh: number,
    vaLow: number,
    asianSession: SessionContext,
    londonSession: SessionContext,
    fairValueProfile: FairValueProfile
): MarketSnapshot {
    const relevantCandles = candles.slice(0, currentIdx + 1)
    const h = relevantCandles.map(c => parseFloat(c.mid.h))
    const l = relevantCandles.map(c => parseFloat(c.mid.l))

    return {
        currentPrice: parseFloat(candles[currentIdx].mid.c),
        sessionHigh: Math.max(...h),
        sessionLow: Math.min(...l),
        phase,
        minutesElapsed,
        cvdCurrent: cvd[currentIdx] ?? 0,
        cvdTrend,
        donchianHigh: donchian.high[currentIdx] ?? parseFloat(candles[currentIdx].mid.h),
        donchianLow: donchian.low[currentIdx] ?? parseFloat(candles[currentIdx].mid.l),
        donchianMiddle: donchian.middle[currentIdx] ?? parseFloat(candles[currentIdx].mid.c),
        volumePOC: vpoc,
        valueAreaHigh: vaHigh,
        valueAreaLow: vaLow,
        asianSession,
        londonSession,
        fairValueProfile,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Decision Sanitization & Application
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeDecision(
    decision: WhaleDecision,
    book: WhaleBook,
    _market: MarketSnapshot,
    phase: SessionPhase
): WhaleDecision {
    const d = { ...decision }

    if (phase === 'cleanup' && book.positionSize > 0) {
        d.action = 'distribute'
        d.units = Math.min(d.units || book.positionSize, book.positionSize)
        if (d.units <= 0) d.units = book.positionSize
    }

    if (d.action === 'distribute') {
        d.units = Math.min(d.units, book.positionSize)
        if (d.units <= 0 && book.positionSize <= 0) {
            d.action = 'hold'
            d.units = 0
        }
    }

    if (d.action === 'accumulate' && (phase === 'distribution' || phase === 'cleanup')) {
        d.action = book.positionSize > 0 ? 'distribute' : 'hold'
        d.units = book.positionSize > 0 ? Math.min(d.units, book.positionSize) : 0
    }

    if (d.action === 'accumulate') {
        d.units = Math.min(d.units, 5000)
    }

    if (d.action !== 'hold' && d.units <= 0) {
        d.units = d.action === 'accumulate' ? 1000 : d.action === 'manipulate' ? 0 : 500
    }

    return d
}

function applyDecision(
    decision: WhaleDecision,
    _book: WhaleBook,
    market: MarketSnapshot,
    phase: SessionPhase,
    candleIndex: number
): WhaleAction {
    const manipulationCost = decision.action === 'manipulate'
        ? estimateManipulationCost(market)
        : 0

    return {
        timestamp: new Date().toISOString(),
        candleIndex,
        type: decision.action,
        units: decision.units,
        price: market.currentPrice,
        manipulationDirection: decision.manipulationDirection ?? undefined,
        manipulationCost,
        reasoning: decision.reasoning,
        phase,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Book Update
// ═══════════════════════════════════════════════════════════════════════════

function createInitialBook(): WhaleBook {
    return {
        positionSize: 0,
        averageEntry: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        manipulationCost: 0,
        totalAccumulated: 0,
        totalDistributed: 0,
        actions: [],
    }
}

function updateBook(book: WhaleBook, action: WhaleAction, currentPrice: number): WhaleBook {
    const updated = { ...book, actions: [...book.actions, action] }

    switch (action.type) {
        case 'accumulate': {
            const totalCost = updated.averageEntry * updated.positionSize + action.price * action.units
            updated.positionSize += action.units
            updated.averageEntry = updated.positionSize > 0 ? totalCost / updated.positionSize : 0
            updated.totalAccumulated += action.units
            break
        }
        case 'distribute': {
            const sellUnits = Math.min(action.units, updated.positionSize)
            if (sellUnits > 0 && updated.averageEntry > 0) {
                const pnlPips = (action.price - updated.averageEntry) * PIP_MULTIPLIER
                updated.realizedPnl += pnlPips * (sellUnits / 1000)
                updated.positionSize -= sellUnits
                updated.totalDistributed += sellUnits
                if (updated.positionSize <= 0) {
                    updated.positionSize = 0
                    updated.averageEntry = 0
                }
            }
            break
        }
        case 'manipulate': {
            updated.manipulationCost += action.manipulationCost ?? 0
            break
        }
        case 'hold':
            break
    }

    if (updated.positionSize > 0 && updated.averageEntry > 0) {
        updated.unrealizedPnl = (currentPrice - updated.averageEntry) * PIP_MULTIPLIER
    } else {
        updated.unrealizedPnl = 0
    }

    return updated
}

function estimateManipulationCost(market: MarketSnapshot): number {
    const widthPips = (market.donchianHigh - market.donchianLow) * PIP_MULTIPLIER
    return Math.max(2, Math.min(8, widthPips * 0.15))
}

// ═══════════════════════════════════════════════════════════════════════════
// Whale Volatility (for ATR comparison)
// ═══════════════════════════════════════════════════════════════════════════

function calculateWhaleVolatility(actions: WhaleAction[], totalCandles: number): number[] {
    const volatility = new Array(totalCandles).fill(0)
    const DECAY_CANDLES = 5
    const DECAY_RATE = 0.6

    for (const action of actions) {
        if (action.type !== 'manipulate') continue
        const spikePips = (action.manipulationCost ?? 5) * PIP_MULTIPLIER / 100
        const idx = action.candleIndex

        for (let offset = 0; offset < DECAY_CANDLES && idx + offset < totalCandles; offset++) {
            volatility[idx + offset] += spikePips * Math.pow(DECAY_RATE, offset)
        }
    }

    return volatility
}

// ═══════════════════════════════════════════════════════════════════════════
// Stop Loss Heatmap
// ═══════════════════════════════════════════════════════════════════════════

function buildStopLossHeatmap(traders: RetailTrader[]): { levels: number[]; counts: number[] } {
    const stopMap = new Map<string, number>()

    for (const trader of traders) {
        if (trader.position) {
            const level = trader.position.stopLoss.toFixed(2) // Group by 0.01
            stopMap.set(level, (stopMap.get(level) || 0) + 1)
        }
    }

    const sorted = Array.from(stopMap.entries())
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))

    return {
        levels: sorted.map(([level]) => parseFloat(level)),
        counts: sorted.map(([, count]) => count),
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Chart Data Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildCandleChartData(
    candles: OandaCandle[],
    donchian: { high: number[]; low: number[]; middle: number[] },
    vpoc: number,
    actions: WhaleAction[]
): CandleChartPoint[] {
    const actionMap = new Map<number, WhaleAction>()
    for (const a of actions) {
        actionMap.set(a.candleIndex, a)
    }

    return candles.map((c, i) => {
        const action = actionMap.get(i)
        return {
            time: c.time,
            index: i,
            close: parseFloat(c.mid.c),
            high: parseFloat(c.mid.h),
            low: parseFloat(c.mid.l),
            volume: c.volume,
            whaleAction: action?.type,
            whaleUnits: action?.units,
            donchianHigh: donchian.high[i],
            donchianLow: donchian.low[i],
            volumePOC: vpoc,
        }
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Context Helpers
// ═══════════════════════════════════════════════════════════════════════════

function calculateSessionContext(
    candles: OandaCandle[],
    session: 'asian' | 'london',
    pipMultiplier: number
): SessionContext {
    if (candles.length === 0) {
        return {
            session, open: 0, high: 0, low: 0, close: 0, range: 0,
            direction: 'ranging', volumeAvg: 0, imbalances: 0,
            narrative: 'No data available',
        }
    }

    const open = parseFloat(candles[0].mid.c)
    const close = parseFloat(candles[candles.length - 1].mid.c)
    const high = Math.max(...candles.map(c => parseFloat(c.mid.h)))
    const low = Math.min(...candles.map(c => parseFloat(c.mid.l)))
    const range = (high - low) * pipMultiplier
    const volumeAvg = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length

    const priceChange = close - open
    const direction: 'bullish' | 'bearish' | 'ranging' =
        priceChange > range * 0.3 ? 'bullish' :
        priceChange < -range * 0.3 ? 'bearish' :
        'ranging'

    let imbalances = 0
    for (let i = 1; i < candles.length; i++) {
        const prevHigh = parseFloat(candles[i - 1].mid.h)
        const currLow = parseFloat(candles[i].mid.l)
        const prevLow = parseFloat(candles[i - 1].mid.l)
        const currHigh = parseFloat(candles[i].mid.h)
        if (currLow > prevHigh) imbalances++
        if (currHigh < prevLow) imbalances++
    }

    const sessionName = session === 'asian' ? 'Asian' : 'London'
    const narrativeParts: string[] = []
    if (direction === 'bullish') narrativeParts.push(`${sessionName} session rallied ${range.toFixed(1)} pips`)
    else if (direction === 'bearish') narrativeParts.push(`${sessionName} session dropped ${range.toFixed(1)} pips`)
    else narrativeParts.push(`${sessionName} session ranged ${range.toFixed(1)} pips`)
    if (imbalances > 3) narrativeParts.push(`leaving ${imbalances} unfilled gaps`)
    narrativeParts.push(volumeAvg > 1000 ? 'high volume' : volumeAvg < 500 ? 'low volume' : 'normal volume')

    return { session, open, high, low, close, range, direction, volumeAvg, imbalances, narrative: narrativeParts.join(', ') }
}

function calculateFairValueProfile(historicalCandles: OandaCandle[]): FairValueProfile {
    if (historicalCandles.length === 0) {
        return { fairValue: 0, valueAreaHigh: 0, valueAreaLow: 0, premiumZone: 0, discountZone: 0, daysCalculated: 0 }
    }

    const profile = buildVolumeProfile(historicalCandles, 30)
    const fairValue = profile.vpoc
    const valueAreaHigh = profile.valueAreaHigh
    const valueAreaLow = profile.valueAreaLow
    const premiumZone = fairValue + (valueAreaHigh - fairValue) * 0.5
    const discountZone = fairValue - (fairValue - valueAreaLow) * 0.5

    const firstTime = new Date(historicalCandles[0].time).getTime()
    const lastTime = new Date(historicalCandles[historicalCandles.length - 1].time).getTime()
    const daysCalculated = Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24))

    return { fairValue, valueAreaHigh, valueAreaLow, premiumZone, discountZone, daysCalculated }
}
