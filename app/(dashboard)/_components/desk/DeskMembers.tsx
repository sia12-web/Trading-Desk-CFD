import type { DeskMeeting } from '@/lib/desk/types'

const MEMBERS = [
    { name: 'Marcus', role: 'Portfolio Manager', initials: 'M', color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/20', key: 'marcus_directive' as const },
    { name: 'Sarah', role: 'Risk Desk', initials: 'S', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/20', key: 'sarah_report' as const },
    { name: 'Ray', role: 'Quant Analyst', initials: 'R', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/20', key: 'ray_analysis' as const },
    { name: 'Alex', role: 'Macro Strategist', initials: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/20', key: 'alex_brief' as const },
]

interface DeskMembersProps {
    todayMeeting: DeskMeeting | null
}

export function DeskMembers({ todayMeeting }: DeskMembersProps) {
    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-5 shadow-2xl">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-4">The Desk</h3>
            <div className="grid grid-cols-2 gap-3">
                {MEMBERS.map((member) => {
                    const briefData = todayMeeting?.[member.key]
                    const hasSpoken = !!briefData

                    return (
                        <div
                            key={member.name}
                            className={`p-3 rounded-xl border ${member.border} ${member.bg} relative overflow-hidden`}
                        >
                            {/* Active indicator */}
                            {hasSpoken && (
                                <div className="absolute top-2.5 right-2.5">
                                    <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse`} />
                                </div>
                            )}

                            <div className="flex items-center gap-2.5 mb-2">
                                <div className={`w-8 h-8 rounded-full bg-neutral-900/50 ${member.color} flex items-center justify-center text-xs font-black border ${member.border}`}>
                                    {member.initials}
                                </div>
                                <div>
                                    <p className={`text-xs font-bold ${member.color}`}>{member.name}</p>
                                    <p className="text-[9px] text-neutral-600 font-medium">{member.role}</p>
                                </div>
                            </div>

                            {hasSpoken && briefData ? (
                                <p className="text-[10px] text-neutral-400 leading-relaxed line-clamp-2">
                                    {briefData.message}
                                </p>
                            ) : (
                                <p className="text-[10px] text-neutral-700 italic">Waiting for meeting...</p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
