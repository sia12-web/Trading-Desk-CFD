/**
 * Fundamental Sessions API
 * POST: Create new session
 * GET: List user's sessions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSession, getSessions } from '@/lib/data/fundamental-sessions'
import { getMacroContext } from '@/lib/fundamentals/macro-context'
import { addMessage } from '@/lib/data/fundamental-sessions'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()

        // Verify auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { pair } = await req.json()

        if (!pair || typeof pair !== 'string') {
            return NextResponse.json({ error: 'Pair is required' }, { status: 400 })
        }

        console.log(`[Fundamentals API] Creating session for ${pair}...`)

        // Create session
        const session = await createSession(supabase, user.id, pair)
        if (!session) {
            return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
        }

        // Fetch macro context for first message
        console.log(`[Fundamentals API] Fetching macro context for ${pair}...`)
        const macroContext = await getMacroContext(pair, user.id, supabase)

        // Build auto-populated first message
        const firstMessage = buildFirstMessage(pair, macroContext)

        // Add assistant's first message with macro context
        await addMessage(supabase, session.id, 'assistant', firstMessage, macroContext)

        console.log(`[Fundamentals API] Session ${session.id} created with macro context`)

        return NextResponse.json({ session })
    } catch (error) {
        console.error('[Fundamentals API] POST error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()

        // Verify auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse query params
        const { searchParams } = new URL(req.url)
        const status = searchParams.get('status') as 'active' | 'archived' | null
        const pair = searchParams.get('pair')
        const limit = searchParams.get('limit')

        const sessions = await getSessions(supabase, user.id, {
            status: status || undefined,
            pair: pair || undefined,
            limit: limit ? parseInt(limit) : undefined,
        })

        return NextResponse.json({ sessions })
    } catch (error) {
        console.error('[Fundamentals API] GET error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * Build the auto-populated first message with macro context
 */
function buildFirstMessage(pair: string, macroContext: any): string {
    const [base, quote] = pair.split('/')

    let message = `# Macro Analysis: ${pair}\n\nLet's analyze the fundamental landscape for this currency pair.\n\n`

    // Recent news
    if (macroContext.recentNews && macroContext.recentNews.length > 0) {
        message += `## Recent News (Past 7 Days)\n\n`
        macroContext.recentNews.slice(0, 5).forEach((item: any) => {
            message += `**${item.title}** (${item.currency})\n`
            message += `${item.summary}\n`
            message += `*Sentiment: ${item.sentiment || 'neutral'}*\n\n`
        })
    }

    // Upcoming events
    if (macroContext.upcomingEvents && macroContext.upcomingEvents.length > 0) {
        message += `## Upcoming Economic Events\n\n`
        macroContext.upcomingEvents.slice(0, 5).forEach((event: any) => {
            message += `**${event.title}** (${event.currency}) - ${new Date(event.date).toLocaleDateString()}\n`
            message += `Impact: ${event.impact.toUpperCase()}`
            if (event.forecast) message += ` | Forecast: ${event.forecast}`
            if (event.previous) message += ` | Previous: ${event.previous}`
            message += `\n\n`
        })
    }

    // Central bank policy
    if (macroContext.centralBankPolicy) {
        message += `## Central Bank Stances\n\n`
        for (const [currency, policy] of Object.entries(macroContext.centralBankPolicy)) {
            const p = policy as any
            message += `**${currency}** (${p.currentRate}% rate)\n`
            message += `Stance: ${p.stance.toUpperCase()}\n`
            message += `${p.summary}\n\n`
        }
    }

    // Economic indicators
    if (macroContext.economicIndicators) {
        message += `## Economic Indicators\n\n`
        for (const [currency, indicators] of Object.entries(macroContext.economicIndicators)) {
            const ind = indicators as any
            message += `**${currency}**\n`
            if (ind.gdpGrowth !== undefined) message += `- GDP Growth: ${ind.gdpGrowth}%\n`
            if (ind.inflation !== undefined) message += `- Inflation: ${ind.inflation}%\n`
            if (ind.unemployment !== undefined) message += `- Unemployment: ${ind.unemployment}%\n`
            message += `\n`
        }
    }

    // Current story context
    if (macroContext.currentStoryContext?.latestEpisode) {
        const ep = macroContext.currentStoryContext.latestEpisode
        message += `## Current Technical Story\n\n`
        message += `**Episode ${ep.episode_number}: ${ep.title}**\n`
        message += `Phase: ${ep.current_phase} | Confidence: ${Math.round(ep.confidence * 100)}%\n\n`
    }

    if (macroContext.currentStoryContext?.activeScenarios && macroContext.currentStoryContext.activeScenarios.length > 0) {
        message += `Active Scenarios:\n`
        macroContext.currentStoryContext.activeScenarios.forEach((s: any) => {
            message += `- ${s.title} (${s.direction}, ${Math.round(s.probability * 100)}%)\n`
        })
        message += `\n`
    }

    message += `---\n\nWhat fundamental factors would you like to discuss? I can help analyze:\n`
    message += `- Interest rate differentials and central bank expectations\n`
    message += `- Economic growth trends and divergences\n`
    message += `- Geopolitical risks and market sentiment\n`
    message += `- Technical-fundamental convergence/divergence\n`

    return message
}
