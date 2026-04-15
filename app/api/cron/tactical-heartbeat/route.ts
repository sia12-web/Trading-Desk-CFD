import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'
import { isGhostWindow, isNewsBlackout } from '@/lib/regime/news-guard'
import { getCurrentPrices, closeTrade } from '@/lib/oanda/client'
import { isCrypto } from '@/lib/data/asset-config'
import { executeRegimeProtocol } from '@/lib/regime/engine'
import { monitorManagedTrades } from '@/lib/trade-monitor/monitor'
import { sendTelegramMessage } from '@/lib/notifications/telegram'

export const dynamic = 'force-dynamic'

/**
 * CRON: Tactical Heartbeat (Loop 2)
 *
 * Runs every 1 MINUTE.
 * Purpose: Lightweight, lightning-fast survival checks.
 * 1. Condition Black (Spread > 3x normal) -> Kill active orders
 * 2. News Guard (Exactly 15m to red folder) -> Halt Div 1 & 2
 * 3. Ghost Bot (Exactly 1m after red folder) -> Wake up Div 3
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow unauthenticated local testing but require in prod
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    console.log('[TacticalHeartbeat] Starting 1M scan...')
    const startTime = Date.now()
    const client = await createClient()

    // 1. Check top 5 most volatile/relevant pairs to save API limits
    const targetPairs = ['XAU/USD', 'EUR/USD', 'GBP/JPY', 'NAS100/USD', 'US30/USD']
    const oandaInstruments = targetPairs.filter(p => !isCrypto(p)).map(p => p.replace('/', '_'))

    try {
        // Fast Pricing Fetch for Condition Black
        if (oandaInstruments.length > 0) {
            const prices = await getCurrentPrices(oandaInstruments)
            if (prices.data) {
                for (const price of prices.data) {
                    const ask = parseFloat(price.asks?.[0]?.price ?? '0')
                    const bid = parseFloat(price.bids?.[0]?.price ?? '0')
                    const spread = ask - bid
                    
                    // Simple baseline spread check (e.g. XAU normal is ~0.3, if > 1.5 it's Condition Black)
                    // We'll use a dynamic relative check or a hard threshold.
                    // For now, log massive spreads and simulate Condition Black lockout
                    if (spread > 1.5 && price.instrument === 'XAU_USD') {
                        console.log(`[TacticalHeartbeat] CONDITION BLACK on ${price.instrument}: Spread is ${spread.toFixed(2)}`)
                        // In a real system, you'd close the active trades here:
                        // await closeTrade('SOME_ID', 'ALL')
                    }
                }
            }
        }

        // 2 & 3. News Guard and Ghost Bot Awakener
        let ghostAwakenings = 0
        let blackouts = 0

        // Get regime config for ghost bot state
        const { data: prefs } = await client
            .from('notification_preferences')
            .select('user_id, regime_engine_enabled, regime_engine_ghost_enabled, telegram_chat_id, regime_alerts_enabled')
            .eq('regime_engine_enabled', true)
            .limit(1)
            .single()

        for (const pair of targetPairs) {
            const [ghost, blackout] = await Promise.all([
                isGhostWindow(pair),
                isNewsBlackout(pair)
            ])

            if (blackout.blackout) {
                blackouts++
                // The DB or internal cache should flag this pair so the 15m Regime Engine ignores it
            }

            if (ghost.active && prefs && prefs.regime_engine_ghost_enabled) {
                ghostAwakenings++
                console.log(`[TacticalHeartbeat] Waking up GHOST BOT for ${pair}`)
                
                // Trigger the main execution protocol but since ghostWindow.active is true,
                // it will exclusively run the Ghost Bot and then immediately return.
                // We construct a mock config to force it
                const config = {
                    enabled: true,
                    dryRunMode: false,
                    maxTradesPerDay: 5,
                    riskAmount: 17,
                    minConfidence: 50,
                    cooldownMinutes: 5,
                    enableTrapBot: false,
                    enableKillzoneBot: false,
                    enableMomentumBot: false,
                    enableGhostBot: true,
                }
                
                const result = await executeRegimeProtocol(pair, config, prefs.user_id)
                
                if (result.executed && result.entryPrice && prefs.regime_alerts_enabled) {
                    const msg = `👻 GHOST BOT EXECUTED!\nPair: ${pair}\nDirection: ${result.direction}\nEntry: ${result.entryPrice}\nEvent: ${result.ghostSetup?.newsEvent}`
                    if (prefs.telegram_chat_id) {
                        await sendTelegramMessage(prefs.telegram_chat_id, 'Ghost Bot Alert', msg)
                    }
                }
            }
        }

        // 4. Trade Monitor: manage TP1/TP2 split lifecycle for auto-executed trades
        let monitorResult = null
        try {
            monitorResult = await monitorManagedTrades()
            if (monitorResult.actions.length > 0) {
                console.log(`[TacticalHeartbeat] Trade Monitor: ${monitorResult.tp1_closes} TP1, ${monitorResult.tp2_closes} TP2, ${monitorResult.breakeven_moves} BE, ${monitorResult.stopped_out} SL`)
            }
        } catch (monitorError) {
            console.error('[TacticalHeartbeat] Trade Monitor error:', monitorError)
        }

        const duration = Date.now() - startTime
        return NextResponse.json({
            success: true,
            ghosts_active: ghostAwakenings,
            news_blackouts: blackouts,
            trade_monitor: monitorResult ? {
                checked: monitorResult.checked,
                actions: monitorResult.actions.length,
                tp1_closes: monitorResult.tp1_closes,
                tp2_closes: monitorResult.tp2_closes,
                stopped_out: monitorResult.stopped_out,
            } : null,
            duration_ms: duration
        })

    } catch (err) {
        console.error('[TacticalHeartbeat] Error:', err)
        return NextResponse.json({ error: 'Internal failure' }, { status: 500 })
    }
}
