'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, RefreshCw } from 'lucide-react'

interface IndexData {
    instrument: string
    name: string
    region: string
    currentLevel: number
    change1d: number
    change5d: number
    change20d: number
    trend: 'bullish' | 'bearish' | 'flat'
}

interface MarketIndicesData {
    indices: IndexData[]
    riskAppetite: 'risk-on' | 'risk-off' | 'mixed'
    timestamp: string
}

export function MarketIndicesWidget() {
    const [data, setData] = useState<MarketIndicesData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

    const fetchIndices = async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await fetch('/api/market-indices')
            if (!res.ok) throw new Error('Failed to fetch indices')
            const json = await res.json()
            setData(json)
            setLastUpdate(new Date())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchIndices()
        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchIndices, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    if (loading && !data) {
        return (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-200">Market Indices</h3>
                </div>
                <div className="text-center py-8 text-neutral-500 text-sm">
                    Loading indices...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-200">Market Indices</h3>
                </div>
                <div className="text-center py-8 text-red-400 text-sm">
                    {error}
                </div>
            </div>
        )
    }

    if (!data) return null

    const riskColor = data.riskAppetite === 'risk-on' ? 'text-green-400' : data.riskAppetite === 'risk-off' ? 'text-red-400' : 'text-yellow-400'
    const riskIcon = data.riskAppetite === 'risk-on' ? '🟢' : data.riskAppetite === 'risk-off' ? '🔴' : '🟡'

    const timeAgo = lastUpdate
        ? formatTimeAgo(lastUpdate)
        : 'Just now'

    return (
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-blue-400" />
                    <h3 className="text-sm font-bold text-neutral-200">Market Indices</h3>
                </div>
                <button
                    onClick={fetchIndices}
                    disabled={loading}
                    className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    <RefreshCw size={14} className={`text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-2 mb-4">
                {data.indices.map(index => {
                    const isPositive1d = index.change1d >= 0
                    const isPositive5d = index.change5d >= 0

                    return (
                        <div key={index.instrument} className="flex items-center justify-between py-2 border-b border-neutral-800/50 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                                {isPositive1d ? (
                                    <TrendingUp size={12} className="text-green-400 shrink-0" />
                                ) : (
                                    <TrendingDown size={12} className="text-red-400 shrink-0" />
                                )}
                                <span className="text-xs font-medium text-neutral-300 truncate">
                                    {index.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs font-mono text-neutral-400 min-w-[60px] text-right">
                                    {formatLevel(index.currentLevel)}
                                </span>
                                <span className={`text-xs font-semibold min-w-[50px] text-right ${isPositive1d ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPositive1d ? '+' : ''}{(index.change1d ?? 0).toFixed(2)}%
                                </span>
                                <span className={`text-[10px] font-mono min-w-[50px] text-right ${isPositive5d ? 'text-green-400/60' : 'text-red-400/60'}`}>
                                    {isPositive5d ? '+' : ''}{(index.change5d ?? 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">Risk Appetite:</span>
                    <span className={`text-xs font-semibold ${riskColor}`}>
                        {riskIcon} {data.riskAppetite.toUpperCase().replace('-', ' ')}
                    </span>
                </div>
                <span className="text-[10px] text-neutral-600">
                    Updated {timeAgo}
                </span>
            </div>
        </div>
    )
}

function formatLevel(level: number): string {
    if (level >= 10000) return (level ?? 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    if (level >= 1000) return (level ?? 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return (level ?? 0).toFixed(2)
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
}
