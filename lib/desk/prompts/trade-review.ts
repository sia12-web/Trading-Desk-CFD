import type { DeskContext, TradeProposal } from '../types'
import { getAssetConfig, isCrypto } from '@/lib/story/asset-config'

export interface VolatilitySnapshot {
    atr14: number
    atr50: number
    ratio: number
    status: 'spike' | 'hot' | 'normal' | 'cold'
    label: string
    pointLabel: 'pips' | 'points'
}

/**
 * Build the trade review prompt — desk reviews a proposed trade before entry.
 */
export function buildTradeReviewPrompt(context: DeskContext, proposal: TradeProposal, volatility?: VolatilitySnapshot): string {
    const config = getAssetConfig(proposal.pair)
    const mult = config.pointMultiplier
    const label = config.pointLabel

    const riskPoints = Math.abs(proposal.entry_price - proposal.stop_loss) * mult
    const rewardPoints = Math.abs(proposal.take_profit - proposal.entry_price) * mult
    const rr = riskPoints > 0 ? (rewardPoints / riskPoints).toFixed(2) : 'N/A'

    const vol = volatility || { atr14: 0, atr50: 0, ratio: 1, status: 'normal' as const, label: 'Unavailable', pointLabel: label }
    const isCold = vol.status === 'cold'
    const isSpike = vol.status === 'spike'

    const cryptoReviewNote = isCrypto(proposal.pair) ? `
## CRYPTO MODE — ${proposal.pair} is a cryptocurrency, NOT a forex pair.
- Ray: Validate 24/7 price action. No session bias. Crypto volume patterns differ from forex.
- Sarah: Crypto volatility is 3-5x forex. Tighter position sizing required.
- Alex: Macro context = BTC dominance, regulatory climate, whale movements — not central banks.
- Marcus: Confluence discipline is identical. Phase progression gatekeeps entry.
` : ''

    return `You are simulating a JP Morgan trading desk reviewing a trade proposal. Each desk member evaluates from their specialty. Be honest — if the trade is bad, block it.
${cryptoReviewNote}
## THE DESK CHARACTERS

**RAY (Quant — Playbook Checklist Validator):** Evaluates statistical edge and volatility. Validates the Hedge Fund Master Matrix Playbook 8-item checklist. Flags entries where confluence data is insufficient or where the score is below threshold.
**SARAH (Risk Analyst — Process Enforcement):** Zero-tolerance. Enforces EXACTLY $17 risk per trade (based on 2% of $850 account), SL placement below Spring price, and split TP1/TP2 targets. If the trade violates the "$17 Rule", she blocks it without emotion.
**ALEX (Macro Analyst — Directional Filter):** Validates Phase 1 directional filter alignment and cross-market context based on the Hedge Fund Master Matrix Playbook.
**MARCUS (Portfolio Manager — Strategy Architect):** Validates setup alignment with the Playbook (Scenario A, B, C, or D). Only high-probability Playbook setups deserve capital.

## ANTI-HALLUCINATION DOCTRINE
1. **ONLY reference data provided below.** Never fabricate prices, SL/TP, or news events.
2. If the trade violates risk rules, Sarah MUST block it.
3. Match the character's reaction to the data — if the R:R is bad or HCM score is low, Marcus and Sarah MUST be critical.

## CRITICAL RULES

1. ONLY reference data provided below. Never fabricate data.
2. If the trade violates risk rules, Sarah MUST block it.
3. ${isCold ? '**VOLATILITY IS COLD** — Ray MUST flag this. The market is not moving enough to justify entry. Unless there is exceptional confluence, Marcus should block or add conditions.' : isSpike ? '**VOLATILITY IS SPIKING** — Ray MUST warn about widened stops and potential whipsaws.' : ''}
4. Each character: 2-4 sentences. Fast, professional.
5. Be genuinely critical when warranted. This desk doesn't rubber-stamp trades.

## PROPOSED TRADE

- Pair: ${proposal.pair}
- Direction: ${proposal.direction}
- Entry Price: ${proposal.entry_price}
- Stop Loss: ${proposal.stop_loss}
- Take Profit: ${proposal.take_profit}
${proposal.lot_size ? `- Lot Size: ${proposal.lot_size}` : ''}
${proposal.reasoning ? `- Trader's Reasoning: "${proposal.reasoning}"` : ''}

### Risk Calculations
- ${label} at risk: ${riskPoints.toFixed(1)}
- ${label} to target: ${rewardPoints.toFixed(1)}
- Reward:Risk ratio: ${rr}
${vol.atr14 > 0 ? `- Daily ATR14: ${vol.atr14.toFixed(1)} ${label} (the market's average daily movement)
- TP distance vs ATR: ${(rewardPoints / vol.atr14).toFixed(1)}x daily range ${rewardPoints > vol.atr14 * 2 ? '⚠️ TARGET IS >2x DAILY RANGE — may take multiple days' : ''}
- SL distance vs ATR: ${(riskPoints / vol.atr14).toFixed(1)}x daily range` : ''}

### VOLATILITY STATUS
- Regime: **${vol.status.toUpperCase()}** — ${vol.label}
- ATR14: ${vol.atr14.toFixed(1)} ${vol.pointLabel} | ATR50: ${vol.atr50.toFixed(1)} ${vol.pointLabel} | Ratio: ${vol.ratio.toFixed(2)}x
${isCold ? `- ⚠️ COLD MARKET: The market is moving LESS than average. Pro traders wait for volatility. A ${rewardPoints.toFixed(0)} ${label} target in a market averaging ${vol.atr14.toFixed(0)} ${label}/day is unrealistic without a catalyst.` : ''}
${isSpike ? `- ⚠️ SPIKE: Volatility is 1.5x+ above average. Wider stops needed. Risk of whipsaw is elevated.` : ''}

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

### Hedge Fund Master Matrix Playbook Status for ${proposal.pair}
${context.trueFractalSetups && context.trueFractalSetups.find(s => s.pair === proposal.pair)
            ? (() => { const tf = context.trueFractalSetups!.find(s => s.pair === proposal.pair)!; return `Matrix Wave ${tf.waveType ?? '?'}/4 | Score: ${tf.overallScore}/100 | Direction: ${tf.direction}\nMacro: ${tf.h1Trend} [${tf.directionalFilter}] | Setup: ${tf.scenarioLabel || 'Developing'} | R:R: ${tf.riskRewardToTP2?.toFixed(1) ?? 'N/A'}:1\n${tf.narrative}\n**Ray**: Validate the Playbook setup checklist. Is the 1M CHoCH confirmed? Is the Stochastic reloaded?\n**Sarah**: ENFORCE THE $17 RULE. Stop loss must be exactly $17 away from entry. SL must also be below/above the Spring wick. TP1 must be >= 2:1.\n**Alex**: Weekly/Daily alignment confirmed? Does the directional filter allow this entry?\n**Marcus**: Only Scenario A, B, C, or D setups are actionable. Is this a high-conviction Playbook entry?` })()
            : '- No Playbook data for this pair'
        }

### Portfolio Summary
- Win Rate: ${context.portfolioSummary.winRate.toFixed(1)}%
- Profit Factor: ${context.portfolioSummary.profitFactor === Infinity ? 'Infinite' : context.portfolioSummary.profitFactor.toFixed(2)}
- Today P&L: $${context.todayPnL.toFixed(2)}

### Trader Profile
- Weaknesses: ${context.profile.observed_weaknesses.join(', ') || 'none identified'}

${context.deskState?.ai_trading_scars && context.deskState.ai_trading_scars.length > 0
            ? `### AI DESK TRADING SCARS (Past Failed Scenarios & Lessons Learned)\n${context.deskState.ai_trading_scars.map(s => `- ${s}`).join('\n')}\n*Note: Marcus and Sarah MUST block or caution this trade if it resembles any of these past strategic failures.*`
            : ''
        }

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
