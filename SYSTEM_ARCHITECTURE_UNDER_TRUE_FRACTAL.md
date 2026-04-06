# System Architecture Under True Fractal Strategy

**How every component relates to the unified True Fractal trading system**

---

## The Architecture Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                            │
│                                                                         │
│  /story     /cms      /correlation-scenarios    /trade    /indicator-  │
│  (True      (Pattern   (Pattern Mining)        (Execute)  optimization)│
│  Fractal    Stats)                                                      │
│  Episodes)                                                              │
└──────┬──────────────┬──────────────┬────────────────┬──────────────┬───┘
       │              │              │                │              │
       │              │              │                │              │
┌──────▼────────────────────────────────────────────────────────────▼─────┐
│                      CORE AI & DETECTION LAYER                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    STORY PIPELINE (Central Brain)              │    │
│  │                                                                │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │  DATA COLLECTOR                                      │    │    │
│  │  │  - Fetches D/H4/H1 candles from OANDA              │    │    │
│  │  │  - Calls TRUE FRACTAL DETECTOR (cross-timeframe)   │    │    │
│  │  │  - Calls CMS patterns, AMD, Liquidity, Volume      │    │    │
│  │  │  - Packages into StoryDataPayload                  │    │    │
│  │  └──────────────────┬───────────────────────────────────┘    │    │
│  │                     │                                         │    │
│  │                     ▼                                         │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │  AI TRIO (True Fractal-Aware)                       │    │    │
│  │  │                                                      │    │    │
│  │  │  1. GEMINI (Structural Archaeologist)              │    │    │
│  │  │     → "Frame ENTIRE analysis through 4 phases"     │    │    │
│  │  │     → Receives: all phase statuses, key levels     │    │    │
│  │  │                                                      │    │    │
│  │  │  2. DEEPSEEK (Quant Validator)                     │    │    │
│  │  │     → "Validate each phase vs raw indicators"      │    │    │
│  │  │     → Flags phases with confidence < 50            │    │    │
│  │  │                                                      │    │    │
│  │  │  3. CLAUDE (Story Narrator)                        │    │    │
│  │  │     → "Phase progression IS the story arc"         │    │    │
│  │  │     → Generates position guidance based on Phase 4 │    │    │
│  │  └──────────────────┬───────────────────────────────────┘    │    │
│  │                     │                                         │    │
│  │                     ▼                                         │    │
│  │  ┌──────────────────────────────────────────────────────┐    │    │
│  │  │  DESK CHARACTERS (True Fractal Evaluators)          │    │    │
│  │  │                                                      │    │    │
│  │  │  - MARCUS: Frames day through phase progression    │    │    │
│  │  │  - RAY: Validates 8-item checklist                 │    │    │
│  │  │  - SARAH: Checks Phase 4 risk parameters           │    │    │
│  │  │  - ALEX: Evaluates Phase 1 macro alignment         │    │    │
│  │  └──────────────────────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ CMS ENGINE      │  │ CORRELATION      │  │ INDICATOR OPTIMIZER  │  │
│  │ (Strategy-      │  │ ANALYZER         │  │ (Partial Support)    │  │
│  │ Agnostic)       │  │ (Independent)    │  │                      │  │
│  │                 │  │                  │  │ Tunes:               │  │
│  │ Computes 50+    │  │ Mines multi-     │  │ - Alligator (Phase2) │  │
│  │ patterns:       │  │ currency         │  │ - RSI (Phase 2)      │  │
│  │ - BW Fractals   │  │ patterns         │  │ - MACD (Phase 2)     │  │
│  │ - Elliott Wave  │  │                  │  │ - ATR (Phase 4)      │  │
│  │ - Volatility    │  │ No strategy      │  │                      │  │
│  │ - Session       │  │ awareness        │  │ Regime-based only    │  │
│  │                 │  │                  │  │ (not phase-based)    │  │
│  │ Feeds INTO      │  │ Could validate   │  │                      │  │
│  │ True Fractal    │  │ cross-market     │  │                      │  │
│  │ as supporting   │  │ confluence       │  │                      │  │
│  │ evidence        │  │ (future)         │  │                      │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
       │
       │
