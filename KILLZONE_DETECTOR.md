# Killzone Detector — Technical Documentation

## Overview

The Killzone Detector automates the identification of institutional "trap zones" where Fibonacci correction levels and Volume Point of Control (POC) overlap during Elliott Wave 2 or Wave 4 corrections. This is a **pure algorithmic system** — no AI is involved in the detection, only in narrating what was detected.

## The 5-Step SOP (Standard Operating Procedure)

### Step 1: Identify the Wave
**File:** `lib/utils/elliott-wave-h1.ts`
**Function:** `detectH1ElliottWave()`

The system reads the H1 (1-hour) Elliott Wave state to determine if we're currently in:
- **Wave 2**: Deep correction after Wave 1 impulse (targets 61.8-78.6% Fibonacci retracement)
- **Wave 4**: Shallow correction after Wave 3 impulse (targets 38.2-50% Fibonacci retracement)

If the system is NOT in Wave 2 or Wave 4, the Killzone detector returns empty — no Killzone is active.

**Key Data Points:**
- `wave1Start` / `wave1End` — The impulse swing that Wave 2 corrects
- `wave2End` / `wave3Target` — The impulse swing that Wave 4 corrects
- `currentWave` — Must be `2` or `4` for Killzone to activate
- `direction` — Must be `'bullish'` or `'bearish'` (not `'unclear'`)

### Step 2: Lay the Macro Grid (Fibonacci Retracement)
**File:** `lib/utils/killzone-detector.ts`
**Function:** `detectKillzone()` — lines 131-180

The system computes a full Fibonacci retracement grid from the impulse swing endpoints:

**For Bullish Impulse (price went UP, now correcting DOWN):**
```
swingLow = min(impulseStart, impulseEnd)
swingHigh = max(impulseStart, impulseEnd)
range = swingHigh - swingLow

fib23.6 = swingHigh - (range × 0.236)
fib38.2 = swingHigh - (range × 0.382)
fib50.0 = swingHigh - (range × 0.500)
fib61.8 = swingHigh - (range × 0.618)
fib78.6 = swingHigh - (range × 0.786)
```

**For Bearish Impulse (price went DOWN, now correcting UP):**
```
fib23.6 = swingLow + (range × 0.236)
fib38.2 = swingLow + (range × 0.382)
... etc
```

**Target Zone Selection:**
- Wave 2: `fibZone = [fib61.8, fib78.6]` — Deep correction zone
- Wave 4: `fibZone = [fib38.2, fib50.0]` — Shallow correction zone

This grid is computed **once** from the actual H1 wave endpoints — it's not regenerated or guessed.

### Step 3: Build M15 Volume Profile Over the Pullback
**File:** `lib/utils/volume-profile.ts`
**Function:** `buildVolumeProfile()`

The system slices the M15 candles to ONLY the pullback period (not the entire history):

**Pullback Slicing Logic** (`slicePullbackCandles()` — lines 495-523):
1. Scan backward from the latest M15 candle
2. Find the candle whose high/low matches the `impulseEnd` price (the peak of the impulse)
3. Return all candles from that peak to current — this is the correction structure

**Volume Profile Construction:**
1. Find the price range of the pullback candles (global high/low)
2. Divide this range into 30 bins (price levels)
3. For each candle, distribute its volume across the bins it spans (H-L range)
4. Aggregate all volume into the bins
5. The bin with the MOST volume = **Volume Point of Control (POC)**

**What is the POC?**
- The price level where the most trading volume occurred during the pullback
- Represents "fair value" — where institutional orders are parked
- Acts as a magnetic level for price

**Output:**
```typescript
{
  vpoc: 1.08425,              // The POC price
  valueAreaHigh: 1.08450,     // 70% volume upper bound
  valueAreaLow: 1.08400,      // 70% volume lower bound
  hvn: [1.08420, 1.08430],    // High Volume Nodes (>1.5x avg)
  totalVolume: 125000
}
```

### Step 4: Find the Confluence Box (The Killzone)
**File:** `lib/utils/killzone-detector.ts`
**Function:** `detectKillzone()` — lines 199-258

