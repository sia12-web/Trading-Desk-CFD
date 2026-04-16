'use client'

import { Users, Flame, Target, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import type { RetailTraderSnapshot } from '@/lib/market-maker/types'

interface RetailGaugeProps {
    traders: RetailTraderSnapshot[]
    aggregateStats?: {
        totalStoppedOut: number
        totalProfitable: number
        avgPnl: number
        totalVolumeLost: number
    }
}

export function RetailGauge({ traders, aggregateStats }: RetailGaugeProps) {
    const inPosition = traders.filter(t => t.position !== null)
    const longs = inPosition.filter(t => t.position?.direction === 'long').length
    const shorts = inPosition.filter(t => t.position?.direction === 'short').length
    const watching = traders.filter(t => t.status === 'watching').length
    const stoppedOut = traders.filter(t => t.status === 'stopped_out').length

    // Aggregate FOMO from experience levels
    const noviceInPosition = traders.filter(t => t.experience === 'novice' && t.position !== null).length
    const totalNovice = traders.filter(t => t.experience === 'novice').length
    const fomoIntensity = totalNovice > 0 ? Math.round((noviceInPosition / totalNovice) * 100) : 0

    // Bias: which direction has more retail positioned
    const bias = longs > shorts ? 'LONG' : shorts > longs ? 'SHORT' : 'FLAT'
    const biasColor = bias === 'LONG' ? 'text-emerald-400' : bias === 'SHORT' ? 'text-red-400' : 'text-neutral-500'

    // Sentiment: 50 = neutral, higher = greedier (more positioned)
    const positionedPct = traders.length > 0 ? (inPosition.length / traders.length) * 100 : 0
    const sentiment = isNaN(positionedPct) ? 0 : Math.round(positionedPct * 1.5) // 0-75% positioned → 0-100 sentiment

    const sentimentLabel = sentiment > 70 ? 'Extreme Greed'
        : sentiment > 55 ? 'Greedy'
        : sentiment > 45 ? 'Neutral'
        : sentiment > 30 ? 'Fearful'
        : 'Calm'

    const sentimentColor = sentiment > 70 ? 'text-emerald-400'
        : sentiment > 55 ? 'text-emerald-300'
        : sentiment > 45 ? 'text-neutral-400'
        : sentiment > 30 ? 'text-amber-300'
        : 'text-blue-300'

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} className="text-amber-400" />
                Retail Crowd
            </h3>

            {/* Sentiment Gauge */}
            <div className="relative">
                <div className="w-full h-4 rounded-full bg-gradient-to-r from-blue-600 via-yellow-500 to-emerald-500 opacity-30" />
                <div
                    className="absolute top-0 w-3 h-4 bg-white rounded-sm shadow-lg transition-all duration-500"
                    style={{ left: `calc(${Math.min(sentiment, 100)}% - 6px)` }}
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Calm</span>
                    <span className={sentimentColor}>{sentimentLabel} ({sentiment})</span>
                    <span>Greed</span>
                </div>
            </div>

            {/* Position Split */}
            <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-neutral-800">
                {longs > 0 && (
                    <div
                        className="h-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${traders.length > 0 ? (longs / traders.length) * 100 : 0}%` }}
                    />
                )}
                {shorts > 0 && (
                    <div
                        className="h-full bg-red-600 transition-all duration-500"
                        style={{ width: `${traders.length > 0 ? (shorts / traders.length) * 100 : 0}%` }}
                    />
                )}
            </div>
            <div className="flex justify-between text-[10px]">
                <span className="text-emerald-400 flex items-center gap-0.5">
                    <TrendingUp size={10} /> {longs} longs
                </span>
                <span className="text-neutral-600">{watching} watching</span>
                <span className="text-red-400 flex items-center gap-0.5">
                    {shorts} shorts <TrendingDown size={10} />
                </span>
            </div>

            {/* Stats */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <Flame size={12} className="text-orange-400" /> FOMO
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                style={{ width: `${fomoIntensity}%` }}
                            />
                        </div>
                        <span className="text-neutral-400 font-mono w-8 text-right">{fomoIntensity}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <Target size={12} className="text-blue-400" /> Bias
                    </span>
                    <span className={`font-mono ${biasColor}`}>{bias}</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <AlertTriangle size={12} className="text-red-400" /> Stopped Out
                    </span>
                    <span className="text-red-400 font-mono">
                        {aggregateStats?.totalStoppedOut ?? stoppedOut}
                    </span>
                </div>
            </div>

            {/* Avg PnL */}
            {aggregateStats && (
                <div className="bg-neutral-900/50 rounded p-2 text-[11px] text-neutral-400">
                    <div className="flex justify-between">
                        <span>Avg Retail PnL:</span>
                        <span className={aggregateStats.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {aggregateStats.avgPnl >= 0 ? '+' : ''}{aggregateStats.avgPnl.toFixed(1)} pips
                        </span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                        <span>Total lost to whale:</span>
                        <span className="text-red-400">
                            {aggregateStats.totalVolumeLost.toFixed(1)} pips
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
