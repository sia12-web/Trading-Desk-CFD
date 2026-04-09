'use client'

import { useState, useEffect } from 'react'
import type { GannMatrixData } from '@/lib/utils/gann-calculator'

interface GannMatrixResponse {
    pair: string
    gannMatrix: GannMatrixData
    currentPrice: number
    highPrice: number
    lowPrice: number
    location: {
        latitude: number
        longitude: number
        name: string
    }
}

const PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
    'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
    'XAU/USD', 'US30', 'NAS100', 'SPX500',
    'BTC/USD', 'ETH/USD', 'SOL/USD'
]

export default function GannCalendarPage() {
    const [selectedPair, setSelectedPair] = useState('EUR/USD')
    const [data, setData] = useState<GannMatrixResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [autoRefresh, setAutoRefresh] = useState(true)

    const fetchGannMatrix = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/gann/matrix?pair=${encodeURIComponent(selectedPair)}`)
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to fetch Gann Matrix')
            }

            const result: GannMatrixResponse = await response.json()
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchGannMatrix()
    }, [selectedPair])

    useEffect(() => {
        if (!autoRefresh) return

        const interval = setInterval(() => {
            fetchGannMatrix()
        }, 60000) // Refresh every 1 minute (Ascendant moves 1° every 4 minutes)

        return () => clearInterval(interval)
    }, [autoRefresh, selectedPair])

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        })
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">W.D. Gann Astronomical Calendar</h1>
                <p className="text-gray-400">Time-Price Geometry • Solar Fire Method • Master Calculator</p>
            </div>

            {/* Controls */}
            <div className="mb-6 flex items-center gap-4">
                <select
                    value={selectedPair}
                    onChange={(e) => setSelectedPair(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                    {PAIRS.map(pair => (
                        <option key={pair} value={pair}>{pair}</option>
                    ))}
                </select>

                <button
                    onClick={fetchGannMatrix}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>

                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="w-4 h-4"
                    />
                    Auto-refresh (1 min)
                </label>

                {data && (
                    <div className="ml-auto text-sm text-gray-400">
                        Last updated: {formatTime(data.gannMatrix.calculatedAt)}
                    </div>
                )}
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-600 rounded-lg text-red-400">
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Price Info */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">Price Range (Last 20 H1 Candles)</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <div className="text-sm text-gray-400 mb-1">High</div>
                                <div className="text-2xl font-mono">{data.highPrice.toFixed(5)}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-400 mb-1">Current</div>
                                <div className="text-2xl font-mono text-yellow-400">{data.currentPrice.toFixed(5)}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-400 mb-1">Low</div>
                                <div className="text-2xl font-mono">{data.lowPrice.toFixed(5)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Time Fractions */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">⏰ Time Fractions (Master Calculator)</h2>
                        <p className="text-sm text-gray-400 mb-4">
                            Daylight Duration: {data.gannMatrix.daylightDuration.hours}h {data.gannMatrix.daylightDuration.minutes}m
                            ({data.gannMatrix.daylightDuration.totalMinutes} minutes)
                        </p>
                        <div className="space-y-2">
                            {data.gannMatrix.timeFractions.map((tf, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700">
                                    <div>
                                        <div className="font-medium">{tf.label}</div>
                                        <div className="text-sm text-gray-400">{tf.minutesFromSunrise} minutes from sunrise</div>
                                    </div>
                                    <div className="text-2xl font-mono text-yellow-400">{tf.time}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Price-to-Degree */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">📐 Price-to-Degree Analysis (Solar Fire Method)</h2>
                        <p className="text-sm text-gray-400 mb-4">
                            Degree Range: {data.gannMatrix.priceRange.degreeRange.toFixed(1)}°
                            (Price Range: {data.gannMatrix.priceRange.absolute.toFixed(5)})
                        </p>
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-900 rounded border border-gray-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-gray-400">Current Price</div>
                                        <div className="font-mono text-lg">{data.gannMatrix.current.originalPrice.toFixed(5)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-2xl font-bold ${data.gannMatrix.current.cardinalCross ? 'text-red-400' : 'text-yellow-400'}`}>
                                            {data.gannMatrix.current.degree}°
                                            {data.gannMatrix.current.cardinalCross && ' ⚠️'}
                                        </div>
                                        <div className="text-sm text-gray-400">{data.gannMatrix.current.zodiacSign}</div>
                                        {data.gannMatrix.current.cardinalCross && (
                                            <div className="text-xs text-red-400 mt-1">AT CARDINAL CROSS</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-gray-400">High</div>
                                            <div className="font-mono">{data.gannMatrix.high.originalPrice.toFixed(5)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xl font-bold ${data.gannMatrix.high.cardinalCross ? 'text-red-400' : 'text-blue-400'}`}>
                                                {data.gannMatrix.high.degree}°
                                            </div>
                                            <div className="text-xs text-gray-400">{data.gannMatrix.high.zodiacSign}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm text-gray-400">Low</div>
                                            <div className="font-mono">{data.gannMatrix.low.originalPrice.toFixed(5)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xl font-bold ${data.gannMatrix.low.cardinalCross ? 'text-red-400' : 'text-blue-400'}`}>
                                                {data.gannMatrix.low.degree}°
                                            </div>
                                            <div className="text-xs text-gray-400">{data.gannMatrix.low.zodiacSign}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Harmonic Levels */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-xl font-semibold mb-4">🎯 Harmonic Levels (Cardinal Degrees)</h2>
                        <p className="text-sm text-gray-400 mb-4">
                            Support & Resistance at 0°, 90°, 180°, 270°, 360° cardinal points
                        </p>
                        <div className="space-y-2">
                            {data.gannMatrix.harmonicLevels.map((level, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700">
                                    <div className="font-medium">
                                        {['0° (0%)', '90° (25%)', '180° (50%)', '270° (75%)', '360° (100%)'][idx]}
                                    </div>
                                    <div className="text-xl font-mono text-blue-400">{level.toFixed(5)}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ascendant Clock */}
                    {data.gannMatrix.ascendant && (
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4">🌍 Ascendant Clock (Real-Time Earth Rotation)</h2>
                            <p className="text-sm text-gray-400 mb-4">
                                Location: {data.location.name} ({data.location.latitude.toFixed(4)}°N, {Math.abs(data.location.longitude).toFixed(4)}°W)
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">Ascendant</div>
                                    <div className={`text-3xl font-bold ${data.gannMatrix.ascendant.cardinalAlignment ? 'text-red-400' : 'text-yellow-400'}`}>
                                        {data.gannMatrix.ascendant.ascendant.toFixed(2)}°
                                        {data.gannMatrix.ascendant.cardinalAlignment && ' ⚠️'}
                                    </div>
                                    {data.gannMatrix.ascendant.cardinalAlignment && (
                                        <div className="text-xs text-red-400 mt-1">AT CARDINAL ALIGNMENT</div>
                                    )}
                                </div>

                                <div className="p-4 bg-gray-900 rounded border border-gray-700">
                                    <div className="text-sm text-gray-400 mb-1">Midheaven</div>
                                    <div className="text-3xl font-bold text-blue-400">
                                        {data.gannMatrix.ascendant.midheaven.toFixed(2)}°
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700">
                                    <div className="text-sm text-gray-400">Local Sidereal Time</div>
                                    <div className="font-mono text-lg">{data.gannMatrix.ascendant.localSiderealTime}</div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-900 rounded border border-gray-700">
                                    <div className="text-sm text-gray-400">Next Cardinal Degree</div>
                                    <div className="font-mono text-lg">{data.gannMatrix.ascendant.nextCardinalDegree}° in {data.gannMatrix.ascendant.minutesToNextCardinal} minutes</div>
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-blue-900/20 border border-blue-600 rounded text-sm text-blue-300">
                                <strong>Note:</strong> Ascendant moves ~1° every 4 minutes. Cardinal degrees (0°, 90°, 180°, 270°) are high-probability reversal windows.
                            </div>
                        </div>
                    )}

                    {/* Trading Doctrine */}
                    <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-6 border border-purple-600">
                        <h2 className="text-xl font-semibold mb-4">📚 Gann Trading Doctrine</h2>
                        <div className="space-y-3 text-sm">
                            <div>
                                <strong className="text-purple-400">Time Fractions:</strong> Market energy shifts at daylight 1/3, 1/2, 2/3 points — algorithmic pivot zones where reversals often occur.
                            </div>
                            <div>
                                <strong className="text-purple-400">Cardinal Cross:</strong> When price degree is within 5° of 0°, 90°, 180°, or 270°, major support/resistance expected where price and time harmonize.
                            </div>
                            <div>
                                <strong className="text-purple-400">Harmonic Levels:</strong> The 5 cardinal price levels (0%, 25%, 50%, 75%, 100% of range) provide algorithmic S/R confluence.
                            </div>
                            <div>
                                <strong className="text-purple-400">Gann Square:</strong> When Ascendant at cardinal (0°/90°/180°/270°) AND price at cardinal degree = maximum probability reversal window.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
