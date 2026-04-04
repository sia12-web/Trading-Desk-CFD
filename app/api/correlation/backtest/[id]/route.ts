import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'
import { backtestPattern } from '@/lib/correlation/backtester'

/**
 * POST /api/correlation/backtest/[id]
 *
 * Run backtest for a correlation pattern.
 * Uses DeepSeek for quantitative analysis of results.
 *
 * Body params:
 * - riskPerTrade: number (default: 2) - % of account risked per trade
 * - stopLossPips: number (default: 50) - Stop loss in pips
 * - takeProfitPips: number (default: 100) - Take profit in pips
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: scenarioId } = await params
  const body = await req.json()
  const {
    riskPerTrade = 2,
    stopLossPips = 50,
    takeProfitPips = 100
  } = body

  const client = await createClient()

  // Fetch scenario with occurrences
  const { data: scenario, error: fetchError } = await client
    .from('correlation_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !scenario) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Fetch occurrences
  const { data: occurrences } = await client
    .from('correlation_scenario_occurrences')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('occurrence_date', { ascending: true })

  // Create extended scenario object with occurrences
  const extendedScenario = {
    ...scenario,
    occurrences: occurrences || []
  }

  try {
    // Run backtest
    const result = await backtestPattern(
      extendedScenario as any,
      200,
      riskPerTrade,
      stopLossPips,
      takeProfitPips
    )

    // Store backtest results
    await client
      .from('correlation_scenarios')
      .update({
        backtest_results: {
          metrics: result.metrics,
          deepseek_analysis: result.deepseek_analysis,
          recommendations: result.recommendations,
          parameters: { riskPerTrade, stopLossPips, takeProfitPips },
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', scenarioId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('[BacktestAPI] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backtest failed' },
      { status: 500 }
    )
  }
}
