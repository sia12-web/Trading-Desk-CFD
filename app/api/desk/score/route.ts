import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { generateProcessScore } from '@/lib/desk/generator'

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
    const { trade_id } = body

    if (!trade_id) {
        return NextResponse.json({ error: 'trade_id is required' }, { status: 400 })
    }

    try {
        const score = await generateProcessScore(user.id, trade_id)
        return NextResponse.json({ score, remaining: limit.remaining })
    } catch (err) {
        console.error('Process scoring error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Scoring failed' },
            { status: 500 }
        )
    }
}

export async function GET(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const url = new URL(req.url)
    const tradeId = url.searchParams.get('trade_id')

    if (!tradeId) {
        return NextResponse.json({ error: 'trade_id query param required' }, { status: 400 })
    }

    const { data: score, error } = await supabase
        .from('process_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('trade_id', tradeId)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ score })
}
