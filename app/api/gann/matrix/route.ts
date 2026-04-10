import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCandles as getUnifiedCandles } from '@/lib/data/candle-fetcher'
import { displayToInternalPair } from '@/lib/data/asset-config'
import { calculateGannMatrix, estimateSunriseSunset } from '@/lib/utils/gann-calculator'

/**
 * GET /api/gann/matrix?pair=EUR/USD
 * Fetch W.D. Gann Matrix for a specific pair
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const pair = searchParams.get('pair') || 'EUR/USD'
        const instrument = displayToInternalPair(pair)

        // Fetch H1 candles
        const { data: candles } = await getUnifiedCandles({
            instrument,
            granularity: 'H1',
            count: 300
        })

        if (!candles || candles.length < 20) {
            return NextResponse.json({
                error: 'Insufficient H1 candle data',
                message: 'Need at least 20 H1 candles for Gann Matrix calculation'
            }, { status: 400 })
        }

        // Get current price and recent high/low
        const recentH1 = candles.slice(-20)
        const currentPrice = parseFloat(candles[candles.length - 1].mid.c)
        const highPrice = Math.max(...recentH1.map(c => parseFloat(c.mid.h)))
        const lowPrice = Math.min(...recentH1.map(c => parseFloat(c.mid.l)))

        // NYC coordinates (can be made user-configurable later)
        const NYC_LAT = 40.7128
        const NYC_LON = -74.0060
        const { sunrise, sunset } = estimateSunriseSunset(new Date(), NYC_LAT)

        // Calculate Gann Matrix
        const gannMatrix = calculateGannMatrix(
            currentPrice,
            highPrice,
            lowPrice,
            sunrise,
            sunset,
            NYC_LAT,
            NYC_LON
        )

        return NextResponse.json({
            pair,
            gannMatrix,
            currentPrice,
            highPrice,
            lowPrice,
            location: {
                latitude: NYC_LAT,
                longitude: NYC_LON,
                name: 'New York City'
            }
        })

    } catch (error) {
        console.error('Gann Matrix API error:', error)
        return NextResponse.json(
            { error: 'Failed to calculate Gann Matrix' },
            { status: 500 }
        )
    }
}
