# Great Reset — Nuclear Option

**Location:** Settings page → "Great Reset" section (red card)

**What it does:** Wipes ALL trading history and AI memory, starting you from day 1 as if you just installed the system.

---

## What Gets Deleted

### Trading History
- ✅ All trades (manual + story-driven)
- ✅ All positions and position adjustments
- ✅ All journals and screenshots
- ✅ Execution log

### AI Memory
- ✅ Desk state (character memory + trading scars)
- ✅ Desk messages (all chatter)
- ✅ Desk meetings (morning meetings, trade reviews)
- ✅ Trader profile (observed weaknesses, current focus)
- ✅ Process scores (trade process scoring)

### Story Content
- ✅ Story episodes (all episodes and AI context)
- ✅ Story scenarios (hypothetical setups)
- ✅ Story bible (pair-specific context)
- ✅ Story seasons (season metadata)
- ✅ Story agent reports (intelligence reports)

### Analysis & Cache
- ✅ CMS results (pattern analysis)
- ✅ Structural analysis cache (Gemini cache)
- ✅ Wave analysis cache (Elliott Wave)
- ✅ Scenario analyses (correlation scenario analysis)

---

## What Gets Preserved

### System Configuration
- ✅ Trading Gurus (system-level notes)
- ✅ Indicator Calibrations (optimization results)
- ✅ Strategy Templates (True Fractal checklist)
- ✅ Risk Rules (user risk preferences)
- ✅ Story Subscriptions (which pairs to watch)
- ✅ OANDA Connection (broker API keys)
- ✅ Correlation Patterns (system-level patterns)
- ✅ Calendar Events (market events)

---

## After Great Reset

### OANDA Sync
- From the moment you click "Great Reset", OANDA will sync positions from **today onwards**
- Any positions opened in OANDA after the reset will be tracked
- Historical positions from before the reset are wiped from the local database

### AI Memory
- All AI characters (Marcus, Sarah, Ray, Alex) start with blank memory
- No trading scars, no process scores, no trader profile observations
- The AI Trio (Gemini, DeepSeek, Claude) will generate episodes as if you're a new user

### Story System
- No active episodes, scenarios, or story positions
- You'll need to generate the first episode for each subscribed pair
- The story "seasons" restart from Season 1, Episode 1

---

## When to Use It

Use the Great Reset when you want to:
- ✅ Start completely fresh after a long break
- ✅ Wipe your trading history for a clean slate
- ✅ Reset AI memory that has accumulated incorrect patterns or "scars"
- ✅ Test the system as if you're a brand new user
- ✅ Migrate from demo to live (wipe demo history, start live fresh)

**Do NOT use it when you want to:**
- ❌ Just clear AI memory → Use "Reset AI Memory" instead (preserves trading history)
- ❌ Reset only demo account → Use "Reset Demo Account" instead (demo-only)
- ❌ Clear specific episodes or scenarios → Delete them individually in the Story UI

---

## How to Execute

1. Go to **Settings** page
2. Scroll to **"Great Reset"** section (red card with Zap icon)
3. Click **"Great Reset"** button
4. Type `RESET` in the confirmation dialog
5. Click **"🔥 Execute Great Reset"**
6. Wait for confirmation (may take 10-30 seconds)
7. Page will reload automatically

---

## API Route

**Endpoint:** `POST /api/system/great-reset`

**What it does:**
- Deletes from 22 tables in 2 phases (FK children first, then parents)
- Returns breakdown by category (trading_history, ai_memory, story_content, cms_analysis, cache)
- Logs total records deleted

**Response:**
```json
{
  "success": true,
  "message": "Great Reset complete. 1,234 records deleted. System is now fresh — all trading history and AI memory wiped.",
  "totalDeleted": 1234,
  "categories": {
    "trading_history": 345,
    "ai_memory": 289,
    "story_content": 456,
    "cms_analysis": 78,
    "cache": 66
  },
  "kept": [
    "trading_gurus",
    "indicator_calibrations",
    "strategy_templates",
    "risk_rules",
    "story_subscriptions",
    "oanda_connections",
    "correlation_patterns",
    "calendar_events"
  ]
}
```

---

## Differences from Other Reset Options

| Feature | Great Reset | Reset AI Memory | Reset Demo Account |
|---------|------------|----------------|-------------------|
| Trading History | ✅ Deleted | ❌ Preserved | ✅ Deleted (demo only) |
| AI Memory | ✅ Deleted | ✅ Deleted | ❌ Preserved |
| Story Content | ✅ Deleted | ✅ Deleted | ❌ Preserved |
| Trading Gurus | ✅ Preserved | ✅ Preserved | ❌ Deleted (demo only) |
| Indicator Calibrations | ✅ Preserved | ❌ Deleted | ❌ Deleted (demo only) |
| Risk Rules | ✅ Preserved | ✅ Preserved | ❌ Deleted (demo only) |
| Available for | All accounts | All accounts | Demo only |

---

## Files

| File | Purpose |
|------|---------|
| `app/api/system/great-reset/route.ts` | API endpoint — deletes from 22 tables |
| `app/(dashboard)/settings/page.tsx` | Settings UI — Great Reset button + confirmation dialog |

---

## Safety

- ✅ Requires typing "RESET" to confirm (typo-safe)
- ✅ FK constraints respected (deletes children first, then parents)
- ✅ Ignores non-existent tables (won't crash if schema evolves)
- ✅ System configuration preserved (Trading Gurus, optimization results)
- ✅ OANDA connection untouched (no need to re-authenticate)
- ❌ **No undo** — once executed, data is permanently deleted
