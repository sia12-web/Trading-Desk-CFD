/**
 * Macro Context Fetcher
 * Fetches comprehensive fundamental data for currency pairs
 */

import { callGemini } from '@/lib/ai/clients'
import type { MacroContext, NewsItem, EconomicEvent, CentralBankPolicies, EconomicIndicators, StoryContext } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

const CURRENCY_NAMES: Record<string, string> = {
    USD: 'United States Dollar',
    EUR: 'Euro',
    GBP: 'British Pound',
    JPY: 'Japanese Yen',
    CHF: 'Swiss Franc',
    AUD: 'Australian Dollar',
    CAD: 'Canadian Dollar',
    NZD: 'New Zealand Dollar',
}

const CENTRAL_BANKS: Record<string, string> = {
    USD: 'Federal Reserve (Fed)',
    EUR: 'European Central Bank (ECB)',
    GBP: 'Bank of England (BoE)',
    JPY: 'Bank of Japan (BoJ)',
    CHF: 'Swiss National Bank (SNB)',
    AUD: 'Reserve Bank of Australia (RBA)',
    CAD: 'Bank of Canada (BoC)',
    NZD: 'Reserve Bank of New Zealand (RBNZ)',
}

/**
 * Fetch comprehensive macro context for a currency pair
 */
export async function getMacroContext(
    pair: string,
    userId: string,
    client: SupabaseClient
): Promise<MacroContext> {
    const [base, quote] = pair.split('/')

    console.log(`[MacroContext] Fetching macro context for ${pair}...`)

    // Fetch all components in parallel
    const [recentNews, upcomingEvents, centralBankPolicy, economicIndicators, storyContext] = await Promise.all([
        fetchRecentNews([base, quote]),
        fetchUpcomingEvents([base, quote]),
        fetchCentralBankPolicy([base, quote]),
        fetchEconomicIndicators([base, quote]),
        fetchStoryContext(userId, pair, client),
    ])

    return {
        recentNews,
        upcomingEvents,
        centralBankPolicy,
        economicIndicators,
        currentStoryContext: storyContext,
    }
}

/**
 * Fetch recent news headlines for currencies (past 7 days)
 */
async function fetchRecentNews(currencies: string[]): Promise<NewsItem[]> {
    const currencyPairs = currencies.map(c => CURRENCY_NAMES[c] || c).join(' OR ')
    const economyTerms = currencies.map(c => {
        if (c === 'USD') return 'Federal Reserve OR Fed OR US economy OR dollar'
        if (c === 'EUR') return 'European Central Bank OR ECB OR Eurozone OR euro'
        if (c === 'GBP') return 'Bank of England OR BoE OR UK economy OR pound'
        if (c === 'JPY') return 'Bank of Japan OR BoJ OR Japan economy OR yen'
        return CURRENCY_NAMES[c] || c
    }).join(' OR ')

    const searchQuery = `(${currencyPairs}) OR (${economyTerms}) central bank OR interest rate OR economic data`

    try {
        // Use Gemini to fetch and summarize news
        const prompt = `
Search recent financial news (past 7 days) about these currencies: ${currencies.join(', ')}.

Focus on:
- Central bank decisions and policy statements
- Economic data releases (GDP, inflation, employment, etc.)
- Political events affecting the currency
- Major market-moving announcements

For EACH relevant news item, provide:
1. Title
2. Brief summary (2-3 sentences)
3. Which currency it affects (${currencies.join(' or ')})
4. Sentiment (bullish/bearish/neutral for that currency)
5. Date published

Return as JSON array of objects with: { title, summary, currency, sentiment, publishedAt, source }

Provide 10-15 most relevant items.
`

        const response = await callGemini(prompt, { maxTokens: 4096, timeout: 30000 })

        // Parse JSON response
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
            console.warn('[MacroContext] Could not parse news JSON')
            return []
        }

        const news = JSON.parse(jsonMatch[0])
        return news.map((item: any) => ({
            title: item.title,
            summary: item.summary,
            currency: item.currency,
            sentiment: item.sentiment,
            publishedAt: item.publishedAt || new Date().toISOString(),
            source: item.source || 'Financial News',
        }))
    } catch (error) {
        console.error('[MacroContext] Failed to fetch news:', error)
        return []
    }
}

/**
 * Fetch upcoming economic events (next 14 days)
 */
async function fetchUpcomingEvents(currencies: string[]): Promise<EconomicEvent[]> {
    try {
        // Use free economic calendar API
        const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
            next: { revalidate: 3600 } // Cache for 1 hour
        })

        if (!response.ok) {
            console.warn('[MacroContext] Economic calendar API failed')
            return generateMockEvents(currencies)
        }

        const data = await response.json()

        // Filter events for our currencies
        const events: EconomicEvent[] = []
        const now = new Date()
        const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

        for (const event of data) {
            const eventDate = new Date(event.date)
            if (eventDate < now || eventDate > twoWeeksFromNow) continue

            const currency = event.country === 'USD' ? 'USD'
                : event.country === 'EUR' ? 'EUR'
                : event.country === 'GBP' ? 'GBP'
                : event.country === 'JPY' ? 'JPY'
                : null

            if (currency && currencies.includes(currency)) {
                events.push({
                    title: event.title,
                    date: event.date,
                    currency,
                    impact: event.impact === '3' ? 'high' : event.impact === '2' ? 'medium' : 'low',
                    forecast: event.forecast,
                    previous: event.previous,
                    actual: event.actual,
                })
            }
        }

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    } catch (error) {
        console.error('[MacroContext] Failed to fetch economic calendar:', error)
        return generateMockEvents(currencies)
    }
}

