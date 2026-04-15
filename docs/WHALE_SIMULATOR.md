# Whale Simulator — Complete Guide

## What Is This?

The Whale Simulator is an **educational tool** that demonstrates how institutional market makers (whales) operate in financial markets. It uses your AI Trio (Gemini, DeepSeek, Claude) to simulate a whale fund trading EUR/JPY during a 3-hour morning session.

### The Big Idea

**Real ATR (Average True Range) might not be random market "volatility" — it might be the footprint of institutional manipulation.**

The simulator intentionally **does NOT give the AI access to ATR data**. Instead, the AI trio decides when to:
- Accumulate quietly at the floor
- Manipulate price (stop hunts, fake breakouts)
- Distribute into retail FOMO

After the simulation, you can compare the **real ATR** vs the **volatility created by the whale's actions** to see if they align.

---

## How It Works

### 1. Session Structure (3 Hours, 12 Steps)

The simulator divides a trading session (08:30–11:30 AM ET) into **12 steps** of 15 minutes each:

| Phase | Time | Goal | Rules |
|-------|------|------|-------|
| **Accumulation** | 08:30–09:15 | Buy quietly near the floor | Max 5,000 units per step, be invisible |
| **Manipulation** | 09:15–10:00 | Trigger stop hunts | Push price up/down to liquidate retail (costs 2-8 pips) |
| **Distribution** | 10:00–10:30 | Sell into retail greed | Offload position into FOMO buyers |
| **Cleanup** | 10:30–11:30 | Close all remaining | FORCED exit regardless of price |

### 2. The Whale's Tools (What the AI Sees)

Each step, the AI receives:
- **Current price, session high/low**
- **CVD (Cumulative Volume Delta)** — Institutional order flow footprint
- **Donchian Channel (20-period)** — Where retail stop losses cluster
- **Volume POC (Point of Control)** — Price with most trading activity
- **Value Area (70% volume)** — The "fair value" zone
- **The Whale's Book** — Current position, average entry, PnL, manipulation cost
- **Retail Crowd State** — Sentiment (0-100), FOMO intensity, breakout bias, victims

**What the AI does NOT see:** ATR. This is intentional.

### 3. The AI Trio Decision Chain

