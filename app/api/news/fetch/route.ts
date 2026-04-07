import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchForexFactoryCalendar, getUpcomingEventsForPair } from '@/lib/news/forex-factory-client'
import { fetchForexNews } from '@/lib/news/forex-news-client'
import { isCrypto } from '@/lib/story/asset-config'
import { getCryptoMarketContext, formatCryptoMarketContext } from '@/lib/crypto/market-context'

export const runtime = 'nodejs'

const newsCache = new Map<string, { timestamp: number, data: any }>()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour caching for news/sentiment

/**
 * GET: Fetch news data (calendar + headlines + sentiment)
 * Query params:
 *   - pair: Currency pair (optional, e.g., EUR/USD)
 *   - hoursAhead: How many hours ahead to show events (default: 48)
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const pair = searchParams.get('pair') || 'EUR/USD'
        const hoursAhead = Math.max(1, Math.min(168, parseInt(searchParams.get('hoursAhead') || '48') || 48))
        
        const cacheKey = `${pair}-${hoursAhead}`
        const cached = newsCache.get(cacheKey)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log(`⚡ Returning cached news for ${pair}`)
            return NextResponse.json(cached.data)
        }

        console.log(`📰 Fetching news for ${pair}, ${hoursAhead}h ahead...`)

        // ── CRYPTO PATH: skip forex calendar, use crypto market context ──
        if (isCrypto(pair)) {
            const cryptoContext = await getCryptoMarketContext()
            const headlines = await fetchForexNews(10) // General financial headlines still useful

            const cryptoEvents = []
            if (cryptoContext) {
                // Synthesize crypto "calendar" items from market data
                cryptoEvents.push({
                    title: `Fear & Greed Index: ${cryptoContext.fearGreedIndex} (${cryptoContext.fearGreedLabel})`,
                    currency: 'CRYPTO',
                    country: 'Global',
                    date: new Date().toISOString(),
                    impact: cryptoContext.fearGreedIndex <= 25 || cryptoContext.fearGreedIndex >= 75 ? 'High' : 'Medium',
                    forecast: null,
                    previous: null,
                    actual: `${cryptoContext.fearGreedIndex}`,
                    minutesUntil: 0,
                    hoursUntil: '0.0',
                })
                cryptoEvents.push({
                    title: `BTC Dominance: ${cryptoContext.btcDominance.toFixed(1)}%`,
                    currency: 'BTC',
                    country: 'Global',
                    date: new Date().toISOString(),
                    impact: 'Medium',
                    forecast: null,
                    previous: null,
                    actual: `${cryptoContext.btcDominance.toFixed(1)}%`,
                    minutesUntil: 0,
                    hoursUntil: '0.0',
                })
                cryptoEvents.push({
                    title: `Total Crypto Market Cap: $${(cryptoContext.totalMarketCap / 1e9).toFixed(0)}B (${cryptoContext.totalMarketCapChange24h > 0 ? '+' : ''}${cryptoContext.totalMarketCapChange24h.toFixed(1)}% 24h)`,
                    currency: 'CRYPTO',
                    country: 'Global',
                    date: new Date().toISOString(),
                    impact: Math.abs(cryptoContext.totalMarketCapChange24h) > 5 ? 'High' : 'Low',
                    forecast: null,
                    previous: null,
                    actual: `$${(cryptoContext.totalMarketCap / 1e9).toFixed(0)}B`,
                    minutesUntil: 0,
                    hoursUntil: '0.0',
                })
                cryptoEvents.push({
                    title: `BTC Price: $${cryptoContext.btcPrice.toLocaleString()} (${cryptoContext.btcChange24h > 0 ? '+' : ''}${cryptoContext.btcChange24h.toFixed(1)}% 24h)`,
                    currency: 'BTC',
                    country: 'Global',
                    date: new Date().toISOString(),
                    impact: Math.abs(cryptoContext.btcChange24h) > 5 ? 'High' : 'Medium',
                    forecast: null,
                    previous: null,
                    actual: `$${cryptoContext.btcPrice.toLocaleString()}`,
                    minutesUntil: 0,
                    hoursUntil: '0.0',
                })
            }

            console.log(`✅ Crypto news fetched: ${cryptoEvents.length} market items, ${headlines.length} headlines (Pair: ${pair})`)

            const finalResult = {
                success: true,
                pair,
                timestamp: new Date().toISOString(),
                calendar: {
                    allEvents: cryptoEvents,
                    pairEvents: cryptoEvents,
                    totalEvents: cryptoEvents.length,
                    highImpact: cryptoEvents.filter(e => e.impact === 'High').length,
                    mediumImpact: cryptoEvents.filter(e => e.impact === 'Medium').length,
                },
                news: {
                    headlines,
                    totalHeadlines: headlines.length,
                },
                cryptoContext: cryptoContext ? formatCryptoMarketContext(cryptoContext) : null,
            }

            newsCache.set(cacheKey, { timestamp: Date.now(), data: finalResult })
            return NextResponse.json(finalResult)
        }

        // ── FOREX / INDEX PATH ──

        // Fetch economic calendar
        const allEvents = await fetchForexFactoryCalendar()
        const now = new Date()
        const cutoffTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

        // Filter events for the time window
        let upcomingEvents = allEvents.filter(event => {
            const eventTime = new Date(event.date)
            return eventTime >= now && eventTime <= cutoffTime
        })

        // Filter by pair currencies
        if (pair !== 'GLOBAL') {
            const currencies = pair.split('/').map(c => c.trim())
            upcomingEvents = upcomingEvents.filter(event =>
                currencies.includes(event.currency)
            )
        }

        const formattedEvents = upcomingEvents.map(event => {
            const eventTime = new Date(event.date)
            const minutesUntil = Math.floor((eventTime.getTime() - now.getTime()) / 60000)

            return {
                title: event.title,
                currency: event.currency,
                country: event.country,
                date: event.date,
                impact: event.impact,
                forecast: event.forecast,
                previous: event.previous,
                actual: event.actual,
                minutesUntil,
                hoursUntil: (minutesUntil / 60).toFixed(1)
            }
        })

        // Get events specific to the selected pair
        const pairEvents = pair === 'GLOBAL' ? [] : await getUpcomingEventsForPair(pair, hoursAhead)

        // Fetch recent news headlines
        const headlines = await fetchForexNews(20)

        console.log(`✅ News fetched: ${formattedEvents.length} events, ${headlines.length} headlines (Pair: ${pair})`)

        const finalResult = {
            success: true,
            pair,
            timestamp: new Date().toISOString(),
            calendar: {
                allEvents: formattedEvents,
                pairEvents,
                totalEvents: formattedEvents.length,
                highImpact: formattedEvents.filter(e => e.impact === 'High').length,
                mediumImpact: formattedEvents.filter(e => e.impact === 'Medium').length
            },
            news: {
                headlines,
                totalHeadlines: headlines.length
            }
        }

        // Save to cache
        newsCache.set(cacheKey, { timestamp: Date.now(), data: finalResult })

        return NextResponse.json(finalResult)
    } catch (error: any) {
        console.error('❌ News fetch error:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch news'
            },
            { status: 500 }
        )
    }
}
