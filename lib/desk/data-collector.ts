import { createClient } from '@/lib/supabase/server'
import { getActiveAccountId } from '@/lib/oanda/account'
import { getPortfolioSummary, getDashboardStats, getRecentClosedTrades } from '@/lib/data/analytics'
import { getActiveRiskRules } from '@/lib/data/risk-rules'
import { getSubscribedPairs, getLatestEpisode, getActiveScenarios } from '@/lib/data/stories'
import { getActivePosition } from '@/lib/data/story-positions'
import { getProfile } from '@/lib/data/trader-profile'
import { getCorrelationInsights } from '@/lib/story/correlation-integrator'
import type {
    DeskContext,
    DeskState,
    ProcessScore,
    OpenPosition,
    ClosedTrade,
    ActiveScenario,
    MarketContext,
    FractalSetupSummary,
} from './types'

/**
 * Collect all context the desk characters need to generate grounded dialogue.
 * Every statement must be backed by data from this context.
 */
export async function collectDeskContext(userId: string): Promise<DeskContext> {
    const supabase = await createClient()
    const accountId = await getActiveAccountId()

    // Parallel fetch everything
    const [
        portfolioSummary,
        dashStats,
        recentClosedRaw,
        riskRulesRaw,
        profile,
        subscribedPairs,
        deskState,
        recentScores,
        openTradesRaw,
        todayClosedRaw,
        crossMarketReport,
    ] = await Promise.all([
        getPortfolioSummary(userId),
        getDashboardStats(userId),
        getRecentClosedTrades(userId, 10),
        getActiveRiskRules(userId),
        getProfile(userId),
        getSubscribedPairs(userId),
        getDeskState(supabase, userId),
        getRecentProcessScores(supabase, userId),
        getOpenTrades(supabase, userId, accountId),
        getTodayClosedTrades(supabase, userId, accountId),
        getLatestCrossMarketReport(supabase, userId),
    ])

    // Build open positions
    const openPositions: OpenPosition[] = openTradesRaw.map((t: Record<string, unknown>) => ({
        pair: t.pair as string,
        direction: t.direction as string,
        entry_price: Number(t.entry_price) || 0,
        current_pnl: 0, // would need live price — use OANDA if available
        stop_loss: t.stop_loss ? Number(t.stop_loss) : null,
        take_profit: t.take_profit ? Number(t.take_profit) : null,
        opened_at: t.created_at as string,
    }))

    // Build today's closed trades
    const todayClosedTrades: ClosedTrade[] = todayClosedRaw.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        pair: t.pair as string,
        direction: t.direction as string,
        pnl_amount: Number((t as Record<string, unknown[]>).trade_pnl?.[0] && ((t as Record<string, unknown[]>).trade_pnl[0] as Record<string, unknown>)?.pnl_amount) || 0,
        close_reason: (t.close_reason as string) || null,
        closed_at: (t.closed_at as string) || '',
    }))

    // Recent trades (last 10 closed)
    const recentTrades = recentClosedRaw.map((t: Record<string, unknown>) => ({
        pair: t.pair as string,
        direction: t.direction as string,
        pnl_amount: Number((t as Record<string, unknown[]>).trade_pnl?.[0] && ((t as Record<string, unknown[]>).trade_pnl[0] as Record<string, unknown>)?.pnl_amount) || 0,
        status: t.status as string,
        closed_at: (t.closed_at as string) || null,
    }))

    // Risk rules with violation check
    const activeRiskRules = (riskRulesRaw || []).map((r: Record<string, unknown>) => ({
        rule_name: r.rule_name as string,
        rule_type: r.rule_type as string,
        value: (r.value as Record<string, unknown>) || {},
        is_active: r.is_active as boolean,
    }))

    // Current exposure
    const openPairs = openPositions.map(p => p.pair)
    const currentExposure = {
        openTradesCount: dashStats.openTradesCount,
        totalRiskPercent: 0, // simplified — would need account balance
        pairs: openPairs,
    }

    // Check rule violations
    const ruleViolations: Array<{ rule: string; current_value: number; limit: number }> = []
    for (const rule of activeRiskRules) {
        if (rule.rule_type === 'max_open_trades') {
            const limit = (rule.value as Record<string, number>).count || 3
            if (dashStats.openTradesCount > limit) {
                ruleViolations.push({
                    rule: rule.rule_name,
                    current_value: dashStats.openTradesCount,
                    limit,
                })
            }
        }
    }

    // Gather active scenarios and latest episodes from subscribed pairs
    const activeScenarios: ActiveScenario[] = []
    const latestEpisodes: Record<string, { title: string; narrative_summary: string; current_phase: string }> = {}
    const activeStoryPositions: Array<{
        pair: string; direction: string; status: string; entry_price: number; current_sl: number | null
    }> = []

    const pairNames = subscribedPairs.map((p: Record<string, unknown>) => p.pair as string)

    // Fractal setups populated from latest cached structural analyses if available
    const fractalSetups: FractalSetupSummary[] = await getFractalSetups(supabase, userId, pairNames)

    // Fetch per-pair data in parallel
    const pairResults = await Promise.all(
        pairNames.map(async (pair: string) => {
            const [scenarios, episode, position] = await Promise.all([
                getActiveScenarios(userId, pair).catch(() => []),
                getLatestEpisode(userId, pair).catch(() => null),
                getActivePosition(userId, pair).catch(() => null),
            ])
            return { pair, scenarios, episode, position }
        })
    )

    for (const { pair, scenarios, episode, position } of pairResults) {
        for (const s of scenarios) {
            activeScenarios.push({
                pair,
                title: s.title,
                direction: s.direction,
                probability: s.probability,
                trigger_conditions: s.trigger_conditions,
            })
        }
        if (episode) {
            latestEpisodes[pair] = {
                title: episode.title,
                narrative_summary: (episode.narrative || '').slice(0, 300),
                current_phase: episode.current_phase || 'unknown',
            }
        }
        if (position) {
            activeStoryPositions.push({
                pair,
                direction: position.direction,
                status: position.status,
                entry_price: position.suggested_entry || position.entry_price || 0,
                current_sl: position.current_stop_loss,
            })
        }
    }

    // Week P&L (sum of recent trades within this week)
    const weekStart = getWeekStart()
    const weekPnL = recentTrades
        .filter(t => t.closed_at && new Date(t.closed_at) >= weekStart)
        .reduce((sum, t) => sum + t.pnl_amount, 0)

    // Market context from latest episodes + cross-market intelligence
    const marketContext: MarketContext = {
        overall_sentiment: determineSentiment(activeScenarios),
        key_events_today: [],
        volatility_status: {},
        ...(crossMarketReport ? {
            risk_appetite: crossMarketReport.risk_appetite === 'risk_on' ? 'risk-on' as const
                : crossMarketReport.risk_appetite === 'risk_off' ? 'risk-off' as const
                : 'mixed' as const,
            equity_indices: crossMarketReport.indices,
            dollar_trend: crossMarketReport.dollar_trend || undefined,
            cross_market_thesis: crossMarketReport.thesis || undefined,
        } : {}),
    }

    return {
        openPositions,
        todayClosedTrades,
        recentTrades,
        portfolioSummary: {
            totalPnL: portfolioSummary.totalPnL,
            winRate: portfolioSummary.winRate,
            totalTrades: portfolioSummary.totalTrades,
            profitFactor: portfolioSummary.profitFactor,
        },
        todayPnL: dashStats.todayPnL,
        weekPnL,
        activeRiskRules,
        currentExposure,
        ruleViolations,
        activeScenarios,
        latestEpisodes,
        activeStoryPositions,
        profile: {
            trading_style: profile?.trading_style || null,
            risk_personality: profile?.risk_personality || null,
            observed_weaknesses: profile?.observed_weaknesses || [],
            current_focus: profile?.current_focus || null,
        },
        deskState,
        recentProcessScores: recentScores,
        marketContext,
        fractalSetups,
        correlationInsights: await getCorrelationInsights(supabase, userId, '').then(insights =>
            insights ? {
                activePatterns: insights.activePatterns,
                predictions: insights.tomorrowPredictions
            } : undefined
        ),
    }
}

