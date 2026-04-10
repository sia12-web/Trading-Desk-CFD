// =============================================================================
// Trading Desk — Type Definitions
// =============================================================================

export type Speaker = 'marcus' | 'sarah' | 'ray' | 'alex' | 'trader'
export type MeetingType = 'morning_meeting' | 'trade_review' | 'end_of_day' | 'ad_hoc'
export type MessageType = 'comment' | 'challenge' | 'approval' | 'block' | 'alert'

// --- Character Brief Types ---

export interface CharacterBrief {
    message: string
    tone: 'neutral' | 'positive' | 'cautious' | 'warning' | 'critical'
}

export interface AlexBrief extends CharacterBrief {
    data_sources: string[]
    macro_sentiment: 'bullish' | 'bearish' | 'mixed' | 'neutral'
    key_events: string[]
}

export interface RayAnalysis extends CharacterBrief {
    positions_reviewed: number
    probabilities: Record<string, number>
    edge_assessment: string
}

export interface SarahReport extends CharacterBrief {
    risk_status: 'green' | 'yellow' | 'red'
    violations: string[]
    blocks: string[]
    exposure_percent: number
}

export interface MarcusDirective extends CharacterBrief {
    priorities: string[]
    restrictions: string[]
    desk_verdict: 'proceed' | 'caution' | 'restricted' | 'blocked'
}

// --- Meeting Types ---

export interface DeskMeeting {
    id: string
    user_id: string
    meeting_type: MeetingType
    trigger_context: Record<string, unknown> | null
    alex_brief: AlexBrief | null
    ray_analysis: RayAnalysis | null
    sarah_report: SarahReport | null
    marcus_directive: MarcusDirective | null
    context_snapshot: Record<string, unknown> | null
    ai_model: string
    generation_duration_ms: number | null
    token_count: number | null
    created_at: string
}

export interface DeskMessage {
    id: string
    user_id: string
    meeting_id: string | null
    speaker: Speaker
    message: string
    message_type: MessageType
    context_data: Record<string, unknown> | null
    created_at: string
}

// --- Process Scoring ---

export interface ProcessScore {
    id: string
    user_id: string
    trade_id: string
    entry_criteria_score: number | null
    stop_loss_discipline: number | null
    rr_compliance: number | null
    size_discipline: number | null
    patience_score: number | null
    overall_score: number | null
    sarah_commentary: string | null
    marcus_commentary: string | null
    ai_lesson: string | null
    scored_at: string
}

// --- Desk State ---

export interface CharacterMemory {
    last_directive?: string
    recent_comments?: string[]
    concerns?: string[]
    [key: string]: unknown
}

export interface DeskState {
    id: string
    user_id: string
    marcus_memory: CharacterMemory
    sarah_memory: CharacterMemory & {
        violations_this_week?: number
        last_risk_status?: string
        blocks_issued?: string[]
    }
    ray_memory: CharacterMemory & {
        prediction_accuracy?: number
        regime_assessment?: string
    }
    alex_memory: CharacterMemory & {
        macro_thesis?: string
        key_events_tracked?: string[]
    }
    ai_trading_scars?: string[]
    current_streak: number
    weekly_process_average: number | null
    monthly_process_average: number | null
    total_meetings_attended: number
    last_meeting_at: string | null
    violations_this_week: number
    cooldown_until: string | null
    updated_at: string
}

// --- AI Generation Types ---

export interface MorningMeetingOutput {
    alex_brief: AlexBrief
    ray_analysis: RayAnalysis
    sarah_report: SarahReport
    marcus_directive: MarcusDirective
}

export interface TradeReviewOutput {
    ray_analysis: RayAnalysis & {
        confluence_score: number
        statistical_edge: string
    }
    sarah_report: SarahReport & {
        position_size_ok: boolean
        rule_violations: string[]
    }
    alex_brief: AlexBrief & {
        macro_alignment: 'aligned' | 'neutral' | 'conflicting'
    }
    marcus_directive: MarcusDirective & {
        final_verdict: 'approved' | 'approved_with_concerns' | 'blocked'
        conditions: string[]
    }
}

export interface ProcessScoreOutput {
    entry_criteria_score: number
    stop_loss_discipline: number
    rr_compliance: number
    size_discipline: number
    patience_score: number
    overall_score: number
    sarah_commentary: string
    marcus_commentary: string
    ai_lesson: string
}

// --- Trade Proposal (for desk review) ---

export interface TradeProposal {
    pair: string
    direction: 'long' | 'short'
    entry_price: number
    stop_loss: number
    take_profit: number
    lot_size?: number
    reasoning?: string
}

// --- Data Collector Types ---

export interface OpenPosition {
    pair: string
    direction: string
    entry_price: number
    current_pnl: number
    stop_loss: number | null
    take_profit: number | null
    opened_at: string
}

export interface ClosedTrade {
    id: string
    pair: string
    direction: string
    pnl_amount: number
    close_reason: string | null
    closed_at: string
}

