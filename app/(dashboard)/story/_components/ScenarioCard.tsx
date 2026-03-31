'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, CheckCircle2, XCircle, Radio, Bot } from 'lucide-react'

interface Scenario {
    id: string
    title: string
    description: string
    direction: string
    probability: number
    trigger_conditions: string
    invalidation: string
    status: string
    trigger_level?: number | null
    trigger_direction?: string | null
    trigger_timeframe?: string | null
    invalidation_level?: number | null
    invalidation_direction?: string | null
    resolved_by?: string | null
}

interface ScenarioCardProps {
    scenario: Scenario
    onResolve: (id: string, status: 'triggered' | 'invalidated', notes?: string) => void
}

export function ScenarioCard({ scenario, onResolve }: ScenarioCardProps) {
    const [resolving, setResolving] = useState(false)
    const isBullish = scenario.direction === 'bullish'
    const isActive = scenario.status === 'active'
    const prob = Math.round((scenario.probability || 0) * 100)
    const hasStructuredLevels = scenario.trigger_level != null && scenario.invalidation_level != null
    const isAutoResolved = scenario.resolved_by === 'bot'

    return (
        <div className={`border rounded-xl p-4 transition-all ${
            isActive
                ? 'bg-neutral-900/50 border-neutral-700'
                : scenario.status === 'triggered'
                    ? 'bg-green-500/5 border-green-500/20 opacity-75'
                    : 'bg-red-500/5 border-red-500/20 opacity-75'
        }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    {isBullish
                        ? <TrendingUp size={14} className="text-green-400" />
                        : <TrendingDown size={14} className="text-red-400" />
                    }
                    <h4 className="text-sm font-bold text-neutral-200">{scenario.title}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                    {hasStructuredLevels && isActive && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Radio size={8} />
                            Monitored
                        </span>
                    )}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        prob >= 60 ? 'bg-green-500/10 text-green-400' :
                        prob >= 40 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-neutral-700 text-neutral-400'
                    }`}>
                        {prob}%
                    </span>
                </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-3">{scenario.description}</p>

            <div className="space-y-2 text-[11px]">
                <div>
                    <span className="text-green-500 font-semibold">Trigger: </span>
                    <span className="text-neutral-400">{scenario.trigger_conditions}</span>
                    {scenario.trigger_level != null && (
                        <span className="ml-1.5 text-blue-400 font-mono">
                            Price {scenario.trigger_direction} {scenario.trigger_level}
                            {scenario.trigger_timeframe && (
                                <span className="ml-1 text-neutral-500 text-[9px]">({scenario.trigger_timeframe} close)</span>
                            )}
                        </span>
                    )}
                </div>
                <div>
                    <span className="text-red-500 font-semibold">Invalidation: </span>
                    <span className="text-neutral-400">{scenario.invalidation}</span>
                    {scenario.invalidation_level != null && (
                        <span className="ml-1.5 text-red-400/70 font-mono">
                            Price {scenario.invalidation_direction} {scenario.invalidation_level}
                        </span>
                    )}
                </div>
            </div>

            {isActive && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-800">
                    <button
                        onClick={() => { setResolving(true); onResolve(scenario.id, 'triggered') }}
                        disabled={resolving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                    >
                        <CheckCircle2 size={12} />
                        Triggered
                    </button>
                    <button
                        onClick={() => { setResolving(true); onResolve(scenario.id, 'invalidated') }}
                        disabled={resolving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                        <XCircle size={12} />
                        Invalidated
                    </button>
                </div>
            )}

            {!isActive && (
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-neutral-800">
                    {scenario.status === 'triggered' ? (
                        <>
                            <CheckCircle2 size={12} className="text-green-400" />
                            <span className="text-xs text-green-400">Triggered</span>
                        </>
                    ) : (
                        <>
                            <XCircle size={12} className="text-red-400" />
                            <span className="text-xs text-red-400">Invalidated</span>
                        </>
                    )}
                    {isAutoResolved && (
                        <span className="flex items-center gap-1 ml-2 text-[10px] text-neutral-500">
                            <Bot size={10} />
                            auto-detected
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
