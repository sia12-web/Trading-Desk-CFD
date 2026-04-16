import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { runWhaleSimulation } from '@/lib/market-maker/engine'
import { ALLOWED_INSTRUMENTS } from '@/lib/constants/instruments'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // 5 minutes for simulation

export async function POST(req: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Validate body
        const body = await req.json()
        const { date, instrument } = body as { date?: string; instrument?: string }

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
        }

        if (!instrument || !ALLOWED_INSTRUMENTS.includes(instrument as any)) {
            return NextResponse.json({ error: 'Invalid instrument. Must be one of the allowed trading pairs.' }, { status: 400 })
        }

        // Check date is not future and not weekend
        const dateObj = new Date(date + 'T12:00:00Z')
        const now = new Date()
        if (dateObj > now) {
            return NextResponse.json({ error: 'Cannot simulate future dates.' }, { status: 400 })
        }

        const dayOfWeek = dateObj.getUTCDay()
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return NextResponse.json({ error: 'Forex markets are closed on weekends.' }, { status: 400 })
        }

        // Rate limit (36 AI calls per sim is expensive)
        const rateCheck = await checkRateLimit(user.id)
        if (!rateCheck.allowed) {
            return NextResponse.json({
                error: `Rate limited. ${rateCheck.remaining} calls remaining. Reset in ${Math.ceil(rateCheck.resetIn / 60000)}m.`,
            }, { status: 429 })
        }

        // Run simulation
        console.log(`[WhaleSimulator API] Starting simulation for ${instrument} on ${date}`)
        const replay = await runWhaleSimulation(date, instrument)
        console.log(`[WhaleSimulator API] Simulation completed successfully`)

        return NextResponse.json(replay)
    } catch (err) {
        console.error('[WhaleSimulator] Error:', err)
        const message = err instanceof Error ? err.message : 'Simulation failed'
        const stack = err instanceof Error ? err.stack : undefined
        console.error('[WhaleSimulator] Stack:', stack)

        return NextResponse.json({
            error: message,
            details: process.env.NODE_ENV === 'development' ? stack : undefined
        }, { status: 500 })
    }
}
