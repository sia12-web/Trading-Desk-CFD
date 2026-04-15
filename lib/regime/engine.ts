/**
 * Regime Engine — The General / Master Switch
 *
 * Orchestrates the full regime-aware pipeline for one pair:
 *   1. Classify regime → 2. Route to bot → 3. Position size → 4. Execute (or dry-run)
 *
 * Mirrors the `executeInstitutionalProtocol()` pattern from lib/killzone/auto-executor.ts
 * with the same safety gates: dry-run default, daily limits, per-pair cooldowns.
 */

import { getCandles } from '@/lib/data/candle-fetcher'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { detectMarketState } from '@/lib/utils/market-state'
import { detectInstitutionalKillzone, detectKillzone } from '@/lib/utils/killzone-detector'
import { detectOperator } from '@/lib/strategy/operator-detector'
import { calculateLotSize } from '@/lib/risk/position-sizer'
import { validateTrade } from '@/lib/risk/validator'
import { createMarketOrder, getCurrentPrices } from '@/lib/oanda/client'
import { createKrakenMarketOrder } from '@/lib/kraken/client'
import { isCrypto, getAssetConfig } from '@/lib/data/asset-config'
import { createClient } from '@/lib/supabase/server'
import { registerManagedTrade } from '@/lib/trade-monitor/register'

import { classifyRegime } from './classifier'
import { detectMomentum } from './momentum-bot'
import { detectGhostSetup } from './ghost-bot'
import { isNewsBlackout, isGhostWindow, isMarketHours } from './news-guard'
import type {
    RegimeEngineConfig,
    RegimeExecutionDecision,
    RegimeClassification,
    PairRegimeState,
    MomentumSetup,
    GhostSetup,
} from './types'
import type { OperatorSetup } from '@/lib/strategy/operator-detector'
import type { KillzoneSetup, InstitutionalKillzoneSetup } from '@/lib/utils/killzone-detector'

// ═══════════════════════════════════════════════════════════════════════════
// Main Execution Pipeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute the full Regime Protocol for a single pair.
 *
 * Flow:
 *   1. Fetch H1 + M15 candles
 *   2. classifyRegime() → regime + active bot
 *   3. Route to active bot (Trap / Killzone / Momentum)
 *   4. calculateLotSize() → exact position size
 *   5. validateTrade() → risk checks
 *   6. Daily trade limit + per-pair cooldown
 *   7. Execute (or dry-run log)
 *   8. Log to regime_auto_executions table
 */
