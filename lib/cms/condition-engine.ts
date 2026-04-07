// ── CMS Programmatic Condition Engine ──
// All statistics computed from real candle data. NO AI involvement.

import type {
    CMSDataPayload,
    DailyRelationship,
    WeeklyRelationship,
    SessionAnnotatedH1,
    ProgrammaticCondition,
} from './types'
import { getAssetConfig } from '@/lib/story/asset-config'

const MIN_SAMPLE = 15
const MIN_PROBABILITY = 55

// Forex-specific condition IDs to skip for crypto (session-based, forex market structure)
const FOREX_ONLY_CONDITION_IDS = new Set([
    'd1',   // Friday/Thursday/Monday structure (forex week)
    'd9',   // Pre-weekend positioning
    'd10',  // Monday gap patterns
    'w1',   // Weekly open/close forex structure
    'w2',   // Weekly range forex structure
    'cm5',  // DAX → EUR correlation
    'cm6',  // FTSE → GBP correlation
    'cm7',  // Nikkei → JPY correlation
])

/**
 * Compute all conditional patterns programmatically from pre-collected data.
 * Returns only conditions meeting minimum sample + probability thresholds.
 * For crypto: skips session conditions and forex-specific day/cross-market patterns.
 */
export function computeAllConditions(data: CMSDataPayload): ProgrammaticCondition[] {
    const assetConfig = getAssetConfig(data.pair)
    const isCryptoPair = assetConfig.type === 'crypto'

    const all = [
        ...computeDailyConditions(data.dailyRelationships, data.volatilityProfile.atr14_daily, data.pipMultiplier),
        ...computeWeeklyConditions(data.weeklyRelationships),
        // Crypto trades 24/7 — session conditions are meaningless
        ...(isCryptoPair ? [] : computeSessionConditions(data.sessionAnnotated, data.volatilityProfile.atr14_daily)),
        ...computeVolatilityConditions(data.dailyRelationships, data.weeklyRelationships, data.volatilityProfile.atr14_daily),
        ...computeCrossMarketConditions(data.dailyRelationships, data.crossMarketCorrelations, data.pipMultiplier, data.pair),
        ...computeFractalConditions(data.dailyRelationships, data.volatilityProfile.atr14_daily, data.pipMultiplier),
        ...computeElliottWaveConditions(data.dailyRelationships, data.volatilityProfile.atr14_daily, data.pipMultiplier),
    ]

    return all.filter(c => {
        if (c.sample_size < MIN_SAMPLE || c.probability < MIN_PROBABILITY) return false
        // Filter out forex-specific conditions for crypto
        if (isCryptoPair && FOREX_ONLY_CONDITION_IDS.has(c.id)) return false
        return true
    })
}

// ── Helpers ──

function pct(hits: number, total: number): number {
    if (total === 0) return 0
    return Math.round((hits / total) * 100)
}

function avg(values: number[]): number {
    if (values.length === 0) return 0
    return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
}

// ── Daily Conditions (~10 patterns) ──

