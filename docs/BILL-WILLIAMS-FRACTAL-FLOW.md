# Bill Williams Fractal Strategy — Complete Flow

## Overview

The Bill Williams Fractal Strategy is fully integrated into the TradeDesk system. From setup detection → Desk validation → Trade execution → Position management, every step is automated and validated.

---

## End-to-End Flow

### 1. **Fractal Setup Detection** (Story AI — Daily Cron)

**Location**: `lib/utils/indicators.ts` (fractal detection), `lib/story/fractal-detector.ts` (scoring)

**What Happens**:
- SMMA, Alligator, AO, AC, Fractals calculated on Daily timeframe
- `fractal-detector.ts` scores the setup (0-100) based on:
  - Alligator state (sleeping/awakening/eating)
  - Price position relative to Alligator lines
  - Valid fractals beyond Teeth line
  - AO momentum (positive/negative)
  - AC acceleration (green/red bars)
- Score >70 + Alligator 'eating' = high-quality setup

**Output**: `fractalAnalysis` object with `setupScore`, `setupDirection`, `signals[]`

---

### 2. **Story Episode Generation** (Claude Narrator)

**Location**: `lib/story/pipeline.ts` → `lib/story/prompts/claude-narrator.ts`

**What Happens**:
- Claude receives fractal analysis data in prompt
- If setup score is high, Claude generates a `position_guidance` object:
  ```typescript
  {
    action: 'enter_long' | 'enter_short',
    confidence: 0.85,
    entry_price: 1.08456,  // At the fractal level
    stop_loss: 1.08123,    // Below Alligator Jaw or recent fractal
    take_profit_1: 1.08956,
    take_profit_2: 1.09234,
    take_profit_3: 1.09512,
    suggested_lots: 0.02,
    risk_percent: 1.5,
    reasoning: "Alligator eating bullish, valid fractal above Teeth at 1.08456, AO positive, AC showing green bars..."
  }
  ```
- Position created in `story_positions` table with status `'suggested'`

---

### 3. **Desk Characters Validate** (Gemini Flash — Fire-and-forget)

**Location**: `lib/desk/story-reactions.ts` → `lib/desk/prompts/story-reaction.ts`

**What Happens**:
- Ray receives the **6-item Bill Williams checklist**:
  1. ✓ Alligator Awake (eating/awakening)
  2. ✓ Price Beyond Alligator (above all 3 lines)
  3. ✓ Valid Fractal Signal (beyond Teeth)
  4. ✓ AO Confirmation (positive for longs)
  5. ✓ AC Green/Red Bars (2+ consecutive)
  6. ✓ ATR-Based Stop (conservative placement)
- Ray validates setup score and Alligator state
- Sarah checks risk rules (position sizing, R:R ratio)
- Marcus gives final verdict (approved/caution/blocked)

**Example Ray Reaction**:
> "Setup score 85/100, Alligator eating bullish, all 6 BW criteria met — this is institutional-grade. Entry at the fractal is The Value."

**Example Sarah Reaction**:
> "R:R is 2.3:1, position sized at 1.5% risk — within limits. Green light."

**Example Marcus Verdict**:
> "Approved. High-conviction fractal setup with proper risk management. Execute when ready."

---

### 4. **User Reviews & Clicks "Go to Trade Page"**

**Location**: `app/(dashboard)/story/[pair]/page.tsx` → `PositionGuidanceCard.tsx`

**What Happens**:
- User sees the position guidance card with:
  - Action: Enter Long
  - Entry: 1.08456
  - SL: 1.08123
  - TP1/TP2/TP3: 1.08956 / 1.09234 / 1.09512
  - Volume: 0.02 lots
  - Risk: 1.5% ($150)
  - Desk messages from Ray, Sarah, Marcus
- User clicks **"Go to Trade Page"** button
- Redirects to: `/trade?instrument=EUR_USD&direction=long&entry=1.08456&sl=1.08123&tp=1.08956&lots=0.02&description=Story Season Position...&storyPositionId=abc123`

---

### 5. **Trade Page Pre-fills Form**

**Location**: `app/(dashboard)/trade/_components/TradeOrderForm.tsx`

**What Happens**:
- Form reads URL params and pre-fills:
  - ✅ Instrument: EUR_USD
  - ✅ Direction: Long
  - ✅ Order Type: LIMIT (if entry price provided)
  - ✅ Entry Price: 1.08456
  - ✅ Stop Loss: 1.08123
  - ✅ Take Profit: 1.08956
  - ✅ Lots: 0.02 (converted to units: 2000)
  - ✅ Strategy Description: "Story Season Position: Alligator eating bullish, valid fractal..."
  - ✅ Story Position ID: abc123 (stored internally)

---

### 6. **User Executes Trade**

**Location**: `app/api/trade/execute/route.ts`

**What Happens**:
1. **Risk Validation**: Server-side risk check against active risk rules
2. **Slippage Check**: For market orders, validates slippage < 5 pips and R:R doesn't degrade
3. **OANDA Execution**: Creates market or limit order via OANDA API
4. **Local Trade Record**: Creates record in `trades` table with `oanda_trade_id`
5. **Auto-Link to Story Position**:
   - Finds active story position for this pair
   - Links OANDA trade ID: `updatePosition({ oanda_trade_id, status: 'active', entry_price })`
   - Adds adjustment: `action: 'open'`, reasoning: "ADOPTED: Execution detected via Trade terminal"
6. **Trade Form Activates Position**: Calls `/api/story/positions/[id]/activate` (idempotent, succeeds even if already active)

**Result**: Story position is now **active** with OANDA trade linked.

---

### 7. **Position Management Episodes** (Future Story Generations)

