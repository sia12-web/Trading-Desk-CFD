'use client'

import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Scatter,
} from 'recharts'
import type { CandleChartPoint } from '@/lib/market-maker/types'

interface PriceChartProps {
    data: CandleChartPoint[]
    currentStep: number
    candlesPerStep: number
}

const ACTION_COLORS: Record<string, string> = {
    accumulate: '#3b82f6',   // blue
    manipulate: '#f59e0b',   // amber
    distribute: '#ef4444',   // red
    hold: '#6b7280',         // gray
}

export function PriceChart({ data, currentStep, candlesPerStep }: PriceChartProps) {
    const visibleEnd = Math.min((currentStep + 1) * candlesPerStep, data.length)
    const visible = data.slice(0, visibleEnd)

    if (visible.length === 0) return null

    const vpoc = visible[0]?.volumePOC ?? 0

    // Build scatter data for whale action markers
    const actionPoints = visible
        .filter(d => d.whaleAction && d.whaleAction !== 'hold')
        .map(d => ({ ...d, actionY: d.close }))

    return (
        <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={visible} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="donchianFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.08} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                    <XAxis
                        dataKey="index"
                        stroke="#525252"
                        fontSize={10}
                        tickLine={false}
                        tickFormatter={(i) => {
                            const pt = data[i]
                            if (!pt) return ''
                            const d = new Date(pt.time)
                            return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`
                        }}
                        interval={14}
                    />
                    <YAxis
                        stroke="#525252"
                        fontSize={10}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => v.toFixed(2)}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', fontSize: 12 }}
                        labelFormatter={(i) => {
                            const pt = data[Number(i)]
                            if (!pt) return ''
                            const d = new Date(pt.time)
                            return d.toLocaleTimeString()
                        }}
                        formatter={(value, name) => {
                            const v = Number(value)
                            if (name === 'close') return [v.toFixed(3), 'Price']
                            if (name === 'donchianHigh') return [v.toFixed(3), 'Donchian High']
                            if (name === 'donchianLow') return [v.toFixed(3), 'Donchian Low']
                            return [v, name]
                        }}
                    />

                    {/* Donchian Channel */}
                    <Line type="monotone" dataKey="donchianHigh" stroke="#6366f1" strokeDasharray="4 4" dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="donchianLow" stroke="#6366f1" strokeDasharray="4 4" dot={false} strokeWidth={1} />

                    {/* Volume POC */}
                    {vpoc > 0 && (
                        <ReferenceLine y={vpoc} stroke="#f59e0b" strokeDasharray="8 4" label={{ value: 'POC', fill: '#f59e0b', fontSize: 10 }} />
                    )}

                    {/* Price Line */}
                    <Line type="monotone" dataKey="close" stroke="#e5e5e5" dot={false} strokeWidth={1.5} />

                    {/* Whale Action Markers */}
                    <Scatter
                        data={actionPoints}
                        dataKey="actionY"
                        fill="#fff"
                        shape={((props: Record<string, unknown>) => {
                            const cx = props.cx as number ?? 0
                            const cy = props.cy as number ?? 0
                            const payload = props.payload as CandleChartPoint
                            const color = ACTION_COLORS[payload?.whaleAction ?? 'hold']
                            const size = payload?.whaleAction === 'manipulate' ? 7 : 5
                            return (
                                <circle cx={cx} cy={cy} r={size} fill={color} stroke="#000" strokeWidth={1} />
                            )
                        }) as never}
                    />
                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="flex gap-4 justify-center mt-2 text-xs text-neutral-500">
                {Object.entries(ACTION_COLORS).map(([action, color]) => (
                    <div key={action} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="capitalize">{action}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1">
                    <div className="w-6 h-0 border-t-2 border-dashed border-indigo-400" />
                    <span>Donchian</span>
                </div>
            </div>
        </div>
    )
}
