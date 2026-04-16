'use client'

import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { InstitutionalBias } from '@/lib/market-maker/types'

interface BiasPanelProps {
    bias: InstitutionalBias
}

export function BiasPanel({ bias }: BiasPanelProps) {
    const [expanded, setExpanded] = useState(false)

    const biasIcon = bias.finalBias === 'LONG' ? TrendingUp : bias.finalBias === 'SHORT' ? TrendingDown : Minus
    const biasColor = bias.finalBias === 'LONG' ? 'text-emerald-400' : bias.finalBias === 'SHORT' ? 'text-red-400' : 'text-neutral-400'
    const biasBg = bias.finalBias === 'LONG' ? 'bg-emerald-950/30 border-emerald-800/30' : bias.finalBias === 'SHORT' ? 'bg-red-950/30 border-red-800/30' : 'bg-neutral-900/30 border-neutral-800/30'

    const BiasIcon = biasIcon

    const consensusLabel =
        bias.consensusScore === 3 ? 'UNANIMOUS' :
        bias.consensusScore === 2 ? 'STRONG' :
        'WEAK'

    const consensusColor =
        bias.consensusScore === 3 ? 'text-emerald-400' :
        bias.consensusScore === 2 ? 'text-cyan-400' :
        'text-amber-400'

    return (
        <div className={`border rounded-lg p-4 ${biasBg}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BiasIcon size={20} className={biasColor} />
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className={`text-sm font-bold ${biasColor}`}>
                                Institutional Bias: {bias.finalBias}
                            </h3>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${consensusColor} ${consensusColor.replace('text', 'border')} ${consensusColor.replace('text', 'bg').replace('400', '900/30')}`}>
                                {consensusLabel} ({bias.consensusScore}/3)
                            </span>
                            <span className="text-[10px] text-neutral-600">
                                {bias.finalConfidence}% confidence
                            </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            {bias.finalBias === 'LONG' ? '📈 Every M1 drop is a trap to BUY. Accumulate at the floor.' : bias.finalBias === 'SHORT' ? '📉 Every M1 rally is a trap to SELL. Distribute at the ceiling.' : '⚖️ No clear bias. Whale trades opportunistically.'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{expanded ? 'Hide' : 'Show'} Details</span>
                </button>
            </div>

            {expanded && (
                <div className="mt-4 space-y-3 border-t border-neutral-800/50 pt-3">
                    {/* Step 1: H1 Proximity */}
                    <DetailStep
                        title="Step 1: H1 Donchian Proximity"
                        bias={bias.h1Proximity.bias}
                        confidence={bias.h1Proximity.confidence}
                        reasoning={bias.h1Proximity.reasoning}
                    />

                    {/* Step 2: London Handoff */}
                    <DetailStep
                        title="Step 2: London Handoff"
                        bias={bias.londonHandoff.bias}
                        confidence={bias.londonHandoff.confidence}
                        reasoning={bias.londonHandoff.reasoning}
                    />

                    {/* Step 3: CVD Divergence */}
                    <DetailStep
                        title="Step 3: Daily CVD X-Ray"
                        bias={bias.cvdDivergence.bias}
                        confidence={bias.cvdDivergence.confidence}
                        reasoning={bias.cvdDivergence.reasoning}
                    />

                    {/* Summary */}
                    <div className="bg-neutral-900/50 rounded p-3 mt-3">
                        <h4 className="text-xs font-semibold text-neutral-400 mb-1">Operator's Verdict</h4>
                        <p className="text-[11px] text-neutral-300 leading-relaxed whitespace-pre-line">
                            {bias.summary}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

function DetailStep({ title, bias, confidence, reasoning }: {
    title: string
    bias: 'LONG' | 'SHORT' | 'NEUTRAL'
    confidence: number
    reasoning: string
}) {
    const biasColor = bias === 'LONG' ? 'text-emerald-400' : bias === 'SHORT' ? 'text-red-400' : 'text-neutral-400'
    const biasBg = bias === 'LONG' ? 'bg-emerald-900/20' : bias === 'SHORT' ? 'bg-red-900/20' : 'bg-neutral-900/20'

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-neutral-400">{title}</h4>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${biasBg} ${biasColor} font-mono`}>
                    {bias} ({confidence}%)
                </span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
                {reasoning}
            </p>
        </div>
    )
}
