import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { createTask } from '@/lib/background-tasks/manager'
import { runCorrelationAnalysis } from '@/lib/correlation/pipeline'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'

/**
 * POST /api/correlation/analyze
 *
 * Triggers background correlation analysis task for all forex pairs.
 * Analyzes 200 days of historical data to discover multi-currency patterns.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const lookbackDays = body.lookbackDays || 200

  // Validate lookback days
  if (lookbackDays < 100 || lookbackDays > 500) {
    return NextResponse.json(
      { error: 'lookbackDays must be between 100 and 500' },
      { status: 400 }
    )
  }

  // Rate limit check (correlation analysis is expensive)
  const limit = await checkRateLimit(user.id)
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.resetIn / 60_000)
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${minutes} minutes.` },
      { status: 429 }
    )
  }

  // Create background task
  const taskId = await createTask(user.id, 'correlation_analysis', {
    lookbackDays,
    pairs: VALID_PAIRS
  })

  // Fire and forget — pipeline runs in background
  runCorrelationAnalysis(user.id, [...VALID_PAIRS], lookbackDays, taskId).catch(err => {
    console.error('[CorrelationAPI] CRITICAL ERROR:', err instanceof Error ? err.message : err)
    console.error('[CorrelationAPI] Stack:', err instanceof Error ? err.stack : 'no stack')
  })

  console.log(`[CorrelationAPI] Queued analysis for ${VALID_PAIRS.length} pairs (taskId: ${taskId})`)

  return NextResponse.json({
    taskId,
    remaining: limit.remaining,
    pairs: VALID_PAIRS.length,
    lookbackDays
  })
}
