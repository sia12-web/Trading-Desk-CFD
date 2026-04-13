import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getKrakenPrices } from '@/lib/kraken/client'
import { getCurrentPrices as getOandaPrices } from '@/lib/oanda/client'
import { isCryptoPair } from '@/lib/constants/instruments'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const instrumentsString = searchParams.get('instruments')
        
        if (!instrumentsString) {
            return NextResponse.json({ error: 'No instruments specified' }, { status: 400 })
        }

        const instruments = instrumentsString.split(',').filter(Boolean)

        const cryptoInstruments = instruments.filter(isCryptoPair)
        const forexInstruments = instruments.filter(i => !isCryptoPair(i))

        let allPrices: any[] = []

        if (cryptoInstruments.length > 0) {
            const cryptoPrices = await getKrakenPrices(cryptoInstruments)
            allPrices = [...allPrices, ...cryptoPrices]
        }

        if (forexInstruments.length > 0) {
            const { data: oandaPrices } = await getOandaPrices(forexInstruments)
            if (oandaPrices) {
                allPrices = [...allPrices, ...oandaPrices]
            }
        }

        return NextResponse.json({ prices: allPrices })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
