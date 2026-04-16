'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { SimulationStep } from '@/lib/market-maker/types'

interface ActionLogProps {
    steps: SimulationStep[]
    currentStep: number
}

const ACTION_BADGES: Record<string, { bg: string; text: string }> = {
    accumulate: { bg: 'bg-blue-900/50 border-blue-700/50', text: 'text-blue-300' },
    manipulate: { bg: 'bg-amber-900/50 border-amber-700/50', text: 'text-amber-300' },
    distribute: { bg: 'bg-red-900/50 border-red-700/50', text: 'text-red-300' },
    hold: { bg: 'bg-neutral-800/50 border-neutral-700/50', text: 'text-neutral-400' },
}

export function ActionLog({ steps, currentStep }: ActionLogProps) {
    const [expandedStep, setExpandedStep] = useState<number | null>(null)
    const visibleSteps = steps.slice(0, currentStep + 1)

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                Action Log
            </h3>
            <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {visibleSteps.map((step) => {
                    const badge = ACTION_BADGES[step.decision.action] ?? ACTION_BADGES.hold
                    const isExpanded = expandedStep === step.stepIndex
                    const time = getStepTime(step.stepIndex)

                    return (
                        <div key={step.stepIndex} className="border border-neutral-800 rounded">
                            <button
                                onClick={() => setExpandedStep(isExpanded ? null : step.stepIndex)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-neutral-800/50 transition-colors"
                            >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <span className="text-neutral-600 font-mono w-12">{time}</span>
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${badge.bg} ${badge.text}`}>
                                    {step.decision.action.toUpperCase()}
                                </span>
                                {step.decision.units > 0 && (
                                    <span className="text-neutral-500">{step.decision.units.toLocaleString()}u</span>
                                )}
                                <span className="text-neutral-500 ml-auto font-mono">
                                    @ {(step.market?.currentPrice ?? 0).toFixed(3)}
                                </span>
                                <span className="text-neutral-600 text-[10px]">
                                    {step.decision.confidence}%
                                </span>
                            </button>

                            {isExpanded && (
                                <div className="px-3 pb-2 space-y-2 border-t border-neutral-800/50">
                                    <div className="pt-2 text-[11px] text-neutral-400">
                                        <strong className="text-neutral-300">Reasoning:</strong>{' '}
                                        {step.decision.reasoning}
                                    </div>
                                    <div className="text-[11px] text-neutral-500">
                                        <strong className="text-neutral-400">Retail Impact:</strong>{' '}
                                        {step.decision.retailImpact}
                                    </div>
                                    {step.decision.manipulationDirection && (
                                        <div className="text-[11px] text-amber-400">
                                            Manipulation: {step.decision.manipulationDirection.toUpperCase()} stop hunt
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function getStepTime(stepIndex: number): string {
    const startMinutes = 8 * 60 + 30  // 08:30
    const minutesOffset = stepIndex * 15
    const totalMinutes = startMinutes + minutesOffset
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}
