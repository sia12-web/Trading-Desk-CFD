/**
 * Killzone Backtesting Engine
 *
 * Simulates historical Killzone setups and M1 entry triggers
 * to validate detector performance across historical data.
 */

import { getCandles } from '@/lib/data/candle-fetcher'
import { detectH1ElliottWave } from '@/lib/utils/elliott-wave-h1'
import { calculateRSI, calculateMACD } from '@/lib/utils/indicators'
import { detectKillzone, detectKillzoneEntry } from '@/lib/utils/killzone-detector'
import type { BacktestTrade, BacktestMetrics } from '@/lib/correlation/backtester'

export interface KillzoneBacktestResult {
    pair: string
    lookback_days: number
    total_killzones_detected: number
    total_entries_triggered: number
    trigger_rate: number // % of killzones that triggered entry
    trades: BacktestTrade[]
    metrics: BacktestMetrics
    equity_curve: Array<{ date: string; equity: number }>
}

/**
 * Backtest Killzone detector for a single pair
 *
 * @param pair - Currency pair (display format: EUR/USD)
 * @param lookbackDays - Number of days of historical data
 * @param riskPerTrade - Risk % per trade (default: 2%)
 */
export async function backtestKillzoneForPair(
    pair: string,
    lookbackDays: number = 365,
    riskPerTrade: number = 2,
): Promise<KillzoneBacktestResult> {
    console.log(`[Killzone Backtester] Starting backtest for ${pair} (${lookbackDays} days)`)

    const instrument = pair.replace('/', '_')

    // Fetch historical candles
    // Note: We need H1 for Elliott Wave, M15 for Killzone, M1 for entry simulation
    // For now, we'll simulate using H1 data (M1 simulation would require enormous data volume)
    const h1Response = await getCandles({ instrument, granularity: 'H1', count: lookbackDays * 24 })
    const m15Response = await getCandles({ instrument, granularity: 'M15', count: lookbackDays * 96 })

    if (h1Response.error || !h1Response.data || h1Response.data.length < 100) {
        throw new Error(`Insufficient H1 data for ${pair}`)
    }

    if (m15Response.error || !m15Response.data || m15Response.data.length < 100) {
        throw new Error(`Insufficient M15 data for ${pair}`)
    }

    const h1Candles = h1Response.data
    const m15Candles = m15Response.data

    const trades: BacktestTrade[] = []
    let killzonesDetected = 0
    let entriesTriggered = 0
    let accountBalance = 10000 // Starting capital

    const equityCurve: Array<{ date: string; equity: number }> = [
        { date: h1Candles[0].time.split('T')[0], equity: accountBalance }
    ]

    // Sliding window through H1 data (need at least 50 candles for Elliott Wave)
    for (let i = 50; i < h1Candles.length - 100; i += 24) {
        // Check every day (24 H1 candles)
        const h1Window = h1Candles.slice(i - 50, i)
        const currentDate = h1Window[h1Window.length - 1].time.split('T')[0]

        // Calculate indicators for Elliott Wave detection
        const h1Closes = h1Window.map(c => parseFloat(c.mid.c))
        const h1Rsi = calculateRSI(h1Closes, 14)
        const h1Macd = calculateMACD(h1Closes, 12, 26, 9)

        // Detect Elliott Wave state
        const waveState = detectH1ElliottWave(
            h1Window,
            h1Rsi,
            h1Macd.macdLine,
            h1Macd.signalLine
        )

        // Only proceed if Wave 2 or 4 in progress
        if (waveState.currentWave !== 2 && waveState.currentWave !== 4) {
            continue
        }

        // Get M15 window for this period (last 200 M15 candles ≈ 50 hours)
        const m15Index = Math.floor((i / h1Candles.length) * m15Candles.length)
        if (m15Index < 200 || m15Index >= m15Candles.length) continue

        const m15Window = m15Candles.slice(m15Index - 200, m15Index)

        // Detect Killzone
        const killzone = detectKillzone(waveState, m15Window, pair)

        if (!killzone.detected) continue

        killzonesDetected++

        // Simulate M1 entry (simplified: assume entry triggers if price enters box)
        // In real backtest, we'd need actual M1 data for CHoCH + volume climax detection
        if (killzone.priceInBox && killzone.confidence > 60) {
            entriesTriggered++

            // Simulate trade execution
            const entryPrice = killzone.box?.center ?? 0
            const slPrice = killzone.direction === 'bullish'
                ? (killzone.box?.low ?? entryPrice - 50 * 0.0001)
                : (killzone.box?.high ?? entryPrice + 50 * 0.0001)

            const slPips = Math.abs((entryPrice - slPrice) * 10000)

            // TP at 161.8% Fib extension (simplified: 2x the box width)
            const boxWidth = killzone.box?.widthPips ?? 20
            const tpPips = boxWidth * 1.618

            const tpPrice = killzone.direction === 'bullish'
                ? entryPrice + (tpPips * 0.0001)
                : entryPrice - (tpPips * 0.0001)

            // Simulate trade outcome (scan next 100 candles for SL/TP hit)
            const futureCandles = h1Candles.slice(i, Math.min(i + 100, h1Candles.length))
            let exitPrice = entryPrice
            let exitDate = currentDate
            let outcome: 'win' | 'loss' = 'loss'

            for (const candle of futureCandles) {
                const high = parseFloat(candle.mid.h)
                const low = parseFloat(candle.mid.l)

                // Check SL hit
                if (killzone.direction === 'bullish' && low <= slPrice) {
                    exitPrice = slPrice
                    exitDate = candle.time.split('T')[0]
                    outcome = 'loss'
                    break
                } else if (killzone.direction === 'bearish' && high >= slPrice) {
                    exitPrice = slPrice
                    exitDate = candle.time.split('T')[0]
                    outcome = 'loss'
                    break
                }

                // Check TP hit
                if (killzone.direction === 'bullish' && high >= tpPrice) {
                    exitPrice = tpPrice
                    exitDate = candle.time.split('T')[0]
                    outcome = 'win'
                    break
                } else if (killzone.direction === 'bearish' && low <= tpPrice) {
                    exitPrice = tpPrice
                    exitDate = candle.time.split('T')[0]
                    outcome = 'win'
                    break
                }
            }

            // Calculate trade result
            const direction = killzone.direction === 'bullish' ? 'long' : 'short'
            const pips = direction === 'long'
                ? (exitPrice - entryPrice) * 10000
                : (entryPrice - exitPrice) * 10000

            const riskAmount = accountBalance * (riskPerTrade / 100)
            const profitLoss = outcome === 'win' ? riskAmount * 2 : -riskAmount

            accountBalance += profitLoss

            trades.push({
                entry_date: currentDate,
                entry_price: entryPrice,
                exit_date: exitDate,
                exit_price: exitPrice,
                direction,
                pips: Math.round(pips * 10) / 10,
                profit_loss: Math.round(profitLoss * 100) / 100,
                duration_hours: futureCandles.length,
                outcome,
            })

            equityCurve.push({
                date: exitDate,
                equity: Math.round(accountBalance * 100) / 100,
            })
        }
    }

    // Calculate metrics
    const metrics = calculateMetrics(trades, equityCurve)

    const triggerRate = killzonesDetected > 0
        ? Math.round((entriesTriggered / killzonesDetected) * 1000) / 10
        : 0

    console.log(
        `[Killzone Backtester] ${pair} complete: ${killzonesDetected} killzones, ` +
        `${entriesTriggered} entries (${triggerRate}% trigger rate), ${trades.length} trades`
    )

    return {
        pair,
        lookback_days: lookbackDays,
        total_killzones_detected: killzonesDetected,
        total_entries_triggered: entriesTriggered,
        trigger_rate: triggerRate,
        trades,
        metrics,
        equity_curve: equityCurve,
    }
}

