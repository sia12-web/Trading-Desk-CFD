import type { StoryDataPayload } from '../types'
import type { StoryNewsContext } from '../types'
import type { CrossMarketReport, IndexCrossMarketReport } from '../agents/types'
import { getAssetConfig } from '../asset-config'

/**
 * Gemini "Pattern Archaeologist" prompt for Story.
 * Processes ALL raw data across 5 TFs, outputs structural map.
 */
export function buildStoryStructuralPrompt(
    data: StoryDataPayload,
    news: StoryNewsContext,
    crossMarket?: CrossMarketReport | IndexCrossMarketReport | null
): string {
    const tfSummaries = data.timeframes.map(tf => {
        const lastCandle = tf.candles[tf.candles.length - 1]
        const last5 = tf.candles.slice(-5)
        const adx = tf.indicators.adx
        const rsi = tf.indicators.rsi
        const macd = tf.indicators.macd
        const bbWidth = tf.indicators.bbWidth

        return `### ${tf.timeframe} Timeframe (${tf.candles.length} candles)
- **Trend**: ${tf.trend.direction} (score: ${tf.trend.score}/100, ADX: ${tf.trend.adxValue.toFixed(1)})
- **Last Close**: ${parseFloat(lastCandle.mid.c).toFixed(5)}
- **RSI**: ${rsi[rsi.length - 1]?.toFixed(1) || 'N/A'}
- **MACD**: line=${macd.line[macd.line.length - 1]?.toFixed(6) || 'N/A'}, histogram=${macd.histogram[macd.histogram.length - 1]?.toFixed(6) || 'N/A'}
- **ADX**: ${adx[adx.length - 1]?.toFixed(1) || 'N/A'}
- **BB Width**: ${bbWidth[bbWidth.length - 1]?.toFixed(2) || 'N/A'}%
- **Patterns**: ${tf.patterns.length > 0 ? tf.patterns.join(', ') : 'none'}
- **Swing Highs**: ${tf.swingHighs.slice(-3).map(s => s.price.toFixed(5)).join(', ') || 'none'}
- **Swing Lows**: ${tf.swingLows.slice(-3).map(s => s.price.toFixed(5)).join(', ') || 'none'}
- **Gann Levels** (low of swing high bars): ${tf.swingHighs.slice(-3).filter(s => s.oppositeExtreme).map(s => s.oppositeExtreme!.toFixed(5)).join(', ') || 'none'}
- **Gann Levels** (high of swing low bars): ${tf.swingLows.slice(-3).filter(s => s.oppositeExtreme).map(s => s.oppositeExtreme!.toFixed(5)).join(', ') || 'none'}
- **Volume trend**: ${describeVolume(tf.indicators.volume, tf.indicators.volumeSma)}
- **EMA alignment**: ${describeEMAs(tf.indicators.ema)}
- **Alligator**: ${tf.fractalAnalysis?.alligatorState ?? 'N/A'} (${tf.fractalAnalysis?.alligatorDirection ?? 'N/A'}), Jaw: ${tf.indicators.alligator.jaw.slice(-1)[0]?.toFixed(5) ?? 'N/A'}, Teeth: ${tf.indicators.alligator.teeth.slice(-1)[0]?.toFixed(5) ?? 'N/A'}, Lips: ${tf.indicators.alligator.lips.slice(-1)[0]?.toFixed(5) ?? 'N/A'}
- **Fractals**: Bullish: ${tf.fractalAnalysis?.recentBullishFractals.slice(-3).map(f => f.price.toFixed(5)).join(', ') || 'none'} | Bearish: ${tf.fractalAnalysis?.recentBearishFractals.slice(-3).map(f => f.price.toFixed(5)).join(', ') || 'none'}
- **AO**: ${tf.fractalAnalysis?.aoStatus.value.toFixed(6) ?? 'N/A'} (${tf.fractalAnalysis?.aoStatus.signal ?? 'N/A'})
- **BW Setup**: ${tf.fractalAnalysis?.setupScore ?? 0}/100 → ${tf.fractalAnalysis?.setupDirection ?? 'none'}${tf.fractalAnalysis?.volumeConfirmation?.trapWarning ? ' ⚠️ VOLUME TRAP WARNING' : tf.fractalAnalysis?.volumeConfirmation?.breakoutConfirmed ? ' ✓ Volume confirmed' : ''}
- **Volume Profile**: VPOC: ${tf.indicators.volumeFlow.volumeProfile.vpoc.toFixed(5)}, VA: ${tf.indicators.volumeFlow.volumeProfile.valueAreaLow.toFixed(5)}–${tf.indicators.volumeFlow.volumeProfile.valueAreaHigh.toFixed(5)}
- **HVN (Real S/R)**: ${tf.indicators.volumeFlow.volumeProfile.hvn.slice(0, 3).map(p => p.toFixed(5)).join(', ') || 'none'}
- **LVN (Fast-move zones)**: ${tf.indicators.volumeFlow.volumeProfile.lvn.slice(0, 3).map(p => p.toFixed(5)).join(', ') || 'none'}
- **VWAP**: ${tf.indicators.volumeFlow.vwap[tf.indicators.volumeFlow.vwap.length - 1]?.toFixed(5) || 'N/A'}
- **Volume Exhaustion**: ${tf.indicators.volumeFlow.exhaustion.detected ? `${tf.indicators.volumeFlow.exhaustion.type} (${tf.indicators.volumeFlow.exhaustion.severity}) — ${tf.indicators.volumeFlow.exhaustion.description}` : 'None detected'}
- **Last 5 candles**: ${last5.map(c => `${parseFloat(c.mid.o).toFixed(5)}->${parseFloat(c.mid.c).toFixed(5)} (H:${parseFloat(c.mid.h).toFixed(5)} L:${parseFloat(c.mid.l).toFixed(5)})`).join(' | ')}`
    }).join('\n\n')

    const amdSummary = Object.entries(data.amdPhases)
        .map(([tf, phase]) => `- ${tf}: ${phase.phase} (confidence: ${phase.confidence}%) — ${phase.signals.join('; ')}`)
        .join('\n')

    const liquiditySummary = data.liquidityZones.length > 0
        ? data.liquidityZones.map(z => `- [${z.timeframe}] ${z.type}: ${z.description}${z.swept ? ' (SWEPT)' : ''}`).join('\n')
        : 'No significant liquidity zones detected.'

    const assetConfig = getAssetConfig(data.pair)
    const marketLabel = assetConfig.type === 'crypto' ? 'cryptocurrency' : assetConfig.type === 'cfd_index' ? 'index' : 'forex'
    const pointLabel = assetConfig.pointLabel

    const cryptoNote = assetConfig.type === 'crypto'
        ? `\n\n## CRYPTO MODE — ${assetConfig.cryptoMeta!.displayName} (${assetConfig.cryptoMeta!.symbol})
This is a CRYPTOCURRENCY, not a forex pair. Structural analysis adjustments:
- **24/7 market**: No session opens/closes. Focus on UTC high-volume hours (12:00-20:00) for momentum.
- **Fundamental drivers**: ${assetConfig.cryptoMeta!.keyDrivers.join(', ')}
- **Key context**: BTC dominance trends, DeFi ecosystem health, regulatory headlines, whale wallet movements
- **Volume caveat**: CoinGecko OHLC volume may be limited — weight price structure over volume for confirmation.
- Use "${pointLabel}" not "pips" for all price movement references.`
        : ''

    return `You are the Pattern Archaeologist — a structural analyst for ${marketLabel} markets.
Your job is to dig through multi-timeframe data and find the structural story.

## GROUNDING RULES (MANDATORY)
- ONLY reference price levels that appear in the candle data below (swing highs, swing lows, OHLC values).
- NEVER fabricate or estimate price levels. Every level you cite must be traceable to a specific candle or swing point.
- If data is insufficient for a particular timeframe, explicitly state "insufficient data" rather than guessing.
- All key_levels must come from actual swing highs/lows or candle boundaries provided below.

## GANN LEVELS (W.D. Gann Methodology)
In addition to standard swing highs/lows, you are provided with Gann-based key levels:
- **Low of swing high bars**: When a bar makes a swing high, its LOW often becomes resistance on pullbacks (marks the extreme volatility at the peak)
- **High of swing low bars**: When a bar makes a swing low, its HIGH often becomes support on rallies (marks the extreme volatility at the bottom)
These are REAL levels from actual candle data, not projections. Use them as additional confluence points for support/resistance.
${cryptoNote}
## PAIR: ${data.pair}
**Current Price**: ${data.currentPrice.toFixed(5)}
**Volatility**: ${data.volatilityStatus} (ATR14: ${data.atr14.toFixed(1)} ${pointLabel})
**Data collected at**: ${data.collectedAt}

## FUNDAMENTAL CONTEXT
- Sentiment: ${news.sentiment}
- Key drivers: ${news.key_drivers.join(', ')}
- ${news.fundamental_narrative}
${news.avoidTrading ? '⚠️ HIGH-IMPACT NEWS IMMINENT — trading avoidance recommended' : ''}

## CROSS-MARKET INTELLIGENCE
${buildCrossMarketBlock(crossMarket)}

## MULTI-TIMEFRAME DATA
${tfSummaries}

## AMD PHASE ASSESSMENT (algorithmic)
${amdSummary}

## LIQUIDITY ZONES
${liquiditySummary}

## THE FAST MATRIX STATUS
${data.fastMatrix ? `**Active Scenario**: ${data.fastMatrix.activeScenario ?? 'NONE'} | Overall Score: ${data.fastMatrix.overallScore}/100 | Direction: ${data.fastMatrix.direction}
- **H1 Macro**: Trend: ${data.fastMatrix.macro.trend} | Filter: ${data.fastMatrix.macro.filter} | HH: ${data.fastMatrix.macro.higherHighs} | HL: ${data.fastMatrix.macro.higherLows} | LH: ${data.fastMatrix.macro.lowerHighs} | LL: ${data.fastMatrix.macro.lowerLows}
- **Scenario A** (${data.fastMatrix.scenarios.A.label}): ${data.fastMatrix.scenarios.A.active ? 'ACTIVE' : 'inactive'} | Score: ${data.fastMatrix.scenarios.A.score}/100 | Dir: ${data.fastMatrix.scenarios.A.direction} | Wave: ${data.fastMatrix.scenarios.A.waveType} | RSI Div: ${data.fastMatrix.scenarios.A.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: ${data.fastMatrix.scenarios.A.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: ${data.fastMatrix.scenarios.A.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: ${data.fastMatrix.scenarios.A.choch.detected ? 'YES' : 'NO'} | Stoch Reload: ${data.fastMatrix.scenarios.A.stochasticReload.detected ? 'YES' : 'NO'} | Status: ${data.fastMatrix.scenarios.A.status}
- **Scenario B** (${data.fastMatrix.scenarios.B.label}): ${data.fastMatrix.scenarios.B.active ? 'ACTIVE' : 'inactive'} | Score: ${data.fastMatrix.scenarios.B.score}/100 | Dir: ${data.fastMatrix.scenarios.B.direction} | Wave: ${data.fastMatrix.scenarios.B.waveType} | RSI Div: ${data.fastMatrix.scenarios.B.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: ${data.fastMatrix.scenarios.B.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: ${data.fastMatrix.scenarios.B.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: ${data.fastMatrix.scenarios.B.choch.detected ? 'YES' : 'NO'} | Stoch Reload: ${data.fastMatrix.scenarios.B.stochasticReload.detected ? 'YES' : 'NO'} | Status: ${data.fastMatrix.scenarios.B.status}
- **Scenario C** (${data.fastMatrix.scenarios.C.label}): ${data.fastMatrix.scenarios.C.active ? 'ACTIVE' : 'inactive'} | Score: ${data.fastMatrix.scenarios.C.score}/100 | Dir: ${data.fastMatrix.scenarios.C.direction} | Wave: ${data.fastMatrix.scenarios.C.waveType} | RSI Div: ${data.fastMatrix.scenarios.C.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: ${data.fastMatrix.scenarios.C.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: ${data.fastMatrix.scenarios.C.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: ${data.fastMatrix.scenarios.C.choch.detected ? 'YES' : 'NO'} | Stoch Reload: ${data.fastMatrix.scenarios.C.stochasticReload.detected ? 'YES' : 'NO'} | Status: ${data.fastMatrix.scenarios.C.status}
- **Scenario D** (${data.fastMatrix.scenarios.D.label}): ${data.fastMatrix.scenarios.D.active ? 'ACTIVE' : 'inactive'} | Score: ${data.fastMatrix.scenarios.D.score}/100 | Dir: ${data.fastMatrix.scenarios.D.direction} | Wave: ${data.fastMatrix.scenarios.D.waveType} | RSI Div: ${data.fastMatrix.scenarios.D.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: ${data.fastMatrix.scenarios.D.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: ${data.fastMatrix.scenarios.D.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: ${data.fastMatrix.scenarios.D.choch.detected ? 'YES' : 'NO'} | Stoch Reload: ${data.fastMatrix.scenarios.D.stochasticReload.detected ? 'YES' : 'NO'} | Status: ${data.fastMatrix.scenarios.D.status}
- **Key Levels**: Golden Pocket: ${data.fastMatrix.keyLevels.goldenPocketLow?.toFixed(5) ?? 'N/A'}–${data.fastMatrix.keyLevels.goldenPocketHigh?.toFixed(5) ?? 'N/A'} | Diamond Box: ${data.fastMatrix.keyLevels.diamondBoxLow?.toFixed(5) ?? 'N/A'}–${data.fastMatrix.keyLevels.diamondBoxHigh?.toFixed(5) ?? 'N/A'} | Equilibrium: ${data.fastMatrix.keyLevels.equilibriumPrice?.toFixed(5) ?? 'N/A'} | Spring: ${data.fastMatrix.keyLevels.springPrice?.toFixed(5) ?? 'N/A'} | Entry: ${data.fastMatrix.keyLevels.entryPrice?.toFixed(5) ?? 'N/A'} | SL: ${data.fastMatrix.keyLevels.stopLoss?.toFixed(5) ?? 'N/A'} | TP1: ${data.fastMatrix.keyLevels.tp1?.toFixed(5) ?? 'N/A'} | TP2: ${data.fastMatrix.keyLevels.tp2?.toFixed(5) ?? 'N/A'}
- **Narrative**: ${data.fastMatrix.narrative}` : 'Fast Matrix detection unavailable (missing required timeframe data).'}

## YOUR TASK
Analyze ALL the data above and produce a JSON response:
{
  "structural_bias": "bullish" | "bearish" | "neutral",
  "bias_confidence": 0-100,
  "key_levels": {
    "major_resistance": [price1, price2],
    "major_support": [price1, price2],
    "liquidity_targets": [price1, price2]
  },
  "pattern_confluences": ["description of pattern alignment across TFs..."],
  "cycle_assessment": "Where is this pair in its cycle? Accumulation, markup, distribution, markdown?",
  "multi_tf_alignment": "Do all TFs agree? Where are conflicts?",
  "structural_narrative": "A 3-4 sentence paragraph summarizing the structural story of this pair right now.",
  "optimization_suggestions": ["What indicators are most relevant given current structure?"]
}

**THE FAST MATRIX ASSESSMENT (PRIMARY FRAMEWORK)**: Frame your entire structural analysis through the Fast Matrix system (Dow Theory + Elliott Wave + Smart Money Concepts):
- **Phase 1 (H1 Macro Trend)**: Is the H1 Dow Theory structure established? Look for 2+ Higher Highs/Higher Lows (bullish) or Lower Highs/Lower Lows (bearish). Check the directional filter alignment. No trade without a confirmed H1 macro trend.
- **Scenario Identification**: Which of A/B/C/D is active? Scenario A/B are Wave 2 corrections (bullish/bearish). Scenario C/D are Wave 4 corrections (bullish/bearish). Identify the corrective wave type and whether price is in the Golden Pocket (61.8-65% Fib retracement).
- **Confirmation (M15)**: RSI divergence detected on M15? MACD divergence detected on M15? These confirm the correction is exhausting and reversal is imminent.
- **Trigger (M1)**: Volume climax on M1 (institutional footprint). Change of Character (CHoCH) — structural break confirming direction shift. Stochastic reload from oversold/overbought. All three must fire for entry.
- **Execution**: SL below/above the Spring price (thesis invalidation). TP1 at 100% Fibonacci extension. TP2 at 161.8% Fibonacci extension. Risk 2% of account per trade. R:R must be >= 2:1 to TP2.
- State which Fast Matrix scenario this pair is currently in and what needs to happen to advance to the next stage.
- If no setup is active, state "No active scenario — waiting for H1 macro trend confirmation."

**Wyckoff + AMD Integration**: The AMD detector's "accumulation" IS Wyckoff accumulation. The liquidity mapper's "stop_hunt" IS a Wyckoff Spring. Connect these explicitly in your analysis.

**Elliott Wave Structure**: Wave analysis validates the Fast Matrix framework:
- **IMPULSIVE waves (5-wave)**: Wave 3 is the post-Spring markup — the explosive move after accumulation.
- **CORRECTIVE waves (3-wave)**: The LPS pullback IS the corrective wave before Wave 3 continuation.
- **Fibonacci levels**: 50-61.8% retracements for LPS entry. 161.8% extensions for TP.

**Volume Flow Intelligence**: Use volume data to validate Fast Matrix entries:
- **VPOC** = strongest S/R level. If it aligns with the LPS entry zone, that's triple confluence.
- **HVN** = real S/R where big money sits. Accumulation range at an HVN = highest conviction.
- **Volume Exhaustion** during accumulation = Phase 2 confirmation (smart money absorbing supply).

**Cross-Market Validation**: If your Fast Matrix thesis contradicts the cross-market risk appetite, note this tension explicitly. Cross-market divergences can invalidate even high-scoring setups.

Be precise with price levels. Reference specific timeframes. Look for confluences where multiple TFs tell the same story.`
}

function describeVolume(volume: number[], volumeSma: number[]): string {
    if (volume.length === 0 || volumeSma.length === 0) return 'N/A'
    const current = volume[volume.length - 1]
    const avg = volumeSma[volumeSma.length - 1]
    if (!avg) return 'N/A'
    const ratio = current / avg
    if (ratio > 2) return `spike (${ratio.toFixed(1)}x avg)`
    if (ratio > 1.3) return `above average (${ratio.toFixed(1)}x)`
    if (ratio < 0.5) return `very low (${ratio.toFixed(1)}x avg)`
    return `normal (${ratio.toFixed(1)}x avg)`
}

function buildCrossMarketBlock(crossMarket?: CrossMarketReport | IndexCrossMarketReport | null): string {
    if (!crossMarket) return 'Cross-market data unavailable today.'

    const parts: string[] = []
    parts.push(`- Risk Appetite: ${crossMarket.risk_appetite}`)
    parts.push(`- Summary: ${crossMarket.summary}`)

    // CrossMarketReport (forex pairs)
    if ('indices_analyzed' in crossMarket && crossMarket.indices_analyzed) {
        parts.push('- Index Trends:')
        for (const idx of crossMarket.indices_analyzed) {
            parts.push(`  - ${idx.name} (${idx.instrument}): ${idx.recent_trend} — ${idx.correlation_signal}`)
        }
        if (crossMarket.currency_implications) {
            const ci = crossMarket.currency_implications
            parts.push(`- Currency Flow: base=${ci.base_currency}, quote=${ci.quote_currency}, net=${ci.net_effect}`)
        }
        if (crossMarket.divergences.length > 0) {
            parts.push(`- Divergences: ${crossMarket.divergences.join('; ')}`)
        }
        parts.push(`- Thesis: ${crossMarket.cross_market_thesis}`)
    }

    // IndexCrossMarketReport (index pairs)
    if ('peer_indices' in crossMarket && crossMarket.peer_indices) {
        parts.push('- Peer Indices:')
        for (const idx of crossMarket.peer_indices) {
            parts.push(`  - ${idx.name}: 1D=${idx.change1d > 0 ? '+' : ''}${idx.change1d.toFixed(1)}%, 5D=${idx.change5d > 0 ? '+' : ''}${idx.change5d.toFixed(1)}% | ${idx.trend}${idx.divergence_note ? ` (${idx.divergence_note})` : ''}`)
        }
        if (crossMarket.bond_analysis) {
            parts.push(`- Bonds: ${crossMarket.bond_analysis.yield_trend} — ${crossMarket.bond_analysis.implication}`)
        }
        parts.push(`- Dollar: ${crossMarket.dollar_analysis.trend} — ${crossMarket.dollar_analysis.implication}`)
        parts.push(`- Thesis: ${crossMarket.correlation_thesis}`)
    }

    return parts.join('\n')
}

function describeEMAs(ema: Record<number, number[]>): string {
    const periods = [8, 21, 50, 200].filter(p => ema[p]?.length > 0)
    if (periods.length < 2) return 'N/A'

    const values = periods.map(p => ({ period: p, value: ema[p][ema[p].length - 1] }))
    const bullish = values.every((v, i) => i === 0 || v.value < values[i - 1].value)
    const bearish = values.every((v, i) => i === 0 || v.value > values[i - 1].value)

    if (bullish) return 'bullish stack (short > long)'
    if (bearish) return 'bearish stack (short < long)'
    return 'mixed/crossing'
}
