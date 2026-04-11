import { getAuthUser } from '@/lib/supabase/server'
import {
    getPortfolioSummary,
    getCumulativePnL,
    getPnLByPair,
    getMonthlyPnL,
    getRecentClosedTrades
} from '@/lib/data/analytics'
import { redirect } from 'next/navigation'
import { CumulativePnLChart } from '@/app/(dashboard)/pnl/_components/CumulativePnLChart'
import { PnLByPairChart } from '@/app/(dashboard)/pnl/_components/PnLByPairChart'
import {
    DollarSign,
    Target,
    TrendingUp,
    BarChart3,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    TrendingDown,
    History
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { SyncButton } from '@/components/sync/SyncButton'
import { AutoSync } from '@/components/sync/AutoSync'

export default async function PnlPage() {
    const user = await getAuthUser()
    if (!user) redirect('/login')

    const summary = await getPortfolioSummary(user.id)
    const cumulativeData = await getCumulativePnL(user.id)
    const pairData = await getPnLByPair(user.id)
    const monthlyData = await getMonthlyPnL(user.id)
    const recentTrades = await getRecentClosedTrades(user.id)

    const stats = [
        { label: 'Total P&L', value: `${summary.totalPnL >= 0 ? '+' : ''}$${summary.totalPnL.toFixed(2)}`, icon: DollarSign, color: summary.totalPnL >= 0 ? 'text-green-400' : 'text-red-400', bg: summary.totalPnL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10' },
        { label: 'Win Rate', value: `${summary.winRate.toFixed(1)}%`, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Total Trades', value: summary.totalTrades, icon: History, color: 'text-neutral-400', bg: 'bg-neutral-800' },
        { label: 'Profit Factor', value: summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2), icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ]

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <AutoSync />
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-premium-white">Analytics Terminal</h1>
                    <p className="text-neutral-500 mt-2 text-lg">Statistical proof of your trading edge.</p>
                </div>
                <div className="flex items-center gap-4">
                    <SyncButton />
                    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Real-time Data Active</span>
                    </div>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-neutral-900 border border-neutral-800 p-4 md:p-8 rounded-[2rem] hover:border-neutral-700 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-neutral-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Cumulative P&L Chart */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-4 md:p-8 space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-3">
                            <TrendingUp className="text-blue-500" size={20} />
                            Equity Curve
                        </h3>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 bg-neutral-800 rounded-lg text-[10px] font-bold text-neutral-500">ALL TIME</span>
                        </div>
                    </div>
                    <div className="h-80 w-full min-h-[320px]">
                        <CumulativePnLChart data={cumulativeData} />
                    </div>
                </div>

                {/* P&L by Pair */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-4 md:p-8 space-y-8">
                    <h3 className="text-xl font-bold flex items-center gap-3">
                        <PieChart className="text-amber-500" size={20} />
                        Edge by Pair
                    </h3>
                    <div className="h-80 w-full min-h-[320px]">
                        <PnLByPairChart data={pairData} />
                    </div>
                </div>
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 md:p-8 space-y-4">
                    <div className="flex items-center gap-3 text-green-400">
                        <ArrowUpRight size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">Avg Win</span>
                    </div>
                    <p className="text-3xl font-bold font-mono">${summary.avgWin.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 md:p-8 space-y-4">
                    <div className="flex items-center gap-3 text-red-400">
                        <TrendingDown size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">Avg Loss</span>
                    </div>
                    <p className="text-3xl font-bold font-mono">${summary.avgLoss.toFixed(2)}</p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 md:p-8 space-y-4">
                    <div className="flex items-center gap-3 text-blue-400">
                        <Target size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest text-neutral-400">Win/Loss Ratio</span>
                    </div>
                    <p className="text-3xl font-bold font-mono">{(summary.avgWin / (summary.avgLoss || 1)).toFixed(2)}</p>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                <div className="p-4 md:p-8 border-b border-neutral-800">
                    <h3 className="text-xl font-bold">Recent Closed Positions</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-neutral-800/30 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                                <th className="px-3 py-3 md:px-8 md:py-4">Instrument</th>
                                <th className="px-3 py-3 md:px-8 md:py-4">Side</th>
                                <th className="px-3 py-3 md:px-8 md:py-4">Outcome</th>
                                <th className="px-3 py-3 md:px-8 md:py-4">Pips</th>
                                <th className="px-3 py-3 md:px-8 md:py-4">Closed</th>
                                <th className="px-3 py-3 md:px-8 md:py-4 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800 text-sm">
                            {recentTrades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="px-3 py-3 md:px-8 md:py-6 font-bold">
                                        {trade.pair}
                                        {trade.source === 'external' && (
                                            <span className="ml-2 px-1.5 py-0.5 text-[8px] font-bold bg-purple-500/10 text-purple-400 rounded uppercase tracking-widest">
                                                TV
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 md:px-8 md:py-6">
                                        <span className={`flex items-center gap-1.5 font-bold ${trade.direction === 'long' ? 'text-green-500' : 'text-red-500'}`}>
                                            {trade.direction === 'long' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            {trade.direction.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-3 md:px-8 md:py-6 font-bold ${Number(trade.trade_pnl?.[0]?.pnl_amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {Number(trade.trade_pnl?.[0]?.pnl_amount) >= 0 ? '+' : ''}${trade.trade_pnl?.[0]?.pnl_amount}
                                    </td>
                                    <td className="px-3 py-3 md:px-8 md:py-6 font-mono text-neutral-400">{trade.trade_pnl?.[0]?.pnl_pips}</td>
                                    <td className="px-3 py-3 md:px-8 md:py-6 text-neutral-500">{format(new Date(trade.closed_at), 'MMM dd')}</td>
                                    <td className="px-3 py-3 md:px-8 md:py-6 text-right">
                                        <Link href={`/journal/${trade.id}`} className="text-blue-500 hover:text-blue-400 font-bold transition-colors">
                                            Review
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {recentTrades.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-neutral-600 italic">
                                        No closed positions to display. Start journaling to see analytics.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
