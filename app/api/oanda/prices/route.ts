import { createClient } from '@/lib/supabase/server'
import { getCurrentPrices } from '@/lib/oanda/client'
import { getCoinbasePrices } from '@/lib/coinbase/client'
import { isCryptoPair } from '@/lib/constants/instruments'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instruments = searchParams.get('instruments')

    if (!instruments) {
        return NextResponse.json({ error: 'Missing instruments parameter' }, { status: 400 })
    }

    // Split crypto vs non-crypto instruments
    const allInstruments = instruments.split(',').filter(Boolean)
    const oandaInstruments = allInstruments.filter(i => !isCryptoPair(i))
    const cryptoInstruments = allInstruments.filter(i => isCryptoPair(i))

    // Fetch from both brokers in parallel
    const [oandaResult, coinbasePrices] = await Promise.all([
        oandaInstruments.length > 0
            ? getCurrentPrices(oandaInstruments)
            : { data: [], error: null },
        cryptoInstruments.length > 0
            ? getCoinbasePrices(cryptoInstruments)
            : [],
    ])

    if (oandaResult.error && oandaInstruments.length > 0) {
        return NextResponse.json({ error: oandaResult.error }, { status: 500 })
    }

    const prices = [
        ...(oandaResult.data || []),
        ...coinbasePrices,
    ]

    return NextResponse.json({ prices })
}
