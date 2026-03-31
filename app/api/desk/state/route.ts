import { NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'

export async function GET() {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data: state, error } = await supabase
        .from('desk_state')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also get recent process scores
    const { data: scores } = await supabase
        .from('process_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('scored_at', { ascending: false })
        .limit(10)

    return NextResponse.json({
        state: state || null,
        recentScores: scores || [],
    })
}
