import type { PositionGuidance } from '@/lib/story/types'
import { getAssetConfig, isCrypto } from '@/lib/story/asset-config'

interface PsychologyContext {
    streak: number
    weeklyAvg: number | null
    weaknesses: string[]
    currentFocus: string | null
    riskPersonality: string | null
    violationsThisWeek: number
    ai_trading_scars: string[]
}

/**
 * Build the desk reaction prompt for a position entry recommendation.
 * 4 characters react: Ray (edge), Sarah (risk + psychology), Alex (macro), Marcus (verdict).
 */
export function buildPositionEntryReactionPrompt(
    pair: string,
    guidance: PositionGuidance,
    storyTitle: string,
    psychology: PsychologyContext,
    currentPrice: number,
    atr14: number,
    atr50: number,
    volatilityStatus: string,
    fractalAnalysis?: {
        alligatorState: string
        alligatorDirection: string
        setupScore: number
        setupDirection: string
        signals: string[]
    },
    fastMatrix?: {
        activeScenario: string | null
        overallScore: number
        direction: string
        narrative: string
        h1Trend: string
        directionalFilter: string
        waveType: number | null
        scenarioLabel: string | null
        rsiDivergence: boolean
        macdDivergence: boolean
        volumeClimax: boolean
        chochDetected: boolean
        stochasticReload: boolean
        goldenPocketHigh: number | null
        goldenPocketLow: number | null
        diamondBoxHigh: number | null
        diamondBoxLow: number | null
        springPrice: number | null
        entryPrice: number | null
        stopLoss: number | null
        tp1: number | null
        tp2: number | null
        riskRewardToTP2: number | null
    },
): string {
    const config = getAssetConfig(pair)
    const mult = config.pointMultiplier
    const label = config.pointLabel

    const slPoints = guidance.stop_loss
        ? Math.abs(currentPrice - guidance.stop_loss) * mult
        : null
    const tp1Points = guidance.take_profit_1
        ? Math.abs(guidance.take_profit_1 - currentPrice) * mult
        : null
    const rr = slPoints && tp1Points ? (tp1Points / slPoints).toFixed(2) : 'N/A'

    const isCold = volatilityStatus === 'cold'
    const isSpike = volatilityStatus === 'spike'
    const ratio = atr50 > 0 ? (atr14 / atr50).toFixed(2) : '1.00'

    const cryptoReactionNote = isCrypto(pair) ? `
## CRYPTO MODE — This is a cryptocurrency, NOT a forex pair.
- Ray: Validate against 24/7 price action. No session bias. Funding rates replace session flow.
- Sarah: Crypto volatility is 3-5x forex. Position size MUST reflect this.
- Alex: Macro = BTC dominance, regulatory headlines, whale wallets — NOT central banks.
- Marcus: Confluence phases apply identically. Discipline doesn't change because it's crypto.
` : ''

    return `You are a JP Morgan desk reacting to an AI-generated trade entry recommendation. Each character gives a 1-2 sentence reaction. Stay in character. Be honest — if the trade looks weak, say so.
${cryptoReactionNote}
## THE RECOMMENDATION

Episode: "${storyTitle}"
Pair: ${pair}
Action: ${guidance.action}
Entry: ${guidance.entry_price ?? currentPrice}
Stop Loss: ${guidance.stop_loss ?? 'NOT SET'}
TP1: ${guidance.take_profit_1 ?? 'N/A'} | TP2: ${guidance.take_profit_2 ?? '-'} | TP3: ${guidance.take_profit_3 ?? '-'}
R:R: ${rr}
Lots: ${guidance.suggested_lots ?? 'N/A'}
Risk: ${guidance.risk_percent ?? 'N/A'}%
AI Confidence: ${(guidance.confidence * 100).toFixed(0)}%
Reasoning: ${guidance.reasoning}

## VOLATILITY STATUS

- Regime: **${volatilityStatus.toUpperCase()}** | ATR14: ${atr14.toFixed(1)} ${label} | ATR50: ${atr50.toFixed(1)} ${label} | Ratio: ${ratio}x
${tp1Points ? `- TP distance vs daily ATR: ${(tp1Points / atr14).toFixed(1)}x daily range${tp1Points > atr14 * 2 ? ' — TARGET IS >2x DAILY RANGE' : ''}` : ''}
${isCold ? `- COLD MARKET: The market is moving LESS than average. A ${tp1Points ? tp1Points.toFixed(0) : '?'} ${label} target in a market averaging ${atr14.toFixed(0)} ${label}/day is questionable without a catalyst.` : ''}
${isSpike ? `- SPIKE: Volatility is 1.5x+ above average. Wider stops needed. Whipsaw risk elevated.` : ''}

${fastMatrix ? `## THE FAST MATRIX STATUS (for Ray's validation — OUR PRIMARY STRATEGY)

Active Scenario: ${fastMatrix.activeScenario ?? 'NONE'} | Score: ${fastMatrix.overallScore}/100 | Direction: ${fastMatrix.direction}
Narrative: ${fastMatrix.narrative}
H1 Macro: ${fastMatrix.h1Trend} [${fastMatrix.directionalFilter}]
${fastMatrix.activeScenario ? `Scenario ${fastMatrix.activeScenario}: ${fastMatrix.scenarioLabel ?? 'Unknown'} (Wave ${fastMatrix.waveType ?? '?'})` : 'No active scenario'}
M15 Confirmations: RSI Div: ${fastMatrix.rsiDivergence ? 'YES' : 'NO'} | MACD Div: ${fastMatrix.macdDivergence ? 'YES' : 'NO'}
M1 Execution: Vol Climax: ${fastMatrix.volumeClimax ? 'YES' : 'NO'} | CHoCH: ${fastMatrix.chochDetected ? 'YES' : 'NO'} | Stoch Reload: ${fastMatrix.stochasticReload ? 'YES' : 'NO'}
${fastMatrix.waveType === 2 ? `Golden Pocket: ${fastMatrix.goldenPocketLow?.toFixed(5) ?? 'N/A'} — ${fastMatrix.goldenPocketHigh?.toFixed(5) ?? 'N/A'}` : ''}
${fastMatrix.waveType === 4 ? `Diamond Box: ${fastMatrix.diamondBoxLow?.toFixed(5) ?? 'N/A'} — ${fastMatrix.diamondBoxHigh?.toFixed(5) ?? 'N/A'}` : ''}
Spring: ${fastMatrix.springPrice?.toFixed(5) ?? 'N/A'}
Levels: Entry: ${fastMatrix.entryPrice?.toFixed(5) ?? 'N/A'} | SL: ${fastMatrix.stopLoss?.toFixed(5) ?? 'N/A'} | TP1: ${fastMatrix.tp1?.toFixed(5) ?? 'N/A'} | TP2: ${fastMatrix.tp2?.toFixed(5) ?? 'N/A'}
R:R to TP2: ${fastMatrix.riskRewardToTP2?.toFixed(1) ?? 'N/A'}:1

**8-ITEM MASTER MATRIX CHECKLIST** (Ray must validate):
1. H1 macro trend confirmed (HH/HL = buy only, LH/LL = sell only)
2. Active Scenario identified (A/B/C/D)
3. RSI divergence + MACD divergence confirmed on M15
4. M1 volume climax + rejection candle at key zone
5. M1 CHoCH confirmed (structural break)
6. Stochastic reload from extreme zone
7. SL below Spring / above Upthrust, split TP1/TP2
8. Position sized AT EXACTLY $8.50 (2% of $850)

**Ray's Task**: If score <50/100 OR H1 macro not confirmed, flag as NO ENTRY. Only Scenario A, B, C, or D setups with CHoCH confirmed are institutional-grade.
` : ''}${fractalAnalysis ? `## BILL WILLIAMS DETAIL (supporting analysis)
Setup Score: ${fractalAnalysis.setupScore}/100 → ${fractalAnalysis.setupDirection}
Alligator: ${fractalAnalysis.alligatorState} (${fractalAnalysis.alligatorDirection})
Signals: ${fractalAnalysis.signals.length > 0 ? fractalAnalysis.signals.join(', ') : 'none'}
` : ''}
## TRADER PSYCHOLOGY

Process Streak: ${psychology.streak} consecutive 7+ scores
Weekly Score Average: ${psychology.weeklyAvg !== null ? `${psychology.weeklyAvg.toFixed(1)}/10` : 'No data'}
Known Weaknesses: ${psychology.weaknesses.length > 0 ? psychology.weaknesses.join(', ') : 'None identified'}
Current Focus: ${psychology.currentFocus || 'None set'}
Risk Personality: ${psychology.riskPersonality || 'Unknown'}
Violations This Week: ${psychology.violationsThisWeek}

## CHARACTERS

- **RAY (Quant):** Validates the Hedge Fund Master Matrix Playbook 8-item checklist. If score <50 or H1 trend not confirmed, he MUST flag the entry as premature. Only Scenario A, B, C, or D setups with valid CHoCH get his approval.
- **SARAH (Risk Analyst):** Enforces the "$8.50 Rule" (exactly 2% of $850 account). Validates SL placement below/above the Spring/Upthrust, split TP1/TP2, and R:R ratio. If position sizing is NOT $8.50 or stops are missing, she blocks the trade.
- **ALEX (Macro Analyst):** Checks Phase 1 directional filter alignment and cross-market context based on the Playbook.
- **MARCUS (Portfolio Manager):** Validates setup alignment with the Playbook (Scenario A, B, C, or D). Only high-probability Playbook setups deserve capital.


## ANTI-HALLUCINATION DOCTRINE
1. **ONLY reference data provided.** Never fabricate prices, P&L, or news events.
2. If the trade violates risk rules, Sarah MUST block it.
3. Match character reactions to this psychology framework.

## RULES

1. Each character: 1-2 sentences MAX. Fast, professional desk banter.
2. If R:R < 1.5 or SL not set, Sarah flags it.
3. ${isCold ? '**VOLATILITY IS COLD** — Ray MUST flag this. Marcus should push back unless exceptional confluence exists.' : isSpike ? '**VOLATILITY IS SPIKING** — Ray MUST warn about whipsaw risk.' : 'Ray comments on volatility conditions.'}
4. If trader has "impatience" weakness and this is a swing trade, Marcus mentions it.
5. If violations > 0 this week, Sarah is more cautious.
6. ONLY reference data provided. Never fabricate.

## OUTPUT (JSON only)

{
    "ray": { "message": "...", "tone": "neutral|positive|cautious|warning" },
    "sarah": { "message": "...", "tone": "neutral|positive|cautious|warning" },
    "alex": { "message": "...", "tone": "neutral|positive|cautious|warning" },
    "marcus": { "message": "...", "tone": "neutral|positive|cautious|warning", "verdict": "approved|caution|blocked" }
}`
}

