'use client'

import { Brain, AlertTriangle, Lightbulb } from 'lucide-react'
import type { WhalePsychology } from '@/lib/market-maker/types'

interface PsychologyPanelProps {
    psychology: WhalePsychology
}

export function PsychologyPanel({ psychology }: PsychologyPanelProps) {
    return (
        <div className="bg-gradient-to-br from-purple-950/30 to-blue-950/30 border border-purple-800/30 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <Brain size={16} />
                Whale Psychology
            </h3>

            <p className="text-sm text-white leading-relaxed">
                {psychology.narrative}
            </p>

            <div className="border-t border-purple-800/30 pt-3">
                <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={12} className="text-red-400" />
                    <span className="text-xs font-semibold text-red-400">Retail Exploitation</span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                    {psychology.retailExploitation}
                </p>
            </div>

            <div className="bg-purple-900/20 border border-purple-700/30 rounded p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb size={12} className="text-amber-400" />
                    <span className="text-xs font-semibold text-amber-300">Key Lesson</span>
                </div>
                <p className="text-xs text-white leading-relaxed">
                    {psychology.educationalInsight}
                </p>
            </div>
        </div>
    )
}
