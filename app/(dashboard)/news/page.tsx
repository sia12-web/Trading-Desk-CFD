'use client'

import React, { useState, useEffect } from 'react'
import { Newspaper, Calendar, TrendingUp, TrendingDown, AlertTriangle, Clock, Filter, RefreshCw, ExternalLink } from 'lucide-react'

interface NewsEvent {
    title: string
    currency: string
    country: string
    date: string
    impact: string
    forecast: string
    previous: string
    actual?: string
    minutesUntil: number
    hoursUntil: string
}

interface NewsHeadline {
    title: string
    description: string
    source: string
    publishedAt: string
    url: string
}

interface NewsSentiment {
    overall: string
    usdBias: string
    eurBias?: string
    summary: string
    confidence: number
    keyThemes: string[]
}

const FOREX_PAIRS = [
    'GLOBAL', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
    'AUD/USD', 'USD/CAD', 'NZD/USD'
]

export default function NewsPage() {
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [selectedPair, setSelectedPair] = useState('GLOBAL')
    const [hoursAhead, setHoursAhead] = useState(48)
    const [impactFilter, setImpactFilter] = useState<string | null>(null)

    const [allEvents, setAllEvents] = useState<NewsEvent[]>([])
    const [pairEvents, setPairEvents] = useState<any[]>([])
    const [headlines, setHeadlines] = useState<NewsHeadline[]>([])
    const [sentiment, setSentiment] = useState<NewsSentiment | null>(null)

    useEffect(() => {
        fetchNews()
    }, [selectedPair, hoursAhead])

    const fetchNews = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/news/fetch?pair=${selectedPair}&hoursAhead=${hoursAhead}`)
            const data = await response.json()

            if (data.success) {
                setAllEvents(data.calendar.allEvents)
                setPairEvents(data.calendar.pairEvents)
                setHeadlines(data.news.headlines)
                setSentiment(data.news.sentiment)
            }
        } catch (error) {
            console.error('Failed to fetch news:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchNews()
    }

    const filteredEvents = impactFilter
        ? allEvents.filter(e => e.impact === impactFilter)
        : allEvents

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'High': return 'text-red-400 bg-red-500/20 border-red-500'
            case 'Medium': return 'text-amber-400 bg-amber-500/20 border-amber-500'
            case 'Low': return 'text-blue-400 bg-blue-500/20 border-blue-500'
            case 'Holiday': return 'text-purple-400 bg-purple-500/20 border-purple-500'
            default: return 'text-neutral-400 bg-neutral-500/20 border-neutral-500'
        }
    }

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'BULLISH': return 'text-green-400 bg-green-500/20'
            case 'BEARISH': return 'text-red-400 bg-red-500/20'
            case 'MIXED': return 'text-amber-400 bg-amber-500/20'
            default: return 'text-neutral-400 bg-neutral-500/20'
        }
    }

    const getTimeDisplay = (minutesUntil: number) => {
        if (minutesUntil < 0) return 'Past event'
        if (minutesUntil < 60) return `${minutesUntil}m`
        if (minutesUntil < 1440) return `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`
        return `${Math.floor(minutesUntil / 1440)}d ${Math.floor((minutesUntil % 1440) / 60)}h`
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
                        <Newspaper className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Market News & Events</h1>
                        <p className="text-sm text-neutral-400">Economic calendar + news sentiment analysis</p>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Pair Selector */}
                <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                    <label className="text-xs text-neutral-400 font-bold uppercase mb-2 block">Currency Pair</label>
                    <select
                        value={selectedPair}
                        onChange={(e) => setSelectedPair(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                        {FOREX_PAIRS.map(pair => (
                            <option key={pair} value={pair}>{pair}</option>
                        ))}
                    </select>
                </div>

                {/* Time Range */}
                <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                    <label className="text-xs text-neutral-400 font-bold uppercase mb-2 block">Time Range</label>
                    <select
                        value={hoursAhead}
                        onChange={(e) => setHoursAhead(parseInt(e.target.value))}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="6">Next 6 hours</option>
                        <option value="24">Next 24 hours</option>
                        <option value="48">Next 48 hours</option>
                        <option value="168">Next 7 days</option>
                    </select>
                </div>

                {/* Impact Filter */}
                <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                    <label className="text-xs text-neutral-400 font-bold uppercase mb-2 block flex items-center gap-2">
                        <Filter size={12} />
                        Impact Filter
                    </label>
                    <select
                        value={impactFilter || ''}
                        onChange={(e) => setImpactFilter(e.target.value || null)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                        <option value="">All Impacts</option>
                        <option value="High">High Impact Only</option>
                        <option value="Medium">Medium Impact</option>
                        <option value="Low">Low Impact</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="animate-spin text-blue-400" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Economic Calendar */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Calendar Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                                <div className="text-3xl font-bold text-red-400">{allEvents.filter(e => e.impact === 'High').length}</div>
                                <div className="text-xs text-neutral-400 uppercase mt-1">High Impact</div>
                            </div>
                            <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                                <div className="text-3xl font-bold text-amber-400">{allEvents.filter(e => e.impact === 'Medium').length}</div>
                                <div className="text-xs text-neutral-400 uppercase mt-1">Medium Impact</div>
                            </div>
                            <div className="border border-neutral-800 rounded-xl p-4 bg-neutral-950/50">
                                <div className="text-3xl font-bold text-blue-400">{allEvents.length}</div>
                                <div className="text-xs text-neutral-400 uppercase mt-1">Total Events</div>
                            </div>
                        </div>

                        {/* Economic Calendar */}
                        <div className="border border-neutral-800 rounded-xl bg-neutral-950/50">
                            <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
                                <Calendar className="text-blue-400" size={18} />
                                <h3 className="font-bold text-sm uppercase tracking-wider">
                                    Economic Calendar {selectedPair !== 'GLOBAL' ? `(${selectedPair})` : '(GLOBAL)'}
                                </h3>
                                <span className="text-xs text-neutral-500">({filteredEvents.length} events)</span>
                            </div>

                            <div className="divide-y divide-neutral-800 max-h-[600px] overflow-y-auto">
                                {filteredEvents.length === 0 ? (
                                    <div className="p-8 text-center text-neutral-500">
                                        No events found in the selected time range.
                                    </div>
                                ) : (
                                    filteredEvents.map((event, idx) => (
                                        <div key={idx} className="p-4 hover:bg-neutral-900/50 transition-colors">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getImpactColor(event.impact)}`}>
                                                            {event.impact.toUpperCase()}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-700 text-neutral-300">
                                                            {event.currency}
                                                        </span>
                                                        {event.minutesUntil < 120 && event.impact === 'High' && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white flex items-center gap-1">
                                                                <AlertTriangle size={10} />
                                                                IMMINENT
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-bold text-white text-sm mb-1">{event.title}</h4>
                                                    <div className="flex items-center gap-4 text-xs text-neutral-400">
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            {new Date(event.date).toLocaleString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                        <span className="text-blue-400 font-medium">
                                                            in {getTimeDisplay(event.minutesUntil)}
                                                        </span>
                                                    </div>
                                                    {(event.forecast || event.previous) && (
                                                        <div className="mt-2 flex gap-4 text-xs">
                                                            {event.forecast && (
                                                                <span className="text-neutral-400">
                                                                    Forecast: <span className="text-white font-medium">{event.forecast}</span>
                                                                </span>
                                                            )}
                                                            {event.previous && (
                                                                <span className="text-neutral-400">
                                                                    Previous: <span className="text-white font-medium">{event.previous}</span>
                                                                </span>
                                                            )}
                                                            {event.actual && (
                                                                <span className="text-neutral-400">
                                                                    Actual: <span className="text-green-400 font-medium">{event.actual}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: News & Sentiment */}
                    <div className="space-y-6">
                        {/* Sentiment Analysis */}
                        {sentiment && (
                            <div className="border border-neutral-800 rounded-xl bg-neutral-950/50">
                                <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
                                    <TrendingUp className="text-green-400" size={18} />
                                    <h3 className="font-bold text-sm uppercase tracking-wider">Market Sentiment</h3>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-400">Overall:</span>
                                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getSentimentColor(sentiment.overall)}`}>
                                            {sentiment.overall}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-neutral-400">Confidence:</span>
                                        <span className="text-sm font-bold text-white">{sentiment.confidence}%</span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-400">USD:</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSentimentColor(sentiment.usdBias)}`}>
                                                {sentiment.usdBias}
                                            </span>
                                        </div>
                                        {sentiment.eurBias && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-neutral-400">EUR:</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSentimentColor(sentiment.eurBias)}`}>
                                                    {sentiment.eurBias}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-neutral-800">
                                        <p className="text-xs text-neutral-300 leading-relaxed">{sentiment.summary}</p>
                                    </div>

                                    {sentiment.keyThemes && sentiment.keyThemes.length > 0 && (
                                        <div className="pt-3 border-t border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 font-bold uppercase mb-2">Key Themes</div>
                                            <div className="flex flex-wrap gap-2">
                                                {sentiment.keyThemes.map((theme, idx) => (
                                                    <span key={idx} className="px-2 py-1 bg-neutral-800 rounded text-xs text-neutral-300">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* News Headlines */}
                        <div className="border border-neutral-800 rounded-xl bg-neutral-950/50">
                            <div className="px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
                                <Newspaper className="text-blue-400" size={18} />
                                <h3 className="font-bold text-sm uppercase tracking-wider">Recent Headlines</h3>
                            </div>

                            <div className="divide-y divide-neutral-800 max-h-[400px] overflow-y-auto">
                                {headlines.length === 0 ? (
                                    <div className="p-6 text-center text-neutral-500 text-sm">
                                        No recent headlines available.
                                    </div>
                                ) : (
                                    headlines.map((headline, idx) => (
                                        <div key={idx} className="p-3 hover:bg-neutral-900/50 transition-colors">
                                            <a
                                                href={headline.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block group"
                                            >
                                                <h4 className="font-medium text-white text-sm mb-1 group-hover:text-blue-400 transition-colors flex items-start gap-2">
                                                    {headline.title}
                                                    <ExternalLink size={12} className="text-neutral-500 group-hover:text-blue-400 flex-shrink-0 mt-1" />
                                                </h4>
                                                {headline.description && (
                                                    <p className="text-xs text-neutral-400 line-clamp-2 mb-2">
                                                        {headline.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 text-[10px] text-neutral-500">
                                                    <span>{headline.source}</span>
                                                    <span>•</span>
                                                    <span>
                                                        {Math.floor((Date.now() - new Date(headline.publishedAt).getTime()) / (60 * 60 * 1000))}h ago
                                                    </span>
                                                </div>
                                            </a>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Critical Events for Selected Pair */}
                        {pairEvents.length > 0 && (
                            <div className="border border-amber-800/50 rounded-xl bg-amber-950/20">
                                <div className="px-4 py-3 border-b border-amber-800/50 flex items-center gap-2">
                                    <AlertTriangle className="text-amber-400" size={18} />
                                    <h3 className="font-bold text-sm uppercase tracking-wider text-amber-300">
                                        {selectedPair} Events
                                    </h3>
                                </div>

                                <div className="p-3 space-y-2">
                                    {pairEvents.slice(0, 3).map((event, idx) => (
                                        <div key={idx} className="p-2 bg-amber-950/30 rounded border border-amber-800/30">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getImpactColor(event.impact)}`}>
                                                    {event.impact}
                                                </span>
                                                <span className="text-xs font-medium text-amber-300">
                                                    in {Math.floor(event.timeUntilEvent / 60)}h {event.timeUntilEvent % 60}m
                                                </span>
                                            </div>
                                            <div className="text-xs text-white font-medium">{event.event}</div>
                                            <div className="text-[10px] text-amber-400/60 mt-1">{event.recommendation}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
