'use client'

import { useState, useEffect, useCallback } from 'react'
import { Swords, RefreshCw, Crosshair, TrendingUp, Ghost, ShieldAlert, Clock, Zap, Activity, Radio, AlertTriangle, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface DivisionState {
    name: string
    strategy: string
    regime: string
    activePairs: string[]
    activeCount: number
    setupsDetected?: number
    ghostWindows?: string[]
    nextNewsEvent?: { title: string; currency: string; minutesUntil: number } | null
}

interface HeatmapEntry {
    pair: string
    regime: string
    activeBot: string
    confidence: number
    conditionBlack: boolean
    setupDetected: boolean
    direction: string | null
    adx: number
    atrPercentile: number
}

interface Execution {
    id: string
    pair: string
    regime: string
    activeBot: string
    direction: string
    executed: boolean
    dryRun: boolean
    blockedReason: string | null
    entryPrice: number | null
    stopLoss: number | null
    ghostEventName: string | null
    conditionBlack: boolean
    trailingStopDistance: number | null
    createdAt: string
}

interface WarRoomData {
    systemStatus: 'OPERATIONAL' | 'NEWS_GUARD' | 'CONDITION_BLACK'
    timestamp: string
    divisions: {
        sniper: DivisionState
        rider: DivisionState
        ghost: DivisionState
        killzone: DivisionState
    }
    conditionBlack: { active: boolean; affectedPairs: string[]; reason: string | null }
    regimeHeatmap: HeatmapEntry[]
    upcomingNews: { title: string; currency: string; time: string; minutesUntil: number }[]
    recentExecutions: Execution[]
    stats: { totalPairsScanned: number; todayExecutions: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function WarRoomPage() {
    const [data, setData] = useState<WarRoomData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState<'overview' | 'heatmap' | 'executions'>('overview')

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/regime/war-room')
            if (!res.ok) throw new Error(`${res.status}`)
            const json = await res.json()
            setData(json)
            setError(null)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch')
        } finally {
            setLoading(false)
        }
    }, [])

    // Operator's Note #3: 30-second polling interval to respect rate limits
    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 30 * 1000)
        return () => clearInterval(interval)
    }, [fetchData])

    // ── Status banner color ──
    const statusConfig = {
        OPERATIONAL: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: '🟢 OPERATIONAL', dot: 'bg-emerald-500' },
        NEWS_GUARD: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: '🟡 NEWS GUARD', dot: 'bg-amber-500' },
        CONDITION_BLACK: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: '⛔ CONDITION BLACK', dot: 'bg-red-500' },
    }

    const status = data ? statusConfig[data.systemStatus] : statusConfig.OPERATIONAL

    // ── Regime color mapping ──
    const regimeColor = (regime: string) => {
        switch (regime) {
            case 'ranging_quiet': return 'text-cyan-400 bg-cyan-500/10'
            case 'trending_strong': return 'text-emerald-400 bg-emerald-500/10'
            case 'trending_mild': return 'text-lime-400 bg-lime-500/10'
            case 'complex_correction': return 'text-violet-400 bg-violet-500/10'
            case 'news_chaos': return 'text-amber-400 bg-amber-500/10'
            case 'unknown_dangerous': return 'text-red-400 bg-red-500/10'
            default: return 'text-neutral-500 bg-neutral-800'
        }
    }

    const botLabel = (bot: string) => {
        switch (bot) {
            case 'trap': return 'Sniper'
            case 'momentum': return 'Rider'
            case 'ghost': return 'Ghost'
            case 'killzone': return 'Killzone'
            case 'none': return '—'
            default: return bot
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* ══════ CONDITION BLACK OVERLAY ══════ */}
            {data?.conditionBlack.active && (
                <div className="fixed inset-0 z-50 bg-red-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => {}}>
                    <div className="max-w-lg bg-neutral-900 border-2 border-red-500/60 rounded-2xl p-8 text-center space-y-4 shadow-2xl shadow-red-500/20">
                        <AlertTriangle size={48} className="text-red-500 mx-auto animate-pulse" />
                        <h2 className="text-2xl font-black text-red-400 tracking-wider">⛔ CONDITION BLACK</h2>
                        <p className="text-neutral-300 text-sm">{data.conditionBlack.reason}</p>
                        <div className="text-red-300/70 text-xs">
                            Affected: {data.conditionBlack.affectedPairs.join(', ')}
                        </div>
                        <p className="text-neutral-500 text-[10px] uppercase tracking-widest pt-4">All bots offline — Cash is a position</p>
                        <Button onClick={() => {}} className="bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600/30 mt-2">
                            Acknowledged
                        </Button>
                    </div>
                </div>
            )}

            {/* ══════ HEADER ══════ */}
            <div className={`rounded-3xl ${status.bg} border ${status.border} p-8 transition-all duration-500`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-neutral-900/50 flex items-center justify-center border border-neutral-700/50">
                            <Swords size={24} className={status.text} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">War Room</h1>
                            <p className="text-neutral-400 text-sm mt-0.5">Automated Trading Army — Command Center</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${status.bg} border ${status.border}`}>
                            <div className={`w-2 h-2 rounded-full ${status.dot} animate-pulse`} />
                            <span className={`text-sm font-bold ${status.text} tracking-wide`}>{status.label}</span>
                        </div>
                        <Link href="/war-room/simulation">
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500/50">
                                <Play size={16} className="mr-2" />
                                Run Simulation
                            </Button>
                        </Link>
                        <Button onClick={fetchData} disabled={loading} className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-600">
                            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
                {data && (
                    <div className="flex items-center gap-6 mt-4 text-xs text-neutral-500">
                        <span>Last scan: {new Date(data.timestamp).toLocaleTimeString()}</span>
                        <span>{data.stats.totalPairsScanned} pairs scanned</span>
                        <span>{data.stats.todayExecutions} executions today</span>
                    </div>
                )}
            </div>

            {/* ══════ DIVISION CARDS ══════ */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Division 1: The Sniper */}
                    <Card className="border-cyan-800/30 bg-gradient-to-b from-cyan-950/20 to-neutral-900/50 hover:border-cyan-700/50 transition-all">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                    <Crosshair size={20} className="text-cyan-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-cyan-400 tracking-wide">DIV 1 — THE SNIPER</h3>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Mean Reversion</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Active Pairs</span>
                                    <span className="text-lg font-bold text-cyan-400">{data.divisions.sniper.activeCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Setups Detected</span>
                                    <span className="text-sm font-medium text-white">{data.divisions.sniper.setupsDetected ?? 0}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {data.divisions.sniper.activePairs.slice(0, 5).map(p => (
                                        <span key={p} className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-800/30">{p}</span>
                                    ))}
                                    {data.divisions.sniper.activeCount === 0 && (
                                        <span className="text-[10px] text-neutral-600 italic">No ranging markets detected</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Division 2: The Rider */}
                    <Card className="border-emerald-800/30 bg-gradient-to-b from-emerald-950/20 to-neutral-900/50 hover:border-emerald-700/50 transition-all">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <TrendingUp size={20} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-emerald-400 tracking-wide">DIV 2 — THE RIDER</h3>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Momentum Trend</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Active Pairs</span>
                                    <span className="text-lg font-bold text-emerald-400">{data.divisions.rider.activeCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Setups Detected</span>
                                    <span className="text-sm font-medium text-white">{data.divisions.rider.setupsDetected ?? 0}</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {data.divisions.rider.activePairs.slice(0, 5).map(p => (
                                        <span key={p} className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-800/30">{p}</span>
                                    ))}
                                    {data.divisions.rider.activeCount === 0 && (
                                        <span className="text-[10px] text-neutral-600 italic">No trending markets detected</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Division 3: The Ghost */}
                    <Card className="border-amber-800/30 bg-gradient-to-b from-amber-950/20 to-neutral-900/50 hover:border-amber-700/50 transition-all">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Ghost size={20} className="text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-amber-400 tracking-wide">DIV 3 — THE GHOST</h3>
                                    <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Volatility Harvester</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Status</span>
                                    {data.divisions.ghost.ghostWindows && data.divisions.ghost.ghostWindows.length > 0 ? (
                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 animate-pulse">ACTIVE</span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-500">STANDBY</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-neutral-400">Next News Event</span>
                                    <span className="text-xs text-white">
                                        {data.divisions.ghost.nextNewsEvent
                                            ? `${data.divisions.ghost.nextNewsEvent.title} (${data.divisions.ghost.nextNewsEvent.minutesUntil}m)`
                                            : 'None scheduled'}
                                    </span>
                                </div>
                                {data.upcomingNews.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {data.upcomingNews.slice(0, 3).map((e, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                <Clock size={10} className="text-amber-500 shrink-0" />
                                                <span className="text-neutral-400 truncate">{e.title}</span>
                                                <span className="text-amber-300 font-medium shrink-0">{e.currency} — {e.minutesUntil}m</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ══════ TABS ══════ */}
            <div className="flex gap-2 border-b border-neutral-800 pb-2">
                {([
                    { key: 'overview', label: 'Regime Heatmap', icon: Radio },
                    { key: 'executions', label: 'Execution Log', icon: Zap },
                ] as const).map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-t-lg text-sm font-medium flex items-center gap-2 ${
                            tab === t.key ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══════ REGIME HEATMAP ══════ */}
            {tab === 'overview' && data && (
                <div className="space-y-2">
                    <div className="grid grid-cols-8 gap-3 px-4 text-[10px] text-neutral-500 uppercase tracking-wider">
                        <div>Pair</div>
                        <div>Regime</div>
                        <div>Bot</div>
                        <div>ADX</div>
                        <div>ATR %</div>
                        <div>Confidence</div>
                        <div>Setup</div>
                        <div>Status</div>
                    </div>
                    {data.regimeHeatmap.map(entry => (
                        <Card key={entry.pair} className={`hover:border-neutral-700 transition-colors ${entry.conditionBlack ? 'border-red-800/50' : ''}`}>
                            <CardContent className="p-3">
                                <div className="grid grid-cols-8 gap-3 items-center text-xs">
                                    <div className="font-medium text-white">{entry.pair}</div>
                                    <div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${regimeColor(entry.regime)}`}>
                                            {entry.regime.replace('_', ' ').replace('ranging quiet', 'RANGE').replace('trending strong', 'TREND↑').replace('trending mild', 'TREND~').replace('complex correction', 'COMPLEX').replace('news chaos', 'NEWS').replace('unknown dangerous', 'DANGER')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-neutral-300 font-medium">{botLabel(entry.activeBot)}</span>
                                    </div>
                                    <div className={entry.adx > 30 ? 'text-emerald-400 font-medium' : entry.adx > 20 ? 'text-neutral-300' : 'text-neutral-500'}>
                                        {entry.adx.toFixed(1)}
                                    </div>
                                    <div className={entry.atrPercentile > 70 ? 'text-amber-400' : entry.atrPercentile < 30 ? 'text-cyan-400' : 'text-neutral-400'}>
                                        {entry.atrPercentile.toFixed(0)}%
                                    </div>
                                    <div>
                                        <div className={`font-medium ${entry.confidence >= 70 ? 'text-emerald-400' : entry.confidence >= 50 ? 'text-amber-400' : 'text-neutral-500'}`}>
                                            {entry.confidence}%
                                        </div>
                                    </div>
                                    <div>
                                        {entry.setupDetected ? (
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${entry.direction === 'long' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {entry.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                                            </span>
                                        ) : (
                                            <span className="text-neutral-600">—</span>
                                        )}
                                    </div>
                                    <div>
                                        {entry.conditionBlack ? (
                                            <span className="flex items-center gap-1 text-red-400 font-bold text-[10px]">
                                                <ShieldAlert size={12} />
                                                BLACK
                                            </span>
                                        ) : entry.activeBot !== 'none' ? (
                                            <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                                                <Activity size={12} />
                                                ACTIVE
                                            </span>
                                        ) : (
                                            <span className="text-neutral-600 text-[10px]">IDLE</span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ══════ EXECUTION LOG ══════ */}
            {tab === 'executions' && data && (
                <div className="space-y-2">
                    {data.recentExecutions.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-neutral-500">
                                No auto-executions recorded yet.
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div className="grid grid-cols-8 gap-3 px-4 text-[10px] text-neutral-500 uppercase tracking-wider">
                                <div>Time</div>
                                <div>Pair</div>
                                <div>Bot</div>
                                <div>Direction</div>
                                <div>Entry</div>
                                <div>SL</div>
                                <div>Trail</div>
                                <div>Status</div>
                            </div>
                            {data.recentExecutions.map(exec => (
                                <Card key={exec.id} className={`${exec.executed ? 'border-emerald-800/30' : exec.dryRun ? 'border-amber-800/30' : 'border-neutral-800'} hover:border-neutral-700 transition-colors`}>
                                    <CardContent className="p-3">
                                        <div className="grid grid-cols-8 gap-3 items-center text-xs">
                                            <div className="text-neutral-400">
                                                {new Date(exec.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="text-white font-medium">
                                                {exec.pair}
                                                {exec.ghostEventName && (
                                                    <div className="text-[9px] text-amber-400 truncate">👻 {exec.ghostEventName}</div>
                                                )}
                                            </div>
                                            <div>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    exec.activeBot === 'ghost' ? 'bg-amber-500/15 text-amber-300'
                                                    : exec.activeBot === 'trap' ? 'bg-cyan-500/15 text-cyan-300'
                                                    : exec.activeBot === 'momentum' ? 'bg-emerald-500/15 text-emerald-300'
                                                    : 'bg-neutral-800 text-neutral-400'
                                                }`}>
                                                    {botLabel(exec.activeBot)}
                                                </span>
                                            </div>
                                            <div>
                                                {exec.direction && exec.direction !== 'none' && (
                                                    <span className={exec.direction === 'long' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                                                        {exec.direction.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-neutral-300">{exec.entryPrice?.toFixed(5) ?? '—'}</div>
                                            <div className="text-neutral-400">{exec.stopLoss?.toFixed(5) ?? '—'}</div>
                                            <div className="text-neutral-400">
                                                {exec.trailingStopDistance ? `${exec.trailingStopDistance}` : '—'}
                                            </div>
                                            <div>
                                                {exec.executed ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">LIVE</span>
                                                ) : exec.dryRun ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-medium">DRY</span>
                                                ) : exec.blockedReason ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 font-medium" title={exec.blockedReason}>BLOCKED</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-500">SKIP</span>
                                                )}
                                                {exec.conditionBlack && (
                                                    <div className="text-[9px] text-red-400 mt-0.5">⛔ BLACK</div>
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

            {/* ══════ LOADING STATE ══════ */}
            {loading && !data && (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                    <RefreshCw size={32} className="animate-spin mb-4" />
                    <p className="text-sm">Scanning all pairs... This takes a moment.</p>
                </div>
            )}

            {error && !data && (
                <Card>
                    <CardContent className="py-12 text-center text-red-400">
                        Failed to load War Room data: {error}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