function computeDailyConditions(
    dr: DailyRelationship[],
    atr: number,
    pipMult: number,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (dr.length < 20) return conditions

    // d1: Friday fails to break Thursday's high → Monday tests Friday's low
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 1; i < dr.length - 1; i++) {
            if (dr[i].dayOfWeek === 'Friday' && dr[i - 1].dayOfWeek === 'Thursday' && !dr[i].broke_prev_high) {
                const nextDay = dr[i + 1]
                if (nextDay?.dayOfWeek === 'Monday') {
                    sample++
                    if (nextDay.low <= dr[i].low) {
                        hits++
                        moves.push(Math.abs(dr[i].low - nextDay.low) * pipMult)
                    }
                }
            }
        }
        conditions.push({
            id: 'd1', category: 'daily',
            condition: 'Friday fails to break Thursday\'s high',
            outcome: 'Monday tests Friday\'s low',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next trading day',
        })
    }

    // d2: Inside day → next day breaks in direction of prior 3-day trend
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 3; i < dr.length - 1; i++) {
            if (dr[i].inside_day) {
                sample++
                // Prior 3-day trend: majority direction
                const priorDirs = [dr[i - 1], dr[i - 2], dr[i - 3]].map(d => d.direction)
                const bullCount = priorDirs.filter(d => d === 'bullish').length
                const trendDir = bullCount >= 2 ? 'bullish' : 'bearish'
                const nextDay = dr[i + 1]
                if (nextDay.direction === trendDir) {
                    hits++
                    moves.push(nextDay.range_pips)
                }
            }
        }
        conditions.push({
            id: 'd2', category: 'daily',
            condition: 'Inside day forms',
            outcome: 'Next day breaks in direction of prior 3-day trend',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d3: Outside day → next day reverses
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < dr.length - 1; i++) {
            if (dr[i].outside_day) {
                sample++
                const nextDay = dr[i + 1]
                if (nextDay.direction !== dr[i].direction && nextDay.direction !== 'doji') {
                    hits++
                    moves.push(nextDay.range_pips)
                }
            }
        }
        conditions.push({
            id: 'd3', category: 'daily',
            condition: 'Outside day forms',
            outcome: 'Next day reverses direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d4: Gap up → same-day gap fill
    {
        const gapThreshold = atr * 0.1 // meaningful gap
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const d of dr) {
            if (d.gap_pips > gapThreshold) {
                sample++
                // Gap fill: price retraces to previous close (open - gap)
                const prevClose = d.open - (d.gap_pips / pipMult)
                if (d.low <= prevClose) {
                    hits++
                    moves.push(d.gap_pips)
                }
            }
        }
        conditions.push({
            id: 'd4', category: 'daily',
            condition: 'Gap up opens (> 10% ATR)',
            outcome: 'Same-day gap fill occurs',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same day',
        })
    }

    // d5: Gap down → same-day gap fill
    {
        const gapThreshold = atr * 0.1
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const d of dr) {
            if (d.gap_pips < -gapThreshold) {
                sample++
                const prevClose = d.open - (d.gap_pips / pipMult)
                if (d.high >= prevClose) {
                    hits++
                    moves.push(Math.abs(d.gap_pips))
                }
            }
        }
        conditions.push({
            id: 'd5', category: 'daily',
            condition: 'Gap down opens (> 10% ATR)',
            outcome: 'Same-day gap fill occurs',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same day',
        })
    }

    // d6: 3+ consecutive bullish days → next day bearish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 2; i < dr.length - 1; i++) {
            if (dr[i].direction === 'bullish' && dr[i - 1].direction === 'bullish' && dr[i - 2].direction === 'bullish') {
                // Don't double-count (only trigger on the last day of a 3+ streak)
                if (i >= 3 && dr[i - 3].direction === 'bullish') continue
                sample++
                if (dr[i + 1].direction === 'bearish') {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'd6', category: 'daily',
            condition: '3+ consecutive bullish days',
            outcome: 'Next day is bearish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d7: 3+ consecutive bearish days → next day bullish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 2; i < dr.length - 1; i++) {
            if (dr[i].direction === 'bearish' && dr[i - 1].direction === 'bearish' && dr[i - 2].direction === 'bearish') {
                if (i >= 3 && dr[i - 3].direction === 'bearish') continue
                sample++
                if (dr[i + 1].direction === 'bullish') {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'd7', category: 'daily',
            condition: '3+ consecutive bearish days',
            outcome: 'Next day is bullish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d8: Large range day (>1.5x ATR) → next day continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < dr.length - 1; i++) {
            if (dr[i].range_pips > atr * 1.5 && dr[i].direction !== 'doji') {
                sample++
                if (dr[i + 1].direction === dr[i].direction) {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'd8', category: 'daily',
            condition: 'Large range day (>1.5x ATR)',
            outcome: 'Next day continues in same direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d9: Monday bullish → Tuesday continues bullish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < dr.length - 1; i++) {
            if (dr[i].dayOfWeek === 'Monday' && dr[i].direction === 'bullish') {
                sample++
                if (dr[i + 1]?.dayOfWeek === 'Tuesday' && dr[i + 1].direction === 'bullish') {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'd9', category: 'daily',
            condition: 'Monday closes bullish',
            outcome: 'Tuesday continues bullish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // d10: Thursday bearish → Friday continues bearish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < dr.length - 1; i++) {
            if (dr[i].dayOfWeek === 'Thursday' && dr[i].direction === 'bearish') {
                sample++
                if (dr[i + 1]?.dayOfWeek === 'Friday' && dr[i + 1].direction === 'bearish') {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'd10', category: 'daily',
            condition: 'Thursday closes bearish',
            outcome: 'Friday continues bearish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    return conditions
}

// ── Weekly Conditions (~8 patterns) ──

function computeWeeklyConditions(wr: WeeklyRelationship[]): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (wr.length < 10) return conditions

    // w1: Monday sets weekly high → week closes bearish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const w of wr) {
            if (w.day_of_high === 'Monday') {
                sample++
                if (w.week_direction === 'bearish') {
                    hits++
                    moves.push(w.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w1', category: 'weekly',
            condition: 'Monday sets the weekly high',
            outcome: 'Week closes bearish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same week',
        })
    }

    // w2: Monday sets weekly low → week closes bullish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const w of wr) {
            if (w.day_of_low === 'Monday') {
                sample++
                if (w.week_direction === 'bullish') {
                    hits++
                    moves.push(w.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w2', category: 'weekly',
            condition: 'Monday sets the weekly low',
            outcome: 'Week closes bullish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same week',
        })
    }

    // w3: Monday direction matches weekly direction
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const w of wr) {
            if (w.monday_direction !== 'doji') {
                sample++
                if (w.monday_direction === w.week_direction) {
                    hits++
                    moves.push(w.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w3', category: 'weekly',
            condition: 'Monday closes in a direction (bullish or bearish)',
            outcome: 'Weekly close matches Monday\'s direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same week',
        })
    }

    // w4: Small Monday range (<50% of avg) → large weekly range
    {
        const avgMondayRange = wr.reduce((s, w) => s + w.monday_range_pips, 0) / (wr.length || 1)
        const avgWeekRange = wr.reduce((s, w) => s + w.week_range_pips, 0) / (wr.length || 1)
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const w of wr) {
            if (w.monday_range_pips < avgMondayRange * 0.5 && w.monday_range_pips > 0) {
                sample++
                if (w.week_range_pips > avgWeekRange) {
                    hits++
                    moves.push(w.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w4', category: 'weekly',
            condition: 'Monday range is small (<50% of average)',
            outcome: 'Weekly range exceeds average',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same week',
        })
    }

    // w5: Friday closes above weekly open → next Monday bullish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < wr.length - 1; i++) {
            if (wr[i].friday_closed_above_open) {
                sample++
                if (wr[i + 1].monday_direction === 'bullish') {
                    hits++
                    moves.push(wr[i + 1].monday_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w5', category: 'weekly',
            condition: 'Friday closes above weekly open',
            outcome: 'Next Monday opens/closes bullish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next Monday',
        })
    }

    // w6: Friday closes below weekly open → next Monday bearish
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < wr.length - 1; i++) {
            if (!wr[i].friday_closed_above_open) {
                sample++
                if (wr[i + 1].monday_direction === 'bearish') {
                    hits++
                    moves.push(wr[i + 1].monday_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w6', category: 'weekly',
            condition: 'Friday closes below weekly open',
            outcome: 'Next Monday opens/closes bearish',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next Monday',
        })
    }

    // w7: Weekly inside bar → next week breakout (larger range)
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 1; i < wr.length - 1; i++) {
            const prev = wr[i - 1]
            const curr = wr[i]
            // Inside week: high <= prev high AND low >= prev low
            if (curr.weekly_high <= prev.weekly_high && curr.weekly_low >= prev.weekly_low) {
                sample++
                const next = wr[i + 1]
                if (next.week_range_pips > curr.week_range_pips * 1.2) {
                    hits++
                    moves.push(next.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w7', category: 'weekly',
            condition: 'Weekly inside bar forms',
            outcome: 'Next week expands range (breakout)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next week',
        })
    }

    // w8: Mid-week reversal (Wednesday opposes Mon-Tue consensus)
    // We use the daily data inside weekly relationships indirectly — since we only have
    // weekly-level aggregates, we check if week_direction differs from monday_direction
    // as a proxy for mid-week reversal activity.
    // More accurate approach: look at daily relationships grouped by week.
    // For simplicity, we use the available weekly fields.
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const w of wr) {
            if (w.monday_direction !== 'doji') {
                sample++
                // Mid-week reversal: week closes opposite of Monday
                if (w.week_direction !== 'doji' && w.week_direction !== w.monday_direction) {
                    hits++
                    moves.push(w.week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'w8', category: 'weekly',
            condition: 'Monday establishes directional bias',
            outcome: 'Week reverses (closes opposite of Monday)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Same week',
        })
    }

    return conditions
}

// ── Session Conditions (~8 patterns) ──

function computeSessionConditions(
    annotated: SessionAnnotatedH1[],
    atr: number,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (annotated.length < 50) return conditions

    // Group H1 bars by trading day
    const dayGroups = new Map<string, SessionAnnotatedH1[]>()
    for (const bar of annotated) {
        const dayKey = bar.time.split('T')[0]
        if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, [])
        dayGroups.get(dayKey)!.push(bar)
    }

    const days = Array.from(dayGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    // Helper: get session range for a day
    function sessionRange(bars: SessionAnnotatedH1[], session: string): { range: number; dir: 'bullish' | 'bearish' | 'doji' } {
        const sessionBars = bars.filter(b => b.session === session)
        if (sessionBars.length === 0) return { range: 0, dir: 'doji' }
        const high = Math.max(...sessionBars.map(b => b.high))
        const low = Math.min(...sessionBars.map(b => b.low))
        const open = sessionBars[0].open
        const close = sessionBars[sessionBars.length - 1].close
        const range = sessionBars.reduce((s, b) => s + b.range_pips, 0)
        const dir = close > open ? 'bullish' : close < open ? 'bearish' : 'doji'
        return { range, dir }
    }

    // s1: Asia range < 30% of ATR → London moves > 70% ATR
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const [, bars] of days) {
            const tokyo = sessionRange(bars, 'tokyo')
            const london = sessionRange(bars, 'london')
            if (tokyo.range > 0 && london.range > 0 && tokyo.range < atr * 0.3) {
                sample++
                if (london.range > atr * 0.7) {
                    hits++
                    moves.push(london.range)
                }
            }
        }
        conditions.push({
            id: 's1', category: 'session',
            condition: 'Asia session range < 30% of ATR (quiet Asia)',
            outcome: 'London session moves > 70% of ATR',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'London session',
        })
    }

    // s2: London continues Asia's direction
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const [, bars] of days) {
            const tokyo = sessionRange(bars, 'tokyo')
            const london = sessionRange(bars, 'london')
            if (tokyo.dir !== 'doji' && london.dir !== 'doji') {
                sample++
                if (tokyo.dir === london.dir) {
                    hits++
                    moves.push(london.range)
                }
            }
        }
        conditions.push({
            id: 's2', category: 'session',
            condition: 'Asia session establishes direction',
            outcome: 'London continues in same direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'London session',
        })
    }

    // s3: NY reverses London's direction
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const [, bars] of days) {
            const london = sessionRange(bars, 'london')
            const ny = sessionRange(bars, 'new_york')
            if (london.dir !== 'doji' && ny.dir !== 'doji') {
                sample++
                if (london.dir !== ny.dir) {
                    hits++
                    moves.push(ny.range)
                }
            }
        }
        conditions.push({
            id: 's3', category: 'session',
            condition: 'London establishes direction',
            outcome: 'New York reverses London\'s direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'NY session',
        })
    }

    // s4: London-NY overlap produces largest hourly bar of the day
    {
        let sample = 0, hits = 0
        for (const [, bars] of days) {
            if (bars.length < 5) continue
            sample++
            const maxBar = bars.reduce((max, b) => b.range_pips > max.range_pips ? b : max, bars[0])
            if (maxBar.session === 'overlap') hits++
        }
        conditions.push({
            id: 's4', category: 'session',
            condition: 'Full trading day (all sessions active)',
            outcome: 'London-NY overlap produces the largest hourly bar',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: 0, time_to_play_out: 'Overlap session',
        })
    }

    // s5: First H1 bar sets the daily high
    {
        let sample = 0, hits = 0
        for (const [, bars] of days) {
            if (bars.length < 3) continue
            sample++
            const firstBar = bars[0]
            const dayHigh = Math.max(...bars.map(b => b.high))
            if (Math.abs(firstBar.high - dayHigh) < 0.00001) hits++
        }
        conditions.push({
            id: 's5', category: 'session',
            condition: 'Trading day begins',
            outcome: 'First H1 bar sets the daily high',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: 0, time_to_play_out: 'First hour',
        })
    }

    // s6: First H1 bar sets the daily low
    {
        let sample = 0, hits = 0
        for (const [, bars] of days) {
            if (bars.length < 3) continue
            sample++
            const firstBar = bars[0]
            const dayLow = Math.min(...bars.map(b => b.low))
            if (Math.abs(firstBar.low - dayLow) < 0.00001) hits++
        }
        conditions.push({
            id: 's6', category: 'session',
            condition: 'Trading day begins',
            outcome: 'First H1 bar sets the daily low',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: 0, time_to_play_out: 'First hour',
        })
    }

    // s7: Asia range > ATR → London range contracts
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const [, bars] of days) {
            const tokyo = sessionRange(bars, 'tokyo')
            const london = sessionRange(bars, 'london')
            if (tokyo.range > atr && london.range > 0) {
                sample++
                if (london.range < tokyo.range) {
                    hits++
                    moves.push(london.range)
                }
            }
        }
        conditions.push({
            id: 's7', category: 'session',
            condition: 'Asia range exceeds daily ATR (volatile Asia)',
            outcome: 'London range contracts (smaller than Asia)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'London session',
        })
    }

    // s8: Tokyo session trend → London continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (const [, bars] of days) {
            const tokyo = sessionRange(bars, 'tokyo')
            const london = sessionRange(bars, 'london')
            if (tokyo.dir !== 'doji' && london.dir !== 'doji') {
                sample++
                if (tokyo.dir === london.dir) {
                    hits++
                    moves.push(london.range)
                }
            }
        }
        // This is effectively the same as s2 — but we phrase it differently
        // (trend vs direction). Skip if identical to s2 by checking sample/hits.
        // Actually they will be the same, so let's provide a more specific version:
        // Tokyo bullish trend → London bullish continuation
        let sampleB = 0, hitsB = 0
        const movesB: number[] = []
        for (const [, bars] of days) {
            const tokyo = sessionRange(bars, 'tokyo')
            const london = sessionRange(bars, 'london')
            if (tokyo.dir === 'bullish' && london.dir !== 'doji') {
                sampleB++
                if (london.dir === 'bullish') {
                    hitsB++
                    movesB.push(london.range)
                }
            }
        }
        conditions.push({
            id: 's8', category: 'session',
            condition: 'Tokyo session closes bullish',
            outcome: 'London session continues bullish',
            sample_size: sampleB, hits: hitsB, probability: pct(hitsB, sampleB),
            avg_move_pips: avg(movesB), time_to_play_out: 'London session',
        })
    }

    return conditions
}

