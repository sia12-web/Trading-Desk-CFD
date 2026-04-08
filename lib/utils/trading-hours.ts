/**
 * Trading Hours Enforcement
 *
 * CRITICAL RULE: Only trade 9:00 AM - 4:30 PM EST (New York hours)
 * - No positions held after 4:30 PM
 * - Auto-flatten any open positions at 4:25 PM (5-minute buffer)
 */

export interface TradingHoursStatus {
    isOpen: boolean
    message: string
    currentTimeEST: Date
    marketPhase: 'pre-market' | 'active' | 'closing-soon' | 'closed'
    minutesUntilClose: number | null
    shouldFlattenPositions: boolean
}

export function checkTradingHours(now: Date = new Date()): TradingHoursStatus {
    const estTime = convertToEST(now)
    const hour = estTime.getHours()
    const minute = estTime.getMinutes()
    const currentMinutes = hour * 60 + minute

    const marketOpen = 9 * 60  // 9:00 AM
    const marketClose = 16 * 60 + 30  // 4:30 PM
    const flattenTime = marketClose - 5  // 4:25 PM

    const isOpen = currentMinutes >= marketOpen && currentMinutes < marketClose
    const shouldFlatten = currentMinutes >= flattenTime && currentMinutes < marketClose
    const minutesUntilClose = isOpen ? marketClose - currentMinutes : null

    let marketPhase: TradingHoursStatus['marketPhase']
    let message: string

    if (currentMinutes < marketOpen) {
        marketPhase = 'pre-market'
        const minutesUntilOpen = marketOpen - currentMinutes
        message = `Pre-market. NY opens in ${minutesUntilOpen} minutes`
    } else if (currentMinutes >= marketOpen && currentMinutes < flattenTime) {
        marketPhase = 'active'
        message = `✅ TRADING HOURS ACTIVE (${minutesUntilClose} min until close)`
    } else if (shouldFlatten) {
        marketPhase = 'closing-soon'
        message = `⚠️ CLOSING SOON - Flatten all positions (${minutesUntilClose} min left)`
    } else {
        marketPhase = 'closed'
        message = `❌ MARKET CLOSED. No positions allowed.`
    }

    return { isOpen, message, currentTimeEST: estTime, marketPhase, minutesUntilClose, shouldFlattenPositions: shouldFlatten }
}

function convertToEST(utcDate: Date): Date {
    const estOffset = -5 * 60
    const localOffset = utcDate.getTimezoneOffset()
    const totalOffset = estOffset - localOffset
    return new Date(utcDate.getTime() + (totalOffset * 60 * 1000))
}

export function canEnterTrade(now: Date = new Date()): { allowed: boolean; reason: string } {
    const status = checkTradingHours(now)
    if (!status.isOpen) {
        return { allowed: false, reason: 'Trading hours closed (9 AM - 4:30 PM EST only)' }
    }
    if (status.shouldFlattenPositions) {
        return { allowed: false, reason: `Too close to close (${status.minutesUntilClose} min)` }
    }
    return { allowed: true, reason: `Active (${status.minutesUntilClose} min left)` }
}

export function shouldForceClosePosition(now: Date = new Date()): { shouldClose: boolean; reason: string } {
    const status = checkTradingHours(now)
    if (status.shouldFlattenPositions || (!status.isOpen && status.marketPhase === 'closed')) {
        return { shouldClose: true, reason: '4:25 PM EST - Auto-flatten all positions' }
    }
    return { shouldClose: false, reason: 'Within trading hours' }
}

export function shouldRunCron(now: Date = new Date()): { shouldRun: boolean; reason: string; session: string; day: string } {
    const status = checkTradingHours(now)
    const estTime = convertToEST(now)
    const hour = estTime.getHours()
    const dayName = estTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })

    // Determine trading session
    let session = 'closed'
    if (hour >= 0 && hour < 3) session = 'asian'
    else if (hour >= 3 && hour < 9) session = 'london'
    else if (hour >= 9 && hour < 16) session = 'newyork'
    else if (hour >= 16 && hour < 24) session = 'closed'

    if (status.isOpen) {
        return { shouldRun: true, reason: 'Within trading hours', session, day: dayName }
    }
    return { shouldRun: false, reason: status.message, session, day: dayName }
}

export function getMontrealTime(now: Date = new Date()): Date {
    return convertToEST(now)
}
