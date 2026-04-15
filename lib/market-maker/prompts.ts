/**
 * Whale Simulator — AI Trio Prompts
 *
 * Three chained prompts following the standard AI Trio pattern:
 *   Gemini (structural) → DeepSeek (quant) → Claude (decision)
 *
 * CRITICAL: ATR is intentionally excluded from all prompts.
 * The experiment tests whether the whale's manipulation actions
 * naturally create ATR-like volatility patterns.
 */

import type { MarketSnapshot, WhaleBook, RetailState, WhaleAction } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Gemini — Structural Analyst
// ═══════════════════════════════════════════════════════════════════════════

export function buildGeminiWhalePrompt(
    market: MarketSnapshot,
    book: WhaleBook,
    retail: RetailState,
    recentActions: WhaleAction[]
): string {
    const actionsLog = recentActions.slice(-3).map(a =>
        `  - ${a.type.toUpperCase()} ${a.units} units @ ${a.price.toFixed(3)} (${a.phase})`
    ).join('\n')

    const priceVsFairValue = market.currentPrice > market.fairValueProfile.premiumZone ? 'PREMIUM (expensive)' :
        market.currentPrice < market.fairValueProfile.discountZone ? 'DISCOUNT (cheap)' :
        'FAIR VALUE'

    return `You are an institutional market analyst working for a large whale fund trading EUR/JPY.

═══ SESSION CONTEXT ═══
ASIAN SESSION (00:00-09:00 UTC):
${market.asianSession.narrative}
- Range: ${market.asianSession.range.toFixed(1)} pips | Direction: ${market.asianSession.direction.toUpperCase()}
- Open: ${market.asianSession.open.toFixed(3)} | Close: ${market.asianSession.close.toFixed(3)}
- Imbalances: ${market.asianSession.imbalances} unfilled gaps

LONDON SESSION (08:00-13:00 UTC):
${market.londonSession.narrative}
- Range: ${market.londonSession.range.toFixed(1)} pips | Direction: ${market.londonSession.direction.toUpperCase()}
- Open: ${market.londonSession.open.toFixed(3)} | Close: ${market.londonSession.close.toFixed(3)}
- Imbalances: ${market.londonSession.imbalances} unfilled gaps

30-DAY FAIR VALUE:
- Fair Value (POC): ${market.fairValueProfile.fairValue.toFixed(3)} (${market.fairValueProfile.daysCalculated} days)
- Value Area: ${market.fairValueProfile.valueAreaLow.toFixed(3)} — ${market.fairValueProfile.valueAreaHigh.toFixed(3)}
- Premium Zone (expensive): ${market.fairValueProfile.premiumZone.toFixed(3)}+
- Discount Zone (cheap): ${market.fairValueProfile.discountZone.toFixed(3)}−

CURRENT SESSION STATE (NEW YORK):
- Phase: ${market.phase.toUpperCase()}
- Time: ${market.minutesElapsed} minutes into the 3-hour session
- Price: ${market.currentPrice.toFixed(3)} [${priceVsFairValue}]
- Session Range: ${market.sessionLow.toFixed(3)} — ${market.sessionHigh.toFixed(3)}

ORDER FLOW DATA:
- CVD (Cumulative Volume Delta): ${market.cvdCurrent.toFixed(0)} (${market.cvdTrend})
- Donchian Channel: ${market.donchianLow.toFixed(3)} — ${market.donchianHigh.toFixed(3)} (mid: ${market.donchianMiddle.toFixed(3)})
- Volume POC: ${market.volumePOC.toFixed(3)}
- Value Area: ${market.valueAreaLow.toFixed(3)} — ${market.valueAreaHigh.toFixed(3)}

YOUR FUND'S POSITION:
- Inventory: ${book.positionSize} units (avg entry: ${book.averageEntry > 0 ? book.averageEntry.toFixed(3) : 'none'})
- Unrealized PnL: ${book.unrealizedPnl.toFixed(1)} pips
- Realized PnL: ${book.realizedPnl.toFixed(1)} pips
- Manipulation spent: ${book.manipulationCost.toFixed(1)} pips

RETAIL CROWD:
- Sentiment: ${retail.sentiment}/100 (${retail.sentiment > 60 ? 'greedy' : retail.sentiment < 40 ? 'fearful' : 'neutral'})
- Bias: ${retail.breakoutBias}
- FOMO: ${retail.fomoIntensity}/100
- Stop hunt victims so far: ${retail.stopHuntVictims}

RECENT ACTIONS:
${actionsLog || '  (none yet)'}

YOUR TASK:
Identify the optimal floor (accumulation zone) and ceiling (distribution zone) based on:
1. Where retail stops are clustered (Donchian levels)
2. Where institutional volume is concentrated (POC, Value Area)
3. Current CVD flow direction
4. What Asian/London sessions established (imbalances = magnets for price)
5. 30-day fair value (accumulate at discount, distribute at premium)

INSTITUTIONAL INSIGHT:
- If price is at DISCOUNT vs fair value → good accumulation zone
- If price is at PREMIUM vs fair value → good distribution zone
- Imbalances from Asian/London = unfilled orders that NY session may revisit

Respond in valid JSON only:
{
  "floor": <price level for accumulation>,
  "ceiling": <price level for distribution>,
  "retailStopZone": <price where most retail stops sit>,
  "structuralBias": "bullish" | "bearish" | "neutral",
  "narrative": "<1-2 sentence market structure read>"
}`
}

