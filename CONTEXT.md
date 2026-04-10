# TradeDesk CFD — System Context

> **Purpose**: Complete reference for every subsystem. Read this before implementing any feature.

---

## Architecture Overview

- **Framework**: Next.js 16 (App Router) + TypeScript + React 19
- **Database**: Supabase (Auth, Postgres, Storage, RPC)
- **Deployment**: Railway (standalone output, NIXPACKS builder, auto-deploy from `master`)
- **AI**: Tri-Model V2 — Claude (Decision Architect) + Gemini (Pattern Archaeologist) + DeepSeek (Quant Engine)
- **Broker**: OANDA REST API (demo + live modes)
- **UI**: Tailwind CSS 4, Lucide icons, Recharts, ReactMarkdown, Tiptap rich text editor
- **Notifications**: Web Push (VAPID) + Telegram bot
- **Timeframes**: Monthly (M), Weekly (W), Daily (D), 4-Hour (H4), 1-Hour (H1) — **only these 5**

---

## Pages & Navigation

All pages live under `app/(dashboard)/` with shared layout in `DashboardShell.tsx`.

| Route | Page | Purpose |
|-------|------|---------|
| `/` | The Desk | JP Morgan-style AI trading floor — morning meetings, desk feed, process metrics |

| `/trading-gurus` | Trading Gurus | Private library of trading mentors & wisdom |
| `/trading-gurus/[guru]` | Guru Vault | Interactive workspace for mentor insights |
| `/ai-usage` | AI Usage | Token usage, costs, and performance per model |
| `/trade` | Trade Execution | Manual trade form with OANDA integration |
| `/positions` | Open Positions | Live OANDA positions + planned trades |
| `/execution-log` | Execution Log | OANDA API call history |
| `/journal` | Trade Journal | Past trades with notes |
| `/journal/[id]` | Journal Entry | Single trade detail |
| `/journal/[id]/edit` | Journal Edit | Edit trade notes/screenshots |
| `/pnl` | P&L Dashboard | Profit/loss analytics with charts |
| `/risk-rules` | Risk Rules | Max position, daily loss, drawdown limits |
| `/calendar` | Calendar | Trading calendar with recurring events |
| `/cms` | CMS Engine | Conditional Market Shaping — programmatic pattern analysis |
| `/correlation-scenarios` | Correlation Scenarios | Multi-currency pattern mining — statistical edge discovery |
| `/news` | News | Forex Factory + economic calendar |
| `/references` | References | Candlestick patterns, chart patterns |
| `/settings` | Settings | OANDA connection, notifications, profile |
| `/login` | Login | Auth (under `(auth)` layout) |
| `/signup` | Signup | Auth (under `(auth)` layout) |

---

## API Routes

### OANDA Integration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/oanda/account` | Account balance, margin, NAV |
| GET | `/api/oanda/connection` | Test OANDA connectivity |
| GET | `/api/oanda/positions` | Open positions |
| GET | `/api/oanda/prices` | Live pricing + spreads |
| GET | `/api/oanda/trades` | Active trades |
| POST | `/api/oanda/switch-mode` | Toggle demo/live mode |

### Trade Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/trade/execute` | Place market/limit order via OANDA |
| POST | `/api/trade/execute-planned` | Execute a planned trade |
| POST | `/api/trade/plan` | Save a planned trade |
| POST | `/api/trade/modify` | Modify SL/TP on open trade |
| POST | `/api/trade/close` | Close open position |
| POST | `/api/trade/cancel` | Cancel pending order |
| GET | `/api/trades` | List journal trades |
| POST | `/api/trades/sync` | Sync trades from OANDA |

### Risk Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/risk-rules` | List all risk rules |
| GET/PUT/DELETE | `/api/risk-rules/[id]` | CRUD single rule |
| POST | `/api/risk/validate` | Validate trade against rules |



### Trading Gurus (Private Knowledge)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/trading-gurus` | CRUD single guru topic (AI-excluded) |
| GET | `/api/trading-gurus/list` | List mentors and topics |

### AI Usage
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/ai-usage` | Aggregated AI usage stats (per provider, daily costs) |

### Calendar
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/calendar/events` | List/create calendar events |
| GET/PUT/DELETE | `/api/calendar/events/[id]` | CRUD single event |
| POST | `/api/calendar/seed-market-events` | Seed predefined market events |