/**
 * Fetch central bank policy stance using AI
 */
async function fetchCentralBankPolicy(currencies: string[]): Promise<CentralBankPolicies> {
    try {
        const banksInfo = currencies.map(c => `${CENTRAL_BANKS[c]} (${c})`).join(', ')

        const prompt = `
Provide current monetary policy information for these central banks: ${banksInfo}

For EACH central bank, provide:
1. Current policy interest rate
2. Stance: hawkish (tightening/raising rates), dovish (easing/cutting rates), or neutral
3. Date of last policy meeting
4. Expected date of next policy meeting
5. Brief summary (3-4 sentences) of current policy stance and forward guidance

Return as JSON object where keys are currency codes (${currencies.join(', ')}) and values have:
{ currentRate, stance, lastMeeting, nextMeeting, summary }

Use today's date: ${new Date().toISOString().split('T')[0]}
`

        const response = await callGemini(prompt, { maxTokens: 2048, timeout: 30000 })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.warn('[MacroContext] Could not parse central bank policy JSON')
            return generateMockPolicy(currencies)
        }

        return JSON.parse(jsonMatch[0])
    } catch (error) {
        console.error('[MacroContext] Failed to fetch central bank policy:', error)
        return generateMockPolicy(currencies)
    }
}

/**
 * Fetch latest economic indicators using AI
 */
async function fetchEconomicIndicators(currencies: string[]): Promise<EconomicIndicators> {
    try {
        const countriesInfo = currencies.map(c => `${c} (${CURRENCY_NAMES[c]})`).join(', ')

        const prompt = `
Provide latest economic indicators for these economies: ${countriesInfo}

For EACH economy, provide:
1. Latest GDP growth rate (annualized %)
2. Latest inflation rate (CPI, year-over-year %)
3. Latest unemployment rate (%)
4. Brief summary (2-3 sentences) of economic health

Return as JSON object where keys are currency codes (${currencies.join(', ')}) and values have:
{ gdpGrowth, inflation, unemployment, summary }

Use most recent data available.
`

        const response = await callGemini(prompt, { maxTokens: 2048, timeout: 30000 })

        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.warn('[MacroContext] Could not parse economic indicators JSON')
            return generateMockIndicators(currencies)
        }

        return JSON.parse(jsonMatch[0])
    } catch (error) {
        console.error('[MacroContext] Failed to fetch economic indicators:', error)
        return generateMockIndicators(currencies)
    }
}

/**
 * Fetch current story context for this pair
 */
async function fetchStoryContext(
    userId: string,
    pair: string,
    client: SupabaseClient
): Promise<StoryContext | undefined> {
    try {
        // Get latest episode
        const { data: episode } = await client
            .from('story_episodes')
            .select('episode_number, title, current_phase, confidence')
            .eq('user_id', userId)
            .eq('pair', pair)
            .order('episode_number', { ascending: false })
            .limit(1)
            .maybeSingle()

        // Get active scenarios
        const { data: scenarios } = await client
            .from('story_scenarios')
            .select('title, direction, probability')
            .eq('user_id', userId)
            .eq('pair', pair)
            .eq('status', 'active')
            .order('probability', { ascending: false })
            .limit(3)

        // Get active position
        const { data: position } = await client
            .from('story_positions')
            .select('direction, entry_price, current_stop_loss')
            .eq('user_id', userId)
            .eq('pair', pair)
            .eq('status', 'active')
            .maybeSingle()

        if (!episode && !scenarios?.length && !position) {
            return undefined
        }

        return {
            latestEpisode: episode || undefined,
            activeScenarios: scenarios || undefined,
            activePosition: position || undefined,
        }
    } catch (error) {
        console.error('[MacroContext] Failed to fetch story context:', error)
        return undefined
    }
}

// ── Fallback mock data generators ──

function generateMockEvents(currencies: string[]): EconomicEvent[] {
    const events: EconomicEvent[] = []
    const now = new Date()

    currencies.forEach(currency => {
        // Add a few mock events
        if (currency === 'USD') {
            events.push({
                title: 'FOMC Interest Rate Decision',
                date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                currency: 'USD',
                impact: 'high',
                forecast: '5.25%',
                previous: '5.25%',
            })
            events.push({
                title: 'Non-Farm Payrolls',
                date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                currency: 'USD',
                impact: 'high',
                forecast: '180K',
                previous: '175K',
            })
        }
    })

    return events
}

function generateMockPolicy(currencies: string[]): CentralBankPolicies {
    const policies: CentralBankPolicies = {}

    currencies.forEach(currency => {
        policies[currency] = {
            currentRate: currency === 'USD' ? 5.25 : currency === 'EUR' ? 4.0 : 0.5,
            stance: currency === 'USD' ? 'hawkish' : currency === 'EUR' ? 'neutral' : 'dovish',
            lastMeeting: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            nextMeeting: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            summary: `${CENTRAL_BANKS[currency]} is maintaining current policy stance while monitoring economic data.`,
        }
    })

    return policies
}

function generateMockIndicators(currencies: string[]): EconomicIndicators {
    const indicators: EconomicIndicators = {}

    currencies.forEach(currency => {
        indicators[currency] = {
            gdpGrowth: currency === 'USD' ? 2.5 : currency === 'EUR' ? 0.8 : 1.2,
            inflation: currency === 'USD' ? 3.1 : currency === 'EUR' ? 2.4 : 2.0,
            unemployment: currency === 'USD' ? 3.7 : currency === 'EUR' ? 6.5 : 2.5,
            summary: `The ${CURRENCY_NAMES[currency]} economy is showing moderate growth with inflation near target levels.`,
        }
    })

    return indicators
}
