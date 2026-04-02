import { callDeepSeek } from '@/lib/ai/clients'
import { parseAIJson } from '@/lib/ai/parse-response'
import { saveAgentReport } from './data'
import type { StoryDataPayload } from '../types'
import type { IndicatorOptimizerReport } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_PARAMS: Record<string, Record<string, number>> = {
    RSI: { period: 14 },
    MACD: { fast: 12, slow: 26, signal: 9 },
    Stochastic: { kPeriod: 14, dPeriod: 3 },
    BB: { period: 20, stdDev: 2 },
    ADX: { period: 14 },
    ATR: { period: 14 },
    EMA_Cross: { fast: 8, slow: 21 },
    SMA_Cross: { fast: 50, slow: 200 },
    SAR: { step: 0.02, max: 0.2 },
    Alligator: { jawPeriod: 13, teethPeriod: 8, lipsPeriod: 5 },
    AO: { fast: 5, slow: 34 },
}

/**
 * Indicator Optimizer Agent — uses DeepSeek to recommend optimal indicator parameters.
 * Analyzes the collected story data (no extra OANDA calls).
 */
export async function runIndicatorOptimizer(
    pair: string,
    data: StoryDataPayload,
    userId: string,
    client: SupabaseClient
): Promise<IndicatorOptimizerReport | null> {
    const start = Date.now()

    try {
        const prompt = buildOptimizerPrompt(pair, data)
        const rawOutput = await callDeepSeek(prompt, { timeout: 90_000, maxTokens: 4096 })
        const report = parseAIJson<IndicatorOptimizerReport>(rawOutput)
        report.pair = pair

        // Save agent report
        await saveAgentReport(userId, pair, 'indicator_optimizer', report as unknown as Record<string, unknown>, {
            rawOutput, model: 'deepseek-chat', durationMs: Date.now() - start,
        }, client)

        // Upsert individual optimizations
        await upsertOptimizations(userId, pair, report, client)

        return report
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Indicator optimizer failed for ${pair}:`, message)
        await saveAgentReport(userId, pair, 'indicator_optimizer', {}, {
            model: 'deepseek-chat', durationMs: Date.now() - start, error: message,
        }, client)
        return null
    }
}

async function upsertOptimizations(
    userId: string,
    pair: string,
    report: IndicatorOptimizerReport,
    client: SupabaseClient
): Promise<void> {
    for (const opt of report.optimizations) {
        const { error } = await client
            .from('indicator_optimizations')
            .upsert({
                user_id: userId,
                pair,
                timeframe: opt.timeframe,
                indicator: opt.indicator,
                optimized_params: opt.recommended_params,
                default_params: opt.current_params,
                improvement_percent: parseFloat(opt.expected_improvement) || null,
                recommendation: `Confidence: ${opt.confidence}%`,
                reasoning: opt.reasoning,
                optimized_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, {
                onConflict: 'user_id,pair,timeframe,indicator',
            })

        if (error) {
            console.error(`Failed to upsert optimization ${opt.indicator}/${opt.timeframe}:`, error.message)
        }
    }
}

function buildOptimizerPrompt(pair: string, data: StoryDataPayload): string {
    // Extract compact data per timeframe: last 50 closes + current indicator values
    const tfSummaries = data.timeframes.map(tf => {
        const closes = tf.candles.slice(-50).map(c => parseFloat(c.mid.c))
        const highs = tf.candles.slice(-50).map(c => parseFloat(c.mid.h))
        const lows = tf.candles.slice(-50).map(c => parseFloat(c.mid.l))

        const lastRsi = tf.indicators.rsi.slice(-1)[0]
        const lastMacd = tf.indicators.macd.histogram.slice(-1)[0]
        const lastAdx = tf.indicators.adx.slice(-1)[0]
        const lastBbWidth = tf.indicators.bbWidth.slice(-1)[0]
        const lastAtr = tf.indicators.atr.slice(-1)[0]
        const lastStochK = tf.indicators.stochastic.k.slice(-1)[0]

        return `### ${tf.timeframe}
Trend: ${tf.trend.direction} (score: ${tf.trend.score}/100, ADX: ${tf.trend.adxValue.toFixed(1)})
Last 50 closes: [${closes.slice(0, 10).map(c => c.toFixed(5)).join(', ')}, ... ${closes.slice(-5).map(c => c.toFixed(5)).join(', ')}]
Price range (50 bars): ${Math.min(...lows).toFixed(5)} - ${Math.max(...highs).toFixed(5)}
Current RSI(14): ${lastRsi?.toFixed(1) ?? 'N/A'}
Current MACD histogram: ${lastMacd?.toFixed(6) ?? 'N/A'}
Current ADX(14): ${lastAdx?.toFixed(1) ?? 'N/A'}
Current BB Width: ${lastBbWidth?.toFixed(2) ?? 'N/A'}
Current ATR(14): ${lastAtr?.toFixed(1) ?? 'N/A'} pips
Current Stoch K: ${lastStochK?.toFixed(1) ?? 'N/A'}
Patterns detected: ${tf.patterns.join(', ') || 'None'}
Current Alligator state: ${tf.indicators.alligator.state[tf.indicators.alligator.state.length - 1] || 'N/A'}
BW Setup Score: ${tf.fractalAnalysis?.setupScore ?? 'N/A'}/100`
    }).join('\n\n')

    return `You are a quantitative indicator optimization specialist. Analyze this ${pair} data across 5 timeframes and recommend optimal indicator parameters.

## CURRENT DATA FOR ${pair}

Current Price: ${data.currentPrice.toFixed(5)}
Volatility: ${data.volatilityStatus} (ATR14: ${data.atr14.toFixed(1)} pips)

${tfSummaries}

## DEFAULT PARAMETERS
${Object.entries(DEFAULT_PARAMS).map(([ind, params]) =>
    `- ${ind}: ${JSON.stringify(params)}`
).join('\n')}

## YOUR ANALYSIS TASK

For each indicator on each timeframe, analyze whether the default parameters are optimal for this pair's current behavior. Consider:

1. **RSI**: Is period 14 too slow/fast for this pair's volatility? Would 10 or 21 better catch reversals?
2. **MACD**: Is 12/26/9 lagging? Should we tighten to 8/17/9 for faster signals? Or widen for trending?
3. **Bollinger Bands**: Are bands too wide/narrow for current regime? Should period or stdDev change?
4. **Stochastic**: Does K=14 work, or would faster/slower settings reduce false signals?
5. **ADX**: Is 14 appropriate, or would a different period better capture trend shifts?
6. **EMA Cross**: Are 8/21 appropriate, or should we adjust for this pair's cycle length?
7. **SMA Cross**: Are 50/200 appropriate for the macro trend detection?
8. **SAR**: Are step/max values appropriate for this volatility level?
9. **Alligator**: Are the 13/8/5 periods appropriate for this pair's cycle length? Faster pairs may need shorter periods.
10. **Awesome Oscillator**: Are 5/34 SMA periods optimal for this pair's momentum characteristics?

Also determine the overall market regime (trending, ranging, volatile, transitioning).

Only recommend changes where you have genuine confidence the optimization would help. If defaults work fine for a TF/indicator combo, still include it but with low confidence.

Respond with JSON (no markdown fences):
{
  "pair": "${pair}",
  "optimizations": [
    {
      "timeframe": "D",
      "indicator": "RSI",
      "current_params": {"period": 14},
      "recommended_params": {"period": 10},
      "expected_improvement": "15%",
      "confidence": 75,
      "reasoning": "Brief explanation"
    }
  ],
  "market_regime": "trending" | "ranging" | "volatile" | "transitioning",
  "regime_implications": "2-3 sentences about what this regime means for indicator reliability",
  "summary": "2-3 sentence executive summary for the narrator"
}`
}
