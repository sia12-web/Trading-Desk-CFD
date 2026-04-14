/**
 * Regime Backtester — Automated Army Simulation
 *
 * Runs the Regime Engine over historical data to simulate the performance
 * of the 3 Divisions (Sniper, Rider, Killzone). Note: Ghost bot requires M1 data
 * and is excluded from long-term simulation to avoid API rate limits.
 */

import { getCandles } from '@/lib/data/candle-fetcher'
import { classifyRegime } from './classifier'
import { detectOperator } from '@/lib/strategy/operator-detector'
import { detectMomentum } from './momentum-bot'
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'
import { detectKillzone, detectInstitutionalKillzone } from '@/lib/utils/killzone-detector'
import { detectMarketState } from '@/lib/utils/market-state'
import { getAssetConfig } from '@/lib/data/asset-config'
import type { BacktestTrade, BacktestMetrics } from '@/lib/correlation/backtester'
import type { ActiveBot } from './types'

export interface RegimeBacktestResult {
    pair: string
    lookback_days: number
    total_candles_scanned: number
    regime_distribution: Record<string, number>
    trades: (BacktestTrade & {
        regime: string
        bot_used: string
        confidence: number
    })[]
    metrics: BacktestMetrics
    equity_curve: Array<{ date: string; equity: number }>
}