### Notifications
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/notifications/subscribe` | Register push subscription |
| GET/PUT | `/api/notifications/preferences` | Get/update notification prefs |
| POST | `/api/notifications/send` | Send notification (internal) |
| POST | `/api/notifications/telegram/test` | Test Telegram connection |

### AI & Market Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/ai-connections` | Check AI API key status |
| GET | `/api/market-indices` | Global stock indices (public, no auth) |

| GET | `/api/news/fetch` | Forex news from external sources |
| GET | `/api/pairs/info` | Pair metadata (pip size, etc.) |

### CMS (Conditional Market Shaping)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/cms/generate` | Trigger CMS analysis (background task) |
| GET | `/api/cms/results?pair=EUR/USD` | Fetch cached CMS results |

### Correlation Scenarios (Multi-Currency Pattern Mining)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/correlation/analyze` | Trigger pattern discovery (200 days × 18 pairs, background task) |
| GET | `/api/correlation/scenarios` | List discovered patterns (filter by accuracy, day, sort) |
| DELETE | `/api/correlation/scenarios` | Delete ALL patterns + clear AI memory |
| DELETE | `/api/correlation/scenarios/[id]` | Delete single pattern |
| GET | `/api/correlation/cache` | Check if analysis cache is valid (7-day TTL) |
| POST | `/api/correlation/predict` | AI-powered tomorrow's predictions (current conditions vs patterns) |
| GET | `/api/correlation/export` | Export patterns as CSV/JSON |
| POST | `/api/correlation/explain/[id]` | AI explanation (Gemini → Claude) of why pattern works |
| POST | `/api/correlation/backtest/[id]` | DeepSeek backtests pattern, suggests position sizing |
| GET | `/api/correlation/monitor` | Real-time pattern trigger status (for alerts) |

### Cron Jobs (Protected by `CRON_SECRET`, scheduled via Railway cron or Supabase pg_cron + pg_net)
| Endpoint | Schedule | Purpose |
|----------|----------|---------|

| `/api/cron/pattern-alerts` | **Every 15 min** | Monitor correlation patterns, send Telegram alerts when ≥75% conditions met |

### Utilities
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload/screenshot` | Upload trade screenshot |
| GET | `/api/health` | Health check (Railway) |
| POST | `/api/demo/reset` | Reset demo data |

### Auth (under `app/auth/`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/callback` | Supabase OAuth callback |
| POST | `/auth/signout` | Sign out + clear session |

---

## AI Pipeline (Tri-Model V2)

**Sequential flow**: Gemini → DeepSeek (validates Gemini) → Claude (synthesizes both)
**All 3 must succeed** — `Promise.all`, no fallbacks. Errors propagate to user.

### Gemini "Pattern Archaeologist"
- **Model**: `gemini-3-flash-preview` via `@google/genai`
- **Timeout**: 90s, 8K output tokens
- **Role**: Process ALL raw data across 5 TFs
- **Output**: Wyckoff cycle, cross-TF Fibonacci clusters, floor/roof extrema, structural S/R, optimization suggestions
- **Prompt**: `lib/ai/prompts-gemini-archaeologist.ts`
- **Client**: `lib/ai/clients/gemini.ts`

### DeepSeek "Quantitative Engine"
- **Model**: `deepseek-chat` (V3.2) via `openai` SDK
- **Timeout**: 90s per phase (2-phase)
- **Phase 1** (parallel with Gemini): Indicator health, cross-TF divergences, confluence scoring
- **Phase 2** (after Gemini): Validate Gemini's zones, compute precise entry/SL/TP, risk model
- **Prompt**: `lib/ai/prompts-deepseek-engine.ts`
- **Client**: `lib/ai/clients/deepseek.ts`

### Claude "Decision Architect"
- **Model**: `claude-opus-4-6` via `@anthropic-ai/sdk`
- **Timeout**: 60s, `noFallback: true`
- **Role**: Elliott Wave counting, strategy gate, contradiction resolution, trade plan
- **Prompt**: `lib/ai/prompts-unified-analysis.ts` → `getUnifiedAuditorPromptV2()`
- **Client**: `lib/ai/clients/claude.ts`

