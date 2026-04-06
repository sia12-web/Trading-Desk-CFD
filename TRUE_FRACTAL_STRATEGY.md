# The True Fractal Strategy

**One strategy. Four phases. Hunt the Wave 3.**

---

## What Is This?

The True Fractal is the unified trading strategy for TradeDesk CFD. It replaces the previous SMC Reversal and Bill Williams Fractal strategies with a single, coherent system that combines:

- **Elliott Wave Theory** — identify the macro wave structure
- **Fibonacci Retracements & Extensions** — pinpoint entry zones and targets
- **RSI/MACD Divergence** — confirm momentum exhaustion and reversal
- **Bill Williams Indicators** — Alligator awakening, fractal signals
- **Volume Confirmation** — validate breakouts and trap detection

The goal: **catch Wave 3** — the longest, most explosive move in any trending market — with surgical precision and defined risk.

---

## The 4 Phases

```
Daily (D)          4-Hour (H4)           1-Hour (H1)          Math
┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌──────────────┐
│  PHASE 1    │   │     PHASE 2      │   │    PHASE 3      │   │   PHASE 4    │
│  Macro      │──▶│  Momentum        │──▶│  Sniper         │──▶│  Risk/       │
│  Scanner    │   │  Validator       │   │  Trigger        │   │  Reward      │
│             │   │                  │   │                 │   │              │
│ Wave 1 done │   │ RSI divergence   │   │ Sub-Wave 1 on   │   │ SL below W2  │
│ Wave 2 in   │   │ MACD divergence  │   │ 1H detected     │   │ TP at 161.8% │
│ 50-61.8%    │   │ Structure shift  │   │ Entry at micro  │   │ R:R >= 3:1   │
│ Fib zone    │   │ Alligator waking │   │ Fib + volume +  │   │ Max 2% risk  │
│             │   │                  │   │ fractal signal  │   │              │
└─────────────┘   └──────────────────┘   └─────────────────┘   └──────────────┘
```

Each phase **gates** the next. You cannot progress to Phase 2 until Phase 1 is confirmed. This prevents premature entries and ensures every trade has multi-timeframe confluence.

---

## Phase 1: Macro Scanner (Daily)

**Timeframe:** Daily
**Question:** *"Has the market completed a 5-wave impulse and pulled back to the golden zone?"*

### What to look for:
1. **Completed Wave 1** — A 5-wave impulsive structure on the Daily chart. This is the initial thrust that tells you a new trend is forming.
2. **Wave 2 Retracement into 50-61.8% Fibonacci Zone** — After Wave 1 completes, price pulls back. The "golden zone" (50-61.8% retracement of Wave 1) is where institutional money loads up for Wave 3.

### Checklist Items:
| ID | Item | What It Means |
|----|------|---------------|
| TF-1 | Daily Wave 1 complete (5-wave impulsive structure) | The market has made its first directional move with internal 5-wave structure |
| TF-2 | Wave 2 retracement in 50-61.8% Fibonacci zone | Price has pulled back to the optimal institutional entry zone |

### Scoring (0-100 confidence):
- +40 pts: Wave 1 complete (impulsive structure identified)
- +40 pts: Wave 2 in golden zone (50-61.8%)
- +20 pts: Wave 2 in wider zone (38.2-78.6%) — partial credit
- +10 pts: Elliott Wave confidence > 60
- +10 pts: Impulsive wave type confirmed

### Status:
- **Confirmed** (>= 70): Both Wave 1 and golden zone retracement validated
- **Forming** (>= 40): Wave structure detected but retracement not yet in zone
- **Not Detected** (< 40): No clear wave structure on Daily

### Key Levels Stored:
- `wave1Top` — The peak of Wave 1 (resistance reference)
- `wave2Bottom` — The low of Wave 2 (becomes the stop loss anchor)

---

## Phase 2: Momentum Validator (4H)

**Timeframe:** 4-Hour
**Question:** *"Is momentum confirming the reversal? Are sellers exhausted?"*

### What to look for:
3. **RSI Bullish Divergence** — Price makes a lower low, but RSI makes a higher low on 4H. Sellers are losing steam.
4. **MACD Histogram Divergence + Structure Shift** — MACD histogram diverges AND price breaks above the most recent 4H swing high. The trend is turning.
5. **Alligator Awakening** — Bill Williams Alligator lines (Lips > Teeth > Jaw) are spreading apart. The beast is hungry — a big move is coming.