// --- Helper queries ---

async function getDeskState(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
): Promise<DeskState | null> {
    const { data, error } = await supabase
        .from('desk_state')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching desk state:', error)
    }
    return data || null
}

async function getRecentProcessScores(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
): Promise<ProcessScore[]> {
    const { data, error } = await supabase
        .from('process_scores')
        .select('*')
        .eq('user_id', userId)
        .order('scored_at', { ascending: false })
        .limit(5)

    if (error) {
        console.error('Error fetching process scores:', error)
        return []
    }
    return data || []
}

async function getOpenTrades(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    accountId: string
) {
    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .eq('oanda_account_id', accountId)
        .eq('status', 'open')

    if (error) {
        console.error('Error fetching open trades:', error)
        return []
    }
    return data || []
}

async function getTodayClosedTrades(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    accountId: string
) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const { data, error } = await supabase
        .from('trades')
        .select('*, trade_pnl(*)')
        .eq('user_id', userId)
        .eq('oanda_account_id', accountId)
        .eq('status', 'closed')
        .gte('closed_at', startOfDay)

    if (error) {
        console.error('Error fetching today closed trades:', error)
        return []
    }
    return data || []
}

function getWeekStart(): Date {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday
    return new Date(now.getFullYear(), now.getMonth(), diff)
}

