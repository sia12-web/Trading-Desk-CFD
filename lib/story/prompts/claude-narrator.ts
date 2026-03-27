import type { StoryDataPayload, StoryNewsContext } from '../types'
import type { StoryBible } from '../bible'
import type { AgentIntelligence } from '../agents/types'

interface PreviousEpisode {
    episode_number: number
    title: string
    narrative: string
    current_phase: string
    next_episode_preview: string | null
    scenarios?: Array<{
        title: string
        status: string
        direction: string
    }>
}

interface ResolvedScenario {
    title: string
    direction: string
    status: string
    outcome_notes: string | null
    probability: number
    episode_id: string
    resolved_at: string | null
}

/**
 * Claude "Story Narrator" prompt — the Decision Architect for the Story feature.
 * Synthesizes Gemini structural + DeepSeek quant into a compelling narrative.
 *
 * V2: Uses Story Bible for long-term memory + resolved scenarios for continuity.
 */
export function buildStoryNarratorPrompt(
    data: StoryDataPayload,
    geminiOutput: string,
    deepseekOutput: string,
    news: StoryNewsContext,
    lastEpisode: PreviousEpisode | null,
    bible: StoryBible | null,
    resolvedScenarios: ResolvedScenario[],
    agentIntelligence?: AgentIntelligence,
    flaggedLevels?: Array<{ level: number; source: string; reason: string }>
): string {
    // ── Story Bible block ──
    const bibleBlock = bible
        ? `## STORY BIBLE (Full Arc Memory)

**Arc Summary:**
${bible.arc_summary}

**Key Events (${bible.key_events.length} recorded):**
${bible.key_events.map((e: { episode_number: number; event: string; significance: string }) =>
    `- Ep.${e.episode_number}: ${e.event} (${e.significance})`
).join('\n') || 'None yet'}

**Character Evolution:**
- Buyers: ${(bible.character_evolution as { buyers?: { arc?: string; turning_points?: string[] } })?.buyers?.arc || 'No arc yet'}
  Turning points: ${(bible.character_evolution as { buyers?: { arc?: string; turning_points?: string[] } })?.buyers?.turning_points?.join(', ') || 'None'}
- Sellers: ${(bible.character_evolution as { sellers?: { arc?: string; turning_points?: string[] } })?.sellers?.arc || 'No arc yet'}
  Turning points: ${(bible.character_evolution as { sellers?: { arc?: string; turning_points?: string[] } })?.sellers?.turning_points?.join(', ') || 'None'}

**Unresolved Threads:**
${(bible.unresolved_threads as Array<{ thread: string; introduced_episode: number; description: string }>).map(t =>
    `- "${t.thread}" (since Ep.${t.introduced_episode}): ${t.description}`
).join('\n') || 'None'}

**Dominant Themes:** ${bible.dominant_themes?.join(', ') || 'None established'}

**Episodes so far:** ${bible.episode_count}`
        : `## STORY BIBLE (Full Arc Memory)

This is the FIRST episode — no previous history exists. You are starting a brand new story.
Create the initial bible from scratch based on this episode's analysis.`

    // ── Last episode block ──
    const lastEpisodeBlock = lastEpisode
        ? `## LAST EPISODE (Immediate Continuity)

**Episode ${lastEpisode.episode_number}: "${lastEpisode.title}"**
Phase: ${lastEpisode.current_phase}
Preview for next: ${lastEpisode.next_episode_preview || 'None'}

**Full Narrative:**
${lastEpisode.narrative}

**Scenarios:**
${lastEpisode.scenarios?.map(s => `- "${s.title}" (${s.direction}) — ${s.status}`).join('\n') || 'No scenarios recorded'}`
        : `## LAST EPISODE (Immediate Continuity)

No previous episode exists. This is the series premiere.`

    // ── Resolved scenarios block ──
    const resolvedBlock = resolvedScenarios.length > 0
        ? `## RECENTLY RESOLVED SCENARIOS

The following scenarios from previous episodes have been resolved by the trader. You MUST acknowledge these outcomes in your narrative — reference what happened and how it affects the ongoing story.

${resolvedScenarios.map(s =>
    `- "${s.title}" (${s.direction}) — **${s.status.toUpperCase()}**${s.outcome_notes ? `: ${s.outcome_notes}` : ''} (resolved ${s.resolved_at ? new Date(s.resolved_at).toLocaleDateString() : 'recently'})`
).join('\n')}`
        : ''

    // ── Intelligence briefing block ──
    const intelligenceBlock = buildIntelligenceBriefing(agentIntelligence)

    const currentEpisodeNumber = (lastEpisode?.episode_number || 0) + 1

    // ── Trades block ──
    const trades = data.recent_trades || []
    const tradesBlock = trades.length > 0
        ? `## RECENT TRADES (OANDA Journal)
The trader has been active in this pair since the last episode:
${trades.map(t => `- **${t.direction.toUpperCase()}** at ${t.entry_price} (${t.status}) — SL: ${t.stop_loss || 'None'}, TP: ${t.take_profit || 'None'}${t.closed_at ? `. CLOSED at ${t.exit_price}` : '. POSITION ACTIVE.'}`).join('\n')}

**TASK**: Reference these trades in your story. How do they fit the scenarios? Did we execute the buyer/seller plan correctly? If the trader is deep in a position, the narrative tension should reflect that.`
        : 'No recent trades recorded for this pair since the last episode.'

    return `You are the Story Narrator — a master storyteller AND economist who turns forex market data into compelling narratives enriched with fundamental intelligence.

# THE STORY OF ${data.pair}

Think of ${data.pair} as a TV show you've been following. The buyers and sellers are characters with motivations, strengths, and weaknesses. Each analysis is a new episode in an ongoing story.

## YOUR CHARACTER FRAMEWORK
- **Buyers** = the bulls. They want price to go up. Their weapons: demand zones, support levels, bullish patterns.
- **Sellers** = the bears. They want price to go down. Their weapons: supply zones, resistance levels, bearish patterns.
- **Smart Money** = the institutional players. They manipulate price to grab liquidity before making their real move.
- **AMD Cycle** = the rhythm of the show: Accumulation (quiet buildup) → Manipulation (fake move/stop hunt) → Distribution (the real directional move)

${bibleBlock}

${lastEpisodeBlock}

${resolvedBlock}

${intelligenceBlock}

## CURRENT DATA (Episode ${currentEpisodeNumber})

### Gemini's Structural Analysis
${geminiOutput}

### DeepSeek's Quantitative Validation
${deepseekOutput}
${flaggedLevels && flaggedLevels.length > 0 ? `
### ⚠️ FLAGGED LEVELS (DO NOT USE)
DeepSeek flagged the following levels as potentially fabricated — do NOT reference them:
${flaggedLevels.map(f => `- ${f.level} (${f.source}): ${f.reason}`).join('\n')}
` : ''}
### Market Context
- Current Price: ${data.currentPrice.toFixed(5)}
- Volatility: ${data.volatilityStatus} (ATR14: ${data.atr14.toFixed(1)} pips)
- News Sentiment: ${news.sentiment}
- Key Drivers: ${news.key_drivers.join(', ')}
- ${news.fundamental_narrative}
${news.avoidTrading ? '\n⚠️ HIGH-IMPACT NEWS IMMINENT — factor this into the story.' : ''}

### AMD Phase Summary
${Object.entries(data.amdPhases).map(([tf, p]) => `- ${tf}: ${p.phase} (${p.confidence}%)`).join('\n')}

## YOUR TASK

Write Episode ${currentEpisodeNumber} of the ${data.pair} story. Respond with this exact JSON structure:

{
  "story_title": "A compelling episode title (like a TV episode name)",
  "narrative": "A markdown-formatted narrative (3-5 paragraphs) that tells the story of what's happening in this pair RIGHT NOW. Use character metaphors (buyers/sellers as characters). Reference AMD phases. Make it engaging but technically accurate. Include specific price levels. Reference what happened in previous episodes if applicable. If scenarios were recently resolved, acknowledge the outcomes.",
  "characters": {
    "buyers": {
      "strength": "dominant" | "strong" | "balanced" | "weak" | "exhausted",
      "momentum": "Brief description of buyer momentum",
      "narrative": "2-3 sentences about what the buyers are doing"
    },
    "sellers": {
      "strength": "dominant" | "strong" | "balanced" | "weak" | "exhausted",
      "momentum": "Brief description of seller momentum",
      "narrative": "2-3 sentences about what the sellers are doing"
    }
  },
  "current_phase": "accumulation" | "manipulation" | "distribution",
  "scenarios": [
    {
      "id": "scenario_a",
      "title": "Scenario A title (the more likely scenario)",
      "description": "What happens in this scenario. Be specific about price movements.",
      "probability": 0.0-1.0,
      "trigger_conditions": "Natural language description of what confirms this scenario",
      "invalidation": "Natural language description of what kills this scenario",
      "direction": "bullish" | "bearish",
      "trigger_level": 1.2345,
      "trigger_direction": "above" | "below",
      "invalidation_level": 1.1900,
      "invalidation_direction": "above" | "below"
    },
    {
      "id": "scenario_b",
      "title": "Scenario B title (the alternative)",
      "description": "What happens in this scenario.",
      "probability": 0.0-1.0,
      "trigger_conditions": "Natural language trigger conditions",
      "invalidation": "Natural language invalidation conditions",
      "direction": "bullish" | "bearish",
      "trigger_level": 1.1900,
      "trigger_direction": "above" | "below",
      "invalidation_level": 1.2345,
      "invalidation_direction": "above" | "below"
    }
  ],
  "key_levels": {
    "entries": [price1, price2],
    "stop_losses": [price1],
    "take_profits": [price1, price2, price3]
  },
  "next_episode_preview": "A teaser for what to watch for in the next episode (1-2 sentences)",
  "confidence": 0.0-1.0,
  "bible_update": {
    "arc_summary": "The COMPLETE arc summary for this pair's story so far, INCLUDING this episode's developments. This replaces the previous arc_summary entirely — do not just describe this episode, summarize the FULL story arc from episode 1 through now.",
    "key_events": [
      {"episode_number": 1, "event": "Description of key event", "significance": "Why it matters for the story"}
    ],
    "character_evolution": {
      "buyers": {"arc": "The full character arc of buyers from episode 1 to now", "turning_points": ["Key moments that changed buyers' trajectory"]},
      "sellers": {"arc": "The full character arc of sellers from episode 1 to now", "turning_points": ["Key moments that changed sellers' trajectory"]}
    },
    "unresolved_threads": [
      {"thread": "Thread name", "introduced_episode": 1, "description": "What this thread is about and why it matters"}
    ],
    "resolved_threads": [
      {"thread": "Thread name", "introduced_episode": 1, "resolved_episode": ${currentEpisodeNumber}, "outcome": "How this thread resolved"}
    ],
    "dominant_themes": ["Theme 1", "Theme 2"]
  }
}

IMPORTANT RULES:
- The narrative must be engaging but grounded in the data
- Always provide exactly 2 scenarios (binary decision tree)
- Scenario probabilities must sum to ~1.0
- Key levels must be precise prices from the analysis
- Reference AMD phases naturally in the narrative
- If previous episodes exist, maintain continuity (reference what happened before)
- If scenarios were recently resolved, acknowledge the outcomes in your narrative
- The story should help the trader UNDERSTAND the market, not just give signals

ANTI-HALLUCINATION RULES (MANDATORY):
- Every price level you cite MUST come from Gemini's structural analysis or DeepSeek's quantitative validation. NEVER invent levels.
- If DeepSeek flagged any levels in "flagged_levels", DO NOT use those levels in your narrative or scenarios.
- For every price claim, state which timeframe supports it (e.g., "the Weekly resistance at 1.2150").
- All price levels must be within 3x ATR of the current price (${data.currentPrice.toFixed(5)}, ATR14: ${data.atr14.toFixed(1)} pips). Levels beyond this range are almost certainly fabricated.
- scenario trigger_level and invalidation_level must come from key_levels or Gemini/DeepSeek analysis, never invented.

STRUCTURED LEVEL RULES (for scenario monitoring bot):
- Each scenario MUST include trigger_level (number) + trigger_direction ("above" or "below")
- Each scenario MUST include invalidation_level (number) + invalidation_direction ("above" or "below")
- trigger_level is the KEY price that confirms the scenario (e.g., a breakout above resistance)
- invalidation_level is the KEY price that kills the scenario (e.g., a break below support)
- Trigger and invalidation must be on OPPOSITE sides of the current price (${data.currentPrice.toFixed(5)})
- These levels must come from key_levels or the Gemini/DeepSeek analysis — never invented

INTELLIGENCE INTEGRATION RULES:
- You are BOTH a technical analyst AND an economist/fundamentalist
- Weave the Optimizer's market regime into why certain patterns matter more
- Use the News Agent's central bank analysis to explain WHY buyers/sellers are strengthening
- Use the Cross-Market Agent's risk-on/risk-off to explain global money flow effects
- Scenarios MUST account for fundamental catalysts, not just technical levels
- If cross-market divergences exist, they become narrative tension points
- DO NOT just list intelligence data — WEAVE it into the story naturally

BIBLE UPDATE RULES:
- arc_summary: Write the FULL arc from episode 1 to now (replaces previous). This is your 'Previously on...' memory buffer — keep it tight but informative for FUTURE episodes so we don't need to read old narratives.
- key_events: Include significant plot points. Highlight which scenarios played a role. Cap at 15.
- trade_history_summary: A concise recap of ANY positions taken since the last episode (or in the previous season), their entry/exit reasons, and how they relate to the scenarios.
- unresolved_threads: All narrative/market threads that are STILL active.
- resolved_threads: Anything resolved in THIS episode.
- dominant_themes: The 3-5 main themes of this pair's story.

is_season_finale: Set to true ONLY if the current narrative arc has reached a logical conclusion (e.g., a major level was hit, a trend reversed, or a multi-day scenario completed). Ending a season generates a compact season summary for long-term memory.`
}

