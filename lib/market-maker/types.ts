/**
 * Whale Psychology Simulator — Types
 *
 * Educational simulation where a deterministic whale engine + 50 individual
 * retail traders + one DeepSeek narrator simulate how institutional market
 * makers think and exploit retail psychology on EUR/JPY M1 data.
 *
 * Key insight: ATR is NOT given to the whale. The whale's manipulation actions
 * should CREATE ATR-like volatility, proving that institutional manipulation
 * explains real ATR behavior.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Session Phases
// ═══════════════════════════════════════════════════════════════════════════

export type SessionPhase =
    | 'accumulation'    // 08:30-09:15 ET — Quietly buy at the floor
    | 'manipulation'    // 09:15-10:00 ET — Stop hunts, fake breakouts
    | 'distribution'    // 10:00-10:30 ET — Sell into retail FOMO
    | 'cleanup'         // 10:30-11:30 ET — Forced position unwind

// ═══════════════════════════════════════════════════════════════════════════
// Whale's Book (Inventory)
// ═══════════════════════════════════════════════════════════════════════════

export type WhaleActionType = 'accumulate' | 'manipulate' | 'distribute' | 'hold'

export interface WhaleAction {
    timestamp: string
    candleIndex: number
    type: WhaleActionType
    units: number
    price: number
    manipulationDirection?: 'up' | 'down'
    manipulationCost?: number
    reasoning: string
    phase: SessionPhase
}

export interface WhaleBook {
    positionSize: number         // Current net position (positive = long)
    averageEntry: number         // Weighted avg entry price
    unrealizedPnl: number        // Current unrealized PnL in pips
    realizedPnl: number          // Cumulative realized PnL in pips
    manipulationCost: number     // Total pips spent on stop hunts
    totalAccumulated: number     // Total units bought
    totalDistributed: number     // Total units sold
    actions: WhaleAction[]       // Full action history
}

export interface WhaleDecision {
    action: WhaleActionType
    units: number
    manipulationDirection?: 'up' | 'down'
    reasoning: string
    confidence: number            // 0-100
    retailImpact: string          // How this hurts/helps retail
}

// ═══════════════════════════════════════════════════════════════════════════
// Individual Retail Traders (50 agents)
// ═══════════════════════════════════════════════════════════════════════════

export type ExperienceLevel = 'novice' | 'intermediate' | 'advanced'

export type RetailTraderStatus = 'watching' | 'in_position' | 'stopped_out' | 'took_profit'

export interface RetailTrader {
    id: number                    // 1-50
    name: string                  // "Eager Bull #1"
    accountSize: number           // $1000-$5000
    riskTolerance: number         // 1-5% per trade
    fomoScore: number             // 0-100 (FOMO propensity)
    experience: ExperienceLevel
    position: RetailPosition | null
    totalPnl: number              // Running PnL in pips
    totalTrades: number
    status: RetailTraderStatus
}

export interface RetailPosition {
    direction: 'long' | 'short'
    entryPrice: number
    units: number
    stopLoss: number
    takeProfit: number
    enteredAt: string             // ISO timestamp
    reason: string                // Why they entered
}

export interface RetailEvent {
    traderId: number
    traderName: string
    timestamp: string
    type: 'entry' | 'stop_out' | 'take_profit' | 'fomo' | 'panic'
    price: number
    pnl?: number                  // For exits
    reason: string                // Human-readable
}

export interface RetailTraderSnapshot {
    traderId: number
    name: string
    experience: ExperienceLevel
    position: RetailPosition | null
    totalPnl: number
    status: RetailTraderStatus
}

// ═══════════════════════════════════════════════════════════════════════════
// Whale Psychology (DeepSeek Narrator Output)
// ═══════════════════════════════════════════════════════════════════════════

export interface WhalePsychology {
    narrative: string             // 3-5 sentences explaining whale's thinking
    retailExploitation: string    // How retail gets exploited this step
    educationalInsight: string    // Key lesson for the user
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Context (Asian, London context for NY whale)
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionContext {
    session: 'asian' | 'london'
    open: number
    high: number
    low: number
    close: number
    range: number  // high - low in pips
    direction: 'bullish' | 'bearish' | 'ranging'
    volumeAvg: number
    imbalances: number  // Count of unfilled gaps/imbalances
    narrative: string  // What happened this session
}

// Institutional Bias (Operator's 3-Step Protocol)
export type BiasDirection = 'LONG' | 'SHORT' | 'NEUTRAL'

export interface InstitutionalBias {
    h1Proximity: {
        donchianHigh: number
        donchianLow: number
        donchianMiddle: number
        currentPrice: number
        distanceToFloor: number
        distanceToCeiling: number
        bias: BiasDirection
        confidence: number
        reasoning: string
    }
    londonHandoff: {
        londonOpen: number
        londonClose: number
        londonHigh: number
        londonLow: number
        londonRange: number
        londonDirection: 'bullish' | 'bearish' | 'ranging'
        londonTrend: 'strong' | 'moderate' | 'weak'
        bias: BiasDirection
        confidence: number
        reasoning: string
    }
    cvdDivergence: {
        priceChange: number
        cvdChange: number
        divergence: 'bearish' | 'bullish' | 'none'
        bias: BiasDirection
        confidence: number
        reasoning: string
    }
    finalBias: BiasDirection
    finalConfidence: number
    consensusScore: number
    summary: string
}

export interface FairValueProfile {
    fairValue: number  // 30-day volume POC (true fair price)
    valueAreaHigh: number  // 70% volume high
    valueAreaLow: number  // 70% volume low
    premiumZone: number  // Above fair value (expensive)
    discountZone: number  // Below fair value (cheap)
    daysCalculated: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Market Snapshot (given to whale each step)
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketSnapshot {
    currentPrice: number
    sessionHigh: number
    sessionLow: number
    phase: SessionPhase
    minutesElapsed: number
    // CVD summary (institutional flow)
    cvdCurrent: number
    cvdTrend: 'rising' | 'falling' | 'flat'
    // Donchian Channel
    donchianHigh: number
    donchianLow: number
    donchianMiddle: number
    // Volume Profile (session-specific)
    volumePOC: number
    valueAreaHigh: number
    valueAreaLow: number
    // Session context
    asianSession: SessionContext
    londonSession: SessionContext
    fairValueProfile: FairValueProfile
}

// ═══════════════════════════════════════════════════════════════════════════
// Simulation Step (one 15-minute window)
// ═══════════════════════════════════════════════════════════════════════════

export interface SimulationStep {
    stepIndex: number             // 0-11
    phase: SessionPhase
    candleStartIndex: number
    candleEndIndex: number
    market: MarketSnapshot
    book: WhaleBook
    decision: WhaleDecision
    // Whale psychology (DeepSeek narrator)
    psychology: WhalePsychology
    // Individual retail trader data
    retailEvents: RetailEvent[]
    retailSnapshots: RetailTraderSnapshot[]
    // Stop loss heatmap (where retail stops cluster)
    stopLossHeatmap: {
        levels: number[]          // Price levels with stops
        counts: number[]          // How many stops at each level
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Full Session Replay
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionReplay {
    date: string                  // YYYY-MM-DD
    pair: string                  // EUR/JPY
    instrument: string            // EUR_JPY
    sessionStart: string          // ISO timestamp (08:30 ET in UTC)
    sessionEnd: string            // ISO timestamp (11:30 ET in UTC)
    totalCandles: number
    steps: SimulationStep[]
    finalBook: WhaleBook
    finalRetailTraders: RetailTrader[]
    retailAggregateStats: {
        totalStoppedOut: number
        totalProfitable: number
        avgPnl: number            // Average pips per trader
        totalVolumeLost: number   // Total pips lost by retail to whale
    }
    atrComparison: {
        realATR: number[]         // Actual ATR values per candle
        whaleVolatility: number[] // Volatility caused by whale actions per candle
    }
    // Institutional bias detection (Operator's 3-Step Protocol)
    institutionalBias: InstitutionalBias
    // Chart data (pre-processed for frontend)
    candleData: CandleChartPoint[]
}

export interface CandleChartPoint {
    time: string
    index: number
    open: number
    close: number
    high: number
    low: number
    volume: number
    // Overlay markers
    whaleAction?: WhaleActionType
    whaleUnits?: number
    donchianHigh?: number
    donchianLow?: number
    volumePOC?: number
}
