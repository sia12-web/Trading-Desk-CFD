import type { OandaCandle } from '@/lib/types/oanda'
import type { CalculatedIndicators } from '@/lib/strategy/types'
import type { ElliottWaveAnalysis } from './elliott-wave-detector'
import type {
    FastMatrixSetup,
    FastMatrixScenario,
    FastMatrixScenarioType,
    MacroDirection,
    RSIDivergence,
    MACDDivergence,
    GoldenPocket,
    DiamondBox,
    CHoCHSignal,
    StochasticReload,
    VolumeClimax,
} from './types'
import {
    detectRSIDivergence,
    detectMACDDivergence,
    detectStochasticReload as detectStochReload,
    calculateGoldenPocket,
} from '@/lib/utils/indicators'
import {
    detectCHoCH,
    detectVolumeClimax,
    detectDiamondBox,
} from '@/lib/utils/m1-detectors'

/**
 * The Fast Matrix — Universal Playbook
 *
 * Macro Anchor: H1 (defines the trend — HH/HL or LH/LL)
 * Trap Anchor: M15 (defines the geometry — Golden Pocket or Diamond Box)
 * Trigger Anchor: M1 (defines the execution — CHoCH + Stochastic)
 *
 * 4 Scenarios:
 *   A: Bullish Wave 2 (Crash Trap — Golden Pocket on M15)
 *   B: Bullish Wave 4 (Diamond Chop — 1/Price equilibrium box on M15)
 *   C: Bearish Wave 2 (Relief Trap — Golden Pocket on M15)
 *   D: Bearish Wave 4 (Diamond Chop — 1/Price equilibrium box on M15)
 */

export function detectFastMatrix(
    h1Candles: OandaCandle[],
    h1Indicators: CalculatedIndicators,
    m15Candles: OandaCandle[],
    m15Indicators: CalculatedIndicators,
    m15ElliottWave: ElliottWaveAnalysis | undefined,
    m1Candles: OandaCandle[],
    m1Indicators: CalculatedIndicators,
    pipLocation: number,
    accountBalance?: number
): FastMatrixSetup {
    // ── Step 1: Macro Direction (H1 Trend) ──
    const macro = detectMacroDirectionH1(h1Candles, h1Indicators)

    // ── Step 2: Evaluate applicable scenarios ──
    const emptyScenario = (id: FastMatrixScenarioType, label: string, dir: 'long' | 'short', wt: 2 | 4): FastMatrixScenario => ({
        id, label, active: false, direction: dir, waveType: wt,
        goldenPocket: null, diamondBox: null,
        rsiDivergence: { detected: false, type: 'none', priceSwing1: null, priceSwing2: null, rsiSwing1: null, rsiSwing2: null, details: 'Not evaluated' },
        macdDivergence: { detected: false, type: 'none', histogramShallowing: false, details: 'Not evaluated' },
        volumeClimax: { detected: false, volumeRatio: 0, rejectionCandle: false, time: null },
        choch: { detected: false, direction: 'none', breakPrice: null, breakTime: null, previousSwingPrice: null },
        stochasticReload: { detected: false, direction: 'none', kValue: null, dValue: null, crossTime: null },
        springPrice: null, entryPrice: null, stopLoss: null, tp1: null, tp2: null,
        riskRewardToTP1: null, riskRewardToTP2: null,
        positionSizeUnits: null, riskPercent: 2, riskAmount: null,
        score: 0, status: 'inactive', details: 'Macro filter does not permit this direction.',
    })

    let scenarioA = emptyScenario('A', 'Bullish Wave 2 (Crash Trap)', 'long', 2)
    let scenarioB = emptyScenario('B', 'Bullish Wave 4 (Diamond Chop)', 'long', 4)
    let scenarioC = emptyScenario('C', 'Bearish Wave 2 (Relief Trap)', 'short', 2)
    let scenarioD = emptyScenario('D', 'Bearish Wave 4 (Diamond Chop)', 'short', 4)

    if (macro.filter === 'buy_only') {
        scenarioA = evaluateWave2Scenario('A', true, h1Candles, m15Candles, m15Indicators, m15ElliottWave, m1Candles, m1Indicators, pipLocation, accountBalance)
        scenarioB = evaluateWave4Scenario('B', true, h1Candles, m15Candles, m15Indicators, m15ElliottWave, m1Candles, m1Indicators, pipLocation, accountBalance)
    } else if (macro.filter === 'sell_only') {
        scenarioC = evaluateWave2Scenario('C', false, h1Candles, m15Candles, m15Indicators, m15ElliottWave, m1Candles, m1Indicators, pipLocation, accountBalance)
        scenarioD = evaluateWave4Scenario('D', false, h1Candles, m15Candles, m15Indicators, m15ElliottWave, m1Candles, m1Indicators, pipLocation, accountBalance)
    }

    // ── Step 3: Select best active scenario ──
    const allScenarios = [scenarioA, scenarioB, scenarioC, scenarioD]
    const activeScenarios = allScenarios.filter(s => s.status !== 'inactive' && s.status !== 'invalid')
    const best = activeScenarios.sort((a, b) => b.score - a.score)[0] ?? null

    const activeScenario = best?.id ?? null
    const overallScore = best?.score ?? 0
    const direction: FastMatrixSetup['direction'] =
        macro.filter === 'buy_only' ? 'long'
            : macro.filter === 'sell_only' ? 'short'
                : 'neutral'

    const narrative = buildNarrative(macro, best, overallScore)

    return {
        activeScenario,
        overallScore,
        direction,
        narrative,
        macro,
        scenarios: { A: scenarioA, B: scenarioB, C: scenarioC, D: scenarioD },
        keyLevels: {
            goldenPocketHigh: best?.goldenPocket?.goldenPocketHigh ?? null,
            goldenPocketLow: best?.goldenPocket?.goldenPocketLow ?? null,
            diamondBoxHigh: best?.diamondBox?.boxHigh ?? null,
            diamondBoxLow: best?.diamondBox?.boxLow ?? null,
            equilibriumPrice: best?.diamondBox?.equilibriumPrice ?? null,
            springPrice: best?.springPrice ?? null,
            entryPrice: best?.entryPrice ?? null,
            stopLoss: best?.stopLoss ?? null,
            tp1: best?.tp1 ?? null,
            tp2: best?.tp2 ?? null,
        },
    }
}