┌──────▼────────────────────────────────────────────────────────────────┐
│                     TRADE EXECUTION LAYER                             │
│                     (Strategy-Agnostic)                               │
│                                                                        │
│  /api/trade/plan   → Saves planned trades (no TF validation)         │
│  /api/trade/execute → Validates risk rules only (no phase check)     │
│                     → Syncs with Story Position if exists             │
│                                                                        │
│  ⚠️ GAP: Can execute trades that violate True Fractal Phase 4        │
│         criteria (e.g., R:R 1:1 when Phase 4 requires ≥3:1)          │
└────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         OANDA BROKER API                               │
│                                                                        │
│  - Price data (OHLCV candles)                                         │
│  - Account info                                                       │
│  - Position management                                                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component-by-Component Breakdown

### 1. **Story Pipeline** — The True Fractal Brain

**Status**: ✅ **FULLY INTEGRATED**

This is where True Fractal lives. Every component here is Phase-aware:

#### Data Flow:
```
OANDA Price Data
       ↓
Data Collector (lib/story/data-collector.ts)
  ├── Fetches D/H4/H1 candles for subscribed pairs
  ├── Calls detectTrueFractal() → cross-timeframe detection
  │   ├── Phase 1: Daily Wave 1 + Wave 2 (50-61.8%)
  │   ├── Phase 2: 4H RSI/MACD divergence + structure shift + Alligator
  │   ├── Phase 3: 1H sub-wave + micro Fib + volume + fractal
  │   └── Phase 4: Math (SL/TP/R:R)
  ├── Also calls: CMS patterns, AMD detector, liquidity zones, volume profile
  └── Packages into StoryDataPayload.trueFractal
       ↓
AI Trio (lib/story/prompts/*.ts)
       ↓
Episode Generation (narrative + position guidance)
       ↓
Desk Characters Review (lib/desk/prompts/*.ts)
       ↓
Story Position Created (if Phase 4 complete)
```

#### What Each AI Does With True Fractal:

**GEMINI** (Structural Archaeologist):
- Prompt: "Frame your entire structural analysis through the True Fractal 4-phase system. For each phase, assess status and what's missing."
- Receives: Complete phase breakdown (status, confidence, details, key levels, R:R)
- Output: Structured analysis anchored to phase progression

**DEEPSEEK** (Quant Validator):
- Prompt: "Validate all 4 True Fractal phases against raw indicator data. Flag any phase with confidence < 50 as unconfirmed."
- Receives: Compressed True Fractal data + raw RSI/MACD/Alligator values
- Output: Quantitative validation ("Phase 2 RSI divergence: CONFIRMED - RSI 35→42 while price 1.0850→1.0840")

**CLAUDE** (Story Narrator):
- Prompt: "The True Fractal phase IS the story arc. Phase 1 = Setup, Phase 2 = Tension, Phase 3 = Climax, Phase 4 = Resolution."
- Receives: Full phase context + narrative
- Output: Episode with position guidance (only if Phase 3+ confirmed)

#### Desk Characters:

**Morning Meeting** (`lib/desk/prompts/morning-meeting.ts`):
- Marcus frames the day through "which pairs are advancing through True Fractal phases"
- Ray, Sarah, Alex review phase status per pair
- Example: "EUR/USD Phase 3 confirmed (score 78/100) — sniper entry ready. GBP/USD Phase 1 forming — macro setup developing."

