import { createClient } from '@/lib/supabase/server'
import { getActiveAccountId } from '@/lib/oanda/account'
import { getOpenTradesForSync, getTradeHistoryForSync } from '@/lib/oanda/client'
import { calculatePips } from '@/lib/utils/forex'
import { OandaTrade } from '@/lib/types/oanda'

export interface SyncResult {
    openImported: number
    closedImported: number
    closedUpdated: number
    skipped: number
    errors: { tradeId: string; error: string }[]
}

function parseOandaTrade(oTrade: OandaTrade) {
    const pair = oTrade.instrument.replace('_', '/')
    const units = Math.abs(parseFloat(oTrade.initialUnits || oTrade.currentUnits))
    const direction = parseFloat(oTrade.initialUnits || oTrade.currentUnits) > 0 ? 'long' : 'short'
    const entryPrice = parseFloat(oTrade.price)
    const exitPrice = oTrade.averageClosePrice ? parseFloat(oTrade.averageClosePrice) : null
    const lotSize = units / 100000

    return { pair, units, direction, entryPrice, exitPrice, lotSize }
}

export async function syncOandaTrades(userId: string): Promise<SyncResult> {
    const supabase = await createClient()
    const accountId = await getActiveAccountId()
    const result: SyncResult = {
        openImported: 0,
        closedImported: 0,
        closedUpdated: 0,
        skipped: 0,
        errors: []
    }

    // Get reset timestamp AND last sync timestamp to filter old trades
    const { data: profile } = await supabase
        .from('trader_profile')
        .select('last_demo_reset_at, last_sync_at')
        .eq('user_id', userId)
        .single()

    const resetCutoff = profile?.last_demo_reset_at ? new Date(profile.last_demo_reset_at) : null
    const syncCutoff = profile?.last_sync_at ? new Date(profile.last_sync_at) : null

    // FIRST SYNC EVER: Set sync timestamp to NOW and return without importing
    // This prevents importing ALL historical trades on first click
    if (!syncCutoff && !resetCutoff) {
        await supabase
            .from('trader_profile')
            .upsert({
                user_id: userId,
                last_sync_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })

        return {
            openImported: 0,
            closedImported: 0,
            closedUpdated: 0,
            skipped: 0,
            errors: []
        }
    }

    // Use the most recent cutoff (whichever is later)
    const effectiveCutoff = resetCutoff && syncCutoff
        ? (resetCutoff > syncCutoff ? resetCutoff : syncCutoff)
        : (resetCutoff || syncCutoff)

    // 1. Fetch from OANDA (no cache)
    const [openResult, closedResult] = await Promise.all([
        getOpenTradesForSync(),
        getTradeHistoryForSync(500)
    ])

    if (openResult.error) {
        throw new Error(`Failed to fetch open trades: ${JSON.stringify(openResult.error)}`)
    }
    if (closedResult.error) {
        throw new Error(`Failed to fetch closed trades: ${JSON.stringify(closedResult.error)}`)
    }

    // Filter out trades that were opened before the effective cutoff (reset or last sync)
    const filterByDate = (trades: OandaTrade[]) => {
        if (!effectiveCutoff) return trades
        return trades.filter(t => {
            const openTime = new Date(t.openTime)
            return openTime >= effectiveCutoff
        })
    }

    const oandaOpenTrades = filterByDate(openResult.data)
    const oandaClosedTrades = filterByDate(closedResult.data)

    // 2. Load all local trades with oanda_trade_id
    const { data: localTrades, error: localErr } = await supabase
        .from('trades')
        .select('id, oanda_trade_id, status, source')
        .eq('user_id', userId)
        .eq('oanda_account_id', accountId)
        .not('oanda_trade_id', 'is', null)

    if (localErr) {
        throw new Error(`Failed to fetch local trades: ${localErr.message}`)
    }

    const localByOandaId = new Map(
        (localTrades || []).map(t => [t.oanda_trade_id, t])
    )

    // 3. Process OPEN trades
    for (const oTrade of oandaOpenTrades) {
        const existing = localByOandaId.get(oTrade.id)
        if (existing) {
            result.skipped++
            continue
        }

        try {
            const { pair, direction, entryPrice, lotSize } = parseOandaTrade(oTrade)

            const { data: newTrade, error: insertErr } = await supabase
                .from('trades')
                .insert({
                    user_id: userId,
                    oanda_account_id: accountId,
                    pair,
                    direction,
                    entry_price: entryPrice,
                    stop_loss: oTrade.stopLossOrder ? parseFloat(oTrade.stopLossOrder.price) : null,
                    take_profit: oTrade.takeProfitOrder ? parseFloat(oTrade.takeProfitOrder.price) : null,
                    lot_size: lotSize,
                    status: 'open',
                    oanda_trade_id: oTrade.id,
                    source: 'external',
                    opened_at: oTrade.openTime
                })
                .select('id')
                .single()

            if (insertErr || !newTrade) {
                result.errors.push({ tradeId: oTrade.id, error: insertErr?.message || 'Insert failed' })
            } else {
                result.openImported++

                const { error: logErr } = await supabase.from('execution_log').insert({
                    user_id: userId,
                    oanda_account_id: accountId,
                    action: 'sync_import',
                    trade_id: newTrade.id,
                    oanda_trade_id: oTrade.id,
                    request_payload: { source: 'oanda_sync', type: 'open_trade' },
                    response_payload: oTrade,
                    status: 'success'
                })
                if (logErr) console.error('Execution log insert failed:', logErr.message)
            }
        } catch (e: any) {
            result.errors.push({ tradeId: oTrade.id, error: e.message })
        }
    }

    // 4. Process CLOSED trades
    for (const oTrade of oandaClosedTrades) {
        const existing = localByOandaId.get(oTrade.id)

        // Already fully synced
        if (existing && existing.status === 'closed') {
            result.skipped++
            continue
        }

        // Was open locally, now closed on OANDA
        if (existing && existing.status === 'open') {
            try {
                const { pair, direction, entryPrice, exitPrice } = parseOandaTrade(oTrade)
                const finalExit = exitPrice || entryPrice

                await supabase
                    .from('trades')
                    .update({
                        status: 'closed',
                        exit_price: finalExit,
                        closed_at: oTrade.closeTime || new Date().toISOString()
                    })
                    .eq('id', existing.id)

                const pips = calculatePips(entryPrice, finalExit, direction as 'long' | 'short', pair)
                const financing = parseFloat(oTrade.financing || '0')

                await supabase.from('trade_pnl').insert({
                    trade_id: existing.id,
                    user_id: userId,
                    pnl_amount: parseFloat(oTrade.realizedPL),
                    pnl_pips: parseFloat(pips.toFixed(1)),
                    fees: Math.abs(financing),
                    notes: 'Auto-synced from OANDA',
                    recorded_at: oTrade.closeTime || new Date().toISOString()
                })

                const { error: logErr } = await supabase.from('execution_log').insert({
                    user_id: userId,
                    oanda_account_id: accountId,
                    action: 'sync_close',
                    trade_id: existing.id,
                    oanda_trade_id: oTrade.id,
                    request_payload: { source: 'oanda_sync', type: 'close_update' },
                    response_payload: oTrade,
                    status: 'success'
                })
                if (logErr) console.error('Execution log insert failed:', logErr.message)

                result.closedUpdated++
            } catch (e: any) {
                result.errors.push({ tradeId: oTrade.id, error: e.message })
            }
            continue
        }

        // Brand new closed trade we never knew about
        if (!existing) {
            try {
                const { pair, direction, entryPrice, exitPrice, lotSize } = parseOandaTrade(oTrade)
                const finalExit = exitPrice || entryPrice

                const { data: newTrade, error: insertErr } = await supabase
                    .from('trades')
                    .insert({
                        user_id: userId,
                        oanda_account_id: accountId,
                        pair,
                        direction,
                        entry_price: entryPrice,
                        exit_price: finalExit,
                        lot_size: lotSize,
                        status: 'closed',
                        oanda_trade_id: oTrade.id,
                        source: 'external',
                        opened_at: oTrade.openTime,
                        closed_at: oTrade.closeTime || new Date().toISOString()
                    })
                    .select('id')
                    .single()

                if (insertErr || !newTrade) {
                    result.errors.push({ tradeId: oTrade.id, error: insertErr?.message || 'Insert failed' })
                    continue
                }

                const pips = calculatePips(entryPrice, finalExit, direction as 'long' | 'short', pair)
                const financing = parseFloat(oTrade.financing || '0')

                await supabase.from('trade_pnl').insert({
                    trade_id: newTrade.id,
                    user_id: userId,
                    pnl_amount: parseFloat(oTrade.realizedPL),
                    pnl_pips: parseFloat(pips.toFixed(1)),
                    fees: Math.abs(financing),
                    notes: 'Imported from OANDA sync',
                    recorded_at: oTrade.closeTime || new Date().toISOString()
                })

                const { error: logErr } = await supabase.from('execution_log').insert({
                    user_id: userId,
                    oanda_account_id: accountId,
                    action: 'sync_import',
                    trade_id: newTrade.id,
                    oanda_trade_id: oTrade.id,
                    request_payload: { source: 'oanda_sync', type: 'closed_trade' },
                    response_payload: oTrade,
                    status: 'success'
                })
                if (logErr) console.error('Execution log insert failed:', logErr.message)

                result.closedImported++
            } catch (e: any) {
                result.errors.push({ tradeId: oTrade.id, error: e.message })
            }
        }
    }

    // 5. Log the sync event
    await supabase.from('trade_sync_log').insert({
        user_id: userId,
        oanda_account_id: accountId,
        open_imported: result.openImported,
        closed_imported: result.closedImported,
        closed_updated: result.closedUpdated,
        errors: result.errors
    })

    // 6. Update last_sync_at timestamp (for next sync to start from this point)
    await supabase
        .from('trader_profile')
        .upsert({
            user_id: userId,
            last_sync_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        })

    return result
}