// Backward compat aliases
export const detectHarmonicConvergence = detectFastMatrix
export const detectTrueFractal = detectFastMatrix

// ────────────────────────────────────────────────────────────────
// Macro Direction (H1 Trend — Dow Theory on 1-Hour Chart)
// ────────────────────────────────────────────────────────────────

function detectMacroDirectionH1(
    h1Candles: OandaCandle[],
    h1Indicators: CalculatedIndicators,
): MacroDirection {
    const empty: MacroDirection = {
        trend: 'ranging', filter: 'no_trade',
        h1SwingHighs: 0, h1SwingLows: 0,
        higherHighs: 0, higherLows: 0, lowerHighs: 0, lowerLows: 0,
        volumeConfirms: false, score: 0,
        details: 'Insufficient H1 data for macro direction.',
    }

    if (h1Candles.length < 50) return empty

    const swings = analyzeSwingStructure(h1Candles, 5, 30)
    const { higherHighs, higherLows, lowerHighs, lowerLows, swingHighs, swingLows } = swings

    let trend: MacroDirection['trend'] = 'ranging'
    if (higherHighs >= 2 && higherLows >= 2) trend = 'bullish'
    else if (lowerHighs >= 2 && lowerLows >= 2) trend = 'bearish'

    const filter: MacroDirection['filter'] =
        trend === 'bullish' ? 'buy_only'
            : trend === 'bearish' ? 'sell_only'
                : 'no_trade'

    const volumeConfirms = checkVolumeConfirmation(h1Candles, h1Indicators, trend)

    let score = 0
    if (trend !== 'ranging') {
        score += 30
        const count = trend === 'bullish' ? higherHighs + higherLows : lowerHighs + lowerLows
        score += Math.min(30, count > 4 ? 30 : count > 2 ? 20 : 10)
    }
    if (volumeConfirms) score += 20
    // Extra points for strong trend (many swings)
    score += Math.min(20, swingHighs.length + swingLows.length)

    const shCount = trend === 'bullish' ? higherHighs : lowerHighs
    const slCount = trend === 'bullish' ? higherLows : lowerLows

    const details = trend === 'ranging'
        ? 'H1 shows no clear Dow trend. Filter: NO TRADE. Stand aside.'
        : `H1 ${trend}: ${shCount} ${trend === 'bullish' ? 'HH' : 'LH'}, ${slCount} ${trend === 'bullish' ? 'HL' : 'LL'}. Volume ${volumeConfirms ? 'CONFIRMS' : 'weak'}. Filter: ${filter.toUpperCase()}.`

    return {
        trend, filter,
        h1SwingHighs: swingHighs.length, h1SwingLows: swingLows.length,
        higherHighs, higherLows, lowerHighs, lowerLows,
        volumeConfirms, score, details,
    }
}

