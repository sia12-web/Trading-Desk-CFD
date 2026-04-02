/**
 * Shared instrument list across Trade page, Indicator Optimization, and Story subscriptions.
 * This is the canonical source of truth for which instruments are tradable in the system.
 */
export const ALLOWED_INSTRUMENTS = [
    // Major Forex Pairs
    'EUR_USD', 'GBP_USD', 'USD_JPY', 'EUR_GBP', 'AUD_USD',
    'USD_CAD', 'NZD_USD', 'EUR_JPY', 'USD_CHF', 'GBP_JPY',

    // Cross Pairs
    'GBP_AUD', 'EUR_AUD', 'AUD_JPY', 'NZD_JPY',

    // Exotic
    'USD_TRY',

    // Commodities
    'XAU_USD',

    // Indices
    'NAS100_USD', 'SPX500_USD', 'US30_USD', 'DE30_EUR',
] as const

export type AllowedInstrument = typeof ALLOWED_INSTRUMENTS[number]

/**
 * Convert display format (EUR/USD) to OANDA format (EUR_USD)
 */
export function displayToOandaPair(pair: string): string {
    return pair.replace('/', '_')
}

/**
 * Convert OANDA format (EUR_USD) to display format (EUR/USD)
 */
export function oandaToDisplayPair(instrument: string): string {
    return instrument.replace('_', '/')
}