**Location**: `lib/story/pipeline.ts` (when `episodeType === 'position_management'`)

**What Happens**:
- Next daily episode sees the active position
- Claude generates management guidance:
  - `action: 'hold'` — stay in trade, reasoning why
  - `action: 'adjust'` — move SL to breakeven, take partial profits, adjust TP
  - `action: 'close'` — exit position (hit TP, stop hit, setup invalidated)
- Desk characters review and comment on the management decision
- User sees the guidance, can execute manually or wait

**Position Lifecycle**:
```
suggested → active → partial_closed → closed
```

**Season Ending**:
- When position is closed (`action: 'close'`), the season ends
- Trade-cycle-driven seasons: 1 season = 1 complete trade (entry → exit)

---

## File Reference

### Strategy Definition
- `lib/data/default-strategies.ts` — `BILL_WILLIAMS_FRACTAL_STRATEGY` with 6-item checklist

### Indicator Calculation
- `lib/utils/indicators.ts` — `calculateSMMA`, `calculateAlligator`, `calculateAwesomeOscillator`, `calculateAcceleratorOscillator`, `calculateFractals`, `calculateGator`

### Fractal Detection & Scoring
- `lib/story/fractal-detector.ts` — `detectFractalSetup()` scores 0-100 based on BW criteria

### Story AI Prompts
- `lib/story/prompts/gemini-structural.ts` — Receives fractal data, analyzes structure
- `lib/story/prompts/deepseek-quant.ts` — Validates levels against fractals
- `lib/story/prompts/claude-narrator.ts` — Generates position guidance with entry/SL/TP

### Desk Validation
- `lib/desk/story-reactions.ts` — Orchestrates desk reaction
- `lib/desk/prompts/story-reaction.ts` — **6-item BW checklist validation** for Ray

### Trade Execution
- `app/api/trade/execute/route.ts` — Executes on OANDA, auto-links to story position
- `app/api/story/positions/[id]/activate/route.ts` — Idempotent activation endpoint

### UI Components
- `app/(dashboard)/story/_components/PositionGuidanceCard.tsx` — Shows guidance + "Go to Trade Page" button
- `app/(dashboard)/trade/_components/TradeOrderForm.tsx` — Pre-fills form from URL params, executes trade

---

## Key Validations

### Algorithmic (Fractal Detector)
- Alligator state must be 'awakening' or 'eating' (not 'sleeping')
- Price must be beyond ALL 3 Alligator lines
- Fractals must be beyond Teeth line (not inside the mouth)
- AO must be positive (longs) or negative (shorts)
- AC must show 2+ consecutive green (longs) or red (shorts) bars

### Desk Characters (Ray)
- Setup score must be ≥60 (warns if <60)
- Setup score ≥70 during 'eating' phase = institutional-grade
- All 6 BW criteria must be met or Ray flags it

### Risk (Sarah)
- R:R ratio must meet minimum (default 1.5:1)
- Position sizing must comply with risk rules
- Total exposure must not exceed limits

---

## Example Full Flow

```
Day 1: EUR/USD Alligator wakes up, fractal forms at 1.08456 above Teeth
       → Story AI: "Setup score 85/100 → BUY"
       → Claude: "Enter long at 1.08456, SL 1.08123, TP1 1.08956"
       → Ray: "All 6 BW criteria met — institutional-grade setup"
       → Sarah: "R:R 2.3:1, risk 1.5% — approved"
       → Marcus: "Execute when ready"
       → Position created (status: 'suggested')

Day 1 (later): User clicks "Go to Trade Page"
               → Form pre-fills all fields
               → User clicks "Execute Order"
               → OANDA trade created
               → Story position activated (status: 'active')

Day 2: Story episode (position_management)
       → Claude: "Hold — Alligator still eating, price respecting Jaw support"
       → Ray: "AO momentum increasing — The Value is holding"
       → Sarah: "Position within limits, no adjustments needed"

Day 3: Story episode (position_management)
       → Claude: "Adjust — Price hit TP1, move SL to breakeven, close 50%"
       → Ray: "Take profits at logical resistance, lock in gains"
       → Sarah: "Partial close approved — de-risk the position"

Day 5: Story episode (position_management)
       → Claude: "Close — Price reversed, broke below Alligator Teeth"
       → Ray: "Setup invalidated — exit immediately"
       → Marcus: "Close position, season complete"
       → Position closed (status: 'closed')
       → Season ends, new season begins
```

---

## Testing Checklist

When a fractal setup appears:

1. ✅ Story episode shows position guidance with entry/SL/TP
2. ✅ Desk messages validate the 6-item BW checklist
3. ✅ "Go to Trade Page" button appears
4. ✅ Trade form pre-fills all fields correctly
5. ✅ Execute button works, creates OANDA trade
6. ✅ Story position becomes 'active' automatically
7. ✅ Next episode shows position management guidance
8. ✅ Future episodes continue managing until close
9. ✅ When closed, season ends

---

## Commit History

- `f0db090` — Initial Bill Williams Fractal Strategy implementation
- `873a7e0` — Added explicit BW checklist validation to desk
- `6d86838` — Made activate endpoint idempotent for trade flow

---

## Summary

**The system is fully operational**. When a Bill Williams Fractal setup appears:
1. Story AI detects it and scores it (0-100)
2. Claude generates precise entry/SL/TP levels
3. Desk validates against the 6-item checklist
4. User clicks one button → Trade page pre-fills
5. User executes → Position activates automatically
6. Future episodes manage the position until exit
7. Season ends when position closes

**No manual work required** beyond clicking "Go to Trade Page" and "Execute Order".
