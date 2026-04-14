/**
 * Three-Tier Institutional Killzone — Auto-Execution Engine
 *
 * Orchestrates the full pipeline:
 *   Tier 1 (Market State) → Tier 2 (Institutional Killzone) → Tier 3 (Wyckoff Spring)
 *   → Position Size → Risk Validation → Execute (or dry-run log)
 *
 * SAFETY: dryRunMode is TRUE by default. Must be explicitly disabled.
 */

import { getCandles } from '@/lib/data/candle-fetcher'
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'
import { detectMarketState } from '@/lib/utils/market-state'
import { detectInstitutionalKillzone } from '@/lib/utils/killzone-detector'
import type { InstitutionalKillzoneSetup } from '@/lib/utils/killzone-detector'
import { detectWyckoffSpring, detectCHoCH } from '@/lib/utils/m1-detectors'
import type { WyckoffSpring } from '@/lib/utils/m1-detectors'
import type { MarketStateResult } from '@/lib/utils/market-state'
import { calculateLotSize } from '@/lib/risk/position-sizer'
import type { PositionSizeResult } from '@/lib/risk/position-sizer'
import { validateTrade } from '@/lib/risk/validator'
import { createMarketOrder } from '@/lib/oanda/client'
import { isCrypto } from '@/lib/data/asset-config'
import { createKrakenMarketOrder } from '@/lib/kraken/client'
import { getAssetConfig } from '@/lib/data/asset-config'
import { createClient } from '@/lib/supabase/server'

// ── Config ──

export interface AutoExecutionConfig {
    enabled: boolean
    dryRunMode: boolean
    maxTradesPerDay: number
    riskAmount: number
    minKillzoneConfidence: number
    pairs: string[]
}

export const DEFAULT_CONFIG: AutoExecutionConfig = {
    enabled: false,
    dryRunMode: true,
    maxTradesPerDay: 3,
    riskAmount: 17,
    minKillzoneConfidence: 60,
    pairs: [],
}

// ── Result ──

export interface AutoExecutionResult {
    pair: string
    tier1: MarketStateResult
    tier2: InstitutionalKillzoneSetup | null
    tier3: WyckoffSpring | null
    execution: {
        executed: boolean
        dryRun: boolean
        direction: 'long' | 'short' | 'none'
        entryPrice: number | null
        stopLoss: number | null
        takeProfit1: number | null
        takeProfit2: number | null
        positionSize: PositionSizeResult | null
        orderId: string | null
        blockedReason: string | null
    }
    timestamp: string
}

// ── Main Pipeline ──

/**
 * Execute the full Three-Tier Institutional Protocol for a single pair.
 *
 * Flow:
 *   1. Fetch H1 + M15 candles
 *   2. TIER 1: detectMarketState() → must be complex_correction
 *   3. TIER 2: detectInstitutionalKillzone() → must detect + confidence >= threshold
 *   4. Fetch M1 candles (only for qualifying pairs)
 *   5. TIER 3: detectWyckoffSpring() + detectCHoCH() → must trigger
 *   6. calculateLotSize() → exact position size
 *   7. validateTrade() → risk checks
 *   8. Execute (or dry-run log)
 */
