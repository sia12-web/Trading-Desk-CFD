'use client'

import { ChevronRight, Clapperboard, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { AMDPhaseBadge } from './AMDPhaseBadge'

interface PairCardProps {
    pair: string
    latestEpisode?: {
        title: string
        current_phase: string
        episode_number: number
        season_number?: number | null
        created_at: string
    } | null
    activeScenarios: number
    onDelete: (pair: string) => void
}

export function PairCard({ pair, latestEpisode, activeScenarios, onDelete }: PairCardProps) {
    return (
        <div className="relative group">
            <Link
                href={`/story/${encodeURIComponent(pair.replace('/', '_'))}`}
                className="block bg-neutral-900/40 border border-neutral-800/50 hover:border-blue-500/30 rounded-2xl p-5 transition-all hover:bg-neutral-900/60 hover:shadow-2xl hover:shadow-blue-500/5 group/card"
            >
                <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-neutral-100 group-hover/card:text-white transition-colors flex items-center gap-2">
                            {pair}
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        </h3>
                        {latestEpisode && (
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-blue-400">
                                    S{latestEpisode.season_number || 1}
                                </p>
                                <div className="w-1 h-1 rounded-full bg-neutral-800" />
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                                    EP {latestEpisode.episode_number}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {latestEpisode ? (
                    <div className="space-y-4">
                        <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed h-10 italic">
                            "{latestEpisode.title}"
                        </p>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AMDPhaseBadge phase={latestEpisode.current_phase} size="sm" />
                                {activeScenarios > 0 && (
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg font-bold border border-emerald-500/20">
                                        {activeScenarios} ACTIVE
                                    </span>
                                )}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-neutral-800/50 flex items-center justify-center text-neutral-500 group-hover/card:bg-blue-600 group-hover/card:text-white transition-all duration-300">
                                <ChevronRight size={16} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 border border-dashed border-neutral-800 rounded-xl bg-neutral-950/30 group-hover/card:border-neutral-700 transition-colors">
                        <Clapperboard size={20} className="text-neutral-700 mb-2 group-hover/card:text-neutral-500 transition-colors" />
                        <span className="text-[10px] text-neutral-600 font-medium uppercase tracking-tight">No episodes recorded</span>
                    </div>
                )}
            </Link>

            {/* Delete Button - Positioned absolutely so it doesn't trigger the Link */}
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (confirm(`Are you sure you want to delete ${pair} from your story?`)) {
                        onDelete(pair)
                    }
                }}
                className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                title="Remove Pair"
            >
                <Trash2 size={16} />
            </button>
        </div>
    )
}
