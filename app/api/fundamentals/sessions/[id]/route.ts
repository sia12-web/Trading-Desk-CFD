/**
 * Single Fundamental Session API
 * GET: Get session with all messages
 * PATCH: Update session (title, conclusion, status)
 * DELETE: Delete session
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, updateSession, deleteSession } from '@/lib/data/fundamental-sessions'

export async function GET(
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

        const { id } = await params

        const result = await getSession(supabase, id, user.id)
        if (!result) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[Fundamentals API] GET session error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function PATCH(
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

        const { id } = await params
        const updates = await req.json()

        // Validate updates
        const allowedFields = ['title', 'conclusion', 'status', 'created_episode_id']
        const validUpdates: any = {}
        for (const key of allowedFields) {
            if (key in updates) {
                validUpdates[key] = updates[key]
            }
        }

        if (Object.keys(validUpdates).length === 0) {
            return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
        }

        const session = await updateSession(supabase, id, user.id, validUpdates)
        if (!session) {
            return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
        }

        return NextResponse.json({ session })
    } catch (error) {
        console.error('[Fundamentals API] PATCH session error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function DELETE(
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

        const { id } = await params

        const success = await deleteSession(supabase, id, user.id)
        if (!success) {
            return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Fundamentals API] DELETE session error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
