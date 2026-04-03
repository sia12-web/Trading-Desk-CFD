import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentPrices, getCandles } from '@/lib/oanda/client'
import { updateScenarioStatus, deactivateSiblingScenarios } from '@/lib/data/stories'
import { createTask } from '@/lib/background-tasks/manager'
import { notifyUser } from '@/lib/notifications/notifier'
import { generateStory } from './pipeline'
import type { SupabaseClient } from '@supabase/supabase-js'

interface MonitorableScenario {
    id: string
    user_id: string
    pair: string
    title: string
    direction: string
    trigger_level: number
    trigger_direction: 'above' | 'below'
    trigger_timeframe: 'H1' | 'H4' | 'D' | null
    invalidation_level: number
    invalidation_direction: 'above' | 'below'
    episode_id: string
    probability: number
}

interface MonitorResult {
    checked: number
    triggered: number
    invalidated: number
    siblingsDeactivated: number
    generationsQueued: number
    skippedBusy: number
    skippedCooldown: number
    skippedInvalidSetup: number
    skippedMarketClosed: boolean
}

// Minimum distance between trigger and invalidation (0.1 pip for forex, 1 point for indices)
const MIN_RANGE_PIPS = 0.00010

// Cooldown: minimum time between bot-generated episodes per pair (30 minutes)
const EPISODE_COOLDOWN_MS = 30 * 60 * 1000

// Map our timeframe labels to OANDA granularities
const TIMEFRAME_TO_GRANULARITY: Record<string, string> = {
    H1: 'H1',
    H4: 'H4',
    D: 'D',
}

/**
 * Check if the market is currently open (OANDA hours).
 * OANDA forex + CFD indices: Sunday 10PM UTC → Friday 10PM UTC
 */
export function isMarketOpen(): boolean {
    const now = new Date()
    const day = now.getUTCDay() // 0=Sun, 6=Sat
    const hour = now.getUTCHours()

    // Saturday: always closed
    if (day === 6) return false
    // Sunday: only open after 10PM UTC
    if (day === 0 && hour < 22) return false
    // Friday: closed after 10PM UTC
    if (day === 5 && hour >= 22) return false

    return true
}

/**
 * Validate a scenario's levels are internally consistent.
 * Returns false if levels are malformed (zero range, wrong direction, etc.)
 */
function isValidScenario(scenario: MonitorableScenario): boolean {
    const range = Math.abs(scenario.trigger_level - scenario.invalidation_level)

    // Zero or near-zero range: would cause infinite triggers
    if (range < MIN_RANGE_PIPS) {
        console.error(`[ScenarioMonitor] INVALID scenario ${scenario.id}: range too small (${range.toFixed(6)})`)
        return false
    }

    // Direction consistency check
    if (scenario.trigger_direction === 'above' && scenario.trigger_level <= scenario.invalidation_level) {
        console.error(`[ScenarioMonitor] INVALID scenario ${scenario.id}: trigger_direction=above but trigger (${scenario.trigger_level}) <= invalidation (${scenario.invalidation_level})`)
        return false
    }
    if (scenario.trigger_direction === 'below' && scenario.trigger_level >= scenario.invalidation_level) {
        console.error(`[ScenarioMonitor] INVALID scenario ${scenario.id}: trigger_direction=below but trigger (${scenario.trigger_level}) >= invalidation (${scenario.invalidation_level})`)
        return false
    }

    return true
}

/**
 * Fetch all active scenarios that have structured monitoring levels.
 */
async function getMonitorableScenarios(client: SupabaseClient): Promise<MonitorableScenario[]> {
    const { data, error } = await client
        .from('story_scenarios')
        .select('id, user_id, pair, title, direction, trigger_level, trigger_direction, trigger_timeframe, invalidation_level, invalidation_direction, episode_id, probability')
        .eq('status', 'active')
        .eq('monitor_active', true)
        .not('trigger_level', 'is', null)
        .not('invalidation_level', 'is', null)

    if (error) {
        console.error('[ScenarioMonitor] Failed to fetch scenarios:', error.message)
        return []
    }

    return (data || []) as MonitorableScenario[]
}

