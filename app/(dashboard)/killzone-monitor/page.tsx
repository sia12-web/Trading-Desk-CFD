'use client'

import { useState, useEffect } from 'react'
import { Target, RefreshCw, TrendingUp, Zap, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { KillzoneMonitorResult, KillzoneAutoExecution } from '@/lib/types/database'

export default function KillzoneMonitorPage() {
    const [results, setResults] = useState<KillzoneMonitorResult[]>([])
    const [executions, setExecutions] = useState<KillzoneAutoExecution[]>([])
    const [loading, setLoading] = useState(true)
    const [lastScan, setLastScan] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'active' | 'wave2' | 'wave4' | 'complex'>('all')
    const [tab, setTab] = useState<'monitor' | 'executions'>('monitor')

    const loadResults = async () => {
        setLoading(true)
        try {
            const [monitorRes, execRes] = await Promise.all([
                fetch('/api/killzone/monitor-results'),
                fetch('/api/killzone/executions'),
            ])
            const monitorData = await monitorRes.json()
            setResults(monitorData.results || [])
            setLastScan(monitorData.last_scan)

            if (execRes.ok) {
                const execData = await execRes.json()
                setExecutions(execData.executions || [])
            }
        } catch (error) {
            console.error('Error loading results:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadResults()
        const interval = setInterval(loadResults, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const filteredResults = results.filter(r => {
        if (filter === 'active') return r.killzone_detected
        if (filter === 'wave2') return r.wave2_complete
        if (filter === 'wave4') return r.wave4_complete
        if (filter === 'complex') return r.market_regime === 'complex_correction'
        return true
    })

    const activeKillzones = results.filter(r => r.killzone_detected).length
    const wave2Complete = results.filter(r => r.wave2_complete).length
    const wave4Complete = results.filter(r => r.wave4_complete).length
    const complexCorrections = results.filter(r => r.market_regime === 'complex_correction').length

    const regimeBadge = (regime: string | null) => {
        switch (regime) {
            case 'complex_correction':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300">Complex</span>
            case 'correction':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-300">Correction</span>
            case 'trend':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-500">Trend</span>
            default:
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-600">—</span>
        }
    }

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
                                Three-Tier Institutional Protocol — Real-time scanning
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-purple-400">{activeKillzones}</div>
                        <div className="text-sm text-neutral-400 mt-1">Active Killzones</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-green-400">{complexCorrections}</div>
                        <div className="text-sm text-neutral-400 mt-1">Complex Corrections</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-blue-400">{wave2Complete}</div>
                        <div className="text-sm text-neutral-400 mt-1">Wave 2 Complete</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-3xl font-bold text-orange-400">{wave4Complete}</div>
                        <div className="text-sm text-neutral-400 mt-1">Wave 4 Complete</div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-neutral-800 pb-2">
                <button
                    onClick={() => setTab('monitor')}
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                        tab === 'monitor' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                >
                    <Activity size={14} className="inline mr-2" />
                    Live Monitor
                </button>
                <button
                    onClick={() => setTab('executions')}
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                        tab === 'executions' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                    }`}
                >
                    <Zap size={14} className="inline mr-2" />
                    Execution History ({executions.length})
                </button>
            </div>

            {tab === 'monitor' && (
                <>
                    {/* Filters */}
                    <div className="flex gap-2">
                        {[
                            { key: 'all', label: 'All Pairs' },
                            { key: 'complex', label: 'Complex Corrections' },
                            { key: 'active', label: 'Active Killzones' },
                            { key: 'wave2', label: 'Wave 2 Complete' },
                            { key: 'wave4', label: 'Wave 4 Complete' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key as typeof filter)}
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
                            {/* Header Row */}
                            <div className="grid grid-cols-8 gap-4 px-4 text-[10px] text-neutral-500 uppercase tracking-wider">
                                <div>Pair</div>
                                <div>State</div>
                                <div>Wave</div>
                                <div>Direction</div>
                                <div>Killzone</div>
                                <div>Box Levels</div>
                                <div>Confidence</div>
                                <div>Status</div>
                            </div>

                            {filteredResults.map(result => (
                                <Card key={result.id} className="hover:border-neutral-700 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-8 gap-4 items-center">
                                            {/* Pair */}
                                            <div className="font-medium text-white">
                                                {result.pair}
                                            </div>

                                            {/* Market State */}
                                            <div>
                                                {regimeBadge(result.market_regime)}
                                                {result.atr_squeeze && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300">ATR</span>
                                                )}
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
                                                        {result.wave_direction === 'bullish' ? 'Bull' : 'Bear'}
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
                                                    {result.killzone_detected ? 'Active' : 'Inactive'}
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

                                            {/* Status */}
                                            <div>
                                                {result.price_in_box && (
                                                    <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                                        <TrendingUp size={12} />
                                                        In Box
                                                    </span>
                                                )}
                                                {result.wxy_projection && (
                                                    <div className="text-[10px] text-neutral-500 mt-0.5">
                                                        Y: {result.wxy_projection.toFixed(5)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {tab === 'executions' && (
                <div className="space-y-3">
                    {executions.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-neutral-500">
                                No auto-executions recorded yet.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Header Row */}
                            <div className="grid grid-cols-8 gap-4 px-4 text-[10px] text-neutral-500 uppercase tracking-wider">
                                <div>Time</div>
                                <div>Pair</div>
                                <div>Tier 1</div>
                                <div>Tier 2</div>
                                <div>Tier 3</div>
                                <div>Direction</div>
                                <div>Entry / SL</div>
                                <div>Status</div>
                            </div>

                            {executions.map(exec => (
                                <Card key={exec.id} className={`border ${exec.executed ? 'border-green-800/50' : exec.dry_run ? 'border-yellow-800/50' : 'border-neutral-800'}`}>
                                    <CardContent className="p-4">
                                        <div className="grid grid-cols-8 gap-4 items-center text-xs">
                                            {/* Time */}
                                            <div className="text-neutral-400">
                                                {new Date(exec.created_at).toLocaleString(undefined, {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>

                                            {/* Pair */}
                                            <div className="font-medium text-white">{exec.pair}</div>

                                            {/* Tier 1 */}
                                            <div>
                                                {regimeBadge(exec.tier1_regime)}
                                                {exec.tier1_atr_squeeze && (
                                                    <span className="ml-1 text-[9px] text-amber-300">ATR</span>
                                                )}
                                            </div>

                                            {/* Tier 2 */}
                                            <div>
                                                {exec.tier2_detected ? (
                                                    <span className="text-green-400">{exec.tier2_confidence}%</span>
                                                ) : (
                                                    <span className="text-neutral-600">—</span>
                                                )}
                                            </div>

                                            {/* Tier 3 */}
                                            <div>
                                                {exec.tier3_triggered ? (
                                                    <span className="text-green-400">{exec.tier3_spring_volume_ratio}x</span>
                                                ) : (
                                                    <span className="text-neutral-600">—</span>
                                                )}
                                            </div>

                                            {/* Direction */}
                                            <div>
                                                {exec.direction && (
                                                    <span className={exec.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                                                        {exec.direction.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Entry / SL */}
                                            <div className="text-neutral-400">
                                                {exec.entry_price ? (
                                                    <>
                                                        {exec.entry_price.toFixed(5)}
                                                        <div className="text-[10px] text-neutral-600">
                                                            SL: {exec.stop_loss?.toFixed(5)}
                                                        </div>
                                                    </>
                                                ) : '—'}
                                            </div>

                                            {/* Status */}
                                            <div>
                                                {exec.executed ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">Executed</span>
                                                ) : exec.dry_run ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-300">Dry Run</span>
                                                ) : exec.blocked_reason ? (
                                                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300" title={exec.blocked_reason}>Blocked</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded text-xs bg-neutral-800 text-neutral-500">Skipped</span>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
