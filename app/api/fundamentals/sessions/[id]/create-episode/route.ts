/**
 * Create Story Episode from Fundamental Session
 * POST: Generate a story episode based on fundamental conclusions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, updateSession } from '@/lib/data/fundamental-sessions'
import { checkRateLimit } from '@/lib/ai/rate-limiter'
import { createTask } from '@/lib/background-tasks/manager'
import { generateStory } from '@/lib/story/pipeline'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()

        // Verify auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: sessionId } = await params

        // Get session to verify ownership and get conclusion
        const result = await getSession(supabase, sessionId, user.id)
        if (!result) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const { session } = result

        if (!session.conclusion) {
            return NextResponse.json(
                { error: 'Session must have a conclusion before creating an episode' },
                { status: 400 }
            )
        }

        console.log(`[Fundamentals API] Creating story episode from session ${sessionId}...`)

        // Rate limit check
        const limit = await checkRateLimit(user.id)
        if (!limit.allowed) {
            const minutes = Math.ceil(limit.resetIn / 60_000)
            return NextResponse.json(
                { error: `Rate limit exceeded. Try again in ${minutes} minutes.` },
                { status: 429 }
            )
        }

        // Create background task
        const taskId = await createTask(user.id, 'story_generation', {
            pair: session.pair,
            source: 'fundamental_session',
            sessionId: session.id,
        })

        // Fire and forget — pipeline runs in background
        // Note: Episode linking happens automatically - user can view the episode on Story page
        generateStory(user.id, session.pair, taskId).catch(err => {
            console.error(`[Fundamentals API] Episode generation failed for session ${sessionId}:`, err)
        })

        // Archive session immediately since we've triggered episode creation
        await updateSession(supabase, sessionId, user.id, {
            status: 'archived',
        })

        console.log(`[Fundamentals API] Queued episode generation for ${session.pair} from session ${sessionId} (taskId: ${taskId})`)

        return NextResponse.json({
            taskId,
            remaining: limit.remaining,
            message: 'Story episode generation started',
        })
    } catch (error) {
        console.error('[Fundamentals API] Create episode error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