// ────────────────────────────────────────────────────────────────
// Wave 2 Scenario Evaluator (Scenarios A & C — Golden Pocket)
// ────────────────────────────────────────────────────────────────

function evaluateWave2Scenario(
    id: FastMatrixScenarioType,
    isBullish: boolean,
    h1Candles: OandaCandle[],
    m15Candles: OandaCandle[],
    m15Indicators: CalculatedIndicators,
    m15ElliottWave: ElliottWaveAnalysis | undefined,
    m1Candles: OandaCandle[],
    m1Indicators: CalculatedIndicators,
    pipLocation: number,
    accountBalance?: number,
): FastMatrixScenario {
    const label = isBullish ? 'Bullish Wave 2 (Crash Trap)' : 'Bearish Wave 2 (Relief Trap)'
    const dir: 'long' | 'short' = isBullish ? 'long' : 'short'

    const base: FastMatrixScenario = {
        id, label, active: false, direction: dir, waveType: 2,
        goldenPocket: null, diamondBox: null,
        rsiDivergence: { detected: false, type: 'none', priceSwing1: null, priceSwing2: null, rsiSwing1: null, rsiSwing2: null, details: 'Not evaluated' },
        macdDivergence: { detected: false, type: 'none', histogramShallowing: false, details: 'Not evaluated' },
        volumeClimax: { detected: false, volumeRatio: 0, rejectionCandle: false, time: null },
        choch: { detected: false, direction: 'none', breakPrice: null, breakTime: null, previousSwingPrice: null },
        stochasticReload: { detected: false, direction: 'none', kValue: null, dValue: null, crossTime: null },
        springPrice: null, entryPrice: null, stopLoss: null, tp1: null, tp2: null,
        riskRewardToTP1: null, riskRewardToTP2: null,
        positionSizeUnits: null, riskPercent: 2, riskAmount: null,
        score: 0, status: 'watching', details: '',
    }

    if (m15Candles.length < 30) return { ...base, status: 'inactive', details: 'Insufficient M15 data' }

    // ── Find Wave 1 impulse on M15 ──
    // Use Elliott Wave data if available, otherwise use swing structure
    let wave1High: number | null = null
    let wave1Low: number | null = null

    if (m15ElliottWave?.waves?.length) {
        // Look for a completed impulse wave
        const impulse = m15ElliottWave.waves.find(w => w.label === '1' || w.label === 'i')
        if (impulse) {
            wave1High = impulse.end_price > impulse.start_price ? impulse.end_price : impulse.start_price
            wave1Low = impulse.end_price > impulse.start_price ? impulse.start_price : impulse.end_price
        }
    }

    // Fallback: use recent swing extremes on H1 for the impulse
    if (!wave1High || !wave1Low) {
        const { swingHighPrices, swingLowPrices } = getSwingDetails(h1Candles.slice(-50), 5)
        if (swingHighPrices.length >= 2 && swingLowPrices.length >= 2) {
            if (isBullish) {
                wave1Low = swingLowPrices[swingLowPrices.length - 2] ?? swingLowPrices[swingLowPrices.length - 1]
                wave1High = swingHighPrices[swingHighPrices.length - 1]
            } else {
                wave1High = swingHighPrices[swingHighPrices.length - 2] ?? swingHighPrices[swingHighPrices.length - 1]
                wave1Low = swingLowPrices[swingLowPrices.length - 1]
            }
        }
    }

    if (!wave1High || !wave1Low || wave1High <= wave1Low) {
        return { ...base, status: 'watching', score: 5, details: 'Scanning for Wave 1 impulse on M15/H1.' }
    }

    // ── Calculate Golden Pocket (50-61.8% Fib) ──
    const goldenPocket = calculateGoldenPocket(wave1Low, wave1High)

    // Check if current price is in or near the Golden Pocket
    const currentPrice = parseFloat(m15Candles[m15Candles.length - 1].mid.c)
    const isInPocket = isBullish
        ? currentPrice >= goldenPocket.goldenPocketLow * 0.998 && currentPrice <= goldenPocket.goldenPocketHigh * 1.002
        : currentPrice >= goldenPocket.goldenPocketLow * 0.998 && currentPrice <= goldenPocket.goldenPocketHigh * 1.002

    // ── RSI Divergence on M15 ──
    const closes = m15Candles.map(c => parseFloat(c.mid.c))
    const rsi = m15Indicators.rsi ?? []
    const rsiDiv = detectRSIDivergence(closes, rsi, isBullish, 5)

    // ── MACD Divergence on M15 ──
    const macdHist = m15Indicators.macd?.histogram ?? []
    const macdDiv = detectMACDDivergence(closes, macdHist, isBullish, 5)

    // ── M1 Triggers ──
    const volClimax = m1Candles.length > 20 ? detectVolumeClimax(m1Candles) : base.volumeClimax
    const choch = m1Candles.length > 20 ? detectCHoCH(m1Candles, isBullish) : base.choch

    const stochK = m1Indicators.stochastic?.kLine ?? []
    const stochD = m1Indicators.stochastic?.dLine ?? []
    const m1Times = m1Candles.map(c => c.time)
    const stochReload = stochK.length > 3 ? detectStochReload(stochK, stochD, isBullish, m1Times) : base.stochasticReload

    // ── Spring Price (from volume climax rejection) ──
    let springPrice: number | null = null
    if (volClimax.detected && volClimax.time) {
        const climaxCandle = m1Candles.find(c => c.time === volClimax.time)
        if (climaxCandle) {
            springPrice = isBullish ? parseFloat(climaxCandle.mid.l) : parseFloat(climaxCandle.mid.h)
        }
    }

    // ── Execution Levels ──
    let entryPrice: number | null = null
    let stopLoss: number | null = null
    let tp1: number | null = null
    let tp2: number | null = null

    if (choch.detected && choch.breakPrice) {
        entryPrice = stochReload.detected ? currentPrice : choch.breakPrice
    }

    if (springPrice) {
        const pip = Math.pow(10, pipLocation)
        stopLoss = isBullish ? springPrice - pip : springPrice + pip
    }

    if (entryPrice && stopLoss) {
        const risk = Math.abs(entryPrice - stopLoss)
        tp1 = isBullish ? entryPrice + risk * 2 : entryPrice - risk * 2      // 2:1 R:R (100% ext)
        tp2 = isBullish ? entryPrice + risk * 3.236 : entryPrice - risk * 3.236  // 161.8% ext of wave
    }

    // ── R:R and Position Sizing ──
    const rr1 = entryPrice && stopLoss && tp1 ? Math.abs(tp1 - entryPrice) / Math.abs(entryPrice - stopLoss) : null
    const rr2 = entryPrice && stopLoss && tp2 ? Math.abs(tp2 - entryPrice) / Math.abs(entryPrice - stopLoss) : null
    let positionSizeUnits: number | null = null
    let riskAmount: number | null = null
    if (accountBalance && entryPrice && stopLoss) {
        riskAmount = accountBalance * 0.02
        const distancePerUnit = Math.abs(entryPrice - stopLoss)
        positionSizeUnits = distancePerUnit > 0 ? Math.floor(riskAmount / distancePerUnit) : null
    }

    // ── Scoring ──
    let score = 0
    if (isInPocket) score += 15          // Price in Golden Pocket
    if (rsiDiv.detected) score += 20     // RSI divergence
    if (macdDiv.detected) score += 10    // MACD divergence
    if (volClimax.detected) score += 20  // Volume climax on M1
    if (choch.detected) score += 20      // CHoCH structural break
    if (stochReload.detected) score += 15 // Stochastic reload
    score = Math.min(100, score)

    let status: FastMatrixScenario['status'] = 'watching'
    if (score >= 80 && choch.detected && stochReload.detected) status = 'triggered'
    else if (score >= 50) status = 'confirming'
    else if (score >= 15) status = 'watching'

    const details = buildScenarioDetails(label, score, status, isInPocket, rsiDiv, macdDiv, volClimax, choch, stochReload, rr2)

    return {
        ...base,
        active: status !== 'inactive',
        goldenPocket,
        rsiDivergence: rsiDiv,
        macdDivergence: macdDiv,
        volumeClimax: volClimax,
        choch,
        stochasticReload: stochReload,
        springPrice,
        entryPrice,
        stopLoss,
        tp1,
        tp2,
        riskRewardToTP1: rr1,
        riskRewardToTP2: rr2,
        positionSizeUnits,
        riskAmount,
        score,
        status,
        details,
    }
}