function determineSentiment(scenarios: ActiveScenario[]): string {
    if (scenarios.length === 0) return 'no active scenarios'
    const bullish = scenarios.filter(s => s.direction === 'bullish' || s.direction === 'long').length
    const bearish = scenarios.filter(s => s.direction === 'bearish' || s.direction === 'short').length
    if (bullish > bearish) return 'leaning bullish'
    if (bearish > bullish) return 'leaning bearish'
    return 'mixed'
}

async function getFractalSetups(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    pairs: string[]
): Promise<FractalSetupSummary[]> {
    if (pairs.length === 0) return []
    try {
        // Pull latest structural analysis cache which contains BW data via Gemini output
        const { data } = await supabase
            .from('structural_analysis_cache')
            .select('pair, result')
            .eq('user_id', userId)
            .in('pair', pairs)
            .order('created_at', { ascending: false })
            .limit(pairs.length)

        if (!data || data.length === 0) return []

        const setups: FractalSetupSummary[] = []
        for (const row of data) {
            const result = row.result as Record<string, unknown> | null
            if (!result) continue
            // Extract BW data from structural analysis if available
            const bw = result.bill_williams as Record<string, unknown> | undefined
            if (bw) {
                setups.push({
                    pair: row.pair,
                    timeframe: (bw.timeframe as string) || 'D',
                    alligatorState: (bw.alligator_state as string) || 'unknown',
                    setupScore: (bw.setup_score as number) || 0,
                    setupDirection: (bw.setup_direction as string) || 'none',
                    signals: (bw.signals as string[]) || [],
                })
            }
        }
        return setups
    } catch {
        return []
    }
}

async function getLatestCrossMarketReport(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
): Promise<{
    risk_appetite: 'risk_on' | 'risk_off' | 'mixed'
    indices: Array<{ name: string; instrument: string; change_1d: number; trend: string }>
    dollar_trend: string | null
    thesis: string | null
} | null> {
    try {
        // Get the most recent cross_market agent report (today or yesterday)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data } = await supabase
            .from('story_agent_reports')
            .select('report')
            .eq('user_id', userId)
            .eq('agent_type', 'cross_market')
            .gte('created_at', yesterday.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (!data?.report) return null

        const report = data.report as Record<string, unknown>

        // Extract from CrossMarketReport or IndexCrossMarketReport shape
        const riskAppetite = (report.risk_appetite as string) || 'mixed'
        const normalizedRisk = riskAppetite === 'risk_on' ? 'risk_on'
            : riskAppetite === 'risk_off' ? 'risk_off'
            : 'mixed' as const

        // Build indices array from indices_analyzed (forex) or peer_indices (index)
        const indices: Array<{ name: string; instrument: string; change_1d: number; trend: string }> = []

        const indicesAnalyzed = report.indices_analyzed as Array<Record<string, unknown>> | undefined
        if (indicesAnalyzed) {
            for (const idx of indicesAnalyzed) {
                indices.push({
                    name: (idx.name as string) || '',
                    instrument: (idx.instrument as string) || '',
                    change_1d: 0,
                    trend: (idx.recent_trend as string) || 'unknown',
                })
            }
        }

        const peerIndices = report.peer_indices as Array<Record<string, unknown>> | undefined
        if (peerIndices) {
            for (const idx of peerIndices) {
                indices.push({
                    name: (idx.name as string) || '',
                    instrument: (idx.instrument as string) || '',
                    change_1d: (idx.change1d as number) || 0,
                    trend: (idx.trend as string) || 'unknown',
                })
            }
        }

        // Dollar trend from currency_implications or dollar_analysis
        let dollarTrend: string | null = null
        const dollarAnalysis = report.dollar_analysis as Record<string, unknown> | undefined
        if (dollarAnalysis) {
            dollarTrend = (dollarAnalysis.trend as string) || null
        }
        const currImplications = report.currency_implications as Record<string, unknown> | undefined
        if (!dollarTrend && currImplications) {
            dollarTrend = (currImplications.net_effect as string) || null
        }

        const thesis = (report.cross_market_thesis as string)
            || (report.correlation_thesis as string)
            || (report.summary as string)
            || null

        return { risk_appetite: normalizedRisk, indices, dollar_trend: dollarTrend, thesis }
    } catch {
        return null
    }
}
