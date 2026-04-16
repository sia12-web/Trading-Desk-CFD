'use client'

import { useState } from 'react'
import { Activity, Play, RefreshCw, BarChart2, ShieldAlert, Cpu, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface BacktestTrade {
    entry_date: string
    entry_price: number
    exit_date: string
    exit_price: number
    direction: 'long' | 'short'
    pips: number
    profit_loss: number
    duration_hours: number
    outcome: 'win' | 'loss'
    regime: string
    bot_used: string
    confidence: number
    stop_loss: number
    take_profit: number
}

interface BacktestMetrics {
    total_trades: number
    winning_trades: number
    losing_trades: number
    win_rate: number
    total_pips: number
    profit_factor: number
    max_drawdown_percent: number
    sharpe_ratio: number
    expectancy: number
}

interface SimulationResult {
    pair: string
    lookback_days: number
    total_candles_scanned: number
    regime_distribution: Record<string, number>
    trades: BacktestTrade[]
    metrics: BacktestMetrics
    equity_curve: Array<{ date: string; equity: number }>
}

export default function SimulationPage() {
    const [pair, setPair] = useState('XAU/USD') // Gold is usually most volatile
    const [lookbackDays, setLookbackDays] = useState(21) // 3 weeks
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [analysis, setAnalysis] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [selectedTrade, setSelectedTrade] = useState<BacktestTrade | null>(null)

    const runSimulation = async () => {
        try {
            setLoading(true)
            setError(null)
            setAnalysis(null)
            
            const res = await fetch('/api/regime/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pair, lookbackDays, riskPerTrade: 2 })
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to run simulation')
            
            setResult(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    const runTrioAnalysis = async () => {
        if (!result) return
        try {
            setAnalyzing(true)
            const res = await fetch('/api/regime/backtest/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to analyze')
            setAnalysis(json.analysis)
        } catch (err) {
            console.error('Analysis failed:', err)
        } finally {
            setAnalyzing(false)
        }
    }

    const downloadCSV = () => {
        if (!result || result.trades.length === 0) return
        
        const headers = ['Entry Date,Entry Price,Exit Date,Exit Price,Direction,Pips,Profit/Loss,Duration (Hrs),Outcome,Regime,Bot,Confidence,SL,TP']
        const rows = result.trades.map(t => 
            `${t.entry_date},${t.entry_price},${t.exit_date},${t.exit_price},${t.direction},${t.pips},${t.profit_loss},${t.duration_hours},${t.outcome},${t.regime},${t.bot_used},${t.confidence},${t.stop_loss},${t.take_profit}`
        )
        
        const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")
        const encodedUri = encodeURI(csvContent)
        
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `backtest_${result.pair.replace('/','_')}_${result.lookback_days}d.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="rounded-3xl bg-neutral-900 border border-neutral-800 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30">
                            <Activity size={24} className="text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">War Room Simulator</h1>
                            <p className="text-neutral-400 text-sm mt-0.5">Test the Automated Army against historical market regimes</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex items-end gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400">Instrument</label>
                        <select 
                            value={pair} 
                            onChange={e => setPair(e.target.value)}
                            className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-4 py-2 block w-48"
                        >
                            <option value="XAU/USD">XAU/USD (Gold - High Volatility)</option>
                            <option value="EUR/USD">EUR/USD (Major)</option>
                            <option value="GBP/JPY">GBP/JPY (High Volatility Cross)</option>
                            <option value="SPX500/USD">SPX500/USD (S&P 500)</option>
                            <option value="US30/USD">US30/USD (Dow Jones)</option>
                            <option value="NAS100/USD">NAS100/USD (Nasdaq)</option>
                            <option value="DE30/EUR">DE30/EUR (DAX 40)</option>
                            <option value="BTC/USD">BTC/USD (Bitcoin)</option>
                            <option value="ETH/USD">ETH/USD (Ethereum)</option>
                            <option value="SOL/USD">SOL/USD (Solana)</option>
                            <option value="XRP/USD">XRP/USD (Ripple)</option>
                            <option value="DOGE/USD">DOGE/USD (Dogecoin)</option>
                            <option value="LINK/USD">LINK/USD (Chainlink)</option>
                            <option value="LTC/USD">LTC/USD (Litecoin)</option>
                            <option value="SHIB/USD">SHIB/USD (Shiba Inu)</option>
                            <option value="AVAX/USD">AVAX/USD (Avalanche)</option>
                            <option value="DOT/USD">DOT/USD (Polkadot)</option>
                            <option value="ADA/USD">ADA/USD (Cardano)</option>
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-neutral-400">Lookback Period</label>
                        <select 
                            value={lookbackDays} 
                            onChange={e => setLookbackDays(Number(e.target.value))}
                            className="bg-neutral-800 border-neutral-700 text-white rounded-lg px-4 py-2 block w-48"
                        >
                            <option value={7}>1 Week</option>
                            <option value={14}>2 Weeks</option>
                            <option value={21}>3 Weeks (Tested)</option>
                            <option value={30}>1 Month</option>
                        </select>
                    </div>

                    <Button 
                        onClick={runSimulation} 
                        disabled={loading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-8"
                    >
                        {loading ? (
                            <><RefreshCw size={16} className="mr-2 animate-spin" /> Simulating...</>
                        ) : (
                            <><Play size={16} className="mr-2" /> Run Simulation</>
                        )}
                    </Button>
                </div>
            </div>

            {error && (
                <Card className="border-red-500/30 bg-red-500/5">
                    <CardContent className="p-4 flex items-center gap-3">
                        <ShieldAlert className="text-red-400" />
                        <span className="text-red-400 font-medium">{error}</span>
                    </CardContent>
                </Card>
            )}

            {result && (
                <div className="space-y-6">
                    {/* Action Bar */}
                    <div className="flex justify-end mb-4">
                        <Button 
                            onClick={runTrioAnalysis} 
                            disabled={analyzing || !!analysis}
                            className="bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 border border-indigo-500/30"
                        >
                            {analyzing ? (
                                <><RefreshCw size={16} className="mr-2 animate-spin" /> Trio is analyzing...</>
                            ) : analysis ? (
                                <><Cpu size={16} className="mr-2" /> Analysis Complete</>
                            ) : (
                                <><Cpu size={16} className="mr-2" /> Ask AI Trio to Analyze</>
                            )}
                        </Button>
                        <Button 
                            onClick={downloadCSV}
                            className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 ml-3"
                        >
                            <Download size={16} className="mr-2" /> Export CSV
                        </Button>
                    </div>

                    {/* Analysis Report */}
                    {analysis && (
                        <Card className="bg-indigo-950/20 border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-indigo-300 flex items-center gap-2">
                                    <Cpu size={20} />
                                    AI Trio Architectural Debrief
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-indigo-200/90 whitespace-pre-wrap font-mono leading-relaxed p-4 bg-neutral-900/50 rounded-xl border border-indigo-500/10">
                                    {analysis}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-neutral-400 uppercase tracking-wider">Win Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${result.metrics.win_rate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {result.metrics.win_rate}%
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                    {result.metrics.winning_trades}W / {result.metrics.losing_trades}L
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-neutral-400 uppercase tracking-wider">Net Pips</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${result.metrics.total_pips > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {(result.metrics.total_pips ?? 0) > 0 ? '+' : ''}{(result.metrics.total_pips ?? 0).toFixed(1)}
                                </div>
                                <div className="text-xs text-neutral-500 mt-1">
                                    Net Profit: ${((result.equity_curve[(result.equity_curve?.length ?? 0) - 1]?.equity ?? 10000) - 10000).toFixed(2)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-neutral-400 uppercase tracking-wider">Profit Factor</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-3xl font-black ${result.metrics.profit_factor >= 1.5 ? 'text-emerald-400' : 'text-neutral-300'}`}>
                                    {(result.metrics.profit_factor ?? 0).toFixed(2)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-neutral-900 border-neutral-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs text-neutral-400 uppercase tracking-wider">Max Drawdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-red-400">
                                    -{(result.metrics.max_drawdown_percent ?? 0).toFixed(1)}%
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trade Log */}
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart2 size={18} className="text-indigo-400" />
                                Execution Log
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {result.trades.length === 0 ? (
                                    <div className="text-center text-neutral-500 py-8">No trades executed during this period.</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-9 gap-3 px-4 text-[10px] text-neutral-500 uppercase tracking-wider">
                                            <div>Entry Date</div>
                                            <div>Exit Date</div>
                                            <div>Regime</div>
                                            <div>Bot</div>
                                            <div>Direction</div>
                                            <div>Pips</div>
                                            <div>Net ($)</div>
                                            <div>Duration</div>
                                            <div>Outcome</div>
                                        </div>
                                        {result.trades.map((trade, i) => (
                                            <div key={i} className="space-y-2">
                                                <div 
                                                    onClick={() => setSelectedTrade(selectedTrade === trade ? null : trade)}
                                                    className={`grid grid-cols-9 gap-3 px-4 py-3 rounded-xl border ${trade.outcome === 'win' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'} items-center text-xs cursor-pointer hover:bg-neutral-800 transition-colors`}
                                                >
                                                    <div className="text-neutral-300">{trade.entry_date}</div>
                                                    <div className="text-neutral-300">{trade.exit_date}</div>
                                                    <div className="text-neutral-400">{trade.regime.split('_')[0]}</div>
                                                    <div className="text-white font-medium capitalize">{trade.bot_used}</div>
                                                    <div className={trade.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>{trade.direction.toUpperCase()}</div>
                                                    <div className={`font-bold ${trade.pips > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {trade.pips > 0 ? '+' : ''}{trade.pips}
                                                    </div>
                                                    <div className={`font-bold ${trade.profit_loss > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        ${(trade.profit_loss ?? 0) > 0 ? '+' : ''}{(trade.profit_loss ?? 0).toFixed(2)}
                                                    </div>
                                                    <div className="text-neutral-400">{trade.duration_hours}h</div>
                                                    <div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.outcome === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {trade.outcome.toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {selectedTrade === trade && (
                                                    <div className="mx-4 p-4 rounded-xl bg-neutral-950 border border-neutral-800 grid grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-neutral-500 uppercase">Entry Protocol</div>
                                                            <div className="text-sm font-medium text-white">{trade.bot_used.toUpperCase()} Triggered</div>
                                                            <div className="text-xs text-neutral-400">Confidence: {trade.confidence}%</div>
                                                            <div className="text-xs text-neutral-400 italic">Regime: {trade.regime.toUpperCase()}</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-neutral-500 uppercase">Physics</div>
                                                            <div className="text-sm text-neutral-200">Price: {trade.entry_price}</div>
                                                            <div className="text-sm text-red-400">SL: {trade.stop_loss}</div>
                                                            <div className="text-sm text-emerald-400">TP: {trade.take_profit}</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] text-neutral-500 uppercase">Performance</div>
                                                            <div className="text-sm text-white">{(trade.pips ?? 0).toFixed(1)} Pips Captured</div>
                                                            <div className={`text-lg font-black ${trade.profit_loss > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {(trade.profit_loss ?? 0) > 0 ? '+' : ''}${(trade.profit_loss ?? 0).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
