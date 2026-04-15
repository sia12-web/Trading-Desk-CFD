'use client'

import type { SessionPhase } from '@/lib/market-maker/types'

interface SessionTimelineProps {
    currentStep: number
    totalSteps: number
}

const PHASES: { phase: SessionPhase; label: string; color: string; stepsStart: number; stepsEnd: number }[] = [
    { phase: 'accumulation', label: 'Accumulation', color: 'bg-blue-600', stepsStart: 0, stepsEnd: 3 },
    { phase: 'manipulation', label: 'Manipulation', color: 'bg-amber-600', stepsStart: 3, stepsEnd: 6 },
    { phase: 'distribution', label: 'Distribution', color: 'bg-red-600', stepsStart: 6, stepsEnd: 8 },
    { phase: 'cleanup', label: 'Cleanup', color: 'bg-neutral-600', stepsStart: 8, stepsEnd: 12 },
]

export function SessionTimeline({ currentStep, totalSteps }: SessionTimelineProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1 h-6 rounded-lg overflow-hidden">
                {PHASES.map((p) => {
                    const width = ((p.stepsEnd - p.stepsStart) / totalSteps) * 100
                    const isCurrent = currentStep >= p.stepsStart && currentStep < p.stepsEnd
                    const isPast = currentStep >= p.stepsEnd

                    return (
                        <div
                            key={p.phase}
                            className={`relative h-full ${p.color} transition-all duration-300 ${
                                isPast ? 'opacity-40' : isCurrent ? 'opacity-100' : 'opacity-20'
                            }`}
                            style={{ width: `${width}%` }}
                        >
                            {isCurrent && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-white drop-shadow">
                                        {p.label}
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Step markers */}
            <div className="flex justify-between px-1">
                {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            i === currentStep ? 'bg-white scale-150'
                            : i < currentStep ? 'bg-neutral-600'
                            : 'bg-neutral-800'
                        }`}
                    />
                ))}
            </div>

            <div className="flex justify-between text-[10px] text-neutral-600">
                <span>08:30 ET</span>
                <span>09:15</span>
                <span>10:00</span>
                <span>10:30</span>
                <span>11:30 ET</span>
            </div>
        </div>
    )
}