/**
 * Check if a candle close has crossed a scenario's trigger or invalidation level.
 * Uses candle CLOSE price, not spot price — prevents false triggers from wicks.
 *
 * HIGH-CONFIDENCE OPTIMIZATION:
 * For scenarios with probability >= 55%, we allow triggering at 85% proximity
 * to avoid missing good entries. Conservative approach remains for low-confidence scenarios.
 *
 * PROXIMITY MATH (unified for both directions):
 *   progress = how far price has moved FROM invalidation TOWARD trigger
 *   progressPct = progress / totalRange (0.0 = at invalidation, 1.0 = at trigger)
 *   if progressPct >= threshold → trigger
 */
function evaluateScenario(
    scenario: MonitorableScenario,
    closePrice: number
): { result: 'triggered' | 'invalidated' | null; progressPct: number } {
    const isHighConfidence = scenario.probability >= 0.55
    const proximityThreshold = isHighConfidence ? 0.85 : 1.0

    const totalRange = Math.abs(scenario.trigger_level - scenario.invalidation_level)

    // ── Calculate progress toward trigger (direction-aware) ──
    let progressPct: number
    if (scenario.trigger_direction === 'above') {
        // Bullish: invalidation is below, trigger is above
        // progress = how far above invalidation we are
        progressPct = (closePrice - scenario.invalidation_level) / totalRange
    } else {
        // Bearish: invalidation is above, trigger is below
        // progress = how far below invalidation we are
        progressPct = (scenario.invalidation_level - closePrice) / totalRange
    }

    // Clamp to reasonable range for logging
    progressPct = Math.max(-0.5, Math.min(1.5, progressPct))

    // ── Check trigger ──
    if (progressPct >= proximityThreshold) {
        return { result: 'triggered', progressPct }
    }

    // ── Check invalidation (always at 0% — price crossed wrong way) ──
    if (progressPct <= 0) {
        // Price is at or past invalidation level
        if (scenario.invalidation_direction === 'above' && closePrice >= scenario.invalidation_level) {
            return { result: 'invalidated', progressPct }
        }
        if (scenario.invalidation_direction === 'below' && closePrice <= scenario.invalidation_level) {
            return { result: 'invalidated', progressPct }
        }
    }

    return { result: null, progressPct }
}

/**
 * Check if a story_generation task is already running for this user+pair.
 * Prevents duplicate generation when scenarios resolve rapidly.
 */
async function isGenerationAlreadyRunning(
    client: SupabaseClient,
    userId: string,
    pair: string
): Promise<boolean> {
    const { data: tasks } = await client
        .from('background_tasks')
        .select('id, metadata')
        .eq('user_id', userId)
        .eq('task_type', 'story_generation')
        .in('status', ['pending', 'running'])

    return (tasks || []).some(t => {
        const meta = t.metadata as Record<string, unknown> | null
        return meta?.pair === pair
    })
}

/**
 * Check if a bot-generated episode was created recently for this pair.
 * Prevents infinite trigger loops in volatile markets.
 */
async function isInCooldownPeriod(
    client: SupabaseClient,
    userId: string,
    pair: string
): Promise<boolean> {
    const cutoff = new Date(Date.now() - EPISODE_COOLDOWN_MS).toISOString()

    const { data } = await client
        .from('story_episodes')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('pair', pair)
        .in('generation_source', ['bot', 'cron'])
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)

    return (data?.length ?? 0) > 0
}

/**
 * Fetch the latest CLOSED candle's close price for a given pair and timeframe.
 * Returns null if the candle data can't be fetched.
 */
