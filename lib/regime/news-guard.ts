/**
 * News Guard — Event-Aware Trading Gate
 *
 * Wraps the existing Forex Factory calendar to provide:
 * 1. isNewsBlackout() — blocks Divisions 1 & 2 near HIGH-impact events
 * 2. isGhostWindow()  — activates Division 3 (Ghost Bot) 1-3 min after event
 *
 * The Ghost bot is kept offline 99% of the time. It only turns on
 * exactly 1 minute after a major news event and shuts off at 3 minutes.
 */

import { fetchForexFactoryCalendar, type ForexFactoryEvent } from '@/lib/news/forex-factory-client'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface NewsBlackout {
    blackout: boolean
    event: string | null
    minutesSinceRelease: number | null
    minutesUntilRelease: number | null
}

export interface GhostWindow {
    active: boolean
    event: string | null
    minutesSinceEvent: number | null
}

export interface UpcomingNewsEvent {
    title: string
    currency: string
    time: string
    impact: string
    minutesUntil: number
}

// Currency → pairs mapping (which pairs are affected by each currency's news)
const CURRENCY_TO_PAIRS: Record<string, string[]> = {
    'USD': ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'],
    'EUR': ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/AUD'],
    'GBP': ['GBP/USD', 'EUR/GBP', 'GBP/JPY', 'GBP/CHF', 'GBP/AUD'],
    'JPY': ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY'],
    'AUD': ['AUD/USD', 'EUR/AUD', 'GBP/AUD', 'AUD/JPY', 'AUD/NZD'],
    'CAD': ['USD/CAD', 'EUR/CAD', 'GBP/CAD', 'CAD/JPY'],
    'CHF': ['USD/CHF', 'EUR/CHF', 'GBP/CHF', 'CHF/JPY'],
    'NZD': ['NZD/USD', 'EUR/NZD', 'GBP/NZD', 'NZD/JPY', 'AUD/NZD'],
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get HIGH-impact events from Forex Factory that affect a specific pair.
 * Returns events sorted by time distance from now (nearest first).
 */
async function getHighImpactEventsForPair(pair: string): Promise<{
    recent: (ForexFactoryEvent & { minutesSince: number })[]
    upcoming: (ForexFactoryEvent & { minutesUntil: number })[]
}> {
    const events = await fetchForexFactoryCalendar()
    const now = new Date()

    // Extract currencies from pair (e.g., "EUR/USD" → ["EUR", "USD"])
    const currencies = pair.split('/').map(c => c.trim())

    const recent: (ForexFactoryEvent & { minutesSince: number })[] = []
    const upcoming: (ForexFactoryEvent & { minutesUntil: number })[] = []

    for (const event of events) {
        // Only HIGH-impact events
        if (event.impact !== 'High') continue

        // Only events that affect our pair's currencies
        if (!currencies.includes(event.currency)) continue

        const eventTime = new Date(event.date)
        const diffMs = now.getTime() - eventTime.getTime()
        const diffMinutes = diffMs / 60000

        if (diffMinutes > 0) {
            // Event already happened
            recent.push({ ...event, minutesSince: diffMinutes })
        } else {
            // Event in the future
            upcoming.push({ ...event, minutesUntil: Math.abs(diffMinutes) })
        }
    }

    // Sort: recent by most recent first, upcoming by nearest first
    recent.sort((a, b) => a.minutesSince - b.minutesSince)
    upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil)

    return { recent, upcoming }
}

// ═══════════════════════════════════════════════════════════════════════════
// News Blackout (Divisions 1 & 2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a pair should be in news blackout mode.
 *
 * Blackout is active when:
 * - A HIGH-impact event occurred in the last 5 minutes (post-release volatility)
 * - A HIGH-impact event is scheduled within the next 2 minutes (pre-release)
 *
 * During blackout, Divisions 1 (Sniper) and 2 (Rider) halt.
 * Division 3 (Ghost) uses its own separate window via isGhostWindow().
 */
