/**
 * Crypto Market Context — fetches BTC dominance, Fear & Greed, and coin-specific data.
 * Uses CoinGecko free tier (no API key) + alternative.me Fear & Greed API.
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const FEAR_GREED_API = 'https://api.alternative.me/fng/'

export interface CryptoMarketContext {
    fearGreedIndex: number
    fearGreedLabel: string
    btcDominance: number
    btcDominanceChange24h: number
    totalMarketCap: number
    totalMarketCapChange24h: number
    total24hVolume: number
    btcPrice: number
    btcChange24h: number
}

/**
 * Fetch global crypto market context: BTC dominance, Fear & Greed, total market cap.
 */
export async function getCryptoMarketContext(): Promise<CryptoMarketContext | null> {
    try {
        const [globalRes, fngRes] = await Promise.all([
            fetch(`${COINGECKO_BASE}/global`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 300 } // Cache 5 min
            }),
            fetch(`${FEAR_GREED_API}?limit=1`, {
                next: { revalidate: 3600 } // Cache 1 hour
            }),
        ])

        let btcDominance = 0
        let btcDominanceChange24h = 0
        let totalMarketCap = 0
        let totalMarketCapChange24h = 0
        let total24hVolume = 0
        let btcPrice = 0
        let btcChange24h = 0

        if (globalRes.ok) {
            const globalData = await globalRes.json()
            const g = globalData.data
            btcDominance = g?.market_cap_percentage?.btc ?? 0
            totalMarketCap = g?.total_market_cap?.usd ?? 0
            totalMarketCapChange24h = g?.market_cap_change_percentage_24h_usd ?? 0
            total24hVolume = g?.total_volume?.usd ?? 0
        }

        // Get BTC price separately for altcoin correlation
        try {
            const btcRes = await fetch(`${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 60 }
            })
            if (btcRes.ok) {
                const btcData = await btcRes.json()
                btcPrice = btcData?.bitcoin?.usd ?? 0
                btcChange24h = btcData?.bitcoin?.usd_24h_change ?? 0
            }
        } catch {
            // Non-critical
        }

        let fearGreedIndex = 50
        let fearGreedLabel = 'Neutral'

        if (fngRes.ok) {
            const fngData = await fngRes.json()
            const latest = fngData?.data?.[0]
            if (latest) {
                fearGreedIndex = parseInt(latest.value) || 50
                fearGreedLabel = latest.value_classification || 'Neutral'
            }
        }

        return {
            fearGreedIndex,
            fearGreedLabel,
            btcDominance,
            btcDominanceChange24h,
            totalMarketCap,
            totalMarketCapChange24h,
            total24hVolume,
            btcPrice,
            btcChange24h,
        }
    } catch (error) {
        console.error('[crypto-market-context] Error fetching:', error)
        return null
    }
}

/**
 * Format crypto market context into a human-readable summary for AI prompts.
 */
export function formatCryptoMarketContext(ctx: CryptoMarketContext): string {
    const mcapB = (ctx.totalMarketCap / 1e9).toFixed(0)
    const volB = (ctx.total24hVolume / 1e9).toFixed(0)

    return `**Crypto Market Overview:**
- Fear & Greed Index: ${ctx.fearGreedIndex}/100 (${ctx.fearGreedLabel})
- BTC Dominance: ${ctx.btcDominance.toFixed(1)}%
- Total Market Cap: $${mcapB}B (${ctx.totalMarketCapChange24h > 0 ? '+' : ''}${ctx.totalMarketCapChange24h.toFixed(1)}% 24h)
- 24h Volume: $${volB}B
- BTC Price: $${ctx.btcPrice.toLocaleString()} (${ctx.btcChange24h > 0 ? '+' : ''}${ctx.btcChange24h.toFixed(1)}% 24h)`
}