export interface PortfolioSummary {
    totalPnL: number
    winRate: number
    totalTrades: number
    profitFactor: number
}

export interface CurrentExposure {
    openTradesCount: number
    totalRiskPercent: number
    pairs: string[]
}



export interface MarketContext {
    overall_sentiment: string
    key_events_today: string[]
    volatility_status: Record<string, string>
    // Cross-market intelligence (from story agent reports)
    risk_appetite?: 'risk-on' | 'risk-off' | 'mixed'
    equity_indices?: Array<{
        name: string
        instrument: string
        change_1d: number
        trend: string
    }>
    dollar_trend?: string
    cross_market_thesis?: string
    // Crypto market context (populated when crypto pairs are subscribed)
    cryptoContext?: {
        fearGreedIndex: number
        fearGreedLabel: string
        btcDominance: number
        btcPrice: number
        btcChange24h: number
        totalMarketCapChange24h: number
    }
}

export interface FractalSetupSummary {
    pair: string
    timeframe: string
    alligatorState: string
    setupScore: number
    setupDirection: string
    signals: string[]
}

export interface FastMatrixSummary {
    pair: string
    activeScenario: string | null      // 'A' | 'B' | 'C' | 'D' | null
    overallScore: number
    direction: string
    narrative: string
    // Macro
    h1Trend: string                    // 'bullish' | 'bearish' | 'ranging'
    directionalFilter: string          // 'buy_only' | 'sell_only' | 'no_trade'
    // Active scenario details
    waveType: number | null            // 2 or 4
    scenarioLabel: string | null
    rsiDivergence: boolean
    macdDivergence: boolean
    volumeClimax: boolean
    chochDetected: boolean
    stochasticReload: boolean
    // Key price levels
    goldenPocketHigh: number | null
    goldenPocketLow: number | null
    diamondBoxHigh: number | null
    diamondBoxLow: number | null
    springPrice: number | null
    entryPrice: number | null
    stopLoss: number | null
    tp1: number | null
    tp2: number | null
    riskRewardToTP2: number | null
}

export interface RSIDivergence {
    detected: boolean
    type: 'bullish' | 'bearish' | 'none' | null
    priceSwing1: number | null
    priceSwing2: number | null
    rsiSwing1: number | null
    rsiSwing2: number | null
    details: string
}

export interface MACDDivergence {
    detected: boolean
    type: 'bullish' | 'bearish' | 'none' | null
    histogramShallowing: boolean
    details: string
}

export interface StochasticReload {
    detected: boolean
    direction: 'bullish' | 'bearish' | 'none' | null
    kValue: number | null
    dValue: number | null
    crossTime: string | null
}

export interface GoldenPocket {
    fib50: number
    fib618: number
    goldenPocketHigh: number
    goldenPocketLow: number
    waveSwingHigh: number
    waveSwingLow: number
}

export interface CHoCHSignal {
    detected: boolean
    direction: 'bullish' | 'bearish' | 'none' | null
    breakPrice: number | null
    breakTime: string | null
    previousSwingPrice: number | null
}

export interface VolumeClimax {
    detected: boolean
    volumeRatio: number
    rejectionCandle: boolean
    time: string | null
}

export interface DiamondBox {
    boxHigh: number
    boxLow: number
    equilibriumPrice: number
    candlesInBox: number
    isReady: boolean
}



// Backward compat aliases
export type HarmonicConvergenceSummary = FastMatrixSummary
export type TrueFractalSummary = FastMatrixSummary

export interface DeskContext {
    openPositions: OpenPosition[]
    todayClosedTrades: ClosedTrade[]
    recentTrades: Array<{
        pair: string
        direction: string
        pnl_amount: number
        status: string
        closed_at: string | null
    }>
    portfolioSummary: PortfolioSummary
    todayPnL: number
    weekPnL: number
    activeRiskRules: Array<{
        rule_name: string
        rule_type: string
        value: Record<string, unknown>
        is_active: boolean
    }>
    currentExposure: CurrentExposure
    ruleViolations: Array<{ rule: string; current_value: number; limit: number }>
    profile: {
        trading_style: string | null
        risk_personality: string | null
        observed_weaknesses: string[]
        current_focus: string | null
    }
    deskState: DeskState | null
    recentProcessScores: ProcessScore[]
    marketContext: MarketContext
    fractalSetups: FractalSetupSummary[]
    trueFractalSetups?: TrueFractalSummary[]
    correlationInsights?: {
        activePatterns: Array<{
            description: string
            accuracy: number
            occurrences: number
            expectedOutcome: { pair: string; direction: string; minMove: number }
            matchPercentage: number
        }>
        predictions?: {
            topPredictions: Array<{
                pair: string
                direction: 'up' | 'down'
                expectedMove: number
                supportingPatterns: number
                avgAccuracy: number
            }>
            confidence: 'high' | 'medium' | 'low'
        }
    }
}