// ────────────────────────────────────────────────────────────────
// Wave 4 Scenario Evaluator (Scenarios B & D — Diamond Box)
// ────────────────────────────────────────────────────────────────

function evaluateWave4Scenario(
    id: FastMatrixScenarioType,
    isBullish: boolean,
    h1Candles: OandaCandle[],
    m15Candles: OandaCandle[],
    m15Indicators: CalculatedIndicators,
    m15ElliottWave: ElliottWaveAnalysis | undefined,
    m1Candles: OandaCandle[],
    m1Indicators: CalculatedIndicators,
    pipLocation: number,
    accountBalance?: number,
): FastMatrixScenario {
    const label = isBullish ? 'Bullish Wave 4 (Diamond Chop)' : 'Bearish Wave 4 (Diamond Chop)'
    const dir: 'long' | 'short' = isBullish ? 'long' : 'short'

    const base: FastMatrixScenario = {
        id, label, active: false, direction: dir, waveType: 4,
        goldenPocket: null, diamondBox: null,
        rsiDivergence: { detected: false, type: 'none', priceSwing1: null, priceSwing2: null, rsiSwing1: null, rsiSwing2: null, details: 'Not evaluated' },
        macdDivergence: { detected: false, type: 'none', histogramShallowing: false, details: 'Not evaluated' },
        volumeClimax: { detected: false, volumeRatio: 0, rejectionCandle: false, time: null },
        choch: { detected: false, direction: 'none', breakPrice: null, breakTime: null, previousSwingPrice: null },
        stochasticReload: { detected: false, direction: 'none', kValue: null, dValue: null, crossTime: null },
        springPrice: null, entryPrice: null, stopLoss: null, tp1: null, tp2: null,
        riskRewardToTP1: null, riskRewardToTP2: null,
        positionSizeUnits: null, riskPercent: 2, riskAmount: null,
        score: 0, status: 'watching', details: '',
    }

    if (m15Candles.length < 30) return { ...base, status: 'inactive', details: 'Insufficient M15 data' }

    // ── Detect Diamond Box (Wave 4 consolidation) on M15 ──
    const diamondBox = detectDiamondBox(m15Candles, 30)

    if (!diamondBox.isReady) {
        return {
            ...base,
            diamondBox: diamondBox.boxHigh > 0 ? diamondBox : null,
            status: 'watching',
            score: diamondBox.candlesInBox >= 3 ? 10 : 5,
            details: `Scanning M15 for Diamond Box (Wave 4 consolidation). ${diamondBox.candlesInBox} candles in range (need 6+).`,
        }
    }

    // ── RSI Divergence at box boundary ──
    const closes = m15Candles.map(c => parseFloat(c.mid.c))
    const rsi = m15Indicators.rsi ?? []
    const rsiDiv = detectRSIDivergence(closes, rsi, isBullish, 5)

    // ── MACD Divergence ──
    const macdHist = m15Indicators.macd?.histogram ?? []
    const macdDiv = detectMACDDivergence(closes, macdHist, isBullish, 5)

    // ── Check if price is near box boundary (Spring/Upthrust zone) ──
    const currentPrice = parseFloat(m15Candles[m15Candles.length - 1].mid.c)
    const nearBoundary = isBullish
        ? currentPrice <= diamondBox.boxLow * 1.003  // near bottom for longs
        : currentPrice >= diamondBox.boxHigh * 0.997  // near top for shorts

    // ── M1 Triggers ──
    const volClimax = m1Candles.length > 20 ? detectVolumeClimax(m1Candles) : base.volumeClimax
    const choch = m1Candles.length > 20 ? detectCHoCH(m1Candles, isBullish) : base.choch

    const stochK = m1Indicators.stochastic?.kLine ?? []
    const stochD = m1Indicators.stochastic?.dLine ?? []
    const m1Times = m1Candles.map(c => c.time)
    const stochReload = stochK.length > 3 ? detectStochReload(stochK, stochD, isBullish, m1Times) : base.stochasticReload

    // ── Spring/Upthrust Price ──
    let springPrice: number | null = null
    if (volClimax.detected && volClimax.time) {
        const climaxCandle = m1Candles.find(c => c.time === volClimax.time)
        if (climaxCandle) {
            springPrice = isBullish ? parseFloat(climaxCandle.mid.l) : parseFloat(climaxCandle.mid.h)
        }
    }

    // ── Execution Levels ──
    let entryPrice: number | null = null
    let stopLoss: number | null = null
    let tp1: number | null = null
    let tp2: number | null = null

    if (choch.detected && choch.breakPrice) {
        entryPrice = stochReload.detected ? currentPrice : choch.breakPrice
    }

    if (springPrice) {
        const pip = Math.pow(10, pipLocation)
        stopLoss = isBullish ? springPrice - pip : springPrice + pip
    }

    if (entryPrice && stopLoss) {
        // TP based on the box range projected from entry
        const boxRange = diamondBox.boxHigh - diamondBox.boxLow
        tp1 = isBullish ? entryPrice + boxRange : entryPrice - boxRange           // 100% box extension
        tp2 = isBullish ? entryPrice + boxRange * 1.618 : entryPrice - boxRange * 1.618  // 161.8% ext
    }

    const rr1 = entryPrice && stopLoss && tp1 ? Math.abs(tp1 - entryPrice) / Math.abs(entryPrice - stopLoss) : null
    const rr2 = entryPrice && stopLoss && tp2 ? Math.abs(tp2 - entryPrice) / Math.abs(entryPrice - stopLoss) : null
    let positionSizeUnits: number | null = null
    let riskAmount: number | null = null
    if (accountBalance && entryPrice && stopLoss) {
        riskAmount = accountBalance * 0.02
        const distancePerUnit = Math.abs(entryPrice - stopLoss)
        positionSizeUnits = distancePerUnit > 0 ? Math.floor(riskAmount / distancePerUnit) : null
    }

    // ── Scoring ──
    let score = 0
    if (diamondBox.isReady) score += 15   // Box formed (6+ candles)
    if (nearBoundary) score += 10         // Price near trap zone
    if (rsiDiv.detected) score += 20      // RSI divergence
    if (macdDiv.detected) score += 10     // MACD divergence
    if (volClimax.detected) score += 20   // Volume climax on M1
    if (choch.detected) score += 15       // CHoCH
    if (stochReload.detected) score += 10 // Stochastic reload
    score = Math.min(100, score)

    let status: FastMatrixScenario['status'] = 'watching'
    if (score >= 80 && choch.detected && stochReload.detected) status = 'triggered'
    else if (score >= 50) status = 'confirming'
    else if (score >= 15) status = 'watching'

    const details = buildScenarioDetails(label, score, status, nearBoundary, rsiDiv, macdDiv, volClimax, choch, stochReload, rr2)

    return {
        ...base,
        active: status !== 'inactive',
        diamondBox,
        rsiDivergence: rsiDiv,
        macdDivergence: macdDiv,
        volumeClimax: volClimax,
        choch,
        stochasticReload: stochReload,
        springPrice,
        entryPrice,
        stopLoss,
        tp1,
        tp2,
        riskRewardToTP1: rr1,
        riskRewardToTP2: rr2,
        positionSizeUnits,
        riskAmount,
        score,
        status,
        details,
    }
}

