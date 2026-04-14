import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanAllPairsForRegime } from '@/lib/regime/scanner'
import { executeRegimeProtocol } from '@/lib/regime/engine'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import type { RegimeEngineConfig } from '@/lib/regime/types'

/**
 * CRON: Regime Monitor
 *
 * Runs every 15 minutes to:
 * 1. Classify regime for all 25 pairs
 * 2. Detect regime CHANGES (send Telegram alerts)
 * 3. Auto-execute qualifying setups via the active bot
 * 4. Upsert scan results to database
 *
 * Runs alongside killzone-monitor (does not replace it).
 *
 * Railway Cron: every 15 minutes (star-slash-15 star star star star)
 */
export async function GET(req: NextRequest) {
    // ═══════════════════════════════════════════════════════════════════
    // Authentication
    // ═══════════════════════════════════════════════════════════════════
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[RegimeMonitorCron] Starting scan...')
    const startTime = Date.now()

    try {
        const client = await createClient()

        // ═══════════════════════════════════════════════════════════════════
        // Step 1: Scan all pairs
        // ═══════════════════════════════════════════════════════════════════
        const scanResults = await scanAllPairsForRegime(100)
        const successfulScans = scanResults.filter(r => r.success)
        console.log(`[RegimeMonitorCron] Scanned ${successfulScans.length}/${scanResults.length} pairs`)

        // ═══════════════════════════════════════════════════════════════════
        // Step 2: Load previous states
        // ═══════════════════════════════════════════════════════════════════
        const { data: previousStates } = await client
            .from('regime_monitor_results')
            .select('*')

        const prevMap = new Map<string, { regime: string }>(
            (previousStates ?? []).map(s => [s.pair, { regime: s.regime }])
        )

        // ═══════════════════════════════════════════════════════════════════
        // Step 3: Detect regime changes & send alerts
        // ═══════════════════════════════════════════════════════════════════
        const regimeChanges: Array<{ pair: string; from: string; to: string; activeBot: string }> = []

        for (const scan of successfulScans) {
            const prev = prevMap.get(scan.pair)
            if (prev && prev.regime !== scan.regime.regime) {
                regimeChanges.push({
                    pair: scan.pair,
                    from: prev.regime,
                    to: scan.regime.regime,
                    activeBot: scan.regime.activeBot,
                })
            }
        }

        console.log(`[RegimeMonitorCron] ${regimeChanges.length} regime changes detected`)

        if (regimeChanges.length > 0) {
            const { data: users } = await client
                .from('notification_preferences')
                .select('user_id, telegram_chat_id')
                .eq('regime_alerts_enabled', true)
                .not('telegram_chat_id', 'is', null)

            if (users && users.length > 0) {
                const botNames: Record<string, string> = {
                    trap: 'Trap Bot (Donchian+CVD)',
                    killzone: 'Killzone Bot (Institutional)',
                    momentum: 'Momentum Bot (VWAP Trend)',
                    none: 'ALL BOTS OFF',
                }

                for (const change of regimeChanges) {
                    const message =
                        `${change.pair}: ${change.from.replace(/_/g, ' ')} → ${change.to.replace(/_/g, ' ')}\n\n` +
                        `Active: ${botNames[change.activeBot] ?? change.activeBot}\n\n` +
                        `The Overseer has switched weapons.`

                    for (const user of users) {
                        try {
                            await sendTelegramMessage(
                                user.telegram_chat_id,
                                `Regime Change: ${change.pair}`,
                                message
                            )
                            await new Promise(resolve => setTimeout(resolve, 500))
                        } catch (error) {
                            console.error(`[RegimeMonitorCron] Alert error for ${user.user_id}:`, error)
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Step 4: Auto-execute qualifying pairs
        // ═══════════════════════════════════════════════════════════════════
        let autoExecutionCount = 0
        const qualifyingPairs = successfulScans.filter(s =>
            s.bestSetup?.detected && s.regime.activeBot !== 'none'
        )

        if (qualifyingPairs.length > 0) {
            const { data: regimePrefs } = await client
                .from('notification_preferences')
                .select('user_id, regime_engine_enabled, regime_engine_dry_run, regime_engine_max_trades_per_day, regime_engine_risk_amount, regime_engine_min_confidence, regime_engine_cooldown_minutes, regime_engine_trap_enabled, regime_engine_killzone_enabled, regime_engine_momentum_enabled, regime_engine_ghost_enabled')
                .eq('regime_engine_enabled', true)
                .limit(1)
                .single()

            if (regimePrefs) {
                const config: RegimeEngineConfig = {
                    enabled: true,
                    dryRunMode: regimePrefs.regime_engine_dry_run ?? true,
                    maxTradesPerDay: regimePrefs.regime_engine_max_trades_per_day ?? 3,
                    riskAmount: regimePrefs.regime_engine_risk_amount ?? 17,
                    minConfidence: regimePrefs.regime_engine_min_confidence ?? 60,
                    cooldownMinutes: regimePrefs.regime_engine_cooldown_minutes ?? 30,
                    enableTrapBot: regimePrefs.regime_engine_trap_enabled ?? true,
                    enableKillzoneBot: regimePrefs.regime_engine_killzone_enabled ?? true,
                    enableMomentumBot: regimePrefs.regime_engine_momentum_enabled ?? true,
                    enableGhostBot: regimePrefs.regime_engine_ghost_enabled ?? true,
                }

                console.log(`[RegimeMonitorCron] Running auto-execution for ${qualifyingPairs.length} qualifying pairs (dryRun: ${config.dryRunMode})`)

                for (const scan of qualifyingPairs) {
                    try {
                        const result = await executeRegimeProtocol(scan.pair, config, regimePrefs.user_id)
                        if (result.executed || result.dryRun) {
                            autoExecutionCount++
                        }

                        // Send Telegram for live executions
                        if (result.executed && result.entryPrice) {
                            const { data: alertUsers } = await client
                                .from('notification_preferences')
                                .select('telegram_chat_id')
                                .eq('regime_alerts_enabled', true)
                                .not('telegram_chat_id', 'is', null)

                            if (alertUsers && alertUsers.length > 0) {
                                const execMsg = `${result.direction === 'long' ? 'BUY' : 'SELL'} ${scan.pair}\nBot: ${result.botUsed}\nEntry: ${result.entryPrice.toFixed(5)}\nSL: ${result.stopLoss?.toFixed(5)}\nTP1: ${result.takeProfit1?.toFixed(5)}\nTP2: ${result.takeProfit2?.toFixed(5)}\nRisk: $${result.positionSize?.riskAmount}`
                                for (const u of alertUsers) {
                                    await sendTelegramMessage(u.telegram_chat_id, `Regime Auto-Exec: ${scan.pair}`, execMsg)
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[RegimeMonitorCron] Auto-exec error for ${scan.pair}:`, err)
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Step 5: Upsert scan results to database
        // ═══════════════════════════════════════════════════════════════════
        for (const scan of successfulScans) {
            const prev = prevMap.get(scan.pair)
            await client
                .from('regime_monitor_results')
                .upsert({
                    pair: scan.pair,
                    scanned_at: scan.scannedAt,
                    regime: scan.regime.regime,
                    active_bot: scan.regime.activeBot,
                    regime_confidence: scan.regime.confidence,
                    size_multiplier: scan.regime.sizeMultiplier,
                    atr_percentile: scan.regime.indicators.atrPercentile,
                    adx_value: scan.regime.indicators.adxValue,
                    donchian_compression: scan.regime.indicators.donchianCompression,
                    donchian_expansion: scan.regime.indicators.donchianExpansion,
                    ma_slopes_aligned: scan.regime.indicators.slopesAligned,
                    volume_expanding: scan.regime.indicators.volumeExpanding,
                    ma_cross_count: scan.regime.indicators.maCrossCount,
                    bot_setup_detected: scan.bestSetup?.detected ?? false,
                    bot_setup_direction: scan.bestSetup?.direction ?? null,
                    bot_setup_confidence: scan.bestSetup?.confidence ?? 0,
                    bot_entry_price: scan.bestSetup?.entryPrice ?? null,
                    bot_stop_loss: scan.bestSetup?.stopLoss ?? null,
                    bot_take_profit_1: scan.bestSetup?.takeProfit1 ?? null,
                    bot_take_profit_2: scan.bestSetup?.takeProfit2 ?? null,
                    regime_changed: prev ? prev.regime !== scan.regime.regime : false,
                    previous_regime: prev?.regime ?? null,
                    alert_sent: regimeChanges.some(c => c.pair === scan.pair),
                    alert_sent_at: regimeChanges.some(c => c.pair === scan.pair) ? new Date().toISOString() : null,
                }, { onConflict: 'pair' })
        }

        const duration = Date.now() - startTime

        // Count regimes
        const regimeCounts: Record<string, number> = {}
        for (const s of successfulScans) {
            regimeCounts[s.regime.regime] = (regimeCounts[s.regime.regime] ?? 0) + 1
        }

        return NextResponse.json({
            success: true,
            scanned: successfulScans.length,
            regimes: regimeCounts,
            regime_changes: regimeChanges.length,
            setups_detected: qualifyingPairs.length,
            auto_executions: autoExecutionCount,
            duration_ms: duration,
        })
    } catch (error) {
        console.error('[RegimeMonitorCron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }, { status: 500 })
    }
}
