# TradeDesk Forex — How Story Works

> Deep technical dive into the Story feature: narrative-based forex analysis using Smart Money Concepts (AMD), tri-model AI, and autonomous scenario monitoring.

---

## Table of Contents

1. [What Is Story?](#1-what-is-story)
2. [The 8-Step Pipeline](#2-the-8-step-pipeline)
3. [Smart Money Concepts (AMD)](#3-smart-money-concepts-amd)
4. [Liquidity Mapping](#4-liquidity-mapping)
5. [Binary Scenario System](#5-binary-scenario-system)
6. [Scenario Monitor Bot](#6-scenario-monitor-bot)
7. [Season System V2](#7-season-system-v2)
8. [Season Archive Memory](#8-season-archive-memory)
9. [Story Bible](#9-story-bible)
10. [Position Tracker](#10-position-tracker)
11. [Intelligence Agents](#11-intelligence-agents)
12. [Trade-Episode Linkage](#12-trade-episode-linkage)
13. [Anti-Hallucination System](#13-anti-hallucination-system)
14. [Prompt Caching](#14-prompt-caching)
15. [Daily Cron Generation](#15-daily-cron-generation)
16. [Background Task System](#16-background-task-system)
17. [UI/UX Flow](#17-uiux-flow)
18. [Database Schema](#18-database-schema)
19. [File Reference](#19-file-reference)

---

## 1. What Is Story?

**Story** transforms forex analysis into a TV show narrative. Instead of dry technical reports, each analysis is an "episode" following the ongoing battle between **Buyers** (bulls) and **Sellers** (bears), with **Smart Money** (institutions) manipulating price to grab liquidity.

### Core Concept

Think of EUR/USD as a TV series:
- **Characters**: Buyers, Sellers, Smart Money
- **Plot**: AMD cycle (Accumulation → Manipulation → Distribution)
- **Conflict**: Who controls the structure? Where are they taking price?
- **Tension**: Binary scenarios with trigger/invalidation levels
- **Resolution**: Scenario Monitor Bot tracks outcomes, auto-generates next episode

### Key Innovations

| Feature | Description |
|---------|-------------|
| **Narrative Format** | Technical analysis told as compelling story |
| **AMD Framework** | Smart Money Concepts (accumulation, manipulation, distribution phases) |
| **Liquidity Mapping** | Equal highs/lows, stop hunts, order blocks |
| **Binary Scenarios** | 2 mutually exclusive paths with trigger/invalidation tracking |
| **Autonomous Monitoring** | Bot checks active scenarios every 15min, auto-resolves, auto-generates |
| **Season System** | AI-driven season endings (not hardcoded), arc-based storytelling |
| **Position Tracker** | AI suggests position guidance each episode → pipeline auto-creates/adjusts positions |
| **Intelligence Agents** | 4 daily agents (optimizer, news, cross-market, CMS) provide deep context |
| **Trade Linkage** | Trades reference story episodes (e.g., "Opened in S1E5") |

---

## 2. The 8-Step Pipeline

**File**: `lib/story/pipeline.ts` → `generateStory(userId, pair, taskId, options?)`

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORY GENERATION PIPELINE                     │
│                    (~4-5 minutes per episode)                    │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Data Collection (10%)
├─ Fetch 5-TF candles from OANDA (M, W, D, H4, H1)
├─ Current price + recent journal trades (planned + closed)
└─ File: lib/story/data-collector.ts → collectStoryData()

STEP 2: News Context (20%)
├─ Fetch headlines + economic calendar (ForexFactory API)
├─ Filter by pair currencies (e.g., EUR/USD → EUR + USD events only)
├─ Gemini summarizes → sentiment, key_drivers, fundamental_narrative, avoidTrading flag
└─ File: lib/story/news-summarizer.ts → summarizeNewsForStory()

STEP 2.5: Intelligence Agents (22%)
├─ Fetch today's 4 agent reports from story_agent_reports table
├─ Reports: Indicator Optimizer, News Intelligence, Cross-Market, CMS
├─ Generated at 4AM UTC daily (cron job)
└─ File: lib/story/agents/data.ts → getAgentReportsForPair()

STEP 2.7: Risk Context (23%)
├─ Fetch active risk rules (risk_rules table)
├─ Fetch OANDA account balance (live API call)
└─ Used in narrator prompt for position sizing guidance

STEP 3: Continuity Context (25%)
├─ Bible (full arc memory per pair)
├─ Last episode (with narrative + scenarios)
├─ Resolved scenarios (last 10)
├─ Season archive (past season summaries)
├─ Scenario Analysis (weekly institutional report)
├─ Active Position (from Story Position Tracker)
└─ All fetched in parallel via Promise.all

STEP 4: Gemini "Pattern Archaeologist" (35-55%)
├─ Model: gemini-3-flash-preview
├─ Timeout: 90s, Max tokens: 8192
├─ Processes ALL raw data across 5 TFs
├─ Outputs: Wyckoff cycle phase, cross-TF Fib clusters, cycle extrema (floor/roof),
│           structural S/R map, optimization suggestions, macro/sentiment
└─ File: lib/story/prompts/gemini-structural.ts → buildStoryStructuralPrompt()

STEP 5: DeepSeek "Quantitative Engine" (55-75%)
├─ Model: deepseek-chat V3.2
├─ Timeout: 90s, Max tokens: 4096
├─ Validates Gemini's zones statistically
├─ Outputs: zone_validation, precise entry/SL/TP, risk model, flagged_levels
├─ flagged_levels = suspicious prices that don't match real swing highs/lows
└─ File: lib/story/prompts/deepseek-quant.ts → buildStoryQuantPrompt()

STEP 6: Claude "Decision Architect" (75-95%)
├─ Model: claude-opus-4-6
├─ Timeout: 90s, Max tokens: 8192
├─ Uses Gemini's structural map + DeepSeek's validated zones
├─ Receives: Bible, last episode, resolved scenarios, agent intelligence,
│            flagged levels (forbidden from using), news, active position
├─ Outputs: Episode JSON with narrative, current_phase, scenarios (2),
│            position_guidance, next_episode_preview, bible_update, is_season_finale
├─ Prompt caching: ~90% cache hit rate (saves ~$0.15 per episode)
└─ File: lib/story/prompts/claude-narrator.ts → buildStoryNarratorPromptCached()

STEP 7: Validation + Storage (95%)
├─ Validate scenario levels (trigger/invalidation direction consistency)
├─ Retry up to 2 times if validation fails
├─ Insert episode → story_episodes table
├─ Insert 2 scenarios → story_scenarios table
├─ Update Bible → story_bibles table (upsert with pruning)
├─ Handle Position Tracker:
│   - If position_guidance.action = 'open' → create new story_positions row
│   - If action = 'adjust'/'close' → update existing position + add adjustment
└─ All DB operations transactional (if one fails, rollback)

STEP 8: Notification (100%)
├─ Send web push notification (if enabled)
├─ Send Telegram message (if configured)
├─ Include: Episode title, current phase, scenario summary, position guidance
└─ File: lib/notifications/notifier.ts → notifyUser()
```

### Pipeline Entry Points

| Trigger | Source | Options |
|---------|--------|---------|
| **Manual** | User clicks "Write Next Episode" button | `generationSource: 'manual'` |
| **Daily Cron** | `/api/cron/story-generation` at 5AM UTC weekdays | `generationSource: 'cron'`, `useServiceRole: true` |
| **Scenario Monitor Bot** | Cron every 15min, auto-generates when scenario resolves | `generationSource: 'bot'`, `useServiceRole: true` |

---

## 3. Smart Money Concepts (AMD)

**AMD** = Accumulation → Manipulation → Distribution

This is the institutional trading cycle:

### Phase 1: Accumulation
**What it looks like**: Ranging, low volatility, inside bars, symmetric price action, decreasing ATR.

**What's happening**: Smart Money is quietly building a position without moving price. They're absorbing liquidity on both sides, waiting for retail to get bored.

**Indicators**:
- ADX < 20 (no trend)
- Bollinger Bands squeeze (bb_width < 20th percentile)
- RSI 40-60 (neutral)
- Price oscillating around a central pivot

**Example**:
> "EUR/USD has been trapped in a 50-pip range between 1.0800-1.0850 for 8 days. The Buyers and Sellers are locked in a stalemate. ADX at 18 confirms: no one is in control. This is Accumulation — Smart Money is loading the boat."

### Phase 2: Manipulation
**What it looks like**: Fake breakout, stop hunt, liquidity grab, equal highs/lows swept.

**What's happening**: Smart Money triggers stops above/below a key level to grab liquidity, then reverses hard. They're trapping breakout traders before the real move.

**Indicators**:
- Price spikes above resistance or below support (equal high/low sweep)
- Immediately reverses (rejection wick)
- High volume on the fake move, then low volume on reversal
- RSI divergence (price makes new high, RSI doesn't)

**Example**:
> "EUR/USD spiked to 1.0865 this morning, sweeping Monday's high and Tuesday's high (equal highs). But it closed at 1.0840 — a 25-pip rejection. Classic Manipulation. Smart Money grabbed stops above 1.0860, now they're ready to dump."

### Phase 3: Distribution
**What it looks like**: Strong directional move, sustained momentum, expanding range, increasing ATR.

**What's happening**: Smart Money executes their real move. They're distributing (selling) into retail's buying pressure (bullish distribution) or accumulating (buying) into retail's selling panic (bearish distribution).

**Indicators**:
- ADX > 25 (strong trend)
- Bollinger Bands expanding (bb_width > 80th percentile)
- MACD histogram expanding
- Price trending away from manipulation zone

**Example**:
> "EUR/USD collapsed from 1.0840 to 1.0780 in 6 hours. The Sellers are in full Distribution mode. They manipulated above 1.0860, grabbed liquidity, and now they're dumping into 1.0750. The structure is broken."

### AMD Detection

**File**: `lib/story/amd-detector.ts` → `detectAMDPhase(candles, indicators)`

```typescript
export function detectAMDPhase(candles, indicators): 'accumulation' | 'manipulation' | 'distribution' {
    const { adx, bb_width, atr_percentile, rsi } = indicators
    const last10 = candles.slice(-10)
    const highLowRange = Math.max(...last10.map(c => c.high)) - Math.min(...last10.map(c => c.low))

    // Accumulation: tight range, low ADX, RSI neutral
    if (adx < 20 && bb_width < 0.015 && rsi > 40 && rsi < 60) {
        return 'accumulation'
    }

    // Distribution: strong trend, expanding range, high ADX
    if (adx > 25 && (bb_width > 0.025 || atr_percentile > 70)) {
        return 'distribution'
    }

    // Manipulation: spikes + reversals, hidden divergences
    const hasLiquidityGrab = detectLiquidityGrab(last10)
    if (hasLiquidityGrab) {
        return 'manipulation'
    }

    // Default to distribution if trending
    return adx > 20 ? 'distribution' : 'accumulation'
}
```

Each timeframe gets its own AMD phase. Claude sees:
```
AMD Phases:
- Monthly: distribution (bearish)
- Weekly: manipulation (swept equal lows, now reversing)
- Daily: accumulation (ranging 8 days)
- H4: distribution (bearish momentum)
- H1: distribution (follow-through)
```

---

## 4. Liquidity Mapping

**Liquidity** = where stops cluster = where Smart Money hunts.

**File**: `lib/story/liquidity-mapper.ts` → `mapLiquidityZones(candles, timeframe)`

### What Gets Mapped

| Pattern | Description | Why It Matters |
|---------|-------------|----------------|
| **Equal Highs** | 2+ candles with highs within 5 pips | Stops cluster above → prime target for sweep |
| **Equal Lows** | 2+ candles with lows within 5 pips | Stops cluster below → prime target for sweep |
| **Order Blocks** | Large-bodied candle followed by reversal | Institution entered here, will defend this zone |
| **Liquidity Voids** | Price gaps with no overlapping wicks | Price will likely revisit to fill inefficiency |

### Detection Logic

```typescript
function findEqualHighs(candles: OandaCandle[]): PriceLevel[] {
    const zones: PriceLevel[] = []
    const tolerance = 0.0005 // 5 pips for most pairs

    for (let i = 0; i < candles.length - 1; i++) {
        const c1 = candles[i]
        const matches = [c1]

        // Find all candles within tolerance
        for (let j = i + 1; j < candles.length; j++) {
            const c2 = candles[j]
            if (Math.abs(c1.high - c2.high) <= tolerance) {
                matches.push(c2)
            }
        }

        // If 2+ candles share the same high → equal high liquidity pool
        if (matches.length >= 2) {
            zones.push({
                level: matches[0].high,
                type: 'equal_high',
                strength: matches.length, // more touches = stronger zone
                timeframe,
            })
        }
    }

    return zones
}
```

### Example in Episode

> "The Weekly chart shows equal highs at 1.0920 (touched 3 times over the past 4 weeks). There's a massive liquidity pool here — every breakout trader has their stops above this level. Smart Money knows this. If price approaches 1.0920, expect a sweep (fake breakout to 1.0925) followed by a reversal dump."

---

## 5. Binary Scenario System

Every episode presents **exactly 2 mutually exclusive scenarios**. When one triggers, the other auto-invalidates.

### Structured Monitoring Fields

**Table**: `story_scenarios`

```typescript
{
    title: string                   // "Bullish Breakout"
    direction: 'bullish' | 'bearish'
    probability: number             // 60 (percent)
    status: 'active' | 'triggered' | 'invalidated'

    // Structured monitoring (V2)
    trigger_level: number           // 1.0920
    trigger_direction: 'above' | 'below'
    invalidation_level: number      // 1.0820
    invalidation_direction: 'above' | 'below'

    resolved_by: 'user' | 'bot' | null
    resolved_at: timestamp | null
    outcome_notes: string | null
    monitor_active: boolean         // true = bot is watching this scenario
}
```

### Scenario Monitor Logic

**File**: `lib/story/scenario-monitor.ts` → `runScenarioMonitor()`

```typescript
// Every 15 minutes, check all active scenarios
for (const scenario of activeScenarios) {
    const currentPrice = await getCurrentPrice(scenario.pair)

    // Check trigger
    if (scenario.trigger_direction === 'above' && currentPrice >= scenario.trigger_level) {
        await resolveScenario(scenario.id, 'triggered', 'bot')
        await invalidateSiblingScenario(scenario.episode_id, scenario.id)
        await triggerNewEpisodeGeneration(scenario.user_id, scenario.pair)
    }

    // Check invalidation
    if (scenario.invalidation_direction === 'below' && currentPrice <= scenario.invalidation_level) {
        await resolveScenario(scenario.id, 'invalidated', 'bot')
        await triggerNewEpisodeGeneration(scenario.user_id, scenario.pair)
    }
}
```

### Anti-Hallucination for Scenarios

**File**: `lib/story/validators.ts` → `validateScenarioLevels()`

```typescript
// Hard gate: direction consistency + range check
function validateScenarioLevels(scenario, currentPrice) {
    // RULE 1: trigger and invalidation must be on opposite sides of current price
    if (scenario.direction === 'bullish') {
        if (scenario.trigger_level <= currentPrice) {
            throw new Error('Bullish scenario must have trigger ABOVE current price')
        }
        if (scenario.invalidation_level >= currentPrice) {
            throw new Error('Bullish scenario must have invalidation BELOW current price')
        }
    }

    // RULE 2: levels must be within observed swing range ± 5%
    const range = maxSwing - minSwing
    const buffer = range * 0.05
    if (scenario.trigger_level > maxSwing + buffer || scenario.trigger_level < minSwing - buffer) {
        throw new Error('Trigger level outside observed range')
    }

    // RULE 3: trigger and invalidation must be at least 10 pips apart
    if (Math.abs(scenario.trigger_level - scenario.invalidation_level) < 0.0010) {
        throw new Error('Trigger and invalidation too close (must be 10+ pips apart)')
    }

    return true
}
```

If validation fails, the pipeline **retries** (up to 2 times) with validation errors injected into the prompt.

---

## 6. Scenario Monitor Bot

**Cron**: `/api/cron/scenario-monitor` runs every 15 minutes

**Purpose**: Autonomous resolution + auto-generation when scenarios resolve.

### Flow

```
Every 15 minutes:
1. Fetch all active scenarios (status='active', monitor_active=true)
2. For each scenario:
   a. Fetch current OANDA price for the pair
   b. Check: price vs trigger_level + trigger_direction
   c. Check: price vs invalidation_level + invalidation_direction
   d. If triggered:
      - Set scenario status='triggered', resolved_by='bot'
      - Invalidate sibling scenario (same episode, other scenario)
      - Trigger new episode generation (if >6 hours since last bot-triggered)
   e. If invalidated:
      - Set scenario status='invalidated', resolved_by='bot'
      - Trigger new episode generation (if >6 hours since last bot-triggered)
3. Return summary: { checked: 42, triggered: 1, invalidated: 0, generated: 1 }
```

### Anti-Spam Protection

```typescript
// Don't spam episodes — max 1 bot-triggered generation per pair per 6 hours
const lastBotEpisode = await getLastBotTriggeredEpisode(userId, pair)
if (lastBotEpisode && Date.now() - lastBotEpisode.created_at < 6 * 60 * 60 * 1000) {
    console.log(`Anti-spam: Last bot episode for ${pair} was <6h ago, skipping`)
    return
}
```

### Market Hours Check

```typescript
// No-op when forex market is closed
function isForexMarketClosed(): boolean {
    const now = new Date()
    const utcDay = now.getUTCDay()
    const utcHour = now.getUTCHours()

    // Saturday (all day)
    if (utcDay === 6) return true

    // Sunday before 10PM UTC (market opens 10PM Sun)
    if (utcDay === 0 && utcHour < 22) return true

    // Friday after 10PM UTC (market closes 10PM Fri)
    if (utcDay === 5 && utcHour >= 22) return true

    return false
}
```

### Example Scenario Resolution

**Initial State (Episode 42)**:
```
SCENARIO A: Bullish Breakout (60% probability)
- Trigger: Above 1.0920
- Invalidation: Below 1.0820
- Status: active, monitor_active: true

SCENARIO B: Bearish Continuation (40% probability)
- Trigger: Below 1.0820
- Invalidation: Above 1.0920
- Status: active, monitor_active: true
```

**Monitor Bot Checks (15 min later)**:
```
Current Price: 1.0925
- SCENARIO A: 1.0925 >= 1.0920 → TRIGGERED ✓
- SCENARIO B: 1.0925 < 1.0820 → No change
```

**Actions**:
1. Scenario A → `status='triggered', resolved_by='bot', resolved_at=now`
2. Scenario B → `status='invalidated', resolved_by='bot', outcome_notes='Sibling scenario triggered'`
3. Auto-generate Episode 43 with context: "Scenario A from Episode 42 triggered at 1.0925"

**Next Episode (43) receives**:
```
## RESOLVED SCENARIOS (Fed into Narrator)
- S1E42 Scenario A: "Bullish Breakout" → TRIGGERED at 1.0925 (bot-resolved)
- S1E42 Scenario B: "Bearish Continuation" → INVALIDATED (sibling triggered)

Claude uses this to write:
> "The Buyers have spoken. Scenario A from Episode 42 triggered as predicted —
> price broke above 1.0920 and is now testing 1.0950. The bullish breakout
> is confirmed. Scenario B is dead."
```

---

## 7. Season System V2

**Seasons are AI-driven, not hardcoded.** Claude decides when to end a season based on narrative arc.

### Season Finale Triggers

**File**: `lib/story/prompts/claude-narrator.ts`

Claude can set `is_season_finale: true` when:
1. **Narrative arc completes** (major trend resolves, thesis proven/disproven)
2. **Fundamental shift** (central bank pivot, geopolitical event)
3. **Structural reset** (pair returns to accumulation after long distribution)
4. **Safety cap** (50 episodes reached — forced finale)

### Season Metadata

**Table**: `story_seasons`

```typescript
{
    user_id: string
    pair: string
    season_number: number
    start_episode_id: string
    end_episode_id: string | null
    episode_count: number

    // AI-generated summary (written at finale)
    summary: string
    key_events: Array<{ episode_number: number; event: string; significance: string }>
    resolved_threads: Array<{ thread: string; resolution: string }>
    performance_notes: string

    started_at: timestamp
    ended_at: timestamp | null
}
```

### Season Archive Memory

**File**: `lib/story/seasons.ts` → `getSeasonArchive()`

Past season summaries are injected into the narrator prompt for **deep cross-season recall**:

```
## SEASON ARCHIVE (Deep History)
You have completed 2 season(s) of EUR/USD's story. Here is what happened in each:

### Season 1 (24 episodes)
The Buyers attempted a breakout rally from 1.0650 to 1.0980, but the Sellers
rejected them at the Monthly resistance. The season ended when price collapsed
back to 1.0700, invalidating the bullish thesis. Key event: ECB rate hike
failed to sustain EUR strength.

Trader Performance: Profitable (+240 pips across 8 trades). Best trade: SHORT
from 1.0950 in Episode 18 (+85 pips).

### Season 2 (18 episodes)
After the collapse, EUR/USD entered a 3-month Accumulation phase. Smart Money
quietly built long positions between 1.0650-1.0750. The season finale came
when NFP data triggered a violent breakout to 1.0920, confirming the new
bullish cycle.

Trader Performance: Break-even. Caught in whipsaws during Accumulation, but
recovered with the breakout trade in Episode 18.

Use this archive to maintain long-term continuity. Reference past seasons
when relevant — callbacks to previous events make the story richer.
```

---

## 8. Season Archive Memory

Past seasons are summarized and stored in `story_seasons.summary`. This allows Claude to:

1. **Reference past events** across seasons
2. **Maintain long-term narrative continuity**
3. **Learn from past mistakes** (trader performance notes)
4. **Create callbacks** ("This is the same resistance that rejected the Buyers in Season 1 Episode 18")

Example callback in Episode:
> "The Sellers are pushing toward 1.0820. This level holds deep significance — it was the floor of Season 1's Accumulation phase (Episodes 3-9). If it breaks now, we're revisiting a critical structural support from 6 months ago."

---

## 9. Story Bible

**The Bible is the pair's persistent arc memory.** It's updated every episode and carries forward across seasons.

**Table**: `story_bibles` (unique per user+pair)

**File**: `lib/story/bible.ts` → `upsertBible()`

### Structure

```typescript
{
    user_id: string
    pair: string

    // Arc summary (1-2 paragraphs)
    arc_summary: string

    // Key events (capped at 15, pruned oldest first)
    key_events: Array<{
        episode_number: number
        event: string           // "Buyers broke 1.0920 after 3 failed attempts"
        significance: string    // "Confirmed bullish structure, invalidated bear thesis"
    }>

    // Character evolution
    character_evolution: {
        buyers: {
            arc: string                     // "Gaining strength after 2-week consolidation"
            turning_points: string[]        // ["Episode 12: Swept equal highs"]
        }
        sellers: {
            arc: string
            turning_points: string[]
        }
    }

    // Unresolved threads (capped at 10)
    unresolved_threads: Array<{
        thread: string                  // "Will 1.0950 resistance hold?"
        introduced_episode: number
        description: string
    }>

    // Resolved threads (capped at 10)
    resolved_threads: Array<{
        thread: string
        resolution: string
        resolved_episode: number
    }>

    last_updated_episode: number
    updated_at: timestamp
}
```

### Bible Pruning

To prevent Bible from growing unbounded:
- `key_events`: capped at **15**, prune oldest first
- `resolved_threads`: capped at **10**, prune oldest first
- `unresolved_threads`: no cap (these are active plot threads)

### Example Bible

```json
{
    "arc_summary": "EUR/USD emerged from a 3-month Accumulation phase (1.0650-1.0750) and broke into Distribution mode after NFP data. The Buyers have seized control, targeting 1.1000. The Sellers' last stand is at 1.0950 (Monthly resistance from 2023).",

    "key_events": [
        {
            "episode_number": 8,
            "event": "Swept equal lows at 1.0650, reversed hard",
            "significance": "Classic Manipulation — Smart Money grabbed stops, confirmed Accumulation"
        },
        {
            "episode_number": 15,
            "event": "NFP beat expectations, EUR/USD broke 1.0820",
            "significance": "Triggered season-long bullish breakout"
        }
    ],

    "character_evolution": {
        "buyers": {
            "arc": "Transformed from weak participants in Episodes 1-8 to dominant force. Now marching toward 1.1000 with conviction.",
            "turning_points": [
                "Episode 8: Survived stop hunt at 1.0650",
                "Episode 15: NFP breakout validated thesis"
            ]
        },
        "sellers": {
            "arc": "Controlled early season (Episodes 1-7), but lost grip after NFP. Now defending 1.0950 as last stand.",
            "turning_points": [
                "Episode 7: Failed to break below 1.0650",
                "Episode 15: Structure broken, retreating"
            ]
        }
    },

    "unresolved_threads": [
        {
            "thread": "Will 1.0950 Monthly resistance hold?",
            "introduced_episode": 15,
            "description": "This level rejected Buyers 4 times in 2023. If it breaks now, path to 1.1000 is clear."
        },
        {
            "thread": "Can Buyers hold 1.0820 as new support?",
            "introduced_episode": 16,
            "description": "This was the breakout level. If Sellers reclaim it, the bullish thesis is threatened."
        }
    ],

    "resolved_threads": [
        {
            "thread": "Will Accumulation phase end?",
            "resolution": "YES — NFP data broke structure, Distribution phase began",
            "resolved_episode": 15
        }
    ]
}
```

---

## 10. Position Tracker

The AI outputs `position_guidance` each episode. The pipeline **automatically** creates/adjusts/closes positions based on this guidance.

**Tables**: `story_positions`, `story_position_adjustments`

**File**: `lib/data/story-positions.ts`

### Position Guidance Structure

```typescript
{
    action: 'open' | 'hold' | 'adjust' | 'scale' | 'close'
    reasoning: string
    confidence: number  // 0-100

    // If action='open' or action='scale'
    direction?: 'long' | 'short'
    suggested_entry?: number
    stop_loss?: number
    take_profit_1?: number
    take_profit_2?: number
    take_profit_3?: number
    lot_size?: number

    // If action='adjust'
    new_stop_loss?: number
    new_take_profit?: number

    // Scenario alignment
    aligned_with_scenario?: string  // "Scenario A" or "Scenario B"
}
```

### Pipeline Auto-Actions

**File**: `lib/story/pipeline.ts` (Step 7)

```typescript
// After episode is saved, handle position guidance
if (result.position_guidance.action === 'open') {
    await createPosition({
        user_id: userId,
        pair,
        season_number: currentSeasonNumber,
        entry_episode_number: episodeNumber,
        direction: result.position_guidance.direction,
        suggested_entry: result.position_guidance.suggested_entry,
        original_stop_loss: result.position_guidance.stop_loss,
        current_stop_loss: result.position_guidance.stop_loss,
        // ... etc
        status: 'suggested',
        source: 'ai_story'
    })
}

if (result.position_guidance.action === 'adjust' && existingPosition) {
    await updatePosition(existingPosition.id, {
        current_stop_loss: result.position_guidance.new_stop_loss,
        current_take_profit_1: result.position_guidance.new_take_profit
    })
    await addAdjustment({
        position_id: existingPosition.id,
        episode_number: episodeNumber,
        action: 'adjust',
        ai_reasoning: result.position_guidance.reasoning
    })
}
```

### Position Lifecycle

```
EPISODE 14: AI outputs action='open'
→ Creates story_positions row with status='suggested'
→ User activates via UI button
→ status='active'

EPISODE 15: AI outputs action='hold'
→ No changes to position
→ Adds adjustment row: action='hold', reasoning='Structure still strong'

EPISODE 16: AI outputs action='adjust', new_stop_loss=1.0850
→ Updates position: current_stop_loss=1.0850
→ Adds adjustment row: action='adjust', reasoning='Trail stop to breakeven'

EPISODE 17: AI outputs action='close'
→ Updates position: status='closed', exit_episode_number=17
→ Adds adjustment row: action='close', reasoning='Target hit'
```

### Position Journey UI

Shows the full position lifecycle across episodes:

```
Position Journey: SHORT from 1.0920
├─ S2E14: Opened at 1.0920, SL: 1.0950, TP1: 1.0850
├─ S2E15: HOLD — "Structure still bearish, let it run"
├─ S2E16: ADJUST — Trail SL to 1.0900 (breakeven +20 pips)
└─ S2E17: CLOSE — TP1 hit at 1.0850 (+70 pips realized)
```

---

## 11. Intelligence Agents

**4 agents run daily at 4AM UTC** (1 hour before story generation at 5AM).

**Cron**: `/api/cron/story-agents`

**File**: `lib/story/agents/runner.ts` → `runAgentsForPair()`

### Agent 1: Indicator Optimizer (DeepSeek)

**Model**: deepseek-chat V3.2

**Purpose**: Optimal indicator params per pair/TF

**Output**:
```typescript
{
    pair: "EUR/USD",
    optimizations: [
        {
            timeframe: "D",
            indicator: "RSI",
            current_params: { period: 14 },
            recommended_params: { period: 21 },
            expected_improvement: "Better divergence detection in ranging markets",
            confidence: 85,
            reasoning: "EUR/USD ranges 60% of the time on Daily. RSI(21) smooths false signals."
        }
    ],
    market_regime: "ranging",
    regime_implications: "Lower timeframes will whipsaw. Focus on H4/Daily for clarity.",
    summary: "EUR/USD is in a ranging regime. Optimize for mean reversion."
}
```

Stored in `story_agent_reports`, expires after 30 days.

### Agent 2: News Intelligence (Gemini)

**Model**: gemini-3-flash-preview

**Purpose**: Deep macro/fundamental analysis

**Output**:
```typescript
{
    pair: "EUR/USD",
    macro_environment: {
        base_currency_outlook: "EUR: Weakening on ECB dovish signals",
        quote_currency_outlook: "USD: Strengthening on hawkish Fed",
        relative_strength: "USD has upper hand"
    },
    central_bank_analysis: {
        base_currency_bank: "ECB",
        base_rate_path: "Holding rates at 4.0%, dovish pivot likely Q2",
        quote_currency_bank: "Federal Reserve",
        quote_rate_path: "One more hike expected in March, then hold",
        rate_differential_trend: "Widening in favor of USD"
    },
    geopolitical_factors: [
        "Iran-USA tensions escalating",
        "EU energy crisis easing"
    ],
    sentiment_indicators: {
        institutional: "Risk-off, favoring USD safe haven",
        retail: "Mixed, trapped in EUR longs",
        overall: "bearish"
    },
    key_risks: [
        {
            risk: "ECB surprise rate cut",
            probability: "Low (15%)",
            impact_direction: "bearish"
        }
    ],
    upcoming_catalysts: [
        {
            event: "NFP (Non-Farm Payrolls)",
            date: "2026-04-05",
            expected_impact: "High volatility, USD strength if beat"
        }
    ],
    fundamental_narrative: "The rate differential is widening in USD's favor...",
    summary: "Fundamentals support bearish EUR/USD bias."
}
```

### Agent 3: Cross-Market Effects (Gemini)

**Model**: gemini-3-flash-preview

**Purpose**: Stock index impacts on forex

**Output**:
```typescript
{
    pair: "EUR/USD",
    indices_analyzed: [
        {
            instrument: "SPX_USD",
            name: "S&P 500",
            currency_affected: "USD",
            recent_trend: "Up 2.3% this week",
            correlation_signal: "Risk-on favors EUR over USD"
        },
        {
            instrument: "DAX_EUR",
            name: "DAX",
            currency_affected: "EUR",
            recent_trend: "Down 1.2% this week",
            correlation_signal: "Weakness in EU equities = EUR weakness"
        }
    ],
    cross_market_thesis: "S&P 500 rallying while DAX falls = divergence. USD strength from equity flows, EUR weakness from EU equity outflows.",
    risk_appetite: "mixed",
    risk_appetite_reasoning: "US equities bullish, EU equities bearish. Net neutral for EUR/USD.",
    currency_implications: {
        base_currency: "EUR weakening from DAX decline",
        quote_currency: "USD mixed (SPX up but not enough to offset EUR weakness)",
        net_effect: "bearish"
    },
    divergences: [
        "SPX making new highs while DAX stuck at resistance — EU lagging US"
    ],
    summary: "Cross-market divergence supports bearish EUR/USD."
}
```

### Agent 4: CMS Intelligence (Programmatic)

**Model**: None (programmatic computation)

**Purpose**: Conditional market patterns (see CMS section above)

**Output**:
```typescript
{
    pair: "EUR/USD",
    total_conditions: 42,
    top_conditions: [
        {
            condition: "Friday fails to break Thursday's high",
            outcome: "Monday tests Friday's low",
            probability: 73,
            sample_size: 48,
            avg_move_pips: 23.4,
            category: "daily"
        }
        // ... top 15 patterns
    ],
    market_personality: "EUR/USD shows 42 statistically significant patterns (avg 65% probability). Strongest category: daily (14 patterns). Data covers 834 daily candles.",
    data_range: { from: "2023-01-01", to: "2025-03-28" }
}
```

### Agent Dedup

Each agent checks if it already ran today before executing:
```typescript
const completedTypes = await getTodayReportTypes(userId, pair, client)
if (completedTypes.includes('news_intelligence')) {
    console.log('News agent already ran today, skipping')
}
```

---

## 12. Trade-Episode Linkage

**Columns**: `trades.story_episode_id`, `trades.story_season_number`

When you open a trade from a Story episode, it gets tagged with the episode ID. Later episodes can reference this:

**Episode 42 (AI outputs position guidance)**:
```typescript
position_guidance: {
    action: 'open',
    direction: 'long',
    suggested_entry: 1.0850,
    // ...
}
```

**User activates position** → trade is created with `story_episode_id='ep42-uuid'`, `story_season_number=2`

**Episode 45 (AI sees this trade in context)**:
> "Your LONG position from S2E14 at 1.0850 is now +45 pips (current: 1.0895). The structure that prompted this entry remains intact. Position Guidance: HOLD. Trail your stop to 1.0865 (breakeven +15 pips)."

**Journal detail page** shows:
```
Trade Context:
Opened in: Season 2, Episode 14 "The Accumulation Completes"
Closed in: Season 2, Episode 17 "TP1 Hit, Scaling Out"
```

---

## 13. Anti-Hallucination System

**5 layers of protection** prevent AI from fabricating price levels.

### Layer 1: Gemini Grounding Rules

**File**: `lib/story/prompts/gemini-structural.ts`

```
CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY reference levels from actual candle data provided
2. Do NOT invent swing highs/lows
3. Do NOT fabricate Fibonacci retracements
4. If you cannot find a clear level in the data, say "No clear level identified"
```

### Layer 2: DeepSeek Cross-Validation

**File**: `lib/story/prompts/deepseek-quant.ts`

```
Your task is to VALIDATE Gemini's zones against real swing highs/lows.

If Gemini claims "resistance at 1.0920" but the actual swing high is 1.0915,
FLAG IT:

flagged_levels: [
    {
        level: 1.0920,
        source: "gemini_structural",
        reason: "Claimed resistance at 1.0920, but actual swing high is 1.0915 (5 pips off)"
    }
]
```

### Layer 3: Claude Forbidden Levels

**File**: `lib/story/prompts/claude-narrator.ts`

```typescript
const flaggedBlock = flaggedLevels && flaggedLevels.length > 0
    ? `## FLAGGED LEVELS (DO NOT USE)
DeepSeek flagged these levels as suspicious. DO NOT reference them in your scenarios:
${flaggedLevels.map(f => `- ${f.level} (${f.source}): ${f.reason}`).join('\n')}

If you need a level near a flagged one, use the corrected value from DeepSeek's zone_validation output.`
    : ''
```

### Layer 4: validateScenarioLevels() Hard Gate

**File**: `lib/story/validators.ts`

```typescript
// After Claude outputs scenarios, validate:
// 1. Direction consistency (bullish trigger above price, invalidation below)
// 2. Levels within observed range ± 5%
// 3. Trigger/invalidation at least 10 pips apart

if (!validateScenarioLevels(scenario, currentPrice, swingRange)) {
    throw new Error('Scenario validation failed')
}

// Pipeline retries up to 2 times with validation errors in prompt
```

### Layer 5: validateStoryLevels() Soft Check

**File**: `lib/story/validators.ts`

```typescript
// Post-processing: log warnings for suspicious levels
function validateStoryLevels(episode, swingRange) {
    const levels = extractAllLevels(episode.narrative)
    for (const level of levels) {
        if (level < swingRange.min - buffer || level > swingRange.max + buffer) {
            console.warn(`⚠️ Level ${level} outside observed range ${swingRange.min}-${swingRange.max}`)
        }
    }
}
```

---

## 14. Prompt Caching

**Claude supports prompt caching** — cacheable blocks are marked with special headers.

**File**: `lib/ai/clients/claude.ts` → `callClaudeWithCaching()`

### Cache Structure

```typescript
// Split prompt into 2 parts:
// 1. Cacheable prefix (static instructions, doesn't change episode-to-episode)
// 2. Dynamic content (current data, last episode, scenarios)

messages: [
    {
        role: 'user',
        content: [
            {
                type: 'text',
                text: STATIC_INSTRUCTIONS,  // ~8000 tokens
                cache_control: { type: 'ephemeral' }  // ← Cache this
            },
            {
                type: 'text',
                text: DYNAMIC_DATA  // ~4000 tokens (not cached)
            }
        ]
    }
]
```

### Cache Hit Rate

- **First episode**: No cache, full cost (~$0.30)
- **Second episode (within 5 min)**: 90% cache hit, ~$0.03
- **Third episode**: 90% cache hit, ~$0.03

Result: **~10x cheaper** for subsequent episodes in the same session.

---

## 15. Daily Cron Generation

**Cron**: `/api/cron/story-generation` runs at **5AM UTC weekdays**

**Auth**: `Bearer CRON_SECRET` header

### Flow

```
1. Fetch all active pair subscriptions
2. For each subscription:
   a. Check if episode already generated today (dedup)
   b. If not, create background task
   c. Fire-and-forget generateStory(userId, pair, taskId, { generationSource: 'cron', useServiceRole: true })
   d. Stagger by 500ms to avoid OANDA rate limits
3. Return summary: { processed: 42, skipped: 5, errors: 1 }
```

### Service Role Client

When `useServiceRole: true`, the pipeline uses a **service-role Supabase client** that bypasses RLS. This allows the cron job to write episodes for all users.

---

## 16. Background Task System

Long-running operations (story generation ~4-5 min) persist across page navigation.

**Server**: `lib/background-tasks/manager.ts`
**Client**: `lib/background-tasks/client.ts`
**Hook**: `lib/hooks/use-background-task.ts`

### Flow

```
1. User clicks "Write Next Episode"
2. API route creates task:
   POST /api/story/generate
   → createTask(userId, 'story_generation', { pair: 'EUR/USD' })
   → Returns task ID immediately (HTTP 202)

3. Pipeline runs in background:
   → updateProgress(taskId, 35, 'Gemini analyzing structure...')
   → updateProgress(taskId, 75, 'Claude crafting narrative...')
   → completeTask(taskId, { episode_id, scenarios })

4. Client polls every 2s:
   → GET /api/background-tasks/:taskId
   → Receives progress updates
   → Shows progress bar + message

5. User can navigate away and return:
   → Task persists in database
   → Hook reconnects to task via task ID
   → Progress continues from last checkpoint
```

---

## 17. UI/UX Flow

**Page**: `app/(dashboard)/story/[pair]/page.tsx`

### Button States

| State | Button Text | Condition |
|-------|-------------|-----------|
| **First episode** | "Begin the Story" | 0 episodes exist |
| **Subsequent** | "Write Next Episode" | 1+ episodes exist |
| **Generating** | Spinner + "Generating Episode..." | Background task in progress |
| **Auto-generate on subscribe** | (Background, no button) | User subscribes to new pair |

### Episode Display

Episodes are grouped by season with collapsible UI:

```
Season 2 (18 episodes)
├─ Episode 18: "The Breakout Confirmed" (2 days ago)
├─ Episode 17: "TP1 Hit, Scaling Out" (3 days ago)
├─ Episode 16: "Trail Stop to Breakeven" (4 days ago)
└─ [Show More]

Season 1 (24 episodes) [Collapsed]
└─ [Show Episodes]
```

### Episode Detail View

```
┌─────────────────────────────────────────────────────┐
│ Season 2, Episode 18: "The Breakout Confirmed"      │
│ 2 days ago • Accumulation → Distribution            │
├─────────────────────────────────────────────────────┤
│ [Narrative — ReactMarkdown rendered]               │
│                                                      │
│ The Buyers have seized control. The 1.0820 breakout │
│ level is holding as support. We're now in           │
│ Distribution phase, targeting 1.0950...             │
├─────────────────────────────────────────────────────┤
│ ## Scenarios                                         │
│                                                      │
│ SCENARIO A: Bullish Continuation (60%)              │
│ Trigger: Above 1.0920                               │
│ Target: 1.0950                                       │
│ Invalidation: Below 1.0820                          │
│ Status: ACTIVE 🟢 (Bot monitoring)                  │
│                                                      │
│ SCENARIO B: Mean Reversion (40%)                    │
│ Trigger: Below 1.0820                               │
│ Target: 1.0750                                       │
│ Invalidation: Above 1.0920                          │
│ Status: ACTIVE 🟢 (Bot monitoring)                  │
├─────────────────────────────────────────────────────┤
│ ## Position Guidance                                 │
│                                                      │
│ Action: HOLD                                         │
│ Confidence: 60%                                      │
│ Reasoning: Structure remains bullish. Trail stop    │
│ to 1.0830 (breakeven +10 pips). Let the runner      │
│ breathe.                                             │
│                                                      │
│ Aligned with: Scenario A                            │
│                                                      │
│ [Button: Activate Position]                         │
├─────────────────────────────────────────────────────┤
│ ## Next Episode Preview                              │
│                                                      │
│ "The Buyers are marching toward 1.0920. If they     │
│ break it with conviction, the path to 1.0950 is     │
│ clear. But watch for a liquidity sweep — Smart      │
│ Money might fake a breakout to grab stops above     │
│ 1.0920 before dumping..."                           │
└─────────────────────────────────────────────────────┘
```

---

## 18. Database Schema

### `story_episodes`

```sql
CREATE TABLE story_episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,
    season_number INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER NOT NULL,

    title TEXT NOT NULL,
    narrative TEXT NOT NULL,  -- Full markdown narrative (~1-5 KB)
    current_phase TEXT NOT NULL,  -- 'accumulation' | 'manipulation' | 'distribution'
    next_episode_preview TEXT,
    confidence INTEGER,  -- 0-100

    is_season_finale BOOLEAN DEFAULT false,

    -- AI outputs (for debugging)
    raw_ai_output JSONB,
    gemini_output TEXT,
    deepseek_output TEXT,
    agent_reports JSONB,  -- Snapshot of 4 agent reports used

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, pair, season_number, episode_number)
);

CREATE INDEX idx_episodes_user_pair ON story_episodes(user_id, pair, episode_number DESC);
CREATE INDEX idx_episodes_season ON story_episodes(user_id, pair, season_number, episode_number DESC);
```

### `story_scenarios`

```sql
CREATE TABLE story_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id UUID REFERENCES story_episodes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,

    title TEXT NOT NULL,
    direction TEXT NOT NULL,  -- 'bullish' | 'bearish'
    probability INTEGER,  -- 0-100
    description TEXT,

    -- Structured monitoring (V2)
    trigger_level NUMERIC(10, 5),
    trigger_direction TEXT,  -- 'above' | 'below'
    invalidation_level NUMERIC(10, 5),
    invalidation_direction TEXT,  -- 'above' | 'below'

    status TEXT DEFAULT 'active',  -- 'active' | 'triggered' | 'invalidated'
    monitor_active BOOLEAN DEFAULT true,

    resolved_by TEXT,  -- 'user' | 'bot' | null
    resolved_at TIMESTAMPTZ,
    outcome_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scenarios_active ON story_scenarios(status, monitor_active)
    WHERE status = 'active' AND monitor_active = true;
```

### `story_bibles`

```sql
CREATE TABLE story_bibles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,

    arc_summary TEXT NOT NULL,
    key_events JSONB DEFAULT '[]'::jsonb,
    character_evolution JSONB DEFAULT '{}'::jsonb,
    unresolved_threads JSONB DEFAULT '[]'::jsonb,
    resolved_threads JSONB DEFAULT '[]'::jsonb,

    last_updated_episode INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, pair)
);
```

### `story_seasons`

```sql
CREATE TABLE story_seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,
    season_number INTEGER NOT NULL,

    start_episode_id UUID REFERENCES story_episodes(id),
    end_episode_id UUID REFERENCES story_episodes(id),
    episode_count INTEGER DEFAULT 0,

    -- AI-generated summary (at finale)
    summary TEXT,
    key_events JSONB DEFAULT '[]'::jsonb,
    resolved_threads JSONB DEFAULT '[]'::jsonb,
    performance_notes TEXT,

    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    UNIQUE(user_id, pair, season_number)
);
```

### `story_agent_reports`

```sql
CREATE TABLE story_agent_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,
    agent_type TEXT NOT NULL,  -- 'indicator_optimizer' | 'news_intelligence' | 'cross_market' | 'cms_intelligence'
    report_date DATE NOT NULL,

    report JSONB NOT NULL,
    raw_ai_output TEXT,
    model_used TEXT,
    duration_ms INTEGER,

    status TEXT DEFAULT 'completed',  -- 'completed' | 'failed'
    error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, pair, agent_type, report_date)
);

CREATE INDEX idx_agent_reports_today ON story_agent_reports(user_id, pair, report_date, status);
```

### `story_positions`

```sql
CREATE TABLE story_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,
    season_number INTEGER NOT NULL,
    entry_episode_number INTEGER,
    exit_episode_number INTEGER,

    direction TEXT NOT NULL,  -- 'long' | 'short'
    suggested_entry NUMERIC(10, 5) NOT NULL,
    entry_price NUMERIC(10, 5),  -- Actual entry (null until activated)

    original_stop_loss NUMERIC(10, 5),
    current_stop_loss NUMERIC(10, 5),
    original_take_profit_1 NUMERIC(10, 5),
    current_take_profit_1 NUMERIC(10, 5),
    current_take_profit_2 NUMERIC(10, 5),
    current_take_profit_3 NUMERIC(10, 5),

    lot_size NUMERIC(10, 2),

    status TEXT DEFAULT 'suggested',  -- 'suggested' | 'active' | 'closed'
    source TEXT DEFAULT 'ai_story',

    linked_trade_id UUID REFERENCES trades(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_story_positions_active ON story_positions(user_id, pair, status)
    WHERE status = 'active';
```

### `story_position_adjustments`

```sql
CREATE TABLE story_position_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID REFERENCES story_positions(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,

    action TEXT NOT NULL,  -- 'hold' | 'adjust' | 'scale' | 'close'
    ai_reasoning TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `pair_subscriptions`

```sql
CREATE TABLE pair_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    pair TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, pair)
);
```

---

## 19. File Reference

### Pipeline & Data Collection
- `lib/story/pipeline.ts` — Main orchestrator (8-step pipeline)
- `lib/story/data-collector.ts` — OANDA candle fetching + journal trades
- `lib/story/news-summarizer.ts` — ForexFactory API + Gemini summarization
- `lib/story/amd-detector.ts` — AMD phase detection per TF
- `lib/story/liquidity-mapper.ts` — Equal highs/lows, order blocks

### Prompts (Tri-Model)
- `lib/story/prompts/gemini-structural.ts` — Gemini "Pattern Archaeologist"
- `lib/story/prompts/deepseek-quant.ts` — DeepSeek "Quantitative Engine"
- `lib/story/prompts/claude-narrator.ts` — Claude "Decision Architect" (with caching)

### Intelligence Agents
- `lib/story/agents/runner.ts` — Runs all 4 agents in parallel
- `lib/story/agents/indicator-optimizer.ts` — DeepSeek: optimal indicator params
- `lib/story/agents/news-intelligence.ts` — Gemini: macro/fundamental analysis
- `lib/story/agents/cross-market.ts` — Gemini: stock index impacts
- `lib/story/agents/cms-intelligence.ts` — Programmatic: CMS patterns
- `lib/story/agents/data.ts` — CRUD for agent reports
- `lib/story/agents/types.ts` — TypeScript interfaces

### Bible & Seasons
- `lib/story/bible.ts` — Bible CRUD + pruning logic
- `lib/story/seasons.ts` — Season numbering + season archive fetching + finale check

### Position Tracker
- `lib/data/story-positions.ts` — Position CRUD + adjustments

### Validators
- `lib/story/validators.ts` — Scenario level validation + story level soft checks

### Scenario Monitor
- `lib/story/scenario-monitor.ts` — Bot logic (checks scenarios vs OANDA prices)

### API Routes
- `app/api/story/generate/route.ts` — Manual episode generation
- `app/api/story/episodes/route.ts` — List episodes
- `app/api/story/episodes/[id]/route.ts` — Episode detail + edit highlights
- `app/api/story/scenarios/route.ts` — List scenarios
- `app/api/story/scenarios/[id]/route.ts` — Update scenario (manual resolution)
- `app/api/story/subscriptions/route.ts` — Subscribe to pair
- `app/api/story/subscriptions/[pair]/route.ts` — Unsubscribe
- `app/api/story/positions/route.ts` — List positions
- `app/api/story/positions/[id]/route.ts` — Position detail
- `app/api/story/positions/[id]/activate/route.ts` — Activate position
- `app/api/story/positions/[id]/link-trade/route.ts` — Link position to trade
- `app/api/story/bible/route.ts` — Get Bible for pair
- `app/api/story/my-story/route.ts` — Private user notes per pair

### Cron Jobs
- `app/api/cron/story-agents/route.ts` — Daily agents (4AM UTC)
- `app/api/cron/story-generation/route.ts` — Daily episode generation (5AM UTC)
- `app/api/cron/scenario-monitor/route.ts` — Scenario monitoring (every 15min)

### UI Components
- `app/(dashboard)/story/page.tsx` — Pair selection + subscription management
- `app/(dashboard)/story/[pair]/page.tsx` — Episode list + detail view
- `app/(dashboard)/_components/story/` — Reusable components (EpisodeCard, ScenarioCard, PositionGuidanceCard, etc.)

---

## Summary: The Story Loop

```
4AM UTC: Intelligence Agents run (optimizer, news, cross-market, CMS)
         ↓
         Reports saved to story_agent_reports
         ↓
5AM UTC: Daily Cron generates episodes for all subscribed pairs
         ↓
         8-step pipeline executes (~4-5 min per pair)
         ↓
         Episodes saved, scenarios created, positions tracked, Bible updated
         ↓
         User receives notification (web push + Telegram)
         ↓
Every 15min: Scenario Monitor Bot checks active scenarios vs OANDA prices
         ↓
         If triggered/invalidated → auto-resolve → auto-generate next episode
         ↓
User views episode → reads narrative → activates position → scenario unfolds
         ↓
Next episode references: Bible, resolved scenarios, active position, agent reports
         ↓
         Arc continues, character evolution tracked, unresolved threads carry forward
         ↓
Season finale → AI ends season → summary written → Season 2 begins
         ↓
         Season archive memory injects past summaries into new episodes
         ↓
         Deep continuity maintained across seasons
```

---

**Story is a living, breathing narrative system** that combines technical analysis, fundamental intelligence, and storytelling to transform forex trading into an engaging, autonomous experience. It's not just analysis — it's a TV show you trade. 📺✨
