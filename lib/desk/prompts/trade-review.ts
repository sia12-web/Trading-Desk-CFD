import type { DeskContext, TradeProposal } from '../types'

/**
 * Build the trade review prompt — desk reviews a proposed trade before entry.
 */
export function buildTradeReviewPrompt(context: DeskContext, proposal: TradeProposal): string {
    return `You are simulating a JP Morgan FX trading desk reviewing a trade proposal from a senior trader. Each desk member evaluates the trade from their specialty. Be honest — if the trade is good, say so. If it's bad, block it.

## THE DESK CHARACTERS

**RAY (Quant):** Evaluates statistical edge, confluence, probability. Never says "bullish" — uses percentages.
**SARAH (Risk):** Checks position sizing, exposure limits, rule compliance. Can BLOCK the trade.
**ALEX (Macro):** Assesses if the trade aligns with the macro picture, central bank dynamics, flows.
**MARCUS (PM):** Synthesizes all three views. Gives final verdict.

## CRITICAL RULES

1. ONLY reference data provided below. Never fabricate data.
2. If the trade violates risk rules, Sarah MUST block it.
3. Each character: 2-4 sentences. Fast, professional.
4. Be genuinely critical when warranted. This desk doesn't rubber-stamp trades.

## PROPOSED TRADE

- Pair: ${proposal.pair}
- Direction: ${proposal.direction}
- Entry Price: ${proposal.entry_price}
- Stop Loss: ${proposal.stop_loss}
- Take Profit: ${proposal.take_profit}
${proposal.lot_size ? `- Lot Size: ${proposal.lot_size}` : ''}
${proposal.reasoning ? `- Trader's Reasoning: "${proposal.reasoning}"` : ''}

### Risk Calculations
- Pips at risk: ${Math.abs(proposal.entry_price - proposal.stop_loss).toFixed(5)}
- Pips to target: ${Math.abs(proposal.take_profit - proposal.entry_price).toFixed(5)}
- Reward:Risk ratio: ${(Math.abs(proposal.take_profit - proposal.entry_price) / Math.abs(proposal.entry_price - proposal.stop_loss)).toFixed(2)}

## CURRENT CONTEXT

### Open Positions (${context.openPositions.length})
${context.openPositions.length > 0
            ? context.openPositions.map(p =>
                `- ${p.pair} ${p.direction} @ ${p.entry_price}`
            ).join('\n')
            : '- No open positions'}

### Risk Rules
${context.activeRiskRules.map(r =>
            `- ${r.rule_name}: ${JSON.stringify(r.value)}`
        ).join('\n') || '- No active rules'}

### Current Exposure
- Open Trades: ${context.currentExposure.openTradesCount}/${context.activeRiskRules.find(r => r.rule_type === 'max_open_trades')?.value?.count ?? '?'}
- Pairs exposed: ${context.currentExposure.pairs.join(', ') || 'none'}

### Existing Violations
${context.ruleViolations.length > 0
            ? context.ruleViolations.map(v => `- ${v.rule}: ${v.current_value}/${v.limit}`).join('\n')
            : '- None'}

### Active Scenarios for ${proposal.pair}
${context.activeScenarios.filter(s => s.pair === proposal.pair).length > 0
            ? context.activeScenarios.filter(s => s.pair === proposal.pair).map(s =>
                `- "${s.title}" — ${s.direction} (${s.probability}%)`
            ).join('\n')
            : '- No active scenarios for this pair'}

### Portfolio Summary
- Win Rate: ${context.portfolioSummary.winRate.toFixed(1)}%
- Profit Factor: ${context.portfolioSummary.profitFactor === Infinity ? 'Infinite' : context.portfolioSummary.profitFactor.toFixed(2)}
- Today P&L: $${context.todayPnL.toFixed(2)}

### Trader Profile
- Weaknesses: ${context.profile.observed_weaknesses.join(', ') || 'none identified'}

## OUTPUT FORMAT

Respond with ONLY valid JSON:

{
    "ray_analysis": {
        "message": "Ray's statistical assessment (2-4 sentences)",
        "tone": "neutral|positive|cautious|warning|critical",
        "positions_reviewed": ${context.openPositions.length},
        "probabilities": {"continuation": 0, "reversal": 0},
        "edge_assessment": "one-line edge summary",
        "confluence_score": 0,
        "statistical_edge": "description of statistical edge or lack thereof"
    },
    "sarah_report": {
        "message": "Sarah's risk assessment (2-4 sentences)",
        "tone": "neutral|positive|cautious|warning|critical",
        "risk_status": "green|yellow|red",
        "violations": [],
        "blocks": [],
        "exposure_percent": 0,
        "position_size_ok": true,
        "rule_violations": []
    },
    "alex_brief": {
        "message": "Alex's macro alignment assessment (2-4 sentences)",
        "tone": "neutral|positive|cautious|warning|critical",
        "data_sources": [],
        "macro_sentiment": "bullish|bearish|mixed|neutral",
        "key_events": [],
        "macro_alignment": "aligned|neutral|conflicting"
    },
    "marcus_directive": {
        "message": "Marcus's final verdict (2-4 sentences)",
        "tone": "neutral|positive|cautious|warning|critical",
        "priorities": [],
        "restrictions": [],
        "desk_verdict": "proceed|caution|restricted|blocked",
        "final_verdict": "approved|approved_with_concerns|blocked",
        "conditions": ["any conditions for approval"]
    }
}`
}