**Confluence Check:**
1. Calculate the Fibonacci zone center: `fibCenter = (fibHigh + fibLow) / 2`
2. Calculate POC distance from Fib center in pips: `distance = |poc - fibCenter| × pipMultiplier`
3. Check if POC is inside the Fib zone: `poc >= fibLow AND poc <= fibHigh`
4. OR check if POC is within 10 pips of the Fib zone

**If No Confluence:** Return early with `detected: false` and a message explaining the POC is too far from the Fib zone.

**If Confluence Exists:** Build the Killzone box:
```
nearestFibBoundary = closest of (fibHigh or fibLow) to the POC
boxCenter = average(poc, nearestFibBoundary)
boxWidth = clamp(fibZoneWidth, 10, 20) pips  // Never narrower than 10, never wider than 20
boxHigh = boxCenter + (boxWidth / 2)
boxLow = boxCenter - (boxWidth / 2)
```

**Example:**
- Wave 2 bullish correction
- Fib zone: 1.08400 - 1.08450 (50 pips wide)
- POC: 1.08420 (inside the zone)
- Nearest Fib boundary: 1.08400 (closer to POC than 1.08450)
- Box center: (1.08420 + 1.08400) / 2 = 1.08410
- Box width: 15 pips (clamped between 10-20)
- **Killzone box: 1.08402 - 1.08417**

### Step 5: Confidence Scoring (0-100%)
**File:** `lib/utils/killzone-detector.ts`
**Function:** `detectKillzone()` — lines 260-290

The system scores confidence based on 6 algorithmic factors:

| Factor | Weight | Logic |
|--------|--------|-------|
| POC inside Fib zone | +30 | POC price is between fibLow and fibHigh |
| POC near Fib zone (< 10 pips) | +15 | POC is within 10 pips of fibLow or fibHigh |
| H1 wave confidence > 70% | +15 | Elliott Wave detector has high confidence |
| Clear POC (>2x avg bin volume) | +15 | POC volume is significantly above average |
| Correction completion > 50% | +10 | Wave 2/4 is at least 50% complete |
| HVN nodes inside box | +15 | High Volume Nodes reinforce the zone |

**Maximum possible:** 100% (all 6 factors present)
**Minimum to detect:** No minimum — if any confluence exists, Killzone is detected

**Example Scoring:**
- POC inside Fib zone: +30 ✓
- H1 wave confidence 85%: +15 ✓
- Clear POC (volume 3x avg): +15 ✓
- Correction 60% complete: +10 ✓
- 2 HVN nodes in box: +15 ✓
- **Total: 85%**

### M1 Entry Detection (Optional Layer)
**File:** `lib/utils/killzone-detector.ts`
**Function:** `detectKillzoneEntry()` — lines 314-388

Once the Killzone box is built, the system monitors M1 (1-minute) candles for the fakeout entry:

**Entry Requirements:**
1. **Price must be inside the Killzone box** — `currentPrice >= boxLow AND currentPrice <= boxHigh`
2. **Volume Climax detected** — M1 candle with volume ≥ 2x recent average AND rejection wick (long wick relative to body)
3. **CHoCH (Change of Character) detected** — M1 price breaks structural level (bullish CHoCH = break above recent Lower High, bearish CHoCH = break below recent Higher Low)

**Entry Direction:**
- Wave 2 bullish → LONG entry (buy the dip)
- Wave 2 bearish → SHORT entry (sell the rally)
- Wave 4 bullish → LONG entry
- Wave 4 bearish → SHORT entry

**Stop Loss Calculation:**
- Find the rejection wick candle from the volume climax
- For longs: SL = wick low - 2 pips
- For shorts: SL = wick high + 2 pips
- This is the "Spring" (bullish) or "Upthrust" (bearish) in Wyckoff terminology

**Confidence Scoring (0-100%):**
- Volume climax detected: +40
- CHoCH detected: +40
- Both detected: +20 bonus (total 100%)

---

## Data Flow Architecture

### 1. CMS Data Collection Phase
**File:** `lib/cms/data-collector.ts`
**Function:** `collectCMSData()`

When a CMS analysis runs for a pair (e.g., EUR/USD):

