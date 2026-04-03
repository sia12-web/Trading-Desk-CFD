/**
 * Fundamental Analyst AI
 * Uses Claude Opus for deep macro reasoning and fundamental analysis
 */

import { callClaude } from '@/lib/ai/clients'
import type { FundamentalMessage } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getMacroContext } from './macro-context'

/**
 * Generate analyst response to user's fundamental analysis question
 */
export async function generateAnalystResponse(
    pair: string,
    messages: FundamentalMessage[],
    userId: string,
    client: SupabaseClient
): Promise<string | null> {
    try {
        console.log(`[FundamentalAnalyst] Generating response for ${pair}...`)

        // Get latest macro context for fresh analysis
        const macroContext = await getMacroContext(pair, userId, client)

        // Build conversation history
        const conversationHistory = messages
            .map(msg => `${msg.role === 'user' ? 'USER' : 'ANALYST'}: ${msg.content}`)
            .join('\n\n---\n\n')

        // Get the user's latest question
        const latestUserMessage = messages.filter(m => m.role === 'user').pop()
        if (!latestUserMessage) {
            console.error('[FundamentalAnalyst] No user messages found')
            return null
        }

        // Build comprehensive prompt
        const prompt = buildAnalystPrompt(pair, conversationHistory, macroContext)

        // Call Claude Opus for deep macro reasoning
        const response = await callClaude(prompt, {
            model: 'claude-opus-4-6',
            maxTokens: 8192,
            timeout: 90_000,
            system: buildSystemPrompt(),
            usage: {
                userId,
                feature: 'fundamental_analysis',
            },
        })

        return response
    } catch (error) {
        console.error('[FundamentalAnalyst] Failed to generate response:', error)
        return null
    }
}

/**
 * Build system prompt for fundamental analyst
 */
function buildSystemPrompt(): string {
    return `You are a senior macro-economic analyst specializing in currency markets. Your role is to help traders understand the fundamental forces driving currency pairs and make informed trading decisions.

## Your Responsibilities

1. **Macro Analysis**: Analyze economic data, central bank policy, geopolitical events, and market sentiment
2. **Interest Rate Differentials**: Explain how rate expectations drive currency flows
3. **Economic Divergence**: Identify growth, inflation, and policy divergences between economies
4. **Technical-Fundamental Convergence**: Correlate fundamental outlook with current technical story
5. **Actionable Insights**: Provide clear directional bias and key levels to watch
6. **Risk Assessment**: Identify upcoming catalysts and event risks

## Analysis Framework

When analyzing fundamentals, consider:
- **Monetary Policy**: Current rates, stance (hawkish/dovish/neutral), forward guidance
- **Economic Growth**: GDP trends, employment, manufacturing/services data
- **Inflation**: CPI trends, central bank targets, supply/demand dynamics
- **Geopolitical**: Political stability, trade relations, fiscal policy
- **Market Sentiment**: Risk appetite, flows, positioning
- **Event Risk**: Upcoming data releases, central bank meetings, elections

## Communication Style

- Be direct and analytical, not conversational or verbose
- Use numbered lists for clarity
- Cite specific data points (rates, GDP, CPI, etc.)
- Provide directional bias when analysis supports it
- Flag divergences between technicals and fundamentals
- Suggest creating a story episode when you've reached a clear conclusion

## Important Notes

- If technical story suggests one direction but fundamentals suggest another, FLAG THIS DIVERGENCE
- When you've helped the user reach a clear conclusion, suggest they create a story episode
- Don't be overly bearish or bullish without data support
- Acknowledge uncertainty when data is mixed or contradictory`
}

/**
 * Build the analyst prompt with macro context
 */
