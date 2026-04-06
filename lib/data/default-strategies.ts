import { ChecklistItem } from '@/lib/types/database'

export const TRUE_FRACTAL_STRATEGY = {
    name: "True Fractal",
    description: "Multi-timeframe Wave 3 hunter — 4-phase system combining Elliott Wave, Fibonacci, momentum divergence, Bill Williams fractals, and volume confirmation. Hunt the most explosive move in the market with surgical precision.",
    checklist_items: [
        {
            id: "tf-1",
            category: "phase1",
            label: "Daily Wave 1 Complete (5-wave impulsive structure)",
            logical_condition: "Elliott Wave detector must identify a completed impulsive 5-wave structure on the Daily timeframe. This is the macro foundation — no trade without it."
        },
        {
            id: "tf-2",
            category: "phase1",
            label: "Wave 2 Retracement in 50-61.8% Fibonacci Zone",
            logical_condition: "Wave 2 must retrace between 50% and 61.8% of Wave 1 range. This is the golden zone — where smart money loads up. Retracement outside this zone weakens the setup."
        },
        {
            id: "tf-3",
            category: "phase2",
            label: "RSI Bullish Divergence on 4H",
            logical_condition: "Price makes a lower low but RSI makes a higher low on the 4H timeframe. This is exhaustion — sellers are losing steam even as price drops."
        },
        {
            id: "tf-4",
            category: "phase2",
            label: "MACD Histogram Divergence + Structure Shift on 4H",
            logical_condition: "MACD histogram shows divergence AND price breaks above the most recent 4H swing high (structure shift). The trend is turning."
        },
        {
            id: "tf-5",
            category: "phase2",
            label: "Alligator Awakening (Lips > Teeth > Jaw, spreading)",
            logical_condition: "Bill Williams Alligator lines must be diverging in the correct order: Lips above Teeth above Jaw for longs. State must be 'awakening' or 'eating'. The beast is hungry."
        },
        {
            id: "tf-6",
            category: "phase3",
            label: "Sub-Wave 1 Detected on 1H Timeframe",
            logical_condition: "Elliott Wave detector must identify an impulsive sub-wave structure on the 1H chart within the larger Wave 3 context. This is the first sign Wave 3 is launching."
        },
        {
            id: "tf-7",
            category: "phase3",
            label: "Entry at 50-61.8% Micro Fib with Volume + Fractal Signal",
            logical_condition: "Price must retrace to the 50-61.8% Fibonacci zone of the 1H sub-wave, with volume confirmation (above average) and a Bill Williams fractal signal at the entry zone. Triple confluence = sniper entry."
        },
        {
            id: "tf-8",
            category: "phase4",
            label: "SL Below Wave 2 Bottom, TP at 161.8% Extension, R:R >= 3:1",
            logical_condition: "Stop loss placed below Wave 2 bottom (+ buffer). Take profit at 161.8% Fibonacci extension of Wave 1 range from Wave 2 bottom. Risk no more than 2% of account. Minimum R:R ratio of 3:1."
        }
    ] as ChecklistItem[]
}