export async function executeInstitutionalProtocol(
    pair: string,
    config: AutoExecutionConfig,
    userId: string,
): Promise<AutoExecutionResult> {
    const timestamp = new Date().toISOString()
    const instrument = pair.replace('/', '_')
    const assetConfig = getAssetConfig(pair)
    const dp = assetConfig.decimalPlaces

    const emptyExecution = {
        executed: false,
        dryRun: config.dryRunMode,
        direction: 'none' as const,
        entryPrice: null,
        stopLoss: null,
        takeProfit1: null,
        takeProfit2: null,
        positionSize: null,
        orderId: null,
        blockedReason: null,
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 1: Fetch H1 + M15 candles
    // ═══════════════════════════════════════════════════════════════════
    const [h1Response, m15Response] = await Promise.all([
        getCandles({ instrument, granularity: 'H1', count: 100 }),
        getCandles({ instrument, granularity: 'M15', count: 200 }),
    ])

    if (h1Response.error || !h1Response.data || h1Response.data.length < 50) {
        const tier1: MarketStateResult = { regime: 'unknown', maCrossCount: 0, atrSqueeze: false, atrRatio: 1, diamondAccumulation: false, proceedToTier2: false, narrative: 'Failed to fetch H1 candles' }
        return { pair, tier1, tier2: null, tier3: null, execution: { ...emptyExecution, blockedReason: 'Insufficient H1 data' }, timestamp }
    }

    if (m15Response.error || !m15Response.data || m15Response.data.length < 50) {
        const tier1: MarketStateResult = { regime: 'unknown', maCrossCount: 0, atrSqueeze: false, atrRatio: 1, diamondAccumulation: false, proceedToTier2: false, narrative: 'Failed to fetch M15 candles' }
        return { pair, tier1, tier2: null, tier3: null, execution: { ...emptyExecution, blockedReason: 'Insufficient M15 data' }, timestamp }
    }

    const h1Candles = h1Response.data
    const m15Candles = m15Response.data

    // ═══════════════════════════════════════════════════════════════════
    // TIER 1: Market State Detection
    // ═══════════════════════════════════════════════════════════════════
    const tier1 = detectMarketState(m15Candles)

    if (!tier1.proceedToTier2) {
        console.log(`[AutoExec] ${pair} Tier 1 STOP: ${tier1.regime} (${tier1.maCrossCount} crosses)`)
        return { pair, tier1, tier2: null, tier3: null, execution: { ...emptyExecution, blockedReason: `Tier 1: ${tier1.regime} — not complex correction` }, timestamp }
    }

    console.log(`[AutoExec] ${pair} Tier 1 PASS: ${tier1.regime} (${tier1.maCrossCount} crosses, ATR squeeze: ${tier1.atrSqueeze})`)

    // ═══════════════════════════════════════════════════════════════════
    // TIER 2: Institutional Killzone (W-X-Y Projection)
    // ═══════════════════════════════════════════════════════════════════

    // Need Elliott Wave state for Killzone detection
    const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
    const h1Rsi = calculateRSI(h1Closes, 14)
    const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
    const waveState = detectH1ElliottWave(h1Candles, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)

    const tier2 = detectInstitutionalKillzone(waveState, m15Candles, pair, tier1)

    if (!tier2.detected) {
        console.log(`[AutoExec] ${pair} Tier 2 STOP: Killzone not detected`)
        return { pair, tier1, tier2, tier3: null, execution: { ...emptyExecution, blockedReason: 'Tier 2: No Killzone detected' }, timestamp }
    }

    if (tier2.confidence < config.minKillzoneConfidence) {
        console.log(`[AutoExec] ${pair} Tier 2 STOP: Confidence ${tier2.confidence}% < ${config.minKillzoneConfidence}% threshold`)
        return { pair, tier1, tier2, tier3: null, execution: { ...emptyExecution, blockedReason: `Tier 2: Confidence ${tier2.confidence}% below ${config.minKillzoneConfidence}% threshold` }, timestamp }
    }

    console.log(`[AutoExec] ${pair} Tier 2 PASS: Killzone at ${tier2.box?.high.toFixed(dp)} - ${tier2.box?.low.toFixed(dp)} (${tier2.confidence}%)`)

    // ═══════════════════════════════════════════════════════════════════
    // TIER 3: Wyckoff Spring (M1 Sniper)
    // ═══════════════════════════════════════════════════════════════════

    // Only fetch M1 candles for pairs that pass Tier 1 + 2
    const m1Response = await getCandles({ instrument, granularity: 'M1', count: 60 })

    if (m1Response.error || !m1Response.data || m1Response.data.length < 25) {
        return { pair, tier1, tier2, tier3: null, execution: { ...emptyExecution, blockedReason: 'Insufficient M1 data for Tier 3' }, timestamp }
    }

    const m1Candles = m1Response.data
    const isBullish = tier2.direction === 'bullish'
    const killzoneBox = tier2.box ?? tier2.institutionalBox

    if (!killzoneBox) {
        return { pair, tier1, tier2, tier3: null, execution: { ...emptyExecution, blockedReason: 'Tier 2: No Killzone box available' }, timestamp }
    }

    // Detect Wyckoff Spring (3x volume threshold)
    const tier3 = detectWyckoffSpring(m1Candles, killzoneBox, isBullish, 3.0, 20)

    // Also check CHoCH confirmation
    const choch = detectCHoCH(m1Candles, isBullish)

    if (!tier3.triggered) {
        console.log(`[AutoExec] ${pair} Tier 3 STOP: No Wyckoff spring — watching box`)
        return { pair, tier1, tier2, tier3, execution: { ...emptyExecution, blockedReason: 'Tier 3: No Wyckoff spring triggered — watching' }, timestamp }
    }

    if (!choch.detected) {
        console.log(`[AutoExec] ${pair} Tier 3 STOP: Spring found but no CHoCH confirmation`)
        return { pair, tier1, tier2, tier3, execution: { ...emptyExecution, blockedReason: 'Tier 3: Spring detected but CHoCH not confirmed' }, timestamp }
    }

    console.log(`[AutoExec] ${pair} Tier 3 PASS: Wyckoff spring at ${tier3.springCandle?.low.toFixed(dp)}, ${tier3.springCandle?.volumeRatio}x volume, CHoCH at ${choch.breakPrice?.toFixed(dp)}`)

    // ═══════════════════════════════════════════════════════════════════
    // Position Sizing + Risk Validation
    // ═══════════════════════════════════════════════════════════════════

    const entryPrice = choch.breakPrice ?? parseFloat(m1Candles[m1Candles.length - 1].mid.c)
    const stopLoss = tier3.stopLoss!
    const direction: 'long' | 'short' = isBullish ? 'long' : 'short'

    // Calculate TP levels
    const slDistance = Math.abs(entryPrice - stopLoss)
    const takeProfit1 = isBullish ? entryPrice + slDistance * 1.0 : entryPrice - slDistance * 1.0   // 1:1 R:R
    const takeProfit2 = isBullish ? entryPrice + slDistance * 1.618 : entryPrice - slDistance * 1.618 // 1:1.618 R:R

    // Calculate lot size for exact $17 risk
    const positionSize = calculateLotSize(entryPrice, stopLoss, config.riskAmount, pair)

    // Validate trade through risk management
    const validation = await validateTrade({
        instrument,
        direction,
        units: direction === 'short' ? -positionSize.units : positionSize.units,
        entryPrice,
        stopLoss,
        takeProfit: takeProfit1,
    }, userId)

    if (!validation.passed) {
        const blockerMessages = validation.blockers.map(b => b.message).join('; ')
        console.log(`[AutoExec] ${pair} RISK BLOCKED: ${blockerMessages}`)
        return {
            pair, tier1, tier2, tier3,
            execution: {
                ...emptyExecution,
                direction,
                entryPrice,
                stopLoss,
                takeProfit1,
                takeProfit2,
                positionSize,
                blockedReason: `Risk validation failed: ${blockerMessages}`,
            },
            timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Daily trade limit check
    // ═══════════════════════════════════════════════════════════════════
    const client = await createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: todayTradeCount } = await client
        .from('killzone_auto_executions')
        .select('*', { count: 'exact', head: true })
        .eq('executed', true)
        .gte('created_at', todayStart.toISOString())

    if ((todayTradeCount ?? 0) >= config.maxTradesPerDay) {
        console.log(`[AutoExec] ${pair} BLOCKED: Daily trade limit reached (${todayTradeCount}/${config.maxTradesPerDay})`)
        return {
            pair, tier1, tier2, tier3,
            execution: {
                ...emptyExecution,
                direction,
                entryPrice,
                stopLoss,
                takeProfit1,
                takeProfit2,
                positionSize,
                blockedReason: `Daily trade limit reached (${todayTradeCount}/${config.maxTradesPerDay})`,
            },
            timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 30-minute cooldown per pair
    // ═══════════════════════════════════════════════════════════════════
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { count: recentPairTrades } = await client
        .from('killzone_auto_executions')
        .select('*', { count: 'exact', head: true })
        .eq('pair', pair)
        .eq('executed', true)
        .gte('created_at', thirtyMinAgo)

    if ((recentPairTrades ?? 0) > 0) {
        console.log(`[AutoExec] ${pair} BLOCKED: 30-min cooldown active`)
        return {
            pair, tier1, tier2, tier3,
            execution: {
                ...emptyExecution,
                direction,
                entryPrice,
                stopLoss,
                takeProfit1,
                takeProfit2,
                positionSize,
                blockedReason: '30-minute per-pair cooldown active',
            },
            timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Execute (or Dry Run)
    // ═══════════════════════════════════════════════════════════════════
    let orderId: string | null = null
    const executed = !config.dryRunMode

    if (config.dryRunMode) {
        console.log(`[AutoExec] ${pair} DRY RUN: Would ${direction.toUpperCase()} ${positionSize.units} units at ${entryPrice.toFixed(dp)}, SL ${stopLoss.toFixed(dp)}, TP1 ${takeProfit1.toFixed(dp)}, TP2 ${takeProfit2.toFixed(dp)}`)
    } else {
        // LIVE EXECUTION
        const units = direction === 'long' ? positionSize.units : -positionSize.units

        if (isCrypto(pair)) {
            // Kraken execution for crypto
            const krakenResult = await createKrakenMarketOrder({
                pair: instrument,
                side: direction === 'long' ? 'buy' : 'sell',
                volume: Math.abs(units),
            })
            orderId = krakenResult.data?.order_id ?? null
            if (krakenResult.error) {
                console.error(`[AutoExec] ${pair} Kraken execution error:`, krakenResult.error)
            }
        } else {
            // OANDA execution for forex/indices
            const oandaResult = await createMarketOrder({
                instrument,
                units,
                stopLossOnFill: { price: stopLoss.toFixed(dp) },
                takeProfitOnFill: { price: takeProfit1.toFixed(dp) },
                clientExtensions: {
                    comment: `KZ Auto: Tier 1-2-3 ${tier2.confidence}%`,
                    tag: 'killzone_auto',
                },
            })
            orderId = oandaResult.data?.orderFillTransaction?.id ?? null
            if (oandaResult.error) {
                console.error(`[AutoExec] ${pair} OANDA execution error:`, oandaResult.error)
            }
        }

        console.log(`[AutoExec] ${pair} EXECUTED: ${direction.toUpperCase()} ${positionSize.units} units, order ${orderId}`)
    }

    // ═══════════════════════════════════════════════════════════════════
    // Log to database
    // ═══════════════════════════════════════════════════════════════════
    await client.from('killzone_auto_executions').insert({
        pair,
        tier1_regime: tier1.regime,
        tier1_cross_count: tier1.maCrossCount,
        tier1_atr_squeeze: tier1.atrSqueeze,
        tier2_detected: tier2.detected,
        tier2_confidence: tier2.confidence,
        tier2_box_high: tier2.box?.high,
        tier2_box_low: tier2.box?.low,
        tier2_wxy_projection: tier2.wxyProjection?.waveYProjection,
        tier3_triggered: tier3.triggered,
        tier3_spring_volume_ratio: tier3.springCandle?.volumeRatio,
        executed,
        dry_run: config.dryRunMode,
        direction,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit_1: takeProfit1,
        take_profit_2: takeProfit2,
        units: positionSize.units,
        lots: positionSize.lots,
        risk_amount: config.riskAmount,
        order_id: orderId,
        blocked_reason: null,
    })

    return {
        pair,
        tier1,
        tier2,
        tier3,
        execution: {
            executed,
            dryRun: config.dryRunMode,
            direction,
            entryPrice,
            stopLoss,
            takeProfit1,
            takeProfit2,
            positionSize,
            orderId,
            blockedReason: null,
        },
        timestamp,
    }
}
