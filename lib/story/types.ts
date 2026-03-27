import type { OandaCandle } from '@/lib/types/oanda'
import type { CalculatedIndicators } from '@/lib/strategy/types'
import type { TrendAssessment } from '@/lib/utils/trend-detector'

// ── Data Payload (raw data collected for AI) ──

export interface TimeframeData {
    timeframe: 'M' | 'W' | 'D' | 'H4' | 'H1'
    candles: OandaCandle[]
    indicators: CalculatedIndicators
    trend: TrendAssessment
    patterns: string[]  // detected candlestick pattern names
    swingHighs: PriceLevel[]
    swingLows: PriceLevel[]
}

export interface PriceLevel {
    price: number
    time: string
    strength: number  // how many times tested
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
    recent_trades?: Array<{
        direction: string
        status: string
        entry_price: number
        exit_price?: number | null
        stop_loss?: number | null
        take_profit?: number | null
        closed_at?: string | null
    }>
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
        trade_history_summary: string // Recap of trades, positions, and their outcomes
    }
    is_season_finale: boolean // AI decides if the current narrative arc/season should end
}

// ── News Context ──

export interface StoryNewsContext {
    sentiment: 'bullish' | 'bearish' | 'neutral'
    key_drivers: string[]
    fundamental_narrative: string
    calendar_events: string[]
    avoidTrading: boolean
}
