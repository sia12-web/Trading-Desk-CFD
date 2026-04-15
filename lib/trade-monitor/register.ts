/**
 * Trade Monitor — Registration
 *
 * Called by auto-executors after a successful OANDA order fill.
 * Inserts into managed_trades so the monitor can track TP1/TP2 lifecycle.
 */

import { createClient } from '@/lib/supabase/server'
import type { ManagedTradeSource } from './types'

export interface RegisterManagedTradeParams {
    source: ManagedTradeSource
    sourceExecutionId: string
    oandaTradeId: string
    pair: string
    instrument: string
    direction: 'long' | 'short'
    entryPrice: number
    stopLoss: number
    takeProfit1: number
    takeProfit2: number
    units: number
}

export async function registerManagedTrade(
    params: RegisterManagedTradeParams
): Promise<{ id: string | null; error?: string }> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('managed_trades')
            .insert({
                source: params.source,
                source_execution_id: params.sourceExecutionId,
                oanda_trade_id: params.oandaTradeId,
                pair: params.pair,
                instrument: params.instrument,
                direction: params.direction,
                entry_price: params.entryPrice,
                stop_loss: params.stopLoss,
                original_stop_loss: params.stopLoss,
                take_profit_1: params.takeProfit1,
                take_profit_2: params.takeProfit2,
                initial_units: params.units,
                current_units: params.units,
                status: 'open',
            })
            .select('id')
            .single()

        if (error) {
            console.error('[TradeMonitor] Failed to register managed trade:', error.message)
            return { id: null, error: error.message }
        }

        console.log(`[TradeMonitor] Registered ${params.pair} (OANDA: ${params.oandaTradeId}) → managed_trade ${data.id}`)
        return { id: data.id }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[TradeMonitor] Registration exception:', msg)
        return { id: null, error: msg }
    }
}