**Story Reactions** (`lib/desk/prompts/story-reaction.ts`):
- When AI recommends a position entry, Ray validates the 8-item True Fractal checklist:
  1. ✓/✗ Daily Wave 1 complete
  2. ✓/✗ Wave 2 in golden zone (50-61.8%)
  3. ✓/✗ RSI divergence on 4H
  4. ✓/✗ MACD divergence + structure shift
  5. ✓/✗ Alligator awakening
  6. ✓/✗ Sub-Wave 1 on 1H
  7. ✓/✗ Entry at micro Fib + volume + fractal
  8. ✓/✗ SL/TP/R:R ≥ 3:1
- If score < 50 or Phase 1 not confirmed → Ray flags it as "NO EDGE"
- If Phase 3+ with score 70+ → Ray approves

**Trade Review** (`lib/desk/prompts/trade-review.ts`):
- Pre-entry desk review evaluates manual trade proposals against True Fractal phases
- Ray: Validates Phase 2+3 quantitative signals
- Sarah: Assesses Phase 4 risk parameters
- Alex: Checks Phase 1 macro alignment
- Marcus: Overall phase progression conviction

---

### 2. **CMS (Content Management System)** — The Pattern Library

**Status**: ❌ **NO INTEGRATION** (Strategy-Agnostic)

**What It Does:**
- Computes 50+ statistical patterns from historical data:
  - Bill Williams fractals (f1-f4): "3+ narrow-range days → breakout" (62% accuracy)
  - Elliott Wave patterns (ew1-ew8): "Wave 3 after Wave 2 golden zone retracement"
  - Volatility spikes, session patterns, cross-market correlations
- Stores results with accuracy %, sample size, day distribution

**How It Relates to True Fractal:**
- CMS patterns **feed INTO** True Fractal detection as **supporting evidence**
- Example: True Fractal Phase 1 detector uses Elliott Wave analysis (which CMS also computes), but CMS doesn't enforce the 4-phase checklist
- CMS outputs raw probabilities → Story AI interprets them through True Fractal lens

**Why It's Strategy-Agnostic:**
- CMS is a general-purpose pattern library that ANY strategy can reference
- It doesn't know about "Phase 1" or "Phase 4" — it just says "this Elliott Wave pattern has 68% accuracy"

**File:** `lib/cms/condition-engine.ts`

---

### 3. **Indicator Optimizer** — The Parameter Tuner

**Status**: ⚠️ **PARTIAL SUPPORT** (Tunes Some True Fractal Indicators)

**What It Does:**
- DeepSeek-powered optimizer that tunes 10 indicators based on market regime (trending/ranging/volatile):
  - RSI (default: 14) → Used in True Fractal Phase 2 divergence
  - MACD (default: 12/26/9) → Used in Phase 2 divergence
  - Alligator (default: 13/8/5) → Used in Phase 2 "awakening" detection
  - AO (default: 5/34) → Bill Williams momentum oscillator (supporting)
  - ATR (default: 14) → Used in Phase 4 for stop loss buffering
  - Also: Stochastic, Bollinger Bands, ADX, EMA/SMA crosses, SAR

**How It Relates to True Fractal:**
- Optimizes RSI/MACD/Alligator parameters that Phase 2 depends on
- BUT: Optimization is **regime-based** (trending vs ranging), not **phase-based**
- Example: "For EUR/USD trending regime, use RSI 12 instead of 14" — improves Phase 2 divergence detection indirectly

**What It Doesn't Do:**
- ❌ Doesn't optimize "True Fractal phase confidence thresholds" (these are hardcoded in `true-fractal-detector.ts`)
- ❌ Doesn't tune for "how well does this setup catch Wave 3?"
- ❌ Doesn't know about the 4-phase checklist

**File:** `lib/story/agents/indicator-optimizer.ts`

---

### 4. **Correlation Scenario Analysis** — The Pattern Miner

**Status**: ❌ **NO INTEGRATION** (Completely Independent)

