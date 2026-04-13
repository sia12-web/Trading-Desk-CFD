import { NextRequest, NextResponse } from 'next/server'
import { createTask, updateProgress, completeTask, failTask } from '@/lib/background-tasks/manager'
import { backtestKillzoneForPair } from '@/lib/killzone/backtester'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'

/**
 * POST /api/killzone/backtest-all
 *
 * Run historical backtest for Killzone detector on ALL pairs
 * Uses background task manager for long-running operation
 *
 * Request body:
 * {
 *   lookbackDays: 365,
 *   riskPerTrade: 2
 * }
 *
 * Returns: { taskId: string }
 * Client polls /api/background-tasks/{taskId} for progress
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { lookbackDays = 365, riskPerTrade = 2 } = body

        // Validate inputs
        if (lookbackDays < 30 || lookbackDays > 730) {
            return NextResponse.json(
                { error: 'lookbackDays must be between 30 and 730' },
                { status: 400 }
            )
        }

        if (riskPerTrade < 0.5 || riskPerTrade > 10) {
            return NextResponse.json(
                { error: 'riskPerTrade must be between 0.5 and 10' },
                { status: 400 }
            )
        }

        // Create background task
        // Note: user_id would normally come from auth, using 'system' for now
        const taskId = await createTask('system', 'killzone_backtest_all', {
            lookbackDays,
            riskPerTrade,
        })

        // Run backtest in background (no await - fire and forget)
        runMultiPairBacktest(taskId, lookbackDays, riskPerTrade).catch(error => {
            console.error('[Killzone Backtest All] Unexpected error:', error)
            failTask(taskId, error instanceof Error ? error.message : String(error))
        })

        return NextResponse.json({ taskId })
    } catch (error) {
        console.error('[Killzone Backtest All] Error:', error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        )
    }
}

/**
 * Background worker: Backtest all pairs sequentially
 */
async function runMultiPairBacktest(
    taskId: string,
    lookbackDays: number,
    riskPerTrade: number
) {
    const results: Array<{
        pair: string
        killzones: number
        entries: number
        win_rate: number
        profit_factor: number
        total_pips: number
        max_dd_pips: number
        expectancy: number
    }> = []

    const totalPairs = VALID_PAIRS.length

    for (let i = 0; i < totalPairs; i++) {
        const pair = VALID_PAIRS[i]

        try {
            await updateProgress(
                taskId,
                Math.round(((i + 1) / totalPairs) * 100),
                `Backtesting ${pair}... (${i + 1}/${totalPairs})`
            )

            const result = await backtestKillzoneForPair(pair, lookbackDays, riskPerTrade)

            results.push({
                pair: result.pair,
                killzones: result.total_killzones_detected,
                entries: result.total_entries_triggered,
                win_rate: result.metrics.win_rate,
                profit_factor: result.metrics.profit_factor,
                total_pips: result.metrics.total_pips,
                max_dd_pips: result.metrics.max_drawdown_pips,
                expectancy: result.metrics.expectancy,
            })
        } catch (error) {
            console.error(`[Killzone Backtest All] Error backtesting ${pair}:`, error)
            results.push({
                pair,
                killzones: 0,
                entries: 0,
                win_rate: 0,
                profit_factor: 0,
                total_pips: 0,
                max_dd_pips: 0,
                expectancy: 0,
            })
        }
    }

    // Sort by expectancy (descending)
    results.sort((a, b) => b.expectancy - a.expectancy)

    await completeTask(taskId, {
        results,
        summary: {
            total_pairs: totalPairs,
            lookback_days: lookbackDays,
            risk_per_trade: riskPerTrade,
            completed_at: new Date().toISOString(),
        },
    })
}
