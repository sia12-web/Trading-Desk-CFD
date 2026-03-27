import { callClaudeWithCaching, callGemini, callDeepSeek } from '@/lib/ai/clients'
import { parseAIJson } from '@/lib/ai/parse-response'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateProgress, completeTask, failTask } from '@/lib/background-tasks/manager'
import { collectStoryData } from './data-collector'
import { summarizeNewsForStory } from './news-summarizer'
import { buildStoryStructuralPrompt } from './prompts/gemini-structural'
import { buildStoryQuantPrompt } from './prompts/deepseek-quant'
import { buildStoryNarratorPromptCached } from './prompts/claude-narrator'
import { getBible, upsertBible } from './bible'
import { getSeasonNumber, checkAndCloseSeason } from './seasons'
import { getAgentReportsForPair } from './agents/data'
import {
    createEpisode,
    createScenarios,
    getLatestEpisode,
    getNextEpisodeNumber,
    getScenariosForEpisode,
    getRecentlyResolvedScenarios,
} from '@/lib/data/stories'
import { validateStoryLevels, parseFlaggedLevels } from './validators'
import { notifyUser } from '@/lib/notifications/notifier'
import type { StoryResult } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Story generation pipeline orchestrator.
 * Runs as a background task: data collection → tri-model analysis → DB storage.
 *
 * All 3 models must succeed — no fallbacks (Promise.all, not Promise.allSettled).
 *
 * @param options.useServiceRole - When true (cron), uses service-role client to bypass RLS
 */
