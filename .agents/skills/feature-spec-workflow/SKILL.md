---
name: feature-spec-workflow
description: Structured feature implementation loop. Use this when adding any new feature to enforce a spec-first workflow with zero ambiguity.
metadata:
  version: "1.0.0"
---

# /feature — Spec-First Feature Implementation

You are now in **Feature Spec Mode**. Do NOT write any code yet. Follow this loop exactly:

## Phase 0: System Understanding (MANDATORY)

Before generating any spec, you MUST:

1. **Read `CONTEXT.md`** at the project root — understand the full system architecture, existing pages, API routes, AI pipeline, database tables, and deployment config.
2. **Check for conflicts** — verify the feature doesn't duplicate existing functionality listed in CONTEXT.md.
3. **Identify integration points** — note which existing modules this feature touches.

Do NOT proceed to Phase 1 until you have read CONTEXT.md.

## Phase 1: Spec Generation

Based on the user's feature request, produce a **Feature Spec** document with ALL of the following sections. Every section is mandatory — do not skip any.

### Required Spec Sections

**1. Goal**
One paragraph. No ambiguity. State exactly what this feature does, who it's for, and why it exists.

**2. What to Build**
Specific enough that no architectural decisions remain. Break into numbered steps. Each step is a concrete action, not a vague directive.

**3. File Paths**
Exact file paths for every file that will be created or modified. Use the full path from project root. Format:
- `CREATE: app/(dashboard)/feature/page.tsx`
- `MODIFY: lib/ai/client.ts` — add X function
- `MODIFY: app/(dashboard)/_components/DashboardShell.tsx` — add nav entry

**4. Function Signatures**
TypeScript interfaces, type definitions, and function signatures for all new functions/components. Include parameter types and return types. Example:
```typescript
interface FeatureProps {
  pair: string;
  timeframe: Timeframe;
}
export async function doThing(input: FeatureInput): Promise<FeatureOutput>
```

**5. Database Schema**
Exact SQL for any new tables, columns, indexes, or RLS policies. If no DB changes needed, explicitly state "No database changes required." Example:
```sql
CREATE TABLE feature_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE feature_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own data" ON feature_data FOR ALL USING (auth.uid() = user_id);
```

**6. Technology Choices**
One technology per choice. No "you could use X or Y". Be decisive. Example:
- Image processing: Sharp
- State management: React useState + useReducer
- API calls: fetch via Next.js route handler

**7. Security Checklist**
Verify each item applies and document how it's handled:
- [ ] **Auth**: API route uses `supabase.auth.getUser()` (or explain why public)
- [ ] **RLS**: New tables have `auth.uid() = user_id` policy enabled
- [ ] **Input validation**: User inputs validated/sanitized before use
- [ ] **Rate limiting**: AI calls respect 5/hour limit (or explain why exempt)
- [ ] **Pair validation**: Pairs checked against `VALID_PAIRS` whitelist
- [ ] **No client secrets**: API keys only used server-side

**8. Deployment Awareness**
- [ ] **New env vars?** List any new environment variables needed on Railway
- [ ] **New cron job?** Needs `CRON_SECRET` auth + schedule configured
- [ ] **DB migration?** Will be applied via Supabase MCP
- [ ] **Breaking change?** Note if existing API contracts change

**9. Test Scenarios**
Since this project uses `npm run build` as verification, list concrete scenarios to manually verify AND the build check. Example:
- Navigate to /feature → page renders without errors
- Click "Generate" with no pair selected → shows validation error
- Submit valid data → API returns 200, result displays correctly
- `npm run build` passes with zero errors

**10. Out of Scope**
Explicitly list what this feature does NOT include. This prevents gold-plating. Example:
- No caching layer for V1
- No mobile-specific layout
- No analytics tracking
- No admin panel

**11. MEMORY.md Update**
Exact text to append to the project's MEMORY.md after completion. Keep it concise — 2-5 lines max. Example:
```
## Feature Name
- Description: One-line summary
- Files: key file paths
- API: endpoint if applicable
```

**12. Acceptance Criteria**
Numbered checklist. The LAST item is always:
- [ ] `npm run build` passes with zero errors

## Phase 2: User Review

After generating the spec, present it to the user and ask:
- "Does this spec look correct? Should I proceed with implementation, or do you want to adjust anything?"

Do NOT proceed to Phase 3 until the user explicitly approves.

## Phase 3: Implementation

Once approved:
1. Create a task list from the spec's "What to Build" steps
2. Apply database migrations first (if any)
3. Implement files in dependency order (types → utils → API → components → pages)
4. After all code is written, run `npm run build` to verify
5. If build fails, fix errors and re-run until it passes
6. Update MEMORY.md with the exact text from the spec
7. Update CONTEXT.md if the feature adds new pages, API routes, tables, or cron jobs
8. Report completion with a summary of what was built

## Rules

- NEVER skip the spec. Even for "simple" features, write the spec first.
- NEVER make architectural decisions not in the spec. If something is ambiguous, ask the user.
- NEVER add features beyond what the spec lists. Check "Out of Scope" before every decision.
- If the user says "just do it" or "skip the spec", remind them this loop exists to prevent rework and ask them to confirm they want to bypass it.
- All database tables MUST have RLS enabled with `auth.uid() = user_id` policies.
- All API routes MUST authenticate via `supabase.auth.getUser()`.
- Follow existing project patterns from MEMORY.md (Tailwind, Lucide icons, etc.).
