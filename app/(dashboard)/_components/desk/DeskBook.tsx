import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'
import type { OpenPosition } from '@/lib/desk/types'

interface DeskBookProps {
    positions: OpenPosition[]
}

export function DeskBook({ positions }: DeskBookProps) {
    if (positions.length === 0) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3">Open Book</h3>
                <div className="text-center py-8">
                    <p className="text-sm text-neutral-600">No open positions</p>
                    <p className="text-xs text-neutral-700 mt-1">Book is flat. Ready for deployment.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Open Book</h3>
                <Link href="/positions" className="text-[9px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">
                    View All
                </Link>
            </div>
            <div className="space-y-2">
                {positions.map((pos, i) => (
                    <div
                        key={`${pos.pair}-${i}`}
                        className="flex items-center justify-between p-3 bg-neutral-950/40 border border-neutral-800 rounded-xl"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${pos.direction === 'long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {pos.direction === 'long' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-white">{pos.pair}</p>
                                <p className="text-[9px] text-neutral-600 font-mono">@ {pos.entry_price}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-neutral-600 font-medium">
                                SL: {pos.stop_loss ?? '-'} | TP: {pos.take_profit ?? '-'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
