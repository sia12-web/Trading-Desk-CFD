import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('liquidity_traps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch traps error:', error)
        return NextResponse.json({ error: 'Failed to fetch traps' }, { status: 500 })
    }

    return NextResponse.json({ traps: data || [] })
}

export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { instrument, trap_time, analysis, trap_strategy } = body

    if (!instrument || !trap_time) {
        return NextResponse.json({ error: 'Missing instrument or time' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('liquidity_traps')
        .insert({
            user_id: user.id,
            instrument,
            trap_time,
            analysis,
            trap_strategy,
        })
        .select()
        .single()

    if (error) {
        console.error('Insert trap error:', error)
        return NextResponse.json({ error: 'Failed to create trap' }, { status: 500 })
    }

    return NextResponse.json({ trap: data })
}

export async function DELETE(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const supabase = await createClient()
    const { error } = await supabase
        .from('liquidity_traps')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        console.error('Delete trap error:', error)
        return NextResponse.json({ error: 'Failed to delete trap' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
