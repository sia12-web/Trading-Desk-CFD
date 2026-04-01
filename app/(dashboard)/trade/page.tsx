import { getAuthUser } from '@/lib/supabase/server'
import { getAccountInstruments, getAccountSummary } from '@/lib/oanda/client'
import { redirect } from 'next/navigation'
import { TradeOrderForm } from '@/app/(dashboard)/trade/_components/TradeOrderForm'
import { Activity } from 'lucide-react'

export default async function TradePage() {
    const user = await getAuthUser()
    if (!user) redirect('/login')

    const { data: instruments = [] } = await getAccountInstruments()
    const { data: account } = await getAccountSummary()

    // Full list synced with Story section instruments
    const ALLOWED_INSTRUMENTS = [
        'EUR_USD', 'GBP_USD', 'USD_JPY', 'EUR_GBP', 'AUD_USD',
        'USD_CAD', 'NZD_USD', 'EUR_JPY', 'USD_CHF', 'GBP_JPY',
        'GBP_AUD', 'EUR_AUD', 'AUD_JPY', 'NZD_JPY', 'USD_TRY', 'XAU_USD',
        'NAS100_USD', 'SPX500_USD', 'US30_USD', 'DE30_EUR'
    ]
    const filteredInstruments = instruments.filter(i => ALLOWED_INSTRUMENTS.includes(i.name))

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-premium-white">Execution Terminal</h1>
                    <p className="text-neutral-500 mt-2 text-lg">Precision entry with integrated risk enforcement.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Pricing: LIVE POLLING</span>
                </div>
            </div>

            <TradeOrderForm instruments={filteredInstruments} accountInfo={account} />
        </div>
    )
}