**What It Does:**
- Mines multi-currency correlation patterns from historical data
- Example: "When EUR/USD + GBP/USD both strengthen on Day 0, then AUD/USD moves up 70% of the time on Day +1"
- Discovers patterns like:
  - EUR/USD ↑ + GBP/USD ↑ → AUD/USD ↑ (70% accuracy, 42 samples)
  - USD/JPY ↓ + USD/CHF ↓ → EUR/USD ↑ (65% accuracy, 38 samples)

**How It Relates to True Fractal:**
- **Currently**: Zero connection. Correlation analysis operates independently.
- **Could Integrate (Future)**: Validate True Fractal cross-market divergences
  - Example: "EUR/USD Phase 3 bullish setup BUT correlation pattern says EUR weakness expected → abort or wait"
  - Another: "GBP/USD Phase 3 + EUR/USD Phase 3 both confirmed + correlation pattern confirms EUR/GBP co-movement → high conviction"

**Why It's Independent:**
- Correlation engine is pure data mining — it doesn't know about strategies, phases, or checklist items
- It discovers "what follows what" patterns without any trading logic

**Files:** `lib/correlation/pipeline.ts`, `lib/correlation/pattern-detector.ts`

---

### 5. **Trade Execution** — The Broker Interface

**Status**: ⚠️ **PARTIAL INTEGRATION** (Syncs With Story, But No Phase Validation)

**What It Does:**

**Plan Route** (`/api/trade/plan`):
- Saves planned trades to the database
- Validation: Valid instrument, direction, SL > 0, units > 0
- ❌ **No True Fractal validation** — accepts any entry/SL/TP combination

**Execute Route** (`/api/trade/execute`):
- Executes trades via OANDA API
- Validation:
  - Risk rules (max risk per trade, daily loss limit, R:R ratio from settings)
  - Slippage guardrail (blocks if price slipped >5 pips OR R:R degraded below minimum)
- ❌ **No True Fractal checklist** — doesn't verify if the trade matches a Phase 4 setup
- ✅ **Story Position Sync**: If a Story Position exists for that pair, the executed trade gets linked to it

**The Gap:**
- You can manually execute a trade that violates True Fractal Phase 4 criteria:
  - Example: Phase 2 only confirmed (no Phase 3), or R:R 1.5:1 when Phase 4 requires ≥3:1
  - Execution succeeds as long as it meets **general risk rules** (e.g., max 2% risk per trade)
- This is by design — execution is strategy-agnostic to allow manual discretionary trading

**How It Connects to True Fractal:**
- **Story Position Link**: When the Story AI generates a position entry recommendation based on Phase 4 completion, it creates a `story_position` record with target entry, SL, TP
- If you execute a trade for that pair, the execution API syncs it with the Story Position
- This is the **only** connection — indirect, through Story Position metadata

**Files:** `app/api/trade/plan/route.ts`, `app/api/trade/execute/route.ts`

---

## Summary Table

| Component | True Fractal Integration | Uses 8-Item Checklist? | Strategy-Aware? | Purpose |
|-----------|-------------------------|----------------------|----------------|---------|
| **Story Pipeline** | ✅ Full — primary framework | ✅ Yes — validates all 4 phases | ✅ Yes — TF IS the strategy | Narrative-driven trading system |
| **AI Trio** | ✅ Full — explicitly trained | ✅ Yes — prompts reference phases | ✅ Yes — frame analysis through TF | Generate episodes + guidance |
| **Desk Characters** | ✅ Full — evaluate phases | ✅ Yes — 8-item checklist validation | ✅ Yes — review phase progression | Provide trading desk commentary |
| **CMS** | ❌ None — feeds INTO TF | ❌ No — outputs probabilities | ❌ No — strategy-agnostic | Pattern library (supporting) |
| **Indicator Optimizer** | ⚠️ Partial — tunes TF indicators | ❌ No — regime-based only | ❌ No — doesn't know phases | Parameter optimization |
| **Correlation Analysis** | ❌ None — independent | ❌ No — discovers patterns only | ❌ No — strategy-agnostic | Cross-market pattern mining |
| **Trade Execution** | ⚠️ Partial — syncs with Story | ❌ No — only risk rules | ⚠️ Partial — indirect via Story | Broker API interface |