async function getLatestCandleClose(
    instrument: string,
    timeframe: string
): Promise<{ close: number; time: string } | null> {
    const granularity = TIMEFRAME_TO_GRANULARITY[timeframe]
    if (!granularity) return null

    const { data: candles, error } = await getCandles({
        instrument,
        granularity,
        count: 2,  // Get 2 to ensure we have the latest COMPLETED candle
        price: 'M',
    })

    if (error || !candles?.length) return null

    // Find the latest completed candle (complete: true)
    const completedCandle = candles
        .filter(c => c.complete)
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0]

    if (!completedCandle) return null

    return {
        close: parseFloat(completedCandle.mid.c),
        time: completedCandle.time,
    }
}

/**
 * Main orchestrator: check all monitorable scenarios against candle closes.
 * Uses candle close prices (not spot) to prevent false triggers from wicks.
 *
 * Safety features:
 * - Range validation: rejects zero-range scenarios
 * - Direction validation: rejects inconsistent trigger/invalidation directions
 * - Per-pair dedup: only triggers the HIGHEST-probability scenario per pair per run
 * - Episode cooldown: prevents infinite trigger loops (30-minute cooldown)
 * - Candle close only: both triggers AND invalidations use candle close (no spot)
 *
 * Lifecycle: When one scenario triggers, its sibling is auto-invalidated,
 * and a new episode is queued (passing the triggered scenario context).
 */