### Infrastructure
- **JSON Parsing**: `lib/ai/parse-response.ts` → `parseAIJson<T>()` (uses JSON5)
- **Rate Limiter**: `lib/ai/rate-limiter.ts` → 5 calls/hour per user (in-memory)
- **Usage Logger**: `lib/ai/usage-logger.ts` → fire-and-forget DB logging with cost estimation
- **Model selection is HARDCODED** — no user-selectable tiers

### AI Usage Tracking
- **Table**: `ai_usage_logs` (provider, model, feature, tokens, cost, duration, success)
- **Logger**: `lib/ai/usage-logger.ts` → `logAIUsage()` (fire-and-forget, service role client)
- **Instrumented**: All 3 AI clients accept optional `usage: { userId, feature }` in options
- **Page**: `/ai-usage` — per-provider cards (Anthropic/Google/DeepSeek), daily cost chart, feature breakdown
- **API**: `GET /api/ai-usage?days=30` — aggregates logs client-side from raw rows
- **Cost Estimation**: Approximate pricing per 1M tokens (Claude Opus: $15/$75, Gemini Flash: $0.15/$0.60, DeepSeek: $0.27/$1.10)

---



---

## CMS Engine V2 (Conditional Market Shaping)

Programmatic statistical pattern engine — discovers "IF → THEN" market behaviors from real candle data.

### Architecture

**Phase 0 (TypeScript — NO AI):**
- Fetch OANDA candles (Daily, Weekly, H1, H4)
- Compute ~36 conditional patterns programmatically across 5 categories
- Each pattern: exact `sample_size`, `hits`, `probability`, `avg_move_pips` from real data
- Filter: `sample_size ≥ 15` AND `probability ≥ 55%`

**Phase 1 (Gemini):**
- Receives pre-computed conditions with REAL statistics
- Role: Rank patterns by tradability and structural logic
- Groups related patterns into clusters
- Does NOT generate statistics

**Phase 2 (DeepSeek):**
- Validates market structure logic (not statistics)
- Identifies microstructure mechanisms (institutional flow, session dynamics)
- Flags coincidental patterns vs structurally meaningful ones

**Phase 3 (Claude):**
- Synthesizes validated patterns into trader-friendly implications
- Writes market personality summary
- Forbidden from modifying any statistics

### Pattern Categories (~36 total)

| Category | Count | Examples |
|----------|-------|----------|
| **Daily** | ~10 | Friday fails to break Thursday's high → Monday tests Friday's low; Inside day → breakout in prior trend direction |
| **Weekly** | ~8 | Monday sets weekly high → week closes bearish; Friday closes above weekly open → next Monday bullish |
| **Session** | ~8 | Quiet Asia (<30% ATR) → London moves >70% ATR; London continues Asia's direction |
| **Volatility** | ~6 | 2+ quiet days → next day range > ATR; Range expanding 3 days → 4th day expands further |
| **Cross-Market** | ~4 | SPX500 up → pair follows; NAS diverges from SPX → pair instability |

### Modules

| Module | Path | Purpose |
|--------|------|---------|
| Condition Engine | `lib/cms/condition-engine.ts` | Programmatic computation of all patterns |
| Data Collector | `lib/cms/data-collector.ts` | OANDA candle fetching + pre-computation |
| Pipeline | `lib/cms/pipeline.ts` | Phase 0 → Gemini → DeepSeek → Claude orchestration |
| Types | `lib/cms/types.ts` | TypeScript definitions (`CMSCondition`, `ProgrammaticCondition`) |

### Prompts

| Prompt | Path | Role |
|--------|------|------|
| Gemini Pattern Ranker | `lib/cms/prompts/gemini-pattern.ts` | Ranks pre-computed conditions by tradability |
| DeepSeek Structure Validator | `lib/cms/prompts/deepseek-stats.ts` | Validates market structure logic |
| Claude Synthesizer | `lib/cms/prompts/claude-synthesis.ts` | Writes implications + personality |



### API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/cms/generate` | Trigger CMS analysis (background task) |
| GET | `/api/cms/results?pair=EUR/USD` | Fetch cached results |

### Database Tables

| Table | Purpose |
|-------|---------|
| `cms_analyses` | Stores CMS results per user+pair (7-day expiry, JSONB result, RLS) |
| `story_agent_reports` | Stores CMS as agent type `'cms_intelligence'` |

