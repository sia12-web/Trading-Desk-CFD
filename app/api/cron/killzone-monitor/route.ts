import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanAllPairs } from '@/lib/killzone/multi-pair-scanner'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import type { KillzoneMonitorResult } from '@/lib/types/database'

/**
 * CRON: Killzone Monitor
 *
 * Runs every 15 minutes to scan all pairs for:
 * - Active Killzone setups (Wave 2/4 + Fib/POC confluence)
 * - Wave 2/4 completion (ready for Wave 3/5 impulse entry)
 *
 * Sends Telegram alerts when Wave 2/4 corrections finish.
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

    console.log('[KillzoneMonitorCron] Starting scan...')
    const startTime = Date.now()

    try {
        const client = await createClient()

        // ═══════════════════════════════════════════════════════════════════
        // Step 1: Scan all pairs
        // ═══════════════════════════════════════════════════════════════════
        const scanResults = await scanAllPairs(100) // 100ms delay between pairs

        const successfulScans = scanResults.filter(r => r.success)
        console.log(`[KillzoneMonitorCron] Scanned ${successfulScans.length}/${scanResults.length} pairs`)

        // ═══════════════════════════════════════════════════════════════════
        // Step 2: Load previous states from database
        // ═══════════════════════════════════════════════════════════════════
        const { data: previousStates } = await client
            .from('killzone_monitor_results')
            .select('*')

        const previousStateMap = new Map<string, KillzoneMonitorResult>()
        if (previousStates) {
            for (const state of previousStates) {
                previousStateMap.set(state.pair, state)
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Step 3: Detect NEW wave completions & prepare alerts
        // ═══════════════════════════════════════════════════════════════════
        const alerts: Array<{
            pair: string
            waveType: 2 | 4
            direction: 'bullish' | 'bearish'
            boxHigh: number
            boxLow: number
            confidence: number
            volumePOC: number
        }> = []

        for (const scan of successfulScans) {
            const prev = previousStateMap.get(scan.pair)

            // Check for NEW Wave 2 completion
            if (scan.wave2Complete && !prev?.wave2_complete && scan.killzoneDetected) {
                alerts.push({
                    pair: scan.pair,
                    waveType: 2,
                    direction: scan.waveDirection ?? 'bullish',
                    boxHigh: scan.boxHigh ?? 0,
                    boxLow: scan.boxLow ?? 0,
                    confidence: scan.killzoneConfidence,
                    volumePOC: scan.volumePOC ?? 0,
                })
            }

            // Check for NEW Wave 4 completion
            if (scan.wave4Complete && !prev?.wave4_complete && scan.killzoneDetected) {
                alerts.push({
                    pair: scan.pair,
                    waveType: 4,
                    direction: scan.waveDirection ?? 'bullish',
                    boxHigh: scan.boxHigh ?? 0,
                    boxLow: scan.boxLow ?? 0,
                    confidence: scan.killzoneConfidence,
                    volumePOC: scan.volumePOC ?? 0,
                })
            }
        }

        console.log(`[KillzoneMonitorCron] ${alerts.length} new wave completions detected`)

        // ═══════════════════════════════════════════════════════════════════
        // Step 4: Send Telegram alerts
        // ═══════════════════════════════════════════════════════════════════
        if (alerts.length > 0) {
            // Get users with Killzone alerts enabled
            const { data: users } = await client
                .from('notification_preferences')
                .select('user_id, telegram_chat_id')
                .eq('killzone_alerts_enabled', true)
                .not('telegram_chat_id', 'is', null)

            if (users && users.length > 0) {
                console.log(`[KillzoneMonitorCron] Sending alerts to ${users.length} users`)

                for (const alert of alerts) {
                    const message = formatKillzoneAlert(alert)

                    for (const user of users) {
                        try {
                            await sendTelegramMessage(
                                user.telegram_chat_id,
                                `🎯 ${alert.pair} Wave ${alert.waveType} Complete`,
                                message
                            )

                            // Rate limiting: 1 message per second
                            await new Promise(resolve => setTimeout(resolve, 1000))

                            // Log alert to database
                            await client.from('killzone_alerts').insert({
                                pair: alert.pair,
                                wave_type: alert.waveType,
                                direction: alert.direction,
                                killzone_box_high: alert.boxHigh,
                                killzone_box_low: alert.boxLow,
                                confidence: alert.confidence,
                                telegram_sent: true,
                                telegram_chat_id: user.telegram_chat_id,
                            })
                        } catch (error) {
                            console.error(`[KillzoneMonitorCron] Error sending alert to user ${user.user_id}:`, error)
                        }
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Step 5: Upsert all scan results to database
        // ═══════════════════════════════════════════════════════════════════
        for (const scan of successfulScans) {
            await client
                .from('killzone_monitor_results')
                .upsert({
                    pair: scan.pair,
                    scanned_at: scan.scannedAt,
                    current_wave: scan.currentWave,
                    wave_direction: scan.waveDirection,
                    wave2_complete: scan.wave2Complete,
                    wave4_complete: scan.wave4Complete,
                    wave_confidence: scan.waveConfidence,
                    killzone_detected: scan.killzoneDetected,
                    killzone_box_high: scan.boxHigh,
                    killzone_box_low: scan.boxLow,
                    killzone_box_width_pips: scan.boxWidthPips,
                    killzone_confidence: scan.killzoneConfidence,
                    killzone_fib_zone_high: scan.fibZoneHigh,
                    killzone_fib_zone_low: scan.fibZoneLow,
                    killzone_volume_poc: scan.volumePOC,
                    price_in_box: scan.priceInBox,
                    alert_sent: alerts.some(a => a.pair === scan.pair),
                    alert_sent_at: alerts.some(a => a.pair === scan.pair) ? new Date().toISOString() : null,
                }, {
                    onConflict: 'pair',
                })
        }

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            scanned: successfulScans.length,
            killzones_detected: successfulScans.filter(s => s.killzoneDetected).length,
            wave2_complete: successfulScans.filter(s => s.wave2Complete).length,
            wave4_complete: successfulScans.filter(s => s.wave4Complete).length,
            alerts_sent: alerts.length,
            duration_ms: duration,
        })
    } catch (error) {
        console.error('[KillzoneMonitorCron] Error:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }, { status: 500 })
    }
}

/**
 * Format Killzone completion alert message for Telegram
 */
