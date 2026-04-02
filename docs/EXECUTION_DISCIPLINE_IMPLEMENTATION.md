# Execution Discipline Implementation Plan

**Goal**: Ensure every component of TradeDesk CFD reinforces the core principle:
*"Execute the plan every time, regardless of what happened."*

---

## 1. AI Agent Prompts (Add Execution Discipline Context)

### Files to Update:

#### **Gemini (Structural Analysis)** - `lib/story/gemini-analysis.ts`
Add to system prompt:
```
YOUR PRIMARY JOB: Create clear, executable trade plans.
- Every analysis must end with: entry price, stop loss, take profit
- Do NOT hedge with "might", "could", "possibly" — commit to the plan
- The user will execute your plan mechanically — make it actionable
```

#### **DeepSeek (Quantitative Analysis)** - `lib/story/deepseek-analysis.ts`
Add to system prompt:
```
YOUR PRIMARY JOB: Provide precise, actionable trade parameters.
- Calculate exact entry zones, stop loss, take profit based on indicators
- Do NOT equivocate — the plan will be executed as stated
- Include position size recommendation based on risk rules
```

#### **Claude (Narrative Synthesis)** - `lib/story/claude-synthesis.ts`
Add to system prompt:
```
YOUR PRIMARY JOB: Synthesize analysis into a compelling execution plan.
- Make the plan feel inevitable, not optional
- Emphasize: "This is the setup. This is the plan. Execute it."
- Do NOT introduce doubt or hesitation in the narrative
```

#### **Desk Morning Meeting** - `lib/desk/morning-meeting.ts`
Add to system prompt (all agents):
```
REMEMBER: Your job is to CREATE PLANS, not to waffle.
- Score scenarios objectively (0-100)
- Scores ≥70 = Execute. No "but maybe wait"
- Past wins/losses are irrelevant to today's plan
```

#### **Desk Trade Review** - `lib/desk/trade-review.ts`
Add to system prompt:
```
EVALUATE: Did we execute the plan? (Yes/No)
- If yes + loss: Normal. Variance. Move on.
- If yes + win: Normal. Variance. Move on.
- If no: Why not? That's the only thing that matters.
```

---

## 2. Database Schema Additions

### New Table: `plan_execution_log`

Track every plan created vs. executed:

```sql
CREATE TABLE plan_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- What was the plan?
    story_position_id UUID REFERENCES story_positions(id),
    pair VARCHAR(10) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'long' | 'short'
    planned_entry DECIMAL(10,5) NOT NULL,
    stop_loss DECIMAL(10,5) NOT NULL,
    take_profit DECIMAL(10,5) NOT NULL,
    position_size DECIMAL(10,2) NOT NULL,

    -- Was it executed?
    execution_status VARCHAR(20) NOT NULL, -- 'executed' | 'skipped' | 'pending'
    executed_at TIMESTAMPTZ,
    skipped_reason TEXT,
    oanda_trade_id VARCHAR(50),

    -- Timestamps
    plan_created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plan_execution_log_user ON plan_execution_log(user_id);
CREATE INDEX idx_plan_execution_log_status ON plan_execution_log(execution_status);
```

### New Column: `story_positions.execution_logged`

```sql
ALTER TABLE story_positions ADD COLUMN execution_logged BOOLEAN DEFAULT FALSE;
```

---

## 3. API Endpoints to Update

### **`/api/story/positions/[id]/activate`** (Already exists)
Add logging:
```typescript
// After successful trade execution
await supabase.from('plan_execution_log').insert({
    user_id: user.id,
    story_position_id: position.id,
    pair: position.pair,
    direction: position.direction,
    planned_entry: position.planned_entry,
    stop_loss: position.stop_loss,
    take_profit: position.take_profit,
    position_size: position.position_size,
    execution_status: 'executed',
    executed_at: new Date().toISOString(),
    oanda_trade_id: tradeResult.tradeId
})
```

