import type { StoryDataPayload } from '../types'
import type { CrossMarketReport, IndexCrossMarketReport } from '../agents/types'
import { getAssetConfig } from '../asset-config'

/**
 * DeepSeek "Quantitative Engine" prompt for Story.
 * Validates Gemini's structural analysis and computes precise levels.
 */
export function buildStoryQuantPrompt(
    data: StoryDataPayload,
    geminiOutput: string,
    scenarioAnalysisLevels?: Array<{ price: number; type: string; timeframe: string; significance: string }> | null,
    crossMarket?: CrossMarketReport | IndexCrossMarketReport | null
): string {
    // Extract indicator data for quant analysis
    const indicatorSummary = data.timeframes.map(tf => {
        const i = tf.indicators
        const adxValues = i.adx.slice(-10)
        const rsiValues = i.rsi.slice(-10)
        const macdHist = i.macd.histogram.slice(-10)
        const bbWidthValues = i.bbWidth.slice(-10)
        const stochK = i.stochastic.k.slice(-5)
        const stochD = i.stochastic.d.slice(-5)

        const vf = i.volumeFlow
        return `### ${tf.timeframe}
- ADX (last 10): [${adxValues.map(v => v.toFixed(1)).join(', ')}]
- RSI (last 10): [${rsiValues.map(v => v.toFixed(1)).join(', ')}]
- MACD histogram (last 10): [${macdHist.map(v => v.toFixed(6)).join(', ')}]
- BB Width % (last 10): [${bbWidthValues.map(v => v.toFixed(2)).join(', ')}]
- Stochastic K/D (last 5): K=[${stochK.map(v => v.toFixed(1)).join(', ')}] D=[${stochD.map(v => v.toFixed(1)).join(', ')}]
- ATR (last): ${i.atr[i.atr.length - 1]?.toFixed(6) || 'N/A'}
- Parabolic SAR direction: ${i.parabolicSar.direction[i.parabolicSar.direction.length - 1] || 'N/A'}
- Alligator: jaw=${i.alligator.jaw.slice(-1)[0]?.toFixed(6) || 'N/A'}, teeth=${i.alligator.teeth.slice(-1)[0]?.toFixed(6) || 'N/A'}, lips=${i.alligator.lips.slice(-1)[0]?.toFixed(6) || 'N/A'}, state=${i.alligator.state.slice(-1)[0] || 'N/A'}
- AO (last 5): [${i.awesomeOscillator.slice(-5).map(v => isNaN(v) ? 'NaN' : v.toFixed(6)).join(', ')}]
- AC (last 5): [${i.acceleratorOscillator.slice(-5).map(v => isNaN(v) ? 'NaN' : v.toFixed(6)).join(', ')}]
- BW Setup: score=${tf.fractalAnalysis?.setupScore ?? 0}/100, direction=${tf.fractalAnalysis?.setupDirection ?? 'none'}${tf.fractalAnalysis?.volumeConfirmation?.trapWarning ? ' ⚠️ TRAP' : tf.fractalAnalysis?.volumeConfirmation?.breakoutConfirmed ? ' ✓VOL' : ''}
- BW Signals: ${tf.fractalAnalysis?.signals.join('; ') || 'none'}
- Volume Profile: VPOC=${vf.volumeProfile.vpoc.toFixed(6)}, VA=${vf.volumeProfile.valueAreaLow.toFixed(6)}–${vf.volumeProfile.valueAreaHigh.toFixed(6)}
- HVN (real S/R): [${vf.volumeProfile.hvn.slice(0, 4).map(p => p.toFixed(6)).join(', ') || 'none'}]
- LVN (thin zones): [${vf.volumeProfile.lvn.slice(0, 4).map(p => p.toFixed(6)).join(', ') || 'none'}]
- VWAP: ${vf.vwap[vf.vwap.length - 1]?.toFixed(6) || 'N/A'}
- Volume Exhaustion: ${vf.exhaustion.detected ? `${vf.exhaustion.type} (${vf.exhaustion.severity})` : 'none'}
- Trend score: ${tf.trend.score}/100 (${tf.trend.direction})`
    }).join('\n\n')

    // Cross-TF divergence data
    const rsiByTF = data.timeframes.map(tf => ({
        tf: tf.timeframe,
        rsi: tf.indicators.rsi[tf.indicators.rsi.length - 1] || 50,
        macdHist: tf.indicators.macd.histogram[tf.indicators.macd.histogram.length - 1] || 0,
    }))

    const assetConfig = getAssetConfig(data.pair)
    const marketLabel = assetConfig.type === 'crypto' ? 'cryptocurrency' : assetConfig.type === 'cfd_index' ? 'index' : 'forex'

    const cryptoNote = assetConfig.type === 'crypto'
        ? `\n## CRYPTO MODE — ${assetConfig.cryptoMeta!.displayName}
- Validate Confluence Strategy phases against 24/7 price action. No session bias.
- Volume patterns differ from forex — crypto has weekend low-liquidity traps and exchange-specific volume spikes.
- CoinGecko OHLC volume may be limited — weight price structure and indicator divergence over raw volume.
- Funding rates and open interest replace session flow analysis.
- Use "points" not "pips" for all measurements.\n`
        : ''

    return `You are the Quantitative Engine — a statistical validator for ${marketLabel} trading signals.
Your job is to validate the structural analysis with hard numbers and compute precise levels.
${cryptoNote}

## CROSS-VALIDATION MANDATE (MANDATORY)
- Cross-check EVERY price level from Gemini's analysis against actual swing highs/lows in the indicator data.
- Flag any Gemini level that does NOT correspond to an actual swing high/low or candle boundary within 1 ATR tolerance.
- Cross-check fractal levels against Alligator teeth position — fractals inside the "mouth" (between jaw and teeth) are NOT valid Bill Williams signals.
- **Elliott Wave Validation**: Verify that proposed entry/exit levels align with Elliott Wave Fibonacci retracements/extensions. If entering on a "Wave 3" setup, confirm we're bouncing off 38.2-61.8% retracement. If targeting, use 127.2-161.8% extensions.
- **Wave Structure Confirmation**: If Elliott Wave shows "corrective" pattern but Gemini suggests trend continuation, flag this as conflicting signals. Corrective waves (A-B-C) move counter-trend.
- **FAST MATRIX VALIDATION (MANDATORY)**: Cross-check all layers against raw indicator data:
  - H1 Macro (Dow Theory): Verify HH/HL or LH/LL swing structure from actual H1 pivot data. Confirm trend/filter alignment is real.
  - Active Scenario ID (Wave 2 vs Wave 4): Verify whether the current corrective wave matches Wave 2 (deeper retrace, 50-78.6% Fib) or Wave 4 (shallower, 23.6-50% Fib). Flag if mislabeled.
  - Confirmation Layer (M15): Verify RSI divergence and MACD divergence are present in raw M15 indicator data. If neither divergence exists, flag scenario as unconfirmed.
  - Trigger Layer (M1): Verify volume climax spike, CHoCH (change of character), and Stochastic reload from M1 data. These are execution triggers — at least 2 of 3 must fire.
  - Execution: Verify SL is at Spring price (lowest wick of correction). Verify TP1/TP2 at Fib extensions (127.2%/161.8%). Flag if R:R to TP1 < 2:1.
  - If the active scenario score < 50, flag it as "weak setup" in your validation.
- Include a "flagged_levels" array in your output listing any suspicious levels with reasons.
- Your own precise_levels must ONLY use prices derivable from actual candle data.

## VOLUME FLOW VALIDATION (MANDATORY)
- Cross-validate Gemini's key levels against Volume Profile HVN. Levels at HVN are STRONGER than levels at LVN.
- If Gemini cites a support/resistance that sits at an LVN (thin volume), downgrade its reliability in your assessment.
- VPOC is the single most statistically significant price level — if Gemini misses it, add it to your own levels.
- If Volume Exhaustion is detected on D or H4, flag it as a potential trend reversal risk regardless of other indicators.
- If a fractal breakout has a VOLUME TRAP WARNING, it must be flagged as unreliable even if other BW indicators confirm.

## PAIR: ${data.pair}
**Current Price**: ${data.currentPrice.toFixed(5)}
**Pip Location**: ${data.pipLocation}
**Volatility**: ${data.volatilityStatus} (ATR14: ${data.atr14.toFixed(1)} pips)

## GEMINI'S STRUCTURAL ANALYSIS (to validate)
${geminiOutput}

## RAW INDICATOR DATA
${indicatorSummary}

## CROSS-TF COMPARISON
${rsiByTF.map(r => `${r.tf}: RSI=${r.rsi.toFixed(1)}, MACD Hist=${r.macdHist.toFixed(6)}`).join('\n')}

## AMD ALGORITHMIC ASSESSMENT
${Object.entries(data.amdPhases).map(([tf, p]) => `${tf}: ${p.phase} (${p.confidence}%)`).join('\n')}

## THE FAST MATRIX STATUS
${data.fastMatrix ? `Active Scenario: ${data.fastMatrix.activeScenario ?? 'NONE'} | Score: ${data.fastMatrix.overallScore}/100 | Direction: ${data.fastMatrix.direction}
Narrative: ${data.fastMatrix.narrative}
H1 Macro: Trend=${data.fastMatrix.macro.trend}, Filter=${data.fastMatrix.macro.filter}, HH=${data.fastMatrix.macro.higherHighs}, HL=${data.fastMatrix.macro.higherLows}, LH=${data.fastMatrix.macro.lowerHighs}, LL=${data.fastMatrix.macro.lowerLows}
Scenario A (${data.fastMatrix.scenarios.A.label}): ${data.fastMatrix.scenarios.A.status} | Score=${data.fastMatrix.scenarios.A.score}/100 | Dir=${data.fastMatrix.scenarios.A.direction} | Wave=${data.fastMatrix.scenarios.A.waveType} | GP=${data.fastMatrix.scenarios.A.goldenPocket} | DB=${data.fastMatrix.scenarios.A.diamondBox} | RSI-Div=${data.fastMatrix.scenarios.A.rsiDivergence.detected} | MACD-Div=${data.fastMatrix.scenarios.A.macdDivergence.detected} | VolClimax=${data.fastMatrix.scenarios.A.volumeClimax.detected} | CHoCH=${data.fastMatrix.scenarios.A.choch.detected} | StochReload=${data.fastMatrix.scenarios.A.stochasticReload.detected} | R:R(TP1)=${data.fastMatrix.scenarios.A.riskRewardToTP1?.toFixed(1) ?? 'N/A'} | R:R(TP2)=${data.fastMatrix.scenarios.A.riskRewardToTP2?.toFixed(1) ?? 'N/A'}
Scenario B (${data.fastMatrix.scenarios.B.label}): ${data.fastMatrix.scenarios.B.status} | Score=${data.fastMatrix.scenarios.B.score}/100 | Dir=${data.fastMatrix.scenarios.B.direction} | Wave=${data.fastMatrix.scenarios.B.waveType} | GP=${data.fastMatrix.scenarios.B.goldenPocket} | DB=${data.fastMatrix.scenarios.B.diamondBox} | RSI-Div=${data.fastMatrix.scenarios.B.rsiDivergence.detected} | MACD-Div=${data.fastMatrix.scenarios.B.macdDivergence.detected} | VolClimax=${data.fastMatrix.scenarios.B.volumeClimax.detected} | CHoCH=${data.fastMatrix.scenarios.B.choch.detected} | StochReload=${data.fastMatrix.scenarios.B.stochasticReload.detected} | R:R(TP1)=${data.fastMatrix.scenarios.B.riskRewardToTP1?.toFixed(1) ?? 'N/A'} | R:R(TP2)=${data.fastMatrix.scenarios.B.riskRewardToTP2?.toFixed(1) ?? 'N/A'}
Scenario C (${data.fastMatrix.scenarios.C.label}): ${data.fastMatrix.scenarios.C.status} | Score=${data.fastMatrix.scenarios.C.score}/100 | Dir=${data.fastMatrix.scenarios.C.direction} | Wave=${data.fastMatrix.scenarios.C.waveType} | GP=${data.fastMatrix.scenarios.C.goldenPocket} | DB=${data.fastMatrix.scenarios.C.diamondBox} | RSI-Div=${data.fastMatrix.scenarios.C.rsiDivergence.detected} | MACD-Div=${data.fastMatrix.scenarios.C.macdDivergence.detected} | VolClimax=${data.fastMatrix.scenarios.C.volumeClimax.detected} | CHoCH=${data.fastMatrix.scenarios.C.choch.detected} | StochReload=${data.fastMatrix.scenarios.C.stochasticReload.detected} | R:R(TP1)=${data.fastMatrix.scenarios.C.riskRewardToTP1?.toFixed(1) ?? 'N/A'} | R:R(TP2)=${data.fastMatrix.scenarios.C.riskRewardToTP2?.toFixed(1) ?? 'N/A'}
Scenario D (${data.fastMatrix.scenarios.D.label}): ${data.fastMatrix.scenarios.D.status} | Score=${data.fastMatrix.scenarios.D.score}/100 | Dir=${data.fastMatrix.scenarios.D.direction} | Wave=${data.fastMatrix.scenarios.D.waveType} | GP=${data.fastMatrix.scenarios.D.goldenPocket} | DB=${data.fastMatrix.scenarios.D.diamondBox} | RSI-Div=${data.fastMatrix.scenarios.D.rsiDivergence.detected} | MACD-Div=${data.fastMatrix.scenarios.D.macdDivergence.detected} | VolClimax=${data.fastMatrix.scenarios.D.volumeClimax.detected} | CHoCH=${data.fastMatrix.scenarios.D.choch.detected} | StochReload=${data.fastMatrix.scenarios.D.stochasticReload.detected} | R:R(TP1)=${data.fastMatrix.scenarios.D.riskRewardToTP1?.toFixed(1) ?? 'N/A'} | R:R(TP2)=${data.fastMatrix.scenarios.D.riskRewardToTP2?.toFixed(1) ?? 'N/A'}
Key Levels: GP=${data.fastMatrix.keyLevels.goldenPocketLow?.toFixed(6) ?? 'N/A'}–${data.fastMatrix.keyLevels.goldenPocketHigh?.toFixed(6) ?? 'N/A'}, DB=${data.fastMatrix.keyLevels.diamondBoxLow?.toFixed(6) ?? 'N/A'}–${data.fastMatrix.keyLevels.diamondBoxHigh?.toFixed(6) ?? 'N/A'}, Eq=${data.fastMatrix.keyLevels.equilibriumPrice?.toFixed(6) ?? 'N/A'}, Spring=${data.fastMatrix.keyLevels.springPrice?.toFixed(6) ?? 'N/A'}, Entry=${data.fastMatrix.keyLevels.entryPrice?.toFixed(6) ?? 'N/A'}, SL=${data.fastMatrix.keyLevels.stopLoss?.toFixed(6) ?? 'N/A'}, TP1=${data.fastMatrix.keyLevels.tp1?.toFixed(6) ?? 'N/A'}, TP2=${data.fastMatrix.keyLevels.tp2?.toFixed(6) ?? 'N/A'}` : 'Fast Matrix unavailable.'}

## CROSS-MARKET DIVERGENCE CHECK
${buildCrossMarketCheck(crossMarket)}

${scenarioAnalysisLevels && scenarioAnalysisLevels.length > 0 ? `## PRE-VALIDATED LEVELS (from Scenario Analysis)
The following levels were validated in a recent institutional scenario analysis. Use them as REFERENCE anchors when validating Gemini's levels — if Gemini cites a level that is close to one of these, it is more likely legitimate.
${scenarioAnalysisLevels.map(l => `- ${l.price.toFixed(5)} (${l.type}, ${l.timeframe}): ${l.significance}`).join('\n')}
` : ''}## YOUR TASK
Validate Gemini's analysis statistically and provide precise trading levels.

Respond with JSON:
{
  "validation": {
    "agrees_with_gemini": true/false,
    "disagreements": ["specific disagreements if any"],
    "confidence_adjustment": number (-20 to +20, how much to adjust Gemini's confidence)
  },
  "divergences": [
    {"type": "bullish_hidden" | "bearish_hidden" | "bullish_regular" | "bearish_regular", "timeframes": ["D", "H4"], "indicator": "RSI|MACD", "description": "..."}
  ],
  "precise_levels": {
    "primary_entry": number,
    "secondary_entry": number,
    "stop_loss": number,
    "take_profit_1": number,
    "take_profit_2": number,
    "take_profit_3": number
  },
  "risk_metrics": {
    "risk_reward_ratio": number,
    "pip_risk": number,
    "pip_reward": number,
    "confluence_score": 0-100
  },
  "indicator_health": {
    "strongest_signal": "which indicator gives the clearest signal",
    "weakest_signal": "which indicator is least reliable right now",
    "overall_reliability": 0-100
  },
  "probability_assessment": {
    "bullish_probability": 0-100,
    "bearish_probability": 0-100,
    "reasoning": "Brief explanation"
  },
  "flagged_levels": [
    {"level": 1.2345, "source": "gemini_resistance", "reason": "No corresponding swing high within 1 ATR in candle data"}
  ]
}

IMPORTANT: The "flagged_levels" array is MANDATORY. If all Gemini levels check out, return an empty array [].

Be mathematically precise. Use exact pip values. Show your reasoning in the descriptions.`
}

