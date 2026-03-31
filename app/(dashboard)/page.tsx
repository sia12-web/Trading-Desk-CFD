import { getAuthUser, createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/data/analytics'
import { listTrades } from '@/lib/data/trades'
import { getActiveAccountId } from '@/lib/oanda/account'
import Link from 'next/link'
import { Zap, ArrowRight } from 'lucide-react'
import { DeskFeed } from './_components/desk/DeskFeed'
import { DeskMembers } from './_components/desk/DeskMembers'
import { DeskStats } from './_components/desk/DeskStats'
import { DeskBook } from './_components/desk/DeskBook'
import type { DeskMeeting, DeskState, ProcessScore, OpenPosition, SarahReport } from '@/lib/desk/types'

export default async function DashboardPage() {
    const user = await getAuthUser()
    if (!user) return null

    const supabase = await createClient()
    const stats = await getDashboardStats(user.id)
    const accountId = await getActiveAccountId()

    // Fetch desk-specific data in parallel
    const [todayMeetingResult, deskStateResult, scoresResult, openTradesResult] = await Promise.all([
        // Today's latest meeting
        supabase
            .from('desk_meetings')
            .select('*')
            .eq('user_id', user.id)
            .eq('meeting_type', 'morning_meeting')
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        // Desk state
        supabase
            .from('desk_state')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
        // Recent process scores
        supabase
            .from('process_scores')
            .select('*')
            .eq('user_id', user.id)
            .order('scored_at', { ascending: false })
            .limit(5),
        // Open trades for book view
        supabase
            .from('trades')
            .select('*')
            .eq('user_id', user.id)
            .eq('oanda_account_id', accountId)
            .eq('status', 'open'),
    ])

    const todayMeeting = (todayMeetingResult.data || null) as DeskMeeting | null
    const deskState = (deskStateResult.data || null) as DeskState | null
    const recentScores = (scoresResult.data || []) as ProcessScore[]
    const openPositions: OpenPosition[] = (openTradesResult.data || []).map((t: Record<string, unknown>) => ({
        pair: t.pair as string,
        direction: t.direction as string,
        entry_price: Number(t.entry_price) || 0,
        current_pnl: 0,
        stop_loss: t.stop_loss ? Number(t.stop_loss) : null,
        take_profit: t.take_profit ? Number(t.take_profit) : null,
        opened_at: t.created_at as string,
    }))

    const sarahReport = (todayMeeting?.sarah_report || null) as SarahReport | null

    return (
        <div className="max-w-[1500px] mx-auto space-y-6 pb-20 px-4">
            {/* Hero Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 py-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                        The Desk
                        <span className="text-sm font-medium text-neutral-500 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full tracking-normal uppercase">
                            FX Trading Floor
                        </span>
                    </h1>
                    <p className="text-neutral-500 text-sm mt-1">
                        Your virtual JP Morgan desk. Four analysts. One mission. No excuses.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/trade"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-xl shadow-blue-900/30 active:scale-95 group"
                    >
                        <Zap size={18} />
                        New Execution
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Main Desk Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Desk Feed (main content) */}
                <div className="lg:col-span-8">
                    <DeskFeed />
                </div>

                {/* Right: Desk Members, Stats, Book */}
                <div className="lg:col-span-4 space-y-6">
                    <DeskMembers todayMeeting={todayMeeting} />
                    <DeskStats
                        deskState={deskState}
                        todayPnL={stats.todayPnL}
                        sarahReport={sarahReport}
                        recentScores={recentScores}
                    />
                    <DeskBook positions={openPositions} />
                </div>
            </div>
        </div>
    )
}
