import { getAuthUser } from '@/lib/supabase/server'
import { getAccountInstruments, getAccountSummary } from '@/lib/oanda/client'
import { redirect } from 'next/navigation'
import { TradeOrderForm } from '@/app/(dashboard)/trade/_components/TradeOrderForm'
import { ALLOWED_INSTRUMENTS } from '@/lib/constants/instruments'

export default async function TradePage() {
    const user = await getAuthUser()
    if (!user) redirect('/login')

    const [instrumentsRes, accountRes] = await Promise.all([
        getAccountInstruments(),
        getAccountSummary()
    ])

    const instruments = instrumentsRes.data || []
    const account = accountRes.data

    const filteredInstruments: any[] = [
        ...instruments.filter(i => ALLOWED_INSTRUMENTS.includes(i.name as any)),
        // Add famous cryptos from constants with appropriate precision
        ...ALLOWED_INSTRUMENTS.filter(i => i.startsWith('CRYPTO_')).map(i => {
            const base = i.replace('CRYPTO_', '').split('_')[0]
            const precision = base === 'SHIB' ? 8 : (base === 'DOGE' || base === 'XRP' || base === 'ADA') ? 5 : 2
            
            return {
                name: i,
                displayName: i.replace('CRYPTO_', '').replace('_', '/'),
                type: 'CRYPTO',
                displayPrecision: precision,
                pipLocation: 0,
                tradeUnitsPrecision: 8,
                minimumTradeSize: '0.00000001',
                maximumTrailingStopDistance: '10000',
                minimumTrailingStopDistance: '0.1',
                maximumPositionSize: '1000000',
                maximumOrderUnits: '1000000',
                marginRate: '1.0'
            }
        })
    ]

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-premium-white">Execution Terminal</h1>
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