For each of the 12 steps:

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Gemini (Structural Analysis)                       │
│ ─────────────────────────────────────────────────────────── │
│ Analyzes: CVD, Donchian, Volume POC                        │
│ Identifies: Floor, Ceiling, Retail stop zones              │
│ Output: JSON with structural levels + narrative            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: DeepSeek (Quantitative Analysis)                   │
│ ─────────────────────────────────────────────────────────── │
│ Receives: Gemini's analysis + current book + retail state  │
│ Calculates: Optimal sizing, manipulation cost, PnL impact  │
│ Output: JSON with recommended action + units + cost        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Claude (Final Decision)                            │
│ ─────────────────────────────────────────────────────────── │
│ Receives: Both Gemini + DeepSeek analysis                  │
│ Decides: Final action (accumulate/manipulate/distribute)   │
│ Enforces: Phase rules (e.g., forced cleanup)               │
│ Output: WhaleDecision JSON with reasoning + retail impact  │
└─────────────────────────────────────────────────────────────┘
```

**36 total AI calls** per simulation (3 AIs × 12 steps).

### 4. Whale Actions

| Action | Description | Effect |
|--------|-------------|--------|
| **Accumulate** | Buy units near the floor | Position builds, retail barely notices |
| **Manipulate** | Push price to trigger stops | Costs 2-8 pips, creates volatility spike, retail gets trapped |
| **Distribute** | Sell into strength | Position reduced, retail sentiment drops |
| **Hold** | No action | Retail gets bored, sentiment decays |

### 5. Retail Crowd Simulation

The retail crowd is a **rules-based state machine** (not AI):

- **Sentiment (0-100)**: Fear ← 50 → Greed
- **FOMO Intensity (0-100)**: How desperate to chase price
- **Breakout Bias**: Long / Short / Neutral
- **Stop Hunt Victims**: Running count of liquidations

**How retail reacts:**
- Manipulation UP → Sentiment +20, FOMO +20, Victims +30, Bias = Long
- Manipulation DOWN → Sentiment -20, FOMO +10, Victims +30, Bias = Short
- Natural Donchian break → Sentiment ±10, FOMO +15
- Distribution → Sentiment drains

The retail narrative updates in real-time: *"Price spiking up! Retail piling into longs, FOMO kicking in."*

### 6. The Whale's Book

The whale tracks:
- **Position Size**: Current net position (units long)
- **Average Entry**: Weighted average buy price
- **Unrealized PnL**: (Current price - Avg entry) × pip multiplier
- **Realized PnL**: Cumulative from closed positions
- **Manipulation Cost**: Total pips spent on stop hunts
- **Distribution Progress**: % of accumulated position sold

**PnL Formula:**
```
Total PnL = Realized PnL + Unrealized PnL - Manipulation Cost
```

---

## How to Use It

### Step 1: Navigate
Go to: **`/market-maker`** (or click "Whale Sim" in the sidebar)

### Step 2: Select a Date
- Use the date picker to choose a recent **weekday** (markets closed on weekends)
- Can't pick future dates (no data exists yet)

### Step 3: Run Simulation
Click **"Run Simulation"**. This will:
1. Fetch EUR/JPY M1 candles from OANDA (08:30–11:30 ET in UTC)
2. Pre-compute CVD, Donchian, Volume Profile, ATR on all 180 candles
3. Run 12 AI Trio decision loops (takes 2-4 minutes)
4. Return full session replay

### Step 4: Playback Controls
- **⟲ Reset**: Back to step 0
- **▶ Play**: Auto-advance every 2 seconds
- **⏸ Pause**: Stop auto-play
- **⏭ Step Forward**: Manually advance one step

### Step 5: Watch the Simulation

**Top Section:**
- **Session Timeline**: Color-coded phases (blue = accumulation, amber = manipulation, red = distribution, gray = cleanup)
- **Step Indicator**: Current step marker

**Main Chart (Price Chart):**
- **White line**: EUR/JPY M1 close prices
- **Blue dashed lines**: Donchian Channel (retail stop zones)
- **Orange dashed line**: Volume POC (strongest S/R)
- **Colored dots**: Whale actions
  - 🔵 Blue = Accumulate
  - 🟠 Amber = Manipulate (larger dots)
  - 🔴 Red = Distribute
  - ⚪ Gray = Hold

**Inventory Panel (The Book):**
- Current position size and average entry
- Unrealized PnL (green/red)
- Realized PnL
- Manipulation cost (amber, always negative)
- Distribution progress bar (blue → amber → red)

**Bottom Row:**
- **ATR Comparison**: Gray area = real ATR, Orange area = whale-caused volatility
  - Do they line up? That's the experiment.
- **Retail Gauge**:
  - Sentiment slider (red ← yellow → green)
  - FOMO intensity bar
  - Breakout bias (long/short/neutral)
  - Stop hunt victim count
  - Live retail narrative quote
- **Action Log**: Expandable per-step log
  - Click to see full AI reasoning and retail impact

---

## Technical Architecture

### File Structure

```
lib/market-maker/
├── types.ts              # WhaleBook, WhaleAction, SessionReplay, etc.
├── retail-model.ts       # Rules-based retail crowd simulator
├── prompts.ts            # AI Trio prompt builders
└── engine.ts             # runWhaleSimulation() — core loop

app/api/market-maker/
└── simulate/route.ts     # POST endpoint (auth + rate limit)

app/(dashboard)/market-maker/
├── page.tsx              # Main UI with playback controls
└── _components/
    ├── PriceChart.tsx           # Recharts ComposedChart
    ├── InventoryPanel.tsx       # The Book display
    ├── RetailGauge.tsx          # Sentiment + FOMO + Bias
    ├── ATRComparison.tsx        # Real ATR vs Whale Vol
    ├── SessionTimeline.tsx      # 4-phase progress bar
    └── ActionLog.tsx            # Per-step expandable log
```

### Data Flow

```
User clicks "Run Simulation"
    ↓
POST /api/market-maker/simulate { date }
    ↓
