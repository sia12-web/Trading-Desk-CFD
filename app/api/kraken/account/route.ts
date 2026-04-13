import { NextResponse } from 'next/server'
import { getAccountBalance, getTradeBalance, getKrakenPrices } from '@/lib/kraken/client'

export async function GET() {
    try {
        const balances = await getAccountBalance()
        const tradeBalance = await getTradeBalance()

        // Filter assets with balance > 0
        const heldAssets = Object.entries(balances)
            .filter(([_, amount]) => parseFloat(amount as string) > 0)
            .map(([asset]) => {
                // Map Kraken internal names back to our instrument format
                // Kraken uses X- prefix for many assets and Z- prefix for fiat
                let symbol = asset
                if (symbol.startsWith('X') && symbol.length > 3) symbol = symbol.substring(1)
                if (symbol.startsWith('Z') && symbol.length > 3) symbol = symbol.substring(1)
                
                // Specific common overrides
                if (symbol === 'XBT') symbol = 'BTC'
                if (symbol === 'XDG') symbol = 'DOGE'
                
                return { asset, symbol }
            })

        // Fetch prices for any crypto assets held (excluding USD itself)
        const cryptoAssets = heldAssets.filter(a => a.symbol !== 'USD')
        const instruments = cryptoAssets.map(a => `CRYPTO_${a.symbol}_USD`)
        
        let prices: any[] = []
        if (instruments.length > 0) {
            prices = await getKrakenPrices(instruments)
        }

        return NextResponse.json({
            balances,
            tradeBalance,
            heldAssets: heldAssets.map(a => {
                const priceData = prices.find(p => p.instrument === `CRYPTO_${a.symbol}_USD`)
                return {
                    ...a,
                    balance: parseFloat(balances[a.asset]),
                    price: priceData ? parseFloat(priceData.asks[0].price) : null,
                    usdValue: priceData ? parseFloat(balances[a.asset]) * parseFloat(priceData.asks[0].price) : (a.symbol === 'USD' ? parseFloat(balances[a.asset]) : 0)
                }
            })
        })
    } catch (error: any) {
        console.error('[Kraken Account API] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch Kraken account data' },
            { status: 500 }
        )
    }
}
