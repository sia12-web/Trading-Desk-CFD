import type { OandaCandle } from '@/lib/types/oanda'
import type { CalculatedIndicators } from '@/lib/strategy/types'
import type { TrendAssessment } from '@/lib/utils/trend-detector'
import type { ElliottWaveAnalysis } from './elliott-wave-detector'

// ── The Fast Matrix ──
// H1 Macro Direction → 4 Scenario Matrix (A/B/C/D) → M1 Precision Execution

export type FastMatrixScenarioType = 'A' | 'B' | 'C' | 'D'

export interface MacroDirection {
    trend: 'bullish' | 'bearish' | 'ranging'
    filter: 'buy_only' | 'sell_only' | 'no_trade'
    h1SwingHighs: number
    h1SwingLows: number
    higherHighs: number
    higherLows: number
    lowerHighs: number
    lowerLows: number
    volumeConfirms: boolean
    score: number
    details: string
}

export interface RSIDivergence {
    detected: boolean
    type: 'bullish' | 'bearish' | 'none'
    priceSwing1: number | null
    priceSwing2: number | null
    rsiSwing1: number | null
    rsiSwing2: number | null
    details: string
}

export interface MACDDivergence {
    detected: boolean
    type: 'bullish' | 'bearish' | 'none'
    histogramShallowing: boolean
    details: string
}

export interface GoldenPocket {
    fib50: number
    fib618: number
    goldenPocketHigh: number   // max(fib50, fib618)
    goldenPocketLow: number    // min(fib50, fib618)
    waveSwingHigh: number
    waveSwingLow: number
}

export interface DiamondBox {
    boxHigh: number
    boxLow: number
    equilibriumPrice: number   // 1/Price overlay midpoint
    candlesInBox: number       // target: 6-9
    isReady: boolean           // >= 6 candles elapsed
}

export interface CHoCHSignal {
    detected: boolean
    direction: 'bullish' | 'bearish' | 'none'
    breakPrice: number | null
    breakTime: string | null
    previousSwingPrice: number | null
}

export interface StochasticReload {
    detected: boolean
    direction: 'bullish' | 'bearish' | 'none'
    kValue: number | null
    dValue: number | null
    crossTime: string | null
}

export interface VolumeClimax {
    detected: boolean
    volumeRatio: number        // volume / avg (2x+ = climax)
    rejectionCandle: boolean
    time: string | null
}

export interface FastMatrixScenario {
    id: FastMatrixScenarioType
    label: string              // e.g. "Bullish Wave 2 (Crash Trap)"
    active: boolean
    direction: 'long' | 'short'
    waveType: 2 | 4
    // Confirmation layer (M15)
    goldenPocket: GoldenPocket | null     // Wave 2 scenarios only
    diamondBox: DiamondBox | null         // Wave 4 scenarios only
    rsiDivergence: RSIDivergence
    macdDivergence: MACDDivergence
    // Trigger layer (M1)
    volumeClimax: VolumeClimax
    choch: CHoCHSignal
    stochasticReload: StochasticReload
    // Execution
    springPrice: number | null
    entryPrice: number | null
    stopLoss: number | null
    tp1: number | null                    // 100% Fib extension (close 50%)
    tp2: number | null                    // 161.8% Fib extension (close 50%)
    riskRewardToTP1: number | null
    riskRewardToTP2: number | null
    positionSizeUnits: number | null
    riskPercent: number
    riskAmount: number | null
    score: number                         // 0-100
    status: 'inactive' | 'watching' | 'confirming' | 'triggered' | 'invalid'
    details: string
}

export interface FastMatrixSetup {
    activeScenario: FastMatrixScenarioType | null
    overallScore: number
    direction: 'long' | 'short' | 'neutral'
    narrative: string
    macro: MacroDirection
    scenarios: {
        A: FastMatrixScenario    // Bullish Wave 2 (Crash Trap)
        B: FastMatrixScenario    // Bullish Wave 4 (Diamond Chop)
        C: FastMatrixScenario    // Bearish Wave 2 (Relief Trap)
        D: FastMatrixScenario    // Bearish Wave 4 (Diamond Chop)
    }
    keyLevels: {
        goldenPocketHigh: number | null
        goldenPocketLow: number | null
        diamondBoxHigh: number | null
        diamondBoxLow: number | null
        equilibriumPrice: number | null
        springPrice: number | null
        entryPrice: number | null
        stopLoss: number | null
        tp1: number | null
        tp2: number | null
    }
}

