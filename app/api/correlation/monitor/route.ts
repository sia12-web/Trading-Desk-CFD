import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { monitorActivePatterns } from '@/lib/correlation/live-monitor'

/**
 * GET /api/correlation/monitor
 *
 * Check current market conditions against high-accuracy patterns.
 * Returns patterns that are partially or fully triggered.
 *
 * Query params:
 * - minAccuracy: number (default: 70) - Only monitor patterns above this accuracy
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const minAccuracy = parseInt(searchParams.get('minAccuracy') || '70')

  try {
    const activePatterns = await monitorActivePatterns(user.id, minAccuracy)

    // Separate ready-to-trade vs partial matches
    const readyToTrade = activePatterns.filter(p => p.readyToTrade)
    const partial = activePatterns.filter(p => !p.readyToTrade && p.conditionsMet > 0)

    return NextResponse.json({
      ready_to_trade: readyToTrade,
      partial_matches: partial,
      total_monitored: activePatterns.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[MonitorAPI] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Monitoring failed' },
      { status: 500 }
    )
  }
}
