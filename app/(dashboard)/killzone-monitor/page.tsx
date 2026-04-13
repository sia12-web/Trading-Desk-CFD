'use client'

import { useState, useEffect } from 'react'
import { Target, RefreshCw, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { KillzoneMonitorResult } from '@/lib/types/database'

export default function KillzoneMonitorPage() {
    const [results, setResults] = useState<KillzoneMonitorResult[]>([])
    const [loading, setLoading] = useState(true)
    const [lastScan, setLastScan] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'active' | 'wave2' | 'wave4'>('all')

    const loadResults = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/killzone/monitor-results')
            const data = await res.json()
            setResults(data.results || [])
            setLastScan(data.last_scan)
        } catch (error) {
            console.error('Error loading results:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadResults()
        // Auto-refresh every 5 minutes
        const interval = setInterval(loadResults, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const filteredResults = results.filter(r => {
        if (filter === 'active') return r.killzone_detected
        if (filter === 'wave2') return r.wave2_complete
        if (filter === 'wave4') return r.wave4_complete
        return true
    })

    const activeKillzones = results.filter(r => r.killzone_detected).length
    const wave2Complete = results.filter(r => r.wave2_complete).length
    const wave4Complete = results.filter(r => r.wave4_complete).length

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="rounded-3xl bg-neutral-900/50 border border-neutral-800 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                            <Target size={20} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Killzone Monitor</h1>
                            <p className="text-neutral-400 text-sm mt-1">
                                Real-time Wave 2/4 completion tracking across all pairs
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={loadResults}
                        disabled={loading}
                        className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600"
                    >
                        <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {lastScan && (
                    <div className="mt-4 text-xs text-neutral-500">
                        Last scan: {new Date(lastScan).toLocaleString()}
                    </div>
                )}
            </div>

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-purple-400">{activeKillzones}</div>
                        <div className="text-sm text-neutral-400 mt-1">Active Killzones</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-green-400">{wave2Complete}</div>
                        <div className="text-sm text-neutral-400 mt-1">Wave 2 Complete</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-blue-400">{wave4Complete}</div>
                        <div className="text-sm text-neutral-400 mt-1">Wave 4 Complete</div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {[
                    { key: 'all', label: 'All Pairs' },
                    { key: 'active', label: 'Active Killzones' },
                    { key: 'wave2', label: 'Wave 2 Complete' },
                    { key: 'wave4', label: 'Wave 4 Complete' },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filter === f.key
                                ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                                : 'bg-neutral-900/50 text-neutral-400 border border-neutral-800 hover:text-white hover:border-neutral-700'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Pairs Grid */}
            {loading ? (
                <div className="text-center py-12 text-neutral-500">Loading...</div>
            ) : filteredResults.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-neutral-500">
                        No pairs found matching the current filter.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredResults.map(result => (
                        <Card key={result.id} className="hover:border-neutral-700 transition-colors">
                            <CardContent className="p-4">
                                <div className="grid grid-cols-7 gap-4 items-center">
                                    {/* Pair */}
                                    <div className="font-medium text-white">
                                        {result.pair}
                                    </div>

                                    {/* Wave Status */}
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            result.current_wave
                                                ? 'bg-blue-500/20 text-blue-300'
                                                : 'bg-neutral-800 text-neutral-500'
                                        }`}>
                                            {result.current_wave ? `Wave ${result.current_wave}` : '—'}
                                        </span>
                                    </div>

                                    {/* Direction */}
                                    <div>
                                        {result.wave_direction && (
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                result.wave_direction === 'bullish'
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-red-500/20 text-red-300'
                                            }`}>
                                                {result.wave_direction === 'bullish' ? '📈 Bull' : '📉 Bear'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Killzone */}
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            result.killzone_detected
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'bg-neutral-800 text-neutral-500'
                                        }`}>
                                            {result.killzone_detected ? '✓ Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    {/* Box Levels */}
                                    <div className="text-xs text-neutral-400">
                                        {result.killzone_box_high && result.killzone_box_low ? (
                                            <>
                                                {result.killzone_box_high.toFixed(5)} - {result.killzone_box_low.toFixed(5)}
                                                <div className="text-neutral-600 text-[10px]">
                                                    ({result.killzone_box_width_pips?.toFixed(1)} pips)
                                                </div>
                                            </>
                                        ) : '—'}
                                    </div>

                                    {/* Confidence */}
                                    <div className="text-xs">
                                        {result.killzone_confidence ? (
                                            <div className={`font-medium ${
                                                result.killzone_confidence >= 70
                                                    ? 'text-green-400'
                                                    : result.killzone_confidence >= 50
                                                    ? 'text-yellow-400'
                                                    : 'text-neutral-500'
                                            }`}>
                                                {result.killzone_confidence}%
                                            </div>
                                        ) : (
                                            <span className="text-neutral-600">—</span>
                                        )}
                                    </div>

                                    {/* Price in Box */}
                                    <div>
                                        {result.price_in_box && (
                                            <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                                <TrendingUp size={12} />
                                                In Box
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