// Backward compat aliases — old code/stored data may reference these
export type HarmonicConvergenceSetup = FastMatrixSetup
export type TrueFractalSetup = FastMatrixSetup

// ── Data Payload (raw data collected for AI) ──

export interface TimeframeData {
    timeframe: 'M' | 'W' | 'D' | 'H4' | 'H1' | 'M15' | 'M1'
    candles: OandaCandle[]
    indicators: CalculatedIndicators
    trend: TrendAssessment
    patterns: string[]  // detected candlestick pattern names
    swingHighs: PriceLevel[]
    swingLows: PriceLevel[]
    fractalAnalysis?: {
        recentBullishFractals: Array<{ price: number; time: string; aboveTeeth: boolean }>
        recentBearishFractals: Array<{ price: number; time: string; belowTeeth: boolean }>
        alligatorState: 'sleeping' | 'awakening' | 'eating' | 'sated'
        alligatorDirection: 'bullish' | 'bearish' | 'neutral'
        aoStatus: { value: number; trend: 'rising' | 'falling' | 'flat'; signal: string }
        acStatus: { value: number; consecutiveGreen: number; consecutiveRed: number }
        setupScore: number
        setupDirection: 'buy' | 'sell' | 'none'
        signals: string[]
        volumeConfirmation: {
            breakoutConfirmed: boolean
            volumeRatio: number
            verdict: string
            trapWarning: boolean
        }
    }
    elliottWave?: ElliottWaveAnalysis
}

export interface PriceLevel {
    price: number       // The primary level (high for swing highs, low for swing lows)
    time: string
    strength: number    // how many times tested
    oppositeExtreme?: number  // Gann concept: high of swing low bar, or low of swing high bar
}

export interface CorrelationInsight {
    activePatterns: Array<{
        id: string
        description: string
        accuracy: number
        occurrences: number
        expectedOutcome: { pair: string; direction: string; minMove: number }
        conditionsMet: number
        totalConditions: number
        matchPercentage: number
    }>
    tomorrowPredictions?: {
        topPredictions: Array<{
            pair: string
            direction: 'up' | 'down'
            expectedMove: number
            supportingPatterns: number
            avgAccuracy: number
        }>
        confidence: 'high' | 'medium' | 'low'
        aiSynthesis: string
    }
}

export interface StoryDataPayload {
    pair: string
    instrument: string // OANDA format: EUR_USD
    pipLocation: number
    currentPrice: number
    timeframes: TimeframeData[]
    amdPhases: Record<string, AMDPhase>  // keyed by TF
    liquidityZones: LiquidityZone[]
    volatilityStatus: string
    atr14: number
    atr50: number
    atrRatio: number  // atr14/atr50 — >1 = expanding, <1 = contracting
    fastMatrix?: FastMatrixSetup                     // The Fast Matrix scenario analysis
    harmonicConvergence?: FastMatrixSetup            // Backward compat alias
    trueFractal?: FastMatrixSetup                    // Backward compat alias
    correlationInsights?: CorrelationInsight  // Hedge fund grade: multi-currency pattern analysis
    recent_trades?: Array<{
        direction: string
        status: string
        entry_price: number
        exit_price?: number | null
        stop_loss?: number | null
        take_profit?: number | null
        closed_at?: string | null
        story_season_number?: number | null
        episode_number?: number | null
        episode_title?: string | null
    }>
    live_oanda_position?: {
        id: string
        units: number
        entryPrice: number
        currentPrice: number
        unrealizedPL: number
        stopLoss?: number
        takeProfit?: number
        marginUsed: number
    }
    collectedAt: string
}

// ── AMD (Accumulation-Manipulation-Distribution) ──