```typescript
// Parallel fetch: Daily, Weekly, H1, H4, M15, + cross-market indices
const [dailyRes, weeklyRes, h1Res, h4Res, m15Res, ...indexResults] = await Promise.all([
  getCandles({ instrument, granularity: 'D', count: 500 }),
  getCandles({ instrument, granularity: 'W', count: 200 }),
  getCandles({ instrument, granularity: 'H1', count: 500 }),
  getCandles({ instrument, granularity: 'H4', count: 300 }),
  getCandles({ instrument, granularity: 'M15', count: 200 }),  // NEW
  // ... indices
])

// H1 Elliott Wave detection
if (h1Candles.length >= 50) {
  const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
  const h1Rsi = calculateRSI(h1Closes, 14)
  const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
  h1WaveState = detectH1ElliottWave(h1Candles, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)

  // Killzone detection
  killzone = detectKillzone(h1WaveState, m15Candles, pair)
}

// Add to payload
return {
  // ... existing fields
  killzone,
  h1WaveState,
}
```

### 2. CMS Condition Engine Phase
**File:** `lib/cms/condition-engine.ts`
**Function:** `computeKillzoneConditions()`

The Killzone data is converted into **programmatic conditions** (not AI-generated):

**Condition kz1** — Always created if Killzone detected:
```typescript
{
  id: 'kz1',
  category: 'killzone',
  condition: `Wave 2 correction reaches 61.8-78.6% Fib zone AND M15 Volume POC at 1.08420`,
  outcome: `Institutional trap zone at 1.08417 - 1.08402 (15 pips)`,
  sample_size: 100,
  hits: 85,              // Killzone confidence
  probability: 85,       // Killzone confidence
  avg_move_pips: 0,
  time_to_play_out: 'Active now — monitor M1 for entry',
}
```

**Condition kz2** — Created if price is inside the box:
```typescript
{
  id: 'kz2',
  category: 'killzone',
  condition: `Price entered Killzone box (1.08417 - 1.08402)`,
  outcome: `Wait for M1 volume climax (2x+ avg) + CHoCH + rejection wick for LONG entry`,
  // ... same structure
  time_to_play_out: 'Imminent — M1 sniper window active',
}
```

**Condition kz3** — Created if confidence ≥ 70%:
```typescript
{
  id: 'kz3',
  category: 'killzone',
  condition: `Killzone confluence confidence > 70% (POC inside Fib zone, H1 wave confidence 85%, Clear POC, ...)`,
  outcome: `High probability Wave 3 reversal zone — SL below rejection wick`,
  // ...
  time_to_play_out: 'Active — awaiting trigger',
}
```

These conditions are **EXACT** — all numbers come from algorithmic calculations, not AI inference.

### 3. AI Trio Narration Phase

The AI trio (Gemini → DeepSeek → Claude) receives the **pre-computed** Killzone data and conditions. Their job is to:
- **Rank** the conditions by tradability
- **Validate** the structural logic (is this a real institutional trap or statistical noise?)
- **Synthesize** trading implications (what to do, when to do it, SL/TP levels)

**They DO NOT:**
- Calculate any statistics
- Detect the Killzone (already done algorithmically)
- Modify probabilities or sample sizes
- Invent new conditions

---

## Anti-Hallucination Measures

### Current State (Before Enhancement)

**Claude Synthesis Prompt** (`lib/cms/prompts/claude-synthesis.ts`):
```typescript
${data.killzone?.detected ? `## ACTIVE KILLZONE DATA (algorithmically detected — DO NOT fabricate)
- Wave type: ${data.killzone.waveType}
- Direction: ${data.killzone.direction}
- Fib zone: ${data.killzone.fibZone?.fibHigh.toFixed(5)} - ${data.killzone.fibZone?.fibLow.toFixed(5)}
- Volume POC: ${data.killzone.pullbackPOC?.poc.toFixed(5)}
- Killzone box: ${data.killzone.box?.high.toFixed(5)} - ${data.killzone.box?.low.toFixed(5)} (${data.killzone.box?.widthPips} pips)
- Confluence confidence: ${data.killzone.confidence}%
- Price in box: ${data.killzone.priceInBox ? 'YES' : 'No'}
- Confluence factors: ${data.killzone.confluenceFactors.join(', ')}
` : ''}
```

**Issues:**
1. Only Claude receives the Killzone data — Gemini and DeepSeek don't see it
2. No explicit warning to NOT fabricate Killzone data when none exists
3. No verification that the AI didn't hallucinate box levels