### Checklist Items:
| ID | Item | What It Means |
|----|------|---------------|
| TF-3 | RSI bullish divergence on 4H (price LL, RSI HL) | Momentum exhaustion — sellers can't push lower |
| TF-4 | MACD histogram divergence + structure shift on 4H | Trend reversal confirmed by both MACD and price structure |
| TF-5 | Alligator awakening (lips > teeth > jaw, spreading) | Bill Williams confirms new trend energy building |

### Scoring (0-100 confidence):
- +30 pts: RSI bullish divergence detected
- +25 pts: MACD histogram divergence
- +25 pts: Structure shift (swing high break)
- +20 pts: Alligator in 'awakening' or 'eating' state

### Status:
- **Confirmed** (>= 70): At least 3 of 4 signals present
- **Forming** (>= 35): Some divergence signals appearing
- **Not Detected** (< 35): No momentum confirmation

### Detection Details:
- Divergence lookback: 20 bars on 4H
- Requires 3+ bars separation between swing lows
- Structure shift: current close breaks above most recent swing high in 20-bar window

---

## Phase 3: Sniper Trigger (1H)

**Timeframe:** 1-Hour
**Question:** *"Can I see Wave 3 starting? Is there a precise entry with triple confluence?"*

### What to look for:
6. **Sub-Wave 1 on 1H** — The first impulsive sub-wave of Wave 3, visible on the 1-Hour chart. This is proof that Wave 3 has begun.
7. **Entry at 50-61.8% Micro Fibonacci** — After Sub-Wave 1 completes, wait for the pullback to 50-61.8% of that sub-wave. Enter when:
   - Volume confirms (above average)
   - Bill Williams fractal signal appears at entry zone
   - This is triple confluence: Fib level + volume + fractal = sniper entry

### Checklist Items:
| ID | Item | What It Means |
|----|------|---------------|
| TF-6 | Sub-Wave 1 detected on 1H timeframe | Wave 3 is launching — first impulsive sub-wave visible |
| TF-7 | Entry at 50-61.8% micro Fib with volume + fractal signal | Triple confluence entry — Fibonacci + volume + fractal |

### Scoring (0-100 confidence):
- +30 pts: Sub-Wave 1 detected on 1H (impulsive structure)
- +20 pts: Micro Fibonacci entry level calculated
- +25 pts: Volume confirmed (above 1.1x volumeSMA, no exhaustion)
- +25 pts: Fractal signal near entry zone (within 30% tolerance)

### Status:
- **Confirmed** (>= 70): Sub-wave detected with entry-level confluence
- **Forming** (>= 35): Sub-wave forming, waiting for pullback
- **Not Detected** (< 35): No sub-wave structure on 1H

---

## Phase 4: Risk/Reward (Pure Math)

**Timeframe:** N/A (calculation only)
**Question:** *"Does the math work? Is the reward worth the risk?"*

### What to calculate:
8. **Stop Loss** — Below Wave 2 bottom + 10-pip buffer. This is the invalidation point. If price goes here, the wave count is wrong.
9. **Take Profit** — Wave 2 bottom + (Wave 1 range x 1.618). The 161.8% Fibonacci extension of Wave 1, projected from Wave 2 bottom. This is where Wave 3 typically exhausts.
10. **Risk:Reward Ratio** — Must be >= 3:1. If it's less, the trade doesn't meet the criteria.

### Checklist Item:
| ID | Item | What It Means |
|----|------|---------------|
| TF-8 | SL below Wave 2 bottom, TP at 161.8% extension, R:R >= 3:1 | The math confirms asymmetric reward |

### Scoring:
- R:R >= 3:1 → 25 points (full)
- R:R < 3:1 → (R:R / 3) x 25 points (proportional)
- R:R not calculable → 0 points

### Progression Gate:
- Phase 4 requires R:R >= 2 to be marked as the overall phase (even if other phases confirmed)

---

## Overall Scoring

Each phase contributes a maximum of **25 points** to the composite score:

```
Overall Score = Phase1(conf × 0.25) + Phase2(conf × 0.25) + Phase3(conf × 0.25) + Phase4(RR score)
                    Max 25                  Max 25                 Max 25              Max 25
                                                                                    ─────────
                                                                              Total: Max 100
```

### Phase Progression:
| Overall Phase | Requirement |
|--------------|-------------|
| 0 | No setup detected |
| 1 | Phase 1 confirmed |
| 2 | Phase 1 + Phase 2 confirmed |
| 3 | Phase 1 + 2 + 3 confirmed |
| 4 | Phase 1 + 2 + 3 confirmed AND R:R >= 2 |

