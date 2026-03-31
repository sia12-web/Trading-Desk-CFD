import { createClient } from '@/lib/supabase/server'
import { getActiveAccountId } from '@/lib/oanda/account'
import { getPortfolioSummary, getDashboardStats, getRecentClosedTrades } from '@/lib/data/analytics'
import { getActiveRiskRules } from '@/lib/data/risk-rules'
import { getSubscribedPairs, getLatestEpisode, getActiveScenarios } from '@/lib/data/stories'
import { getActivePosition } from '@/lib/data/story-positions'
import { getProfile } from '@/lib/data/trader-profile'
import type {
    DeskContext,
    DeskState,
    ProcessScore,
    OpenPosition,
    ClosedTrade,
    ActiveScenario,
    MarketContext,
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

    // Market context from latest episodes
    const marketContext: MarketContext = {
        overall_sentiment: determineSentiment(activeScenarios),
        key_events_today: [],
        volatility_status: {},
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
