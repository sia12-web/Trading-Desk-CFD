'use client'

import { useState } from 'react'
import { X, Plus, Search } from 'lucide-react'

const FOREX_PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'EUR/GBP', 'AUD/USD',
    'USD/CAD', 'NZD/USD', 'EUR/JPY', 'USD/CHF', 'GBP/JPY',
    'GBP/AUD', 'EUR/AUD', 'AUD/JPY', 'NZD/JPY', 'USD/TRY', 'XAU/USD',
]

const CFD_INDICES = [
    'NAS100/USD', 'SPX500/USD', 'US30/USD', 'DE30/EUR',
]

const ALL_INSTRUMENTS = [...FOREX_PAIRS, ...CFD_INDICES]

interface PairSelectorProps {
    subscribedPairs: string[]
    onSubscribe: (pair: string) => void
    onClose: () => void
}

export function PairSelector({ subscribedPairs, onSubscribe, onClose }: PairSelectorProps) {
    const [search, setSearch] = useState('')
    const available = ALL_INSTRUMENTS.filter(
        p => !subscribedPairs.includes(p) && p.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-neutral-100">Follow an Instrument</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors">
                        <X size={18} className="text-neutral-400" />
                    </button>
                </div>

                <p className="text-xs text-neutral-500 mb-4">
                    Choose a forex pair or index to follow. Each instrument is like a TV show — you&apos;ll get ongoing narrative analysis.
                </p>

                <div className="relative mb-4">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                        type="text"
                        placeholder="Search instruments..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-blue-500/50"
                    />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {available.length === 0 ? (
                        <p className="text-center text-sm text-neutral-500 py-4">
                            {subscribedPairs.length === ALL_INSTRUMENTS.length
                                ? 'You\'re following all available instruments!'
                                : 'No matching instruments.'}
                        </p>
                    ) : (
                        available.map(pair => (
                            <button
                                key={pair}
                                onClick={() => onSubscribe(pair)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 hover:border-neutral-600 rounded-xl transition-all"
                            >
                                <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
                                    {pair}
                                    {CFD_INDICES.includes(pair) && (
                                        <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">IDX</span>
                                    )}
                                </span>
                                <Plus size={16} className="text-blue-400" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
