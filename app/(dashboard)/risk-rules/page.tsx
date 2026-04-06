import { getAuthUser } from '@/lib/supabase/server'
import { getRiskRules, seedDefaultRules } from '@/lib/data/risk-rules'
import { redirect } from 'next/navigation'
import { RiskRulesList } from '@/app/(dashboard)/risk/_components/RiskRulesList'
import { ShieldAlert, Info } from 'lucide-react'

export default async function RiskRulesPage() {
    const user = await getAuthUser()
    if (!user) redirect('/login')

    // Seed default rules if none exist
    await seedDefaultRules(user.id)

    const rules = await getRiskRules(user.id)

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-premium-white">Risk Sentinel</h1>
                    <p className="text-neutral-500 mt-2 text-lg">Define the boundaries of your capital preservation strategy.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <ShieldAlert className="text-amber-500" size={18} />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Enforcement Mode: ACTIVE</span>
                </div>
            </div>

            <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2rem] p-4 md:p-8 flex gap-3 md:gap-4 items-start">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                    <Info size={20} />
                </div>
                <div className="space-y-1">
                    <h4 className="font-bold text-premium-white">How validation works</h4>
                    <p className="text-sm text-neutral-400 leading-relaxed">
                        All active rules are checked every time you prepare a trade in the terminal. If a trade violates any &quot;Blocker&quot; rule, the execution button will be disabled. Warnings appear when you are within 20% of a limit.
                    </p>
                </div>
            </div>

            <RiskRulesList initialRules={rules} />
        </div>
    )
}