### **New Endpoint: `/api/story/positions/[id]/skip`**
Allow users to explicitly skip a plan (with reason):
```typescript
POST /api/story/positions/[id]/skip
Body: { reason: string }

// Log the skip
await supabase.from('plan_execution_log').insert({
    user_id: user.id,
    story_position_id: position.id,
    execution_status: 'skipped',
    skipped_reason: body.reason,
    ...position details
})
```

### **New Endpoint: `/api/execution/stats`**
Return execution discipline metrics:
```typescript
GET /api/execution/stats

Response:
{
    total_plans: 45,
    executed: 38,
    skipped: 7,
    execution_rate: 84.4, // %

    // Breakdown by outcome
    executed_wins: 20,
    executed_losses: 18,
    win_rate: 52.6, // % (only executed trades)

    // Skipped analysis
    most_common_skip_reasons: [
        { reason: "Market felt risky", count: 3 },
        { reason: "Recent losing streak", count: 2 }
    ]
}
```

---

## 4. UI/UX Changes

### **Story Position Page** (`app/(dashboard)/story/[pair]/page.tsx`)

#### Current:
- "Activate Position" button (good!)

#### Add:
- **One-click execution**: No extra confirmation modal
- **Execution countdown**: "Plan expires in 4h" (create urgency)
- **Execution banner**: "This is the plan. Your job is to execute it."
- **Skip button** (explicit, requires reason):
  ```
  [Execute Plan] [Skip (with reason)]
  ```

### **New Dashboard Widget: Execution Discipline**

Location: Main dashboard (`/`)

Shows:
```
📊 Execution Discipline
━━━━━━━━━━━━━━━━━━━━
Plans Created:    45
Plans Executed:   38
Execution Rate:   84% ⚠️  (Target: 95%+)

Last 7 Days:
Mon: 5/5 ✅
Tue: 4/4 ✅
Wed: 2/4 ⚠️  (Skipped 2)
Thu: 3/3 ✅
Fri: 1/1 ✅
Sat: -
Sun: -

Why I'm skipping:
- "Market felt risky" (3x)
- "Recent losses" (2x)

💡 Reminder: Edge = Consistency. Execute the plan.
```

### **Settings Page** (`/settings`)

Add section:
```
🎯 Execution Discipline

□ Auto-execute plans (coming soon)
□ Require skip reason
□ Daily execution report (Telegram)
□ Weekly discipline review (AI Desk)

Target Execution Rate: [95]%
Alert me if below: [90]%
```

---

## 5. Cron Jobs

### **New Job: Daily Execution Report**

File: `app/api/cron/daily-execution-report/route.ts`

Schedule: Every day at 5pm (after market close)

Logic:
1. Query `plan_execution_log` for today's plans
2. Calculate execution rate
3. If below target (95%), send Telegram alert:
   ```
   📉 Execution Discipline Alert

   Today: 3/5 plans executed (60%)
   Target: 95%+

   You skipped:
   - EUR/USD long (reason: "felt risky")
   - GBP/USD short (reason: "recent losses")

   Remember: The plan was already made. Trust it.
   ```

### **New Job: Weekly Discipline Review**

File: `app/api/cron/weekly-discipline-review/route.ts`

Schedule: Every Sunday at 8pm

Logic:
1. Query last 7 days of execution data
2. Generate AI Desk review (Marcus, Sarah, Ray, Alex discuss)
3. Focus: "Are we executing plans? If not, why?"
4. Save to `desk_messages` as special "Discipline Review" type

---

## 6. Risk Rules Integration

### Update: `risk_rules` table logic

Execution discipline is PART OF risk management:

Add new rule type: `execution_discipline`

```sql
INSERT INTO risk_rules (user_id, rule_type, threshold_value, is_active) VALUES
(user_id, 'execution_discipline', 90, true); -- 90% execution rate minimum
```

