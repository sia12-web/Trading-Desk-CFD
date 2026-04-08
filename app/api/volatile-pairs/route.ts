import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/oanda/client'

const INSTRUMENTS = [
    // Forex
    { instrument: 'EUR_USD', name: 'EUR/USD', type: 'forex' as const },
    { instrument: 'USD_JPY', name: 'USD/JPY', type: 'forex' as const },
    { instrument: 'GBP_USD', name: 'GBP/USD', type: 'forex' as const },
    { instrument: 'AUD_USD', name: 'AUD/USD', type: 'forex' as const },
    { instrument: 'USD_CAD', name: 'USD/CAD', type: 'forex' as const },
    { instrument: 'USD_CHF', name: 'USD/CHF', type: 'forex' as const },
    { instrument: 'NZD_USD', name: 'NZD/USD', type: 'forex' as const },
    { instrument: 'EUR_GBP', name: 'EUR/GBP', type: 'forex' as const },
    { instrument: 'EUR_JPY', name: 'EUR/JPY', type: 'forex' as const },
    { instrument: 'GBP_JPY', name: 'GBP/JPY', type: 'forex' as const },
    { instrument: 'AUD_JPY', name: 'AUD/JPY', type: 'forex' as const },
    { instrument: 'EUR_AUD', name: 'EUR/AUD', type: 'forex' as const },
    { instrument: 'GBP_AUD', name: 'GBP/AUD', type: 'forex' as const },
    { instrument: 'XAU_USD', name: 'Gold', type: 'forex' as const },
    // CFD Indices
    { instrument: 'NAS100_USD', name: 'Nasdaq 100', type: 'index' as const },
    { instrument: 'SPX500_USD', name: 'S&P 500', type: 'index' as const },
    { instrument: 'US30_USD', name: 'Dow Jones 30', type: 'index' as const },
    { instrument: 'DE30_EUR', name: 'DAX 40', type: 'index' as const },
    // Crypto (CoinGecko IDs)
    { instrument: 'bitcoin', name: 'BTC/USD', type: 'crypto' as const, coinGeckoId: 'bitcoin' },
    { instrument: 'ethereum', name: 'ETH/USD', type: 'crypto' as const, coinGeckoId: 'ethereum' },
    { instrument: 'solana', name: 'SOL/USD', type: 'crypto' as const, coinGeckoId: 'solana' },
    { instrument: 'ripple', name: 'XRP/USD', type: 'crypto' as const, coinGeckoId: 'ripple' },
    { instrument: 'dogecoin', name: 'DOGE/USD', type: 'crypto' as const, coinGeckoId: 'dogecoin' },
    { instrument: 'cardano', name: 'ADA/USD', type: 'crypto' as const, coinGeckoId: 'cardano' },
]

interface PairVolatility {
    instrument: string
    name: string
    type: 'forex' | 'index' | 'crypto'
    volatility: number // Percentage: (High-Low)/Close * 100
    price: number
    change1d: number
}

export async function GET() {
    try {
        const results: PairVolatility[] = []

        for (const item of INSTRUMENTS) {
            try {
                let data: PairVolatility | null = null

                if (item.type === 'crypto') {
                    data = await fetchCryptoVolatility((item as any).coinGeckoId, item.name, item.type)
                } else {
                    data = await fetchPairVolatility(item.instrument, item.name, item.type)
                }

                if (data) results.push(data)
                await new Promise(resolve => setTimeout(resolve, 100))
            } catch (err) {
                console.error(`Failed to fetch volatility for ${item.name}:`, err)
            }
        }

        // Sort by volatility descending and take top 8
        const topVolatile = results
            .sort((a, b) => b.volatility - a.volatility)
            .slice(0, 8)

        return NextResponse.json({
            pairs: topVolatile,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Volatile pairs API error:', error)
        return NextResponse.json({ error: 'Failed to fetch volatile pairs' }, { status: 500 })
    }
}

async function fetchPairVolatility(instrument: string, name: string, type: 'forex' | 'index'): Promise<PairVolatility | null> {
    const { data: candles, error } = await getCandles({
        instrument,
        granularity: 'D',
        count: 2
    })

    if (error || !candles || candles.length < 1) return null

    const latest = candles[candles.length - 1]
    const high = parseFloat(latest.mid.h)
    const low = parseFloat(latest.mid.l)
    const close = parseFloat(latest.mid.c)
    const open = parseFloat(latest.mid.o)

    // Calculate daily range as percentage of close
    const volatility = ((high - low) / close) * 100
    const change1d = ((close - open) / open) * 100

    return {
        instrument,
        name,
        type,
        volatility,
        price: close,
        change1d
    }
}

async function fetchCryptoVolatility(coinGeckoId: string, name: string, type: 'crypto'): Promise<PairVolatility | null> {
    try {
        // CoinGecko API: market_chart endpoint for OHLC data (last 1 day)
        const url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/ohlc?vs_currency=usd&days=1`
        const response = await fetch(url, {
            headers: process.env.COINGECKO_API_KEY
                ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
                : {}
        })

        if (!response.ok) return null

        const data = await response.json()

        // OHLC format: [[timestamp, open, high, low, close], ...]
        if (!data || data.length < 1) return null

        const latest = data[data.length - 1]
        const [, open, high, low, close] = latest

        // Calculate daily range as percentage of close
        const volatility = ((high - low) / close) * 100
        const change1d = ((close - open) / open) * 100

        return {
            instrument: coinGeckoId,
            name,
            type,
            volatility,
            price: close,
            change1d
        }
    } catch (error) {
        console.error(`CoinGecko API error for ${coinGeckoId}:`, error)
        return null
    }
}