---

## File Locations

### Core Detector
- `lib/utils/killzone-detector.ts` — Main detector (detectKillzone, detectKillzoneEntry)
- `lib/utils/elliott-wave-h1.ts` — H1 Elliott Wave detection (reused)
- `lib/utils/volume-profile.ts` — Volume Profile builder (reused)
- `lib/utils/m1-detectors.ts` — CHoCH + Volume Climax (reused)

### CMS Integration
- `lib/cms/data-collector.ts` — Fetches M15, runs detection
- `lib/cms/condition-engine.ts` — Converts to programmatic conditions
- `lib/cms/types.ts` — Type definitions
- `lib/cms/pipeline.ts` — Orchestration
- `lib/cms/prompts/gemini-pattern.ts` — Gemini prompt
- `lib/cms/prompts/deepseek-stats.ts` — DeepSeek prompt
- `lib/cms/prompts/claude-synthesis.ts` — Claude prompt

### UI
- `app/(dashboard)/cms/_components/CMSResultsView.tsx` — Killzone tab

---

## Example: EUR/USD Killzone Detection

**Input Data (from OANDA API):**
- H1 candles: 500 bars
- M15 candles: 200 bars (last ~50 hours)
- Current price: 1.08410

**H1 Elliott Wave State:**
```typescript
{
  currentWave: 2,
  direction: 'bullish',
  wave1Start: 1.08200,
  wave1End: 1.08600,  // Peak of Wave 1
  wave2End: null,     // Still forming
  currentPrice: 1.08410,
  confidence: 82,
  confirmations: { wave2Complete: false, ... }
}
```

**Fibonacci Grid Calculation:**
```
impulseStart = 1.08200
impulseEnd = 1.08600
range = 1.08600 - 1.08200 = 0.00400 (400 pips)

fib61.8 = 1.08600 - (0.00400 × 0.618) = 1.08352
fib78.6 = 1.08600 - (0.00400 × 0.786) = 1.08286

fibZone = [1.08352, 1.08286]  // Wave 2 target zone (66 pips wide)
```

**M15 Volume Profile (pullback only):**
```
Pullback candles: Last 80 M15 bars (from Wave 1 peak to current)
Price range of pullback: 1.08600 - 1.08280
Volume distribution across 30 bins:

Bin 1 (1.08280-1.08291): 2,500 volume
Bin 2 (1.08291-1.08302): 3,200 volume
...
Bin 12 (1.08345-1.08356): 8,900 volume  ← POC (highest volume)
...
Bin 30 (1.08589-1.08600): 1,100 volume

vpoc = 1.08350 (center of Bin 12)
```

**Confluence Check:**
```
POC = 1.08350
fibZone = [1.08352, 1.08286]
fibCenter = (1.08352 + 1.08286) / 2 = 1.08319

Distance = |1.08350 - 1.08319| × 10000 = 31 pips

Is POC inside zone? NO (1.08350 > 1.08352)
Is POC within 10 pips? NO (31 pips > 10)

RESULT: No confluence — Killzone NOT detected
```

**Output:**
```typescript
{
  detected: false,
  narrative: "POC at 1.08350 is 31 pips from Fib zone — no confluence."
}
```

**What Gets Sent to AI Trio:** NOTHING — no Killzone section appears in the prompts.

---

## Correctness Guarantees

### Mathematical Certainty
1. **Fibonacci levels** are computed from actual H1 wave endpoints — not estimated
2. **Volume POC** is the bin with maximum volume — objective aggregation
3. **Confluence distance** is Euclidean distance in pips — exact calculation
4. **Box width** is clamped to 10-20 pips — hard-coded constraints

### No AI Involvement in Detection
- The detector is 100% TypeScript — no LLM calls
- All decisions are `if/else` logic based on thresholds
- No "predictions" or "probabilities" generated by AI
- AI only narrates what was already detected

### Fail-Safe Mechanisms
1. **Guard clauses** — Returns empty if Wave not 2/4, direction unclear, or < 20 M15 candles
2. **Null checks** — All optional fields checked before access
3. **Confluence requirement** — Box is NOT created unless POC is inside/near Fib zone
4. **Asset-aware pip calculation** — Uses actual pip multiplier from asset config (10000 for EUR/USD, 100 for JPY, 1 for crypto)

