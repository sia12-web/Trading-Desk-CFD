import type { SupabaseClient } from '@supabase/supabase-js'

const EPISODES_PER_SEASON = 20

/**
 * Compute season number from episode number.
 * Episodes 1-20 = Season 1, 21-40 = Season 2, etc.
 */
export function getSeasonNumber(episodeNumber: number): number {
    return Math.ceil(episodeNumber / EPISODES_PER_SEASON)
}

/**
 * Check if this episode is the season finale (last in its batch of 20).
 */
export function isSeasonFinale(episodeNumber: number): boolean {
    return episodeNumber % EPISODES_PER_SEASON === 0
}

/**
 * After a season finale episode, create/update the season summary.
 * Uses the story bible's arc_summary as the base for the season summary.
 */
export async function checkAndCloseSeason(
    userId: string,
    pair: string,
    episodeNumber: number,
    arcSummary: string,
    isSeasonFinale: boolean,
    client: SupabaseClient
): Promise<void> {
    if (!isSeasonFinale) return

    const seasonNumber = getSeasonNumber(episodeNumber)

    const { error } = await client
        .from('story_seasons')
        .upsert(
            {
                user_id: userId,
                pair,
                season_number: seasonNumber,
                summary: arcSummary,
                episode_count: EPISODES_PER_SEASON,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,pair,season_number' }
        )

    if (error) {
        console.error(`[Seasons] Failed to close season ${seasonNumber} for ${pair}:`, error.message)
    } else {
        console.log(`[Seasons] Season ${seasonNumber} closed for ${pair} (episodes ${(seasonNumber - 1) * EPISODES_PER_SEASON + 1}-${episodeNumber})`)
    }

    // Archive older season episodes (keep current + previous season unarchived)
    const archiveBeforeEpisode = (seasonNumber - 1) * EPISODES_PER_SEASON
    if (archiveBeforeEpisode > 0) {
        const { error: archiveError } = await client
            .from('story_episodes')
            .update({ archived: true })
            .eq('user_id', userId)
            .eq('pair', pair)
            .lte('episode_number', archiveBeforeEpisode)
            .eq('archived', false)

        if (archiveError) {
            console.error(`[Seasons] Failed to archive episodes for ${pair}:`, archiveError.message)
        }
    }
}
