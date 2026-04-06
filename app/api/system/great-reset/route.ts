import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GREAT RESET — Nuclear option to wipe all trading history and AI memory
 *
 * DELETES:
 * - All trades and positions (manual + story-driven)
 * - All journals and screenshots
 * - All execution logs
 * - All AI memory (desk state, messages, meetings, trader profile, process scores)
 * - All story content (episodes, bible, scenarios, agent reports)
 * - All CMS results
 * - All analysis caches
 *
 * KEEPS:
 * - Trading gurus (system-level)
 * - Indicator calibrations (optimization results)
 * - Strategy templates (True Fractal checklist)
 * - Risk rules (user preferences)
 * - Story subscriptions (which pairs to watch)
 * - OANDA connection
 * - Correlation patterns (system-level)
 * - Calendar events
 */
export async function POST() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const results: Record<string, number> = {}

        // Helper function to delete from a table
        const deleteFromTable = async (table: string) => {
            const { error, count } = await supabase
                .from(table)
                .delete()
                .eq('user_id', user.id)

            if (error) {
                // Ignore errors for non-existent tables
                const isTableNotFound =
                    error.message.includes('does not exist') ||
                    error.message.includes('Could not find the table')

                if (!isTableNotFound) {
                    console.error(`[great-reset] Error deleting from ${table}:`, error.message)
                }
            }
            results[table] = count ?? 0
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: Delete FK children first (to avoid constraint violations)
        // ═══════════════════════════════════════════════════════════════════

        console.log('[great-reset] Phase 1: Deleting FK children...')

        const phase1Tables = [
            'story_position_adjustments',  // FK: position_id
            'journal_screenshots',          // FK: journal_entry_id
            'story_episodes',              // FK: triggered_scenario_id (sometimes)
        ]

        for (const table of phase1Tables) {
            await deleteFromTable(table)
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: Delete parent tables and independent records
        // ═══════════════════════════════════════════════════════════════════

        console.log('[great-reset] Phase 2: Deleting parent tables...')

        const phase2Tables = [
            // Trading History
            'trades',                       // Manual trades
            'story_positions',              // Story-driven positions
            'journal_entries',              // Trade journals
            'execution_log',                // Execution history

            // AI Memory
            'desk_state',                   // Character memory + trading scars
            'desk_messages',                // Desk chatter
            'desk_meetings',                // Morning meetings, trade reviews
            'trader_profile',               // Observed weaknesses, current focus
            'process_scores',               // Trade process scoring

            // Story Content
            'story_scenarios',              // Hypothetical setups
            'story_bibles',                 // Pair-specific story context
            'story_seasons',                // Season metadata
            'story_agent_reports',          // Agent analysis reports

            // CMS & Analysis
            'cms_results',                  // CMS pattern analysis
            'cms_analyses',                 // Alternative CMS table name
            'scenario_analyses',            // Correlation scenario analysis

            // Cache
            'structural_analysis_cache',    // Gemini structural cache
            'wave_analysis',                // Elliott Wave cache
        ]

        for (const table of phase2Tables) {
            await deleteFromTable(table)
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 3: Log what was kept
        // ═══════════════════════════════════════════════════════════════════

        const keptTables = [
            'trading_gurus',                // System-level
            'indicator_calibrations',       // Optimization results
            'strategy_templates',           // True Fractal checklist
            'risk_rules',                   // User preferences
            'story_subscriptions',          // Which pairs to watch
            'oanda_connections',            // Broker connection
            'correlation_patterns',         // System-level patterns
            'calendar_events',              // Market events
        ]

        console.log('[great-reset] Kept tables:', keptTables)

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 4: Categorize results
        // ═══════════════════════════════════════════════════════════════════

        const categories = {
            trading_history: ['trades', 'story_positions', 'story_position_adjustments', 'journal_entries', 'journal_screenshots', 'execution_log'],
            ai_memory: ['desk_state', 'desk_messages', 'desk_meetings', 'trader_profile', 'process_scores'],
            story_content: ['story_episodes', 'story_scenarios', 'story_bibles', 'story_seasons', 'story_agent_reports'],
            cms_analysis: ['cms_results', 'cms_analyses', 'scenario_analyses'],
            cache: ['structural_analysis_cache', 'wave_analysis'],
        }

        const categorySummary: Record<string, number> = {}
        for (const [cat, tables] of Object.entries(categories)) {
            categorySummary[cat] = tables.reduce((sum, t) => sum + (results[t] || 0), 0)
        }

        const totalDeleted = Object.values(results).reduce((sum, n) => sum + n, 0)

        console.log('[great-reset] Complete.', {
            totalDeleted,
            categories: categorySummary,
        })

        return NextResponse.json({
            success: true,
            message: `Great Reset complete. ${totalDeleted} records deleted. System is now fresh — all trading history and AI memory wiped.`,
            totalDeleted,
            categories: categorySummary,
            kept: keptTables,
        })
    } catch (error: any) {
        console.error('[great-reset] Error:', error)
        return NextResponse.json(
            { error: 'Failed to perform Great Reset', details: error.message },
            { status: 500 }
        )
    }
}
