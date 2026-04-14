import { VALID_PAIRS } from '@/lib/utils/valid-pairs'
import { getCandles } from '@/lib/data/candle-fetcher'
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'
import { detectKillzone, detectInstitutionalKillzone } from '@/lib/utils/killzone-detector'
import type { KillzoneSetup } from '@/lib/utils/killzone-detector'
import type { H1WaveState } from '@/lib/utils/elliott-wave-h1'
import { detectMarketState } from '@/lib/utils/market-state'
import type { MarketRegime } from '@/lib/utils/market-state'

/**
 * Result for a single pair scan
 */
export interface PairKillzoneState {
    pair: string
    success: boolean
    error?: string

    // H1 Elliott Wave State
    waveState: H1WaveState | null
    currentWave: number | null
    waveDirection: 'bullish' | 'bearish' | null
    wave2Complete: boolean
    wave4Complete: boolean
    waveConfidence: number

    // Killzone Detection
    killzone: KillzoneSetup | null
    killzoneDetected: boolean
    boxHigh: number | null
    boxLow: number | null
    boxWidthPips: number | null
    killzoneConfidence: number
    fibZoneHigh: number | null
    fibZoneLow: number | null
    volumePOC: number | null
    priceInBox: boolean

    // Tier 1: Market State
    marketRegime: MarketRegime
    maCrossCount: number
    atrSqueeze: boolean
    proceedToTier2: boolean
    wxyProjection: number | null

    scannedAt: string
}

/**
 * Scan all configured pairs for Killzone setups and Wave 2/4 completion
 *
 * @param delayMs - Delay between pair requests to avoid rate limiting (default: 100ms)
 * @returns Array of PairKillzoneState objects (one per pair)
 */
export async function scanAllPairs(delayMs: number = 100): Promise<PairKillzoneState[]> {
    const results: PairKillzoneState[] = []

    console.log(`[Killzone Scanner] Starting scan of ${VALID_PAIRS.length} pairs...`)

    for (const pair of VALID_PAIRS) {
        try {
            const state = await scanSinglePair(pair)
            results.push(state)

            // Rate limiting delay
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
        } catch (error) {
            console.error(`[Killzone Scanner] Error scanning ${pair}:`, error)
            // Push failed state but continue processing other pairs
            results.push(createErrorState(pair, error))
        }
    }

    const successCount = results.filter(r => r.success).length
    const killzoneCount = results.filter(r => r.killzoneDetected).length
    const wave2CompleteCount = results.filter(r => r.wave2Complete).length
    const wave4CompleteCount = results.filter(r => r.wave4Complete).length

    console.log(
        `[Killzone Scanner] Scan complete: ${successCount}/${VALID_PAIRS.length} pairs scanned, ` +
        `${killzoneCount} killzones detected, ${wave2CompleteCount} Wave 2 complete, ${wave4CompleteCount} Wave 4 complete`
    )

    return results
}

/**
 * Scan a single pair for Killzone setup and Wave completion
 */
async function scanSinglePair(pair: string): Promise<PairKillzoneState> {
    const scannedAt = new Date().toISOString()

    // Convert display pair format to internal format (e.g., EUR/USD → EUR_USD)
    const instrument = pair.replace('/', '_')

    // Fetch H1 and M15 candles
    const [h1Response, m15Response] = await Promise.all([
        getCandles({ instrument, granularity: 'H1', count: 50 }),
        getCandles({ instrument, granularity: 'M15', count: 200 }),
    ])

    if (h1Response.error || !h1Response.data || h1Response.data.length < 50) {
        throw new Error(`Failed to fetch H1 candles for ${pair}`)
    }

    if (m15Response.error || !m15Response.data || m15Response.data.length < 20) {
        throw new Error(`Failed to fetch M15 candles for ${pair}`)
    }

    const h1Candles = h1Response.data
    const m15Candles = m15Response.data

    // Calculate H1 indicators for Elliott Wave detection
    const h1Closes = h1Candles.map(c => parseFloat(c.mid.c))
    const h1Rsi = calculateRSI(h1Closes, 14)
    const h1Macd = calculateMACD(h1Closes, 12, 26, 9)

    // Detect H1 Elliott Wave state
    const waveState = detectH1ElliottWave(
        h1Candles,
        h1Rsi,
        h1Macd.macdLine,
        h1Macd.signalLine
    )

    // Tier 1: Detect market state
    const marketState = detectMarketState(m15Candles)

    // Detect Killzone — use institutional version if Tier 1 says complex correction
    let killzone: KillzoneSetup
    let wxyProjection: number | null = null

    if (marketState.proceedToTier2) {
        const instKz = detectInstitutionalKillzone(waveState, m15Candles, pair, marketState)
        killzone = instKz
        wxyProjection = instKz.wxyProjection?.waveYProjection ?? null
    } else {
        killzone = detectKillzone(waveState, m15Candles, pair)
    }

    // Build result object
    const result: PairKillzoneState = {
        pair,
        success: true,
        waveState,
        currentWave: waveState.currentWave === 'unknown' ? null : waveState.currentWave,
        waveDirection: waveState.direction === 'unclear' ? null : waveState.direction,
        wave2Complete: waveState.confirmations.wave2Complete,
        wave4Complete: waveState.confirmations.wave4Complete,
        waveConfidence: waveState.confidence,
        killzone,
        killzoneDetected: killzone.detected,
        boxHigh: killzone.box?.high ?? null,
        boxLow: killzone.box?.low ?? null,
        boxWidthPips: killzone.box?.widthPips ?? null,
        killzoneConfidence: killzone.confidence,
        fibZoneHigh: killzone.fibZone?.fibHigh ?? null,
        fibZoneLow: killzone.fibZone?.fibLow ?? null,
        volumePOC: killzone.pullbackPOC?.poc ?? null,
        priceInBox: killzone.priceInBox,
        marketRegime: marketState.regime,
        maCrossCount: marketState.maCrossCount,
        atrSqueeze: marketState.atrSqueeze,
        proceedToTier2: marketState.proceedToTier2,
        wxyProjection,
        scannedAt,
    }

    return result
}

/**
 * Create an error state for a failed pair scan
 */
function createErrorState(pair: string, error: unknown): PairKillzoneState {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
        pair,
        success: false,
        error: errorMessage,
        waveState: null,
        currentWave: null,
        waveDirection: null,
        wave2Complete: false,
        wave4Complete: false,
        waveConfidence: 0,
        killzone: null,
        killzoneDetected: false,
        boxHigh: null,
        boxLow: null,
        boxWidthPips: null,
        killzoneConfidence: 0,
        fibZoneHigh: null,
        fibZoneLow: null,
        volumePOC: null,
        priceInBox: false,
        marketRegime: 'unknown',
        maCrossCount: 0,
        atrSqueeze: false,
        proceedToTier2: false,
        wxyProjection: null,
        scannedAt: new Date().toISOString(),
    }
}
