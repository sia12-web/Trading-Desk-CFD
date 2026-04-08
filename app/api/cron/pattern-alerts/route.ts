import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { monitorPatternTriggers, formatTriggerMessage } from '@/lib/correlation/pattern-monitor'
import { shouldRunCron, getMontrealTime } from '@/lib/utils/trading-hours'

/**
 * CRON: Pattern Alert Monitor
 *
 * Runs every 15 minutes during ACTIVE trading sessions only.
 *
 * MONTREAL FAST MATRIX SCHEDULE:
 * ✅ 7:30 AM - 11:30 AM EST (NY core + recon)
 * ✅ 2:00 AM - 4:00 AM EST (London killzone on Tue/Wed only)
 * ❌ 8:00 PM - 2:00 AM EST (Asian dead zone)
 * ❌ 11:30 AM - 8:00 PM EST (NY afternoon noise)
 *
 * Railway Cron: every 15 minutes (cron expression: star-slash-15 star star star star)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ═══════════════════════════════════════════════════════════════════
  // MONTREAL FAST MATRIX: Check if we should run during this session
  // ═══════════════════════════════════════════════════════════════════
  const cronCheck = shouldRunCron()
  const montrealTime = getMontrealTime()

  if (!cronCheck.shouldRun) {
    console.log(`[PatternAlertsCron] SKIPPED at ${montrealTime.toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} — ${cronCheck.reason}`)
    return NextResponse.json({
      skipped: true,
      session: cronCheck.session,
      day: cronCheck.day,
      reason: cronCheck.reason,
      montrealTime: montrealTime.toISOString(),
    })
  }

  console.log(`[PatternAlertsCron] RUNNING at ${montrealTime.toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} — ${cronCheck.reason}`)
  const startTime = Date.now()

  try {
    const client = await createClient()

    // Get all users with notification preferences enabled
    const { data: users } = await client
      .from('notification_preferences')
      .select('user_id, telegram_chat_id')
      .eq('correlation_alerts_enabled', true)
      .not('telegram_chat_id', 'is', null)

    if (!users || users.length === 0) {
      console.log('[PatternAlertsCron] No users with correlation alerts enabled')
      return NextResponse.json({
        success: true,
        message: 'No users to monitor',
        duration: Date.now() - startTime
      })
    }

    console.log(`[PatternAlertsCron] Monitoring patterns for ${users.length} users`)

    let totalTriggers = 0
    const results = []

    for (const user of users) {
      try {
        // Monitor pattern triggers
        const triggers = await monitorPatternTriggers(user.user_id)

        if (triggers.length > 0) {
          console.log(`[PatternAlertsCron] User ${user.user_id}: ${triggers.length} triggers detected`)

          // Send Telegram notifications
          for (const trigger of triggers) {
            try {
              const message = formatTriggerMessage(trigger)

              // Send via Telegram
              const telegramRes = await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: user.telegram_chat_id,
                    text: message,
                    parse_mode: 'Markdown'
                  })
                }
              )

              if (!telegramRes.ok) {
                console.error(`[PatternAlertsCron] Telegram send failed:`, await telegramRes.text())
              } else {
                totalTriggers++
              }

              // Rate limit: 1 message per second to avoid Telegram throttling
              await new Promise(resolve => setTimeout(resolve, 1000))
            } catch (error) {
              console.error('[PatternAlertsCron] Error sending Telegram message:', error)
            }
          }

          results.push({
            user_id: user.user_id,
            triggers_sent: triggers.length,
            patterns: triggers.map(t => ({
              description: t.pattern.pattern_description,
              match: `${t.matchPercentage.toFixed(0)}%`,
              urgency: t.urgency,
              session: t.currentSession
            }))
          })
        }
      } catch (error) {
        console.error(`[PatternAlertsCron] Error monitoring user ${user.user_id}:`, error)
        results.push({
          user_id: user.user_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const duration = Date.now() - startTime

    console.log(`[PatternAlertsCron] Complete: ${totalTriggers} alerts sent in ${duration}ms`)

    return NextResponse.json({
      success: true,
      users_monitored: users.length,
      total_triggers: totalTriggers,
      duration,
      results,
      session: cronCheck.session,
      day: cronCheck.day,
      montrealTime: montrealTime.toISOString(),
    })
  } catch (error) {
    console.error('[PatternAlertsCron] Fatal error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Pattern monitoring failed',
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}
