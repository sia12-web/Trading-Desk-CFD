'use client'

import React, { useState, useCallback } from 'react'
import { SlidersHorizontal, Play, Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react'

const PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD',
    'USD/CAD', 'NZD/USD', 'EUR/JPY', 'USD/CHF', 'GBP/JPY',
]

const TIMEFRAMES = ['M', 'W', 'D', 'H4', 'H3', 'H1', 'M15', 'M1'] as const
const INDICATORS = ['RSI', 'MACD', 'BB', 'Stochastic', 'ADX', 'EMA_Cross', 'SMA_Cross', 'SAR', 'ATR'] as const

interface Optimization {
    timeframe: string
    indicator: string
    current_params: Record<string, number>
    recommended_params: Record<string, number>
    expected_improvement: string
    confidence: number
    reasoning: string
}

interface OptimizerData {
    optimizations: Optimization[]
    regime: string | null
    regimeImplications: string | null
    summary: string | null
    optimizedAt: string | null
    remaining?: number
}

function formatParams(params: Record<string, number>): string {
    const vals = Object.values(params)
    if (vals.length === 1) return String(vals[0])
    return vals.join('/')
}

function paramsChanged(current: Record<string, number>, recommended: Record<string, number>): boolean {
    const keys = Object.keys(recommended)
    return keys.some(k => current[k] !== recommended[k])
}

function timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

function regimeColor(regime: string): string {
    switch (regime) {
        case 'trending': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        case 'ranging': return 'text-sky-400 bg-sky-500/10 border-sky-500/20'
        case 'volatile': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
        case 'transitioning': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        default: return 'text-neutral-400 bg-neutral-800 border-neutral-700'
    }
}

function confidenceColor(c: number): string {
    if (c >= 70) return 'text-emerald-400 bg-emerald-500/10'
    if (c >= 40) return 'text-amber-400 bg-amber-500/10'
    return 'text-neutral-500 bg-neutral-800'
}