/**
 * Build the narrator prompt split into cacheable prefix and dynamic content.
 * The prefix (identity + rules + schema) stays stable across pairs → cache hits on sequential runs.
 * The dynamic part (Gemini/DeepSeek output + market data + Bible + episodes) changes per pair.
 */
export function buildStoryNarratorPromptCached(
    data: StoryDataPayload,
    geminiOutput: string,
    deepseekOutput: string,
    news: StoryNewsContext,
    lastEpisode: Parameters<typeof buildStoryNarratorPrompt>[4],
    bible: StoryBible | null,
    resolvedScenarios: Parameters<typeof buildStoryNarratorPrompt>[6],
    agentIntelligence?: AgentIntelligence,
    flaggedLevels?: Array<{ level: number; source: string; reason: string }>
): { cacheablePrefix: string; dynamicPrompt: string } {
    // Get the full prompt and split it
    const fullPrompt = buildStoryNarratorPrompt(
        data, geminiOutput, deepseekOutput, news,
        lastEpisode, bible, resolvedScenarios,
        agentIntelligence, flaggedLevels
    )

    // Split at "## CURRENT DATA" — everything before is relatively stable (identity + Bible + rules)
    // and everything after is dynamic (Gemini/DeepSeek output + market data)
    const splitMarker = '## CURRENT DATA'
    const splitIndex = fullPrompt.indexOf(splitMarker)

    if (splitIndex === -1) {
        // Fallback: no caching if marker not found
        return { cacheablePrefix: fullPrompt, dynamicPrompt: '' }
    }

    return {
        cacheablePrefix: fullPrompt.slice(0, splitIndex).trim(),
        dynamicPrompt: fullPrompt.slice(splitIndex).trim(),
    }
}

