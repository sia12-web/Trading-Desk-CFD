'use client'

import { Users, Flame, Target, AlertTriangle } from 'lucide-react'
import type { RetailState } from '@/lib/market-maker/types'

interface RetailGaugeProps {
    retail: RetailState
}

export function RetailGauge({ retail }: RetailGaugeProps) {
    const sentimentLabel = retail.sentiment > 70 ? 'Extreme Greed'
        : retail.sentiment > 55 ? 'Greedy'
        : retail.sentiment > 45 ? 'Neutral'
        : retail.sentiment > 30 ? 'Fearful'
        : 'Extreme Fear'

    const sentimentColor = retail.sentiment > 70 ? 'text-emerald-400'
        : retail.sentiment > 55 ? 'text-emerald-300'
        : retail.sentiment > 45 ? 'text-neutral-400'
        : retail.sentiment > 30 ? 'text-red-300'
        : 'text-red-400'

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} className="text-amber-400" />
                Retail Crowd
            </h3>

            {/* Sentiment Gauge */}
            <div className="relative">
                <div className="w-full h-4 rounded-full bg-gradient-to-r from-red-600 via-yellow-500 to-emerald-500 opacity-30" />
                <div
                    className="absolute top-0 w-3 h-4 bg-white rounded-sm shadow-lg transition-all duration-500"
                    style={{ left: `calc(${retail.sentiment}% - 6px)` }}
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>Fear</span>
                    <span className={sentimentColor}>{sentimentLabel} ({retail.sentiment})</span>
                    <span>Greed</span>
                </div>
            </div>

            {/* Stats */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <Flame size={12} className="text-orange-400" /> FOMO
                    </span>
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                style={{ width: `${retail.fomoIntensity}%` }}
                            />
                        </div>
                        <span className="text-neutral-400 font-mono w-8 text-right">{retail.fomoIntensity}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <Target size={12} className="text-blue-400" /> Bias
                    </span>
                    <span className={`font-mono ${
                        retail.breakoutBias === 'long' ? 'text-emerald-400'
                        : retail.breakoutBias === 'short' ? 'text-red-400'
                        : 'text-neutral-500'
                    }`}>
                        {retail.breakoutBias.toUpperCase()}
                    </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-neutral-500">
                        <AlertTriangle size={12} className="text-red-400" /> Victims
                    </span>
                    <span className="text-red-400 font-mono">{retail.stopHuntVictims}</span>
                </div>
            </div>

            {/* Narrative */}
            <div className="bg-neutral-900/50 rounded p-2 text-[11px] text-neutral-400 italic leading-relaxed">
                &ldquo;{retail.narrative}&rdquo;
            </div>
        </div>
    )
}