/**
 * Calculate backtest metrics (reused from correlation backtester)
 */
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

    // Max consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0
    let currentConsecWins = 0, currentConsecLosses = 0

    for (const trade of trades) {
        if (trade.outcome === 'win') {
            currentConsecWins++
            currentConsecLosses = 0
            maxConsecWins = Math.max(maxConsecWins, currentConsecWins)
        } else {
            currentConsecLosses++
            currentConsecWins = 0
            maxConsecLosses = Math.max(maxConsecLosses, currentConsecLosses)
        }
    }

    // Max drawdown
    let peak = equityCurve[0]?.equity ?? 10000
    let maxDrawdownPips = 0
    let maxDrawdownPercent = 0

    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity
        const drawdown = peak - point.equity
        const drawdownPercent = (drawdown / peak) * 100

        maxDrawdownPips = Math.max(maxDrawdownPips, drawdown)
        maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent)
    }

    // Sharpe ratio (simplified)
    const returns = []
    for (let i = 1; i < equityCurve.length; i++) {
        const ret = (equityCurve[i].equity - equityCurve[i - 1].equity) / equityCurve[i - 1].equity
        returns.push(ret)
    }

    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
    const stdDev = returns.length > 0 ? Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    ) : 0
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0

    // Expectancy
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
        largest_win: trades.length > 0 ? Math.max(...trades.map(t => t.pips)) : 0,
        largest_loss: trades.length > 0 ? Math.min(...trades.map(t => t.pips)) : 0,
        profit_factor: Math.round(profitFactor * 100) / 100,
        avg_rr_ratio: Math.round(avgRR * 100) / 100,
        max_consecutive_wins: maxConsecWins,
        max_consecutive_losses: maxConsecLosses,
        max_drawdown_pips: Math.round(maxDrawdownPips * 10) / 10,
        max_drawdown_percent: Math.round(maxDrawdownPercent * 100) / 100,
        sharpe_ratio: Math.round(sharpeRatio * 100) / 100,
        sortino_ratio: 0, // Placeholder
        calmar_ratio: 0, // Placeholder
        expectancy: Math.round(expectancy * 10) / 10,
    }
}