/**
 * Build the intelligence briefing block from daily agent reports.
 * Gracefully handles null (agent unavailable) for each section.
 */
function buildIntelligenceBriefing(intelligence?: AgentIntelligence): string {
    if (!intelligence) return ''

    const { optimizer, news, crossMarket } = intelligence
    const hasAny = optimizer || news || crossMarket
    if (!hasAny) return ''

    const sections: string[] = ['## INTELLIGENCE BRIEFING (from Daily Agents)']

    // ── Optimizer section ──
    if (optimizer) {
        const optimizations = optimizer.optimizations
            .filter(o => o.confidence >= 60)
            .slice(0, 8)
            .map(o => `- ${o.timeframe} ${o.indicator}: ${o.reasoning}`)
            .join('\n')

        sections.push(`### Indicator Health Report (Optimizer Agent)
Market Regime: ${optimizer.market_regime}
${optimizer.regime_implications}
${optimizations ? `Key Optimizations:\n${optimizations}` : 'No significant optimizations recommended.'}
Executive Summary: ${optimizer.summary}`)
    } else {
        sections.push(`### Indicator Health Report (Optimizer Agent)
Report unavailable today.`)
    }

    // ── News section ──
    if (news) {
        const risksBlock = news.key_risks
            .slice(0, 4)
            .map(r => `- ${r.risk} (${r.probability} probability, ${r.impact_direction})`)
            .join('\n')

        const catalystsBlock = news.upcoming_catalysts
            .slice(0, 4)
            .map(c => `- ${c.event} (${c.date}): ${c.expected_impact}`)
            .join('\n')

        sections.push(`### Macro & Fundamental Intelligence (News Agent)
${news.macro_environment.base_currency_outlook.split('/')[0] || 'Base'} Outlook: ${news.macro_environment.base_currency_outlook}
${news.macro_environment.quote_currency_outlook.split('/')[0] || 'Quote'} Outlook: ${news.macro_environment.quote_currency_outlook}
Relative Strength: ${news.macro_environment.relative_strength}
Central Banks: ${news.central_bank_analysis.base_currency_bank} (${news.central_bank_analysis.base_rate_path}) vs ${news.central_bank_analysis.quote_currency_bank} (${news.central_bank_analysis.quote_rate_path})
Rate Differential Trend: ${news.central_bank_analysis.rate_differential_trend}
Geopolitical Factors: ${news.geopolitical_factors.join('; ') || 'None significant'}
Sentiment: ${news.sentiment_indicators.overall} — Institutional: ${news.sentiment_indicators.institutional}, Retail: ${news.sentiment_indicators.retail}
${risksBlock ? `Key Risks:\n${risksBlock}` : ''}
${catalystsBlock ? `Upcoming Catalysts:\n${catalystsBlock}` : ''}
Fundamental Narrative: ${news.fundamental_narrative}`)
    } else {
        sections.push(`### Macro & Fundamental Intelligence (News Agent)
Report unavailable today.`)
    }

    // ── Cross-Market section ──
    if (crossMarket) {
        const indicesBlock = crossMarket.indices_analyzed
            .map(idx => `- ${idx.name}: ${idx.recent_trend} → ${idx.correlation_signal}`)
            .join('\n')

        sections.push(`### Cross-Market Effects (Cross-Market Agent)
Risk Appetite: ${crossMarket.risk_appetite} — ${crossMarket.risk_appetite_reasoning}
Index Analysis:
${indicesBlock}
Cross-Market Thesis: ${crossMarket.cross_market_thesis}
Currency Implications: ${crossMarket.currency_implications.base_currency} / ${crossMarket.currency_implications.quote_currency} → net ${crossMarket.currency_implications.net_effect}
${crossMarket.divergences.length > 0 ? `Divergences: ${crossMarket.divergences.join('; ')}` : 'No notable divergences.'}`)
    } else {
        sections.push(`### Cross-Market Effects (Cross-Market Agent)
Report unavailable today.`)
    }

    return sections.join('\n\n')
}
