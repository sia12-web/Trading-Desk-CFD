import { NextRequest, NextResponse } from 'next/server'
import { getOpenTrades, closeTrade } from '@/lib/oanda/client'
import { getOpenPositions, createKrakenMarketOrder } from '@/lib/kraken/client'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { createClient } from '@/lib/supabase/server'

/**
 * CRON: New York Close - THE REAPER
 * 
 * Runs every minute between 3:59 PM and 4:05 PM ET to ensure 
 * all positions are liquidated before market close.
 * 
 * Logic:
 * 1. Verify it is roughly 4:00 PM ET.
 * 2. Fetch all open OANDA (CFD) trades -> Close ALL.
 * 3. Fetch all open Kraken (Crypto) positions -> Close ALL.
 * 4. Notify via Telegram.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const nyTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    }).formatToParts(now)

    const hour = parseInt(nyTime.find(p => p.type === 'hour')?.value ?? '0')
    const minute = parseInt(nyTime.find(p => p.type === 'minute')?.value ?? '0')

    // Only run if it's 4:00 PM (or slightly after)
    // We allow a small window to ensure it fires correctly on cron
    if (hour !== 16) {
        return NextResponse.json({ status: 'Skipped', reason: 'Not 4 PM ET' })
    }

    console.log(`[NY-Close] Starting liquidation sequence at ${hour}:${minute} ET...`)
    const results = { oanda: [] as string[], kraken: [] as string[] }

    try {
        const supabase = await createClient()

        // ── 1. Liquidate OANDA ──
        const { data: oandaTrades } = await getOpenTrades()
        if (oandaTrades && oandaTrades.length > 0) {
            for (const trade of oandaTrades) {
                try {
                    await closeTrade(trade.id)
                    results.oanda.push(`${trade.instrument} (${trade.id})`)
                } catch (err) {
                    console.error(`[NY-Close] Failed to close OANDA ${trade.id}:`, err)
                }
            }
        }

        // ── 2. Liquidate Kraken ──
        try {
            const krakenPositions = await getOpenPositions()
            if (krakenPositions && Object.keys(krakenPositions).length > 0) {
                for (const posId in krakenPositions) {
                    const pos = krakenPositions[posId]
                    // Kraken liquidation: place opposite market order
                    const side = pos.type === 'buy' ? 'sell' : 'buy'
                    await createKrakenMarketOrder({
                        pair: pos.pair,
                        side,
                        volume: pos.vol
                    })
                    results.kraken.push(`${pos.pair} (${posId})`)
                }
            }
        } catch (err) {
            console.error('[NY-Close] Kraken liquidation error:', err)
        }

        // ── 3. Notify ──
        if (results.oanda.length > 0 || results.kraken.length > 0) {
            const message = `🌆 *New York Close Liquidation*\n\n` +
                `OANDA Closed: ${results.oanda.length > 0 ? results.oanda.join(', ') : 'None'}\n` +
                `Kraken Closed: ${results.kraken.length > 0 ? results.kraken.join(', ') : 'None'}\n\n` +
                `*System Flat for EOD.*`

            const { data: prefUsers } = await supabase
                .from('notification_preferences')
                .select('telegram_chat_id')
                .eq('regime_alerts_enabled', true)
                .not('telegram_chat_id', 'is', null)

            if (prefUsers) {
                for (const u of prefUsers) {
                    await sendTelegramMessage(u.telegram_chat_id, 'NY Close Protocol', message)
                }
            }
        }

        return NextResponse.json({ success: true, results })
    } catch (error) {
        console.error('[NY-Close] Fatal Error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
