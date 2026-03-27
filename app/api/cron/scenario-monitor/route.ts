import { NextRequest, NextResponse } from 'next/server'
import { runScenarioMonitor } from '@/lib/story/scenario-monitor'

export const maxDuration = 60

/**
 * Cron: monitors active story scenarios against live OANDA prices.
 * Runs every 15 minutes. Auto-resolves triggered/invalidated scenarios
 * and queues new episode generation when a scenario triggers.
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

    try {
        const result = await runScenarioMonitor()
        return NextResponse.json(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[ScenarioMonitor Cron] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
