import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { markStoryAsViewed } from '@/lib/data/stories'

export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pair } = await req.json()
    if (!pair) {
        return NextResponse.json({ error: 'Pair is required' }, { status: 400 })
    }

    try {
        await markStoryAsViewed(user.id, pair)
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Failed to mark story as viewed:', err)
        return NextResponse.json({ error: 'Failed to mark story as viewed' }, { status: 500 })
    }
}
