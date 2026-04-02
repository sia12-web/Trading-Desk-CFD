# TradeDesk CFD — Core Trading Principle

## THE ONLY PRINCIPLE

**Trading is about performing and executing the plan every time, regardless of what happened.**

This is the foundational principle that governs every component of this system. No exceptions. No hesitation. No second-guessing after the fact.

---

## What This Means for the System

### 1. **The Plan is Supreme**

- Once a trading plan is created (via Story Position, CMS analysis, or Desk consensus), it MUST be executed
- Past losses, past wins, streaks, emotions, fear, greed — NONE of these matter
- The plan was created based on data, analysis, and strategy. That's what we trust.

### 2. **Execution Over Everything**

The system's job is NOT to:
- Question the plan after it's made
- Wait for "better conditions"
- Skip trades because the last one lost
- Get excited and over-leverage because the last one won

The system's job IS to:
- Execute the plan exactly as specified
- Follow position sizing rules (risk management is PART of the plan)
- Enter at the planned price/time
- Exit at the planned stops/targets
- Do this EVERY SINGLE TIME without deviation

### 3. **Discipline = Edge**

- Most traders fail because they can't execute their own plans consistently
- We have algorithms, AI agents, and automation specifically to REMOVE human interference
- The edge isn't just in the analysis — it's in the ability to execute without emotion

---

## How This Applies to Each Component

### **Story Pipeline** (`lib/story/pipeline.ts`)
- Generates episodes with clear trade plans (entry, stop, targets)
- Once an episode is marked `position_entry`, the plan exists
- The user's job: execute it or skip it (but skipping must be intentional, not fear-based)

### **Story Positions** (`story_positions` table)
- When a position is created with `planned_entry`, `stop_loss`, `take_profit` — that's the plan
- When the user clicks "Activate Position", the system MUST execute via OANDA API
- No "let me wait and see" — the plan was already made

### **The Desk** (Marcus, Sarah, Ray, Alex)
- The Desk analyzes, debates, scores scenarios
- Once consensus is reached (score ≥ 70), that's a green light
- The Desk doesn't get to back out later — they made their call

### **CMS Engine** (`lib/cms/condition-engine.ts`)
- Identifies patterns programmatically (AMD, fractals, liquidity, etc.)
- When multiple patterns converge → that's a signal
- Signals must be acted on, not ignored because "it feels risky"

### **Risk Management** (`risk_rules` table)
- Max position size, max daily loss, max drawdown — these are PART OF THE PLAN
- Risk rules ensure we can execute every trade without blowing up
- They don't exist to stop us from trading — they exist to let us trade fearlessly

### **Trade Execution** (`/api/trade/execute-planned`)
- Takes a `story_position` and executes it via OANDA
- This is the moment of truth: plan → reality
- No delays, no "let me think about it" — the thinking was already done

---

## The Enemy: Discretionary Override

The biggest threat to this system is **discretionary override after the plan is made**.

Examples of what NOT to do:
- "This trade looks good, but the market feels shaky today" → NO. Execute the plan.
- "I lost the last 3 trades, maybe I should skip this one" → NO. Losing streaks are normal. Execute the plan.
- "I won big yesterday, let me double my position size" → NO. Follow the plan.
- "The news just came out, let me wait" → NO. The plan accounted for volatility. Execute.

---

## The Truth About Trading

1. **No one knows what will happen next**
   - Not Marcus, not DeepSeek, not the CMS engine, not you
   - The plan is our best educated guess based on data
   - Individual trades are probabilistic — we need volume and consistency to win

2. **Edge comes from repetition**
   - A strategy with 55% win rate and 1.5 R:R is profitable OVER TIME
   - But only if you execute EVERY trade
   - Skipping trades based on fear destroys the edge

3. **Discipline is measurable**
   - Did you execute the plan? Yes or no.
   - There's no "I kind of executed it"
   - This system exists to make discipline automatic

---

## Implementation Checklist

### ✅ System Already Enforces This:
- Story positions have clear `planned_entry`, `stop_loss`, `take_profit`
- `/api/story/positions/[id]/activate` executes the plan
- `/api/trade/execute-planned` connects story positions to OANDA
- Risk rules prevent over-leverage (discipline is built-in)
- Desk scoring creates objective thresholds for action

### 🎯 Where to Strengthen:
- **Eliminate friction**: Make execution one-click from Story Position page
- **Track execution rate**: Log every time a plan is created vs. executed
- **Dashboard metric**: "Plan Execution Rate" = executed trades / planned trades
- **AI prompts**: Remind all agents that their job is to CREATE PLANS, not to hedge or equivocate
- **User mindset**: The system UI should frame execution as inevitable, not optional

---

## The Contract

**When you use this system, you're making a deal:**

1. **The system will create plans** based on:
   - Technical analysis (indicators, patterns, fractals)
   - Fundamental context (news, market structure)
   - Risk management (position sizing, stops)
   - Multi-agent consensus (Desk scores)

2. **Your job is to execute those plans** without:
   - Second-guessing
   - Fear of loss
   - Greed after wins
   - Waiting for "perfect" setups

3. **The system will track everything**:
   - Every plan created
   - Every plan executed (or skipped)
   - Win rate, R:R, drawdown, recovery
   - The data will show if the plan works

4. **Trust the process**:
   - If the plan consistently loses, we adjust the STRATEGY (indicators, thresholds, risk rules)
   - We DON'T adjust execution — execution must remain mechanical

---

## Final Word

**"The plan is the plan. Execute it."**

This is not about being reckless. Risk management is PART of the plan. Stops are PART of the plan. Position sizing is PART of the plan.

This is about removing the one variable that destroys most traders: **inconsistency**.

The market will do what it does. We can't control that.

But we CAN control whether we execute our own plan.

And that's where the edge is.

---

**Updated**: 2026-04-02
**Applies to**: All AI agents, all trade execution flows, all system components
**Non-negotiable**: Yes
