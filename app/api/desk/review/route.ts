import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { generateTradeReview } from '@/lib/desk/generator'
import type { TradeProposal } from '@/lib/desk/types'

export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = await checkRateLimit(user.id)
    if (!limit.allowed) {
        const minutes = Math.ceil(limit.resetIn / 60_000)
        return NextResponse.json(
            { error: `Rate limit exceeded. Try again in ${minutes} minutes.` },
            { status: 429 }
        )
    }

    const body = await req.json()
    const { pair, direction, entry_price, stop_loss, take_profit, lot_size, reasoning } = body

    if (!pair || !direction || !entry_price || !stop_loss || !take_profit) {
        return NextResponse.json(
            { error: 'Missing required fields: pair, direction, entry_price, stop_loss, take_profit' },
            { status: 400 }
        )
    }

    const proposal: TradeProposal = {
        pair,
        direction,
        entry_price: Number(entry_price),
        stop_loss: Number(stop_loss),
        take_profit: Number(take_profit),
        lot_size: lot_size ? Number(lot_size) : undefined,
        reasoning,
    }

    try {
        const meeting = await generateTradeReview(user.id, proposal)
        return NextResponse.json({ meeting, remaining: limit.remaining })
    } catch (err) {
        console.error('Trade review error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Trade review failed' },
            { status: 500 }
        )
    }
}
