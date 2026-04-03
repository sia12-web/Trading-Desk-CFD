import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveAccountId } from '@/lib/oanda/account'

/**
 * Backfill execution log with all existing trades
 * This is useful for importing TradingView trades or historical data
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = await createClient()
        const accountId = await getActiveAccountId()

        // Get all trades that don't have execution_log entries
        const { data: allTrades, error: tradesError } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        if (tradesError) {
            console.error('Error fetching trades:', tradesError)
            return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 })
        }

        if (!allTrades || allTrades.length === 0) {
            return NextResponse.json({
                message: 'No trades found to backfill',
                imported: 0,
                skipped: 0
            })
        }

        // Get existing execution log entries
        const { data: existingLogs } = await supabase
            .from('execution_log')
            .select('trade_id')
            .eq('user_id', user.id)

        const existingTradeIds = new Set(existingLogs?.map(log => log.trade_id).filter(Boolean) || [])

        let imported = 0
        let skipped = 0
        const errors: any[] = []

        // Backfill each trade
        for (const trade of allTrades) {
            // Skip if already in execution log
            if (existingTradeIds.has(trade.id)) {
                skipped++
                continue
            }

            try {
                // Determine action type based on trade status
                const action = trade.status === 'open' ? 'sync_import' : 'sync_close'

                // Create execution log entry
                const { error: insertError } = await supabase
                    .from('execution_log')
                    .insert({
                        user_id: user.id,
                        oanda_account_id: accountId,
                        action,
                        trade_id: trade.id,
                        oanda_trade_id: trade.oanda_trade_id,
                        request_payload: {
                            source: 'backfill',
                            original_source: trade.source || 'unknown',
                            type: trade.status === 'open' ? 'open_trade' : 'closed_trade'
                        },
                        response_payload: {
                            pair: trade.pair,
                            direction: trade.direction,
                            entry_price: trade.entry_price,
                            exit_price: trade.exit_price,
                            lot_size: trade.lot_size,
                            stop_loss: trade.stop_loss,
                            take_profit: trade.take_profit,
                            opened_at: trade.opened_at || trade.created_at,
                            closed_at: trade.closed_at
                        },
                        status: 'success',
                        created_at: trade.created_at // Use original trade timestamp
                    })

                if (insertError) {
                    console.error(`Failed to backfill trade ${trade.id}:`, insertError.message)
                    errors.push({ trade_id: trade.id, error: insertError.message })
                } else {
                    imported++
                }
            } catch (e: any) {
                console.error(`Error backfilling trade ${trade.id}:`, e)
                errors.push({ trade_id: trade.id, error: e.message })
            }
        }

        return NextResponse.json({
            success: true,
            message: `Backfill completed: ${imported} imported, ${skipped} skipped`,
            imported,
            skipped,
            total: allTrades.length,
            errors: errors.length > 0 ? errors : undefined
        })
    } catch (error: any) {
        console.error('Backfill error:', error)
        return NextResponse.json({
            error: error.message || 'Backfill failed'
        }, { status: 500 })
    }
}
