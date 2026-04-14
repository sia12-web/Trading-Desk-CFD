/**
 * War Room API — Unified Command Center Data Endpoint
 *
 * GET /api/regime/war-room
 *
 * Returns:
 * - Current regime classification per watchlist pair
 * - Active bot per pair
 * - Condition Black status
 * - Upcoming high-impact news events
 * - Recent auto-executions
 * - Ghost window status for each pair
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanAllPairsForRegime } from '@/lib/regime/scanner'
import { isGhostWindow, isNewsBlackout, getUpcomingHighImpactEvents } from '@/lib/regime/news-guard'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // ── 1. Regime scan for all pairs ──
        const regimeStates = await scanAllPairsForRegime(50) // 50ms delay between pairs

        // ── 2. News events ──
        const upcomingNews = await getUpcomingHighImpactEvents(4) // next 4 hours

        // ── 3. Ghost & blackout status for top pairs ──
        const newsStatus: Record<string, { ghostActive: boolean; blackout: boolean; event: string | null }> = {}
        // Only check top 8 pairs to avoid rate limiting
        const topPairs = VALID_PAIRS.slice(0, 8)
        for (const pair of topPairs) {
            const [ghost, blackout] = await Promise.all([
                isGhostWindow(pair),
                isNewsBlackout(pair),
            ])
            newsStatus[pair] = {
                ghostActive: ghost.active,
                blackout: blackout.blackout,
                event: ghost.event || blackout.event,
            }
        }

        // ── 4. Determine global system status ──
        const hasConditionBlack = regimeStates.some(s => s.regime.conditionBlack)
        const hasNewsGuard = Object.values(newsStatus).some(s => s.blackout || s.ghostActive)
        const systemStatus = hasConditionBlack ? 'CONDITION_BLACK'
            : hasNewsGuard ? 'NEWS_GUARD'
            : 'OPERATIONAL'

        // ── 5. Division summaries ──
        const div1Active = regimeStates.filter(s => s.regime.activeBot === 'trap')
        const div2Active = regimeStates.filter(s => s.regime.activeBot === 'momentum')
        const div3Active = regimeStates.filter(s => s.regime.activeBot === 'ghost')
        const killzoneActive = regimeStates.filter(s => s.regime.activeBot === 'killzone')

        // ── 6. Recent executions ──
        const { data: recentExecutions } = await supabase
            .from('regime_auto_executions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20)

        // ── 7. Division stats ──
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const { count: todayExecutions } = await supabase
            .from('regime_auto_executions')
            .select('*', { count: 'exact', head: true })
            .eq('executed', true)
            .gte('created_at', todayStart.toISOString())

        return NextResponse.json({
            systemStatus,
            timestamp: new Date().toISOString(),

            divisions: {
                sniper: {
                    name: 'Division 1 — The Sniper',
                    strategy: 'Mean Reversion (Trap Bot)',
                    regime: 'ranging_quiet',
                    activePairs: div1Active.map(s => s.pair),
                    activeCount: div1Active.length,
                    setupsDetected: div1Active.filter(s => s.bestSetup?.detected).length,
                },
                rider: {
                    name: 'Division 2 — The Rider',
                    strategy: 'Momentum Trend (VWAP+EMA+ADX)',
                    regime: 'trending_strong / trending_mild',
                    activePairs: div2Active.map(s => s.pair),
                    activeCount: div2Active.length,
                    setupsDetected: div2Active.filter(s => s.bestSetup?.detected).length,
                },
                ghost: {
                    name: 'Division 3 — The Ghost',
                    strategy: 'Volatility Harvester (Judas Swing Fade)',
                    regime: 'news_chaos',
                    activePairs: div3Active.map(s => s.pair),
                    activeCount: div3Active.length,
                    ghostWindows: Object.entries(newsStatus).filter(([, s]) => s.ghostActive).map(([p]) => p),
                    nextNewsEvent: upcomingNews.length > 0 ? upcomingNews[0] : null,
                },
                killzone: {
                    name: 'Killzone Bot',
                    strategy: 'Institutional W-X-Y Projection',
                    regime: 'complex_correction',
                    activePairs: killzoneActive.map(s => s.pair),
                    activeCount: killzoneActive.length,
                },
            },

            conditionBlack: {
                active: hasConditionBlack,
                affectedPairs: regimeStates.filter(s => s.regime.conditionBlack).map(s => s.pair),
                reason: hasConditionBlack
                    ? regimeStates.find(s => s.regime.conditionBlack)?.regime.narrative ?? null
                    : null,
            },

            regimeHeatmap: regimeStates.map(s => ({
                pair: s.pair,
                regime: s.regime.regime,
                activeBot: s.regime.activeBot,
                confidence: s.regime.confidence,
                conditionBlack: s.regime.conditionBlack,
                setupDetected: s.bestSetup?.detected ?? false,
                direction: s.bestSetup?.direction ?? null,
                adx: s.regime.indicators.adxValue,
                atrPercentile: s.regime.indicators.atrPercentile,
            })),

            upcomingNews,
            newsStatus,

            recentExecutions: (recentExecutions ?? []).map(e => ({
                id: e.id,
                pair: e.pair,
                regime: e.regime,
                activeBot: e.active_bot,
                direction: e.direction,
                executed: e.executed,
                dryRun: e.dry_run,
                blockedReason: e.blocked_reason,
                entryPrice: e.entry_price,
                stopLoss: e.stop_loss,
                ghostEventName: e.ghost_event_name,
                conditionBlack: e.condition_black,
                trailingStopDistance: e.trailing_stop_distance,
                createdAt: e.created_at,
            })),

            stats: {
                totalPairsScanned: regimeStates.length,
                todayExecutions: todayExecutions ?? 0,
            },
        })
    } catch (error) {
        console.error('[WarRoom] API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
