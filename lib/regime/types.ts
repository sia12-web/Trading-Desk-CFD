/**
 * Regime-Switching Engine — Type Definitions
 *
 * "You do not tweak the weapon. You change the weapon."
 * Each bot has FROZEN parameters. The only intelligence is
 * regime classification → strategy selection.
 */

import type { OperatorSetup } from '@/lib/strategy/operator-detector'
import type { KillzoneSetup, InstitutionalKillzoneSetup } from '@/lib/utils/killzone-detector'
import type { PositionSizeResult } from '@/lib/risk/position-sizer'

// ═══════════════════════════════════════════════════════════════════════════
// Regime Classification
// ═══════════════════════════════════════════════════════════════════════════

export type RegimeType =
    | 'ranging_quiet'        // Tight range, low ADX → Trap Bot (Division 1: Sniper)
    | 'trending_strong'      // Strong trend, high ADX → Momentum Bot full size (Division 2: Rider)
    | 'trending_mild'        // Moderate trend → Momentum Bot reduced size (Division 2: Rider)
    | 'complex_correction'   // 15+ MA crosses → Killzone Bot
    | 'news_chaos'           // HIGH-impact news event window → Ghost Bot (Division 3)
    | 'unknown_dangerous'    // Conflicting signals → ALL bots OFF (Condition Black)

export type ActiveBot = 'trap' | 'killzone' | 'momentum' | 'ghost' | 'none'

export interface RegimeIndicators {
    atrPercentile: number          // 0-100 (current ATR vs 50-period avg)
    adxValue: number               // ADX(14) value
    adxRising: boolean             // ADX slope positive
    donchianCompression: boolean   // width < 0.6x avg
    donchianExpansion: boolean     // width > 1.5x avg
    slopesAligned: boolean         // MA(20) and MA(50) same direction
    maCrossCount: number           // From existing market-state
    volumeExpanding: boolean       // Recent vol > 1.3x avg
    spreadWidthRatio: number       // Current spread / avg spread — >3x triggers Condition Black
    cvdErratic: boolean            // CVD direction changes >5x in last 20 bars
}

export interface RegimeClassification {
    regime: RegimeType
    activeBot: ActiveBot
    indicators: RegimeIndicators
    confidence: number             // 0-100
    sizeMultiplier: number         // 1.0 full, 0.5 reduced, 0 off
    narrative: string
    classifiedAt: string
    conditionBlack: boolean        // True when unknown_dangerous AND (spread >3x OR CVD erratic)
}

// ═══════════════════════════════════════════════════════════════════════════
// Momentum Bot
// ═══════════════════════════════════════════════════════════════════════════

export interface MomentumSetup {
    detected: boolean
    direction: 'long' | 'short' | 'none'

    // Entry conditions
    priceAboveVWAP: boolean
    emaAlignment: boolean          // EMA(20) vs EMA(50) in trend direction
    adxAboveThreshold: boolean     // ADX > 30
    momentumPositive: boolean      // MACD histogram confirms direction

    // Levels
    entryPrice: number | null
    stopLoss: number | null        // wider of 1.5x ATR or Donchian opposite
    takeProfit1: number | null     // 2x ATR
    takeProfit2: number | null     // 3x ATR

    // Trailing stop (Operator's Note: format distance to pair-specific decimal precision)
    trailingStopDistance: number | null  // 1.5x ATR — primary exit mechanism
    trailingActivation: number | null    // 1x ATR profit before trailing activates

    // Metadata
    atrValue: number
    vwapValue: number
    adxValue: number
    ema20: number
    ema50: number

    confidence: number             // 0-100
    confluenceFactors: string[]
    narrative: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Ghost Bot (Division 3: Volatility Harvester)
// ═══════════════════════════════════════════════════════════════════════════

export interface GhostSetup {
    detected: boolean
    direction: 'long' | 'short' | 'none'

    // Judas swing detection
    judasSwingDetected: boolean
    judasDirection: 'up' | 'down' | 'none'
    judasWickSize: number              // in pips
    judasVolumeRatio: number           // vs 20-bar avg

    // Reversal confirmation
    reversalConfirmed: boolean
    reversalPercentage: number         // % of wick retraced

    // Levels (Operator's Note: use live Bid/Ask spread for R:R, not mid price)
    entryPrice: number | null
    stopLoss: number | null
    takeProfit: number | null          // 1:1 R:R — spread-adjusted
    spreadAtExecution: number | null   // Captured live spread in pips

    // Context
    newsEvent: string | null
    minutesSinceEvent: number | null
    confidence: number                 // 0-100
    narrative: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

export interface RegimeExecutionDecision {
    pair: string
    regime: RegimeClassification

    // Which bot produced the setup
    botUsed: ActiveBot
    operatorSetup: OperatorSetup | null
    killzoneSetup: KillzoneSetup | InstitutionalKillzoneSetup | null
    momentumSetup: MomentumSetup | null
    ghostSetup: GhostSetup | null

    // Normalized execution parameters
    direction: 'long' | 'short' | 'none'
    entryPrice: number | null
    stopLoss: number | null
    takeProfit1: number | null
    takeProfit2: number | null
    positionSize: PositionSizeResult | null

    // Execution outcome
    executed: boolean
    dryRun: boolean
    orderId: string | null
    blockedReason: string | null

    timestamp: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Scanner
// ═══════════════════════════════════════════════════════════════════════════

export interface PairRegimeState {
    pair: string
    success: boolean
    error?: string

    regime: RegimeClassification
    botSetup: {
        trap: OperatorSetup | null
        killzone: KillzoneSetup | InstitutionalKillzoneSetup | null
        momentum: MomentumSetup | null
        ghost: GhostSetup | null
    }

    bestSetup: {
        detected: boolean
        botUsed: ActiveBot
        direction: 'long' | 'short' | 'none'
        confidence: number
        entryPrice: number | null
        stopLoss: number | null
        takeProfit1: number | null
        takeProfit2: number | null
    } | null

    scannedAt: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════════════════════

export interface RegimeEngineConfig {
    enabled: boolean
    dryRunMode: boolean            // TRUE by default (safety first)
    maxTradesPerDay: number        // 3
    riskAmount: number             // $17
    minConfidence: number          // 60
    cooldownMinutes: number        // 30
    enableTrapBot: boolean
    enableKillzoneBot: boolean
    enableMomentumBot: boolean
    enableGhostBot: boolean
}

export const DEFAULT_REGIME_CONFIG: RegimeEngineConfig = {
    enabled: false,
    dryRunMode: true,
    maxTradesPerDay: 3,
    riskAmount: 17,
    minConfidence: 60,
    cooldownMinutes: 30,
    enableTrapBot: true,
    enableKillzoneBot: true,
    enableMomentumBot: true,
    enableGhostBot: true,
}
