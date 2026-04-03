/**
 * Fundamental Session Messages API
 * POST: Add user message and get AI response
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, addMessage } from '@/lib/data/fundamental-sessions'
import { generateAnalystResponse } from '@/lib/fundamentals/analyst'

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
        const { content } = await req.json()

        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
        }

        // Get session to verify ownership and get context
        const result = await getSession(supabase, sessionId, user.id)
        if (!result) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const { session, messages } = result

        console.log(`[Fundamentals API] Adding user message to session ${sessionId}...`)

        // Add user message
        const userMessage = await addMessage(supabase, sessionId, 'user', content)
        if (!userMessage) {
            return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
        }

        // Generate AI response
        console.log(`[Fundamentals API] Generating AI response for session ${sessionId}...`)
        const aiResponse = await generateAnalystResponse(
            session.pair,
            [...messages, userMessage],
            user.id,
            supabase
        )

        if (!aiResponse) {
            return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
        }

        // Add assistant message
        const assistantMessage = await addMessage(supabase, sessionId, 'assistant', aiResponse)
        if (!assistantMessage) {
            return NextResponse.json({ error: 'Failed to add AI response' }, { status: 500 })
        }

        console.log(`[Fundamentals API] Session ${sessionId} updated with user + AI messages`)

        return NextResponse.json({
            userMessage,
            assistantMessage,
        })
    } catch (error) {
        console.error('[Fundamentals API] POST message error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