// ═══════════════════════════════════════════════════════════════════════════
// DeepSeek — Quantitative Analyst
// ═══════════════════════════════════════════════════════════════════════════

export function buildDeepSeekWhalePrompt(
    market: MarketSnapshot,
    book: WhaleBook,
    retail: RetailState,
    geminiOutput: string,
    recentActions: WhaleAction[]
): string {
    const positionPct = book.positionSize > 0
        ? Math.round((book.totalDistributed / Math.max(book.totalAccumulated, 1)) * 100)
        : 0

    const priceVsFairValue = market.currentPrice > market.fairValueProfile.premiumZone ? 'PREMIUM' :
        market.currentPrice < market.fairValueProfile.discountZone ? 'DISCOUNT' :
        'FAIR'

    return `You are a quantitative analyst for an institutional whale desk trading EUR/JPY.

PHASE: ${market.phase.toUpperCase()} (${market.minutesElapsed}/180 min)
PRICE: ${market.currentPrice.toFixed(3)} [${priceVsFairValue} vs 30-day fair: ${market.fairValueProfile.fairValue.toFixed(3)}]

SESSION CONTEXT:
- Asian: ${market.asianSession.direction} ${market.asianSession.range.toFixed(1)} pips, ${market.asianSession.imbalances} gaps
- London: ${market.londonSession.direction} ${market.londonSession.range.toFixed(1)} pips, ${market.londonSession.imbalances} gaps

STRUCTURAL ANALYSIS (from our pattern analyst):
${geminiOutput}

CURRENT BOOK:
- Position: ${book.positionSize} units
- Avg Entry: ${book.averageEntry > 0 ? book.averageEntry.toFixed(3) : 'flat'}
- Unrealized: ${book.unrealizedPnl.toFixed(1)} pips
- Realized: ${book.realizedPnl.toFixed(1)} pips
- Distribution progress: ${positionPct}% of accumulated sold
- Manipulation cost: ${book.manipulationCost.toFixed(1)} pips

RETAIL STATE:
- Sentiment: ${retail.sentiment}/100, FOMO: ${retail.fomoIntensity}/100
- Bias: ${retail.breakoutBias}
- Victims: ${retail.stopHuntVictims}

PHASE RULES:
- ACCUMULATION: Buy quietly near floor. Max 5000 units per step.
- MANIPULATION: Stop hunts cost 2-8 pips. Push price to trigger retail stops, then reverse.
- DISTRIBUTION: Sell into retail FOMO. Max units = current position.
- CLEANUP: MUST reduce position to 0. Forced sells regardless of price.

CONSTRAINTS:
- Cannot sell more than current position
- Cannot accumulate during distribution/cleanup
- Stop hunts have a cost (2-8 pips) but create opportunities

Calculate the optimal action and sizing.

Respond in valid JSON only:
{
  "recommendedAction": "accumulate" | "manipulate" | "distribute" | "hold",
  "units": <number of units>,
  "manipulationCost": <estimated pip cost if manipulating, else 0>,
  "expectedPnlImpact": <expected pip impact on book>,
  "riskAssessment": "<1-2 sentence risk note>"
}`
}

// ═══════════════════════════════════════════════════════════════════════════
// Claude — Chief Decision Maker
// ═══════════════════════════════════════════════════════════════════════════

