/**
 * Fundamental Analysis Session Types
 */

export interface FundamentalSession {
    id: string
    user_id: string
    pair: string
    title: string | null
    status: 'active' | 'archived'
    conclusion: string | null
    created_episode_id: string | null
    created_at: string
    updated_at: string
}

export interface FundamentalMessage {
    id: string
    session_id: string
    role: 'user' | 'assistant'
    content: string
    macro_context: MacroContext | null
    created_at: string
}

export interface MacroContext {
    recentNews: NewsItem[]
    upcomingEvents: EconomicEvent[]
    centralBankPolicy: CentralBankPolicies
    economicIndicators: EconomicIndicators
    currentStoryContext?: StoryContext
}

export interface NewsItem {
    title: string
    summary: string
    url?: string
    publishedAt: string
    source: string
    sentiment?: 'bullish' | 'bearish' | 'neutral'
    currency: string // USD, EUR, etc.
}

export interface EconomicEvent {
    title: string
    date: string
    currency: string
    impact: 'high' | 'medium' | 'low'
    forecast?: string
    previous?: string
    actual?: string
}

export interface CentralBankPolicies {
    [currency: string]: {
        currentRate: number
        stance: 'hawkish' | 'dovish' | 'neutral'
        lastMeeting: string
        nextMeeting: string
        summary: string
    }
}

export interface EconomicIndicators {
    [currency: string]: {
        gdpGrowth?: number
        inflation?: number
        unemployment?: number
        summary: string
    }
}

export interface StoryContext {
    latestEpisode?: {
        episode_number: number
        title: string
        current_phase: string
        confidence: number
    }
    activeScenarios?: Array<{
        title: string
        direction: string
        probability: number
    }>
    activePosition?: {
        direction: string
        entry_price: number
        current_stop_loss: number
    }
}