runWhaleSimulation(date)
    ├── buildSessionWindow(date) → from/to UTC timestamps
    ├── fetchHistoricalCandles(EUR_JPY, M1, from, to) → ~180 candles
    ├── Pre-compute indicators:
    │   ├── calculateCVD(candles) → cvd[]
    │   ├── calculateDonchianChannel(highs, lows, 20, 100) → donchian{}
    │   ├── buildVolumeProfile(candles, 30) → volumeProfile{}
    │   └── calculateATR(highs, lows, closes, 14) → realATR[]
    ├── Initialize: book (empty), retail (neutral sentiment)
    ├── Loop 12 steps:
    │   ├── Slice candles for this step (15 candles)
    │   ├── Build MarketSnapshot (current price, CVD, Donchian, POC, phase)
    │   ├── AI Trio chain:
    │   │   ├── callGemini(geminiPrompt) → geminiRaw
    │   │   ├── callDeepSeek(deepseekPrompt + geminiRaw) → deepseekRaw
    │   │   └── callClaude(claudePrompt + both) → claudeRaw
    │   ├── parseAIJson<WhaleDecision>(claudeRaw)
    │   ├── sanitizeDecision() → enforce phase rules
    │   ├── applyDecision() → create WhaleAction
    │   ├── updateBook() → adjust position, PnL
    │   ├── updateRetailState() → react to whale action
    │   └── Record SimulationStep
    ├── calculateWhaleVolatility(actions, candleCount) → whaleVol[]
    └── buildCandleChartData() → chart-ready data points
    ↓
Return SessionReplay JSON to frontend
    ↓
Frontend renders:
    ├── PriceChart (visible candles up to currentStep)
    ├── InventoryPanel (book at currentStep)
    ├── RetailGauge (retail at currentStep)
    ├── ATRComparison (realATR vs whaleVol up to currentStep)
    ├── SessionTimeline (phase progress)
    └── ActionLog (steps 0 to currentStep)
