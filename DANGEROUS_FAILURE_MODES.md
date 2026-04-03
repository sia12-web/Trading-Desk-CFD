# 🚨 Dangerous Failure Modes Analysis

This document catalogs critical edge cases and dangerous failures that could lead to financial loss or system instability.

---

## 🔴 CRITICAL: Financial Risk Failures

### 1. **Double-Entry Bug: Simultaneous Scenario Triggers**
**Location:** `lib/story/scenario-monitor.ts:275-424`

**Issue:**
```typescript
// Two bullish scenarios on same pair, both at 85% proximity
Scenario A: 65% confidence → triggers at 85%
Scenario B: 62% confidence → triggers at 85%
```

**Dangerous Scenario:**
1. Both scenarios reach 85% proximity in same candle
2. Monitor triggers BOTH in single run (line 275-424)
3. Both queue new episode generation (line 350-361)
4. Race condition: two episodes generate concurrently
5. **BOTH create position guidance for same pair**
6. **User gets TWO entry signals for same direction**
7. **If executed manually, double exposure = double risk**

**Why `isGenerationAlreadyRunning()` doesn't help:**
- Check happens BEFORE queueing (line 389)
- But both scenarios queue at nearly same time
- Both pass the check before either starts running

**Fix Needed:**
```typescript
// Need atomic locking at scenario level
const lockKey = `scenario-eval:${userId}:${pair}`
await acquireLock(lockKey)
try {
    // evaluate all scenarios for this pair atomically
    // trigger ONLY highest probability scenario
} finally {
    await releaseLock(lockKey)
}
```

---

### 2. **Wrong Direction Trigger: Bearish Scenario Triggers on Bullish Price Move**
**Location:** `lib/story/scenario-monitor.ts:88-125`

**Issue:**
```typescript
// Bearish scenario setup
trigger_level: 1.08000 (below)
invalidation_level: 1.09000 (above)
trigger_direction: 'below'

// 85% proximity calculation (line 110):
const proximityLevel = scenario.invalidation_level - (range * proximityThreshold)
// = 1.09000 - (1000 pips * 0.85) = 1.08150

if (closePrice <= proximityLevel) → triggers
```

