/**
 * Position Sizer — Exact lot size calculation from risk amount + SL distance.
 *
 * Converts a fixed dollar risk ($17 for 2% of $850) into the correct
 * number of OANDA units / standard lots for any instrument type.
 */

import { getAssetConfig } from '@/lib/data/asset-config'

export interface PositionSizeResult {
    units: number
    lots: number
    riskAmount: number
    riskPercent: number
    stopDistancePips: number
    pipValue: number
}

/**
 * Calculate position size (units + lots) for a given risk amount and SL distance.
 *
 * @param entryPrice - Entry price
 * @param slPrice - Stop loss price
 * @param riskAmount - Dollar amount to risk (e.g., $17)
 * @param pair - Instrument pair (display format: EUR/USD, BTC/USD, NAS100/USD)
 * @param accountBalance - Account balance for risk % calculation (default: $850)
 */
export function calculateLotSize(
    entryPrice: number,
    slPrice: number,
    riskAmount: number,
    pair: string,
    accountBalance: number = 850,
): PositionSizeResult {
    const config = getAssetConfig(pair)
    const { pointMultiplier } = config

    // Stop distance in pips/points
    const stopDistancePips = Math.abs(entryPrice - slPrice) * pointMultiplier

    if (stopDistancePips <= 0) {
        return {
            units: 0,
            lots: 0,
            riskAmount,
            riskPercent: accountBalance > 0 ? (riskAmount / accountBalance) * 100 : 0,
            stopDistancePips: 0,
            pipValue: 0,
        }
    }

    // Pip value per unit depends on instrument type
    let pipValue: number

    if (config.type === 'forex') {
        if (pair.includes('JPY')) {
            // JPY pairs: pip value = 0.01 / price per unit
            pipValue = 0.01 / entryPrice
        } else {
            // USD-quoted forex: pip value = 0.0001 per unit
            pipValue = 1 / pointMultiplier
        }
    } else if (config.type === 'crypto') {
        // Crypto: 1 point = $1 per unit (price moves $1 = $1 P&L per unit)
        pipValue = 1
    } else if (config.type === 'cfd_index') {
        // CFD indices: 1 point = $1 per unit
        pipValue = 1
    } else {
        // XAU and other: 1 pip = 0.1, pip value = 0.1 per unit
        pipValue = 1 / pointMultiplier
    }

    // Calculate units
    let units = Math.floor(riskAmount / (stopDistancePips * pipValue))

    // Safety bounds
    units = Math.max(1, units)
    units = Math.min(500000, units) // 5 standard lots max

    // Convert to standard lots (1 lot = 100,000 units for forex)
    let lots: number
    if (config.type === 'forex') {
        lots = units / 100000
    } else if (config.type === 'crypto') {
        // Crypto: units = fractional coins
        lots = units
    } else {
        // CFD index: units = contracts
        lots = units
    }

    return {
        units,
        lots: Math.round(lots * 1000) / 1000,
        riskAmount,
        riskPercent: accountBalance > 0 ? Math.round((riskAmount / accountBalance) * 10000) / 100 : 0,
        stopDistancePips: Math.round(stopDistancePips * 10) / 10,
        pipValue: Math.round(pipValue * 1000000) / 1000000,
    }
}
