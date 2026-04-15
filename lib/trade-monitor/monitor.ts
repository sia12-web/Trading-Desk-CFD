/**
 * Trade Monitor — Split TP1/TP2 Lifecycle Management
 *
 * Runs every 1 minute via the tactical-heartbeat cron.
 *
 * For each active managed trade:
 *  - Status='open' + TP1 hit → partial close 50%, move SL to breakeven, set TP2 on OANDA
 *  - Status='tp1_partial_closed' + TP2 hit → close remaining 50%
 *  - Trade missing from OANDA → mark stopped_out or manually_closed
 *
 * Uses OANDA's:
 *  - closeTrade(tradeId, units) for partial close
 *  - modifyTrade(tradeId, { stopLoss, takeProfit }) for breakeven + TP2
 *  - getOpenTrades() + getCurrentPrices() for monitoring
 */

import { createClient } from '@/lib/supabase/server'
import { getOpenTrades, getCurrentPrices, closeTrade, modifyTrade } from '@/lib/oanda/client'
import { getAssetConfig } from '@/lib/data/asset-config'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import type { OandaPrice } from '@/lib/types/oanda'
import type { ManagedTrade, MonitorAction, MonitorSummary } from './types'

const EMPTY_SUMMARY: MonitorSummary = {
    checked: 0, tp1_closes: 0, tp2_closes: 0, breakeven_moves: 0,
    stopped_out: 0, manually_closed: 0, errors: 0,
    actions: [], duration_ms: 0,
}