**Migration:** `supabase/migrations/20260328_create_cms_analyses.sql`

### Key Design Principles

1. **AI Never Generates Statistics** — all numbers come from TypeScript iterating real candles
2. **Source Tracking** — every condition has `source: 'programmatic'` field
3. **Anti-Hallucination** — AI only interprets, never invents sample sizes or probabilities
4. **Dedup-Friendly** — CMS agent has same dedup logic as other Story agents (once per day per pair)
5. **Zero AI Cost in Agent Mode** — CMS agent is pure TypeScript (no model calls when run as Story agent)

### UI

- **Page**: `/cms` — standalone analysis interface


---

## Trading Desk (JP Morgan-Style AI Trading Floor)

The dashboard home page (`/`) IS the Trading Desk. 4 AI characters interact daily with the trader: morning meetings, trade reviews, process scoring.

### Characters

| Seat | Name | Role | Personality |
|------|------|------|-------------|
| PM | **Marcus** | Portfolio Manager | Calm, strategic, demanding but fair. Sets desk direction. |
| Risk | **Sarah** | Risk Desk | Blunt, zero-tolerance. Can block trades. Authority is absolute. |
| Quant | **Ray** | Quantitative Analyst | Probabilistic. Never says "bullish" — says "67% probability." |
| Macro | **Alex** | Macro Strategist | Big-picture. Central banks, geopolitics, flows. |

### Modules

| Module | Path | Purpose |
|--------|------|---------|
| Types | `lib/desk/types.ts` | TypeScript definitions for all desk entities |
| Data Collector | `lib/desk/data-collector.ts` | Gathers all context for AI generation |
| Generator | `lib/desk/generator.ts` | Orchestrates AI calls + storage |
| Morning Meeting Prompt | `lib/desk/prompts/morning-meeting.ts` | All 4 characters in one Gemini call |
| Trade Review Prompt | `lib/desk/prompts/trade-review.ts` | Desk reviews proposed trades |
| Process Scoring Prompt | `lib/desk/prompts/process-scoring.ts` | Grade trades on 5 process criteria |

### API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/desk/meeting` | Generate morning meeting (background task) |
| GET | `/api/desk/meeting` | Get today's latest meeting |
| POST | `/api/desk/review` | Desk reviews a trade proposal (synchronous) |
| GET | `/api/desk/messages` | Paginated message history |
| GET | `/api/desk/state` | Desk state + recent process scores |
| POST | `/api/desk/score` | Trigger process scoring for a trade |
| GET | `/api/desk/score` | Get existing score for a trade |

### UI Components (`app/(dashboard)/_components/desk/`)

| Component | Type | Purpose |
|-----------|------|---------|
| `DeskFeed.tsx` | Client | Scrollable message feed + "Generate Meeting" button |
| `DeskMembers.tsx` | Server | Character cards with status indicators |
| `DeskStats.tsx` | Server | Process score, streak, violations, P&L |
| `DeskBook.tsx` | Server | Open positions from desk perspective |
| `MessageBubble.tsx` | Client | Individual message styling per character |

### Key Design Principles

1. **Single Gemini Call** — all 4 characters generated in one shot (~$0.01-0.03 per session)
2. **Data-Grounded** — every character statement backed by real data from `DeskContext`
3. **Anti-Hallucination** — prompt explicitly forbids fabricating prices/events
4. **Persistent Memory** — `desk_state` stores character memory across sessions
5. **Process > Outcome** — scoring evaluates discipline, not P&L

---

## Signals Hub

### Strategy Signals
Strategy signals from optimized indicator rules are stored in the `strategy_signals` table. Lifecycle: pending → approved → executed.

### Indicator Alerts
Individual indicator alerts from the optimizer.

### Generator
- **Generator**: `lib/signals/indicator-generator.ts`
- **Compression Signal**: `lib/signals/compression-signal-generator.ts`


---

## Data Layer (Supabase)

