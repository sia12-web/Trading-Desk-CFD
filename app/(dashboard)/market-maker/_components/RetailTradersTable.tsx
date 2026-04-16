'use client'

import { useState } from 'react'
import { Users, ArrowUpDown } from 'lucide-react'
import type { RetailTraderSnapshot } from '@/lib/market-maker/types'

interface RetailTradersTableProps {
    traders: RetailTraderSnapshot[]
}

type SortKey = 'id' | 'pnl' | 'experience' | 'status'

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
    watching: { bg: 'bg-neutral-800/50', text: 'text-neutral-500' },
    in_position: { bg: 'bg-blue-900/40', text: 'text-blue-400' },
    stopped_out: { bg: 'bg-red-900/40', text: 'text-red-400' },
    took_profit: { bg: 'bg-emerald-900/40', text: 'text-emerald-400' },
}

const EXP_BADGE: Record<string, { bg: string; text: string }> = {
    novice: { bg: 'bg-amber-900/30', text: 'text-amber-400' },
    intermediate: { bg: 'bg-cyan-900/30', text: 'text-cyan-400' },
    advanced: { bg: 'bg-purple-900/30', text: 'text-purple-400' },
}

export function RetailTradersTable({ traders }: RetailTradersTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('id')
    const [sortAsc, setSortAsc] = useState(true)

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc)
        } else {
            setSortKey(key)
            setSortAsc(key === 'id')
        }
    }

    const sorted = [...traders].sort((a, b) => {
        const dir = sortAsc ? 1 : -1
        switch (sortKey) {
            case 'id': return (a.traderId - b.traderId) * dir
            case 'pnl': return (a.totalPnl - b.totalPnl) * dir
            case 'experience': return a.experience.localeCompare(b.experience) * dir
            case 'status': return a.status.localeCompare(b.status) * dir
            default: return 0
        }
    })

    const inPosition = traders.filter(t => t.position !== null).length
    const stoppedOut = traders.filter(t => t.status === 'stopped_out').length
    const profitable = traders.filter(t => t.totalPnl > 0).length

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-amber-400" />
                    Retail Traders ({traders.length})
                </h3>
                <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-blue-400">{inPosition} in position</span>
                    <span className="text-red-400">{stoppedOut} stopped</span>
                    <span className="text-emerald-400">{profitable} profitable</span>
                </div>
            </div>

            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-neutral-900 z-10">
                        <tr className="border-b border-neutral-800">
                            <SortHeader label="#" sortKey="id" current={sortKey} asc={sortAsc} onClick={toggleSort} />
                            <th className="text-left py-1.5 px-1 text-neutral-600 font-medium">Name</th>
                            <SortHeader label="Exp" sortKey="experience" current={sortKey} asc={sortAsc} onClick={toggleSort} />
                            <th className="text-left py-1.5 px-1 text-neutral-600 font-medium">Position</th>
                            <th className="text-right py-1.5 px-1 text-neutral-600 font-medium">Entry</th>
                            <th className="text-right py-1.5 px-1 text-neutral-600 font-medium">SL</th>
                            <SortHeader label="PnL" sortKey="pnl" current={sortKey} asc={sortAsc} onClick={toggleSort} align="right" />
                            <SortHeader label="Status" sortKey="status" current={sortKey} asc={sortAsc} onClick={toggleSort} />
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(t => {
                            const statusBadge = STATUS_BADGE[t.status] ?? STATUS_BADGE.watching
                            const expBadge = EXP_BADGE[t.experience] ?? EXP_BADGE.novice

                            return (
                                <tr key={t.traderId} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                                    <td className="py-1 px-1 text-neutral-600 font-mono">{t.traderId}</td>
                                    <td className="py-1 px-1 text-neutral-300 truncate max-w-[120px]">{t.name}</td>
                                    <td className="py-1 px-1">
                                        <span className={`px-1 py-0.5 rounded text-[10px] ${expBadge.bg} ${expBadge.text}`}>
                                            {t.experience.charAt(0).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-1 px-1">
                                        {t.position ? (
                                            <span className={t.position.direction === 'long' ? 'text-emerald-400' : 'text-red-400'}>
                                                {t.position.direction.toUpperCase()}
                                            </span>
                                        ) : (
                                            <span className="text-neutral-700">—</span>
                                        )}
                                    </td>
                                    <td className="py-1 px-1 text-right font-mono text-neutral-400">
                                        {t.position ? t.position.entryPrice.toFixed(3) : '—'}
                                    </td>
                                    <td className="py-1 px-1 text-right font-mono text-neutral-500">
                                        {t.position ? t.position.stopLoss.toFixed(3) : '—'}
                                    </td>
                                    <td className={`py-1 px-1 text-right font-mono ${t.totalPnl > 0 ? 'text-emerald-400' : t.totalPnl < 0 ? 'text-red-400' : 'text-neutral-600'}`}>
                                        {t.totalPnl !== 0 ? `${t.totalPnl > 0 ? '+' : ''}${t.totalPnl.toFixed(1)}` : '0.0'}
                                    </td>
                                    <td className="py-1 px-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusBadge.bg} ${statusBadge.text}`}>
                                            {t.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function SortHeader({ label, sortKey, current, asc, onClick, align }: {
    label: string
    sortKey: SortKey
    current: SortKey
    asc: boolean
    onClick: (key: SortKey) => void
    align?: 'right'
}) {
    const isActive = current === sortKey
    return (
        <th
            className={`py-1.5 px-1 text-neutral-600 font-medium cursor-pointer hover:text-neutral-400 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
            onClick={() => onClick(sortKey)}
        >
            <span className="inline-flex items-center gap-0.5">
                {label}
                <ArrowUpDown size={10} className={isActive ? 'text-cyan-400' : 'text-neutral-700'} />
                {isActive && <span className="text-[8px] text-cyan-500">{asc ? '\u2191' : '\u2193'}</span>}
            </span>
        </th>
    )
}
