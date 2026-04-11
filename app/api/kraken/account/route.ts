import { NextResponse } from 'next/server'
import { getAccountBalance, getTradeBalance } from '@/lib/kraken/client'

export async function GET() {
    try {
        const [balances, tradeBalance] = await Promise.all([
            getAccountBalance(),
            getTradeBalance()
        ])

        return NextResponse.json({
            balances,
            tradeBalance
        })
    } catch (error: any) {
        console.error('[Kraken Account API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch Kraken account data' },
            { status: 500 }
        )
    }
}