### Core Tables
| Table | Purpose |
|-------|---------|
| `trader_profile` | User profile + AI-observed traits |
| `risk_rules` | Max position, daily loss, drawdown limits |
| `trades` | Journal entries (entry, exit, SL, TP, status, OANDA sync) |
| `trade_screenshots` | Screenshots attached to trades |
| `trade_strategies` | Strategy steps per trade |
| `trade_pnl` | P&L per trade |
| `execution_log` | OANDA API call tracking |
| `trade_sync_log` | OANDA sync session history |
| `calendar_events` | Trading calendar with recurring support |
| `user_pair_notes` | Private "My Story" notes (RLS-protected, AI-excluded) |
| `trading_guru_notes` | Private mentor wisdom notes (RLS-protected, AI-excluded) |
| `technical_analyses` | Various analysis types |

### AI & Analysis Tables
| Table | Purpose |
|-------|---------|
| `wave_analysis` | Elliott Wave + auto-analysis |
| `big_picture_analysis` | Macro analysis |
| `structural_analysis_cache` | Gemini output + compression_springs (30min TTL) |




### Desk Tables
| Table | Purpose |
|-------|---------|
| `desk_meetings` | Morning meetings, trade reviews, ad-hoc sessions (4 character JSONB briefs) |
| `desk_messages` | Individual messages in desk chat feed |
| `process_scores` | Trade-level process grading (5 criteria, 1-10 scale) |
| `desk_state` | Persistent per-user state: character memory, streak, violations |

### CMS Tables
| Table | Purpose |
|-------|---------|
| `cms_analyses` | Conditional market shaping results (JSONB, 7-day expiry, RLS) |



### AI Usage Tables
| Table | Purpose |
|-------|---------|
| `ai_usage_logs` | Per-call token usage, cost estimates, latency, success/failure (RLS) |




### Notification Tables
| Table | Purpose |
|-------|---------|
| `notification_preferences` | Wake-up time, trading hours, alert prefs |
| `push_subscriptions` | Web Push device endpoints |

### Security
- **RLS enabled** on all user tables — policy: `auth.uid() = user_id`
- **No raw SQL** — all queries via Supabase JS client (parameterized)
- **Migrations**: `supabase/migrations/001_initial_core.sql` (368 lines, 16 tables)

---

## Background Tasks

Long-running operations that persist across page navigation.

| Module | Path | Side |
|--------|------|------|
| Manager | `lib/background-tasks/manager.ts` | Server only |
| Client | `lib/background-tasks/client.ts` | Browser only |
| Hook | `lib/hooks/use-background-task.ts` | React hook |
| Table | `background_tasks` | Supabase |

**IMPORTANT**: Never import `manager.ts` from client components — server/client split is mandatory.

---

## Notifications

### Web Push
- **Library**: `web-push` npm package
- **Module**: `lib/notifications/web-push.ts` (VAPID keys)
- **Hook**: `lib/hooks/use-push-notifications.ts`
- **Env**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

### Telegram
- **Module**: `lib/notifications/telegram.ts`
- **Env**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### Dispatcher
- **Module**: `lib/notifications/notifier.ts` — routes to Web Push or Telegram based on user prefs

---

## OANDA Integration

- **Client**: `lib/oanda/client.ts` — REST API wrapper with retry logic
- **Account Config**: `lib/oanda/account.ts` — LIVE/DEMO account configurations
- **Sync**: `lib/sync/oanda-sync.ts` — Sync trades from OANDA to local DB
- **Demo URL**: `https://api-fxpractice.oanda.com`
- **Live URL**: `https://api-fxtrade.oanda.com`

---

## Utilities

| Module | Path | Purpose |
|--------|------|---------|
| ATR | `lib/utils/atr.ts` | Average True Range calculation |
| Indicators | `lib/utils/indicators.ts` | Technical indicator calculations |
| Trend Detector | `lib/utils/trend-detector.ts` | Trend assessment utility |
| Candlestick | `lib/utils/candlestick-patterns.ts` | Pattern recognition |
| Forex | `lib/utils/forex.ts` | Pip calculations, pair utilities |
| Market Cycles | `lib/utils/market-cycles.ts` | Cycle analysis |
| Market Sessions | `lib/utils/market-sessions.ts` | London, NY, Tokyo, Sydney hours |
| Pair Knowledge | `lib/utils/pair-knowledge.ts` | Pair metadata |
| Sentiment | `lib/utils/sentiment.ts` | Market sentiment analysis |
| Time Fibonacci | `lib/utils/time-fibonacci.ts` | Time-based Fib calculations |
| General | `lib/utils/utils.ts` | Shared utilities |

