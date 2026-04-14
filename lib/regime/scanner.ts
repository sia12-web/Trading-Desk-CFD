/**
 * Regime Scanner — Multi-Pair Regime Classification
 *
 * Scans all valid pairs, classifies regime for each, and runs
 * the active bot's detector. Rate-limited to avoid API throttling.
 */

import type { PairRegimeState } from './types'
import { VALID_PAIRS } from '@/lib/utils/valid-pairs'
import { scanPairForRegime } from './engine'

/**
 * Scan all valid pairs for regime classification + bot detection.
 *
 * @param delayMs - Milliseconds between pair requests (rate limiting, default 100ms)
 * @returns Array of PairRegimeState for all scanned pairs
 */
export async function scanAllPairsForRegime(
    delayMs: number = 100,
): Promise<PairRegimeState[]> {
    console.log(`[RegimeScanner] Starting scan of ${VALID_PAIRS.length} pairs...`)
    const results: PairRegimeState[] = []

    for (const pair of VALID_PAIRS) {
        try {
            const result = await scanPairForRegime(pair)
            results.push(result)
        } catch (error) {
            results.push({
                pair,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                regime: {
                    regime: 'unknown_dangerous',
                    activeBot: 'none',
                    indicators: { atrPercentile: 0, adxValue: 0, adxRising: false, donchianCompression: false, donchianExpansion: false, slopesAligned: false, maCrossCount: 0, volumeExpanding: false, spreadWidthRatio: 1.0, cvdErratic: false },
                    confidence: 0,
                    sizeMultiplier: 0,
                    narrative: `Scan error: ${error instanceof Error ? error.message : String(error)}`,
                    classifiedAt: new Date().toISOString(),
                    conditionBlack: false,
                },
                botSetup: { trap: null, killzone: null, momentum: null, ghost: null },
                bestSetup: null,
                scannedAt: new Date().toISOString(),
            })
        }

        // Rate limiting
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    const successful = results.filter(r => r.success)
    const regimeCounts: Record<string, number> = {}
    for (const r of successful) {
        regimeCounts[r.regime.regime] = (regimeCounts[r.regime.regime] ?? 0) + 1
    }

    const setupsDetected = results.filter(r => r.bestSetup?.detected).length

    console.log(
        `[RegimeScanner] Scan complete: ${successful.length}/${results.length} pairs. ` +
        `Regimes: ${Object.entries(regimeCounts).map(([k, v]) => `${k}=${v}`).join(', ')}. ` +
        `Setups: ${setupsDetected}`
    )

    return results
}