---

## Key Insights

### ✅ What Works Together:
1. **Story + AI Trio + Desk = True Fractal Core**
   - All 7 AI prompts (3 Story + 3 Desk + 1 Data Collector) reference True Fractal explicitly
   - Phase progression drives the entire narrative and position guidance system

2. **CMS → True Fractal → AI Trio**
   - CMS computes raw Elliott Wave and Bill Williams patterns
   - True Fractal detector synthesizes them into 4-phase checklist
   - AI Trio interprets results through True Fractal lens

3. **Indicator Optimizer → RSI/MACD/Alligator → Phase 2**
   - Optimizer tunes the parameters that Phase 2 divergence detection depends on
   - Indirect improvement to True Fractal accuracy

### ⚠️ What's Independent (But Could Integrate):
1. **Correlation Analysis**
   - Could validate cross-market confluence for True Fractal setups
   - Example: "Phase 3 EUR/USD + correlation pattern confirms EUR strength = double confirmation"

2. **Trade Execution**
   - Currently strategy-agnostic (by design)
   - Could add optional "True Fractal compliance check" before execution
   - Would prevent executing trades that violate Phase 4 criteria

### 📊 What's Strategy-Agnostic (By Design):
1. **CMS** — General-purpose pattern library for any strategy
2. **Indicator Optimizer** — Regime-based tuning, not strategy-specific
3. **Correlation** — Pure data mining without trading logic

---

## The One Strategy Rule

**You asked: "how many strategies do we have?"**

**Answer: ONE.**

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    TRUE FRACTAL                            │
│                                                            │
│  Phase 1: Macro Scanner (Daily EW + Fib)                 │
│  Phase 2: Momentum Validator (4H divergence + Alligator)  │
│  Phase 3: Sniper Trigger (1H sub-wave + micro Fib)       │
│  Phase 4: Risk/Reward (SL/TP/R:R math)                   │
│                                                            │
│  Replaced:                                                 │
│  ❌ SMC Reversal Strategy (6 items)                       │
│  ❌ Bill Williams Fractal Strategy (6 items)              │
│                                                            │
│  Bill Williams indicators still active as SUPPORTING      │
│  signals within True Fractal (Alligator in Phase 2,       │
│  Fractals in Phase 3)                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Every system component either:
- **Uses True Fractal** (Story, AI Trio, Desk) ← These are Phase-aware
- **Feeds INTO True Fractal** (CMS, Optimizer) ← These provide supporting data
- **Works Independently** (Correlation, Execution) ← These are strategy-agnostic

**One strategy. Multi-timeframe. Multi-indicator confluence. Sequential phase gating.**

---

## Files Reference

### True Fractal Core:
- `lib/story/types.ts` — Type definitions
- `lib/story/true-fractal-detector.ts` — Detection logic
- `lib/story/data-collector.ts` — Data gathering
- `lib/data/default-strategies.ts` — Strategy template
- `lib/story/pipeline.ts` — Orchestration

### AI Prompts (True Fractal-Aware):
- `lib/story/prompts/gemini-structural.ts`
- `lib/story/prompts/deepseek-quant.ts`
- `lib/story/prompts/claude-narrator.ts`
- `lib/desk/prompts/morning-meeting.ts`
- `lib/desk/prompts/story-reaction.ts`
- `lib/desk/prompts/trade-review.ts`

### Supporting Systems (Strategy-Agnostic):
- `lib/cms/condition-engine.ts`
- `lib/story/agents/indicator-optimizer.ts`
- `lib/correlation/pipeline.ts`
- `lib/correlation/pattern-detector.ts`
- `app/api/trade/plan/route.ts`
- `app/api/trade/execute/route.ts`