---

## Testing the Killzone Detector

### Manual Test (via CMS Dashboard)

1. Navigate to `/cms` page
2. Select a forex pair (e.g., EUR/USD)
3. Click "Generate Analysis"
4. Wait for CMS to complete (Gemini → DeepSeek → Claude)
5. Check the **Killzone** tab in the results

**Expected Output if Killzone Active:**
- Condition kz1 showing the box boundaries, Fib zone, POC, and confidence
- Condition kz2 if price is inside the box
- Condition kz3 if confidence ≥ 70%

**Expected Output if No Killzone:**
- Empty Killzone tab OR single condition explaining why no Killzone was detected

### Programmatic Test

```typescript
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { detectKillzone } from '@/lib/utils/killzone-detector'
import { getCandles } from '@/lib/oanda/client'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'

async function testKillzoneDetection() {
  const pair = 'EUR/USD'

  // Fetch data
  const h1Res = await getCandles({ instrument: 'EUR_USD', granularity: 'H1', count: 500 })
  const m15Res = await getCandles({ instrument: 'EUR_USD', granularity: 'M15', count: 200 })

  const h1Candles = h1Res.data || []
  const m15Candles = m15Res.data || []

  // Run Elliott Wave detection
  const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
  const h1Rsi = calculateRSI(h1Closes, 14)
  const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
  const h1WaveState = detectH1ElliottWave(h1Candles, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)

  // Run Killzone detection
  const killzone = detectKillzone(h1WaveState, m15Candles, pair)

  console.log('Wave State:', h1WaveState.currentWave, h1WaveState.direction)
  console.log('Killzone Detected:', killzone.detected)
  if (killzone.detected) {
    console.log('Box:', killzone.box)
    console.log('Fib Zone:', killzone.fibZone)
    console.log('POC:', killzone.pullbackPOC?.poc)
    console.log('Confidence:', killzone.confidence)
  } else {
    console.log('Reason:', killzone.narrative)
  }
}
```

---

## Common Questions

### Q: What if there are multiple Killzones on different timeframes?
**A:** The detector only runs on H1 → M15 → M1. Only ONE Killzone is active at a time (the current H1 Wave 2/4 correction). If you want multi-timeframe Killzones, you'd run the detector separately for H4 → H1 → M15.

### Q: What if the POC is exactly on a Fib level?
**A:** Perfect confluence — the Killzone box is centered on that exact price with minimum width (10 pips).

### Q: What if Wave 2 is still forming but not complete?
**A:** The Killzone is still detected and displayed. The `wave2Complete` field from H1WaveState indicates if the correction is finished. The CMS conditions will reflect this in the narrative (e.g., "Wave 2 in progress — Killzone forming").

### Q: What if the M15 data doesn't cover the full pullback?
**A:** The `slicePullbackCandles()` function works backward from current to find the impulse peak. If the peak isn't in the M15 data (pullback too old), it uses the available M15 candles (up to 200 bars = ~50 hours). For very old pullbacks, increase the M15 candle count in `data-collector.ts`.

### Q: Can the Killzone detector produce false positives?
**A:** Yes, like any technical indicator. The confidence score tries to filter false positives:
- Low confidence (< 40%): Weak confluence, likely noise
- Medium confidence (40-70%): Moderate confluence, use caution
- High confidence (> 70%): Strong confluence, high probability zone

The AI trio (especially DeepSeek) validates the structural logic to further filter false positives.

### Q: What happens in ranging markets with no clear Elliott Wave?
**A:** The H1 Elliott Wave detector returns `currentWave: 'unknown'` and the Killzone detector exits early with `detected: false`. No Killzone is displayed.

---

## Future Enhancements

1. **Multi-timeframe Killzones** — Detect on H4 → H1 → M15 AND H1 → M15 → M1 simultaneously
2. **Historical Killzone success rate** — Track how often Killzones produced reversals
3. **Killzone invalidation alerts** — Notify when price breaks the box without reversing
4. **Session-based Killzones** — London killzone, NY killzone (time-based, not wave-based)
5. **Crypto-specific adjustments** — 24/7 trading → no session filters, different Fib ratios
