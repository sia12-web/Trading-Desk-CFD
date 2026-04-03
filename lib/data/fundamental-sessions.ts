/**
 * Fundamental Sessions Data Layer
 * CRUD operations for fundamental analysis sessions and messages
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FundamentalSession, FundamentalMessage, MacroContext } from '@/lib/fundamentals/types'

// ── Session Operations ──

/**
 * Create a new fundamental analysis session
 */
export async function createSession(
    client: SupabaseClient,
    userId: string,
    pair: string
): Promise<FundamentalSession | null> {
    try {
        const { data, error } = await client
            .from('fundamental_sessions')
            .insert({
                user_id: userId,
                pair,
                status: 'active',
            })
            .select()
            .single()

        if (error) {
            console.error('[FundamentalSessions] Failed to create session:', error)
            return null
        }

        return data
    } catch (error) {
        console.error('[FundamentalSessions] Create session error:', error)
        return null
    }
}

/**
 * Get user's fundamental sessions (optionally filtered by status)
 */
export async function getSessions(
    client: SupabaseClient,
    userId: string,
    options?: {
        status?: 'active' | 'archived'
        pair?: string
        limit?: number
    }
): Promise<FundamentalSession[]> {
    try {
        let query = client
            .from('fundamental_sessions')
            .select('*')
            .eq('user_id', userId)

        if (options?.status) {
            query = query.eq('status', options.status)
        }

        if (options?.pair) {
            query = query.eq('pair', options.pair)
        }

        query = query.order('updated_at', { ascending: false })

        if (options?.limit) {
            query = query.limit(options.limit)
        }

        const { data, error } = await query

        if (error) {
            console.error('[FundamentalSessions] Failed to get sessions:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[FundamentalSessions] Get sessions error:', error)
        return []
    }
}

/**
 * Get a single session with all its messages
 */
export async function getSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string
): Promise<{ session: FundamentalSession; messages: FundamentalMessage[] } | null> {
    try {
        // Get session
        const { data: session, error: sessionError } = await client
            .from('fundamental_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single()

        if (sessionError || !session) {
            console.error('[FundamentalSessions] Failed to get session:', sessionError)
            return null
        }

        // Get messages
        const { data: messages, error: messagesError } = await client
            .from('fundamental_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })

        if (messagesError) {
            console.error('[FundamentalSessions] Failed to get messages:', messagesError)
            return { session, messages: [] }
        }

        return { session, messages: messages || [] }
    } catch (error) {
        console.error('[FundamentalSessions] Get session error:', error)
        return null
    }
}

/**
 * Update session metadata
 */
export async function updateSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string,
    updates: {
        title?: string
        conclusion?: string
        status?: 'active' | 'archived'
        created_episode_id?: string
    }
): Promise<FundamentalSession | null> {
    try {
        const { data, error } = await client
            .from('fundamental_sessions')
            .update(updates)
            .eq('id', sessionId)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) {
            console.error('[FundamentalSessions] Failed to update session:', error)
            return null
        }

        return data
    } catch (error) {
        console.error('[FundamentalSessions] Update session error:', error)
        return null
    }
}

/**
 * Archive a session
 */
export async function archiveSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string
): Promise<boolean> {
    try {
        const { error } = await client
            .from('fundamental_sessions')
            .update({ status: 'archived' })
            .eq('id', sessionId)
            .eq('user_id', userId)

        if (error) {
            console.error('[FundamentalSessions] Failed to archive session:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('[FundamentalSessions] Archive session error:', error)
        return false
    }
}

/**
 * Delete a session (and all its messages via CASCADE)
 */
export async function deleteSession(
    client: SupabaseClient,
    sessionId: string,
    userId: string
): Promise<boolean> {
    try {
        const { error } = await client
            .from('fundamental_sessions')
            .delete()
            .eq('id', sessionId)
            .eq('user_id', userId)

        if (error) {
            console.error('[FundamentalSessions] Failed to delete session:', error)
            return false
        }

        return true
    } catch (error) {
        console.error('[FundamentalSessions] Delete session error:', error)
        return false
    }
}

// ── Message Operations ──

/**
 * Add a message to a session
 */
export async function addMessage(
    client: SupabaseClient,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    macroContext?: MacroContext
): Promise<FundamentalMessage | null> {
    try {
        const { data, error } = await client
            .from('fundamental_messages')
            .insert({
                session_id: sessionId,
                role,
                content,
                macro_context: macroContext || null,
            })
            .select()
            .single()

        if (error) {
            console.error('[FundamentalSessions] Failed to add message:', error)
            return null
        }

        return data
    } catch (error) {
        console.error('[FundamentalSessions] Add message error:', error)
        return null
    }
}

/**
 * Get all messages for a session
 */
export async function getMessages(
    client: SupabaseClient,
    sessionId: string
): Promise<FundamentalMessage[]> {
    try {
        const { data, error } = await client
            .from('fundamental_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('[FundamentalSessions] Failed to get messages:', error)
            return []
        }

        return data || []
    } catch (error) {
        console.error('[FundamentalSessions] Get messages error:', error)
        return []
    }
}

/**
 * Get the latest session for a pair (if active)
 */
export async function getLatestSessionForPair(
    client: SupabaseClient,
    userId: string,
    pair: string
): Promise<FundamentalSession | null> {
    try {
        const { data, error } = await client
            .from('fundamental_sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('pair', pair)
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('[FundamentalSessions] Failed to get latest session:', error)
            return null
        }

        return data
    } catch (error) {
        console.error('[FundamentalSessions] Get latest session error:', error)
        return null
    }
}

/**
 * Count active sessions for a user
 */
export async function getActiveSessionCount(
    client: SupabaseClient,
    userId: string
): Promise<number> {
    try {
        const { count, error } = await client
            .from('fundamental_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active')

        if (error) {
            console.error('[FundamentalSessions] Failed to count sessions:', error)
            return 0
        }

        return count || 0
    } catch (error) {
        console.error('[FundamentalSessions] Count sessions error:', error)
        return 0
    }
}