---

## Environment Variables

| Variable | Secret? | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase backend privileged key |
| `NEXT_PUBLIC_APP_URL` | No | App base URL |
| `OANDA_DEMO_API_KEY` | Yes | Demo trading API key |
| `OANDA_DEMO_ACCOUNT_ID` | Yes | Demo account ID |
| `OANDA_DEMO_API_URL` | No | `https://api-fxpractice.oanda.com` |
| `OANDA_LIVE_API_KEY` | Yes | Live trading API key |
| `OANDA_LIVE_ACCOUNT_ID` | Yes | Live account ID |
| `OANDA_LIVE_API_URL` | No | `https://api-fxtrade.oanda.com` |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key |
| `VAPID_PUBLIC_KEY` | No | Web Push public key |
| `VAPID_PRIVATE_KEY` | Yes | Web Push private key |
| `VAPID_SUBJECT` | No | Web Push subject (email) |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Yes | Telegram recipient chat ID |
| `CRON_SECRET` | Yes | Bearer token for cron endpoints |
| `NODE_ENV` | No | `development` or `production` |

---

## Deployment (Railway)

### Config (`railway.json`)
- **Builder**: NIXPACKS
- **Start**: `npm start` → `cross-env HOSTNAME=0.0.0.0 node .next/standalone/server.js`
- **Health Check**: `GET /api/health` (120s timeout)
- **Restart**: ON_FAILURE

### Next.js Config (`next.config.ts`)
- **Output**: `standalone` (optimized for Railway)
- **File Tracing Root**: `__dirname` (fixes static asset 404s)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options (DENY), HSTS (2yr), Referrer-Policy, Permissions-Policy

### Deploy Workflow
1. Code passes `npm run build` locally
2. `git push origin master`
3. Railway auto-deploys from GitHub `master` branch
4. NIXPACKS builds → standalone server starts
5. Health check at `/api/health` confirms deployment

---

## Security Patterns

- **Auth**: All API routes authenticate via `supabase.auth.getUser()` (except `/api/health`, `/api/market-indices`)
- **RLS**: Every user table has `auth.uid() = user_id` policy
- **Cron Auth**: Bearer `CRON_SECRET` token on all `/api/cron/*` routes
- **Rate Limiting**: AI calls limited to 5/hour per user (in-memory)
- **Pair Validation**: All pairs checked against `VALID_PAIRS` whitelist before AI calls
- **Headers**: HSTS, X-Frame-Options DENY, nosniff, strict Referrer-Policy
- **No Raw SQL**: All queries via Supabase JS client (parameterized)
- **Server-only secrets**: AI API keys never exposed to client
- **Private Data Vaults**: `user_pair_notes` and `trading_guru_notes` are strictly for human consumption; they are never sent to AI providers or analyzed by system agents.
- **CORS**: Handled by Next.js defaults + Supabase config

---

## Chart Color Convention

Centralized in `lib/ai/chart-style.ts` → `CHART_STYLE_PROMPT_BLOCK`. Injected into all AI prompts.

| Timeframe | Color |
|-----------|-------|
| Monthly (M) | RED |
| Weekly (W) | GREEN |
| Daily (D) | BLUE |
| 4-Hour (H4) | YELLOW |
| 1-Hour (H1) | WHITE |

---

## Key Data Modules

| Module | Path | Purpose |
|--------|------|---------|
| Analytics | `lib/data/analytics.ts` | P&L and performance queries |
| Calendar | `lib/data/calendar.ts` | Calendar event CRUD |
| Execution Logs | `lib/data/execution-logs.ts` | OANDA execution tracking |
| Risk Rules | `lib/data/risk-rules.ts` | Risk rule CRUD |
| Screenshots | `lib/data/screenshots.ts` | Screenshot management |
| Trades | `lib/data/trades.ts` | Trade journal CRUD |
| Trader Profile | `lib/data/trader-profile.ts` | Profile management |
| Push Subs | `lib/data/push-subscriptions.ts` | Push subscription management |

---

## Correlation System & AI Memory Integration

### Overview

The **Correlation Scenario Analysis** system is a hedge fund-grade statistical pattern discovery engine that mines historical data to find multi-currency correlation patterns. It integrates seamlessly with Story AI and The Desk, creating a unified intelligence loop:

```
OANDA Data → Correlation Discovery → AI Memory → Story/Desk → Position Guidance → Telegram Alerts
```

### Architecture

#### 1. Pattern Discovery (`lib/correlation/pattern-detector.ts`)
- **Data Source**: 200 days × 18 forex pairs (all VALID_PAIRS)
- **Analysis**: Discovers 2-pair, 3-pair, and 4-pair correlation patterns
- **Algorithm**:
  1. For each day, detect significant moves (>0.5% threshold)
  2. Generate hypotheses: "When A+B move, what happens to C?"
  3. Validate outcomes over next 1-5 days
  4. Aggregate by pattern signature (SHA256 hash)
  5. Filter: ≥55% accuracy AND ≥15 occurrences
- **Output**: 300+ patterns with accuracy%, occurrences, day-of-week distribution, avg pips

#### 2. AI Memory Storage
**Database Tables**:
- `correlation_scenarios` — Discovered patterns with metrics
- `correlation_scenario_occurrences` — Individual historical instances
- `correlation_analysis_cache` — 7-day cache (expires_at)

**AI Memory Integration**:
AI memory integration. When patterns are deleted, AI memory is automatically cleared (no stale data).

#### 3. Real-Time Monitoring (`lib/correlation/pattern-monitor.ts`)
- **Trigger**: Cron job every 15 minutes (`/api/cron/pattern-alerts`)
- **Logic**:
  1. Fetch patterns ≥65% accurate
  2. Get current prices from OANDA
  3. Calculate match percentage (conditionsMet / totalConditions)
  4. If ≥75% → send Telegram alert
- **Session Awareness**: Detects Asian/London/NY/Overlap sessions (UTC-based)
- **Urgency Levels**:
  - **Immediate** (≥90%): Pattern almost certain to trigger
  - **High** (≥80%): Strong probability
  - **Medium** (<80%): Moderate probability

#### 4. Tomorrow's Predictions (`lib/correlation/predictor.ts`)
- **Input**: Current market conditions + discovered patterns
- **Process**:
  1. Compare today's price action against all pattern conditions
  2. Find patterns with ≥75% conditions met
  3. Aggregate predictions by outcome pair
  4. Use **Gemini** (structural analysis) → **Claude** (narrative synthesis)
  5. Check calendar for weekends/holidays via `calendar-checker.ts`
- **Output**: Top 5 predictions with confidence (high/medium/low)
- **Anti-Hallucination**: Strict prompt rules — AI ONLY references provided pattern data

### AI Memory Lifecycle

#### **Creation**:
1. User clicks "Run Analysis" → Background task runs `pattern-detector.ts`
2. Patterns stored in `correlation_scenarios` table
3. Cache record created with 7-day TTL

#### **Usage (Story AI)**:
1. Story generation triggered (`lib/story/pipeline.ts`)
2. Data collector calls `getCorrelationInsights(pair)`
3. Checks current prices vs pattern conditions
4. Returns active patterns (≥50% match) + tomorrow's predictions
5. Story AI writes episodes referencing pattern accuracy & expected moves

#### **Usage (Desk AI)**:
1. Morning meeting triggered (`/`)
2. Desk data collector fetches correlation insights
3. Characters reference patterns:
   - **Marcus**: Uses for multi-pair position construction
   - **Sarah**: Flags correlation-based concentration risk
   - **Ray**: Validates statistical significance
   - **Alex**: Connects to macro risk regime

#### **Deletion**:
1. User clicks "Delete All" on `/correlation-scenarios`
2. API route deletes all scenarios + occurrences + cache
3. Next Story/Desk call returns `null` for correlation insights
4. AI no longer references deleted patterns (clean slate)

### Telegram Alert Flow

1. **Cron Job** (`/api/cron/pattern-alerts`) runs every 15 min
2. Fetches users with `correlation_alerts_enabled = true`
3. For each user: `monitorPatternTriggers(userId)`
   - Compares current prices vs pattern conditions
   - Detects ≥75% match → creates trigger
4. Formats message: `formatTriggerMessage(trigger)`
   - Includes pattern description, accuracy, expected move
   - Session context (London/NY overlap = high volatility)
   - Urgency tag (immediate/high/medium)