export async function executeRegimeProtocol(
    pair: string,
    config: RegimeEngineConfig,
    userId: string,
): Promise<RegimeExecutionDecision> {
    const timestamp = new Date().toISOString()
    const instrument = pair.replace('/', '_')
    const assetConfig = getAssetConfig(pair)
    const dp = assetConfig.decimalPlaces

    const emptyDecision = (regime: RegimeClassification, blockedReason: string): RegimeExecutionDecision => ({
        pair,
        regime,
        botUsed: 'none',
        operatorSetup: null,
        killzoneSetup: null,
        momentumSetup: null,
        ghostSetup: null,
        direction: 'none',
        entryPrice: null,
        stopLoss: null,
        takeProfit1: null,
        takeProfit2: null,
        positionSize: null,
        executed: false,
        dryRun: config.dryRunMode,
        orderId: null,
        blockedReason,
        timestamp,
    })

    const emptyRegime: RegimeClassification = {
        regime: 'unknown_dangerous',
        activeBot: 'none',
        indicators: { atrPercentile: 0, adxValue: 0, adxRising: false, donchianCompression: false, donchianExpansion: false, slopesAligned: false, maCrossCount: 0, volumeExpanding: false, spreadWidthRatio: 1.0, cvdErratic: false },
        confidence: 0,
        sizeMultiplier: 0,
        narrative: '',
        classifiedAt: timestamp,
        conditionBlack: false,
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 1: Fetch candles
    // ═══════════════════════════════════════════════════════════════════
    const [h1Response, m15Response] = await Promise.all([
        getCandles({ instrument, granularity: 'H1', count: 100 }),
        getCandles({ instrument, granularity: 'M15', count: 200 }),
    ])

    if (h1Response.error || !h1Response.data || h1Response.data.length < 50) {
        return emptyDecision(emptyRegime, 'Insufficient H1 data')
    }
    if (m15Response.error || !m15Response.data || m15Response.data.length < 60) {
        return emptyDecision(emptyRegime, 'Insufficient M15 data')
    }

    const h1Candles = h1Response.data
    const m15Candles = m15Response.data

    // ═══════════════════════════════════════════════════════════════════
    // Step 1b: Market Hours & Weekend Gate
    // ═══════════════════════════════════════════════════════════════════
    const marketHours = isMarketHours()
    if (!marketHours.open) {
        return emptyDecision(emptyRegime, marketHours.reason || 'Market closed')
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 2a: News Guard — check for Ghost window or blackout
    // ═══════════════════════════════════════════════════════════════════
    const ghostWindow = await isGhostWindow(pair)
    const newsBlackout = await isNewsBlackout(pair)

    // Ghost window active → route to Ghost Bot (Division 3)
    if (ghostWindow.active && config.enableGhostBot) {
        console.log(`[RegimeEngine] ${pair} → GHOST WINDOW (${ghostWindow.event}, ${ghostWindow.minutesSinceEvent}min ago)`)

        // Fetch M1 candles for Ghost detection
        const m1Response = await getCandles({ instrument, granularity: 'M1', count: 30 })
        if (m1Response.error || !m1Response.data || m1Response.data.length < 25) {
            return emptyDecision(emptyRegime, 'Ghost: Insufficient M1 data')
        }

        // Get live spread from OANDA pricing (Operator's Note: spread-adjusted R:R)
        let liveBidAskSpread = 0
        if (!isCrypto(pair)) {
            const pricesResult = await getCurrentPrices([instrument])
            if (pricesResult.data && pricesResult.data.length > 0) {
                const price = pricesResult.data[0]
                const ask = parseFloat(price.asks?.[0]?.price ?? '0')
                const bid = parseFloat(price.bids?.[0]?.price ?? '0')
                liveBidAskSpread = ask - bid
            }
        }

        const ghostSetup = detectGhostSetup(m1Response.data, pair, ghostWindow.event ?? 'Unknown', liveBidAskSpread)
        if (ghostSetup.minutesSinceEvent === null) {
            ghostSetup.minutesSinceEvent = ghostWindow.minutesSinceEvent
        }

        if (!ghostSetup.detected) {
            return { ...emptyDecision(emptyRegime, `Ghost: ${ghostSetup.narrative}`), ghostSetup }
        }

        // Ghost detected — proceed to position sizing (same flow as other bots)
        const direction = ghostSetup.direction as 'long' | 'short'
        const entryPrice = ghostSetup.entryPrice!
        const stopLoss = ghostSetup.stopLoss!
        const takeProfit1 = ghostSetup.takeProfit

        const positionSize = calculateLotSize(entryPrice, stopLoss, config.riskAmount, pair)

        const ghostRegime: RegimeClassification = {
            regime: 'news_chaos',
            activeBot: 'ghost',
            indicators: emptyRegime.indicators,
            confidence: ghostSetup.confidence,
            sizeMultiplier: 1.0,
            narrative: ghostSetup.narrative,
            classifiedAt: timestamp,
            conditionBlack: false,
        }

        // Daily limit check
        const client = await createClient()
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const [{ count: regimeCount }, { count: killzoneCount }] = await Promise.all([
            client.from('regime_auto_executions').select('*', { count: 'exact', head: true }).eq('executed', true).gte('created_at', todayStart.toISOString()),
            client.from('killzone_auto_executions').select('*', { count: 'exact', head: true }).eq('executed', true).gte('created_at', todayStart.toISOString()),
        ])
        if (((regimeCount ?? 0) + (killzoneCount ?? 0)) >= config.maxTradesPerDay) {
            return { ...emptyDecision(ghostRegime, `Daily limit reached`), ghostSetup }
        }

        let orderId: string | null = null
        const executed = !config.dryRunMode

        if (config.dryRunMode) {
            console.log(`[RegimeEngine] ${pair} GHOST DRY RUN: ${direction.toUpperCase()} at ${entryPrice.toFixed(dp)}, SL ${stopLoss.toFixed(dp)}, TP ${takeProfit1?.toFixed(dp)}`)
        } else {
            const units = direction === 'long' ? positionSize.units : -positionSize.units
            // Ghost Bot: keep takeProfitOnFill (1:1 R:R, no split TP — not registered with Trade Monitor)
            const oandaResult = await createMarketOrder({
                instrument,
                units,
                stopLossOnFill: { price: stopLoss.toFixed(dp) },
                takeProfitOnFill: takeProfit1 ? { price: takeProfit1.toFixed(dp) } : undefined,
                clientExtensions: { comment: `Ghost: ${ghostWindow.event} fade`, tag: 'ghost_auto' },
            })
            orderId = oandaResult.data?.orderFillTransaction?.tradeOpened?.tradeID ?? null
        }

        await client.from('regime_auto_executions').insert({
            pair,
            regime: 'news_chaos',
            active_bot: 'ghost',
            regime_confidence: ghostSetup.confidence,
            size_multiplier: 1.0,
            bot_setup_confidence: ghostSetup.confidence,
            executed,
            dry_run: config.dryRunMode,
            direction,
            entry_price: entryPrice,
            stop_loss: stopLoss,
            take_profit_1: takeProfit1,
            take_profit_2: null,
            units: positionSize.units,
            lots: positionSize.lots,
            risk_amount: config.riskAmount,
            order_id: orderId,
            blocked_reason: null,
            ghost_event_name: ghostWindow.event,
            condition_black: false,
        })

        return {
            pair, regime: ghostRegime, botUsed: 'ghost',
            operatorSetup: null, killzoneSetup: null, momentumSetup: null, ghostSetup,
            direction, entryPrice, stopLoss, takeProfit1, takeProfit2: null,
            positionSize, executed, dryRun: config.dryRunMode,
            orderId, blockedReason: null, timestamp,
        }
    }

    // News blackout (not Ghost window) — block Divisions 1 & 2
    if (newsBlackout.blackout) {
        console.log(`[RegimeEngine] ${pair} NEWS BLACKOUT: ${newsBlackout.event}`)
        return emptyDecision(emptyRegime, `News blackout: ${newsBlackout.event} (${newsBlackout.minutesSinceRelease != null ? `${newsBlackout.minutesSinceRelease}min ago` : `in ${newsBlackout.minutesUntilRelease}min`})`)
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 2: Classify Regime
    // ═══════════════════════════════════════════════════════════════════
    const regime = classifyRegime(m15Candles, pair)

    console.log(`[RegimeEngine] ${pair} → ${regime.regime} (${regime.confidence}%) → Bot: ${regime.activeBot}`)

    if (regime.regime === 'unknown_dangerous' || regime.activeBot === 'none') {
        return emptyDecision(regime, `Regime: ${regime.regime} — all bots OFF`)
    }

    if (regime.confidence < config.minConfidence) {
        return emptyDecision(regime, `Regime confidence ${regime.confidence}% below ${config.minConfidence}% threshold`)
    }

    // Check if the active bot is enabled in config
    if (regime.activeBot === 'trap' && !config.enableTrapBot) {
        return emptyDecision(regime, 'Trap Bot disabled in config')
    }
    if (regime.activeBot === 'killzone' && !config.enableKillzoneBot) {
        return emptyDecision(regime, 'Killzone Bot disabled in config')
    }
    if (regime.activeBot === 'momentum' && !config.enableMomentumBot) {
        return emptyDecision(regime, 'Momentum Bot disabled in config')
    }
    if (regime.activeBot === 'ghost' && !config.enableGhostBot) {
        return emptyDecision(regime, 'Ghost Bot disabled in config')
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 3: Route to Active Bot
    // ═══════════════════════════════════════════════════════════════════
    let direction: 'long' | 'short' | 'none' = 'none'
    let entryPrice: number | null = null
    let stopLoss: number | null = null
    let takeProfit1: number | null = null
    let takeProfit2: number | null = null

    let operatorSetup: OperatorSetup | null = null
    let killzoneSetup: KillzoneSetup | InstitutionalKillzoneSetup | null = null
    let momentumSetup: MomentumSetup | null = null
    let ghostSetup: GhostSetup | null = null

    if (regime.activeBot === 'trap') {
        // ── Trap Bot (Operator) ──
        operatorSetup = detectOperator(m15Candles, pair, 'M15')

        if (!operatorSetup.detected || operatorSetup.direction === 'none') {
            return { ...emptyDecision(regime, 'Trap Bot: No operator setup detected'), operatorSetup }
        }

        direction = operatorSetup.direction
        entryPrice = operatorSetup.entryPrice
        stopLoss = operatorSetup.stopLoss
        takeProfit1 = operatorSetup.takeProfit
        // TP2 = 1.5x the TP1 distance
        if (entryPrice && takeProfit1) {
            const tp1Distance = Math.abs(takeProfit1 - entryPrice)
            takeProfit2 = direction === 'long' ? entryPrice + tp1Distance * 1.5 : entryPrice - tp1Distance * 1.5
        }

        console.log(`[RegimeEngine] ${pair} Trap Bot: ${direction.toUpperCase()} at ${entryPrice?.toFixed(dp)}, confidence ${operatorSetup.confidence}%`)

    } else if (regime.activeBot === 'killzone') {
        // ── Killzone Bot ──
        const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
        const h1Rsi = calculateRSI(h1Closes, 14)
        const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
        const waveState = detectH1ElliottWave(h1Candles, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)
        const marketState = detectMarketState(m15Candles)

        killzoneSetup = marketState.proceedToTier2
            ? detectInstitutionalKillzone(waveState, m15Candles, pair, marketState)
            : detectKillzone(waveState, m15Candles, pair)

        if (!killzoneSetup.detected) {
            return { ...emptyDecision(regime, 'Killzone Bot: No killzone detected'), killzoneSetup }
        }

        if (killzoneSetup.confidence < 40) {
            return { ...emptyDecision(regime, `Killzone Bot: Confidence ${killzoneSetup.confidence}% too low`), killzoneSetup }
        }

        const isBullish = killzoneSetup.direction === 'bullish'
        direction = isBullish ? 'long' : 'short'
        entryPrice = killzoneSetup.box?.center ?? null

        if (entryPrice && killzoneSetup.box) {
            const slDistance = killzoneSetup.box.widthPips / (assetConfig.pointMultiplier === 100 ? 100 : 10000)
            stopLoss = isBullish ? entryPrice - slDistance : entryPrice + slDistance
            takeProfit1 = isBullish ? entryPrice + slDistance * 1.0 : entryPrice - slDistance * 1.0
            takeProfit2 = isBullish ? entryPrice + slDistance * 1.618 : entryPrice - slDistance * 1.618
        }

        console.log(`[RegimeEngine] ${pair} Killzone Bot: ${direction.toUpperCase()} at ${entryPrice?.toFixed(dp)}, confidence ${killzoneSetup.confidence}%`)

    } else if (regime.activeBot === 'momentum') {
        // ── Momentum Bot ──
        momentumSetup = detectMomentum(m15Candles, pair)

        if (!momentumSetup.detected || momentumSetup.direction === 'none') {
            return { ...emptyDecision(regime, 'Momentum Bot: No momentum setup detected'), momentumSetup }
        }

        direction = momentumSetup.direction
        entryPrice = momentumSetup.entryPrice
        stopLoss = momentumSetup.stopLoss
        takeProfit1 = momentumSetup.takeProfit1
        takeProfit2 = momentumSetup.takeProfit2

        console.log(`[RegimeEngine] ${pair} Momentum Bot: ${direction.toUpperCase()} at ${entryPrice?.toFixed(dp)}, confidence ${momentumSetup.confidence}%`)
    }

    if (direction === 'none' || !entryPrice || !stopLoss) {
        return emptyDecision(regime, 'No valid trade setup from active bot')
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 4: Position Sizing (adjusted by sizeMultiplier and Bot Type)
    // ═══════════════════════════════════════════════════════════════════
    let scalingFactor = regime.sizeMultiplier
    
    // TRIO: Sniper -> Rider Capital Shift
    // If Sniper (Trap) bot was disabled by ADR (detectOperator would return detected: false with ADR narrative)
    // We should check if we are in a trending regime where Rider (Momentum) is active.
    if (regime.activeBot === 'momentum' && !config.enableTrapBot) {
        // This is a proxy. In a real scenario, we'd check if Sniper *would* have run but was ADR-blocked.
        // For now, we'll boost Rider size if ADR is high.
        const isIndex = pair.includes('NAS') || pair.includes('SPX') || pair.includes('DE30')
        if (isIndex && (regime.indicators.atrPercentile > 0.8)) {
            scalingFactor *= 1.3 // 30% boost to Rider capital
            console.log(`[RegimeEngine] ${pair} ADR BOOST: Shifting Sniper capital to Rider (+30% risk)`)
        }
    }

    // Killzone Speculative Reduction (50% size per AI Trio)
    if (regime.activeBot === 'killzone') {
        scalingFactor *= 0.5
    }

    // TRIO: Rider Re-engagement Rule (50% size if resumed within 6 candles)
    const client = await createClient()
    if (regime.activeBot === 'momentum') {
        const sixCandlesAgo = new Date(Date.now() - 6 * 15 * 60 * 1000).toISOString()
        const { data: recentStopped } = await client
            .from('regime_auto_executions')
            .select('direction, created_at')
            .eq('pair', pair)
            .eq('active_bot', 'momentum')
            .eq('executed', true)
            .gte('created_at', sixCandlesAgo)
            .order('created_at', { ascending: false })
            .limit(1)

        if (recentStopped && recentStopped.length > 0 && recentStopped[0].direction === direction) {
            scalingFactor *= 0.5
            console.log(`[RegimeEngine] ${pair} RE-ENGAGEMENT: 50% size re-entry within 6 candles.`)
        }
    }

    const adjustedRisk = config.riskAmount * scalingFactor
    const positionSize = calculateLotSize(entryPrice, stopLoss, adjustedRisk, pair)

    // ═══════════════════════════════════════════════════════════════════
    // Step 5: Risk Validation
    // ═══════════════════════════════════════════════════════════════════
    const validation = await validateTrade({
        instrument,
        direction,
        units: direction === 'short' ? -positionSize.units : positionSize.units,
        entryPrice,
        stopLoss,
        takeProfit: takeProfit1 ?? undefined,
    }, userId)

    if (!validation.passed) {
        const blockerMsg = validation.blockers.map(b => b.message).join('; ')
        console.log(`[RegimeEngine] ${pair} RISK BLOCKED: ${blockerMsg}`)
        return {
            pair, regime, botUsed: regime.activeBot,
            operatorSetup, killzoneSetup, momentumSetup, ghostSetup,
            direction, entryPrice, stopLoss, takeProfit1, takeProfit2,
            positionSize, executed: false, dryRun: config.dryRunMode,
            orderId: null, blockedReason: `Risk: ${blockerMsg}`, timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 6: Institutional Governors (Circuit Breaker & Limits)
    // ═══════════════════════════════════════════════════════════════════
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // A. Fetch today's executions to check daily loss and division frequency
    const { data: todayExecs } = await client
        .from('regime_auto_executions')
        .select('profit_loss, active_bot, executed')
        .eq('executed', true)
        .gte('created_at', todayStart.toISOString())

    // B. Daily Loss Circuit Breaker (1.5% of $10,000 baseline = $150 loss)
    const totalDailyPL = (todayExecs ?? []).reduce((sum, e) => sum + (e.profit_loss || 0), 0)
    if (totalDailyPL <= -150) {
        console.log(`[RegimeEngine] ${pair} SHUTDOWN: Daily Loss Circuit Breaker triggered ($${totalDailyPL})`)
        return emptyDecision(regime, `Daily loss circuit breaker triggered ($${totalDailyPL})`)
    }

    // C. Divisional Trade Limit (Max 3 per bot per day)
    const botTradeCount = (todayExecs ?? []).filter(e => e.active_bot === regime.activeBot).length
    if (botTradeCount >= 3) {
        console.log(`[RegimeEngine] ${pair} BLOCKED: Division ${regime.activeBot} reached daily limit (${botTradeCount}/3)`)
        return emptyDecision(regime, `Division ${regime.activeBot} daily trade limit reached`)
    }

    const totalTodayTrades = (todayExecs ?? []).length
    if (totalTodayTrades >= config.maxTradesPerDay) {
        console.log(`[RegimeEngine] ${pair} BLOCKED: Daily limit (${totalTodayTrades}/${config.maxTradesPerDay})`)
        return {
            pair, regime, botUsed: regime.activeBot,
            operatorSetup, killzoneSetup, momentumSetup, ghostSetup,
            direction, entryPrice, stopLoss, takeProfit1, takeProfit2,
            positionSize, executed: false, dryRun: config.dryRunMode,
            orderId: null, blockedReason: `Daily limit: ${totalTodayTrades}/${config.maxTradesPerDay}`, timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 7: Per-Pair Cooldown
    // ═══════════════════════════════════════════════════════════════════
    const cooldownAgo = new Date(Date.now() - config.cooldownMinutes * 60 * 1000).toISOString()
    const { count: recentPairTrades } = await client
        .from('regime_auto_executions')
        .select('*', { count: 'exact', head: true })
        .eq('pair', pair)
        .eq('executed', true)
        .gte('created_at', cooldownAgo)

    if ((recentPairTrades ?? 0) > 0) {
        console.log(`[RegimeEngine] ${pair} BLOCKED: ${config.cooldownMinutes}-min cooldown active`)
        return {
            pair, regime, botUsed: regime.activeBot,
            operatorSetup, killzoneSetup, momentumSetup, ghostSetup,
            direction, entryPrice, stopLoss, takeProfit1, takeProfit2,
            positionSize, executed: false, dryRun: config.dryRunMode,
            orderId: null, blockedReason: `${config.cooldownMinutes}-min cooldown active`, timestamp,
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 8: Execute (or Dry Run)
    // ═══════════════════════════════════════════════════════════════════
    let orderId: string | null = null
    const executed = !config.dryRunMode

    if (config.dryRunMode) {
        console.log(`[RegimeEngine] ${pair} DRY RUN: Would ${direction.toUpperCase()} ${positionSize.units} units at ${entryPrice.toFixed(dp)}, SL ${stopLoss.toFixed(dp)}, TP1 ${takeProfit1?.toFixed(dp)}, TP2 ${takeProfit2?.toFixed(dp)} [${regime.activeBot} bot]`)
    } else {
        const units = direction === 'long' ? positionSize.units : -positionSize.units

        if (isCrypto(pair)) {
            const krakenResult = await createKrakenMarketOrder({
                pair: instrument,
                side: direction === 'long' ? 'buy' : 'sell',
                volume: Math.abs(units),
            })
            orderId = krakenResult.data?.order_id ?? null
            if (krakenResult.error) {
                console.error(`[RegimeEngine] ${pair} Kraken error:`, krakenResult.error)
            }
        } else {
            // Operator's Note #2: format trailingStopDistance to pair-specific decimal precision
            // OANDA rejects raw floats — must match pair's decimal places exactly
            const trailingStopOnFill = (regime.activeBot === 'momentum' && momentumSetup?.trailingStopDistance)
                ? { distance: momentumSetup.trailingStopDistance.toFixed(dp) }
                : undefined

            // No takeProfitOnFill — Trade Monitor manages TP1/TP2 split lifecycle
            const oandaResult = await createMarketOrder({
                instrument,
                units,
                stopLossOnFill: { price: stopLoss.toFixed(dp) },
                trailingStopLossOnFill: trailingStopOnFill,
                clientExtensions: {
                    comment: `Regime: ${regime.regime} → ${regime.activeBot} (${regime.confidence}%)`,
                    tag: 'regime_auto',
                },
            })
            orderId = oandaResult.data?.orderFillTransaction?.tradeOpened?.tradeID ?? null
            if (oandaResult.error) {
                console.error(`[RegimeEngine] ${pair} OANDA error:`, oandaResult.error)
            }
        }

        console.log(`[RegimeEngine] ${pair} EXECUTED: ${direction.toUpperCase()} ${positionSize.units} units [${regime.activeBot}], order ${orderId}`)
    }

    // ═══════════════════════════════════════════════════════════════════
    // Step 9: Log to Database
    // ═══════════════════════════════════════════════════════════════════
    const { data: insertedExec } = await client.from('regime_auto_executions').insert({
        pair,
        regime: regime.regime,
        active_bot: regime.activeBot,
        regime_confidence: regime.confidence,
        size_multiplier: regime.sizeMultiplier,
        bot_setup_confidence: (operatorSetup?.confidence ?? killzoneSetup?.confidence ?? momentumSetup?.confidence ?? 0),
        executed,
        dry_run: config.dryRunMode,
        direction,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit_1: takeProfit1,
        take_profit_2: takeProfit2,
        units: positionSize.units,
        lots: positionSize.lots,
        risk_amount: adjustedRisk,
        order_id: orderId,
        blocked_reason: null,
        condition_black: regime.conditionBlack,
        trailing_stop_distance: momentumSetup?.trailingStopDistance ?? null,
    }).select('id').single()

    // Register for Trade Monitor lifecycle management (TP1 partial close → breakeven → TP2)
    if (executed && orderId && !isCrypto(pair) && insertedExec && takeProfit1 && takeProfit2) {
        await registerManagedTrade({
            source: 'regime',
            sourceExecutionId: insertedExec.id,
            oandaTradeId: orderId,
            pair,
            instrument,
            direction: direction as 'long' | 'short',
            entryPrice,
            stopLoss,
            takeProfit1,
            takeProfit2,
            units: positionSize.units,
        })
    }

    return {
        pair, regime, botUsed: regime.activeBot,
        operatorSetup, killzoneSetup, momentumSetup, ghostSetup,
        direction, entryPrice, stopLoss, takeProfit1, takeProfit2,
        positionSize, executed, dryRun: config.dryRunMode,
        orderId, blockedReason: null, timestamp,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Lightweight Scan (no execution)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scan a single pair for regime + bot setup. Does NOT execute.
 * Used by the scanner and cron job for monitoring/display.
 */
export async function scanPairForRegime(pair: string): Promise<PairRegimeState> {
    const instrument = pair.replace('/', '_')
    const scannedAt = new Date().toISOString()

    const emptyRegime: RegimeClassification = {
        regime: 'unknown_dangerous', activeBot: 'none',
        indicators: { atrPercentile: 0, adxValue: 0, adxRising: false, donchianCompression: false, donchianExpansion: false, slopesAligned: false, maCrossCount: 0, volumeExpanding: false, spreadWidthRatio: 1.0, cvdErratic: false },
        confidence: 0, sizeMultiplier: 0, narrative: '', classifiedAt: scannedAt, conditionBlack: false,
    }

    try {
        const [h1Response, m15Response] = await Promise.all([
            getCandles({ instrument, granularity: 'H1', count: 100 }),
            getCandles({ instrument, granularity: 'M15', count: 200 }),
        ])

        if (h1Response.error || !h1Response.data || h1Response.data.length < 50 ||
            m15Response.error || !m15Response.data || m15Response.data.length < 60) {
            return { pair, success: false, error: 'Insufficient data', regime: emptyRegime, botSetup: { trap: null, killzone: null, momentum: null, ghost: null }, bestSetup: null, scannedAt }
        }

        const h1Candles = h1Response.data
        const m15Candles = m15Response.data

        // Classify regime
        const regime = classifyRegime(m15Candles, pair)

        // Run all bots (for monitoring — shows what each would detect)
        const trapSetup = detectOperator(m15Candles, pair, 'M15')
        const momentumSetupResult = detectMomentum(m15Candles, pair)

        // Killzone needs H1 Elliott Wave
        let killzoneResult: KillzoneSetup | InstitutionalKillzoneSetup | null = null
        try {
            const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
            const h1Rsi = calculateRSI(h1Closes, 14)
            const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
            const waveState = detectH1ElliottWave(h1Candles, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)
            const marketState = detectMarketState(m15Candles)

            killzoneResult = marketState.proceedToTier2
                ? detectInstitutionalKillzone(waveState, m15Candles, pair, marketState)
                : detectKillzone(waveState, m15Candles, pair)
        } catch {
            // Killzone detection failed — not critical for scan
        }

        // Determine best setup from active bot
        let bestSetup: PairRegimeState['bestSetup'] = null

        if (regime.activeBot === 'trap' && trapSetup.detected) {
            bestSetup = {
                detected: true, botUsed: 'trap', direction: trapSetup.direction,
                confidence: trapSetup.confidence, entryPrice: trapSetup.entryPrice,
                stopLoss: trapSetup.stopLoss, takeProfit1: trapSetup.takeProfit, takeProfit2: null,
            }
        } else if (regime.activeBot === 'momentum' && momentumSetupResult.detected) {
            bestSetup = {
                detected: true, botUsed: 'momentum', direction: momentumSetupResult.direction,
                confidence: momentumSetupResult.confidence, entryPrice: momentumSetupResult.entryPrice,
                stopLoss: momentumSetupResult.stopLoss, takeProfit1: momentumSetupResult.takeProfit1, takeProfit2: momentumSetupResult.takeProfit2,
            }
        } else if (regime.activeBot === 'killzone' && killzoneResult?.detected) {
            bestSetup = {
                detected: true, botUsed: 'killzone', direction: killzoneResult.direction === 'bullish' ? 'long' : 'short',
                confidence: killzoneResult.confidence, entryPrice: killzoneResult.box?.center ?? null,
                stopLoss: null, takeProfit1: null, takeProfit2: null,
            }
        }

        return {
            pair, success: true, regime,
            botSetup: { trap: trapSetup, killzone: killzoneResult, momentum: momentumSetupResult, ghost: null },
            bestSetup, scannedAt,
        }
    } catch (error) {
        return {
            pair, success: false, error: error instanceof Error ? error.message : String(error),
            regime: emptyRegime, botSetup: { trap: null, killzone: null, momentum: null, ghost: null },
            bestSetup: null, scannedAt,
        }
    }
}