// ────────────────────────────────────────────────────────────────
// Shared Helpers
// ────────────────────────────────────────────────────────────────

function analyzeSwingStructure(candles: OandaCandle[], swingLookback: number, searchDepth: number) {
    const swingHighs: number[] = []
    const swingLows: number[] = []

    const start = Math.max(swingLookback, candles.length - searchDepth * 3)
    const end = candles.length - swingLookback

    for (let i = start; i < end; i++) {
        const high = parseFloat(candles[i].mid.h)
        const low = parseFloat(candles[i].mid.l)

        let isSwingHigh = true
        let isSwingLow = true

        for (let j = i - swingLookback; j <= i + swingLookback; j++) {
            if (j === i || j < 0 || j >= candles.length) continue
            if (parseFloat(candles[j].mid.h) >= high) isSwingHigh = false
            if (parseFloat(candles[j].mid.l) <= low) isSwingLow = false
        }

        if (isSwingHigh) swingHighs.push(high)
        if (isSwingLow) swingLows.push(low)
    }

    let higherHighs = 0, higherLows = 0, lowerHighs = 0, lowerLows = 0

    for (let i = swingHighs.length - 1; i > 0; i--) {
        if (swingHighs[i] > swingHighs[i - 1]) higherHighs++
        else if (swingHighs[i] < swingHighs[i - 1]) lowerHighs++
        else break
        if (i <= swingHighs.length - 5) break
    }

    for (let i = swingLows.length - 1; i > 0; i--) {
        if (swingLows[i] > swingLows[i - 1]) higherLows++
        else if (swingLows[i] < swingLows[i - 1]) lowerLows++
        else break
        if (i <= swingLows.length - 5) break
    }

    return { higherHighs, higherLows, lowerHighs, lowerLows, swingHighs, swingLows }
}

