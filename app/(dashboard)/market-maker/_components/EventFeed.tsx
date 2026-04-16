'use client'

import { useEffect, useRef } from 'react'
import { Zap, XCircle, CheckCircle, Flame, AlertTriangle } from 'lucide-react'
import type { RetailEvent } from '@/lib/market-maker/types'

interface EventFeedProps {
    events: RetailEvent[]
    allPreviousEvents: RetailEvent[]
}

const EVENT_CONFIG: Record<RetailEvent['type'], { icon: typeof Zap; color: string; bg: string }> = {
    entry: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800/30' },
    stop_out: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' },
    take_profit: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-800/30' },
    fomo: { icon: Flame, color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800/30' },
    panic: { icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-800/30' },
}

export function EventFeed({ events, allPreviousEvents }: EventFeedProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0
        }
    }, [events])

    const allEvents = [...events, ...allPreviousEvents]

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Zap size={14} className="text-cyan-400" />
                Event Feed
                {events.length > 0 && (
                    <span className="text-[10px] font-normal text-cyan-500 bg-cyan-900/30 px-1.5 py-0.5 rounded">
                        +{events.length} this step
                    </span>
                )}
            </h3>

            <div ref={scrollRef} className="max-h-[350px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {allEvents.length === 0 && (
                    <p className="text-xs text-neutral-600 italic py-4 text-center">
                        No retail activity yet...
                    </p>
                )}

                {allEvents.map((event, i) => {
                    const config = EVENT_CONFIG[event.type]
                    const Icon = config.icon
                    const isCurrentStep = i < events.length

                    return (
                        <div
                            key={`${event.traderId}-${event.timestamp}-${i}`}
                            className={`border rounded px-2 py-1.5 ${config.bg} ${isCurrentStep ? 'opacity-100' : 'opacity-50'}`}
                        >
                            <div className="flex items-start gap-1.5">
                                <Icon size={12} className={`${config.color} mt-0.5 shrink-0`} />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] font-semibold ${config.color}`}>
                                            {event.type.replace('_', ' ').toUpperCase()}
                                        </span>
                                        <span className="text-[10px] text-neutral-600">
                                            {event.traderName}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-neutral-400 leading-snug">
                                        {event.reason}
                                    </p>
                                    {event.pnl !== undefined && (
                                        <span className={`text-[10px] font-mono ${event.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {event.pnl >= 0 ? '+' : ''}{event.pnl.toFixed(1)} pips
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
