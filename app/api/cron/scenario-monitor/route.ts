import { NextRequest, NextResponse } from 'next/server'
import { runScenarioMonitor } from '@/lib/story/scenario-monitor'
import { shouldRunCron, getMontrealTime } from '@/lib/utils/trading-hours'

export const maxDuration = 60

/**
 * Cron: monitors active story scenarios against live OANDA prices.
 * Runs every 15 minutes during ACTIVE trading sessions only.
 *
 * MONTREAL FAST MATRIX SCHEDULE:
 * ✅ 7:30 AM - 11:30 AM EST (NY core + recon)
 * ✅ 2:00 AM - 4:00 AM EST (London killzone on Tue/Wed only)
 * ❌ 8:00 PM - 2:00 AM EST (Asian dead zone)
 * ❌ 11:30 AM - 8:00 PM EST (NY afternoon noise)
 *
 * Auth: Bearer CRON_SECRET
 */
export async function GET(req: NextRequest) {
    const rawSecret = process.env.CRON_SECRET || ''
    const secret = rawSecret.trim()
    const authHeader = req.headers.get('authorization')
    const queryKey = req.nextUrl.searchParams.get('key')
    const expectedSecret = `Bearer ${secret}`

    if (!secret) {
        console.error('[ScenarioMonitor Cron Debug] CRON_SECRET is NOT SET')
        return NextResponse.json({ error: 'Config missing' }, { status: 500 })
    }

    // Resilience: URL params often turn '+' into ' ' (space)
    const normalizedQueryKey = queryKey?.trim().replace(/ /g, '+')

    const isAuthorized =
        (authHeader && authHeader.trim() === expectedSecret) ||
        (normalizedQueryKey === secret)

    if (!isAuthorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ═══════════════════════════════════════════════════════════════════
    // MONTREAL FAST MATRIX: Check if we should run during this session
    // ═══════════════════════════════════════════════════════════════════
    const cronCheck = shouldRunCron()
    const montrealTime = getMontrealTime()

    if (!cronCheck.shouldRun) {
        console.log(`[ScenarioMonitor] SKIPPED at ${montrealTime.toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} — ${cronCheck.reason}`)
        return NextResponse.json({
            skipped: true,
            session: cronCheck.session,
            day: cronCheck.day,
            reason: cronCheck.reason,
            montrealTime: montrealTime.toISOString(),
        })
    }

    console.log(`[ScenarioMonitor] RUNNING at ${montrealTime.toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} — ${cronCheck.reason}`)

    try {
        const result = await runScenarioMonitor()
        return NextResponse.json({
            ...result,
            session: cronCheck.session,
            day: cronCheck.day,
            montrealTime: montrealTime.toISOString(),
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ScenarioMonitor Cron] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
