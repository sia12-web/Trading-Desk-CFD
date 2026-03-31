import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isValidPair } from '@/lib/utils/valid-pairs'
import { endSeason } from '@/lib/story/seasons'
import { getActivePosition, updatePosition } from '@/lib/data/story-positions'

/**
 * POST /api/story/skip-trade
 * User decides not to enter the trade after a POSITION_ENTRY episode.
 * Closes the season immediately so a new one can begin.
 */
export async function POST(req: NextRequest) {
    const user = await getAuthUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const pair = body.pair as string

    if (!pair || !isValidPair(pair)) {
        return NextResponse.json({ error: 'Invalid pair' }, { status: 400 })
    }

    const client = createServiceClient()

    // Get latest episode — verify it's a position_entry episode
    const { data: latestEpisode, error: epError } = await client
        .from('story_episodes')
        .select('id, episode_number, season_number, episode_type')
        .eq('user_id', user.id)
        .eq('pair', pair)
        .order('episode_number', { ascending: false })
        .limit(1)
        .single()

    if (epError || !latestEpisode) {
        return NextResponse.json({ error: 'No episode found' }, { status: 404 })
    }

    if (latestEpisode.episode_type !== 'position_entry') {
        return NextResponse.json({ error: 'Can only skip trade on position_entry episodes' }, { status: 400 })
    }

    // Close any suggested (not yet activated) position
    const activePos = await getActivePosition(user.id, pair, client)
    if (activePos && activePos.status === 'suggested') {
        await updatePosition(activePos.id, {
            status: 'closed',
            close_reason: 'Trade skipped by user',
        }, client)
    }

    // End the season
    const seasonNumber = latestEpisode.season_number || 1
    await endSeason(user.id, pair, seasonNumber, 'Trade skipped by user', client)

    return NextResponse.json({ success: true, seasonEnded: seasonNumber })
}
