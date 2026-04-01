import { getOpenTrades, getPendingOrders, getAccountInstruments } from '@/lib/oanda/client'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { TradeActions } from '@/app/(dashboard)/positions/_components/TradeActions'
import { PendingOrdersTable } from '@/app/(dashboard)/positions/_components/PendingOrdersTable'
import { Shield, TrendingUp, Clock, AlertCircle } from 'lucide-react'

export default async function PositionsPage() {
    const user = await getAuthUser()
    const supabase = await createClient()

    const [tradesRes, ordersRes, instrumentsRes] = await Promise.all([
        getOpenTrades(),
        getPendingOrders(),
        getAccountInstruments()
    ])

    const openTrades = tradesRes.data || []
    const pendingOrdersRaw = ordersRes.data || []
    const instruments = instrumentsRes.data || []

    const pendingOrders = pendingOrdersRaw.map(order => {
        if (order.instrument) return order
        if (order.tradeID) {
            const trade = openTrades.find(t => t.id === order.tradeID)
            if (trade) return { ...order, instrument: trade.instrument }
        }
        return order
    })

    // Group pending orders by instrument
    const groupedPendingOrders = pendingOrders.reduce((acc, order) => {
        const key = order.instrument || 'Unknown'
        if (!acc[key]) acc[key] = []
        acc[key].push(order)
        return acc
    }, {} as Record<string, any[]>)

    // Map local trades and Story positions to OANDA trades
    const [{ data: localTrades }, { data: storyPositions }] = await Promise.all([
        supabase
            .from('trades')
            .select('id, oanda_trade_id')
            .in('status', ['open', 'planned']),
        supabase
            .from('story_positions')
            .select('id, oanda_trade_id, season_number')
            .in('status', ['active', 'partial_closed'])
    ])

    const findLocalId = (oandaId: string) => {
        return localTrades?.find(t => t.oanda_trade_id === oandaId)?.id
    }
    
    const getStoryBadge = (oandaId: string) => {
        const pos = storyPositions?.find(p => p.oanda_trade_id === oandaId)
        if (!pos) return null
        return `S${pos.season_number}`
    }

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Active Portfolio</h1>
                <p className="text-neutral-500 mt-2">Real-time positions and pending orders from OANDA.</p>
            </div>

            {/* Open Positions Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-3">
                        <TrendingUp className="text-green-500" size={24} />
                        Open Positions
                        <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-400 font-bold">
                            {openTrades.length}
                        </span>
                    </h2>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-800">
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Instrument</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Size</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Entry</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">SL / TP</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">P&L (USD)</th>
                                    <th className="px-8 py-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {openTrades.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-12 text-center text-neutral-500 font-medium">
                                            No open positions.
                                        </td>
                                    </tr>
                                ) : (
                                    openTrades.map((trade) => {
                                        const tradeUnits = Math.abs(parseFloat(trade.currentUnits))
                                        const lots = (tradeUnits / 100000).toFixed(2)
                                        const isLong = parseFloat(trade.currentUnits) > 0
                                        return (
                                        <tr key={trade.id} className="hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-premium-white">{trade.instrument.replace('_', '/')}</span>
                                                        {getStoryBadge(trade.id) && (
                                                            <span className="px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500 text-[9px] font-bold border border-orange-500/20">
                                                                STORY {getStoryBadge(trade.id)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-neutral-500 font-mono">ID: {trade.id}</span>
                                                </div>
                                            </td>
                                            <td className={`px-8 py-6 text-right ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold">{lots} lot{parseFloat(lots) !== 1 ? 's' : ''}</span>
                                                    <span className="text-[10px] text-neutral-500 font-mono">{isLong ? '+' : ''}{trade.currentUnits} units</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right font-mono text-neutral-300">{trade.price}</td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="text-[10px] text-red-400 font-mono">
                                                        SL: {trade.stopLossOrder?.price || '—'}
                                                    </span>
                                                    <span className="text-[10px] text-green-400 font-mono">
                                                        TP: {trade.takeProfitOrder?.price || '—'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={`px-8 py-6 text-right font-mono font-bold ${parseFloat(trade.unrealizedPL) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {parseFloat(trade.unrealizedPL) >= 0 ? '+' : ''}${parseFloat(trade.unrealizedPL).toFixed(2)}
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex justify-end">
                                                    <TradeActions
                                                        trade={trade}
                                                        localTradeId={findLocalId(trade.id)}
                                                        instrumentDetails={instruments.find(i => i.name === trade.instrument)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Pending Orders Section - Grouped by Instrument */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <Clock className="text-blue-500" size={24} />
                    Pending Orders
                    <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-400 font-bold">
                        {pendingOrders.length}
                    </span>
                </h2>

                {pendingOrders.length === 0 ? (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-12 text-center text-neutral-500 font-medium border-dashed">
                        No pending orders.
                    </div>
                ) : (
                    <div className="space-y-8">
                        {(Object.entries(groupedPendingOrders) as [string, any[]][]).map(([instrument, instrumentOrders]) => (
                            <div key={instrument} className="space-y-4">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="h-px flex-1 bg-neutral-800" />
                                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{instrument.replace('_', '/')}</span>
                                    <div className="h-px flex-1 bg-neutral-800" />
                                </div>
                                <PendingOrdersTable orders={instrumentOrders} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Risk Warning */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-8 flex gap-6">
                <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 h-fit">
                    <Shield size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-premium-white mb-2">Portfolio Protection Active</h4>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        All active trades are monitored by the Risk Rules Engine. Modification of SL/TP values
                        should be done through the dashboard to maintain sync with your journal strategy.
                    </p>
                </div>
            </div>
        </div>
    )
}