function getSwingDetails(candles: OandaCandle[], lookback: number) {
    const swingHighPrices: number[] = []
    const swingLowPrices: number[] = []
    const swingHighIndices: number[] = []
    const swingLowIndices: number[] = []
    const swingHighTimes: string[] = []
    const swingLowTimes: string[] = []

    const end = candles.length - lookback

    for (let i = lookback; i < end; i++) {
        const high = parseFloat(candles[i].mid.h)
        const low = parseFloat(candles[i].mid.l)

        let isSwingHigh = true
        let isSwingLow = true

        for (let j = i - lookback; j <= i + lookback; j++) {
            if (j === i || j < 0 || j >= candles.length) continue
            if (parseFloat(candles[j].mid.h) >= high) isSwingHigh = false
            if (parseFloat(candles[j].mid.l) <= low) isSwingLow = false
        }

        if (isSwingHigh) {
            swingHighPrices.push(high)
            swingHighIndices.push(i)
            swingHighTimes.push(candles[i].time)
        }
        if (isSwingLow) {
            swingLowPrices.push(low)
            swingLowIndices.push(i)
            swingLowTimes.push(candles[i].time)
        }
    }

    return { swingHighPrices, swingLowPrices, swingHighIndices, swingLowIndices, swingHighTimes, swingLowTimes }
}

