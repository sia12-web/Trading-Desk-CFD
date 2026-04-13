import { NextRequest, NextResponse } from 'next/server'
import { backtestKillzoneForPair } from '@/lib/killzone/backtester'

/**
 * POST /api/killzone/backtest
 *
 * Run historical backtest for Killzone detector on a single pair
 *
 * Request body:
 * {
 *   pair: "EUR/USD",
 *   lookbackDays: 365,
 *   riskPerTrade: 2
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { pair, lookbackDays = 365, riskPerTrade = 2 } = body

        if (!pair) {
            return NextResponse.json(
                { error: 'Missing required field: pair' },
                { status: 400 }
            )
        }

        // Validate lookbackDays
        if (lookbackDays < 30 || lookbackDays > 730) {
            return NextResponse.json(
                { error: 'lookbackDays must be between 30 and 730' },
                { status: 400 }
            )
        }

        // Validate riskPerTrade
        if (riskPerTrade < 0.5 || riskPerTrade > 10) {
            return NextResponse.json(
                { error: 'riskPerTrade must be between 0.5 and 10' },
                { status: 400 }
            )
        }

        console.log(`[Killzone Backtest API] Starting backtest for ${pair} (${lookbackDays} days)`)

        const result = await backtestKillzoneForPair(pair, lookbackDays, riskPerTrade)

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Killzone Backtest API] Error:', error)
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        )
    }
}
