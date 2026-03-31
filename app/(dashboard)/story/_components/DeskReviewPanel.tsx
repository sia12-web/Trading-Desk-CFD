'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const CHARACTER_CONFIG: Record<string, { color: string; bg: string; border: string; role: string; initials: string }> = {
    marcus: { color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/20', role: 'PM', initials: 'M' },
    sarah: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/20', role: 'Risk', initials: 'S' },
    ray: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/20', role: 'Quant', initials: 'R' },
    alex: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', role: 'Macro', initials: 'A' },
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
    block: { label: 'BLOCKED', className: 'bg-rose-500/20 text-rose-400' },
    alert: { label: 'ALERT', className: 'bg-amber-500/20 text-amber-400' },
    approval: { label: 'APPROVED', className: 'bg-emerald-500/20 text-emerald-400' },
    challenge: { label: 'CHALLENGE', className: 'bg-orange-500/20 text-orange-400' },
}

interface DeskReviewMessage {
    id: string
    speaker: string
    message: string
    message_type: string
}

interface DeskReviewPanelProps {
    episodeId: string
    episodeType: string | null | undefined
}

export function DeskReviewPanel({ episodeId, episodeType }: DeskReviewPanelProps) {
    const [messages, setMessages] = useState<DeskReviewMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [polled, setPolled] = useState(0)

    const isRelevant = episodeType === 'position_entry' || episodeType === 'position_management'

    useEffect(() => {
        if (!isRelevant) return

        let cancelled = false
        let pollTimer: ReturnType<typeof setTimeout> | null = null

        async function fetchMessages() {
            try {
                const res = await fetch(`/api/desk/messages?episode_id=${episodeId}&limit=10`)
                const data = await res.json()
                const msgs = data.messages || []

                if (!cancelled) {
                    setMessages(msgs)
                    setLoading(false)

                    // Poll up to 6 times (30s total) if no messages yet
                    // Desk reactions are fire-and-forget, may arrive a few seconds after episode
                    if (msgs.length === 0 && polled < 6) {
                        pollTimer = setTimeout(() => {
                            if (!cancelled) setPolled(p => p + 1)
                        }, 5000)
                    }
                }
            } catch {
                if (!cancelled) setLoading(false)
            }
        }

        fetchMessages()

        return () => {
            cancelled = true
            if (pollTimer) clearTimeout(pollTimer)
        }
    }, [episodeId, polled, isRelevant])

    if (!isRelevant) return null

    // Don't show anything if no messages after loading
    if (!loading && messages.length === 0) return null

    if (loading && messages.length === 0) {
        return (
            <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
                <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-neutral-600" />
                    <span className="text-xs text-neutral-600">The Desk is reviewing...</span>
                </div>
            </section>
        )
    }

    return (
        <section className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    The Desk Reviewed This
                </h3>
            </div>

            {/* Messages */}
            <div className="divide-y divide-neutral-800/50">
                {messages.map(msg => {
                    const config = CHARACTER_CONFIG[msg.speaker] || CHARACTER_CONFIG.ray
                    const badge = TYPE_BADGE[msg.message_type]

                    return (
                        <div key={msg.id} className="flex gap-3 px-4 py-3">
                            {/* Avatar */}
                            <div className={`w-8 h-8 rounded-full ${config.bg} ${config.color} flex items-center justify-center shrink-0 text-xs font-black border ${config.border}`}>
                                {config.initials}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                                        {msg.speaker}
                                    </span>
                                    <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">
                                        {config.role}
                                    </span>
                                    {badge && (
                                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${badge.className}`}>
                                            {badge.label}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-neutral-300 leading-relaxed">
                                    {msg.message}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