export type AMDPhaseName = 'accumulation' | 'manipulation' | 'distribution' | 'unknown'

export interface AMDPhase {
    phase: AMDPhaseName
    confidence: number  // 0-100
    signals: string[]   // reasons for this assessment
}

// ── Liquidity Mapping ──

export interface LiquidityZone {
    type: 'equal_highs' | 'equal_lows' | 'stop_hunt' | 'order_block'
    price: number
    timeframe: string
    description: string
    swept: boolean
}

// ── Episode Types (trade-cycle lifecycle) ──

export type EpisodeType = 'analysis' | 'position_entry' | 'position_management'

// ── Position Guidance (AI-guided trading across episodes) ──

export interface PositionGuidance {
    action: 'enter_long' | 'enter_short' | 'set_limit_long' | 'set_limit_short' | 'hold' | 'adjust' | 'close' | 'wait'
    confidence: number  // 0-1, how confident in this recommendation
    reasoning: string   // 2-3 sentences explaining why
    // Entry details (when action is enter_long/enter_short)
    entry_price?: number
    stop_loss?: number
    take_profit_1?: number
    take_profit_2?: number
    take_profit_3?: number
    // Adjustment details (when action is adjust)
    move_stop_to?: number
    partial_close_percent?: number  // e.g. 50 = close 50%
    new_take_profit?: number
    // Close details (when action is close)
    close_reason?: string
    // Position sizing (when action is enter_long/enter_short)
    suggested_lots?: number       // calculated lot size based on risk rules
    risk_percent?: number         // % of account risked (e.g. 1.5)
    risk_amount?: number          // $ amount risked
    // Scenario alignment
    favored_scenario_id?: string  // which scenario this aligns with
}

// ── Story Output (from AI pipeline) ──

export interface CharacterAnalysis {
    strength: 'dominant' | 'strong' | 'balanced' | 'weak' | 'exhausted'
    momentum: string
    narrative: string
}

export interface Scenario {
    id: string
    title: string
    description: string
    probability: number
    trigger_conditions: string
    invalidation: string
    direction: 'bullish' | 'bearish'
    trigger_level?: number
    trigger_direction?: 'above' | 'below'
    trigger_timeframe?: 'H1' | 'H4' | 'D'
    invalidation_level?: number
    invalidation_direction?: 'above' | 'below'
}

export interface StoryResult {
    story_title: string
    narrative: string
    characters: {
        buyers: CharacterAnalysis
        sellers: CharacterAnalysis
    }
    current_phase: AMDPhaseName
    scenarios: Scenario[]
    key_levels: {
        entries: number[]
        stop_losses: number[]
        take_profits: number[]
    }
    next_episode_preview: string
    confidence: number
    bible_update: {
        arc_summary: string
        key_events: Array<{ episode_number: number; event: string; significance: string }>
        character_evolution: {
            buyers: { arc: string; turning_points: string[] }
            sellers: { arc: string; turning_points: string[] }
        }
        unresolved_threads: Array<{ thread: string; introduced_episode: number; description: string }>
        resolved_threads: Array<{ thread: string; introduced_episode: number; resolved_episode: number; outcome: string }>
        dominant_themes: string[]
        trade_history_summary: string
        lessons_learned: string[] // Strategic reflections on mistakes and successful setups
    }
    is_season_finale: boolean // AI decides if the current narrative arc/season should end
    position_guidance: PositionGuidance
    desk_messages?: Array<{
        speaker: 'ray' | 'sarah' | 'alex' | 'marcus'
        message: string
        message_type: 'comment' | 'alert' | 'block' | 'approval' | 'challenge'
        tone: 'positive' | 'negative' | 'neutral' | 'warning'
    }>
    desk_evaluation?: {
        verdict: 'approved' | 'caution' | 'blocked' | 'neutral'
        reason: string
    }
}

// ── News Context ──

export interface StoryNewsContext {
    sentiment: 'bullish' | 'bearish' | 'neutral'
    key_drivers: string[]
    fundamental_narrative: string
    calendar_events: string[]
    avoidTrading: boolean
}