In `/api/risk/validate`:
```typescript
// Check execution rate over last 30 days
const executionRate = await getExecutionRate(user.id, 30)

if (executionRate < executionRateRule.threshold_value) {
    warnings.push({
        rule: 'Execution Discipline',
        message: `Execution rate: ${executionRate}% (target: ${threshold}%+)`,
        severity: 'warning'
    })
}
```

---

## 7. Desk Agent Behavior

### Morning Meeting (`/api/desk/meeting`)
- Add execution rate as context:
  ```
  "User's execution rate last 30 days: 78% (below target)"
  ```
- Agents should reference this:
  ```
  Marcus: "Look, you've been skipping plans. That's the real problem.
           Not the strategy — the execution. Let's fix that first."
  ```

### Trade Review (`/api/desk/review`)
- Primary question: "Did you execute the plan?"
- If skipped: agents should be direct:
  ```
  Sarah: "You skipped this because 'market felt risky.' But the plan
          accounted for risk. That's why we have stops. This is exactly
          the kind of discretionary override that destroys edge."
  ```

---

## 8. Testing & Validation

### Manual Testing Checklist:
1. ✅ Create a story position with plan
2. ✅ Execute it → verify `plan_execution_log` entry created
3. ✅ Skip a plan → verify skip logged with reason
4. ✅ Check dashboard shows execution rate
5. ✅ Check Desk meeting references execution rate
6. ✅ Trigger daily execution report cron (test mode)

### Metrics to Track:
- **Primary**: Execution rate (target 95%+)
- **Secondary**: Win rate (only on executed trades)
- **Diagnostic**: Most common skip reasons

---

## 9. Documentation Updates

### Files to Update:

1. **CONTEXT.md** - Add section:
   ```
   ## Execution Discipline System
   - All plans logged in `plan_execution_log`
   - Execution rate tracked (target: 95%+)
   - Skips require explicit reason
   - Dashboard shows execution metrics
   ```

2. **HOW-IT-WORKS.md** - Add:
   ```
   ## The Execution Loop
   1. AI generates plan (Gemini + DeepSeek + Claude)
   2. Plan stored in `story_positions`
   3. User executes (one-click) → logged as 'executed'
   4. OR: User skips (with reason) → logged as 'skipped'
   5. Daily/weekly reviews check execution rate
   6. Desk agents coach on discipline
   ```

3. **README.md** - Add badge:
   ```
   🎯 Built on discipline: Plans → Execution → Results
   ```

---

## 10. Priority Implementation Order

### Phase 1 (Core Tracking) - **Do This First**
1. Create `plan_execution_log` table
2. Update `/api/story/positions/[id]/activate` to log executions
3. Create `/api/story/positions/[id]/skip` endpoint
4. Create `/api/execution/stats` endpoint
5. Add dashboard execution widget

### Phase 2 (AI Reinforcement)
6. Update all AI agent prompts (Gemini, DeepSeek, Claude, Desk)
7. Update Desk morning meeting to include execution context
8. Update Desk trade review to focus on execution

### Phase 3 (Automation)
9. Create daily execution report cron
10. Create weekly discipline review cron
11. Add execution rate to risk rules validation

### Phase 4 (Polish)
12. Add one-click execution UX improvements
13. Add Telegram alerts for low execution rate
14. Add settings page execution discipline section

---

## Expected Outcome

After implementation:
- **Every plan is tracked**: No ambiguity about what was planned vs. executed
- **Execution rate is visible**: User can't ignore it
- **AI agents reinforce discipline**: Desk coaches on execution, not just analysis
- **Friction is minimized**: One-click execution, no extra confirmations
- **Accountability is built-in**: Skip requires reason, logged and reviewed

**The system becomes a discipline machine, not just an analysis machine.**

---

**Created**: 2026-04-02
**Owner**: Entire TradeDesk CFD system
**Status**: Ready for implementation
