import { NextRequest, NextResponse } from 'next/server'
import { backtestRegimeForPair } from '@/lib/regime/backtester'
import { isValidPair } from '@/lib/utils/valid-pairs'

/**
 * POST /api/regime/backtest
 *
 * Runs the regime backtester for a specified pair and lookback days.
 *
 * Request body:
 * {
 *   pair: "EUR/USD",
 *   lookbackDays: 21,
 *   riskPerTrade: 2
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pair, lookbackDays = 21, riskPerTrade = 2 } = body

        if (!pair || !isValidPair(pair)) {
            return NextResponse.json(
                { error: 'Invalid or missing pair' },
                { status: 400 }
            )
        }

        if (lookbackDays < 7 || lookbackDays > 90) {
            return NextResponse.json(
                { error: 'lookbackDays must be between 7 and 90' },
                { status: 400 }
            )
        }

        if (riskPerTrade <= 0 || riskPerTrade > 10) {
            return NextResponse.json(
                { error: 'riskPerTrade must be between > 0 and <= 10' },
                { status: 400 }
            )
        }

        const result = await backtestRegimeForPair(pair, lookbackDays, riskPerTrade)

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Regime Backtest API] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