function formatKillzoneAlert(alert: {
    pair: string
    waveType: 2 | 4
    direction: 'bullish' | 'bearish'
    boxHigh: number
    boxLow: number
    confidence: number
    volumePOC: number
}): string {
    const nextWave = alert.waveType === 2 ? 3 : 5
    const directionEmoji = alert.direction === 'bullish' ? '📈' : '📉'
    const boxWidth = Math.round(Math.abs(alert.boxHigh - alert.boxLow) * 10000 * 10) / 10

    return `${directionEmoji} **Wave ${nextWave} Setup Ready!**

**Direction:** ${alert.direction.toUpperCase()}
**Killzone Box:** ${alert.boxHigh.toFixed(5)} - ${alert.boxLow.toFixed(5)} (${boxWidth} pips)
**Volume POC:** ${alert.volumePOC.toFixed(5)}
**Confluence:** ${alert.confidence}%

**Entry Rule:**
Wait for M1 volume climax + CHoCH inside the box

**Risk Management:**
• SL: ${alert.direction === 'bullish' ? 'Below' : 'Above'} Wave ${alert.waveType} ${alert.direction === 'bullish' ? 'low' : 'high'} (H1 invalidation)
• TP1: 100% Fib extension (M15) → Close 50%, move SL to BE
• TP2: 161.8% Fib extension (H1) → Close 50%

⚡️ **ACTION:** Monitor M1 chart for entry signal!`
}