export async function backtestRegimeForPair(
    pair: string,
    lookbackDays: number = 21, // 3 weeks default
    riskPerTrade: number = 2
): Promise<RegimeBacktestResult> {
    console.log(`[Regime Backtester] Starting simulation for ${pair} (${lookbackDays} days)`)
    
    const instrument = pair.replace('/', '_')
    const assetConfig = getAssetConfig(pair)
    const dp = assetConfig.decimalPlaces
    const mult = assetConfig.pointMultiplier === 100 ? 100 : 10000

    // Fetch historical candles (We need H1 for Killzone, M15 for Regime + Div 1/2)
    // 3 weeks = 21 days. M15: 21 * 24 * 4 = 2016 candles. Add buffer for indicators (200).
    const m15Count = lookbackDays * 96 + 200
    const h1Count = lookbackDays * 24 + 100

    const [h1Response, m15Response] = await Promise.all([
        getCandles({ instrument, granularity: 'H1', count: h1Count }),
        getCandles({ instrument, granularity: 'M15', count: m15Count })
    ])

    if (h1Response.error || !h1Response.data || h1Response.data.length < 100) {
        throw new Error(`Insufficient H1 data for ${pair}`)
    }

    if (m15Response.error || !m15Response.data || m15Response.data.length < 200) {
        throw new Error(`Insufficient M15 data for ${pair}`)
    }

    const h1Candles = h1Response.data
    const m15Candles = m15Response.data

    const trades: (BacktestTrade & { regime: string, bot_used: string, confidence: number })[] = []
    let accountBalance = 10000
    const equityCurve: Array<{ date: string; equity: number }> = [
        { date: m15Candles[200].time.split('T')[0], equity: accountBalance }
    ]

    const regimeDistribution: Record<string, number> = {}

    // Cooldown state
    let lastTradeIndex = -1
    const cooldownCandles = 4 // 1 hour cooldown (4 M15 candles)

    // Global Governors State
    let lastProcessedDay = ''
    let dailyTradesByBot: Record<string, number> = {}
    let dailyStartingEquity = accountBalance
    let circuitBreakerHit = false

    // Simulate step by step on M15 
    for (let i = 200; i < m15Candles.length - 20; i++) {
        const currentCandle = m15Candles[i]
        const currentDate = currentCandle.time.split('T')[0]

        // 1. Reset daily counters and check circuit breaker at start of new day
        if (currentDate !== lastProcessedDay) {
            lastProcessedDay = currentDate
            dailyTradesByBot = { trap: 0, momentum: 0, killzone: 0, ghost: 0 }
            dailyStartingEquity = accountBalance
            circuitBreakerHit = false
        }

        // 2. Daily Loss Circuit Breaker: 1.5% max loss per day
        const currentDailyDrawdown = (dailyStartingEquity - accountBalance) / dailyStartingEquity
        if (currentDailyDrawdown >= 0.015) {
            circuitBreakerHit = true
        }

        if (circuitBreakerHit) continue

        // 3. Skip if in cooldown
        if (lastTradeIndex !== -1 && i - lastTradeIndex < cooldownCandles) {
            continue
        }

        const m15Window = m15Candles.slice(i - 200, i + 1)
        
        // Match H1 window (find H1 candle that closes before or exactly at current M15 time)
        const currentM15Time = new Date(currentCandle.time).getTime()
        const h1Index = h1Candles.findIndex(c => new Date(c.time).getTime() > currentM15Time)
        const currentH1Index = h1Index === -1 ? h1Candles.length - 1 : Math.max(0, h1Index - 1)
        const h1Window = h1Candles.slice(Math.max(0, currentH1Index - 100), currentH1Index + 1)

        // Classify regime
        const regimeClass = classifyRegime(m15Window, pair)
        const { regime, activeBot, confidence } = regimeClass
        
        regimeDistribution[regime] = (regimeDistribution[regime] || 0) + 1

        let direction: 'long' | 'short' | 'none' = 'none'
        let entryPrice: number | null = null
        let stopLoss: number | null = null
        let takeProfit: number | null = null
        let botConfidence = 0

        if (activeBot === 'trap') {
            const setup = detectOperator(m15Window, pair, 'M15')
            if (setup.detected) {
                direction = setup.direction
                entryPrice = setup.entryPrice
                stopLoss = setup.stopLoss
                takeProfit = setup.takeProfit
                botConfidence = setup.confidence
            }
        } else if (activeBot === 'momentum') {
            const setup = detectMomentum(m15Window, pair)
            if (setup.detected) {
                direction = setup.direction
                entryPrice = setup.entryPrice
                stopLoss = setup.stopLoss
                takeProfit = setup.takeProfit1 // Use TP1 for simulation
                botConfidence = setup.confidence
            }
        } else if (activeBot === 'killzone') {
            if (h1Window.length >= 50) {
                const h1Closes = h1Window.map(c => parseFloat(c.mid.c))
                const h1Rsi = calculateRSI(h1Closes, 14)
                const h1Macd = calculateMACD(h1Closes, 12, 26, 9)
                const waveState = detectH1ElliottWave(h1Window, h1Rsi, h1Macd.macdLine, h1Macd.signalLine)
                const marketState = detectMarketState(m15Window)
                
                const killzone = marketState.proceedToTier2
                    ? detectInstitutionalKillzone(waveState, m15Window, pair, marketState)
                    : detectKillzone(waveState, m15Window, pair)

                if (killzone.detected && killzone.confidence >= 50) {
                    direction = killzone.direction === 'bullish' ? 'long' : 'short'
                    entryPrice = killzone.box?.center ?? null
                    
                    if (entryPrice && killzone.box) {
                        const slDist = killzone.box.widthPips / mult
                        stopLoss = direction === 'long' ? entryPrice - slDist : entryPrice + slDist
                        takeProfit = direction === 'long' ? entryPrice + slDist * 1.5 : entryPrice - slDist * 1.5
                        botConfidence = killzone.confidence
                    } else {
                        direction = 'none'
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // Step 4: Execute if setup found + Governor Check
        // ═══════════════════════════════════════════════════════════════════
        if (direction !== 'none' && entryPrice && stopLoss && takeProfit) {
            // Max 3 trades per division per day
            const currentBotCount = dailyTradesByBot[activeBot] || 0
            if (currentBotCount >= 3) continue

            dailyTradesByBot[activeBot] = (dailyTradesByBot[activeBot] || 0) + 1
            lastTradeIndex = i
            
            // Fast forward to find outcome (SL or TP hit)
            // Look ahead up to 100 M15 candles (~25 hours)
            let exitPrice = entryPrice
            let exitDate = currentDate
            let outcome: 'win' | 'loss' = 'loss'
            let exitIndex = i
            const maxLookahead = Math.min(i + 100, m15Candles.length)

            for (let j = i + 1; j < maxLookahead; j++) {
                const futCandle = m15Candles[j]
                const high = parseFloat(futCandle.mid.h)
                const low = parseFloat(futCandle.mid.l)
                const close = parseFloat(futCandle.mid.c)
                exitIndex = j

                if (direction === 'long') {
                    if (low <= stopLoss) {
                        exitPrice = stopLoss
                        exitDate = futCandle.time.split('T')[0]
                        outcome = 'loss'
                        break
                    }
                    if (high >= takeProfit) {
                        exitPrice = takeProfit
                        exitDate = futCandle.time.split('T')[0]
                        outcome = 'win'
                        break
                    }
                } else {
                    if (high >= stopLoss) {
                        exitPrice = stopLoss
                        exitDate = futCandle.time.split('T')[0]
                        outcome = 'loss'
                        break
                    }
                    if (low <= takeProfit) {
                        exitPrice = takeProfit
                        exitDate = futCandle.time.split('T')[0]
                        outcome = 'win'
                        break
                    }
                }
                
                if (j === maxLookahead - 1) {
                    exitPrice = close // Force close at end of window
                    exitDate = futCandle.time.split('T')[0]
                    outcome = (direction === 'long' && close > entryPrice) || (direction === 'short' && close < entryPrice) ? 'win' : 'loss'
                }
            }

            // Calc PnL
            const pips = direction === 'long'
                ? (exitPrice - entryPrice) * mult
                : (entryPrice - exitPrice) * mult

            // Simplified risk sizing: 2% of equity
            const riskAmount = accountBalance * (riskPerTrade / 100)
            const riskPips = Math.abs((entryPrice - stopLoss) * mult)
            const pipValue = riskPips > 0 ? riskAmount / riskPips : 0
            const profitLoss = pips * pipValue

            accountBalance += profitLoss

            trades.push({
                entry_date: currentDate,
                entry_price: Number(entryPrice.toFixed(dp)),
                exit_date: exitDate,
                exit_price: Number(exitPrice.toFixed(dp)),
                direction,
                pips: Math.round(pips * 10) / 10,
                profit_loss: Math.round(profitLoss * 100) / 100,
                duration_hours: Math.round((exitIndex - i) * 15 / 60), // M15 to hours
                outcome,
                regime,
                bot_used: activeBot,
                confidence: botConfidence,
                stop_loss: Number(stopLoss.toFixed(dp)),
                take_profit: Number(takeProfit.toFixed(dp))
            })

            equityCurve.push({
                date: exitDate,
                equity: Math.round(accountBalance * 100) / 100
            })
        }
    }

    const metrics = calculateMetrics(trades, equityCurve)
    
    console.log(`[Regime Backtester] Simulation complete. Extracted ${trades.length} trades. Win rate: ${metrics.win_rate}%`)

    return {
        pair,
        lookback_days: lookbackDays,
        total_candles_scanned: m15Candles.length - 200,
        regime_distribution: regimeDistribution,
        trades,
        metrics,
        equity_curve: equityCurve
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Local Metrics Calculator (Reused structure)
// ═══════════════════════════════════════════════════════════════════════════

function calculateMetrics(
    trades: BacktestTrade[],
    equityCurve: Array<{ date: string; equity: number }>
): BacktestMetrics {
    const winningTrades = trades.filter(t => t.outcome === 'win')
    const losingTrades = trades.filter(t => t.outcome === 'loss')

    const totalPips = trades.reduce((sum, t) => sum + t.pips, 0)
    const winPips = winningTrades.reduce((sum, t) => sum + t.pips, 0)
    const lossPips = Math.abs(losingTrades.reduce((sum, t) => sum + t.pips, 0))

    const avgWinPips = winningTrades.length > 0 ? winPips / winningTrades.length : 0
    const avgLossPips = losingTrades.length > 0 ? lossPips / losingTrades.length : 0

    const profitFactor = lossPips > 0 ? winPips / lossPips : 0
    const avgRR = avgLossPips > 0 ? avgWinPips / avgLossPips : 0

    let maxConsecWins = 0, maxConsecLosses = 0
    let currentConsecWins = 0, currentConsecLosses = 0

    for (const trade of trades) {
        if (trade.outcome === 'win') {
            currentConsecWins++; currentConsecLosses = 0
            maxConsecWins = Math.max(maxConsecWins, currentConsecWins)
        } else {
            currentConsecLosses++; currentConsecWins = 0
            maxConsecLosses = Math.max(maxConsecLosses, currentConsecLosses)
        }
    }

    let peak = equityCurve.length > 0 ? equityCurve[0].equity : 10000
    let maxDrawdownPips = 0
    let maxDrawdownPercent = 0

    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity
        const drawdown = peak - point.equity
        const drawdownPercent = (drawdown / peak) * 100

        maxDrawdownPips = Math.max(maxDrawdownPips, drawdown)
        maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent)
    }

    const returns = []
    for (let i = 1; i < equityCurve.length; i++) {
        returns.push((equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity)
    }

    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
    const stdDev = returns.length > 0 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0

    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0
    const expectancy = (winRate * avgWinPips) - ((1 - winRate) * avgLossPips)

    return {
        total_trades: trades.length,
        winning_trades: winningTrades.length,
        losing_trades: losingTrades.length,
        win_rate: Math.round(winRate * 1000) / 10,
        total_pips: Math.round(totalPips * 10) / 10,
        avg_win_pips: Math.round(avgWinPips * 10) / 10,
        avg_loss_pips: Math.round(avgLossPips * 10) / 10,
        largest_win: trades.length > 0 ? Math.round(Math.max(...trades.map(t => t.pips)) * 10) / 10 : 0,
        largest_loss: trades.length > 0 ? Math.round(Math.min(...trades.map(t => t.pips)) * 10) / 10 : 0,
        profit_factor: Math.round(profitFactor * 100) / 100,
        avg_rr_ratio: Math.round(avgRR * 100) / 100,
        max_consecutive_wins: maxConsecWins,
        max_consecutive_losses: maxConsecLosses,
        max_drawdown_pips: Math.round(maxDrawdownPips * 10) / 10,
        max_drawdown_percent: Math.round(maxDrawdownPercent * 100) / 100,
        sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
        sortino_ratio: 0,
        calmar_ratio: 0,
        expectancy: Math.round(expectancy * 10) / 10,
    }
}