**Dangerous Scenario:**
- Bearish scenario expects price to go DOWN
- But 85% threshold is ABOVE the actual trigger
- **If price is at 1.08150, scenario triggers**
- **But price could reverse UP (hasn't reached real trigger at 1.08000)**
- **User enters SHORT at 1.08150, price reverses to 1.09000 → INVALIDATION = LOSS**

**Why This Is Backwards:**
- 85% proximity for BEARISH should be MORE bearish, not less
- Current logic triggers earlier than intended
- Defeats the purpose of conservative invalidation

**Fix Needed:**
```typescript
// For bearish scenarios, 85% should be CLOSER to trigger, not farther
// Only trigger if price has moved 85% OF THE WAY TO THE TRIGGER
if (scenario.trigger_direction === 'below') {
    const totalRange = scenario.invalidation_level - scenario.trigger_level
    const progress = scenario.invalidation_level - closePrice
    const progressPct = progress / totalRange

    if (progressPct >= proximityThreshold) {
        return 'triggered'
    }
}
```

---

### 3. **Zero/Negative Range Bug: Division by Zero**
**Location:** `lib/story/scenario-monitor.ts:96`

**Issue:**
```typescript
const range = Math.abs(scenario.trigger_level - scenario.invalidation_level)
// If AI generates: trigger=1.10000, invalidation=1.10000
// range = 0
const proximityLevel = scenario.invalidation_level + (range * 0.85)
// = 1.10000 + (0 * 0.85) = 1.10000
// Scenario ALWAYS triggers immediately!
```

**Dangerous Scenario:**
- AI hallucination creates scenario with same trigger/invalidation
- Or AI generates inverted levels (trigger below invalidation for bullish)
- **Scenario triggers on EVERY candle**
- **Generates episodes every 15 minutes**
- **Spam risk, API quota exhaustion, user confusion**

**Fix Needed:**
```typescript
const range = Math.abs(scenario.trigger_level - scenario.invalidation_level)

// GUARD: Reject invalid scenarios
if (range < 0.0001) { // 0.1 pip minimum
    console.error(`[ScenarioMonitor] Invalid scenario ${scenario.id}: zero/negative range`)
    await updateScenarioStatus(scenario.id, 'invalidated', 'System error: invalid level spacing', 'system', client)
    continue
}

// GUARD: Check direction consistency
if (scenario.direction === 'bullish' && scenario.trigger_level <= scenario.invalidation_level) {
    console.error(`[ScenarioMonitor] Invalid bullish scenario: trigger below invalidation`)
    // auto-invalidate
}
```

---

### 4. **Stale Price Data: Using Old Candles**
**Location:** `lib/story/scenario-monitor.ts:143-170`

**Issue:**
```typescript
// Fetches "latest completed candle" (line 160)
const completedCandle = candles
    .filter(c => c.complete)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]

// If monitor runs at 14:59:30, last completed H1 candle is 13:00-14:00
// But current price is already 14:59 (59 minutes old data!)
```

**Dangerous Scenario:**
1. Monitor fetches 14:00 candle close at 1.10000
2. Scenario triggers based on 14:00 price
3. But REAL current price is 1.09500 (already reversed!)
4. **User gets entry signal at 1.10000, but price is 50 pips away**
5. **Entry at market = slippage + immediate drawdown**

**Fix Needed:**
```typescript
// Add freshness check
const candleAge = Date.now() - new Date(completedCandle.time).getTime()
const maxStaleMs = {
    'H1': 60 * 60 * 1000,  // 1 hour
    'H4': 4 * 60 * 60 * 1000,
    'D': 24 * 60 * 60 * 1000,
}[timeframe]

if (candleAge > maxStaleMs * 1.1) { // Allow 10% grace
    console.warn(`[ScenarioMonitor] Candle too old: ${candleAge}ms`)
    // Fall back to spot price with warning
}
```

---

### 5. **Adoption Race Condition: Duplicate OANDA Position Sync**
**Location:** `lib/story/pipeline.ts:130-177`

**Issue:**
```typescript
// Two story generations run simultaneously for same pair
// Both see same live OANDA trade

Pipeline A: sees live trade → creates story position → links OANDA ID
Pipeline B: sees live trade → creates ANOTHER story position → overwrites link
```

**Dangerous Scenario:**
1. User manually opens OANDA trade for EUR/USD
2. Cron triggers story generation at 14:00
3. User also triggers manual generation at 14:00:05
4. **Both pipelines detect unlinked OANDA trade**
5. **Both create story positions**
6. **Now 2 story positions track 1 real trade**
7. When trade closes, only one story position updates
8. **The other stays "active" forever = data corruption**

**Fix Needed:**
```typescript
// Atomic adoption with database constraint
await client.from('story_positions').insert({
    ...positionData,
    oanda_trade_id: live.id
})
.onConflict('oanda_trade_id') // Add unique constraint on OANDA ID
.select()

// If conflict, fetch existing position instead of creating new
```

---

### 6. **Invalidation on Spot Price: Premature Exit Signals**
**Location:** `lib/story/scenario-monitor.ts:298-312`

**Issue:**
```typescript
// Triggers use candle close (good)
// Invalidations use SPOT price (dangerous!)

if (scenario.invalidation_direction === 'below' && spotPrice <= scenario.invalidation_level) {
    evaluation = 'invalidated'
    priceUsed = spotPrice // Not a candle close!
}
```

**Dangerous Scenario:**
1. Bullish scenario: invalidation at 1.08500
2. Price wicks down to 1.08480 (spot)
3. **Scenario immediately invalidates on spot price**
4. **Next episode generates: "Setup failed, exit positions"**
5. **But candle closes at 1.08550 (above invalidation)**
6. **False invalidation = premature exit = missed profits**

**Why This Contradicts The Documentation:**
- Code comment says "Uses candle CLOSE price, not spot" (line 82)
- But invalidation uses spot (line 302-310)
- Inconsistent logic = unpredictable behavior

**Fix Needed:**
```typescript
// Option 1: Use candle close for invalidation too (consistent but slower)
if (!evaluation && closePrice != null) {
    if (scenario.invalidation_direction === 'above' && closePrice >= scenario.invalidation_level) {
        evaluation = 'invalidated'
    }
}

// Option 2: Use spot only if wick is VERY deep (e.g., 2x ATR below)
const wickDepth = Math.abs(spotPrice - closePrice)
const isExtremeWick = wickDepth > data.atr14 * 2

if (!evaluation && spotPrice != null && isExtremeWick) {
    // Only invalidate on extreme wicks
}
```

---

## 🟠 HIGH: System Stability Failures

### 7. **Infinite Episode Generation Loop**
**Location:** `lib/story/scenario-monitor.ts:404-412`

**Issue:**
```typescript
// Scenario triggers → queues new episode
// New episode creates NEW scenarios
// New scenarios trigger again → queue ANOTHER episode
// Repeat forever
```

**Dangerous Scenario:**
1. High volatility: price whipsaws
2. Scenario A triggers at 85% → Episode 1 → creates Scenario B
3. Price reverses 20 pips
4. Scenario B triggers at 85% → Episode 2 → creates Scenario C
5. **Repeat every 15 minutes**
6. **100+ episodes per day = API quota exhaustion**
7. **Database bloat, UI unusable**

**Why `isGenerationAlreadyRunning()` doesn't prevent this:**
- It only checks if generation is CURRENTLY running
- But after Episode 1 completes, check passes
- Scenario B from Episode 1 can trigger immediately

**Fix Needed:**
```typescript
// Add cooldown period per pair
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

const lastEpisode = await getLatestEpisode(userId, pair, client)
if (lastEpisode) {
    const timeSinceLastEpisode = Date.now() - new Date(lastEpisode.created_at).getTime()
    if (timeSinceLastEpisode < COOLDOWN_MS) {
        console.log(`[ScenarioMonitor] Cooldown active for ${pair}: ${timeSinceLastEpisode}ms`)
        result.skippedCooldown++
        continue
    }
}
```

---

### 8. **Sibling Deactivation Deletes Wrong Scenarios**
**Location:** `lib/story/scenario-monitor.ts:314-318`

**Issue:**
```typescript
// Deactivates siblings from SAME episode
const siblingCount = await deactivateSiblingScenarios(scenario.id, scenario.episode_id, client)

// But what if Episode has 3+ scenarios?
// EUR/USD Episode 10: Scenario A (bullish), B (bullish), C (bearish)
// Scenario A triggers → deactivates B AND C
// But C is opposite direction! Should stay active!
```

**Dangerous Scenario:**
1. AI generates 3 scenarios for EUR/USD:
   - A: Bullish breakout (60%)
   - B: Bullish retest (40%)
   - C: Bearish reversal (35%)
2. Price breaks up, Scenario A triggers
3. **System deactivates BOTH B and C**
4. **But C is bearish hedge! Should monitor in case reversal happens**
5. **Price reverses, C would have triggered, but it's deactivated**
6. **Missed hedge signal = unprotected position**

**Fix Needed:**
```typescript
// Only deactivate SAME-DIRECTION siblings
async function deactivateSiblingScenarios(
    triggeredId: string,
    episodeId: string,
    triggeredDirection: string, // NEW: add direction filter
    client: SupabaseClient
) {
    const { data } = await client
        .from('story_scenarios')
        .select('id')
        .eq('episode_id', episodeId)
        .eq('direction', triggeredDirection) // Same direction only
        .neq('id', triggeredId)
        .eq('status', 'active')

    // Deactivate same-direction siblings only
}
```

---

### 9. **Missing Candle Data: Silent Failure**
**Location:** `lib/story/scenario-monitor.ts:285`

**Issue:**
```typescript
if (closePrice == null && spotPrice == null) continue
// Silently skips scenario, no error, no alert
```

**Dangerous Scenario:**
1. OANDA API has outage or rate limit
2. Monitor can't fetch candles
3. **All scenarios silently skipped**
4. **Real trigger levels reached but not detected**
5. **User misses entries, no notification**
6. **System appears healthy (no errors), but broken**

**Fix Needed:**
```typescript
// Track consecutive failures per scenario
const failureCount = await redis.incr(`scenario-failure:${scenario.id}`)

if (closePrice == null && spotPrice == null) {
    if (failureCount > 3) {
        // Alert user: data fetching broken
        await notifyUser(scenario.user_id, {
            title: `⚠️ Scenario Monitoring Issue: ${scenario.pair}`,
            body: `Unable to fetch price data for ${scenario.title}. Scenario monitoring may be delayed.`,
            url: `/story/${scenario.pair.replace('/', '-')}`
        }, client)
    }
    continue
}

// Reset on success
await redis.del(`scenario-failure:${scenario.id}`)
```

---

## 🟡 MEDIUM: Data Integrity Failures

### 10. **Proximity Calculation Shows Wrong Percentage**
**Location:** `app/(dashboard)/story/_components/ScenarioProximity.tsx:140-144`

**Issue:**
```typescript
const distToTrigger = Math.abs(currentPrice - scenario.trigger_level!)
const distToInvalidation = Math.abs(currentPrice - scenario.invalidation_level!)
const totalDist = distToTrigger + distToInvalidation
const triggerProximity = totalDist > 0 ? Math.round((1 - distToTrigger / totalDist) * 100) : 50
```

**Bug:**
This formula is WRONG for scenarios where price is OUTSIDE the trigger-invalidation range.

**Example:**
```
Bullish scenario:
- Invalidation: 1.08000
- Trigger: 1.09000
- Current price: 1.07000 (BELOW invalidation!)

Calculation:
distToTrigger = |1.07000 - 1.09000| = 2000 pips
distToInvalidation = |1.07000 - 1.08000| = 1000 pips
totalDist = 3000 pips
triggerProximity = (1 - 2000/3000) * 100 = 33%

UI shows "33% toward trigger" BUT PRICE IS IN WRONG DIRECTION!
Should show "Price is 1000 pips below invalidation, scenario not viable"
```

**Fix Needed:**
```typescript
// Check if price is between invalidation and trigger
const isBullish = scenario.direction === 'bullish'
const isInRange = isBullish
    ? (currentPrice >= scenario.invalidation_level! && currentPrice <= scenario.trigger_level!)
    : (currentPrice <= scenario.invalidation_level! && currentPrice >= scenario.trigger_level!)

if (!isInRange) {
    // Show warning instead of proximity
    return <div className="text-red-400">Price outside scenario range</div>
}

// Only calculate proximity if price is between levels
const range = Math.abs(scenario.trigger_level! - scenario.invalidation_level!)
const progress = Math.abs(currentPrice - scenario.invalidation_level!)
const triggerProximity = Math.round((progress / range) * 100)
```

---

### 11. **85% Marker Shows Wrong Level in UI**
**Location:** `app/(dashboard)/story/_components/ScenarioProximity.tsx:188-204`

**Issue:**
```typescript
const range = scenario.trigger_level! - scenario.invalidation_level!
const proximity85Level = scenario.invalidation_level! + (range * 0.85)
```

**Bug:**
Doesn't handle NEGATIVE ranges (bearish scenarios where trigger < invalidation)

**Example:**
```
Bearish scenario:
- Invalidation: 1.09000
- Trigger: 1.08000
- Range: 1.08000 - 1.09000 = -1000 pips (NEGATIVE!)

proximity85Level = 1.09000 + (-1000 * 0.85) = 1.08150

But this is CORRECT by accident!
However, the visual will be wrong because toPercent() assumes ascending prices
```

**Fix Needed:**
```typescript
const range = Math.abs(scenario.trigger_level! - scenario.invalidation_level!)
const isBullish = scenario.trigger_level! > scenario.invalidation_level!
const proximity85Level = isBullish
    ? scenario.invalidation_level! + (range * 0.85)
    : scenario.invalidation_level! - (range * 0.85)
```

---

### 12. **Position Entry/Exit Price Mismatch**
**Location:** `lib/story/pipeline.ts:573-618`

**Issue:**
```typescript
if (!guidance.entry_price || !guidance.stop_loss) {
    console.warn('[Story Position] entry action missing entry_price or stop_loss, skipping')
    return
}
```

**No validation that:**
- Entry price is reasonable (not 10x current price)
- Stop loss is on correct side of entry
- Stop loss isn't 500 pips away (excessive risk)
- Take profit makes sense vs stop loss (R:R ratio)

**Dangerous Scenario:**
1. AI hallucinates: entry=1.10000, stop_loss=1.20000 (WRONG SIDE!)
2. **Position created with inverted stop**
3. **User executes, immediately stopped out at 10,000 pips loss**

**Fix Needed:**
```typescript
// Validate price levels
const currentPrice = data.currentPrice
const direction = (action === 'enter_long' || action === 'set_limit_long') ? 'long' : 'short'

// Entry should be near current price (within 2% for market orders)
const entryDeviation = Math.abs((guidance.entry_price - currentPrice) / currentPrice)
if (action.includes('enter') && entryDeviation > 0.02) {
    console.error(`[Story Position] Invalid entry price: ${guidance.entry_price} vs current ${currentPrice}`)
    return
}

// Stop loss must be on correct side
const stopIsCorrectSide = direction === 'long'
    ? guidance.stop_loss < guidance.entry_price
    : guidance.stop_loss > guidance.entry_price

if (!stopIsCorrectSide) {
    console.error(`[Story Position] Stop loss on wrong side!`)
    return
}

// Stop distance should be reasonable (< 5% of entry)
const stopDistance = Math.abs((guidance.stop_loss - guidance.entry_price) / guidance.entry_price)
if (stopDistance > 0.05) {
    console.warn(`[Story Position] Excessive stop distance: ${(stopDistance * 100).toFixed(1)}%`)
}
```

---

## 🔵 LOW: User Experience Failures

### 13. **UI Shows "READY" But Monitor Hasn't Run Yet**
**Location:** `app/(dashboard)/story/_components/ScenarioProximity.tsx:148`

**Issue:**
```typescript
const willAutoTrigger = isHighConfidence && triggerProximity >= 85
// UI live-updates every 60 seconds
// But monitor runs every 15 MINUTES
```

**Confusing Scenario:**
1. UI shows "READY" at 14:02 (85% reached)
2. User waits for trigger
3. Monitor last ran at 14:00, next run at 14:15
4. **User confused: "Why hasn't it triggered yet?"**
5. By 14:15, price may have reversed

**Fix Needed:**
```typescript
// Show last monitor check time
const [lastMonitorRun, setLastMonitorRun] = useState<Date | null>(null)

// Fetch from API
useEffect(() => {
    fetch('/api/story/monitor-status')
        .then(r => r.json())
        .then(data => setLastMonitorRun(new Date(data.lastRun)))
}, [])

// Show countdown
{willAutoTrigger && (
    <span className="text-[9px] text-amber-400">
        Next check in {timeUntilNextMonitor} minutes
    </span>
)}
```

---

## Summary of Risk Levels

| Risk Level | Count | Example |
|------------|-------|---------|
| 🔴 CRITICAL | 6 | Double-entry bug, wrong direction trigger |
| 🟠 HIGH | 4 | Infinite loop, sibling deactivation |
| 🟡 MEDIUM | 3 | Proximity calculation UI bug |
| 🔵 LOW | 1 | UI timing confusion |

**Most Dangerous:**
1. Double-entry bug (real money risk)
2. Wrong direction trigger (85% logic backwards)
3. Zero range division (system DOS)
4. Invalidation on spot price (premature exits)
5. Adoption race condition (data corruption)

---

## Recommended Immediate Actions

1. **Add range validation** to prevent zero/negative scenarios
2. **Fix 85% proximity logic** for bearish scenarios
3. **Add atomic locking** for scenario evaluation per pair
4. **Add price level validation** for position guidance
5. **Add cooldown period** between episodes (prevent loops)
6. **Fix proximity UI calculation** to handle out-of-range prices
7. **Add candle freshness check** to prevent stale data
8. **Make invalidation logic consistent** (candle close vs spot)

Priority order: Financial risk → Data corruption → System stability → UX
