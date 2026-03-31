# Trade Desk-Forex: Complete System Overview

## What Is This?

A forex trading companion that combines three AI-powered systems into one experience:

1. **Story** - An AI narrator that frames market analysis as an unfolding story with episodes, seasons, and scenarios
2. **The Desk** - A simulated JP Morgan trading floor with 4 AI characters who review your trades
3. **Psychology** - A process scoring system that grades your trading discipline, not your P&L

---

## The 3 LLM Providers (and Why 3)

| Provider | Model | Role | Cost per 1M tokens |
|----------|-------|------|---------------------|
| **Google Gemini** | `gemini-3-flash-preview` | Pattern scanning, structural analysis, desk reactions | $0.15 in / $0.60 out |
| **DeepSeek** | `deepseek-chat` (V3.2) | Quantitative validation, level verification, risk metrics | $0.27 in / $1.10 out |
| **Anthropic Claude** | `claude-opus-4-6` | Narrative synthesis, decision-making, institutional-grade analysis | $15 in / $75 out |

The idea: Gemini sees patterns fast and cheap. DeepSeek validates the numbers. Claude makes the final call with nuance. No single model is trusted alone.

---

## Every AI Agent, Counted

### Core Pipelines (3 LLMs each)

| # | Pipeline | Models | When It Fires | Trigger |
|---|----------|--------|---------------|---------|
| 1 | **Story Generation** | Gemini + DeepSeek + Claude | On-demand or scenario trigger | User clicks "Begin Story" or scenario monitor detects trigger |
| 2 | **Scenario Analysis** | Gemini + DeepSeek + Claude (Sonnet) | Monday 3:30 AM UTC | Weekly cron |
| 3 | **CMS (Conditional Market Shaping)** | Gemini + DeepSeek + Claude | On-demand | User clicks "Generate" |

### Daily Intelligence Agents (4:00 AM UTC, Mon-Fri)

| # | Agent | Model | What It Does |
|---|-------|-------|-------------|
| 4 | **Indicator Optimizer** | DeepSeek | Tunes RSI/MACD/Bollinger parameters per timeframe based on recent price action |
| 5 | **News Intelligence** | Gemini | Summarizes macro outlook, central bank analysis, geopolitical risks |
| 6 | **Cross-Market Analysis** | Gemini | Reads stock indices (SPX500, Nikkei, DAX) for risk appetite and currency implications |
| 7 | **CMS Intelligence** | None (programmatic) | Computes statistically significant price patterns from historical data |

### Desk Characters (Gemini only)

| # | Feature | Model | When It Fires |
|---|---------|-------|---------------|
| 8 | **Morning Meeting** | Gemini | Manual or scheduled - all 4 characters brief you |
| 9 | **Trade Review** | Gemini | When you propose a trade - synchronous approval/block |
| 10 | **Process Scoring** | Gemini | When a trade closes - scores your discipline |
| 11 | **Story Reactions (Entry)** | Gemini | Auto, after Story generates a position_entry episode |
| 12 | **Story Reactions (Management)** | Gemini | Auto, after Story generates a position_management episode |

### Automated Monitor (No AI)

| # | System | Model | Schedule |
|---|--------|-------|----------|
| 13 | **Scenario Monitor** | None | Every 15 minutes - checks candle closes against scenario trigger levels |

**Total: 13 distinct AI-powered or automated processes, using 3 LLM providers across 9 different model calls.**

---

## How It All Connects (The Full Flow)