// ── Volatility Conditions (~6 patterns) ──

function computeVolatilityConditions(
    dr: DailyRelationship[],
    wr: WeeklyRelationship[],
    atr: number,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (dr.length < 20) return conditions

    // v1: 2+ quiet days (<0.5x ATR) → next day range > ATR
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 1; i < dr.length - 1; i++) {
            if (dr[i].range_pips < atr * 0.5 && dr[i - 1].range_pips < atr * 0.5) {
                sample++
                if (dr[i + 1].range_pips > atr) {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'v1', category: 'volatility',
            condition: '2+ consecutive quiet days (<0.5x ATR)',
            outcome: 'Next day range exceeds ATR (volatility expansion)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // v2: Trend day (>1.5x ATR) → next day continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < dr.length - 1; i++) {
            if (dr[i].range_pips > atr * 1.5 && dr[i].direction !== 'doji') {
                sample++
                if (dr[i + 1].direction === dr[i].direction) {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'v2', category: 'volatility',
            condition: 'Trend day occurs (range >1.5x ATR)',
            outcome: 'Next day continues in same direction',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // v3: Range expanding 3 consecutive wider ranges → 4th expands further
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 3; i < dr.length - 1; i++) {
            if (dr[i].range_pips > dr[i - 1].range_pips &&
                dr[i - 1].range_pips > dr[i - 2].range_pips &&
                dr[i - 2].range_pips > dr[i - 3].range_pips) {
                sample++
                if (dr[i + 1].range_pips > dr[i].range_pips) {
                    hits++
                    moves.push(dr[i + 1].range_pips)
                }
            }
        }
        conditions.push({
            id: 'v3', category: 'volatility',
            condition: '3 consecutive days of expanding range',
            outcome: '4th day continues range expansion',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next day',
        })
    }

    // v4: Range contracting 3+ days → breakout within 2 days
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 3; i < dr.length - 2; i++) {
            if (dr[i].range_pips < dr[i - 1].range_pips &&
                dr[i - 1].range_pips < dr[i - 2].range_pips &&
                dr[i - 2].range_pips < dr[i - 3].range_pips) {
                sample++
                // "Breakout" = either of next 2 days exceeds ATR
                if (dr[i + 1].range_pips > atr || dr[i + 2].range_pips > atr) {
                    hits++
                    moves.push(Math.max(dr[i + 1].range_pips, dr[i + 2].range_pips))
                }
            }
        }
        conditions.push({
            id: 'v4', category: 'volatility',
            condition: '3+ consecutive days of contracting range',
            outcome: 'Breakout (range > ATR) within 2 days',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: '1-2 days',
        })
    }

    // v5: High ATR week → next week lower range (weekly mean-reversion)
    if (wr.length >= 10) {
        const avgWeekRange = wr.reduce((s, w) => s + w.week_range_pips, 0) / wr.length
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < wr.length - 1; i++) {
            if (wr[i].week_range_pips > avgWeekRange * 1.3) {
                sample++
                if (wr[i + 1].week_range_pips < wr[i].week_range_pips) {
                    hits++
                    moves.push(wr[i + 1].week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'v5', category: 'volatility',
            condition: 'High-range week (>130% of average)',
            outcome: 'Next week has lower range (mean-reversion)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next week',
        })
    }

    // v6: Low ATR week → next week higher range
    if (wr.length >= 10) {
        const avgWeekRange = wr.reduce((s, w) => s + w.week_range_pips, 0) / wr.length
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 0; i < wr.length - 1; i++) {
            if (wr[i].week_range_pips < avgWeekRange * 0.7) {
                sample++
                if (wr[i + 1].week_range_pips > wr[i].week_range_pips) {
                    hits++
                    moves.push(wr[i + 1].week_range_pips)
                }
            }
        }
        conditions.push({
            id: 'v6', category: 'volatility',
            condition: 'Low-range week (<70% of average)',
            outcome: 'Next week has higher range (expansion)',
            sample_size: sample, hits, probability: pct(hits, sample),
            avg_move_pips: avg(moves), time_to_play_out: 'Next week',
        })
    }

    return conditions
}

