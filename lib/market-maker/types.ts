/**
 * Market Maker / Whale Simulator — Types
 *
 * Educational simulation where the AI Trio plays as an institutional whale
 * on EUR/JPY M1 data from 08:30-11:30 AM ET.
 *
 * Key insight: ATR is NOT given to the AI. The AI's manipulation actions
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

// ═══════════════════════════════════════════════════════════════════════════
// Retail Crowd State
// ═══════════════════════════════════════════════════════════════════════════

export interface RetailState {
    sentiment: number            // 0-100 (0=extreme fear, 100=extreme greed)
    breakoutBias: 'long' | 'short' | 'neutral'
    stopHuntVictims: number      // Cumulative count of retail stops triggered
    fomoIntensity: number        // 0-100
    narrative: string            // Human-readable retail crowd belief
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

export interface FairValueProfile {
    fairValue: number  // 30-day volume POC (true fair price)
    valueAreaHigh: number  // 70% volume high
    valueAreaLow: number  // 70% volume low
    premiumZone: number  // Above fair value (expensive)
    discountZone: number  // Below fair value (cheap)
    daysCalculated: number
}

// ═══════════════════════════════════════════════════════════════════════════
// Market Snapshot (given to AI each step)
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
    // NEW: Session context
    asianSession: SessionContext
    londonSession: SessionContext
    fairValueProfile: FairValueProfile
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Outputs
// ═══════════════════════════════════════════════════════════════════════════

export interface GeminiOutput {
    floor: number
    ceiling: number
    retailStopZone: number
    structuralBias: 'bullish' | 'bearish' | 'neutral'
    narrative: string
}

export interface DeepSeekOutput {
    recommendedAction: WhaleActionType
    units: number
    manipulationCost: number
    expectedPnlImpact: number
    riskAssessment: string
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
// Simulation Step (one 15-minute window)
// ═══════════════════════════════════════════════════════════════════════════

export interface SimulationStep {
    stepIndex: number             // 0-11
    phase: SessionPhase
    candleStartIndex: number
    candleEndIndex: number
    market: MarketSnapshot
    book: WhaleBook
    retail: RetailState
    decision: WhaleDecision
    aiResponses: {
        gemini: string            // Raw Gemini output
        deepseek: string          // Raw DeepSeek output
        claude: string            // Raw Claude output
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
    finalRetail: RetailState
    atrComparison: {
        realATR: number[]         // Actual ATR values per candle
        whaleVolatility: number[] // Volatility caused by whale actions per candle
    }
    // Chart data (pre-processed for frontend)
    candleData: CandleChartPoint[]
}

export interface CandleChartPoint {
    time: string
    index: number
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
