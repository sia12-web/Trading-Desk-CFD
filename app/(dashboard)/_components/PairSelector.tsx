'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { ALLOWED_INSTRUMENTS } from '@/lib/constants/instruments'

interface PairSelectorProps {
    onSubscribe: (pair: string) => void
    onClose: () => void
    subscribedPairs: string[]
}

export function PairSelector({ onSubscribe, onClose, subscribedPairs }: PairSelectorProps) {
    const [search, setSearch] = useState('')

    const filtered = ALLOWED_INSTRUMENTS.filter(pair => 
        pair.toLowerCase().includes(search.toLowerCase()) && 
        !subscribedPairs.includes(pair)
    )

    return (
        <div className="flex flex-col h-[400px]">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                <input
                    type="text"
                    placeholder="Search pairs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filtered.map(pair => (
                    <button
                        key={pair}
                        onClick={() => onSubscribe(pair)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-neutral-800/50 transition-colors group"
                    >
                        <span className="font-bold text-neutral-300 group-hover:text-white">{pair}</span>
                        <div className="px-2 py-0.5 bg-neutral-800 rounded text-[10px] text-neutral-500 font-bold uppercase">
                            Select
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="py-20 text-center text-neutral-600">
                        No pairs found
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-800 flex justify-end">
                <button
                    onClick={onClose}
                    className="text-sm text-neutral-500 hover:text-white transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}
