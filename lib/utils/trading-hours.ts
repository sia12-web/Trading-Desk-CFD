/**
 * Trading Hours Logic — Montreal Fast Matrix Schedule
 *
 * Enforces time-of-day and day-of-week filtering for cron jobs
 * to respect institutional volume patterns and avoid low-liquidity traps.
 */

export type TradingSession =
  | 'asian_dead'      // 8:00 PM - 2:00 AM EST (low volume, observation only)
  | 'london_killzone' // 2:00 AM - 4:00 AM EST (optional sniper window)
  | 'recon'           // 7:30 AM - 8:00 AM EST (pre-market analysis)
  | 'ny_core'         // 8:00 AM - 11:30 AM EST (PRIMARY TRADING WINDOW)
  | 'ny_afternoon'    // 11:30 AM - 8:00 PM EST (lunch noise, avoid)

export type TradingDay =
  | 'monday'          // Range setter, observation only
  | 'tuesday'         // Macro turn, hunt judas swing
  | 'wednesday'       // Expansion, ride Wave 3
  | 'thursday'        // Deceleration, hit and run
  | 'friday'          // Trap city, defensive only

/**
 * Get current Montreal time (EST/EDT aware)
 */
export function getMontrealTime(): Date {
  // Montreal is America/Toronto timezone
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }))
}

/**
 * Determine current trading session based on Montreal time
 */
export function getCurrentSession(): TradingSession {
  const now = getMontrealTime()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const timeInMinutes = hour * 60 + minute

  // 8:00 PM (20:00) - 2:00 AM (02:00) next day
  if (timeInMinutes >= 20 * 60 || timeInMinutes < 2 * 60) {
    return 'asian_dead'
  }

  // 2:00 AM - 4:00 AM
  if (timeInMinutes >= 2 * 60 && timeInMinutes < 4 * 60) {
    return 'london_killzone'
  }

  // 7:30 AM - 8:00 AM
  if (timeInMinutes >= 7 * 60 + 30 && timeInMinutes < 8 * 60) {
    return 'recon'
  }

  // 8:00 AM - 11:30 AM
  if (timeInMinutes >= 8 * 60 && timeInMinutes < 11 * 60 + 30) {
    return 'ny_core'
  }

  // 11:30 AM - 8:00 PM (rest of the day)
  return 'ny_afternoon'
}

/**
 * Determine current trading day based on Montreal time
 */
export function getCurrentTradingDay(): TradingDay {
  const now = getMontrealTime()
  const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

  switch (dayOfWeek) {
    case 1: return 'monday'
    case 2: return 'tuesday'
    case 3: return 'wednesday'
    case 4: return 'thursday'
    case 5: return 'friday'
    default: return 'monday' // Weekend defaults to Monday (market closed anyway)
  }
}

/**
 * Should cron jobs run during this session?
 *
 * ACTIVE SESSIONS (run crons):
 * - recon (7:30-8:00 AM): Prepare for trading day
 * - ny_core (8:00-11:30 AM): PRIMARY WINDOW
 * - london_killzone (2:00-4:00 AM): Optional, only on Tuesday/Wednesday
 *
 * DEAD SESSIONS (skip crons):
 * - asian_dead (8 PM - 2 AM): Low volume, observation only
 * - ny_afternoon (11:30 AM - 8 PM): Lunch noise, no edge
 */
export function shouldRunCron(): {
  shouldRun: boolean
  session: TradingSession
  day: TradingDay
  reason: string
} {
  const session = getCurrentSession()
  const day = getCurrentTradingDay()

  // Always skip weekend
  const now = getMontrealTime()
  const dayOfWeek = now.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      shouldRun: false,
      session,
      day,
      reason: 'Weekend — market closed'
    }
  }

  // PRIMARY WINDOW: Always run during NY core hours
  if (session === 'ny_core') {
    return {
      shouldRun: true,
      session,
      day,
      reason: 'NY core window — maximum volume and opportunity'
    }
  }

  // RECONNAISSANCE: Run before market open to prepare
  if (session === 'recon') {
    return {
      shouldRun: true,
      session,
      day,
      reason: 'Pre-market reconnaissance — mapping setups'
    }
  }

  // LONDON KILLZONE: Only run on high-probability days (Tuesday/Wednesday)
  if (session === 'london_killzone') {
    if (day === 'tuesday' || day === 'wednesday') {
      return {
        shouldRun: true,
        session,
        day,
        reason: `London killzone on ${day} — high probability macro turn/expansion`
      }
    }
    return {
      shouldRun: false,
      session,
      day,
      reason: `London killzone on ${day} — low probability, skip to conserve capital`
    }
  }

  // DEAD ZONES: Never run
  if (session === 'asian_dead') {
    return {
      shouldRun: false,
      session,
      day,
      reason: 'Asian session — low volume dead zone'
    }
  }

  if (session === 'ny_afternoon') {
    return {
      shouldRun: false,
      session,
      day,
      reason: 'NY afternoon — lunch noise, no edge'
    }
  }

  // Fallback: skip unknown states
  return {
    shouldRun: false,
    session,
    day,
    reason: 'Unknown session state'
  }
}

/**
 * DEPRECATED: NOT USED
 *
 * User prefers fixed 1% risk ($8.50 on $850) regardless of day.
 * Time-of-day filtering (shouldRunCron) is active, but day-based
 * risk multipliers are not implemented.
 *
 * Montreal schedule focuses on WHEN to trade (core windows),
 * not HOW MUCH to risk (always 1%).
 */
// export function getDayVolatilityMultiplier(): number {
//   const day = getCurrentTradingDay()
//   switch (day) {
//     case 'tuesday':
//     case 'wednesday':
//       return 1.0
//     case 'thursday':
//       return 0.7
//     case 'monday':
//       return 0.5
//     case 'friday':
//       return 0.0
//     default:
//       return 0.5
//   }
// }
