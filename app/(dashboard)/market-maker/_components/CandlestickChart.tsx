'use client'

import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import type { CandleChartPoint, WhaleActionType } from '@/lib/market-maker/types'

interface CandlestickChartProps {
    data: CandleChartPoint[]
    currentStep: number
    candlesPerStep: number
}

const ACTION_COLORS: Record<WhaleActionType, string> = {
    accumulate: '#3b82f6',
    manipulate: '#f59e0b',
    distribute: '#ef4444',
    hold: '#6b7280',
}

export function CandlestickChart({ data, currentStep, candlesPerStep }: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<any | null>(null)
    const candleSeriesRef = useRef<any | null>(null)
    const donchianHighRef = useRef<any | null>(null)
    const donchianLowRef = useRef<any | null>(null)
    const pocLineRef = useRef<any | null>(null)
    const markersSeriesRef = useRef<any | null>(null)

    useEffect(() => {
        if (!chartContainerRef.current) return

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0a0a' },
                textColor: '#737373',
            },
            grid: {
                vertLines: { color: '#1a1a1a' },
                horzLines: { color: '#1a1a1a' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#262626',
            },
            rightPriceScale: {
                borderColor: '#262626',
            },
            crosshair: {
                vertLine: {
                    color: '#525252',
                    labelBackgroundColor: '#262626',
                },
                horzLine: {
                    color: '#525252',
                    labelBackgroundColor: '#262626',
                },
            },
        })

        // Add candlestick series
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
        })

        // Add Donchian high line
        const donchianHigh = chart.addLineSeries({
            color: '#6366f1',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            priceLineVisible: false,
            lastValueVisible: false,
        })

        // Add Donchian low line
        const donchianLow = chart.addLineSeries({
            color: '#6366f1',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            priceLineVisible: false,
            lastValueVisible: false,
        })

        // Add POC line
        const pocLine = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: 2, // Dashed
            priceLineVisible: false,
            lastValueVisible: false,
        })

        // Invisible series for markers (whale actions)
        const markersSeries = chart.addLineSeries({
            color: 'transparent',
            priceLineVisible: false,
            lastValueVisible: false,
        })

        chartRef.current = chart
        candleSeriesRef.current = candleSeries
        donchianHighRef.current = donchianHigh
        donchianLowRef.current = donchianLow
        pocLineRef.current = pocLine
        markersSeriesRef.current = markersSeries

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                })
            }
        }

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [])

    useEffect(() => {
        try {
            if (!candleSeriesRef.current || !donchianHighRef.current || !donchianLowRef.current || !pocLineRef.current || !markersSeriesRef.current) return

            const visibleEnd = Math.min((currentStep + 1) * candlesPerStep, data.length)
            const visible = data.slice(0, visibleEnd)

            if (visible.length === 0) return

            // Format data for lightweight-charts - Filter out any invalid timestamps
            const candleData = visible.map(d => {
                const time = new Date(d.time).getTime() / 1000
                return {
                    time: isNaN(time) ? 0 : time,
                    open: d.open || 0,
                    high: d.high || 0,
                    low: d.low || 0,
                    close: d.close || 0,
                }
            }).filter(d => d.time > 0)

            const donchianHighData = visible
                .filter(d => d.donchianHigh && !isNaN(d.donchianHigh))
                .map(d => ({
                    time: new Date(d.time).getTime() / 1000,
                    value: d.donchianHigh!,
                })).filter(d => !isNaN(d.time))

            const donchianLowData = visible
                .filter(d => d.donchianLow && !isNaN(d.donchianLow))
                .map(d => ({
                    time: new Date(d.time).getTime() / 1000,
                    value: d.donchianLow!,
                })).filter(d => !isNaN(d.time))

            const pocData = visible
                .filter(d => d.volumePOC && d.volumePOC > 0 && !isNaN(d.volumePOC))
                .map(d => ({
                    time: new Date(d.time).getTime() / 1000,
                    value: d.volumePOC!,
                })).filter(d => !isNaN(d.time))

            // Markers for whale actions
            const markers = visible
                .filter(d => d.whaleAction && d.whaleAction !== 'hold')
                .map(d => {
                    const time = new Date(d.time).getTime() / 1000
                    if (isNaN(time)) return null
                    return {
                        time,
                        position: (d.whaleAction === 'accumulate' || d.whaleAction === 'distribute') ? 'belowBar' : 'aboveBar',
                        color: ACTION_COLORS[d.whaleAction!] || '#3b82f6',
                        shape: d.whaleAction === 'manipulate' ? 'arrowDown' : 'circle',
                        text: d.whaleAction === 'accumulate' ? 'BUY' : d.whaleAction === 'distribute' ? 'SELL' : 'HUNT',
                    }
                }).filter(Boolean) as any[]

            // Update series
            if (candleData.length > 0) candleSeriesRef.current.setData(candleData)
            if (donchianHighData.length > 0) donchianHighRef.current.setData(donchianHighData)
            if (donchianLowData.length > 0) donchianLowRef.current.setData(donchianLowData)
            if (pocData.length > 0) pocLineRef.current.setData(pocData)

            // For markers, we need to add them to a line series
            const invisibleLine = candleData.map(d => ({
                time: d.time,
                value: d.close,
            }))
            
            if (invisibleLine.length > 0) {
                markersSeriesRef.current.setData(invisibleLine)
                markersSeriesRef.current.setMarkers(markers)
            }

            // Fit content
            if (chartRef.current) {
                chartRef.current.timeScale().fitContent()
            }
        } catch (err) {
            console.error('[CandlestickChart] Error updating chart data:', err)
        }
    }, [data, currentStep, candlesPerStep])

    return (
        <div className="space-y-2">
            <div ref={chartContainerRef} className="rounded-lg overflow-hidden border border-neutral-800" />

            {/* Legend */}
            <div className="flex gap-4 justify-center text-xs text-neutral-500">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-emerald-500 rounded" />
                    <span>Bullish</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span>Bearish</span>
                </div>
                {Object.entries(ACTION_COLORS).filter(([k]) => k !== 'hold').map(([action, color]) => (
                    <div key={action} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="capitalize">{action}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1">
                    <div className="w-6 h-0 border-t-2 border-dashed border-indigo-400" />
                    <span>Donchian</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-6 h-0 border-t-2 border-dashed border-amber-500" />
                    <span>POC</span>
                </div>
            </div>
        </div>
    )
}
