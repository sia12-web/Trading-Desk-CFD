'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Anchor, Play, Pause, SkipForward, RotateCcw, Loader2, Calendar, BarChart3, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PriceChart } from './_components/PriceChart'
import { CandlestickChart } from './_components/CandlestickChart'
import { InventoryPanel } from './_components/InventoryPanel'
import { RetailGauge } from './_components/RetailGauge'
import { ATRComparison } from './_components/ATRComparison'
import { SessionTimeline } from './_components/SessionTimeline'
import { ActionLog } from './_components/ActionLog'
import { PsychologyPanel } from './_components/PsychologyPanel'
import { EventFeed } from './_components/EventFeed'
import { RetailTradersTable } from './_components/RetailTradersTable'
import { BiasPanel } from './_components/BiasPanel'
import { StrategyPanel } from './_components/StrategyPanel'
import type { SessionReplay } from '@/lib/market-maker/types'

const STEPS = 12
const CANDLES_PER_STEP = 15
const PLAYBACK_INTERVAL_MS = 2000

export default function MarketMakerPage() {
    const [date, setDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 1)
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
        return d.toISOString().split('T')[0]
    })
    const [instrument, setInstrument] = useState('EUR_JPY')
    const [replay, setReplay] = useState<SessionReplay | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isMounted, setIsMounted] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Playback control
    useEffect(() => {
        if (playing && replay) {
            intervalRef.current = setInterval(() => {
                setCurrentStep(prev => {
                    if (prev >= STEPS - 1) {
                        setPlaying(false)
                        return prev
                    }
                    return prev + 1
                })
            }, PLAYBACK_INTERVAL_MS)
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [playing, replay])

    const runSimulation = useCallback(async () => {
        setLoading(true)
        setError(null)
        setReplay(null)
        setCurrentStep(0)
        setPlaying(false)

        try {
            const res = await fetch('/api/market-maker/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, instrument }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || `HTTP ${res.status}`)
            }

            const data: SessionReplay = await res.json()
            setReplay(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Simulation failed')
        } finally {
            setLoading(false)
        }
    }, [date, instrument])

    const step = replay?.steps[currentStep]
    const book = step?.book ?? replay?.finalBook

    // Collect all events up to current step
    const { currentEvents, previousEvents } = useMemo(() => {
        if (!replay) return { currentEvents: [], previousEvents: [] }
        const current = replay.steps[currentStep]?.retailEvents ?? []
        const previous = replay.steps
            .slice(0, currentStep)
            .flatMap(s => s.retailEvents)
            .reverse()
        return { currentEvents: current, previousEvents: previous }
    }, [replay, currentStep])

    // Current retail trader snapshots
    const retailSnapshots = step?.retailSnapshots ?? []

    const netPnl = replay
        ? (replay.finalBook?.realizedPnl ?? 0) + (replay.finalBook?.unrealizedPnl ?? 0) - (replay.finalBook?.manipulationCost ?? 0)
        : 0

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Anchor className="text-cyan-400" size={28} />
                        Whale Simulator
                    </h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Watch how institutional funds think: London bias → Strategic goal → Inventory manipulation → Retail exploitation
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Instrument Selector */}
                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                        <span className="text-xs text-neutral-500">Pair:</span>
                        <select
                            value={instrument}
                            onChange={(e) => setInstrument(e.target.value)}
                            className="bg-transparent text-sm text-neutral-200 outline-none cursor-pointer"
                            disabled={loading}
                        >
                            <optgroup label="Major Forex">
                                <option value="EUR_USD">EUR/USD</option>
                                <option value="GBP_USD">GBP/USD</option>
                                <option value="USD_JPY">USD/JPY</option>
                                <option value="EUR_JPY">EUR/JPY</option>
                                <option value="GBP_JPY">GBP/JPY</option>
                                <option value="AUD_USD">AUD/USD</option>
                                <option value="USD_CAD">USD/CAD</option>
                                <option value="NZD_USD">NZD/USD</option>
                            </optgroup>
                            <optgroup label="Crypto">
                                <option value="CRYPTO_BTC_USD">BTC/USD</option>
                                <option value="CRYPTO_ETH_USD">ETH/USD</option>
                                <option value="CRYPTO_SOL_USD">SOL/USD</option>
                                <option value="CRYPTO_XRP_USD">XRP/USD</option>
                            </optgroup>
                            <optgroup label="Indices">
                                <option value="NAS100_USD">NAS100</option>
                                <option value="SPX500_USD">SPX500</option>
                                <option value="US30_USD">US30</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Date Selector */}
                    <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                        <Calendar size={14} className="text-neutral-500" />
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent text-sm text-neutral-200 outline-none"
                            disabled={loading}
                        />
                    </div>

                    {/* Run Button */}
                    <Button
                        onClick={runSimulation}
                        disabled={loading}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white border border-cyan-500/50"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="animate-spin mr-2" />
                                Simulating...
                            </>
                        ) : (
                            'Run Simulation'
                        )}
                    </Button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <Card className="border-cyan-800/30 bg-gradient-to-b from-cyan-950/20 to-neutral-900/50">
                    <CardContent className="py-12 text-center">
                        <Loader2 size={32} className="animate-spin mx-auto text-cyan-400 mb-4" />
                        <p className="text-neutral-400">Running 12-step whale simulation...</p>
                        <p className="text-xs text-neutral-600 mt-2">
                            Deterministic whale logic + 50 retail traders + DeepSeek narrator. ~30-60 seconds.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Error State */}
            {error && (
                <Card className="border-red-800/30 bg-red-950/20">
                    <CardContent className="py-4 text-center text-red-400">
                        {error}
                    </CardContent>
                </Card>
            )}

            {/* Simulation Results */}
            {replay && !loading && (
                <>
                    {/* Stats Banner */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <StatCard label="Date" value={String(replay.date ?? '')} />
                        <StatCard label="Candles" value={String(replay.totalCandles ?? 0)} />
                        <StatCard label="Steps" value={`${currentStep + 1} / ${STEPS}`} />
                        <StatCard
                            label="Whale PnL"
                            value={`${netPnl >= 0 ? '+' : ''}${netPnl.toFixed(1)}p`}
                            color={netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
                        />
                        <StatCard
                            label="Retail Stopped"
                            value={String(replay.retailAggregateStats.totalStoppedOut ?? 0)}
                            color="text-red-400"
                        />
                        <StatCard
                            label="Retail Avg PnL"
                            value={`${(replay.retailAggregateStats?.avgPnl ?? 0) >= 0 ? '+' : ''}${(replay.retailAggregateStats?.avgPnl ?? 0).toFixed(1)}p`}
                            color={(replay.retailAggregateStats?.avgPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
                        />
                    </div>

                    {/* Playback Controls + Timeline */}
                    <Card className="border-neutral-800 bg-neutral-900/50">
                        <CardContent className="py-3 space-y-3">
                            <div className="flex items-center gap-2 justify-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setCurrentStep(0); setPlaying(false) }}
                                    className="border-neutral-700"
                                >
                                    <RotateCcw size={14} />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPlaying(!playing)}
                                    className="border-neutral-700"
                                >
                                    {playing ? <Pause size={14} /> : <Play size={14} />}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentStep(prev => Math.min(prev + 1, STEPS - 1))}
                                    disabled={currentStep >= STEPS - 1}
                                    className="border-neutral-700"
                                >
                                    <SkipForward size={14} />
                                </Button>
                                <span className="text-xs text-neutral-500 ml-2">
                                    Step {currentStep + 1}/{STEPS} &mdash; {(step?.phase ?? '').toUpperCase()}
                                </span>
                            </div>
                            <SessionTimeline currentStep={currentStep} totalSteps={STEPS} />
                        </CardContent>
                    </Card>

                    {/* Institutional Bias Panel */}
                    <BiasPanel bias={replay.institutionalBias} />

                    {/* Campaign Strategy Panel */}
                    {replay.whaleStrategy && (
                        <StrategyPanel strategy={replay.whaleStrategy} currentStep={currentStep + 1} />
                    )}

                    {/* Main Grid: Chart + Inventory */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <Card className="lg:col-span-3 border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                {/* Chart Type Toggle */}
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs text-neutral-500">Chart:</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setChartType('candlestick')}
                                        className={`h-7 text-xs ${chartType === 'candlestick' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                                    >
                                        <BarChart3 size={12} className="mr-1" />
                                        Candlestick
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setChartType('line')}
                                        className={`h-7 text-xs ${chartType === 'line' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
                                    >
                                        <TrendingUp size={12} className="mr-1" />
                                        Line
                                    </Button>
                                </div>

                                {chartType === 'candlestick' ? (
                                    <CandlestickChart
                                        data={replay.candleData}
                                        currentStep={currentStep}
                                        candlesPerStep={CANDLES_PER_STEP}
                                    />
                                ) : (
                                    <PriceChart
                                        data={replay.candleData}
                                        currentStep={currentStep}
                                        candlesPerStep={CANDLES_PER_STEP}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                {book && <InventoryPanel book={book} />}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Whale Psychology Panel */}
                    {step?.psychology && (
                        <PsychologyPanel psychology={step.psychology} />
                    )}

                    {/* Middle Grid: Event Feed + Retail Table */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                <EventFeed
                                    events={currentEvents}
                                    allPreviousEvents={previousEvents}
                                />
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                <RetailTradersTable traders={retailSnapshots} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bottom Grid: ATR + Retail Gauge + Action Log */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                <ATRComparison
                                    realATR={replay.atrComparison.realATR}
                                    whaleVolatility={replay.atrComparison.whaleVolatility}
                                    currentStep={currentStep}
                                    candlesPerStep={CANDLES_PER_STEP}
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                <RetailGauge
                                    traders={retailSnapshots}
                                    aggregateStats={replay.retailAggregateStats}
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-neutral-800 bg-neutral-900/50">
                            <CardContent className="py-4">
                                <ActionLog steps={replay.steps} currentStep={currentStep} />
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {/* Empty State */}
            {!replay && !loading && !error && (
                <Card className="border-neutral-800 bg-neutral-900/30">
                    <CardContent className="py-16 text-center">
                        <Anchor size={48} className="mx-auto text-neutral-700 mb-4" />
                        <h2 className="text-lg font-semibold text-neutral-400 mb-2">
                            Select a date and run the simulation
                        </h2>
                        <p className="text-sm text-neutral-600 max-w-md mx-auto">
                            A deterministic whale engine plays as an institutional market maker on EUR/JPY M1.
                            50 retail traders with FOMO react to the whale&apos;s manipulation.
                            Watch how accumulation, manipulation, and distribution create the price action
                            that retail traders see as &ldquo;ATR&rdquo;.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
    const displayValue = value === 'NaN' || value === 'undefined' ? '0' : value
    return (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2">
            <div className="text-[10px] text-neutral-600 uppercase">{label}</div>
            <div className={`text-sm font-mono font-semibold ${color ?? 'text-neutral-200'}`}>{displayValue}</div>
        </div>
    )
}
