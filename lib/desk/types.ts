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

export interface ActiveScenario {
    pair: string
    title: string
    direction: string
    probability: number
    trigger_conditions: string
}

export interface MarketContext {
    overall_sentiment: string
    key_events_today: string[]
    volatility_status: Record<string, string>
}

export interface FractalSetupSummary {
    pair: string
    timeframe: string
    alligatorState: string
    setupScore: number
    setupDirection: string
    signals: string[]
}

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
    activeScenarios: ActiveScenario[]
    latestEpisodes: Record<string, { title: string; narrative_summary: string; current_phase: string }>
    activeStoryPositions: Array<{
        pair: string
        direction: string
        status: string
        entry_price: number
        current_sl: number | null
    }>
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
}