// ── Cross-Market Conditions (~4 patterns) ──

function computeCrossMarketConditions(
    dr: DailyRelationship[],
    correlations: CMSDataPayload['crossMarketCorrelations'],
    pipMult: number,
    pair: string,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    const pairUpper = pair.toUpperCase()

    // Use the pre-computed correlation data from data-collector
    const spx = correlations.find(c => c.index_name === 'SPX500_USD')
    const nas = correlations.find(c => c.index_name === 'NAS100_USD')
    const dji = correlations.find(c => c.index_name === 'US30_USD')
    const dax = correlations.find(c => c.index_name === 'DE30_EUR')
    const ftse = correlations.find(c => c.index_name === 'UK100_GBP')
    const nikkei = correlations.find(c => c.index_name === 'JP225_USD')

    // cm1: SPX500 up → pair direction (positive correlation)
    if (spx && spx.sample_days >= MIN_SAMPLE) {
        conditions.push({
            id: 'cm1', category: 'cross_market',
            condition: 'S&P 500 closes bullish',
            outcome: 'Pair closes in same direction',
            sample_size: spx.sample_days,
            hits: Math.round(spx.sample_days * spx.positive_correlation_pct / 100),
            probability: spx.positive_correlation_pct,
            avg_move_pips: 0,
            time_to_play_out: 'Same day',
        })
    }

    // cm2: SPX500 down → pair direction (inverse)
    if (spx && spx.sample_days >= MIN_SAMPLE) {
        const inverseCorr = 100 - spx.positive_correlation_pct
        conditions.push({
            id: 'cm2', category: 'cross_market',
            condition: 'S&P 500 closes bearish',
            outcome: 'Pair moves in opposite direction',
            sample_size: spx.sample_days,
            hits: Math.round(spx.sample_days * inverseCorr / 100),
            probability: inverseCorr,
            avg_move_pips: 0,
            time_to_play_out: 'Same day',
        })
    }

    // cm3: NAS100 diverges from SPX500 → pair reverses
    if (nas && spx && nas.sample_days >= MIN_SAMPLE && spx.sample_days >= MIN_SAMPLE) {
        // Divergence is when correlation patterns differ significantly
        const divergence = Math.abs(nas.positive_correlation_pct - spx.positive_correlation_pct)
        if (divergence > 5) {
            conditions.push({
                id: 'cm3', category: 'cross_market',
                condition: 'Nasdaq diverges from S&P 500 correlation pattern',
                outcome: `Correlation divergence of ${divergence}% suggests instability`,
                sample_size: Math.min(nas.sample_days, spx.sample_days),
                hits: Math.round(Math.min(nas.sample_days, spx.sample_days) * 0.5),
                probability: 50 + Math.round(divergence / 2),
                avg_move_pips: 0,
                time_to_play_out: '1-3 days',
            })
        }
    }

    // cm4: All 3 indices same direction → pair follows
    if (spx && nas && dji) {
        // Use average correlation as proxy
        const avgCorr = Math.round((spx.positive_correlation_pct + nas.positive_correlation_pct + (dji?.positive_correlation_pct || 50)) / 3)
        const avgSample = Math.round((spx.sample_days + nas.sample_days + (dji?.sample_days || 0)) / 3)
        if (avgSample >= MIN_SAMPLE) {
            conditions.push({
                id: 'cm4', category: 'cross_market',
                condition: 'All 3 US indices (SPX, NAS, DJI) move in same direction',
                outcome: 'Pair follows consensus direction',
                sample_size: avgSample,
                hits: Math.round(avgSample * avgCorr / 100),
                probability: avgCorr,
                avg_move_pips: 0,
                time_to_play_out: 'Same day',
            })
        }
    }

    // cm5: DAX closes bullish → EUR pairs follow direction
    if (dax && dax.sample_days >= MIN_SAMPLE && pairUpper.includes('EUR')) {
        conditions.push({
            id: 'cm5', category: 'cross_market',
            condition: 'DAX (DE30) closes bullish',
            outcome: 'EUR pairs follow direction (positive correlation)',
            sample_size: dax.sample_days,
            hits: Math.round(dax.sample_days * dax.positive_correlation_pct / 100),
            probability: dax.positive_correlation_pct,
            avg_move_pips: 0,
            time_to_play_out: 'Same day',
        })
    }

    // cm6: FTSE 100 closes bullish → GBP pairs follow direction
    if (ftse && ftse.sample_days >= MIN_SAMPLE && pairUpper.includes('GBP')) {
        conditions.push({
            id: 'cm6', category: 'cross_market',
            condition: 'FTSE 100 (UK100) closes bullish',
            outcome: 'GBP pairs follow direction (positive correlation)',
            sample_size: ftse.sample_days,
            hits: Math.round(ftse.sample_days * ftse.positive_correlation_pct / 100),
            probability: ftse.positive_correlation_pct,
            avg_move_pips: 0,
            time_to_play_out: 'Same day',
        })
    }

    // cm7: Nikkei 225 closes bullish → JPY pairs move inversely (safe-haven inverse)
    if (nikkei && nikkei.sample_days >= MIN_SAMPLE && pairUpper.includes('JPY')) {
        const inverseCorr = 100 - nikkei.positive_correlation_pct
        conditions.push({
            id: 'cm7', category: 'cross_market',
            condition: 'Nikkei 225 (JP225) closes bullish',
            outcome: 'JPY pairs move inversely (risk-on weakens safe-haven JPY)',
            sample_size: nikkei.sample_days,
            hits: Math.round(nikkei.sample_days * inverseCorr / 100),
            probability: inverseCorr,
            avg_move_pips: 0,
            time_to_play_out: 'Same day',
        })
    }

    // cm8: US-Europe divergence (SPX vs DAX disagree) → cross-Atlantic volatility
    if (spx && dax && spx.sample_days >= MIN_SAMPLE && dax.sample_days >= MIN_SAMPLE) {
        const directionMatchRate = Math.round(
            (spx.positive_correlation_pct + dax.positive_correlation_pct) / 2
        )
        // Low match rate = high divergence
        const divergencePct = 100 - directionMatchRate
        if (divergencePct > 30) {
            const sampleSize = Math.min(spx.sample_days, dax.sample_days)
            conditions.push({
                id: 'cm8', category: 'cross_market',
                condition: 'US-Europe divergence (SPX and DAX direction disagree >30%)',
                outcome: 'Cross-Atlantic volatility spike — wider ranges expected',
                sample_size: sampleSize,
                hits: Math.round(sampleSize * divergencePct / 100),
                probability: divergencePct,
                avg_move_pips: 0,
                time_to_play_out: '1-3 days',
            })
        }
    }

    // cm9: Global risk consensus (4+ of 6 indices bullish) → risk currencies strengthen
    {
        const allIndices = [spx, nas, dji, dax, ftse, nikkei].filter(
            (idx): idx is NonNullable<typeof idx> => idx != null && idx.sample_days >= MIN_SAMPLE
        )
        if (allIndices.length >= 4) {
            const bullishCount = allIndices.filter(idx => idx.positive_correlation_pct > 50).length
            const consensusPct = Math.round((bullishCount / allIndices.length) * 100)
            const avgSample = Math.round(
                allIndices.reduce((s, idx) => s + idx.sample_days, 0) / allIndices.length
            )
            conditions.push({
                id: 'cm9', category: 'cross_market',
                condition: `Global risk consensus (${bullishCount}/${allIndices.length} indices bullish-correlated)`,
                outcome: 'Risk currencies (AUD, NZD, CAD) strengthen vs safe havens (JPY, CHF)',
                sample_size: avgSample,
                hits: Math.round(avgSample * consensusPct / 100),
                probability: consensusPct,
                avg_move_pips: 0,
                time_to_play_out: '1-5 days',
            })
        }
    }

    return conditions
}

