import { ChecklistItem } from '@/lib/types/database'

export const TRUE_FRACTAL_STRATEGY = {
    name: "The Fast Matrix",
    description: "H1 Macro Direction → 4 Scenario Matrix (A/B/C/D) → M1 Precision Entry. Scenario A: Bullish Wave 2 (Crash Trap — Golden Pocket on M15). Scenario B: Bullish Wave 4 (Diamond Chop — 1/Price equilibrium box on M15). Scenario C: Bearish Wave 2 (Relief Trap). Scenario D: Bearish Wave 4 (Diamond Chop). Universal execution: M1 CHoCH + Stochastic reload. SL: 1 pip below Spring/above Upthrust. TP1: 100% ext (50% close). TP2: 161.8% ext (50% close). 2% risk.",
    checklist_items: [
        {
            id: "fm-1",
            category: "macro",
            label: "H1 macro trend confirmed (HH/HL = buy only, LH/LL = sell only)",
            logical_condition: "H1 swing structure shows 2+ consecutive Higher Highs + Higher Lows (buy only) or 2+ Lower Highs + Lower Lows (sell only). No trade in ranging markets."
        },
        {
            id: "fm-2",
            category: "scenario",
            label: "Active scenario identified (A/B/C/D)",
            logical_condition: "System determines whether price is in Wave 2 correction (Scenarios A/C: Golden Pocket 50-61.8% zone) or Wave 4 correction (Scenarios B/D: Diamond Box equilibrium range). Only one scenario active at a time."
        },
        {
            id: "fm-3",
            category: "confirmation",
            label: "RSI divergence + MACD divergence confirmed on M15",
            logical_condition: "For Wave 2: RSI bullish/bearish divergence at Golden Pocket + MACD histogram shallowing. For Wave 4: RSI divergence at Diamond Box boundary. Both must be present on M15 timeframe."
        },
        {
            id: "fm-4",
            category: "trigger",
            label: "M1 volume climax + rejection candle at key zone",
            logical_condition: "M1 candle shows 2x+ average volume with a rejection wick at the Fibonacci level (Wave 2) or box boundary (Wave 4). Price sweeps below/above the zone then closes back inside — the Spring (longs) or Upthrust (shorts)."
        },
        {
            id: "fm-5",
            category: "trigger",
            label: "M1 CHoCH confirmed (structural break)",
            logical_condition: "Bullish: M1 price breaks above the most recent Lower High. Bearish: M1 price breaks below the most recent Higher Low. This is the Change of Character confirming the reversal."
        },
        {
            id: "fm-6",
            category: "execution",
            label: "Stochastic reload from extreme zone",
            logical_condition: "Bullish: Stochastic K crosses D upward from below 20. Bearish: Stochastic K crosses D downward from above 80. This is the micro-pullback timing signal for market entry."
        },
        {
            id: "fm-7",
            category: "execution",
            label: "SL below Spring / above Upthrust, split TP1/TP2",
            logical_condition: "Stop loss 1 pip below the Spring rejection wick (longs) or 1 pip above the Upthrust wick (shorts). TP1 at 100% Fib extension (close 50% — risk free). TP2 at 161.8% Fib extension (close remaining 50%)."
        },
        {
            id: "fm-8",
            category: "execution",
            label: "Position sized at exactly 2% risk ($17 on $850)",
            logical_condition: "Units = (accountBalance * 0.02) / |entryPrice - stopLoss|. No exceptions. After TP1 hit, move SL to entry for risk-free runner to TP2."
        }
    ] as ChecklistItem[]
}