/**
 * Build the desk reaction prompt for position management actions.
 * hold/adjust: Ray + Sarah only. close: all 4 characters.
 */
export function buildPositionManagementReactionPrompt(
    pair: string,
    guidance: PositionGuidance,
    storyTitle: string,
    psychology: PsychologyContext,
    currentPrice: number,
    isCloseAction: boolean,
): string {
    if (isCloseAction) {
        return `You are a JP Morgan desk reacting to an AI recommendation to CLOSE a position. Each character gives 1 sentence.

Episode: "${storyTitle}"
Pair: ${pair}
Action: ${guidance.action}
Close Reason: ${guidance.close_reason || guidance.reasoning}
Current Price: ${currentPrice}
Trader Streak: ${psychology.streak}

## CHARACTERS (1 sentence each)
- RAY: Comment on the outcome/timing.
- SARAH: Risk compliance check.
- ALEX: Macro context of the close.
- MARCUS: Wrap-up. Reference what the trader learned.

## OUTPUT (JSON only)
{
    "ray": { "message": "...", "tone": "neutral|positive|cautious" },
    "sarah": { "message": "...", "tone": "neutral|positive|cautious" },
    "alex": { "message": "...", "tone": "neutral|positive|cautious" },
    "marcus": { "message": "...", "tone": "neutral|positive|cautious" }
}`
    }

    // hold/adjust — only Ray + Sarah
    return `You are the quant (Ray) and risk manager (Sarah) on a JP Morgan desk. React to a position management recommendation. 1-2 sentences each.

### POSITION MANAGEMENT REACTION
Episode: "${storyTitle}"
Pair: ${pair}
Action: ${guidance.action}
Current Price: ${currentPrice}
${guidance.move_stop_to ? `Move SL to: ${guidance.move_stop_to}` : ''}
${guidance.partial_close_percent ? `Partial close: ${guidance.partial_close_percent}%` : ''}
${guidance.new_take_profit ? `New TP: ${guidance.new_take_profit}` : ''}
Reasoning: ${guidance.reasoning}

## THE CHARACTERS (1-2 sentences each)
- **RAY (Quant):** Review whether the market structure has shifted. Has RSI/Momentum regime actually changed, or is this a normal retracement within the expected range?
- **SARAH (Risk Analyst):** Validates stop/TP compliance and position sizing rules. If the trader is exiting a winner before plan targets, she flags the deviation. If they are holding a loser past the stop, she enforces the cut.
- **ALEX (Macro Analyst):**
  - If in PROFIT: Checks whether the directional filter and macro context still support the position.
  - If in LOSS: Evaluates whether the original macro thesis has been invalidated or remains intact.
- **MARCUS (Portfolio Manager):** Validates the phase-based hold/exit decision. Enforces staying in winners for the full target when confluence is intact, and cutting losers at the planned stop level.


## OUTPUT (JSON only)
{
    "ray": { "message": "...", "tone": "neutral|positive|cautious|warning" },
    "sarah": { "message": "...", "tone": "neutral|positive|cautious|warning" }
}`
}

export type { PsychologyContext }