export function IndicatorOptimizerWidget() {
    const [pair, setPair] = useState('')
    const [data, setData] = useState<OptimizerData | null>(null)
    const [loading, setLoading] = useState(false)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchCached = useCallback(async (selectedPair: string) => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/indicator-optimizer?pair=${encodeURIComponent(selectedPair)}`)
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to fetch')
            }
            const result: OptimizerData = await res.json()
            setData(result)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch cached data')
        } finally {
            setLoading(false)
        }
    }, [])

    const handlePairChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = e.target.value
        setPair(selected)
        setData(null)
        setError(null)
        if (selected) fetchCached(selected)
    }

    const runOptimizer = async () => {
        if (!pair || running) return
        setRunning(true)
        setError(null)
        try {
            const res = await fetch('/api/indicator-optimizer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pair }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Optimizer failed')
            }
            const result: OptimizerData = await res.json()
            setData(result)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Optimizer failed')
        } finally {
            setRunning(false)
        }
    }

    // Build lookup: indicator+timeframe → optimization
    const lookup = new Map<string, Optimization>()
    if (data?.optimizations) {
        for (const opt of data.optimizations) {
            lookup.set(`${opt.indicator}:${opt.timeframe}`, opt)
        }
    }

    const hasResults = data?.optimizations && data.optimizations.length > 0

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                    <SlidersHorizontal size={20} className="text-violet-500" />
                    Indicator Optimizer
                </h3>
                <div className="flex items-center gap-2">
                    <select
                        value={pair}
                        onChange={handlePairChange}
                        className="bg-neutral-950 border border-neutral-800 text-sm text-white rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                        <option value="">Select pair...</option>
                        {PAIRS.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <button
                        onClick={runOptimizer}
                        disabled={!pair || running}
                        className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-sm font-bold rounded-xl transition-all"
                    >
                        {running ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Play size={14} />
                                Optimize
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={16} className="text-rose-500 shrink-0" />
                        <p className="text-xs font-bold text-rose-400">{error}</p>
                    </div>
                    <button
                        onClick={() => pair && fetchCached(pair)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-500 transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            )}

            {/* No pair selected */}
            {!pair && !error && (
                <div className="text-center py-10">
                    <SlidersHorizontal size={32} className="text-neutral-700 mx-auto mb-3" />
                    <p className="text-sm text-neutral-600 font-medium">Select a pair to optimize indicators</p>
                    <p className="text-xs text-neutral-700 mt-1">DeepSeek analyzes 9 indicators across 5 timeframes</p>
                </div>
            )}

            {/* Loading skeleton */}
            {pair && loading && !hasResults && (
                <div className="space-y-3">
                    <div className="animate-pulse bg-neutral-800 rounded-xl h-10 w-1/2" />
                    <div className="animate-pulse bg-neutral-800 rounded-xl h-48" />
                </div>
            )}

            {/* Running state */}
            {running && (
                <div className="flex items-center gap-3 py-6 justify-center">
                    <Loader2 size={20} className="animate-spin text-violet-500" />
                    <p className="text-sm text-neutral-400 font-medium">DeepSeek analyzing {pair}...</p>
                </div>
            )}

            {/* Results */}
            {hasResults && !running && (
                <>
                    {/* Regime + Summary bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 px-1">
                        {data.regime && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${regimeColor(data.regime)}`}>
                                {data.regime}
                            </span>
                        )}
                        {data.summary && (
                            <p className="text-xs text-neutral-500 leading-relaxed flex-1 min-w-0">{data.summary}</p>
                        )}
                        {data.optimizedAt && (
                            <span className="flex items-center gap-1 text-[10px] text-neutral-600 font-mono shrink-0">
                                <Clock size={10} />
                                {timeAgo(data.optimizedAt)}
                            </span>
                        )}
                    </div>

                    {/* Grid */}
                    <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-neutral-800">
                                    <th className="text-left py-2 px-2 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Indicator</th>
                                    {TIMEFRAMES.map(tf => (
                                        <th key={tf} className="text-center py-2 px-2 text-[10px] font-black text-neutral-600 uppercase tracking-widest">{tf}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {INDICATORS.map(ind => (
                                    <tr key={ind} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                                        <td className="py-2.5 px-2 font-bold text-neutral-300 whitespace-nowrap">{ind}</td>
                                        {TIMEFRAMES.map(tf => {
                                            const opt = lookup.get(`${ind}:${tf}`)
                                            if (!opt) {
                                                return <td key={tf} className="text-center py-2.5 px-2 text-neutral-700">-</td>
                                            }
                                            const changed = paramsChanged(opt.current_params, opt.recommended_params)
                                            return (
                                                <td key={tf} className="text-center py-2.5 px-1">
                                                    <div className="group relative inline-block">
                                                        <div className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg ${changed ? 'border-l-2 border-emerald-500/50' : ''}`}>
                                                            <span className={`font-mono text-[11px] ${changed ? 'text-white' : 'text-neutral-500'}`}>
                                                                {changed
                                                                    ? `${formatParams(opt.current_params)}\u2192${formatParams(opt.recommended_params)}`
                                                                    : formatParams(opt.current_params)
                                                                }
                                                            </span>
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${confidenceColor(opt.confidence)}`}>
                                                                {opt.confidence}%
                                                            </span>
                                                        </div>
                                                        {/* Tooltip */}
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                                            <div className="bg-neutral-950 border border-neutral-700 rounded-xl p-3 shadow-2xl w-56">
                                                                <p className="text-[10px] font-bold text-white mb-1">{ind} ({tf})</p>
                                                                <p className="text-[10px] text-neutral-400 leading-relaxed">{opt.reasoning}</p>
                                                                {opt.expected_improvement !== '0%' && (
                                                                    <p className="text-[10px] text-emerald-400 mt-1 font-bold">+{opt.expected_improvement} expected improvement</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 px-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-0.5 h-3 bg-emerald-500/50 rounded" />
                            <span className="text-[9px] text-neutral-600 font-bold">Changed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10">70%+</span>
                            <span className="text-[9px] text-neutral-600 font-bold">High confidence</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-amber-400 bg-amber-500/10">40-69%</span>
                            <span className="text-[9px] text-neutral-600 font-bold">Medium</span>
                        </div>
                    </div>
                </>
            )}

            {/* Pair selected but no results and not loading */}
            {pair && !loading && !running && !hasResults && !error && (
                <div className="text-center py-8">
                    <p className="text-sm text-neutral-600 font-medium">No cached optimizations for {pair}</p>
                    <p className="text-xs text-neutral-700 mt-1">Click Optimize to run DeepSeek analysis</p>
                </div>
            )}
        </div>
    )
}
