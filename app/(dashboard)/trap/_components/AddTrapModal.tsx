'use client'

import React, { useState } from 'react'
import { X, Target, Clock, MessageSquare, ShieldAlert, Zap, Loader2 } from 'lucide-react'

interface AddTrapModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (trap: any) => void
}

export function AddTrapModal({ isOpen, onClose, onAdd }: AddTrapModalProps) {
    const [loading, setLoading] = useState(false)
    const [instrument, setInstrument] = useState('')
    const [time, setTime] = useState('08:30')
    const [analysis, setAnalysis] = useState('')
    const [strategy, setStrategy] = useState('')

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/traps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instrument,
                    trap_time: time,
                    analysis,
                    trap_strategy: strategy
                }),
            })

            if (res.ok) {
                const data = await res.json()
                onAdd(data.trap)
                onClose()
                // Reset form
                setInstrument('')
                setTime('08:30')
                setAnalysis('')
                setStrategy('')
            }
        } catch (err) {
            console.error('Failed to add trap:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
                    <div>
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={18} className="text-purple-500" />
                            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Initiate Liquidity Trap</h3>
                        </div>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-1">Deploy institutional grade manipulation protocol</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-xl text-neutral-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Instrument</label>
                            <div className="relative">
                                <Target size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
                                <input 
                                    type="text" 
                                    value={instrument}
                                    onChange={(e) => setInstrument(e.target.value)}
                                    placeholder="e.g. NAS100, EURUSD"
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-bold placeholder:text-neutral-700"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Trap Time (Daily)</label>
                            <div className="relative">
                                <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
                                <input 
                                    type="time" 
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-bold"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest pl-1">Market Analysis (The Setup)</label>
                        <div className="relative">
                            <MessageSquare size={16} className="absolute left-4 top-4 text-neutral-600" />
                            <textarea 
                                value={analysis}
                                onChange={(e) => setAnalysis(e.target.value)}
                                placeholder="Describe the current market structure and where retail traders are looking..."
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-purple-500 transition-all font-bold placeholder:text-neutral-700 min-h-[100px] resize-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-purple-500/70 uppercase tracking-widest pl-1">Trap Logic (Hedge Fund Perspective)</label>
                        <div className="relative">
                            <Zap size={16} className="absolute left-4 top-4 text-purple-500" />
                            <textarea 
                                value={strategy}
                                onChange={(e) => setStrategy(e.target.value)}
                                placeholder="How will we trap them? Liquidity sweeps, fake breakouts, etc."
                                className="w-full bg-neutral-950 border border-purple-900/30 rounded-2xl py-4 pl-12 pr-4 text-sm text-purple-100 focus:outline-none focus:border-purple-500 transition-all font-bold placeholder:text-purple-900/50 min-h-[100px] resize-none shadow-inner"
                                required
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-purple-600/20 flex items-center justify-center gap-2 group"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} className="group-hover:scale-110 transition-transform" />}
                        Deploy Protocol
                    </button>
                </form>
            </div>
        </div>
    )
}
