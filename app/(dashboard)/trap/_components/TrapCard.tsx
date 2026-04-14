'use client'

import React from 'react'
import { Target, Clock, MessageSquare, Trash2, ShieldAlert } from 'lucide-react'

interface Trap {
    id: string
    instrument: string
    trap_time: string
    analysis: string
    trap_strategy: string
    created_at: string
}

interface TrapCardProps {
    trap: Trap
    onDelete: (id: string) => void
}

export function TrapCard({ trap, onDelete }: TrapCardProps) {
    const formattedDate = new Date(trap.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    })

    return (
        <div className="group relative bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 hover:bg-neutral-800/50 transition-all shadow-xl hover:shadow-purple-500/5 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-600/10 blur-[80px] group-hover:bg-purple-600/20 transition-all" />
            
            <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-500 shadow-lg shadow-purple-500/5">
                        <Target size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">{trap.instrument}</h3>
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Clock size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{trap.trap_time} DAILY</span>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={() => onDelete(trap.id)}
                    className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="space-y-4 relative z-10">
                <div className="p-4 bg-neutral-950/50 border border-neutral-800/50 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <MessageSquare size={12} className="text-neutral-500" />
                        <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em]">Market Analysis</span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed font-medium line-clamp-3">
                        {trap.analysis}
                    </p>
                </div>

                <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={12} className="text-purple-500" />
                        <span className="text-[9px] font-black text-purple-500 uppercase tracking-[0.2em]">Hedge Fund Trap Protocol</span>
                    </div>
                    <p className="text-xs text-purple-200/80 leading-relaxed font-bold">
                        {trap.trap_strategy}
                    </p>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-neutral-800/50 flex items-center justify-between relative z-10">
                <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Protocol Date</span>
                <span className="text-[10px] font-bold text-neutral-400">{formattedDate}</span>
            </div>
        </div>
    )
}