export function buildClaudeWhalePrompt(
    market: MarketSnapshot,
    book: WhaleBook,
    retail: RetailState,
    geminiOutput: string,
    deepseekOutput: string,
    recentActions: WhaleAction[]
): string {
    const lastActions = recentActions.slice(-5).map(a =>
        `  Step ${a.candleIndex}: ${a.type} ${a.units}u @ ${a.price.toFixed(3)} — "${a.reasoning}"`
    ).join('\n')

    const priceVsFairValue = market.currentPrice > market.fairValueProfile.premiumZone ? 'PREMIUM (expensive)' :
        market.currentPrice < market.fairValueProfile.discountZone ? 'DISCOUNT (cheap)' :
        'FAIR VALUE'

    return `You are the chief decision maker for an institutional whale fund.
You have UNLIMITED capital. EUR/JPY, M1 timeframe.

═══ SESSION CONTEXT (What Happened Before NY) ═══
ASIAN SESSION (00:00-09:00 UTC):
${market.asianSession.narrative}
Direction: ${market.asianSession.direction.toUpperCase()} | Range: ${market.asianSession.range.toFixed(1)} pips | Gaps: ${market.asianSession.imbalances}

LONDON SESSION (08:00-13:00 UTC):
${market.londonSession.narrative}
Direction: ${market.londonSession.direction.toUpperCase()} | Range: ${market.londonSession.range.toFixed(1)} pips | Gaps: ${market.londonSession.imbalances}

30-DAY FAIR VALUE:
Fair Value: ${market.fairValueProfile.fairValue.toFixed(3)} (${market.fairValueProfile.daysCalculated}-day POC)
Current Price: ${market.currentPrice.toFixed(3)} [${priceVsFairValue}]
Value Area: ${market.fairValueProfile.valueAreaLow.toFixed(3)} — ${market.fairValueProfile.valueAreaHigh.toFixed(3)}

INSTITUTIONAL INSIGHT:
- Accumulate when price is at DISCOUNT vs fair value
- Distribute when price is at PREMIUM vs fair value
- Imbalances from earlier sessions are magnets for NY session reversals

Your analysts have provided their recommendations:

═══ STRUCTURAL ANALYST (Gemini) ═══
${geminiOutput}

═══ QUANT ANALYST (DeepSeek) ═══
${deepseekOutput}

═══ CURRENT STATE ═══
Phase: ${market.phase.toUpperCase()}
Price: ${market.currentPrice.toFixed(3)}
Minutes: ${market.minutesElapsed}/180
Position: ${book.positionSize} units @ ${book.averageEntry > 0 ? book.averageEntry.toFixed(3) : 'none'}
Total PnL: ${(book.realizedPnl + book.unrealizedPnl - book.manipulationCost).toFixed(1)} pips (realized: ${book.realizedPnl.toFixed(1)}, unrealized: ${book.unrealizedPnl.toFixed(1)}, manipulation cost: -${book.manipulationCost.toFixed(1)})

═══ RETAIL SENTIMENT ═══
Sentiment: ${retail.sentiment}/100 | FOMO: ${retail.fomoIntensity}/100 | Bias: ${retail.breakoutBias}
Stop Hunt Victims: ${retail.stopHuntVictims}

═══ ACTION HISTORY ═══
${lastActions || '  (first step)'}

═══ PHASE DOCTRINE ═══
ACCUMULATION (0-45 min): Buy quietly near the floor. Don't move price. Be invisible.
MANIPULATION (45-90 min): Trigger stop hunts. Push price up or down to liquidate retail. This costs pips but creates the move for distribution.
DISTRIBUTION (90-120 min): Sell your inventory into the retail FOMO you created. Sell into strength.
CLEANUP (120-180 min): You MUST close ALL remaining position. No overnight risk. Sell at any price.

═══ HARD RULES ═══
1. During cleanup, you MUST distribute. Action MUST be "distribute" if positionSize > 0.
2. Cannot sell more units than you hold.
3. Manipulation direction ("up" or "down") controls which retail stops get hunted.
4. Think like a real market maker: your PnL comes from the spread between accumulation and distribution, minus manipulation costs.

Make your final decision. Synthesize both analysts. Override them if needed.

Respond in valid JSON only:
{
  "action": "accumulate" | "manipulate" | "distribute" | "hold",
  "units": <number>,
  "manipulationDirection": "up" | "down" | null,
  "reasoning": "<2-3 sentence decision rationale>",
  "confidence": <0-100>,
  "retailImpact": "<1 sentence: how this action affects retail traders>"
}`
}