```
           DAILY INTELLIGENCE (4 AM)
           |  Indicator Optimizer (DeepSeek)
           |  News Intelligence (Gemini)
           |  Cross-Market Analysis (Gemini)
           |  CMS Statistics (programmatic)
           v
    +------------------+
    |   STORY ENGINE   |  <-- User clicks "Begin Story" or scenario triggers
    +------------------+
    | 1. Gemini scans structure (patterns, levels, bias)
    | 2. DeepSeek validates levels (rejects suspicious ones)
    | 3. Claude narrates episode (story + position guidance)
    | 4. Creates 2 binary scenarios (one bullish, one bearish)
    v
    +-------------------+
    |  SCENARIO MONITOR |  <-- Every 15 min, no AI
    +-------------------+
    | Checks: did price close above/below trigger level?
    | YES -> triggers scenario -> queues next episode
    | Binary: when one triggers, sibling auto-invalidates
    v
    +-------------------+       +------------------+
    |  POSITION ENTRY   | ----> |   THE DESK       |
    |  EPISODE          |       +------------------+
    +-------------------+       | Ray: "R:R 2.8, confluence 8/10"
    | AI suggests: go short     | Sarah: "Streak is 4, protect it"
    | Entry: 1.0850             | Alex: "ECB fits the short thesis"
    | SL: 1.0890                | Marcus: "Approved. Don't rush."
    | TP: 1.0740                +------------------+
    v
    USER DECIDES: Activate or Skip
    |
    |-- Skip --> Season ends immediately
    |
    |-- Activate --> Position goes live
           |
           v
    +------------------------+
    | POSITION MANAGEMENT    |  <-- Next scenario triggers
    | EPISODES               |
    +------------------------+
    | AI says: hold / adjust SL / take partial / close
    | Ray + Sarah react (2 messages)
    | If close: all 4 characters react
    v
    +-------------------+       +------------------+
    |  TRADE CLOSES     | ----> |  PROCESS SCORE   |
    +-------------------+       +------------------+
    | Season ends                | 5 criteria (1-10):
    | Summary archived           |   Entry criteria
    | New season can begin       |   Stop loss discipline
                                 |   R:R compliance
                                 |   Size discipline
                                 |   Patience
                                 | Sarah + Marcus commentary
                                 | Updates streak & weekly avg
```

---

## The 4 Desk Characters

| Character | Role | Personality | What They Actually Do |
|-----------|------|-------------|----------------------|
| **Marcus** | Portfolio Manager (Head) | Strategic, demanding, references your psychology | Final verdict on trades. Remembers your weaknesses. |
| **Sarah** | Risk Manager | Blunt, zero-tolerance, absolute authority | Can BLOCK trades. Checks R:R, position size, exposure, violations. |
| **Ray** | Quantitative Analyst | Numbers-only, never says "bullish/bearish" | Assesses statistical edge, confluence scores, probability. |
| **Alex** | Macro Strategist | Big-picture, geopolitical awareness | Checks if trade aligns with macro environment. |

Sarah is the only one who can block a trade. Marcus can challenge or approve with conditions. Ray and Alex provide context.

---

## Safety Layers (What Stops You From Losing Money?)

### Layer 1: AI Never Executes Trades

Every AI recommendation creates a **suggested** position. You must manually click "Activate" to make it real. There is no auto-trading.

### Layer 2: Risk Rule Enforcement

6 rules checked before every trade execution:

| Rule | Default | What Happens |
|------|---------|-------------|
| Max risk per trade | 2% | **Blocks execution** if exceeded |
| Max daily loss | 5% | **Blocks all trading** for the day |
| Max open trades | 3 | **Blocks new trades** |
| Max position size | 1.0 lots | **Blocks oversized entries** |
| Min reward:risk | 1.5:1 | **Blocks bad R:R trades** |
| Correlated exposure | 2 pairs | **Blocks correlated positions** |

### Layer 3: Live Price Slippage Guard

When you execute, the system fetches the real OANDA price and checks:
- Is slippage > 5 pips? **Blocked.**
- Did R:R degrade > 30% from the AI suggestion? **Blocked.**
- Is R:R now below minimum? **Blocked.**

### Layer 4: Desk Review

Sarah can flag violations. Marcus can challenge. The desk review appears on both the Desk feed and the Story page so you can't miss it.

### Layer 5: Process Scoring (Post-Trade)

After every closed trade, Gemini scores your process. Low scores (< 5/10) trigger a Sarah alert. Your streak resets. This creates accountability.

### Layer 6: Rate Limiter

5 AI calls per hour per user. Prevents runaway costs and over-reliance on AI generation.

---

## The Honest Assessment

### What's Good

**The tri-model validation is genuinely strong.** Having Gemini scan, DeepSeek validate numbers, and Claude synthesize means no single model's hallucination makes it through unchallenged. DeepSeek specifically flags "suspicious levels" that Gemini might hallucinate.

