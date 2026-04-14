'use client'

import React, { useState, useEffect } from 'react'
import { ShieldAlert, Plus, Loader2, Zap, Target } from 'lucide-react'
import { TrapCard } from './_components/TrapCard'
import { AddTrapModal } from './_components/AddTrapModal'

interface Trap {
    id: string
    instrument: string
    trap_time: string
    analysis: string
    trap_strategy: string
    created_at: string
}

export default function TrapPage() {
    const [traps, setTraps] = useState<Trap[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    useEffect(() => {
        const fetchTraps = async () => {
            try {
                const res = await fetch('/api/traps')
                const data = await res.json()
                setTraps(data.traps || [])
            } catch (err) {
                console.error('Failed to fetch traps:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchTraps()
    }, [])

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/traps?id=${id}`, { method: 'DELETE' })
            if (res.ok) {
                setTraps(prev => prev.filter(t => t.id !== id))
            }
        } catch (err) {
            console.error('Failed to delete trap:', err)
        }
    }

    const handleAdd = (newTrap: Trap) => {
        setTraps(prev => [newTrap, ...prev])
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-800/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-500/5">
                            <ShieldAlert size={20} className="text-purple-500" />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Liquidity Traps</h1>
                    </div>
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-[52px]">Institutional Manipulation & Protocol Log</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-neutral-900/50 border border-neutral-800/50 rounded-2xl backdrop-blur-sm">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Active Protocols</span>
                            <span className="text-xs font-bold text-purple-400">{traps.length}</span>
                        </div>
                        <div className="w-px h-6 bg-neutral-800" />
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Global Status</span>
                            <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-green-500 uppercase">Live</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-600/20 active:scale-95 group"
                    >
                        <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                        Deploy New Trap
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40">
                    <Loader2 size={32} className="animate-spin text-purple-500 mb-4 opacity-50" />
                    <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Accessing Protocol Log...</p>
                </div>
            ) : traps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-neutral-800 rounded-[3rem] bg-neutral-950/20">
                    <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-8 rotate-12 group hover:rotate-0 transition-transform duration-500">
                        <Target size={40} className="text-neutral-700" />
                    </div>
                    <h2 className="text-lg font-bold text-neutral-400 uppercase tracking-tight mb-2">No Active Traps</h2>
                    <p className="text-xs text-neutral-600 uppercase tracking-widest font-black mb-8 text-center max-w-sm">The retail market is safe for now. <br/> Deploy a protocol to start trapping liquidity.</p>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-neutral-700"
                    >
                        Initiate First Protocol
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {traps.map(trap => (
                        <TrapCard key={trap.id} trap={trap} onDelete={handleDelete} />
                    ))}
                </div>
            )}

            {/* Support Info */}
            <div className="pt-20">
                <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-3xl p-8 flex items-center gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <Zap size={20} className="text-indigo-500" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-neutral-200 uppercase tracking-tight">Hedge Fund Intelligence</h4>
                        <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl mt-1 font-medium italic">
                            "To catch a fish, you must think like a fisherman. To trap a trader, you must think like the market maker." - Trap Protocol V1.0
                        </p>
                    </div>
                </div>
            </div>

            <AddTrapModal 
                isOpen={showAddModal} 
                onClose={() => setShowAddModal(false)} 
                onAdd={handleAdd} 
            />
        </div>
    )
}
