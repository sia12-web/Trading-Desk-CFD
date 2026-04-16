/**
 * Whale Psychology Simulator — DeepSeek Narrator
 *
 * Single cheap LLM call per step to explain the whale's psychology.
 * Educational narration — NOT decision making.
 *
 * Cost: ~$0.001 per call × 12 steps = ~$0.012 per simulation
 * (vs old AI Trio: ~$0.50+ per simulation)
 */

import { callDeepSeek } from '@/lib/ai/clients/deepseek'
import { parseAIJson } from '@/lib/ai/parse-response'
import type {
    WhaleAction, RetailEvent, MarketSnapshot, WhaleBook, WhalePsychology,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Generate Narrative
// ═══════════════════════════════════════════════════════════════════════════

export async function generateNarrative(
    whaleAction: WhaleAction,
    retailEvents: RetailEvent[],
    market: MarketSnapshot,
    book: WhaleBook
): Promise<WhalePsychology> {
    const prompt = buildNarratorPrompt(whaleAction, retailEvents, market, book)

    try {
        const response = await callDeepSeek(prompt, {
            timeout: 15_000,
            maxTokens: 500,
        })

        return parseAIJson<WhalePsychology>(response)
    } catch (err) {
        console.error('[Narrator] DeepSeek error:', err)
        return buildFallbackNarrative(whaleAction, retailEvents)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Prompt Builder
// ═══════════════════════════════════════════════════════════════════════════

function buildNarratorPrompt(
    whaleAction: WhaleAction,
    retailEvents: RetailEvent[],
    market: MarketSnapshot,
    book: WhaleBook
): string {
    const fairValue = market.fairValueProfile.fairValue || market.volumePOC
    const priceVsFair = fairValue > 0
        ? (market.currentPrice > market.fairValueProfile.premiumZone ? 'PREMIUM (expensive)'
            : market.currentPrice < market.fairValueProfile.discountZone ? 'DISCOUNT (cheap)'
            : 'AT FAIR VALUE')
        : 'UNKNOWN'

    const totalPnl = book.realizedPnl + book.unrealizedPnl - book.manipulationCost

    // Summarize retail events concisely
    const stopOuts = retailEvents.filter(e => e.type === 'stop_out')
    const fomoEntries = retailEvents.filter(e => e.type === 'fomo')
    const panicEntries = retailEvents.filter(e => e.type === 'panic')
    const takeProfits = retailEvents.filter(e => e.type === 'take_profit')
    const normalEntries = retailEvents.filter(e => e.type === 'entry')

    const retailSummary = [
        stopOuts.length > 0 ? `${stopOuts.length} traders STOPPED OUT (avg ${(stopOuts.reduce((s, e) => s + (e.pnl || 0), 0) / stopOuts.length).toFixed(1)} pips each)` : null,
        fomoEntries.length > 0 ? `${fomoEntries.length} traders FOMO entered (chasing momentum)` : null,
        panicEntries.length > 0 ? `${panicEntries.length} traders PANIC entered (selling into fear)` : null,
        takeProfits.length > 0 ? `${takeProfits.length} traders took profit` : null,
        normalEntries.length > 0 ? `${normalEntries.length} traders entered (normal entries)` : null,
    ].filter(Boolean).join('\n  ')

    return `You are an educational narrator explaining how institutional market makers exploit retail traders.

WHALE ACTION THIS STEP:
  Action: ${whaleAction.type.toUpperCase()}${whaleAction.units > 0 ? ` ${whaleAction.units} units` : ''}
  Price: ${whaleAction.price.toFixed(3)} [${priceVsFair} vs fair ${fairValue.toFixed(3)}]
  Phase: ${whaleAction.phase.toUpperCase()}
  ${whaleAction.manipulationDirection ? `Push Direction: ${whaleAction.manipulationDirection.toUpperCase()}` : ''}
  Whale reasoning: "${whaleAction.reasoning}"

WHALE'S BOOK:
  Inventory: ${book.positionSize} units @ avg ${book.averageEntry > 0 ? book.averageEntry.toFixed(3) : 'flat'}
  Unrealized: ${book.unrealizedPnl.toFixed(1)} pips | Realized: ${book.realizedPnl.toFixed(1)} pips
  Total PnL: ${totalPnl.toFixed(1)} pips | Manipulation cost: ${book.manipulationCost.toFixed(1)} pips

RETAIL THIS STEP:
  ${retailSummary || 'No retail activity this step.'}

Explain in simple, direct language:
1. WHY the whale did this (economic motivation, not jargon)
2. HOW this specific action exploits retail trader psychology
3. ONE key lesson a retail trader should learn from this

Respond in valid JSON only:
{
  "narrative": "<3-5 sentences explaining the whale's economic thinking this step>",
  "retailExploitation": "<2-3 sentences on specifically how retail gets trapped or exploited>",
  "educationalInsight": "<1 clear sentence: the lesson for retail traders>"
}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Fallback (when DeepSeek is unavailable)
// ═══════════════════════════════════════════════════════════════════════════

function buildFallbackNarrative(
    whaleAction: WhaleAction,
    retailEvents: RetailEvent[]
): WhalePsychology {
    const stopOuts = retailEvents.filter(e => e.type === 'stop_out').length
    const fomoEntries = retailEvents.filter(e => e.type === 'fomo').length

    const narratives: Record<string, string> = {
        accumulate: `The whale is quietly building inventory at ${whaleAction.price.toFixed(3)}, buying ${whaleAction.units} units. Retail traders don't notice because price isn't moving dramatically. This is the boring part — but it's where the whale loads the gun.`,
        manipulate: `The whale pushed price ${whaleAction.manipulationDirection?.toUpperCase() || 'sideways'} to trigger retail stop losses. ${stopOuts} traders just got stopped out — their forced exits are the whale's cheap inventory. The price move was engineered, not organic.`,
        distribute: `The whale is now selling ${whaleAction.units} units into ${fomoEntries > 0 ? `${fomoEntries} FOMO buyers` : 'retail demand'}. Every retail buy order at these premium prices is absorbing the whale's inventory. When the buying stops, price will collapse.`,
        hold: 'The whale is watching and waiting. Sometimes the best play is no play — letting retail build up positions that can be exploited later.',
    }

    const exploitations: Record<string, string> = {
        accumulate: 'Retail traders selling at these levels are providing the whale with cheap inventory. Their impatience becomes the whale\'s discount.',
        manipulate: `${stopOuts > 0 ? `${stopOuts} retail traders just lost money to a manufactured price move.` : 'Retail stops are being targeted.'} The whale knows exactly where retail places their stops — at the obvious levels.`,
        distribute: `${fomoEntries > 0 ? `${fomoEntries} retail traders bought into the rally, not realizing they're the exit liquidity.` : 'Retail is absorbing the whale\'s sells.'} When the whale finishes selling, there's no one left to buy.`,
        hold: 'No exploitation this step, but the whale is studying retail positioning for the next move.',
    }

    const insights: Record<string, string> = {
        accumulate: 'When the market looks boring and dead, the smart money is loading up.',
        manipulate: 'If your stop loss is at an obvious level, you ARE the target.',
        distribute: 'The moment you FOMO into a breakout rally, ask: who is selling to me?',
        hold: 'Patience is a weapon. The whale waits for the optimal moment, not the first opportunity.',
    }

    return {
        narrative: narratives[whaleAction.type] || narratives.hold,
        retailExploitation: exploitations[whaleAction.type] || exploitations.hold,
        educationalInsight: insights[whaleAction.type] || insights.hold,
    }
}