### Conviction Levels:
| Score | Meaning |
|-------|---------|
| 0-25 | No setup — stay flat |
| 25-50 | Early formation — watch, don't trade |
| 50-70 | Forming — prepare, set alerts |
| 70-85 | High conviction — ready for sniper entry |
| 85-100 | Institutional-grade setup — full position |

---

## How It Flows Through the System

```
OANDA Price Data
      │
      ▼
┌──────────────────────────┐
│  Data Collector          │
│  (data-collector.ts)     │
│                          │
│  Fetches D / H4 / H1    │
│  candles + indicators    │
│  for each subscribed     │
│  pair                    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  True Fractal Detector   │
│  (true-fractal-detector) │
│                          │
│  Cross-timeframe logic:  │
│  D candles → Phase 1     │
│  H4 candles → Phase 2    │
│  H1 candles → Phase 3    │
│  Math → Phase 4          │
│                          │
│  Output: TrueFractalSetup│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  StoryDataPayload        │
│  .trueFractal            │
│                          │
│  Packaged with all other │
│  timeframe data, EW,     │
│  fractals, volume, AMD   │
└──────┬─────────┬─────────┘
       │         │
       ▼         ▼
┌────────────┐  ┌──────────────────┐
│ AI Trio    │  │ Desk Characters  │
│            │  │                  │
│ Gemini:    │  │ Morning Meeting: │
│  Structural│  │  Phase status    │
│  analysis  │  │  per pair        │
│            │  │                  │
│ DeepSeek:  │  │ Story Reactions: │
│  Quant     │  │  8-item checklist│
│  validation│  │  validation      │
│            │  │                  │
│ Claude:    │  │ Trade Review:    │
│  Narrative │  │  Phase-based     │
│  + guidance│  │  desk evaluation │
└────────────┘  └──────────────────┘
```

---

## What the AI Characters Do With It

### Ray (Quant)
Validates the 8-item True Fractal checklist. If overall score < 50 or Phase 1 is 'not_detected', he flags the entry as premature. Only Phase 3+ entries with score 70+ get his approval.

### Sarah (Risk)
Evaluates Phase 4 risk parameters. If R:R < 3:1, she flags it. If stop loss isn't defined (Phase 4 incomplete), she blocks the trade.

### Alex (Macro)
Checks whether Phase 1 macro context (Daily wave structure) supports the thesis. He's the "95% struggle" — often hopeful about weak setups.

### Marcus (PM)
Looks at overall phase progression. Only Phase 3+ pairs deserve capital. He frames the day through "which pairs are advancing through True Fractal phases" and allocates attention accordingly.

---

## What It Replaced

| Before | After |
|--------|-------|
| SMC Reversal Strategy (6 items) | **True Fractal** (8 items, 4 phases) |
| Bill Williams Fractal Strategy (6 items) | *(merged into Phase 2-3)* |
| Two separate strategies, no connection | One unified multi-timeframe system |
| Each strategy evaluated independently | Sequential gating — each phase feeds the next |

The Bill Williams indicators (Alligator, AO, Fractals) are still active — they serve as supporting signals within Phase 2 (Alligator awakening) and Phase 3 (fractal entry signal). Elliott Wave detection, Fibonacci levels, and volume profile are likewise reused, not duplicated.

---

## Files

| File | Role |
|------|------|
| `lib/story/types.ts` | `TrueFractalSetup` + `TrueFractalPhase` type definitions |
| `lib/story/true-fractal-detector.ts` | Core detection logic — cross-timeframe D/H4/H1 |
| `lib/story/data-collector.ts` | Wires detector output into `StoryDataPayload` |
| `lib/data/default-strategies.ts` | `TRUE_FRACTAL_STRATEGY` — 8 checklist items |
| `lib/story/prompts/gemini-structural.ts` | Gemini prompt with True Fractal assessment |
| `lib/story/prompts/deepseek-quant.ts` | DeepSeek prompt with True Fractal validation |
| `lib/story/prompts/claude-narrator.ts` | Claude prompt with True Fractal doctrine |
| `lib/desk/prompts/morning-meeting.ts` | Desk morning meeting — phase status per pair |
| `lib/desk/prompts/story-reaction.ts` | Desk entry/management reactions — 8-item checklist |
| `lib/desk/prompts/trade-review.ts` | Desk pre-entry review — phase-based evaluation |
| `lib/desk/data-collector.ts` | Passes True Fractal data to desk context |
| `lib/desk/types.ts` | `TrueFractalSummary` for desk context |
| `lib/story/pipeline.ts` | Passes `trueFractal` through `StoryReactionContext` |