function checkVolumeConfirmation(candles: OandaCandle[], indicators: CalculatedIndicators, trend: string): boolean {
    const volume = indicators.volume
    const volumeSma = indicators.volumeSma
    if (!volume?.length || !volumeSma?.length) return false

    const recent = candles.slice(-20)
    let trendingVolumeTotal = 0
    let trendingCount = 0
    let avgVolume = 0
    let volCount = 0

    for (let i = 0; i < recent.length; i++) {
        const idx = candles.length - 20 + i
        const o = parseFloat(recent[i].mid.o)
        const c = parseFloat(recent[i].mid.c)
        const vol = volume[idx] || 0

        if (vol > 0) { avgVolume += vol; volCount++ }

        if ((trend === 'bullish' && c > o) || (trend === 'bearish' && c < o)) {
            trendingVolumeTotal += vol
            trendingCount++
        }
    }

    if (trendingCount === 0 || volCount === 0) return false
    return (trendingVolumeTotal / trendingCount) > (avgVolume / volCount) * 1.1
}

// ────────────────────────────────────────────────────────────────
// Narrative Builders
// ────────────────────────────────────────────────────────────────

function buildScenarioDetails(
    label: string, score: number, status: string,
    zoneActive: boolean,
    rsiDiv: RSIDivergence, macdDiv: MACDDivergence,
    volClimax: VolumeClimax, choch: CHoCHSignal,
    stochReload: StochasticReload, rr2: number | null,
): string {
    const parts: string[] = [`${label} — ${status.toUpperCase()} (${score}/100).`]
    if (zoneActive) parts.push('Price in target zone.')
    if (rsiDiv.detected) parts.push(`RSI ${rsiDiv.type} divergence confirmed.`)
    if (macdDiv.detected) parts.push(`MACD ${macdDiv.type} divergence.`)
    if (volClimax.detected) parts.push(`Volume climax (${volClimax.volumeRatio.toFixed(1)}x avg).`)
    if (choch.detected) parts.push(`CHoCH at ${choch.breakPrice?.toFixed(5)}.`)
    if (stochReload.detected) parts.push(`Stochastic reload from ${stochReload.direction === 'bullish' ? 'oversold' : 'overbought'}.`)
    if (rr2) parts.push(`R:R to TP2: ${rr2.toFixed(1)}:1.`)
    return parts.join(' ')
}