export async function runScenarioMonitor(): Promise<MonitorResult> {
    const result: MonitorResult = {
        checked: 0,
        triggered: 0,
        invalidated: 0,
        siblingsDeactivated: 0,
        generationsQueued: 0,
        skippedBusy: 0,
        skippedCooldown: 0,
        skippedInvalidSetup: 0,
        skippedMarketClosed: false,
    }

    // Guard: market must be open
    if (!isMarketOpen()) {
        result.skippedMarketClosed = true
        console.log('[ScenarioMonitor] Market closed, skipping.')
        return result
    }

    const client = createServiceClient()
    const scenarios = await getMonitorableScenarios(client)

    if (scenarios.length === 0) {
        console.log('[ScenarioMonitor] No monitorable scenarios found.')
        return result
    }

    result.checked = scenarios.length

    // Group scenarios by pair+timeframe for efficient candle fetching
    const pairTimeframeMap = new Map<string, MonitorableScenario[]>()
    for (const s of scenarios) {
        const tf = s.trigger_timeframe || 'H1'
        const key = `${s.pair}|${tf}`
        if (!pairTimeframeMap.has(key)) {
            pairTimeframeMap.set(key, [])
        }
        pairTimeframeMap.get(key)!.push(s)
    }

    // Fetch candle closes for each pair+timeframe combo
    const closePriceMap = new Map<string, { close: number; time: string }>()
    const fetchPromises = Array.from(pairTimeframeMap.keys()).map(async (key) => {
        const [pair, timeframe] = key.split('|')
        const instrument = pair.replace('/', '_')

        const candleData = await getLatestCandleClose(instrument, timeframe)
        if (candleData) {
            closePriceMap.set(key, candleData)
        }
    })
    await Promise.all(fetchPromises)

    // Track which user+pair combos need new episodes (with triggered context)
    // KEY SAFETY: only ONE trigger per user+pair per run (highest probability wins)
    const generationQueue = new Map<string, {
        userId: string
        pair: string
        triggeredScenarioId: string
        triggeredEpisodeId: string
        isInvalidation: boolean
        probability: number
    }>()

    // Evaluate each scenario against its timeframe's candle close
    for (const scenario of scenarios) {
        // ── GUARD: Validate scenario levels ──
        if (!isValidScenario(scenario)) {
            result.skippedInvalidSetup++
            // Auto-invalidate broken scenarios so they don't block forever
            try {
                await updateScenarioStatus(
                    scenario.id,
                    'invalidated',
                    'System: auto-invalidated due to invalid level configuration (zero range or direction mismatch)',
                    'bot',
                    client
                )
            } catch (err) {
                console.error(`[ScenarioMonitor] Failed to auto-invalidate ${scenario.id}:`, err instanceof Error ? err.message : err)
            }
            continue
        }

        const tf = scenario.trigger_timeframe || 'H1'
        const key = `${scenario.pair}|${tf}`
        const candleData = closePriceMap.get(key)

        // Use candle close for BOTH triggers AND invalidations (consistent)
        const closePrice = candleData?.close
        if (closePrice == null) {
            // No candle data available — log but don't silently skip
            console.warn(`[ScenarioMonitor] No candle data for ${scenario.pair} ${tf} — skipping scenario "${scenario.title}"`)
            continue
        }

        // Evaluate against candle close only (no spot price fallback)
        const { result: evaluation, progressPct } = evaluateScenario(scenario, closePrice)

        if (!evaluation) continue

        // Resolve the scenario
        const candleTimeStr = candleData?.time ? ` (candle: ${new Date(candleData.time).toISOString()})` : ''
        const isHighConfidence = scenario.probability >= 0.55
        const isProximityTrigger = evaluation === 'triggered' && progressPct < 1.0 && isHighConfidence

        const outcomeNotes = evaluation === 'triggered'
            ? isProximityTrigger
                ? `Bot detected: ${tf} candle close at ${closePrice.toFixed(5)} reached ${Math.round(progressPct * 100)}% proximity to trigger level ${scenario.trigger_level.toFixed(5)} (${scenario.trigger_direction}). High-confidence scenario (${Math.round(scenario.probability * 100)}%) triggered early to avoid missing entry.${candleTimeStr}`
                : `Bot detected: ${tf} candle close at ${closePrice.toFixed(5)} confirmed trigger level ${scenario.trigger_level.toFixed(5)} (${scenario.trigger_direction})${candleTimeStr}`
            : `Bot detected: ${tf} candle close at ${closePrice.toFixed(5)} crossed invalidation level ${scenario.invalidation_level.toFixed(5)} (${scenario.invalidation_direction}). Progress was ${Math.round(progressPct * 100)}% toward trigger.${candleTimeStr}`

        try {
            await updateScenarioStatus(
                scenario.id,
                evaluation,
                outcomeNotes,
                'bot',
                client
            )

            // Binary pair logic: deactivate sibling scenario from the same episode
            const siblingCount = await deactivateSiblingScenarios(scenario.id, scenario.episode_id, client)
            result.siblingsDeactivated += siblingCount
            if (siblingCount > 0) {
                console.log(`[ScenarioMonitor] Deactivated ${siblingCount} sibling scenario(s) for episode ${scenario.episode_id}`)
            }

            // Notify user with timeframe context
            const triggerDetail = evaluation === 'triggered'
                ? isProximityTrigger
                    ? `${tf} candle at ${closePrice.toFixed(5)} — ${Math.round(progressPct * 100)}% toward trigger ${scenario.trigger_level.toFixed(5)} (high-confidence early trigger)`
                    : `${tf} candle closed ${scenario.trigger_direction} ${scenario.trigger_level.toFixed(5)} at ${closePrice.toFixed(5)}`
                : `${tf} candle at ${closePrice.toFixed(5)} crossed invalidation ${scenario.invalidation_level.toFixed(5)} (${scenario.invalidation_direction})`

            await notifyUser(scenario.user_id, {
                title: `${evaluation === 'triggered' ? 'Scenario Triggered' : 'Scenario Invalidated'}: ${scenario.pair}`,
                body: `${scenario.title}\n\n${triggerDetail}\n\nThe Desk is reviewing this for you.`,
                url: `/story/${scenario.pair.replace('/', '-')}`
            }, client)

            if (evaluation === 'triggered') {
                result.triggered++

                // Post a desk alert message for the triggered scenario
                await client.from('desk_messages').insert({
                    user_id: scenario.user_id,
                    speaker: 'sarah',
                    message: `SCENARIO TRIGGERED: ${scenario.pair} — "${scenario.title}". ${tf} candle closed ${scenario.trigger_direction} ${scenario.trigger_level.toFixed(5)} at ${closePrice.toFixed(5)}. Review your position sizing before entry.`,
                    message_type: 'alert',
                    context_data: {
                        scenario_id: scenario.id,
                        pair: scenario.pair,
                        trigger_level: scenario.trigger_level,
                        trigger_timeframe: tf,
                        close_price: closePrice,
                        proximity_pct: Math.round(progressPct * 100),
                    },
                })

                // Queue generation — only highest-probability scenario per user+pair
                const queueKey = `${scenario.user_id}:${scenario.pair}`
                const existing = generationQueue.get(queueKey)
                if (!existing || scenario.probability > existing.probability) {
                    generationQueue.set(queueKey, {
                        userId: scenario.user_id,
                        pair: scenario.pair,
                        triggeredScenarioId: scenario.id,
                        triggeredEpisodeId: scenario.episode_id,
                        isInvalidation: false,
                        probability: scenario.probability,
                    })
                }
            } else {
                result.invalidated++
                // Queue generation for INVALIDATED scenarios too (Narrative Reset)
                const queueKey = `${scenario.user_id}:${scenario.pair}`
                if (!generationQueue.has(queueKey)) {
                    generationQueue.set(queueKey, {
                        userId: scenario.user_id,
                        pair: scenario.pair,
                        triggeredScenarioId: scenario.id,
                        triggeredEpisodeId: scenario.episode_id,
                        isInvalidation: true,
                        probability: scenario.probability,
                    })
                }
                // NOTE: triggers always take priority over invalidations via probability comparison above
            }

            console.log(`[ScenarioMonitor] ${scenario.pair} "${scenario.title}" → ${evaluation} via ${tf} candle close at ${closePrice.toFixed(5)} (progress: ${Math.round(progressPct * 100)}%)`)
        } catch (error) {
            console.error(`[ScenarioMonitor] Failed to resolve ${scenario.id}:`, error instanceof Error ? error.message : error)
        }
    }

    // Queue new episode generation for triggered scenarios (fire-and-forget)
    for (const [queueKey, item] of generationQueue) {
        try {
            // Guard: don't queue if a generation is already running for this pair
            const busy = await isGenerationAlreadyRunning(client, item.userId, item.pair)
            if (busy) {
                result.skippedBusy++
                console.log(`[ScenarioMonitor] ${item.pair} generation skipped (already running)`)
                continue
            }

            // Guard: episode cooldown to prevent infinite loops
            const inCooldown = await isInCooldownPeriod(client, item.userId, item.pair)
            if (inCooldown) {
                result.skippedCooldown++
                console.log(`[ScenarioMonitor] ${item.pair} generation skipped (cooldown: episode generated <${EPISODE_COOLDOWN_MS / 60000}min ago)`)
                continue
            }

            const taskId = await createTask(
                item.userId,
                'story_generation',
                { pair: item.pair, source: 'bot', trigger: 'scenario_monitor', triggeredScenarioId: item.triggeredScenarioId },
                client
            )

            // Fire-and-forget: don't await story generation
            generateStory(item.userId, item.pair, taskId, {
                useServiceRole: true,
                generationSource: 'bot',
                triggeredScenarioId: item.triggeredScenarioId,
                triggeredEpisodeId: item.triggeredEpisodeId,
                isInvalidation: item.isInvalidation,
            }).catch(err => {
                console.error(`[ScenarioMonitor] Background story generation failed for ${item.pair}:`, err instanceof Error ? err.message : err)
            })

            result.generationsQueued++
            console.log(`[ScenarioMonitor] Queued new episode for ${item.pair} (task: ${taskId}, triggered: ${item.triggeredScenarioId}, proximity: ${item.isInvalidation ? 'invalidation' : 'trigger'})`)
        } catch (error) {
            console.error(`[ScenarioMonitor] Failed to queue generation for ${item.pair}:`, error instanceof Error ? error.message : error)
        }
    }

    console.log(`[ScenarioMonitor] Done: checked=${result.checked} triggered=${result.triggered} invalidated=${result.invalidated} siblings=${result.siblingsDeactivated} queued=${result.generationsQueued} busy=${result.skippedBusy} cooldown=${result.skippedCooldown} invalid=${result.skippedInvalidSetup}`)
    return result
}