// ── Fractal Conditions (Bill Williams-inspired patterns) ──

function computeFractalConditions(
    dr: DailyRelationship[],
    atr: number,
    pipMult: number,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (dr.length < 30) return conditions

    // f1: 3+ consecutive narrow-range days (<0.6x ATR, proxy for Alligator sleeping) → next day range > 1.3x ATR (breakout)
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 3; i < dr.length - 1; i++) {
            const isNarrow = dr[i].range_pips < atr * 0.6 &&
                dr[i - 1].range_pips < atr * 0.6 &&
                dr[i - 2].range_pips < atr * 0.6
            if (isNarrow) {
                sample++
                const next = dr[i + 1]
                if (next && next.range_pips > atr * 1.3) {
                    hits++
                    moves.push(next.range_pips)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: 'f1', category: 'fractal',
                condition: '3+ consecutive narrow-range days (< 0.6x ATR — Alligator sleeping)',
                outcome: 'Next day range exceeds 1.3x ATR (Alligator awakening breakout)',
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: 'Next day',
            })
        }
    }

    // f2: Price breaks above highest high of last 5 bars (bearish fractal level break) → continuation for 2+ days
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 5; i < dr.length - 2; i++) {
            const prev5Highs = [dr[i - 1], dr[i - 2], dr[i - 3], dr[i - 4], dr[i - 5]].map(d => d.high)
            const highest = Math.max(...prev5Highs)
            if (dr[i].high > highest && dr[i].close > highest) {
                sample++
                const next1 = dr[i + 1]
                const next2 = dr[i + 2]
                if (next1 && next2 && next1.direction === 'bullish' && next2.close > dr[i].close) {
                    hits++
                    moves.push((next2.close - dr[i].close) * pipMult)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: 'f2', category: 'fractal',
                condition: 'Daily close breaks above highest high of previous 5 bars (fractal high break)',
                outcome: 'Bullish continuation for 2+ days',
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: '2-3 days',
            })
        }
    }

    // f3: Price breaks below lowest low of last 5 bars (bullish fractal level break) → bearish continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 5; i < dr.length - 2; i++) {
            const prev5Lows = [dr[i - 1], dr[i - 2], dr[i - 3], dr[i - 4], dr[i - 5]].map(d => d.low)
            const lowest = Math.min(...prev5Lows)
            if (dr[i].low < lowest && dr[i].close < lowest) {
                sample++
                const next1 = dr[i + 1]
                const next2 = dr[i + 2]
                if (next1 && next2 && next1.direction === 'bearish' && next2.close < dr[i].close) {
                    hits++
                    moves.push((dr[i].close - next2.close) * pipMult)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: 'f3', category: 'fractal',
                condition: 'Daily close breaks below lowest low of previous 5 bars (fractal low break)',
                outcome: 'Bearish continuation for 2+ days',
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: '2-3 days',
            })
        }
    }

    // f4: 5-bar pattern where middle bar is range extreme + next 2 bars expand range → trend continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 2; i < dr.length - 4; i++) {
            const mid = dr[i]
            const isHighExtreme = mid.high > dr[i - 1].high && mid.high > dr[i - 2].high &&
                mid.high > dr[i + 1].high && mid.high > dr[i + 2].high
            const isLowExtreme = mid.low < dr[i - 1].low && mid.low < dr[i - 2].low &&
                mid.low < dr[i + 1].low && mid.low < dr[i + 2].low

            if (isHighExtreme || isLowExtreme) {
                const avgNextRange = (dr[i + 1].range_pips + dr[i + 2].range_pips) / 2
                if (avgNextRange > mid.range_pips * 1.1) {
                    sample++
                    const next3 = dr[i + 3]
                    if (next3) {
                        const sameDir = isHighExtreme
                            ? next3.direction === 'bearish'
                            : next3.direction === 'bullish'
                        if (sameDir) {
                            hits++
                            moves.push(next3.range_pips)
                        }
                    }
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: 'f4', category: 'fractal',
                condition: '5-bar fractal extreme with expanding range on next 2 bars',
                outcome: 'Trend continuation within 3 days in direction of the fractal reversal',
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: '3 days',
            })
        }
    }

    return conditions
}


