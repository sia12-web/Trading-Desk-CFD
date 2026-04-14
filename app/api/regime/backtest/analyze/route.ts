import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/ai/clients'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { result } = body

        if (!result) {
            return NextResponse.json({ error: 'Missing simulation result' }, { status: 400 })
        }

        const prompt = `You are a group of three elite trading professionals: The Quantitative Analyst, The Hedge Fund Manager, and The Floor Operator. 

You have just run a backtest on ${result.pair} over the last ${result.lookback_days} days.
The system uses three strict divisions:
- Sniper (Trap Bot / Ranging)
- Rider (Momentum Trend)
- Killzone (Complex Corrections)

Here is the empirical result of the simulation:
Total Trades: ${result.metrics.total_trades}
Win Rate: ${result.metrics.win_rate}%
Profit Factor: ${result.metrics.profit_factor}
Max Drawdown: -${result.metrics.max_drawdown_percent}%
Total Pips: ${result.metrics.total_pips}

Please write a brief, highly readable discussion between yourselves (Analyst, Manager, Operator) analyzing WHY these specific results occurred for this specific pair over this specific lookback period.

If the results are poor or mediocre, explicitly discuss WHICH parameters in the underlying code should be changed (e.g. "We need to dynamically widen the Rider's trailing stop from 1.5 ATR to 2.0 ATR because ${result.pair} is too volatile", or "The Sniper bot is entering too early, we need to tighten the Donchian channel requirement"). 

Format the response using Markdown. Use blockquotes or bolding to identify who is speaking. Keep it extremely sharp, focused on parameter dynamics, and actionable.`

        const analysis = await callClaude(prompt, { 
            model: 'claude-opus-4-6', // We use the absolute smartest model for deep architectural reflections
            maxTokens: 2000
        })

        return NextResponse.json({ analysis })
    } catch (error) {
        console.error('[AI Backtest Analysis] Error:', error)
        return NextResponse.json({ error: 'Failed to analyze backtest' }, { status: 500 })
    }
}
