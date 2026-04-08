# TradeDesk CFD — Complete System Documentation

**Last Updated:** April 8, 2026
**Version:** 2.0 (Fast Matrix Era)

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Philosophy](#core-philosophy)
3. [Architecture](#architecture)
4. [Trading Strategy](#trading-strategy)
5. [AI Pipeline](#ai-pipeline)
6. [Data Flow](#data-flow)
7. [Key Features](#key-features)
8. [Database Schema](#database-schema)
9. [Deployment](#deployment)
10. [Cron Jobs](#cron-jobs)
11. [API Reference](#api-reference)
12. [File Organization](#file-organization)

---

## System Overview

TradeDesk CFD is an AI-powered trading assistant that combines:
- **Next.js 16** frontend with server-side rendering
- **Supabase** PostgreSQL database with Row-Level Security
- **Railway** cloud deployment with automated cron jobs
- **3 AI Models** working in sequence (Gemini → DeepSeek → Claude)
- **OANDA** broker integration for forex and crypto trading
- **CoinGecko** data for cryptocurrency market context

### What It Does

1. **Generates Market Narratives** — AI analyzes 7 timeframes (M, W, D, H4, H1, M15, M1) and writes episode-based trading stories
2. **Validates Trade Plans** — A simulated JP Morgan desk (4 AI characters) reviews every trade before execution
3. **Executes Trades** — Direct OANDA API integration with real-time position management
4. **Tracks Performance** — Comprehensive P&L tracking, journaling, and process scoring

---

## Core Philosophy

### The Holy Grail (MUST READ)

**"Trading is about performing and executing the plan every time, regardless of what happened."**

This system is built on a single principle: **Discipline = Edge**

- Create the plan (AI analysis)
- Execute the plan (no discretion)
- Track the plan (process scoring)
- **Never override the plan** post-creation

See `HOLY_GRAIL.md` for full doctrine.

---

## Architecture

### Tech Stack

```
Frontend:     Next.js 16 (App Router, React Server Components, Turbopack)
Backend:      Next.js API Routes (serverless functions)
Database:     Supabase PostgreSQL (Row-Level Security enabled)
Deployment:   Railway (auto-deploy from GitHub master branch)
Broker:       OANDA REST API (demo + live accounts)
Crypto Data:  CoinGecko API (free tier)
AI Models:    Gemini 2.5 Flash, DeepSeek R1, Claude Sonnet 4.5
Cron:         Railway cron triggers (runs API routes on schedule)
```

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│              (Next.js Frontend on Railway)                  │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─► Story Generation (/story)
             │   ├─► Fetch 7 timeframes (M/W/D/H4/H1/M15/M1)
             │   ├─► Gemini: Structural Analysis
             │   ├─► DeepSeek: Quantitative Validation
             │   └─► Claude: Narrative Synthesis
             │
             ├─► Desk Review (/api/desk/review)
             │   ├─► Ray: Statistical edge validation
             │   ├─► Sarah: Risk enforcement ($8.50 rule)
             │   ├─► Alex: Macro directional filter
             │   └─► Marcus: Strategy architect approval
             │
             ├─► Trade Execution (/api/trade/execute)
             │   ├─► OANDA: Market order placement
             │   └─► Database: Trade + P&L logging
             │
             └─► Cron Jobs (Railway triggers every 15min)
                 ├─► Scenario Monitor (checks for Fast Matrix setups)
                 ├─► Pattern Alerts (sends Telegram notifications)
                 └─► Story Agents (generates episodes on schedule)
```

---

## Trading Strategy

### The Fast Matrix (Master Playbook)

**Replaced:** Harmonic Convergence Matrix (HCM) on April 7, 2026

**Concept:** Cross-timeframe H1 → M15 → M1 strategy with 4 independent scenarios

#### Structure

- **H1 (Macro Direction):** Identify trend (HH/HL = buy only, LH/LL = sell only)
- **M15 (Wave Zones):** Find Fib retracement zones and diamond boxes
- **M1 (Precision Entry):** CHoCH + Volume Climax + Stochastic Reload

#### 4 Scenarios (Not Sequential — Identify Which Is Active)

| Scenario | Name | Wave | Direction | Key Zone | Entry Trigger |
|----------|------|------|-----------|----------|---------------|
| **A** | Bullish Wave 2 — Crash Trap | 2 | Long | Golden Pocket (50-61.8% Fib) | Crash into pocket → CHoCH |
| **B** | Bullish Wave 4 — Diamond Chop | 4 | Long | Diamond Box (horizontal range) | Wyckoff Spring in box → CHoCH |
| **C** | Bearish Wave 2 — Relief Trap | 2 | Short | Golden Pocket (50-61.8% Fib) | Rally into pocket → CHoCH |
| **D** | Bearish Wave 4 — Diamond Chop | 4 | Short | Diamond Box (horizontal range) | Wyckoff Upthrust in box → CHoCH |

#### Universal Execution (All 4 Scenarios)

1. Volume climax (2x+ avg volume)
2. CHoCH (Change of Character — structural break on M1)
3. Stochastic reload (K crosses D from <20 or >80)
4. SL at Spring/Upthrust wick (exactly $8.50 risk)
5. TP1 at 100% Fib extension (close 50%)
6. TP2 at 161.8% Fib extension (close 50%)
7. Position sized at 1% risk ($8.50 on $850 account)

#### 8-Item Checklist

1. **fm-1:** H1 macro trend confirmed (HH/HL = buy only, LH/LL = sell only)
2. **fm-2:** Active scenario identified (A/B/C/D)
3. **fm-3:** RSI + MACD divergence confirmed on M15
4. **fm-4:** M1 volume climax + rejection at key zone
5. **fm-5:** M1 CHoCH confirmed (structural break)
6. **fm-6:** Stochastic reload from extreme zone
7. **fm-7:** SL at Spring/Upthrust, split TP1/TP2
8. **fm-8:** Position sized at exactly 1% risk ($8.50 on $850)

### Supporting Analysis

- **Bill Williams Indicators:** Alligator, Fractals, AO, AC, Gator (confluence validation)
- **AMD (Accumulation, Manipulation, Distribution):** Wyckoff-based market phase detection
- **Volume Flow Analysis:** VPOC, VWAP, HVN/LVN zones
- **Liquidity Sweeps:** Stop hunts and institutional footprints

---

## AI Pipeline

### 3-Model Sequence (Episode Generation)

#### 1. Gemini 2.5 Flash (Structural Analysis)
**Role:** Raw data processor
**Input:** 7 timeframes of OHLCV candles + all calculated indicators
**Output:** Structured markdown with scenario breakdown

**Prompt:** `lib/story/prompts/gemini-structural.ts`
- Fast Matrix scenario identification (A/B/C/D)
- AMD phase classification
- Bill Williams fractal confluence
- Volume profile analysis
- Key levels and bias

**Model Settings:**
- Temperature: 0.2 (low hallucination)
- Max tokens: 8000
- Stop at: `---END---`

#### 2. DeepSeek R1 (Quantitative Validation)
**Role:** Statistical validator
**Input:** Gemini's structural analysis + raw data
**Output:** Numerical scores and statistical proof

**Prompt:** `lib/story/prompts/deepseek-quant.ts`
- Fast Matrix setup scoring (0-100)
- R:R ratio calculation
- Probability estimates
- Validation of Gemini's claims

**Model Settings:**
- Temperature: 0.3 (deterministic)
- Max tokens: 6000

#### 3. Claude Sonnet 4.5 (Narrator)
**Role:** Story synthesizer
**Input:** Gemini + DeepSeek outputs + CMS condition matches
**Output:** Final episode with trade guidance

**Prompt:** `lib/story/prompts/claude-narrator.ts`
- Narrative synthesis (episode-based storytelling)
- CMS condition interpretation (14 technical patterns)
- Conflict integration (acknowledge failures)
- Trade guidance based on Fast Matrix checklist

**Model Settings:**
- Temperature: 0.7 (creative but grounded)
- Max tokens: 4000

### AI Desk (Trade Review)

**Simulated JP Morgan Trading Desk** — 4 AI characters review every trade

#### Characters

1. **Ray (Quant)** — Validates Fast Matrix checklist and statistical edge
2. **Sarah (Risk Analyst)** — Enforces $8.50 rule with zero tolerance
3. **Alex (Macro Analyst)** — Validates directional filter and cross-market context
4. **Marcus (Portfolio Manager)** — Final verdict based on strategy alignment

**Prompt:** `lib/desk/prompts/trade-review.ts`

**Verdict Types:**
- `approved` — All systems go
- `approved_with_concerns` — Proceed with caution
- `blocked` — Trade rejected

**Blocking Scenarios:**
- Risk > $8.50
- Violates directional filter (e.g., shorting in bullish H1 trend)
- Low Fast Matrix score (<60)
- Cold volatility regime without catalyst
- Existing rule violations

---

## Data Flow

### Story Generation Flow

```
1. User clicks "Generate Story" for EUR/USD
2. API: /api/story/generate
3. Data Collector (lib/story/data-collector.ts):
   ├─► Fetch 7 timeframes from OANDA (M, W, D, H4, H1, M15, M1)
   ├─► Calculate 30+ indicators (EMA, RSI, MACD, Stochastic, Alligator, etc.)
   ├─► Run detectors:
   │   ├─► Fast Matrix (lib/story/true-fractal-detector.ts)
   │   ├─► AMD Phase (lib/story/amd-detector.ts)
   │   ├─► Liquidity Sweeps (lib/story/liquidity-detector.ts)
   │   ├─► Bill Williams Fractals (lib/story/fractal-detector.ts)
   │   └─► Volume Profile (lib/utils/volume-profile.ts)
   └─► Package into StoryDataPayload
4. Pipeline (lib/story/pipeline.ts):
   ├─► Gemini: Structural analysis → markdown
   ├─► DeepSeek: Quantitative validation → scores
   ├─► CMS: Pattern matching → 14 conditions
   └─► Claude: Narrative synthesis → final episode
5. Database: Insert into story_episodes table
6. UI: Display episode timeline with narrative + charts
```

### Trade Execution Flow

```
1. User fills trade form (/trade page)
2. User clicks "Review with Desk"
3. API: /api/desk/review
   ├─► Fetch Fast Matrix setup for pair
   ├─► Load open positions, risk rules, portfolio stats
   ├─► Call Claude Sonnet 4.5 with desk prompt
   └─► Return: Ray/Sarah/Alex/Marcus responses + verdict
4. If approved → User clicks "Execute Trade"
5. API: /api/trade/execute
   ├─► Validate risk rules (max_open_trades, max_daily_loss, etc.)
   ├─► Calculate position size: Units = ($850 × 0.01) / |entry - SL|
   ├─► OANDA: Place market order with SL/TP
   ├─► Database: Insert into trades table
   └─► Log execution in execution_log table
6. UI: Show confirmation toast + redirect to /positions
```

### Cron Job Flow (Scenario Monitor Example)

```
1. Railway triggers: /api/cron/scenario-monitor (every 15 minutes)
2. Time Filter (lib/utils/trading-hours.ts):
   ├─► Get Montreal time (EST/EDT aware)
   ├─► Check session (ny_core, recon, london_killzone, etc.)
   └─► If dead zone → skip execution (return "skipped")
3. For each active subscription (EUR/USD, BTC/USD, etc.):
   ├─► Fetch latest H1, M15, M1 candles
   ├─► Run Fast Matrix detector
   ├─► Check if scenario A/B/C/D is triggered
   └─► If triggered → Send Telegram alert + create story episode
4. Database: Log cron execution
```

---

## Key Features

### 1. Story-Based Trading

**Path:** `/story` and `/story/[pair]`

- **Episode Timeline:** Each pair (EUR/USD, GBP/USD, etc.) has a chronological story
- **AI Narrator:** Claude writes episodes like a TV series (conflict, resolution, cliffhangers)
- **Position Journey:** Track how a trade idea evolves from setup → entry → exit
- **Desk Review:** See what Ray, Sarah, Alex, Marcus said about each scenario

**Database Tables:**
- `story_episodes` — Generated episodes
- `story_positions` — Planned positions from episodes
- `story_subscriptions` — Pairs user is following

### 2. The Desk (AI Trading Team)

**Path:** `/` (dashboard)

- **Desk Feed:** Real-time messages from Ray/Sarah/Alex/Marcus
- **Morning Meeting:** Daily pre-market briefing (generated at 7:30 AM EST)
- **Trade Reviews:** Character-specific feedback on proposed trades
- **Process Scoring:** Post-trade evaluation (did you follow the plan?)

**Database Tables:**
- `desk_messages` — All desk communications
- `desk_state` — Current desk status (scar tissue, priorities, cautions)

### 3. Trade Execution

**Path:** `/trade`

- **Order Form:** Entry/SL/TP with real-time risk calculation
- **Risk Gauge:** Visual indicator of $8.50 rule compliance
- **Units/Margin Toggle:** Switch between position size and margin requirement
- **Financing Display:** Shows overnight interest charges
- **Desk Review Button:** Pre-execution validation

**Database Tables:**
- `trades` — All executed trades (internal + OANDA synced)
- `trade_pnl` — Realized P&L records
- `execution_log` — Audit trail of every API call

### 4. Position Management

**Path:** `/positions`

- **Open Trades:** Live positions with real-time P&L
- **Pending Orders:** Limit/stop orders waiting to fill
- **Trade Actions:** Modify SL/TP, close position, cancel order
- **Story Link:** Connect OANDA trades to story positions

**API Endpoints:**
- `/api/oanda/positions` — Fetch open positions
- `/api/trade/modify` — Update SL/TP
- `/api/trade/close` — Close position
- `/api/trade/cancel` — Cancel pending order

### 5. Journal & P&L

**Path:** `/journal` and `/pnl`

#### Journal Features:
- **Weekly View:** 7-day calendar with trade entries per day
- **Trade Detail:** Expand to see screenshots, notes, desk feedback
- **Strategy Checklist:** 8-item Fast Matrix validation
- **Screenshot Upload:** Visual documentation of setups
- **Close Trade Modal:** Record P&L with notes

#### P&L Analytics:
- **Cumulative Chart:** Equity curve over time
- **By Pair Chart:** Performance breakdown per instrument
- **Win Rate:** % of winning trades
- **Profit Factor:** Gross profit / Gross loss
- **OANDA Sync:** Import external trades from broker

**Database Tables:**
- `trades` — Source of truth for all trades
- `trade_pnl` — P&L records
- `trader_profile` — Account stats and sync timestamps

### 6. CMS (Condition Matching System)

**Path:** `/cms`

**Purpose:** Programmatic pattern detection (14 technical conditions)

#### Categories:

1. **Fast Matrix (fm1-fm4):** Scenario A/B/C/D setups
2. **AMD (amd1-amd3):** Accumulation, Manipulation, Distribution
3. **Liquidity (liq1-liq3):** Sweeps, traps, and stop hunts
4. **Bill Williams Fractals (f1-f4):** Alligator + AO confluence patterns

**Engine:** `lib/cms/condition-engine.ts`
- Pure algorithmic evaluation (no AI)
- Returns `CMSResult` with boolean matches per condition
- Integrated into Claude narrator prompt for episode synthesis

### 7. Correlation Scenarios

**Path:** `/correlation-scenarios`

- **Pattern Mining:** Discover recurring setups (e.g., "Monday reversal after Friday trap")
- **Probability Estimates:** Historical success rates for detected patterns
- **Predictions:** AI forecasts based on correlation analysis
- **Backtest Results:** Validate pattern performance over historical data

**Database Tables:**
- `correlation_scenarios` — Discovered patterns
- `correlation_predictions` — AI forecasts
- `correlation_backtest_results` — Historical validation

### 8. Indicator Optimization

**Path:** `/indicator-optimization`

- **Timeframe Calibration:** Optimize EMA, RSI, MACD, Alligator for each timeframe (M/W/D/H4/H1/M15/M1)
- **Parameter Tuning:** Find best-fit values (e.g., EMA period, RSI threshold)
- **Performance Scoring:** Evaluate accuracy of indicator signals

**Database Tables:**
- `indicator_calibrations` — Optimized parameters per pair/timeframe

### 9. Risk Rules

**Path:** `/risk-rules`

**Enforced Rules:**
- `max_open_trades` — Default: 3
- `max_daily_loss` — Default: $25
- `max_weekly_loss` — Default: $100
- `max_position_size` — Default: 0.03 lots
- `risk_per_trade` — Fixed: 1% ($8.50 on $850)

**Database Table:** `risk_rules`

### 10. Fundamentals Analysis

**Path:** `/fundamentals`

- **Economic Calendar Integration:** NFP, CPI, FOMC, etc.
- **AI Chat Sessions:** Ask questions about news events
- **Episode Creation:** Convert fundamental analysis into story episodes

**Database Tables:**
- `fundamental_sessions` — Chat sessions
- `fundamental_messages` — Chat messages

### 11. Market Calendar

**Path:** `/calendar`

- **Economic Events:** High-impact data releases (color-coded by severity)
- **Earnings Reports:** Major stock earnings
- **Central Bank Decisions:** FOMC, ECB, BoE, BoJ meetings

**Database Table:** `calendar_events`

### 12. Trading Gurus (Reference Library)

**Path:** `/trading-gurus`

- **Al Brooks:** Price action expert
- **ICT (Inner Circle Trader):** Institutional orderflow
- **Mark Douglas:** Trading psychology
- **Bill Williams:** Chaos theory + fractals
- **Wyckoff:** Market manipulation and accumulation

**Database Table:** `trading_gurus`

### 13. References

**Path:** `/references`

- **Candlestick Patterns:** Doji, engulfing, hammer, etc.
- **Chart Patterns:** Head & shoulders, triangles, flags
- **Elliott Wave Calculator:** Fibonacci projection tool

### 14. Settings

**Path:** `/settings`

- **OANDA Connection:** Link demo/live accounts
- **AI Model Selection:** Choose Gemini/DeepSeek/Claude API keys
- **Telegram Notifications:** Configure alerts
- **Great Reset:** Nuclear option (delete all data, reset demo account)

**Database Table:** `trader_profile`

---

## Database Schema

### Core Tables

#### 1. `trades`
All executed trades (internal + OANDA synced)

```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES auth.users
pair               TEXT (e.g., 'EUR/USD', 'BTC/USD')
direction          TEXT ('long' | 'short')
entry_price        NUMERIC
exit_price         NUMERIC (NULL if still open)
stop_loss          NUMERIC
take_profit        NUMERIC
lot_size           NUMERIC
status             TEXT ('open' | 'closed')
source             TEXT ('internal' | 'external' | 'story')
oanda_trade_id     TEXT (NULL if internal)
oanda_account_id   TEXT
story_episode_id   UUID (NULL if not from story)
opened_at          TIMESTAMP
closed_at          TIMESTAMP (NULL if still open)
```

#### 2. `story_episodes`
AI-generated market analysis episodes

```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES auth.users
pair               TEXT
title              TEXT
narrative          TEXT (Claude's final synthesis)
direction          TEXT ('long' | 'short' | 'neutral')
probability        INTEGER (0-100)
status             TEXT ('active' | 'executed' | 'invalidated')
entry_price        NUMERIC (suggested)
stop_loss          NUMERIC (suggested)
take_profit        NUMERIC (suggested)
raw_analysis       JSONB (Gemini structural output)
quant_validation   JSONB (DeepSeek scores)
cms_matches        JSONB (CMS condition results)
fast_matrix        JSONB (Fast Matrix setup data)
amd_phase          TEXT ('accumulation' | 'manipulation' | 'distribution')
created_at         TIMESTAMP
```

#### 3. `desk_messages`
AI desk communications (Ray, Sarah, Alex, Marcus)

```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES auth.users
character          TEXT ('ray' | 'sarah' | 'alex' | 'marcus')
message            TEXT
tone               TEXT ('neutral' | 'positive' | 'cautious' | 'warning' | 'critical')
context_type       TEXT ('morning_meeting' | 'trade_review' | 'story_reaction' | 'process_score')
context_id         UUID (trade_id or episode_id)
created_at         TIMESTAMP
```

#### 4. `trader_profile`
User account settings and stats

```sql
user_id            UUID PRIMARY KEY REFERENCES auth.users
account_balance    NUMERIC DEFAULT 850
demo_mode          BOOLEAN DEFAULT TRUE
last_demo_reset_at TIMESTAMP
last_sync_at       TIMESTAMP (for incremental OANDA sync)
telegram_chat_id   TEXT
created_at         TIMESTAMP
```

#### 5. `risk_rules`
Active risk management rules

```sql
id                 UUID PRIMARY KEY
user_id            UUID REFERENCES auth.users
rule_type          TEXT ('max_open_trades' | 'max_daily_loss' | etc.)
value              JSONB (e.g., {"count": 3} or {"amount": 25})
is_active          BOOLEAN DEFAULT TRUE
```

### Supporting Tables

- `story_positions` — Planned trades from episodes
- `story_subscriptions` — Pairs user is tracking
- `trade_pnl` — Realized P&L records
- `execution_log` — API call audit trail
- `desk_state` — Current desk status (scars, priorities, cautions)
- `correlation_scenarios` — Discovered patterns
- `correlation_predictions` — AI forecasts
- `indicator_calibrations` — Optimized indicator parameters
- `calendar_events` — Economic calendar
- `trading_gurus` — Reference library entries
- `fundamental_sessions` — News analysis chat sessions
- `fundamental_messages` — Chat messages

---

## Deployment

### Railway Configuration

**Project:** TradeDesk CFD Production
**Region:** US West
**Build Command:** `npm run build`
**Start Command:** `node .next/standalone/server.js`

#### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# OANDA
OANDA_API_KEY=xxx-xxx
OANDA_ACCOUNT_ID=xxx-xxx
OANDA_API_URL=https://api-fxpractice.oanda.com (demo)
# OANDA_API_URL=https://api-fxtrade.oanda.com (live)

# Coinbase (Crypto)
COINBASE_API_KEY_NAME=organizations/xxx/apiKeys/xxx
COINBASE_PRIVATE_KEY=-----BEGIN EC PRIVATE KEY-----\nxxx\n-----END EC PRIVATE KEY-----

# AI Models
GOOGLE_API_KEY=AIzaxxx (Gemini)
DEEPSEEK_API_KEY=sk-xxx (DeepSeek R1)
ANTHROPIC_API_KEY=sk-ant-xxx (Claude Sonnet 4.5)

# CoinGecko
COINGECKO_API_KEY=CG-xxx (free tier)

# Telegram Notifications
TELEGRAM_BOT_TOKEN=xxx:xxx
```

#### Railway Cron Jobs

Configured in `railway.json`:

```json
{
  "crons": [
    {
      "command": "curl https://trading-desk-production.up.railway.app/api/cron/scenario-monitor",
      "schedule": "*/15 * * * *"
    },
    {
      "command": "curl https://trading-desk-production.up.railway.app/api/cron/pattern-alerts",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

**Note:** Cron jobs run every 15 minutes but have internal time filtering (`lib/utils/trading-hours.ts`) to skip dead zones.

### Build Process

1. `npm run build` — Next.js build + standalone output
2. `scripts/copy-standalone-assets.mjs` — Copy public/ and .next/static/ to standalone folder
3. Railway deploys standalone server
4. Auto-restart on new GitHub commits to `master` branch

---

## Cron Jobs

### Montreal Fast Matrix Schedule

**Purpose:** Respect institutional volume patterns and avoid low-liquidity traps

#### Trading Sessions (Montreal EST/EDT)

| Session | Time (EST) | Status | Days |
|---------|-----------|--------|------|
| **asian_dead** | 8:00 PM - 2:00 AM | ❌ Skip | All |
| **london_killzone** | 2:00 AM - 4:00 AM | ✅ Run (Tue/Wed only) | Tue, Wed |
| **recon** | 7:30 AM - 8:00 AM | ✅ Run | Mon-Fri |
| **ny_core** | 8:00 AM - 11:30 AM | ✅ Run (PRIMARY) | Mon-Fri |
| **ny_afternoon** | 11:30 AM - 8:00 PM | ❌ Skip | All |
| **weekend** | Sat-Sun | ❌ Skip | Sat, Sun |

#### Active Cron Jobs

1. **Scenario Monitor** (`/api/cron/scenario-monitor`)
   - **Frequency:** Every 15 minutes (Railway trigger)
   - **Time Filter:** Only runs during active sessions
   - **Action:** Detect Fast Matrix setups, send Telegram alerts

2. **Pattern Alerts** (`/api/cron/pattern-alerts`)
   - **Frequency:** Every 15 minutes (Railway trigger)
   - **Time Filter:** Only runs during active sessions
   - **Action:** Check CMS conditions, notify on matches

3. **Story Agents** (`/api/cron/story-agents`)
   - **Frequency:** Every 30 minutes (disabled by default)
   - **Action:** Auto-generate episodes for subscribed pairs

---

## API Reference

### Story APIs

- `POST /api/story/generate` — Generate new episode for a pair
- `GET /api/story/episodes` — List all episodes
- `GET /api/story/episodes/[id]` — Get single episode
- `GET /api/story/scenarios` — List active scenarios across all pairs
- `POST /api/story/subscriptions` — Subscribe to a pair
- `DELETE /api/story/subscriptions/[pair]` — Unsubscribe from a pair

### Desk APIs

- `POST /api/desk/review` — Review a trade proposal (Ray/Sarah/Alex/Marcus)
- `GET /api/desk/messages` — Fetch desk feed
- `POST /api/desk/meeting` — Generate morning meeting briefing
- `POST /api/desk/score` — Score post-trade execution (did you follow the plan?)
- `GET /api/desk/state` — Get current desk state (scars, priorities, cautions)

### Trade APIs

- `POST /api/trade/execute` — Execute market order via OANDA
- `POST /api/trade/plan` — Create planned trade (not executed)
- `POST /api/trade/modify` — Update SL/TP on open position
- `POST /api/trade/close` — Close open position
- `POST /api/trade/cancel` — Cancel pending order
- `GET /api/trades` — List all trades (open + closed)
- `POST /api/trades/sync` — Sync trades from OANDA (incremental)

### OANDA APIs

- `GET /api/oanda/account` — Fetch account info
- `GET /api/oanda/positions` — List open positions
- `GET /api/oanda/prices` — Get real-time prices for pairs
- `POST /api/oanda/connection` — Test connection
- `POST /api/oanda/switch-mode` — Toggle demo/live mode

### Risk APIs

- `POST /api/risk/validate` — Validate trade against risk rules
- `GET /api/risk-rules` — List active rules
- `POST /api/risk-rules` — Create new rule
- `PATCH /api/risk-rules/[id]` — Update rule
- `DELETE /api/risk-rules/[id]` — Deactivate rule

### CMS APIs

- `POST /api/cms/generate` — Run CMS condition engine for a pair
- `GET /api/cms/results` — Fetch latest CMS results

### System APIs

- `POST /api/system/great-reset` — Nuclear reset (delete all data + reset OANDA demo)
- `POST /api/demo/reset` — Reset demo account only (keep local data)
- `GET /api/health` — Health check endpoint

---

## File Organization

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login/Signup (public)
│   ├── (dashboard)/              # Main app (protected)
│   │   ├── page.tsx              # Dashboard (Desk Feed)
│   │   ├── story/                # Story pages
│   │   ├── trade/                # Trade execution terminal
│   │   ├── positions/            # Open positions
│   │   ├── journal/              # Trade journal
│   │   ├── pnl/                  # P&L analytics
│   │   ├── cms/                  # CMS condition viewer
│   │   ├── correlation-scenarios/ # Pattern discovery
│   │   ├── indicator-optimization/ # Indicator tuning
│   │   ├── fundamentals/         # News analysis
│   │   ├── calendar/             # Economic calendar
│   │   ├── risk-rules/           # Risk management
│   │   ├── settings/             # Account settings
│   │   ├── references/           # Trading education
│   │   └── trading-gurus/        # Expert library
│   └── api/                      # API routes
│       ├── story/                # Story generation
│       ├── desk/                 # Desk review
│       ├── trade/                # Trade execution
│       ├── oanda/                # Broker integration
│       ├── cms/                  # CMS engine
│       ├── correlation/          # Pattern mining
│       ├── cron/                 # Scheduled jobs
│       └── system/               # Admin actions
│
├── lib/                          # Core business logic
│   ├── story/                    # Story generation engine
│   │   ├── pipeline.ts           # 3-AI orchestration
│   │   ├── data-collector.ts    # Fetch + calculate indicators
│   │   ├── prompts/              # AI prompts (Gemini, DeepSeek, Claude)
│   │   ├── true-fractal-detector.ts # Fast Matrix detector
│   │   ├── amd-detector.ts       # Wyckoff AMD phase
│   │   ├── liquidity-detector.ts # Stop hunts
│   │   └── fractal-detector.ts   # Bill Williams fractals
│   ├── desk/                     # AI desk characters
│   │   ├── prompts/              # Desk prompts (morning, review, scoring)
│   │   ├── data-collector.ts    # Desk context builder
│   │   └── story-reactions.ts   # Episode reactions
│   ├── cms/                      # Condition Matching System
│   │   └── condition-engine.ts  # 14 technical patterns
│   ├── utils/                    # Utilities
│   │   ├── indicators.ts        # 30+ indicator calculations
│   │   ├── volume-profile.ts    # VPOC, VWAP, HVN/LVN
│   │   ├── trading-hours.ts     # Montreal schedule filtering
│   │   └── m1-detectors.ts      # CHoCH, volume climax, diamond box
│   ├── oanda/                    # OANDA broker client
│   │   ├── client.ts            # REST API wrapper
│   │   └── account.ts           # Account management
│   ├── coinbase/                 # Coinbase crypto client
│   │   ├── client.ts            # REST API wrapper
│   │   └── instruments.ts       # Crypto instrument definitions
│   ├── crypto/                   # Crypto utilities
│   │   └── market-context.ts    # Fear & Greed, BTC dominance
│   ├── ai/                       # AI model clients
│   │   └── clients/             # Gemini, DeepSeek, Claude wrappers
│   ├── supabase/                 # Database client
│   ├── sync/                     # Data synchronization
│   │   └── oanda-sync.ts        # Incremental trade sync
│   ├── data/                     # Static data
│   │   └── default-strategies.ts # Fast Matrix 8-item checklist
│   └── types/                    # TypeScript types
│
├── components/                   # Shared React components
│   └── ui/                       # Shadcn/UI primitives
│
├── docs/                         # Documentation
│   ├── HOW-IT-WORKS.md          # Deep dive (31KB)
│   ├── STORY.md                 # Story system architecture
│   ├── CORRELATION_SCENARIOS.md # Pattern mining docs
│   ├── BILL-WILLIAMS-FRACTAL-FLOW.md # BW indicator guide
│   ├── cms-engine-v2.md         # CMS technical docs
│   ├── EXECUTION_DISCIPLINE_IMPLEMENTATION.md # Discipline system
│   ├── FUTURE-SCALING.md        # Roadmap
│   └── SYSTEM_INTEGRATION.md    # Integration guide
│
├── scripts/                      # Build scripts
│   └── copy-standalone-assets.mjs # Deploy helper
│
├── supabase/                     # Database migrations
│   └── migrations/              # SQL migration files
│
├── public/                       # Static assets
│
├── CLAUDE.md                     # Project instructions (Claude Code)
├── CONTEXT.md                    # Complete system reference (42KB)
├── HOLY_GRAIL.md                # Core trading philosophy
├── GREAT_RESET.md               # Reset system documentation
├── DANGEROUS_FAILURE_MODES.md   # Common pitfalls
├── SYSTEM.md                    # THIS FILE
├── README.md                    # Project overview
├── package.json                 # Dependencies
├── next.config.ts               # Next.js config
├── railway.json                 # Railway deployment config
├── .env.example                 # Environment template
└── .env.local                   # Local secrets (gitignored)
```

---

## Key Concepts

### 1. Story-Based Trading
Trades are not random. Each setup is part of a narrative arc with setup → conflict → resolution.

### 2. The $8.50 Rule
**NEVER** risk more than 1% of account ($8.50 on $850). Sarah blocks any violation.

### 3. Discipline Over Prediction
The system doesn't predict winners. It creates a plan, executes the plan, and tracks adherence.

### 4. Fast Matrix Over Discretion
If the 8-item checklist isn't complete, **don't trade**. Partial setups are traps.

### 5. Process > Outcome
Win rate doesn't matter. Execution rate matters. Did you follow the plan?

### 6. AI is a Tool, Not a Decision Maker
AI analyzes, validates, and narrates. **You** decide whether to execute.

### 7. Time > Direction
When you trade (Montreal schedule) matters more than what you trade.

---

## Common Workflows

### Generate a Story Episode

1. Go to `/story`
2. Click "Subscribe" on a pair (e.g., EUR/USD)
3. Click "Generate Story"
4. Wait 30-60 seconds (3 AI models running)
5. View episode timeline with narrative + Fast Matrix data
6. If setup is valid → "Create Position from Episode"

### Execute a Trade

1. Go to `/trade`
2. Select pair, direction, entry price
3. Set SL/TP (system calculates $8.50 risk automatically)
4. Click "Review with Desk"
5. Read Ray/Sarah/Alex/Marcus feedback
6. If approved → "Execute Trade"
7. Confirm on `/positions` page

### Sync Trades from OANDA

1. Go to `/pnl`
2. Click "Sync OANDA"
3. **First click:** Sets baseline timestamp, imports 0 trades
4. **Future clicks:** Only imports trades opened AFTER baseline
5. View imported trades in journal

### Reset Everything

1. Go to `/settings`
2. Scroll to "Great Reset"
3. Click "Reset Demo Account"
4. Confirm destructive action
5. System deletes all data + resets OANDA demo balance to $100,000

---

## Troubleshooting

### Build Fails
- Check `npm run build` locally first
- Look for TypeScript errors in terminal
- Verify all environment variables in Railway

### Cron Jobs Not Running
- Check Railway logs: `railway logs`
- Verify cron schedule in `railway.json`
- Check time filtering logic in `lib/utils/trading-hours.ts`

### OANDA API Errors
- Verify API key in `.env.local`
- Check if using demo vs live URL
- Look for rate limit errors (OANDA = 120 req/min)

### Supabase RLS Errors
- Check if user is authenticated
- Verify RLS policies on tables
- Use service role key for cron jobs (bypasses RLS)

### AI API Failures
- Check API keys for Gemini, DeepSeek, Claude
- Look for quota/billing issues
- Verify prompt length (max tokens)

---

## Next Steps (Roadmap)

See `docs/FUTURE-SCALING.md` for full roadmap.

**Planned Features:**
- Multi-user support (team trading)
- Backtesting engine (historical Fast Matrix validation)
- Live chart integration (TradingView embed)
- Voice trading (Whisper API for order entry)
- Mobile app (React Native)

---

## Support & Feedback

- **GitHub Issues:** https://github.com/sia12-web/Trading-Desk-CFD/issues
- **Documentation:** All `.md` files in this repo
- **AI Assistance:** This system is designed to work with Claude Code (`CLAUDE.md`)

---

**Remember:** The system is a tool for **discipline**, not **prediction**. Follow the plan, trust the process, and let the edge reveal itself over time.

**"Trading is about performing and executing the plan every time, regardless of what happened."**

---

*Last Updated: April 8, 2026*
*Version: 2.0 (Fast Matrix Era)*