export async function isNewsBlackout(pair: string): Promise<NewsBlackout> {
    try {
        const { recent, upcoming } = await getHighImpactEventsForPair(pair)

        // Check recent events (within 5 minutes)
        const recentEvent = recent.find(e => e.minutesSince <= 5)
        if (recentEvent) {
            return {
                blackout: true,
                event: recentEvent.title,
                minutesSinceRelease: Math.round(recentEvent.minutesSince * 10) / 10,
                minutesUntilRelease: null,
            }
        }

        // Check upcoming events (within 2 minutes)
        const upcomingEvent = upcoming.find(e => e.minutesUntil <= 2)
        if (upcomingEvent) {
            return {
                blackout: true,
                event: upcomingEvent.title,
                minutesSinceRelease: null,
                minutesUntilRelease: Math.round(upcomingEvent.minutesUntil * 10) / 10,
            }
        }

        return { blackout: false, event: null, minutesSinceRelease: null, minutesUntilRelease: null }
    } catch (error) {
        console.error('[NewsGuard] Error checking blackout:', error)
        // On error, assume no blackout (fail-open for non-critical gate)
        return { blackout: false, event: null, minutesSinceRelease: null, minutesUntilRelease: null }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Ghost Window (Division 3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if the Ghost Bot activation window is active for a pair.
 *
 * Ghost window is active when:
 * - A HIGH-impact event occurred exactly 1-3 minutes ago
 *
 * This is the narrow window where:
 * 1. The initial algorithmic fakeout ("Judas Swing") has occurred
 * 2. Retail traders are trapped on the wrong side
 * 3. The Ghost bot enters opposite the initial spike
 *
 * Outside of this window, the Ghost bot is completely offline.
 */
export async function isGhostWindow(pair: string): Promise<GhostWindow> {
    try {
        const { recent } = await getHighImpactEventsForPair(pair)

        // Find an event that occurred 1-3 minutes ago (the exact Ghost window)
        const ghostEvent = recent.find(e => e.minutesSince >= 1 && e.minutesSince <= 3)

        if (ghostEvent) {
            return {
                active: true,
                event: ghostEvent.title,
                minutesSinceEvent: Math.round(ghostEvent.minutesSince * 10) / 10,
            }
        }

        return { active: false, event: null, minutesSinceEvent: null }
    } catch (error) {
        console.error('[NewsGuard] Error checking ghost window:', error)
        // On error, keep Ghost offline (fail-closed for execution gate)
        return { active: false, event: null, minutesSinceEvent: null }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Regime Monitor Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get upcoming HIGH-impact events for the Dashboard display.
 * Returns events within the next N hours.
 */
export async function getUpcomingHighImpactEvents(
    hoursAhead: number = 4,
): Promise<UpcomingNewsEvent[]> {
    try {
        const events = await fetchForexFactoryCalendar()
        const now = new Date()
        const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

        const result: UpcomingNewsEvent[] = []

        for (const event of events) {
            if (event.impact !== 'High') continue

            const eventTime = new Date(event.date)
            if (eventTime < now || eventTime > cutoff) continue

            result.push({
                title: event.title,
                currency: event.currency,
                time: event.date,
                impact: event.impact,
                minutesUntil: Math.round((eventTime.getTime() - now.getTime()) / 60000),
            })
        }

        return result.sort((a, b) => a.minutesUntil - b.minutesUntil)
    } catch (error) {
        console.error('[NewsGuard] Error fetching upcoming events:', error)
        return []
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// Market Hours & Holiday Gate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if current time is within 8 AM - 4 PM ET (New York) trading hours.
 * Also checks for weekends and basic holidays.
 */
export function isMarketHours(): {
    open: boolean
    reason: string | null
    minutesUntilClose: number | null
} {
    // Current time in New York
    const now = new Date()
    const nyTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
        weekday: 'long',
    }).formatToParts(now)

    const getPart = (p: string) => nyTime.find(x => x.type === p)?.value
    const day = getPart('weekday')
    const hour = parseInt(getPart('hour') ?? '0')
    const minute = parseInt(getPart('minute') ?? '0')

    // 1. Weekend check
    if (day === 'Saturday' || day === 'Sunday') {
        return { open: false, reason: 'Market closed (Weekend)', minutesUntilClose: 0 }
    }

    // 2. Holiday check (Simplified for major trading holidays)
    const month = now.getMonth() + 1
    const date = now.getDate()
    const isHoliday = (month === 1 && date === 1) || // New Year
                      (month === 12 && date === 25) || // Christmas
                      (month === 7 && date === 4)   // July 4th
    
    if (isHoliday) {
        return { open: false, reason: 'Market closed (Holiday)', minutesUntilClose: 0 }
    }

    // 3. 8 AM - 4 PM ET check
    if (hour < 8 || hour >= 16) {
        return { open: false, reason: `Market closed (NY Time: ${hour}:${minute.toString().padStart(2, '0')})`, minutesUntilClose: 0 }
    }

    // Minutes until NY close (16:00)
    const minutesUntilClose = (16 - hour) * 60 - minute

    return {
        open: true,
        reason: null,
        minutesUntilClose
    }
}
