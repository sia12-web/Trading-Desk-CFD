import type { SupabaseClient } from '@supabase/supabase-js'
import { deactivateAllActiveScenariosForPair } from '@/lib/data/stories'

/**
 * Compute season number from the last episode's season_number.
 * If the last episode was a season finale, the next episode starts a new season.
 */
export function getSeasonNumber(lastSeasonNumber: number, lastWasFinale: boolean): number {
    if (lastWasFinale) return lastSeasonNumber + 1
    return lastSeasonNumber
}

/**
 * End a season: trade-cycle driven (trade closed, trade skipped, etc.)
 * Seasons = trade cycles. The system decides when seasons end, not the AI.
 */
export async function endSeason(
    userId: string,
    pair: string,
    seasonNumber: number,
    summary: string,
    client: SupabaseClient
): Promise<void> {
    // 1. Upsert season summary
    const { data: episodes } = await client
        .from('story_episodes')
        .select('id')
        .eq('user_id', userId)
        .eq('pair', pair)
        .eq('season_number', seasonNumber)

    const episodeCount = episodes?.length || 0

    const { error } = await client
        .from('story_seasons')
        .upsert(
            {
                user_id: userId,
                pair,
                season_number: seasonNumber,
                summary,
                episode_count: episodeCount,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,pair,season_number' }
        )

    if (error) {
        console.error(`[Seasons] Failed to close season ${seasonNumber} for ${pair}:`, error.message)
    } else {
        console.log(`[Seasons] Season ${seasonNumber} closed for ${pair} (${episodeCount} episodes)`)
    }

    // 2. Deactivate all remaining active scenarios
    const deactivated = await deactivateAllActiveScenariosForPair(
        userId, pair, `Season ${seasonNumber} ended`, client
    )
    if (deactivated > 0) {
        console.log(`[Seasons] Deactivated ${deactivated} remaining scenarios for ${pair}`)
    }

    // 3. Mark the last episode as season finale
    const { error: finaleError } = await client
        .from('story_episodes')
        .update({ is_season_finale: true })
        .eq('user_id', userId)
        .eq('pair', pair)
        .eq('season_number', seasonNumber)
        .order('episode_number', { ascending: false })
        .limit(1)

    if (finaleError) {
        console.error(`[Seasons] Failed to mark finale episode for ${pair}:`, finaleError.message)
    }

    // 4. Archive episodes from old seasons (keep current + previous unarchived)
    if (seasonNumber >= 2) {
        const { error: archiveError } = await client
            .from('story_episodes')
            .update({ archived: true })
            .eq('user_id', userId)
            .eq('pair', pair)
            .lt('season_number', seasonNumber - 1)
            .eq('archived', false)

        if (archiveError) {
            console.error(`[Seasons] Failed to archive episodes for ${pair}:`, archiveError.message)
        }
    }
}

/**
 * Fetch all completed season summaries for deep cross-season memory.
 * Fed to the narrator so the AI knows what happened in every past season.
 */
export async function getSeasonArchive(
    userId: string,
    pair: string,
    client: SupabaseClient
): Promise<Array<{
    season_number: number
    summary: string | null
    episode_count: number
    key_events: unknown[]
    performance_notes: string | null
}>> {
    const { data, error } = await client
        .from('story_seasons')
        .select('season_number, summary, episode_count, key_events, performance_notes')
        .eq('user_id', userId)
        .eq('pair', pair)
        .order('season_number', { ascending: true })

    if (error) {
        console.error(`[Seasons] Failed to fetch season archive for ${pair}:`, error.message)
        return []
    }
    return data || []
}
