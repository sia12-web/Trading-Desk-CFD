import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const url = new URL(req.url)
    const meetingId = url.searchParams.get('meeting_id')
    const episodeId = url.searchParams.get('episode_id')
    const limit = parseInt(url.searchParams.get('limit') || '50')

    let query = supabase
        .from('desk_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(Math.min(limit, 100))

    if (meetingId) {
        query = query.eq('meeting_id', meetingId)
    }

    if (episodeId) {
        query = query.contains('context_data', { episode_id: episodeId })
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages: data || [] })
}
