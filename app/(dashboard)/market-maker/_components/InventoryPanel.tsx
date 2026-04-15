'use client'

import { Package, TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react'
import type { WhaleBook } from '@/lib/market-maker/types'

interface InventoryPanelProps {
    book: WhaleBook
}

export function InventoryPanel({ book }: InventoryPanelProps) {
    const totalPnl = book.realizedPnl + book.unrealizedPnl - book.manipulationCost
    const distributionPct = book.totalAccumulated > 0
        ? Math.round((book.totalDistributed / book.totalAccumulated) * 100)
        : 0

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Package size={14} className="text-cyan-400" />
                The Book
            </h3>

            <div className="grid grid-cols-2 gap-2">
                <Stat label="Position" value={`${book.positionSize.toLocaleString()} units`} />
                <Stat label="Avg Entry" value={book.averageEntry > 0 ? book.averageEntry.toFixed(3) : '—'} />
            </div>

            <div className="border-t border-neutral-800 pt-2 space-y-1">
                <PnlRow
                    icon={<TrendingUp size={12} />}
                    label="Unrealized"
                    pips={book.unrealizedPnl}
                />
                <PnlRow
                    icon={<DollarSign size={12} />}
                    label="Realized"
                    pips={book.realizedPnl}
                />
                <PnlRow
                    icon={<Zap size={12} />}
                    label="Manipulation Cost"
                    pips={-book.manipulationCost}
                    alwaysNeg
                />
            </div>

            <div className="border-t border-neutral-800 pt-2">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-500">Total PnL</span>
                    <span className={`text-sm font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(1)} pips
                    </span>
                </div>
            </div>

            <div className="border-t border-neutral-800 pt-2">
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                    <span>Distribution Progress</span>
                    <span>{distributionPct}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-amber-500 to-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(distributionPct, 100)}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>{book.totalAccumulated.toLocaleString()} bought</span>
                    <span>{book.totalDistributed.toLocaleString()} sold</span>
                </div>
            </div>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-neutral-900/50 rounded px-2 py-1.5">
            <div className="text-[10px] text-neutral-600">{label}</div>
            <div className="text-sm font-mono text-neutral-200">{value}</div>
        </div>
    )
}

function PnlRow({ icon, label, pips, alwaysNeg }: { icon: React.ReactNode; label: string; pips: number; alwaysNeg?: boolean }) {
    const color = alwaysNeg ? 'text-amber-400' : pips >= 0 ? 'text-emerald-400' : 'text-red-400'
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1 text-neutral-500">
                {icon} {label}
            </span>
            <span className={`font-mono ${color}`}>
                {pips >= 0 && !alwaysNeg ? '+' : ''}{pips.toFixed(1)}p
            </span>
        </div>
    )
}