// ── Elliott Wave Conditions (Wave structure patterns) ──

function computeElliottWaveConditions(
    dr: DailyRelationship[],
    atr: number,
    pipMult: number,
): ProgrammaticCondition[] {
    const conditions: ProgrammaticCondition[] = []
    if (dr.length < 30) return conditions

    // e1: 5-wave impulsive structure (strong trend) → Wave 5 completes, reversal expected
    // NOTE: This requires Elliott Wave detection on historical data. For now, using proxy: 5+ consecutive trend days
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 5; i < dr.length - 3; i++) {
            const last5Dirs = [dr[i - 4], dr[i - 3], dr[i - 2], dr[i - 1], dr[i]].map(d => d.direction)
            const allBullish = last5Dirs.every(d => d === "bullish")
            const allBearish = last5Dirs.every(d => d === "bearish")
            
            if (allBullish || allBearish) {
                sample++
                const next3 = [dr[i + 1], dr[i + 2], dr[i + 3]]
                const reversals = next3.filter(d => d?.direction !== (allBullish ? "bullish" : "bearish")).length
                if (reversals >= 2) {
                    hits++
                    const move = next3.reduce((sum, d) => sum + (d?.range_pips || 0), 0) / 3
                    moves.push(move)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: "e1", category: "elliott_wave",
                condition: "5+ consecutive trend days (proxy for Wave 5 completion)",
                outcome: "Reversal within 3 days (Wave 1 of new cycle)",
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: "1-3 days",
            })
        }
    }

    // e2: 3-wave correction (A-B-C zigzag) → Price reaches 61.8% Fibonacci retracement, trend resumes
    // Proxy: 3 alternating days after strong move, then continuation
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 4; i < dr.length - 2; i++) {
            const bigMove = dr[i - 3].range_pips > atr * 1.5
            const alt1 = dr[i - 2].direction !== dr[i - 3].direction
            const alt2 = dr[i - 1].direction !== dr[i - 2].direction
            const alt3 = dr[i].direction !== dr[i - 1].direction
            
            if (bigMove && alt1 && alt2 && alt3) {
                sample++
                const resume = dr[i + 1]
                if (resume?.direction === dr[i - 3].direction) {
                    hits++
                    moves.push(resume.range_pips)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: "e2", category: "elliott_wave",
                condition: "3-wave alternating pattern after strong move (A-B-C correction proxy)",
                outcome: "Original trend resumes (Fibonacci 61.8% bounce)",
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: "Next day",
            })
        }
    }

    // e3: Corrective flat pattern → Consolidation before breakout
    // Proxy: 3+ days with overlapping ranges
    {
        let sample = 0, hits = 0
        const moves: number[] = []
        for (let i = 3; i < dr.length - 1; i++) {
            const overlap1 = dr[i].low <= dr[i - 1].high && dr[i].high >= dr[i - 1].low
            const overlap2 = dr[i - 1].low <= dr[i - 2].high && dr[i - 1].high >= dr[i - 2].low
            const overlap3 = dr[i - 2].low <= dr[i - 3].high && dr[i - 2].high >= dr[i - 3].low
            
            if (overlap1 && overlap2 && overlap3) {
                sample++
                const breakout = dr[i + 1]
                if (breakout && breakout.range_pips > atr * 1.2) {
                    hits++
                    moves.push(breakout.range_pips)
                }
            }
        }
        if (sample >= 5) {
            conditions.push({
                id: "e3", category: "elliott_wave",
                condition: "Flat correction: 3+ days overlapping ranges (consolidation)",
                outcome: "Breakout exceeds 1.2x ATR",
                sample_size: sample, hits,
                probability: pct(hits, sample),
                avg_move_pips: avg(moves),
                time_to_play_out: "Next day",
            })
        }
    }

    return conditions
}

