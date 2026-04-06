import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { getSubscribedPairs, getLatestEpisode } from '@/lib/data/stories'

export async function GET() {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const pairs = await getSubscribedPairs(user.id)
        let totalNew = 0

        await Promise.all(
            pairs.map(async (sub) => {
                const latest = await getLatestEpisode(user.id, sub.pair)
                if (latest && new Date(latest.created_at) > new Date(sub.last_viewed_at)) {
                    totalNew++
                }
            })
        )

        return NextResponse.json({ totalNew })
    } catch (err) {
        console.error('Failed to get story notifications:', err)
        return NextResponse.json({ totalNew: 0 })
    }
}
