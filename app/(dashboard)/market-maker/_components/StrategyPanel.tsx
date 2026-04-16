'use client'

import { Target, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import type { WhaleStrategy } from '@/lib/market-maker/types'

interface StrategyPanelProps {
    strategy: WhaleStrategy
    currentStep: number
}

export function StrategyPanel({ strategy, currentStep }: StrategyPanelProps) {
    const { goal, currentPhase, progress, targetSize, entryZone, exitZone, reasoning } = strategy

    // Color coding by goal
    const goalColor = goal === 'accumulate_long' ? 'text-green-400' :
                      goal === 'distribute_short' ? 'text-red-400' :
                      'text-purple-400'

    const goalBg = goal === 'accumulate_long' ? 'bg-green-500/10 border-green-500/30' :
                   goal === 'distribute_short' ? 'bg-red-500/10 border-red-500/30' :
                   'bg-purple-500/10 border-purple-500/30'

    const goalIcon = goal === 'accumulate_long' ? <TrendingUp className="h-5 w-5" /> :
                     goal === 'distribute_short' ? <TrendingDown className="h-5 w-5" /> :
                     <Activity className="h-5 w-5" />

    // Phase progress
    const phaseSteps = ['building', 'manipulating', 'distributing', 'completed']
    const currentPhaseIndex = phaseSteps.indexOf(currentPhase)
    const progressPct = progress?.targetReached ? 100 :
                        targetSize > 0 ? ((progress?.accumulated ?? 0) / targetSize) * 100 : 0

    return (
        <div className={`rounded-lg border p-4 ${goalBg}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={goalColor}>
                        {goalIcon}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200">
                        Campaign Strategy
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-gray-400">Step {currentStep}/12</span>
                </div>
            </div>

            {/* Goal */}
            <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-400 uppercase">Goal</span>
                </div>
                <div className={`text-sm font-semibold ${goalColor}`}>
                    {goal === 'accumulate_long' ? '📈 ACCUMULATE LONG' :
                     goal === 'distribute_short' ? '📉 DISTRIBUTE SHORT' :
                     '🔄 OPPORTUNISTIC'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                    Target: {targetSize.toLocaleString()} units
                </div>
            </div>

            {/* Phase Progress Bar */}
            <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400">Campaign Phase</span>
                    <span className="text-xs font-semibold text-gray-200 capitalize">
                        {currentPhase}
                    </span>
                </div>
                <div className="flex gap-1">
                    {phaseSteps.map((phase, idx) => (
                        <div
                            key={phase}
                            className={`h-1.5 flex-1 rounded-full ${
                                idx <= currentPhaseIndex
                                    ? goalColor.replace('text-', 'bg-')
                                    : 'bg-gray-700'
                            }`}
                        />
                    ))}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                    <span>Build</span>
                    <span>Manipulate</span>
                    <span>Distribute</span>
                    <span>Done</span>
                </div>
            </div>

            {/* Progress Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-[10px] text-gray-400 uppercase mb-0.5">Accumulated</div>
                    <div className="text-sm font-semibold text-green-400">
                        {(progress?.accumulated ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        {targetSize > 0 ? (((progress?.accumulated ?? 0) / targetSize) * 100).toFixed(0) : 0}%
                    </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-[10px] text-gray-400 uppercase mb-0.5">Distributed</div>
                    <div className="text-sm font-semibold text-red-400">
                        {(progress?.distributed ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        {targetSize > 0 ? (((progress?.distributed ?? 0) / targetSize) * 100).toFixed(0) : 0}%
                    </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-[10px] text-gray-400 uppercase mb-0.5">Net Position</div>
                    <div className={`text-sm font-semibold ${(progress?.netPosition ?? 0) > 0 ? 'text-green-400' : (progress?.netPosition ?? 0) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {(progress?.netPosition ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500">
                        @ {(progress?.avgEntry ?? 0) > 0 ? (progress.avgEntry ?? 0).toFixed(3) : '—'}
                    </div>
                </div>
            </div>

            {/* Entry/Exit Zones */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-green-500/5 border border-green-500/20 rounded p-2">
                    <div className="text-[10px] text-green-400 uppercase mb-0.5">Entry Zone</div>
                    <div className="text-xs font-mono text-gray-300">
                        {(entryZone?.min ?? 0).toFixed(3)} - {(entryZone?.max ?? 0).toFixed(3)}
                    </div>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                    <div className="text-[10px] text-red-400 uppercase mb-0.5">Exit Zone</div>
                    <div className="text-xs font-mono text-gray-300">
                        {(exitZone?.min ?? 0).toFixed(3)} - {(exitZone?.max ?? 0).toFixed(3)}
                    </div>
                </div>
            </div>

            {/* Strategy Reasoning */}
            <div className="bg-gray-800/30 rounded p-2 border border-gray-700/50">
                <div className="text-[10px] text-gray-400 uppercase mb-1">Campaign Reasoning</div>
                <div className="text-xs text-gray-300 leading-relaxed">
                    {reasoning}
                </div>
            </div>

            {/* Target Reached Badge */}
            {progress.targetReached && (
                <div className="mt-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-green-500/20 border border-green-500/40">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs font-semibold text-green-400">TARGET REACHED</span>
                </div>
            )}
        </div>
    )
}