5. Sends via Telegram Bot API (rate-limited 1 msg/sec)
6. User receives actionable alert on mobile

### Integration Points

| System | Integration File | Data Flow |
|--------|------------------|-----------|
| Story AI | `lib/story/correlation-integrator.ts` | Fetches active patterns → includes in episode data payload |
| Desk AI | `lib/desk/data-collector.ts` | Fetches patterns + predictions → characters reference in dialogue |
| Predictions Panel | `app/(dashboard)/correlation-scenarios/_components/PredictionsPanel.tsx` | Calls `/api/correlation/predict` → displays AI synthesis |
| Pattern Monitor | `lib/correlation/pattern-monitor.ts` | Real-time condition checking → Telegram alerts |
| Delete All | `app/api/correlation/scenarios/route.ts` (DELETE) | Deletes patterns + clears cache → AI memory purged |

### Example Flow: Pattern Discovery → AI Usage → Alert

1. **Discovery** (Monday 3:00 AM):
   - User runs "Analyze 200 Days"
   - System discovers Pattern #47: "When EUR/USD shows EUR weakness AND USD/JPY shows JPY strength → EUR/JPY moves DOWN"
   - Accuracy: 72%, Occurrences: 23, Avg Move: 0.6%

2. **AI Memory Storage**:
   - Pattern stored in `correlation_scenarios` table
   - Available to Story AI and Desk AI

3. **Story Generation** (Tuesday 5:00 AM):
   - Story AI generates EUR/JPY episode
   - Data collector finds Pattern #47 has 65% conditions met today
   - Episode text: "EUR/JPY daily chart shows bearish structure. **Correlation Pattern #47 (72% accurate) is ACTIVE**. When this pattern triggered in the past, EUR/JPY dropped 55 pips within 24 hours."

4. **Desk Morning Meeting** (Tuesday 9:00 AM):
   - Marcus: "We have correlation intelligence: Pattern #47 suggests EUR/JPY downside. This is a high-conviction setup."
   - Sarah: "Wait — Pattern #47 also predicts GBP weakness. That's concentration risk."
   - Ray: "When Pattern #47 hits 100% conditions, win rate is 78%."
   - Alex: "Macro supports EUR weakness. Risk-off regime."

5. **Real-Time Alert** (Tuesday 1:15 PM):
   - Cron job detects Pattern #47 now has 100% conditions met (London/NY overlap)
   - Sends Telegram: "🚨 PATTERN TRIGGER: EUR/JPY expected DOWN 0.6% (72% accuracy, 23 occurrences). Session: LONDON/NY OVERLAP (High Volatility!)"

6. **Deletion** (Wednesday):
   - User clicks "Delete All" to start fresh
   - All patterns deleted, cache cleared
   - Next Story/Desk call returns `null` for correlation insights
   - AI no longer references Pattern #47

### Critical Files

| File | Purpose |
|------|---------|
| `lib/correlation/pattern-detector.ts` | Core pattern discovery algorithm |
| `lib/correlation/data-fetcher.ts` | Fetches 200 days × 18 pairs from OANDA |
| `lib/correlation/pipeline.ts` | Background task orchestration |
| `lib/correlation/storage.ts` | Stores patterns in database |
| `lib/correlation/predictor.ts` | Tomorrow's predictions (Gemini + Claude) |
| `lib/correlation/pattern-monitor.ts` | Real-time trigger detection |
| `lib/correlation/calendar-checker.ts` | Weekend/holiday detection |
| `lib/story/correlation-integrator.ts` | Story AI integration |
| `lib/desk/data-collector.ts` | Desk AI integration |
| `app/api/correlation/scenarios/route.ts` | GET (list), DELETE (purge all + AI memory) |
| `app/api/correlation/predict/route.ts` | Tomorrow's predictions endpoint |
| `app/api/cron/pattern-alerts/route.ts` | 15-minute monitoring cron job |

---

## Supabase Client Setup

| Client | Path | Use Case |
|--------|------|----------|
| Browser | `lib/supabase/client.ts` | Client components |
| Server | `lib/supabase/server.ts` | Server components, API routes |
| Service | `lib/supabase/service.ts` | Backend (service role key) |
| Middleware | `lib/supabase/middleware.ts` | Session refresh |