function buildNarrative(
    macro: MacroDirection,
    bestScenario: FastMatrixScenario | null,
    overallScore: number,
): string {
    if (macro.filter === 'no_trade') {
        return `No setup. H1 macro: ${macro.trend}. Filter: NO TRADE. Waiting for H1 to establish HH/HL or LH/LL.`
    }

    if (!bestScenario || bestScenario.status === 'inactive') {
        return `H1 macro ${macro.trend} — filter: ${macro.filter}. Scanning M15 for Wave 2 (Golden Pocket) or Wave 4 (Diamond Box) setups.`
    }

    if (bestScenario.status === 'watching') {
        return `H1 ${macro.trend}. ${bestScenario.label} — watching. Score: ${bestScenario.score}/100. Waiting for M15 confirmation signals.`
    }

    if (bestScenario.status === 'confirming') {
        return `H1 ${macro.trend}. ${bestScenario.label} — CONFIRMING. Score: ${bestScenario.score}/100. ${bestScenario.rsiDivergence.detected ? 'RSI divergence active. ' : ''}Waiting for M1 trigger (CHoCH + Stochastic).`
    }

    if (bestScenario.status === 'triggered') {
        return `TRIGGERED — ${bestScenario.label}. Score: ${bestScenario.score}/100. Entry: ${bestScenario.entryPrice?.toFixed(5)}. SL: ${bestScenario.stopLoss?.toFixed(5)}. TP1: ${bestScenario.tp1?.toFixed(5)} (50% close). TP2: ${bestScenario.tp2?.toFixed(5)} (50% close). R:R ${bestScenario.riskRewardToTP2?.toFixed(1)}:1. Risk: $${bestScenario.riskAmount?.toFixed(0) ?? '?'} (2%).`
    }

    return `Fast Matrix score: ${overallScore}/100.`
}
