/**
 * Whale Simulator — Core Engine
 *
 * Runs a 12-step simulation of a whale fund operating on EUR/JPY M1 data
 * from 08:30-11:30 AM ET. Each step covers ~15 minutes (15 candles).
 *
 * Flow:
 *  1. Fetch EUR/JPY M1 candles for the session window
 *  2. Pre-compute indicators (CVD, Donchian, Volume Profile, ATR)
 *  3. Loop 12 steps: build snapshot → AI Trio → apply decision → update state
 *  4. Return full SessionReplay with ATR comparison
 */

import { fetchHistoricalCandles } from '@/lib/oanda/client'
import { calculateCVD, calculateDonchianChannel } from '@/lib/utils/donchian-cvd'
import { buildVolumeProfile } from '@/lib/utils/volume-profile'
import { calculateATR } from '@/lib/utils/indicators'
import { callGemini } from '@/lib/ai/clients/gemini'
import { callDeepSeek } from '@/lib/ai/clients/deepseek'
import { callClaude } from '@/lib/ai/clients/claude'
import { parseAIJson } from '@/lib/ai/parse-response'
import { buildGeminiWhalePrompt, buildDeepSeekWhalePrompt, buildClaudeWhalePrompt } from './prompts'
import { createInitialRetailState, updateRetailState, calculateWhaleVolatility } from './retail-model'
import type { OandaCandle } from '@/lib/types/oanda'
import type {
    SessionReplay, SimulationStep, WhaleBook, WhaleAction, WhaleDecision,
    MarketSnapshot, SessionPhase, GeminiOutput, DeepSeekOutput, CandleChartPoint,
    SessionContext, FairValueProfile,
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

    // 1. Build UTC time windows for Asian, London, and NY sessions
    const { from, to } = buildSessionWindow(date)
    console.log(`[WhaleEngine] NY session window: ${from} to ${to}`)

    // Build Asian session window (00:00-09:00 UTC)
    const asianFrom = `${date}T00:00:00Z`
    const asianTo = `${date}T09:00:00Z`

    // Build London session window (08:00-13:00 UTC)
    const londonFrom = `${date}T08:00:00Z`
    const londonTo = `${date}T13:00:00Z`

    // Build 30-day historical window for fair value
    const thirtyDaysAgo = new Date(date)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const historicalFrom = thirtyDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z'
    const historicalTo = `${date}T23:59:59Z`

    // 2. Fetch M1 candles for NY session (main simulation)
    console.log(`[WhaleEngine] Fetching ${INSTRUMENT} NY session M1 candles...`)
    const allCandles = await fetchHistoricalCandles({
        instrument: INSTRUMENT,
        granularity: 'M1',
        from,
        to,
    })
    console.log(`[WhaleEngine] Fetched ${allCandles.length} NY candles`)

    if (allCandles.length < STEPS * CANDLES_PER_STEP) {
        throw new Error(`Insufficient candles: got ${allCandles.length}, need at least ${STEPS * CANDLES_PER_STEP}. Is ${date} a trading day?`)
    }

    // 3. Fetch Asian session candles
    console.log(`[WhaleEngine] Fetching Asian session data...`)
    const asianCandles = await fetchHistoricalCandles({
        instrument: INSTRUMENT,
        granularity: 'M1',
        from: asianFrom,
        to: asianTo,
    })
    console.log(`[WhaleEngine] Fetched ${asianCandles.length} Asian candles`)

    // 4. Fetch London session candles
    console.log(`[WhaleEngine] Fetching London session data...`)
    const londonCandles = await fetchHistoricalCandles({
        instrument: INSTRUMENT,
        granularity: 'M1',
        from: londonFrom,
        to: londonTo,
    })
    console.log(`[WhaleEngine] Fetched ${londonCandles.length} London candles`)

    // 5. Fetch 30-day historical data for fair value (use H1 to reduce data volume)
    console.log(`[WhaleEngine] Fetching 30-day historical data for fair value...`)
    const historicalCandles = await fetchHistoricalCandles({
        instrument: INSTRUMENT,
        granularity: 'H1',
        from: historicalFrom,
        to: historicalTo,
    })
    console.log(`[WhaleEngine] Fetched ${historicalCandles.length} historical H1 candles`)

    // 6. Calculate session contexts
    console.log(`[WhaleEngine] Calculating session contexts...`)
    const asianSession = calculateSessionContext(asianCandles, 'asian', PIP_MULTIPLIER)
    const londonSession = calculateSessionContext(londonCandles, 'london', PIP_MULTIPLIER)
    const fairValueProfile = calculateFairValueProfile(historicalCandles)
    console.log(`[WhaleEngine] Fair value: ${fairValueProfile.fairValue.toFixed(3)} (${fairValueProfile.daysCalculated} days)`)

    // 7. Pre-compute indicators on NY session candle set
    const highs = allCandles.map(c => parseFloat(c.mid.h))
    const lows = allCandles.map(c => parseFloat(c.mid.l))
    const closes = allCandles.map(c => parseFloat(c.mid.c))

    const cvdResult = calculateCVD(allCandles, 50)
    const donchian = calculateDonchianChannel(highs, lows, 20, PIP_MULTIPLIER)
    const volumeProfile = buildVolumeProfile(allCandles, 30)
    const realATR = calculateATR(highs, lows, closes, 14)

    // 8. Initialize state
    let book = createInitialBook()
    let retail = createInitialRetailState()
    const steps: SimulationStep[] = []

    // 9. Run 12 steps
    console.log(`[WhaleEngine] Starting 12-step simulation...`)
    for (let step = 0; step < STEPS; step++) {
        console.log(`[WhaleEngine] Step ${step + 1}/12 starting...`)
        const startIdx = step * CANDLES_PER_STEP
        const endIdx = Math.min(startIdx + CANDLES_PER_STEP, allCandles.length)
        const minutesElapsed = step * (SESSION_MINUTES / STEPS)
        const phase = getPhase(minutesElapsed)

        // Build market snapshot up to this point
        const currentIdx = endIdx - 1
        const market = buildMarketSnapshot(
            allCandles, currentIdx, phase, minutesElapsed,
            cvdResult.cvd, cvdResult.trend === 'bullish' ? 'rising' : cvdResult.trend === 'bearish' ? 'falling' : 'flat',
            donchian, volumeProfile.vpoc, volumeProfile.valueAreaHigh, volumeProfile.valueAreaLow,
            asianSession, londonSession, fairValueProfile
        )

        // Update unrealized PnL before AI call
        if (book.positionSize > 0) {
            book.unrealizedPnl = (market.currentPrice - book.averageEntry) * PIP_MULTIPLIER
        }

        // AI Trio: Gemini → DeepSeek → Claude (sequential chain)
        const recentActions = book.actions.slice(-5)

        let geminiRaw = ''
        let deepseekRaw = ''
        let claudeRaw = ''
        let decision: WhaleDecision

        try {
            console.log(`[WhaleEngine] Step ${step + 1}: Calling Gemini...`)
            geminiRaw = await callGemini(
                buildGeminiWhalePrompt(market, book, retail, recentActions),
                { timeout: 30_000 }
            )

            console.log(`[WhaleEngine] Step ${step + 1}: Calling DeepSeek...`)
            deepseekRaw = await callDeepSeek(
                buildDeepSeekWhalePrompt(market, book, retail, geminiRaw, recentActions),
                { timeout: 30_000 }
            )

            console.log(`[WhaleEngine] Step ${step + 1}: Calling Claude...`)
            claudeRaw = await callClaude(
                buildClaudeWhalePrompt(market, book, retail, geminiRaw, deepseekRaw, recentActions),
                { timeout: 30_000, model: 'claude-sonnet-4-5-20250929' }
            )

            console.log(`[WhaleEngine] Step ${step + 1}: Parsing decision...`)
            decision = parseAIJson<WhaleDecision>(claudeRaw)
            console.log(`[WhaleEngine] Step ${step + 1}: Decision = ${decision.action} (${decision.units} units)`)
        } catch (err) {
            console.error(`[WhaleEngine] AI error at step ${step + 1}:`, err)
            decision = {
                action: 'hold',
                units: 0,
                reasoning: `AI call failed at step ${step + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`,
                confidence: 0,
                retailImpact: 'No impact — holding position.',
            }
        }

        // Sanitize and apply decision
        decision = sanitizeDecision(decision, book, market, phase)
        const action = applyDecision(decision, book, market, phase, currentIdx)

        // Update book
        book = updateBook(book, action, market.currentPrice)

        // Update retail state
        retail = updateRetailState(
            retail, action, market.currentPrice,
            market.donchianHigh, market.donchianLow, phase
        )

        // Record step
        steps.push({
            stepIndex: step,
            phase,
            candleStartIndex: startIdx,
            candleEndIndex: endIdx,
            market: { ...market },
            book: { ...book, actions: [...book.actions] },
            retail: { ...retail },
            decision,
            aiResponses: { gemini: geminiRaw, deepseek: deepseekRaw, claude: claudeRaw },
        })
    }

    // 6. Build ATR comparison
    console.log(`[WhaleEngine] Building ATR comparison...`)
    const whaleVolatility = calculateWhaleVolatility(book.actions, allCandles.length, PIP_MULTIPLIER)

    // 7. Build chart data
    console.log(`[WhaleEngine] Building chart data...`)
    const candleData = buildCandleChartData(allCandles, donchian, volumeProfile.vpoc, book.actions)

    console.log(`[WhaleEngine] Simulation complete! Total PnL: ${(book.realizedPnl + book.unrealizedPnl - book.manipulationCost).toFixed(1)} pips`)

    return {
        date,
        pair: PAIR,
        instrument: INSTRUMENT,
        sessionStart: from,
        sessionEnd: to,
        totalCandles: allCandles.length,
        steps,
        finalBook: book,
        finalRetail: retail,
        atrComparison: {
            realATR,
            whaleVolatility,
        },
        candleData,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase Mapping
// ═══════════════════════════════════════════════════════════════════════════

function getPhase(minutesElapsed: number): SessionPhase {
    if (minutesElapsed < 45) return 'accumulation'       // 08:30-09:15
    if (minutesElapsed < 90) return 'manipulation'        // 09:15-10:00
    if (minutesElapsed < 120) return 'distribution'       // 10:00-10:30
    return 'cleanup'                                       // 10:30-11:30
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Window Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildSessionWindow(dateStr: string): { from: string; to: string } {
    // 08:30 ET = 12:30 UTC (EDT, Apr-Nov) or 13:30 UTC (EST, Nov-Apr)
    // Use a simple EDT assumption for now (most of trading year)
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
    const highs = relevantCandles.map(c => parseFloat(c.mid.h))
    const lows = relevantCandles.map(c => parseFloat(c.mid.l))

    return {
        currentPrice: parseFloat(candles[currentIdx].mid.c),
        sessionHigh: Math.max(...highs),
        sessionLow: Math.min(...lows),
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
    market: MarketSnapshot,
    phase: SessionPhase
): WhaleDecision {
    const d = { ...decision }

    // Force cleanup sells
    if (phase === 'cleanup' && book.positionSize > 0) {
        d.action = 'distribute'
        d.units = Math.min(d.units || book.positionSize, book.positionSize)
        if (d.units <= 0) d.units = book.positionSize
    }

    // Cannot sell more than position
    if (d.action === 'distribute') {
        d.units = Math.min(d.units, book.positionSize)
        if (d.units <= 0 && book.positionSize <= 0) {
            d.action = 'hold'
            d.units = 0
        }
    }

    // Cannot accumulate during distribution/cleanup
    if (d.action === 'accumulate' && (phase === 'distribution' || phase === 'cleanup')) {
        d.action = book.positionSize > 0 ? 'distribute' : 'hold'
        d.units = book.positionSize > 0 ? Math.min(d.units, book.positionSize) : 0
    }

    // Cap accumulation at 5000 units per step
    if (d.action === 'accumulate') {
        d.units = Math.min(d.units, 5000)
    }

    // Ensure units > 0 for non-hold actions
    if (d.action !== 'hold' && d.units <= 0) {
        d.units = d.action === 'accumulate' ? 1000 : d.action === 'manipulate' ? 0 : 500
    }

    return d
}

function applyDecision(
    decision: WhaleDecision,
    book: WhaleBook,
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
            // Weighted average entry
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
                updated.realizedPnl += pnlPips * (sellUnits / 1000)  // Scale PnL by lot size
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
            // No change
            break
    }

    // Update unrealized PnL
    if (updated.positionSize > 0 && updated.averageEntry > 0) {
        updated.unrealizedPnl = (currentPrice - updated.averageEntry) * PIP_MULTIPLIER
    } else {
        updated.unrealizedPnl = 0
    }

    return updated
}

function estimateManipulationCost(market: MarketSnapshot): number {
    // Cost scales with Donchian width — wider channel = more expensive stop hunt
    const widthPips = (market.donchianHigh - market.donchianLow) * PIP_MULTIPLIER
    return Math.max(2, Math.min(8, widthPips * 0.15))
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
    // Build action lookup by candle index
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

/**
 * Calculate session context (Asian or London)
 * Analyzes what happened during that session for institutional context
 */
function calculateSessionContext(
    candles: OandaCandle[],
    session: 'asian' | 'london',
    pipMultiplier: number
): SessionContext {
    if (candles.length === 0) {
        return {
            session,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            range: 0,
            direction: 'ranging',
            volumeAvg: 0,
            imbalances: 0,
            narrative: 'No data available',
        }
    }

    const open = parseFloat(candles[0].mid.c)
    const close = parseFloat(candles[candles.length - 1].mid.c)
    const high = Math.max(...candles.map(c => parseFloat(c.mid.h)))
    const low = Math.min(...candles.map(c => parseFloat(c.mid.l)))
    const range = (high - low) * pipMultiplier

    // Calculate volume average
    const volumeAvg = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length

    // Determine direction
    const priceChange = close - open
    const direction: 'bullish' | 'bearish' | 'ranging' =
        priceChange > range * 0.3 ? 'bullish' :
        priceChange < -range * 0.3 ? 'bearish' :
        'ranging'

    // Count imbalances (gaps between candles)
    let imbalances = 0
    for (let i = 1; i < candles.length; i++) {
        const prevHigh = parseFloat(candles[i - 1].mid.h)
        const prevLow = parseFloat(candles[i - 1].mid.l)
        const currHigh = parseFloat(candles[i].mid.h)
        const currLow = parseFloat(candles[i].mid.l)

        // Gap up (current low > previous high)
        if (currLow > prevHigh) imbalances++
        // Gap down (current high < previous low)
        if (currHigh < prevLow) imbalances++
    }

    // Generate narrative
    const sessionName = session === 'asian' ? 'Asian' : 'London'
    const narrativeParts: string[] = []

    if (direction === 'bullish') {
        narrativeParts.push(`${sessionName} session rallied ${range.toFixed(1)} pips`)
    } else if (direction === 'bearish') {
        narrativeParts.push(`${sessionName} session dropped ${range.toFixed(1)} pips`)
    } else {
        narrativeParts.push(`${sessionName} session ranged ${range.toFixed(1)} pips`)
    }

    if (imbalances > 3) {
        narrativeParts.push(`leaving ${imbalances} unfilled gaps`)
    }

    const volumeComparison = volumeAvg > 1000 ? 'high volume' : volumeAvg < 500 ? 'low volume' : 'normal volume'
    narrativeParts.push(volumeComparison)

    return {
        session,
        open,
        high,
        low,
        close,
        range,
        direction,
        volumeAvg,
        imbalances,
        narrative: narrativeParts.join(', '),
    }
}

/**
 * Calculate 30-day fair value profile
 * Uses fixed volume profile over 30 days to find true "fair price"
 */
function calculateFairValueProfile(
    historicalCandles: OandaCandle[]
): FairValueProfile {
    if (historicalCandles.length === 0) {
        return {
            fairValue: 0,
            valueAreaHigh: 0,
            valueAreaLow: 0,
            premiumZone: 0,
            discountZone: 0,
            daysCalculated: 0,
        }
    }

    // Build 30-day volume profile
    const profile = buildVolumeProfile(historicalCandles, 30)

    // Fair value = POC (Point of Control - highest volume price)
    const fairValue = profile.vpoc

    // Value area already calculated by buildVolumeProfile (70% of volume)
    const valueAreaHigh = profile.valueAreaHigh
    const valueAreaLow = profile.valueAreaLow

    // Premium zone = above fair value (top half of upper value area)
    // Discount zone = below fair value (bottom half of lower value area)
    const premiumZone = fairValue + (valueAreaHigh - fairValue) * 0.5
    const discountZone = fairValue - (fairValue - valueAreaLow) * 0.5

    // Calculate how many days of data we actually have
    const firstTime = new Date(historicalCandles[0].time).getTime()
    const lastTime = new Date(historicalCandles[historicalCandles.length - 1].time).getTime()
    const daysCalculated = Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24))

    return {
        fairValue,
        valueAreaHigh,
        valueAreaLow,
        premiumZone,
        discountZone,
        daysCalculated,
    }
}