export async function generateStory(
    userId: string,
    pair: string,
    taskId: string,
    options?: { useServiceRole?: boolean; generationSource?: 'manual' | 'cron' | 'bot' }
): Promise<void> {
    const client: SupabaseClient = options?.useServiceRole
        ? createServiceClient()
        : await createClient()

    try {
        // ── Step 1: Collect OANDA data ──
        await updateProgress(taskId, 10, 'Fetching market data across 5 timeframes...', client)
        const data = await collectStoryData(userId, pair, client)

        // ── Step 2: Get news context ──
        await updateProgress(taskId, 20, 'Gathering news and economic calendar...', client)
        const news = await summarizeNewsForStory(pair)

        // ── Step 2.5: Fetch agent intelligence ──
        await updateProgress(taskId, 22, 'Loading agent intelligence reports...', client)
        const agentIntelligence = await getAgentReportsForPair(userId, pair, client)

        // ── Step 3: Load continuity context (Bible + last episode + resolved scenarios) ──
        await updateProgress(taskId, 25, 'Loading story history...', client)

        const [bible, lastEpisodeRaw, resolvedScenarios] = await Promise.all([
            getBible(userId, pair, client),
            getLatestEpisode(userId, pair, client),
            getRecentlyResolvedScenarios(userId, pair, 10, client),
        ])

        // Build last episode with full narrative + scenarios
        let lastEpisode: {
            episode_number: number
            title: string
            narrative: string
            current_phase: string
            next_episode_preview: string | null
            scenarios?: Array<{ title: string; status: string; direction: string }>
        } | null = null

        if (lastEpisodeRaw) {
            const scenarios = await getScenariosForEpisode(lastEpisodeRaw.id, client)
            lastEpisode = {
                episode_number: lastEpisodeRaw.episode_number,
                title: lastEpisodeRaw.title,
                narrative: lastEpisodeRaw.narrative,
                current_phase: lastEpisodeRaw.current_phase,
                next_episode_preview: lastEpisodeRaw.next_episode_preview,
                scenarios: scenarios.map(s => ({
                    title: s.title,
                    status: s.status,
                    direction: s.direction,
                })),
            }
        }

        // ── Step 4: Gemini structural analysis ──
        await updateProgress(taskId, 35, 'Gemini analyzing market structure...', client)
        const geminiPrompt = buildStoryStructuralPrompt(data, news)
        const geminiOutput = await callGemini(geminiPrompt, {
            timeout: 90_000,
            maxTokens: 8192,
        })

        // ── Step 5: DeepSeek quantitative validation ──
        await updateProgress(taskId, 55, 'DeepSeek validating with quantitative analysis...', client)
        const deepseekPrompt = buildStoryQuantPrompt(data, geminiOutput)
        const deepseekOutput = await callDeepSeek(deepseekPrompt, {
            timeout: 90_000,
            maxTokens: 4096,
        })

        // ── Step 5.5: Parse flagged levels from DeepSeek (best-effort) ──
        const flaggedLevels = parseFlaggedLevels(deepseekOutput)
        if (flaggedLevels.length > 0) {
            console.log(`[Story] DeepSeek flagged ${flaggedLevels.length} suspicious levels:`, flaggedLevels.map(f => f.level))
        }

        // ── Step 6: Claude narration (with Bible + resolved scenarios + prompt caching) ──
        await updateProgress(taskId, 75, 'Claude crafting the story narrative...', client)
        const { cacheablePrefix, dynamicPrompt } = buildStoryNarratorPromptCached(
            data,
            geminiOutput,
            deepseekOutput,
            news,
            lastEpisode,
            bible,
            resolvedScenarios,
            agentIntelligence,
            flaggedLevels
        )
        const claudeOutput = await callClaudeWithCaching(cacheablePrefix, dynamicPrompt, {
            timeout: 90_000,
            maxTokens: 8192,
        })

        // ── Step 7: Parse and store ──
        await updateProgress(taskId, 90, 'Saving story episode...', client)
        const result = parseAIJson<StoryResult>(claudeOutput)

        // ── Step 7a: Validate price levels (warnings only) ──
        const levelWarnings = validateStoryLevels(result, data)
        if (levelWarnings.length > 0) {
            console.warn(`[Story] ${pair} price level warnings (${levelWarnings.length}):`,
                levelWarnings.map(w => `${w.context}: ${w.level} outside [${w.observedRange.min.toFixed(5)}, ${w.observedRange.max.toFixed(5)}]`))
        }

        // Build agent reports snapshot for episode
        const agentReportsSnapshot: Record<string, unknown> = {}
        if (agentIntelligence.optimizer) agentReportsSnapshot.optimizer = { summary: agentIntelligence.optimizer.summary, market_regime: agentIntelligence.optimizer.market_regime }
        if (agentIntelligence.news) agentReportsSnapshot.news = { summary: agentIntelligence.news.summary, sentiment: agentIntelligence.news.sentiment_indicators?.overall }
        if (agentIntelligence.crossMarket) agentReportsSnapshot.crossMarket = { summary: agentIntelligence.crossMarket.summary, risk_appetite: agentIntelligence.crossMarket.risk_appetite }

        const episodeNumber = await getNextEpisodeNumber(userId, pair, client)
        const seasonNumber = lastEpisodeRaw?.is_season_finale 
            ? (lastEpisodeRaw.season_number || 1) + 1 
            : (lastEpisodeRaw?.season_number || 1)

        const episode = await createEpisode(userId, pair, {
            episode_number: episodeNumber,
            season_number: seasonNumber,
            title: result.story_title,
            narrative: result.narrative,
            characters: result.characters as unknown as Record<string, unknown>,
            current_phase: result.current_phase,
            key_levels: result.key_levels as unknown as Record<string, unknown>,
            raw_ai_output: result as unknown as Record<string, unknown>,
            gemini_output: { raw: geminiOutput },
            deepseek_output: { raw: deepseekOutput },
            news_context: news as unknown as Record<string, unknown>,
            confidence: result.confidence,
            next_episode_preview: result.next_episode_preview,
            agent_reports: Object.keys(agentReportsSnapshot).length > 0 ? agentReportsSnapshot : undefined,
            generation_source: options?.generationSource || 'manual',
            is_season_finale: result.is_season_finale,
        }, client)

        // Create scenarios linked to this episode
        if (result.scenarios?.length > 0) {
            await createScenarios(
                episode.id,
                userId,
                pair,
                result.scenarios.map(s => ({
                    title: s.title,
                    description: s.description,
                    direction: s.direction,
                    probability: s.probability,
                    trigger_conditions: s.trigger_conditions,
                    invalidation: s.invalidation,
                    ...(s.trigger_level != null ? { trigger_level: s.trigger_level } : {}),
                    ...(s.trigger_direction ? { trigger_direction: s.trigger_direction } : {}),
                    ...(s.invalidation_level != null ? { invalidation_level: s.invalidation_level } : {}),
                    ...(s.invalidation_direction ? { invalidation_direction: s.invalidation_direction } : {}),
                })),
                client
            )
        }

        // ── Step 7b: Update Story Bible ──
        if (result.bible_update) {
            await upsertBible(userId, pair, result.bible_update, episodeNumber, client)
        }

        // ── Step 7c: Check season finale ──
        await checkAndCloseSeason(
            userId, pair, episodeNumber,
            result.bible_update?.arc_summary || '',
            result.is_season_finale,
            client
        )

        await completeTask(taskId, {
            episodeId: episode.id,
            episodeNumber,
            title: result.story_title,
        }, client)

        // ── Step 7d: Notify User ──
        await notifyUser(userId, {
            title: `📖 New Story: ${pair}`,
            body: result.story_title || `Episode ${episodeNumber} is now live.`,
            url: `/story/${pair.replace('/', '-')}`
        }, client)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error during story generation'
        console.error('Story pipeline error:', message)
        await failTask(taskId, message, client)
    }
}