function buildAnalystPrompt(pair: string, conversationHistory: string, macroContext: any): string {
    const [base, quote] = pair.split('/')

    let prompt = `# Fundamental Analysis Session: ${pair}\n\n`

    // Include latest macro context
    prompt += `## Current Macro Context\n\n`

    // Recent news
    if (macroContext.recentNews && macroContext.recentNews.length > 0) {
        prompt += `### Recent News Highlights\n\n`
        macroContext.recentNews.slice(0, 8).forEach((item: any) => {
            prompt += `- **${item.title}** (${item.currency}, ${item.sentiment || 'neutral'})\n`
            prompt += `  ${item.summary}\n\n`
        })
    }

    // Upcoming events
    if (macroContext.upcomingEvents && macroContext.upcomingEvents.length > 0) {
        prompt += `### Upcoming Economic Events\n\n`
        macroContext.upcomingEvents.slice(0, 8).forEach((event: any) => {
            const date = new Date(event.date).toLocaleDateString()
            prompt += `- **${event.title}** (${event.currency}, ${event.impact} impact) - ${date}\n`
            if (event.forecast) prompt += `  Forecast: ${event.forecast}`
            if (event.previous) prompt += ` | Previous: ${event.previous}`
            prompt += `\n`
        })
        prompt += `\n`
    }

    // Central bank policy
    if (macroContext.centralBankPolicy) {
        prompt += `### Central Bank Policy\n\n`
        for (const [currency, policy] of Object.entries(macroContext.centralBankPolicy)) {
            const p = policy as any
            prompt += `**${currency}**\n`
            prompt += `- Current Rate: ${p.currentRate}%\n`
            prompt += `- Stance: ${p.stance.toUpperCase()}\n`
            prompt += `- Last Meeting: ${p.lastMeeting}\n`
            prompt += `- Next Meeting: ${p.nextMeeting}\n`
            prompt += `- Summary: ${p.summary}\n\n`
        }
    }

    // Economic indicators
    if (macroContext.economicIndicators) {
        prompt += `### Economic Indicators\n\n`
        for (const [currency, indicators] of Object.entries(macroContext.economicIndicators)) {
            const ind = indicators as any
            prompt += `**${currency}**\n`
            if (ind.gdpGrowth !== undefined) prompt += `- GDP Growth: ${ind.gdpGrowth}%\n`
            if (ind.inflation !== undefined) prompt += `- Inflation: ${ind.inflation}%\n`
            if (ind.unemployment !== undefined) prompt += `- Unemployment: ${ind.unemployment}%\n`
            prompt += `- ${ind.summary}\n\n`
        }
    }

    // Current technical story context
    if (macroContext.currentStoryContext?.latestEpisode) {
        const ep = macroContext.currentStoryContext.latestEpisode
        prompt += `### Current Technical Story\n\n`
        prompt += `**Episode ${ep.episode_number}: ${ep.title}**\n`
        prompt += `- Phase: ${ep.current_phase}\n`
        prompt += `- Confidence: ${Math.round(ep.confidence * 100)}%\n\n`

        if (macroContext.currentStoryContext?.activeScenarios && macroContext.currentStoryContext.activeScenarios.length > 0) {
            prompt += `**Active Scenarios:**\n`
            macroContext.currentStoryContext.activeScenarios.forEach((s: any) => {
                prompt += `- ${s.title} (${s.direction}, ${Math.round(s.probability * 100)}% probability)\n`
            })
            prompt += `\n`
        }

        if (macroContext.currentStoryContext?.activePosition) {
            const pos = macroContext.currentStoryContext.activePosition
            prompt += `**Active Position:**\n`
            prompt += `- Direction: ${pos.direction.toUpperCase()}\n`
            prompt += `- Entry: ${pos.entry_price}\n`
            prompt += `- Stop Loss: ${pos.current_stop_loss}\n\n`
        }

        prompt += `---\n\n`
    }

    // Conversation history
    prompt += `## Conversation History\n\n`
    prompt += conversationHistory
    prompt += `\n\n---\n\n`

    // Analysis instructions
    prompt += `## Your Task\n\n`
    prompt += `Respond to the user's latest question with comprehensive fundamental analysis. Use the macro context above to:\n\n`
    prompt += `1. Address their specific question directly\n`
    prompt += `2. Analyze interest rate differentials and monetary policy divergence\n`
    prompt += `3. Assess economic growth and inflation trends for both currencies\n`
    prompt += `4. Identify upcoming catalysts and event risks\n`
    prompt += `5. Provide a directional bias if the data supports it\n`
    prompt += `6. **IMPORTANT**: If technical story exists, analyze fundamental-technical convergence/divergence\n\n`
    prompt += `If you've reached a clear fundamental conclusion that could inform a trading decision, end your response with:\n\n`
    prompt += `"📊 **Ready to translate this fundamental analysis into a story episode?** Once you're satisfied with our conclusions, I can create a new technical episode that incorporates this macro context."\n\n`
    prompt += `Be analytical, cite specific data, and provide actionable insights.`

    return prompt
}

/**
 * Generate conclusion summary from conversation
 * Used when creating a story episode from fundamental session
 */
export async function generateConclusionSummary(
    pair: string,
    messages: FundamentalMessage[],
    userId: string
): Promise<string | null> {
    try {
        console.log(`[FundamentalAnalyst] Generating conclusion summary for ${pair}...`)

        // Build conversation history
        const conversationHistory = messages
            .map(msg => `${msg.role === 'user' ? 'USER' : 'ANALYST'}: ${msg.content}`)
            .join('\n\n---\n\n')

        const prompt = `# Fundamental Analysis Conclusion Summary\n\n`
            + `You analyzed the fundamental landscape for ${pair}. Here's the full conversation:\n\n`
            + `${conversationHistory}\n\n`
            + `---\n\n`
            + `Please provide a concise summary (3-5 bullet points) of the key fundamental conclusions that should inform the technical story:\n\n`
            + `- What's the directional bias from fundamentals?\n`
            + `- What are the key drivers (rate differentials, growth, sentiment, etc.)?\n`
            + `- What are the critical upcoming catalysts to watch?\n`
            + `- Are there any fundamental-technical divergences to note?\n\n`
            + `Keep it brief and actionable - this will be used to enhance the story episode generation.`

        const response = await callClaude(prompt, {
            model: 'claude-opus-4-6',
            maxTokens: 2048,
            timeout: 60_000,
            usage: {
                userId,
                feature: 'fundamental_conclusion',
            },
        })

        return response
    } catch (error) {
        console.error('[FundamentalAnalyst] Failed to generate conclusion:', error)
        return null
    }
}
