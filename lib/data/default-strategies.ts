import { ChecklistItem } from '@/lib/types/database'

export const SMC_REVERSAL_STRATEGY = {
    name: "Institutional Reversal (SMC)",
    description: "",
    checklist_items: [
        {
            id: "smc-1",
            category: "trend",
            label: "HTF Bias Alignment",
            logical_condition: "1H or 4H trend should ideally favor the reversal direction."
        },
        {
            id: "smc-2",
            category: "level",
            label: "Major Liquidity Pool",
            logical_condition: "Price must be interacting with a Daily High/Low, Weekly High/Low, or Session High/Low."
        },
        {
            id: "smc-3",
            category: "indicator",
            label: "RSI/Stochastic Divergence",
            logical_condition: "Look for a 'Lower Low' in price but a 'Higher Low' in momentum to spot exhaustion."
        },
        {
            id: "smc-4",
            category: "pattern",
            label: "SFP (Swing Failure Pattern)",
            logical_condition: "Price wicks beyond the level and closes back inside the previous candle's range."
        },
        {
            id: "smc-5",
            category: "confirmation",
            label: "Market Structure Shift (MSS)",
            logical_condition: "A 1m or 5m candle must break the most recent swing point in the new direction."
        },
        {
            id: "smc-6",
            category: "indicator",
            label: "Fair Value Gap (FVG)",
            logical_condition: "The reversal move should be energetic, leaving an imbalance behind."
        }
    ] as ChecklistItem[]
}

export const BILL_WILLIAMS_FRACTAL_STRATEGY = {
    name: "Bill Williams Fractal Strategy",
    description: "Complete Bill Williams trading system using Alligator, Fractals, AO, and AC indicators. Wait for the Alligator to wake up, confirm with fractals beyond the teeth, and ride the trend with AO/AC momentum.",
    checklist_items: [
        {
            id: "bw-1",
            category: "trend",
            label: "Alligator Awake",
            logical_condition: "Alligator lines are diverging and ordered: Lips > Teeth > Jaw (longs) or Lips < Teeth < Jaw (shorts). State must be 'eating' or 'awakening', NOT 'sleeping'."
        },
        {
            id: "bw-2",
            category: "level",
            label: "Price Beyond Alligator",
            logical_condition: "Price must be above ALL 3 Alligator lines for longs, or below ALL 3 for shorts. If price is between the lines, the setup is invalid."
        },
        {
            id: "bw-3",
            category: "pattern",
            label: "Valid Fractal Signal",
            logical_condition: "A bullish fractal (5-bar low) must form ABOVE the Teeth line for longs. A bearish fractal (5-bar high) must form BELOW the Teeth line for shorts. Fractals inside the mouth are invalid."
        },
        {
            id: "bw-4",
            category: "indicator",
            label: "AO Confirmation",
            logical_condition: "Awesome Oscillator must be positive (green, above zero) for longs or negative (red, below zero) for shorts. Saucer pattern (momentum resumption) is the strongest signal."
        },
        {
            id: "bw-5",
            category: "indicator",
            label: "AC Green/Red Bars",
            logical_condition: "Accelerator Oscillator must show 2+ consecutive green (rising) bars for longs, or 2+ consecutive red (falling) bars for shorts. This confirms momentum is accelerating."
        },
        {
            id: "bw-6",
            category: "confirmation",
            label: "ATR-Based Stop Placement",
            logical_condition: "Stop loss placed below the most recent bullish fractal or the Alligator's Jaw (whichever is more conservative for longs). Position sized using ATR for proper risk management."
        }
    ] as ChecklistItem[]
}
