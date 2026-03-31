'use client'

import type { DeskMessage } from '@/lib/desk/types'

const CHARACTER_CONFIG: Record<string, { color: string; bg: string; border: string; role: string; initials: string }> = {
    marcus: { color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/20', role: 'PM', initials: 'M' },
    sarah: { color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/20', role: 'Risk', initials: 'S' },
    ray: { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/20', role: 'Quant', initials: 'R' },
    alex: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', role: 'Macro', initials: 'A' },
    trader: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/20', role: 'You', initials: 'T' },
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
    block: { label: 'BLOCKED', className: 'bg-rose-500/20 text-rose-400' },
    alert: { label: 'ALERT', className: 'bg-amber-500/20 text-amber-400' },
    approval: { label: 'APPROVED', className: 'bg-emerald-500/20 text-emerald-400' },
    challenge: { label: 'CHALLENGE', className: 'bg-orange-500/20 text-orange-400' },
}

interface MessageBubbleProps {
    message: DeskMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const config = CHARACTER_CONFIG[message.speaker] || CHARACTER_CONFIG.trader
    const badge = TYPE_BADGE[message.message_type]

    return (
        <div className={`flex gap-3 py-3 px-3 rounded-xl hover:bg-neutral-800/30 transition-colors group`}>
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full ${config.bg} ${config.color} flex items-center justify-center shrink-0 text-sm font-black border ${config.border}`}>
                {config.initials}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-black uppercase tracking-widest ${config.color}`}>
                        {message.speaker}
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
                    {message.message}
                </p>
            </div>
        </div>
    )
}

export { CHARACTER_CONFIG }
