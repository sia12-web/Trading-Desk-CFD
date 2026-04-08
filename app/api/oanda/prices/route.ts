import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getKrakenPrices } from '@/lib/kraken/client'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const instruments = searchParams.get('instruments')?.split(',')

        if (!instruments || instruments.length === 0) {
            return NextResponse.json({ error: 'No instruments specified' }, { status: 400 })
        }

        const prices = await getKrakenPrices(instruments)
        return NextResponse.json({ data: prices })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
