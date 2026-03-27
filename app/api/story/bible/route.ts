import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBible } from '@/lib/story/bible'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const pair = searchParams.get('pair')

    if (!pair) {
        return NextResponse.json({ error: 'Pair is required' }, { status: 400 })
    }

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const bible = await getBible(user.id, pair, supabase)
        return NextResponse.json({ bible })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Bible API] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