**Process > P&L is the right philosophy.** Scoring discipline instead of outcomes aligns with how professional trading desks actually evaluate traders. A good loss is better than a lucky win.

**The human-in-the-loop design is correct.** AI suggests, you decide. No auto-trading means AI mistakes don't directly drain your account.

**Event-driven episodes prevent noise.** Old system generated episodes daily whether anything happened or not. New system only generates when scenarios actually trigger, reducing information overload.

**The Desk characters create friction.** When Marcus says "Your patience score is 6/10 -- don't rush this," that's a behavioral nudge that raw data can't provide. It makes you pause.

### What's Risky

**13 AI processes is a lot of complexity.** When something goes wrong, debugging across 3 LLM providers, 4 daily agents, a tri-model pipeline, and 5 desk functions is hard. A hallucination from the News Intelligence agent at 4 AM could cascade into a bad Story episode that triggers a bad desk reaction.

**AI confidence numbers are fabricated.** When Claude says "78% confidence," that number is not statistically derived. It's a language model estimating its own certainty, which has no proven correlation with actual market outcomes. Users may treat these numbers as real probabilities.

**The Desk characters can create false authority.** "Sarah approved it" and "Marcus says go" feel authoritative, but these are Gemini responses to a prompt. Sarah doesn't actually know your real portfolio risk -- she knows what the system told her. If the data collection missed something, Sarah's "green light" is meaningless.

**Scenario trigger levels are AI-generated.** The scenario monitor is data-driven (good), but the trigger levels it monitors were set by AI (uncertain). If Gemini hallucinated a support level at 1.0850 when real support is at 1.0820, the monitor will trigger at the wrong price.

**Cost scales with activity.** Each Story episode costs ~$0.20-0.50 (Gemini + DeepSeek + Claude). Desk reactions add ~$0.01 each (Gemini only). But the weekly scenario analysis, daily agents, and CMS pipeline add up. An active trader monitoring 5 pairs could spend $50-100/month on AI alone, before any trading costs.

**The narrative format can create attachment.** When your trade is a "story" with a "season finale," you might hold a losing position longer because you want to see how the story ends. Markets don't care about narratives.

### The Bottom Line

**This system won't cause you to lose money by itself** -- it has enough safety layers to prevent that. What it can do is:

1. **Give you false confidence** through authoritative-sounding AI characters
2. **Create analysis paralysis** through too much information (13 AI processes for one trade decision)
3. **Encourage over-trading** by making every market move feel like an "episode" worth acting on
4. **Drain your account slowly** through AI API costs if you're not monitoring spend

**The system is as good as the trader using it.** If you treat AI suggestions as one input among many, manually verify key levels on your charts, and actually respect the process scoring, it's a powerful companion. If you blindly follow "Marcus said approved," you're outsourcing your trading decisions to a language model that has never traded a dollar.

### Recommendations for Safe Use

1. **Always verify AI levels on your actual chart** before activating any position
2. **Treat confidence percentages as "AI enthusiasm," not probability**
3. **Monitor `/ai-usage` weekly** to track your AI spend
4. **If your process score is consistently < 7, stop trading and review** -- the system is telling you something
5. **Don't skip the Skip Trade button** -- declining a bad setup is the best trade you can make
6. **Start on demo account** until your weekly process average is above 7.0 for 4 consecutive weeks

---

## Technical Quick Reference

| What | Where |
|------|-------|
| Story pipeline | `lib/story/pipeline.ts` |
| Scenario monitor | `lib/story/scenario-monitor.ts` |
| Desk generator | `lib/desk/generator.ts` |
| Desk-Story bridge | `lib/desk/story-reactions.ts` |
| Process scoring | `lib/desk/generator.ts` → `scoreTradeProcess()` |
| Risk validator | `lib/risk/validator.ts` |
| Rate limiter | `lib/ai/rate-limiter.ts` |
| AI usage tracking | `lib/ai/usage-logger.ts` |
| All AI clients | `lib/ai/clients/` (gemini, claude, deepseek) |
| Daily agents | `lib/story/agents/` (4 agents) |
| Position state machine | `lib/data/story-positions.ts` |
| Desk reaction prompts | `lib/desk/prompts/story-reaction.ts` |