```

### Reused Existing Code

| Function | From | Purpose |
|----------|------|---------|
| `fetchHistoricalCandles()` | `lib/oanda/client.ts` | Fetch M1 OHLCV data |
| `calculateCVD()` | `lib/utils/donchian-cvd.ts` | Cumulative volume delta |
| `calculateDonchianChannel()` | `lib/utils/donchian-cvd.ts` | 20-period high/low |
| `buildVolumeProfile()` | `lib/utils/volume-profile.ts` | POC + value area |
| `calculateATR()` | `lib/utils/indicators.ts` | Average True Range (14-period) |
| `callGemini/DeepSeek/Claude()` | `lib/ai/clients/` | AI Trio interface |
| `parseAIJson()` | `lib/ai/parse-response.ts` | Extract JSON from AI output |
| `checkRateLimit()` | `lib/ai/rate-limiter.ts` | Prevent API abuse |

### Why No Database?

The simulation is **ephemeral**:
- Each run generates fresh data from OANDA
- No user data needs persistence
- Results are displayed immediately and discarded
- Keeps the feature lightweight and fast

If you wanted to save simulations for later review, you'd add a `whale_simulations` table with `session_replay JSONB`.

---

## Educational Insights

### 1. ATR Is Not Random
Compare the **gray area** (real ATR) with the **orange area** (whale-caused volatility). If they align closely, it suggests:
- ATR isn't just "market noise"
- Volatility spikes correlate with institutional manipulation events
- What retail traders call "breakouts" might be engineered stop hunts

### 2. Retail Is Predictable
Watch the retail sentiment gauge:
- **Manipulation UP** → Instant greed, FOMO spikes, longs pile in
- **Manipulation DOWN** → Instant fear, panic selling
- Retail reliably chases price and gets trapped at extremes

### 3. Stop Hunts Are Profitable
The whale's PnL formula:
```
Total PnL = (Distribution Price - Accumulation Price) - Manipulation Cost
```

Even though manipulation costs 2-8 pips per event, the whale still profits because:
1. Accumulates at the floor (lowest prices)
2. Stop hunts create the FOMO that drives distribution prices higher
3. Distributes at the ceiling (highest prices)

### 4. Phases Are Distinct
- **Accumulation**: Quiet, low volatility, retail bored
- **Manipulation**: Volatility spikes, retail activated
- **Distribution**: High volume, retail greedy, whale exits
- **Cleanup**: Forced unwind, regardless of profit

---

## Configuration

### Hardcoded Settings (Can Be Made Configurable Later)

| Setting | Current Value | Notes |
|---------|---------------|-------|
| **Pair** | EUR/JPY | pipMultiplier = 100 (JPY pair) |
| **Session Time** | 08:30–11:30 ET | Assumes EDT (UTC-4) |
| **Granularity** | M1 | 1-minute candles |
| **Steps** | 12 | 15 candles per step |
| **Donchian Period** | 20 | 20-period high/low |
| **Volume Profile Bins** | 30 | Price level resolution |
| **ATR Period** | 14 | Standard ATR lookback |
| **CVD Lookback** | 50 | Cumulative delta window |
| **AI Model (Decision)** | Claude Sonnet 4.5 | Cost-efficient for 12 calls |

### To Make User-Configurable

In a future update, you could add UI controls for:
- **Pair selection** (EUR/USD, GBP/JPY, etc.)
- **Session start/end time** (custom trading hours)
- **Step count** (6 steps = 30 min each, 24 steps = 7.5 min each)
- **AI model selection** (Opus for deeper reasoning, Haiku for speed)
- **Phase duration sliders** (custom accumulation/manipulation timing)

---

## Rate Limits

**36 AI calls per simulation:**
- 12 × Gemini (structural)
- 12 × DeepSeek (quant)
- 12 × Claude (decision)

**Estimate:**
- ~30 seconds per step (3 sequential API calls)
- **Total runtime: 2-4 minutes**

**Rate limit:** The API route checks `checkRateLimit(userId)` before running. If you hit your hourly limit, you'll get a 429 error.

---

## Cost Estimate

Assuming standard API pricing:
- **Gemini**: ~$0.0001 per call × 12 = $0.0012
- **DeepSeek**: ~$0.0002 per call × 12 = $0.0024
- **Claude Sonnet**: ~$0.003 per call × 12 = $0.036

**Total per simulation: ~$0.04**

If you ran 25 simulations per day, that's **$1/day** or **$30/month** in AI costs.

---

## Troubleshooting

### "Insufficient candles" Error
**Cause:** Date is a weekend or market holiday.
**Fix:** Pick a weekday when forex markets were open.

### "Rate limited" Error
**Cause:** Too many AI calls in the last hour.
**Fix:** Wait for the rate limit reset (displayed in the error message).

### Simulation Hangs
**Cause:** One of the AI APIs timed out.
**Fix:** Check your API keys in `.env.local`. The simulation has a 5-minute timeout (`maxDuration = 300`).

### ATR Comparison Shows No Whale Volatility
**Cause:** The AI made no manipulation moves (all accumulate/hold/distribute).
**Fix:** This is valid behavior! Not every session will have stop hunts. Try a different date or higher volatility pair.

### Whale Loses Money
**Cause:** Distribution happened at lower prices than accumulation (bad timing).
**Fix:** This is educational — even whales can misread the market. The AI isn't perfect.

---

## Future Enhancements

### 1. Save Simulations
Add a `whale_simulations` table to store SessionReplay JSON for later review.

### 2. Multi-Pair Support
Extend to USD pairs, crypto, indices. Each has different pip values and session hours.

### 3. Custom Phase Rules
UI controls to override phase durations, manipulation budgets, position size limits.

### 4. Live Mode
Run the simulation on TODAY's session in real-time (step advances every 15 minutes).

### 5. Backtesting
Run simulations across multiple dates, aggregate PnL, analyze which strategies work best.

### 6. Whale vs Whale
Simulate two competing whales with opposite biases (bullish vs bearish).

---

## Summary

The Whale Simulator is a **unique educational tool** that:
1. Demonstrates institutional manipulation patterns
2. Tests the hypothesis that ATR is manipulation footprint
3. Shows how retail sentiment is engineered
4. Uses real market data + AI reasoning (not scripted)
5. Runs fully autonomously (36 AI decisions per session)

**No real money. No real trades. Pure education.**

Use it to understand the game behind the game — how the market makers create the volatility that retail traders think is random.

---

**Built by:** TradeDesk CFD Team
**Date:** April 14, 2026
**AI Models:** Gemini 2.0 Flash Exp, DeepSeek R1, Claude Sonnet 4.5
**Data Source:** OANDA M1 Historical Candles
**Pair:** EUR/JPY (100 pip multiplier)
**Session:** 08:30–11:30 AM ET (3 hours, 180 candles)
**No database, no persistence, fully ephemeral.**