function buildCrossMarketCheck(crossMarket?: CrossMarketReport | IndexCrossMarketReport | null): string {
    if (!crossMarket) return 'Cross-market data unavailable — skip this check.'

    const parts: string[] = []
    parts.push(`Risk Appetite: ${crossMarket.risk_appetite}`)
    parts.push(`Summary: ${crossMarket.summary}`)

    // Forex pair cross-market report
    if ('indices_analyzed' in crossMarket && crossMarket.indices_analyzed) {
        const trends = crossMarket.indices_analyzed.map(idx =>
            `${idx.name}: ${idx.recent_trend}`
        ).join(', ')
        parts.push(`Index Trends: ${trends}`)
        if (crossMarket.currency_implications) {
            parts.push(`Currency Flow: net effect = ${crossMarket.currency_implications.net_effect}`)
        }
    }

    // Index cross-market report
    if ('peer_indices' in crossMarket && crossMarket.peer_indices) {
        const trends = crossMarket.peer_indices.map(idx =>
            `${idx.name}: ${idx.change1d > 0 ? '+' : ''}${idx.change1d.toFixed(1)}%`
        ).join(', ')
        parts.push(`Peer Indices: ${trends}`)
        parts.push(`Dollar: ${crossMarket.dollar_analysis.trend}`)
    }

    parts.push('')
    parts.push('VALIDATION RULE: If Gemini\'s bullish bias is CONTRADICTED by risk-off conditions')
    parts.push('(equities dumping, dollar strengthening), flag in disagreements and reduce')
    parts.push('confidence_adjustment. If aligned, boost confidence.')

    return parts.join('\n')
}
