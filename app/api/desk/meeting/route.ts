import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { createTask } from '@/lib/background-tasks/manager'
import { generateMorningMeeting } from '@/lib/desk/generator'

export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit check
    const limit = await checkRateLimit(user.id)
    if (!limit.allowed) {
        const minutes = Math.ceil(limit.resetIn / 60_000)
        return NextResponse.json(
            { error: `Rate limit exceeded. Try again in ${minutes} minutes.` },
            { status: 429 }
        )
    }

    // Create background task and start generation
    const taskId = await createTask(user.id, 'desk_morning_meeting')

    // Fire and forget — runs in background
    generateMorningMeeting(user.id, taskId).catch(err => {
        console.error('Morning meeting generation error:', err)
    })

    return NextResponse.json({ taskId, remaining: limit.remaining })
}

export async function GET() {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Get today's latest meeting
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const { data: meeting, error } = await supabase
        .from('desk_meetings')
        .select('*')
        .eq('user_id', user.id)
        .eq('meeting_type', 'morning_meeting')
        .gte('created_at', startOfDay)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ meeting })
}