export async function monitorManagedTrades(): Promise<MonitorSummary> {
    const startTime = Date.now()
    const actions: MonitorAction[] = []
    const summary = { tp1_closes: 0, tp2_closes: 0, breakeven_moves: 0, stopped_out: 0, manually_closed: 0, errors: 0 }

    const supabase = await createClient()

    // Step 1: Query active managed trades
    const { data: activeTrades, error: queryError } = await supabase
        .from('managed_trades')
        .select('*')
        .in('status', ['open', 'tp1_partial_closed'])

    if (queryError || !activeTrades || activeTrades.length === 0) {
        return { ...EMPTY_SUMMARY, duration_ms: Date.now() - startTime }
    }

    // Step 2: Batch-fetch OANDA prices for all unique instruments
    const uniqueInstruments = [...new Set(activeTrades.map((t: ManagedTrade) => t.instrument))]
    const { data: prices } = await getCurrentPrices(uniqueInstruments)

    if (!prices) {
        console.error('[TradeMonitor] Failed to fetch prices')
        return { ...EMPTY_SUMMARY, checked: activeTrades.length, errors: 1, duration_ms: Date.now() - startTime }
    }

    const priceMap = new Map<string, OandaPrice>()
    for (const p of prices) {
        priceMap.set(p.instrument, p)
    }

    // Step 3: Fetch open OANDA trades to check existence
    const { data: oandaOpenTrades } = await getOpenTrades()
    const oandaTradeIds = new Set((oandaOpenTrades ?? []).map(t => t.id))

    // Step 4: Process each managed trade
    for (const trade of activeTrades as ManagedTrade[]) {
        try {
            // 4a: Check if trade still exists on OANDA
            if (!oandaTradeIds.has(trade.oanda_trade_id)) {
                const action = await handleMissingTrade(supabase, trade, priceMap)
                actions.push(action)
                if (action.action === 'mark_stopped_out') summary.stopped_out++
                else if (action.action === 'mark_manually_closed') summary.manually_closed++
                continue
            }

            const price = priceMap.get(trade.instrument)
            if (!price) continue

            const bid = parseFloat(price.bids?.[0]?.price ?? '0')
            const ask = parseFloat(price.asks?.[0]?.price ?? '0')
            if (bid === 0 || ask === 0) continue

            // 4b: Status='open' → check TP1
            if (trade.status === 'open') {
                // Also check if breakeven was not set on a previous tp1 partial close
                // (edge case: partial close succeeded but modifyTrade failed)
                if (isTPHit(trade.direction, bid, ask, trade.take_profit_1)) {
                    const action = await handleTP1Hit(supabase, trade)
                    actions.push(action)
                    if (action.success) {
                        summary.tp1_closes++
                        summary.breakeven_moves++
                    } else {
                        summary.errors++
                    }
                }
            }

            // 4c: Status='tp1_partial_closed' → check TP2, also retry breakeven if it failed before
            else if (trade.status === 'tp1_partial_closed') {
                // Retry breakeven move if it failed on the TP1 cycle
                if (!trade.breakeven_moved_at) {
                    await retryBreakevenMove(supabase, trade)
                }

                if (isTPHit(trade.direction, bid, ask, trade.take_profit_2)) {
                    const action = await handleTP2Hit(supabase, trade)
                    actions.push(action)
                    if (action.success) {
                        summary.tp2_closes++
                    } else {
                        summary.errors++
                    }
                }
            }
        } catch (err) {
            console.error(`[TradeMonitor] Error on ${trade.pair} (${trade.oanda_trade_id}):`, err)
            summary.errors++
        }
    }

    // Step 5: Telegram alerts
    if (actions.length > 0) {
        await sendMonitorAlerts(supabase, actions)
    }

    const result: MonitorSummary = {
        checked: activeTrades.length,
        ...summary,
        actions,
        duration_ms: Date.now() - startTime,
    }

    if (actions.length > 0) {
        console.log(`[TradeMonitor] ${actions.length} actions: ${summary.tp1_closes} TP1, ${summary.tp2_closes} TP2, ${summary.breakeven_moves} BE, ${summary.stopped_out} SL, ${summary.errors} errors`)
    }

    return result
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function isTPHit(direction: 'long' | 'short', bid: number, ask: number, tpLevel: number): boolean {
    if (direction === 'long') {
        return bid >= tpLevel   // Sell at bid
    } else {
        return ask <= tpLevel   // Buy at ask
    }
}

// ── TP1 Hit Handler ──

async function handleTP1Hit(supabase: Awaited<ReturnType<typeof createClient>>, trade: ManagedTrade): Promise<MonitorAction> {
    const dp = getAssetConfig(trade.pair).decimalPlaces
    const now = new Date().toISOString()
    const unitsToClose = Math.floor(trade.initial_units / 2)

    console.log(`[TradeMonitor] TP1 HIT ${trade.pair}: closing ${unitsToClose}/${trade.current_units} units`)

    // Step 1: Partial close 50%
    const closeResult = await closeTrade(trade.oanda_trade_id, unitsToClose.toString())

    if (closeResult.error) {
        console.error(`[TradeMonitor] TP1 partial close FAILED ${trade.oanda_trade_id}:`, closeResult.error)
        return {
            tradeId: trade.id, pair: trade.pair,
            action: 'tp1_partial_close', success: false,
            error: `Partial close failed: ${JSON.stringify(closeResult.error)}`,
        }
    }

    const tp1Pnl = parseFloat(closeResult.data?.orderFillTransaction?.pl ?? '0')
    const tp1ClosePrice = parseFloat(closeResult.data?.orderFillTransaction?.price ?? '0')

    // Step 2: Move SL to breakeven + set TP2 on OANDA
    let breakevenSuccess = false
    try {
        const modifyResult = await modifyTrade(trade.oanda_trade_id, {
            stopLoss: { price: trade.entry_price.toFixed(dp) },
            takeProfit: { price: trade.take_profit_2.toFixed(dp) },
        })
        breakevenSuccess = !modifyResult.error
        if (modifyResult.error) {
            console.error(`[TradeMonitor] Breakeven move FAILED ${trade.oanda_trade_id}:`, modifyResult.error)
        }
    } catch (err) {
        console.error(`[TradeMonitor] Breakeven modify exception:`, err)
    }

    // Step 3: Update DB
    const remainingUnits = trade.current_units - unitsToClose

    await supabase
        .from('managed_trades')
        .update({
            status: 'tp1_partial_closed',
            current_units: remainingUnits,
            tp1_hit_at: now,
            tp1_close_price: tp1ClosePrice || trade.take_profit_1,
            tp1_units_closed: unitsToClose,
            tp1_pnl: tp1Pnl,
            stop_loss: breakevenSuccess ? trade.entry_price : trade.stop_loss,
            breakeven_moved_at: breakevenSuccess ? now : null,
            updated_at: now,
        })
        .eq('id', trade.id)

    return {
        tradeId: trade.id, pair: trade.pair,
        action: 'tp1_partial_close', success: true,
        details: `Closed ${unitsToClose} units at ${tp1ClosePrice.toFixed(dp)}, PnL $${tp1Pnl.toFixed(2)}. SL→BE: ${breakevenSuccess ? 'OK' : 'FAILED'}. TP→TP2: ${trade.take_profit_2.toFixed(dp)}`,
    }
}

// ── TP2 Hit Handler ──

async function handleTP2Hit(supabase: Awaited<ReturnType<typeof createClient>>, trade: ManagedTrade): Promise<MonitorAction> {
    const dp = getAssetConfig(trade.pair).decimalPlaces
    const now = new Date().toISOString()

    console.log(`[TradeMonitor] TP2 HIT ${trade.pair}: closing remaining ${trade.current_units} units`)

    const closeResult = await closeTrade(trade.oanda_trade_id, 'ALL')

    if (closeResult.error) {
        console.error(`[TradeMonitor] TP2 close FAILED ${trade.oanda_trade_id}:`, closeResult.error)
        return {
            tradeId: trade.id, pair: trade.pair,
            action: 'tp2_close', success: false,
            error: `Close failed: ${JSON.stringify(closeResult.error)}`,
        }
    }

    const tp2Pnl = parseFloat(closeResult.data?.orderFillTransaction?.pl ?? '0')
    const tp2ClosePrice = parseFloat(closeResult.data?.orderFillTransaction?.price ?? '0')
    const totalPnl = (trade.tp1_pnl ?? 0) + tp2Pnl

    await supabase
        .from('managed_trades')
        .update({
            status: 'tp2_closed',
            current_units: 0,
            tp2_hit_at: now,
            tp2_close_price: tp2ClosePrice || trade.take_profit_2,
            tp2_pnl: tp2Pnl,
            final_pnl: totalPnl,
            updated_at: now,
        })
        .eq('id', trade.id)

    return {
        tradeId: trade.id, pair: trade.pair,
        action: 'tp2_close', success: true,
        details: `Closed ${trade.current_units} units at ${tp2ClosePrice.toFixed(dp)}, PnL $${tp2Pnl.toFixed(2)}. Total PnL: $${totalPnl.toFixed(2)}`,
    }
}

// ── Missing Trade Handler ──

async function handleMissingTrade(
    supabase: Awaited<ReturnType<typeof createClient>>,
    trade: ManagedTrade,
    priceMap: Map<string, OandaPrice>
): Promise<MonitorAction> {
    const now = new Date().toISOString()
    const price = priceMap.get(trade.instrument)

    // Heuristic: if price is past SL in the losing direction, likely stopped out
    let likelyStopped = false
    if (price) {
        const mid = (parseFloat(price.bids?.[0]?.price ?? '0') + parseFloat(price.asks?.[0]?.price ?? '0')) / 2
        if (trade.direction === 'long') {
            likelyStopped = mid <= trade.stop_loss
        } else {
            likelyStopped = mid >= trade.stop_loss
        }
    }

    const newStatus = likelyStopped ? 'stopped_out' as const : 'manually_closed' as const

    console.log(`[TradeMonitor] ${trade.pair} (${trade.oanda_trade_id}) GONE from OANDA → ${newStatus}`)

    await supabase
        .from('managed_trades')
        .update({
            status: newStatus,
            current_units: 0,
            updated_at: now,
        })
        .eq('id', trade.id)

    return {
        tradeId: trade.id, pair: trade.pair,
        action: likelyStopped ? 'mark_stopped_out' : 'mark_manually_closed',
        success: true,
        details: `Trade no longer on OANDA. Marked as ${newStatus}.`,
    }
}

// ── Retry Breakeven Move ──

async function retryBreakevenMove(
    supabase: Awaited<ReturnType<typeof createClient>>,
    trade: ManagedTrade
): Promise<void> {
    const dp = getAssetConfig(trade.pair).decimalPlaces
    try {
        const result = await modifyTrade(trade.oanda_trade_id, {
            stopLoss: { price: trade.entry_price.toFixed(dp) },
            takeProfit: { price: trade.take_profit_2.toFixed(dp) },
        })
        if (!result.error) {
            await supabase
                .from('managed_trades')
                .update({
                    stop_loss: trade.entry_price,
                    breakeven_moved_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', trade.id)
            console.log(`[TradeMonitor] Breakeven retry SUCCESS for ${trade.pair}`)
        }
    } catch {
        // Will retry next cycle
    }
}

// ── Telegram Alerts ──

async function sendMonitorAlerts(
    supabase: Awaited<ReturnType<typeof createClient>>,
    actions: MonitorAction[]
): Promise<void> {
    const successful = actions.filter(a => a.success)
    if (successful.length === 0) return

    try {
        const { data: users } = await supabase
            .from('notification_preferences')
            .select('telegram_chat_id')
            .or('regime_alerts_enabled.eq.true,killzone_alerts_enabled.eq.true')
            .not('telegram_chat_id', 'is', null)

        if (!users || users.length === 0) return

        for (const action of successful) {
            const emoji = action.action === 'tp1_partial_close' ? '🎯'
                : action.action === 'tp2_close' ? '🏆'
                : action.action === 'mark_stopped_out' ? '🛑'
                : '📋'

            const title = `${emoji} Trade Monitor: ${action.pair}`
            const body = action.details ?? action.action

            for (const user of users) {
                try {
                    await sendTelegramMessage(user.telegram_chat_id, title, body)
                } catch { /* non-critical */ }
            }
        }
    } catch { /* non-critical */ }
}
