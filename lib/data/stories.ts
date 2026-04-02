import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

async function getDefaultClient(): Promise<SupabaseClient> {
    return createClient()
}

// ── Pair Subscriptions ──

export async function getSubscribedPairs(userId: string) {
    const supabase = await getDefaultClient()
    const { data, error } = await supabase
        .from('pair_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('subscribed_at', { ascending: true })

    if (error) throw error
    return data || []
}

export async function subscribeToPair(userId: string, pair: string, notes?: string) {
    const supabase = await getDefaultClient()
    const { data, error } = await supabase
        .from('pair_subscriptions')
        .upsert(
            { user_id: userId, pair, is_active: true, notes },
            { onConflict: 'user_id,pair' }
        )
        .select()
        .single()

    if (error) throw error
    return data
}

import { createServiceClient } from '@/lib/supabase/service'

/**
 * Unsubscribe and SCRUB all memory for a pair.
 * This is a hard delete of episodes, bibles, scenarios, and positions.
 */
export async function unsubscribePair(userId: string, pair: string) {
    // USE SERVICE ROLE (God Mode) to ensure full scrub regardless of RLS
    const supabase = createServiceClient()
    
    // 1. Delete scenarios first (they link to episodes)
    await supabase.from('story_scenarios').delete().eq('user_id', userId).eq('pair', pair)
    
    // 2. Delete position adjustments (they link to positions)
    const { data: positions } = await supabase.from('story_positions').select('id').eq('user_id', userId).eq('pair', pair)
    if (positions?.length) {
        const pIds = positions.map(p => p.id)
        await supabase.from('story_position_adjustments').delete().in('position_id', pIds)
    }

    // 3. Delete positions
    await supabase.from('story_positions').delete().eq('user_id', userId).eq('pair', pair)

    // 4. Delete bibles
    await supabase.from('story_bibles').delete().eq('user_id', userId).eq('pair', pair)

    // 5. Delete episodes
    await supabase.from('story_episodes').delete().eq('user_id', userId).eq('pair', pair)

    // 6. Finally, delete the subscription itself
    const { error } = await supabase
        .from('pair_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('pair', pair)

    if (error) throw error
}

// ── Story Episodes ──

export async function getEpisodes(
    userId: string,
    pair: string,
    limit = 20,
    offset = 0,
    client?: SupabaseClient,
    options?: { includeArchived?: boolean }
) {
    const supabase = client || await getDefaultClient()
    let query = supabase
        .from('story_episodes')
        .select('id, pair, episode_number, season_number, title, current_phase, confidence, next_episode_preview, created_at')
        .eq('user_id', userId)
        .eq('pair', pair)

    if (!options?.includeArchived) {
        query = query.eq('archived', false)
    }

    const { data, error } = await query
        .order('episode_number', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
}

export async function getLatestEpisode(userId: string, pair: string, client?: SupabaseClient) {
    const supabase = client || await getDefaultClient()
    const { data, error } = await supabase
        .from('story_episodes')
        .select('*')
        .eq('user_id', userId)
        .eq('pair', pair)
        .order('episode_number', { ascending: false })
        .limit(1)
        .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
    return data || null
}

export async function getEpisodeById(episodeId: string) {
    const supabase = await getDefaultClient()
    const { data, error } = await supabase
        .from('story_episodes')
        .select('*')
        .eq('id', episodeId)
        .single()

    if (error) throw error
    return data
}

export async function createEpisode(
    userId: string,
    pair: string,
    episodeData: {
        episode_number: number,
        season_number?: number,
        title: string
        narrative: string
        characters: Record<string, unknown>
        current_phase: string
        key_levels?: Record<string, unknown>
        raw_ai_output?: Record<string, unknown>
        gemini_output?: Record<string, unknown>
        deepseek_output?: Record<string, unknown>
        news_context?: Record<string, unknown>
        confidence?: number
        next_episode_preview?: string
        agent_reports?: Record<string, unknown>
        generation_source?: 'manual' | 'cron' | 'bot'
        is_season_finale?: boolean
        episode_type?: 'analysis' | 'position_entry' | 'position_management'
        triggered_scenario_id?: string | null
    },
    client?: SupabaseClient
) {
    const supabase = client || await getDefaultClient()
    const { data, error } = await supabase
        .from('story_episodes')
        .insert({
            user_id: userId,
            pair,
            ...episodeData,
        })
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateEpisodeNarrative(episodeId: string, userId: string, narrative: string) {
    const supabase = await getDefaultClient()
    const { error } = await supabase
        .from('story_episodes')
        .update({ narrative })
        .eq('id', episodeId)
        .eq('user_id', userId)

    if (error) throw error
}

export async function getNextEpisodeNumber(userId: string, pair: string, client?: SupabaseClient): Promise<number> {
    const supabase = client || await getDefaultClient()
    const { data } = await supabase
        .from('story_episodes')
        .select('episode_number')
        .eq('user_id', userId)
        .eq('pair', pair)
        .order('episode_number', { ascending: false })
        .limit(1)
        .single()

    return (data?.episode_number || 0) + 1
}

// ── Scenarios ──

export async function getActiveScenarios(userId: string, pair: string) {
    const supabase = await getDefaultClient()
    const { data, error } = await supabase
        .from('story_scenarios')
        .select('*')
        .eq('user_id', userId)
        .eq('pair', pair)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function getScenariosForEpisode(episodeId: string, client?: SupabaseClient) {
    const supabase = client || await getDefaultClient()
    const { data, error } = await supabase
        .from('story_scenarios')
        .select('*')
        .eq('episode_id', episodeId)
        .order('probability', { ascending: false })

    if (error) throw error
    return data || []
}

export async function createScenarios(
    episodeId: string,
    userId: string,
    pair: string,
    scenarios: Array<{
        title: string
        description: string
        direction: string
        probability: number
        trigger_conditions: string
        invalidation: string
        trigger_level?: number
        trigger_direction?: 'above' | 'below'
        trigger_timeframe?: 'H1' | 'H4' | 'D'
        invalidation_level?: number
        invalidation_direction?: 'above' | 'below'
    }>,
    client?: SupabaseClient
) {
    const supabase = client || await getDefaultClient()
    const rows = scenarios.map(s => ({
        episode_id: episodeId,
        user_id: userId,
        pair,
        ...s,
    }))

    const { data, error } = await supabase
        .from('story_scenarios')
        .insert(rows)
        .select()

    if (error) throw error
    return data
}

export async function updateScenarioStatus(
    scenarioId: string,
    status: 'triggered' | 'invalidated' | 'expired',
    outcomeNotes?: string,
    resolvedBy?: 'manual' | 'bot' | 'expired',
    client?: SupabaseClient
) {
    const supabase = client || await getDefaultClient()
    const { error } = await supabase
        .from('story_scenarios')
        .update({
            status,
            outcome_notes: outcomeNotes || null,
            resolved_at: new Date().toISOString(),
            monitor_active: false,
            ...(resolvedBy ? { resolved_by: resolvedBy } : {}),
        })
        .eq('id', scenarioId)

    if (error) throw error
}

export async function getRecentlyResolvedScenarios(
    userId: string,
    pair: string,
    limit = 10,
    client?: SupabaseClient
) {
    const supabase = client || await getDefaultClient()
    const { data, error } = await supabase
        .from('story_scenarios')
        .select('*')
        .eq('user_id', userId)
        .eq('pair', pair)
        .in('status', ['triggered', 'invalidated', 'expired'])
        .order('resolved_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data || []
}

// ── Scenario Lifecycle ──

/**
 * When one scenario triggers, auto-invalidate its sibling from the same episode.
 * Binary pair logic: only one of the two scenarios can "win."
 */
export async function deactivateSiblingScenarios(
    triggeredScenarioId: string,
    episodeId: string,
    client: SupabaseClient
): Promise<number> {
    const { data, error } = await client
        .from('story_scenarios')
        .update({
            status: 'invalidated',
            outcome_notes: 'Auto-invalidated: sibling scenario triggered',
            resolved_at: new Date().toISOString(),
            resolved_by: 'bot',
            monitor_active: false,
        })
        .eq('episode_id', episodeId)
        .neq('id', triggeredScenarioId)
        .eq('status', 'active')
        .select('id')

    if (error) {
        console.error('[Stories] Failed to deactivate sibling scenarios:', error.message)
        return 0
    }
    return data?.length || 0
}

/**
 * Deactivate ALL active scenarios for a user+pair.
 * Called before creating new episode scenarios to prevent accumulation.
 */
export async function deactivateAllActiveScenariosForPair(
    userId: string,
    pair: string,
    reason: string,
    client: SupabaseClient
): Promise<number> {
    const { data, error } = await client
        .from('story_scenarios')
        .update({
            status: 'expired',
            outcome_notes: reason,
            resolved_at: new Date().toISOString(),
            resolved_by: 'bot',
            monitor_active: false,
        })
        .eq('user_id', userId)
        .eq('pair', pair)
        .eq('status', 'active')
        .select('id')

    if (error) {
        console.error('[Stories] Failed to deactivate scenarios for pair:', error.message)
        return 0
    }
    return data?.length || 0
}
