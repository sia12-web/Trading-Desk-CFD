'use client'

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface ATRComparisonProps {
    realATR: number[]
    whaleVolatility: number[]
    currentStep: number
    candlesPerStep: number
}

export function ATRComparison({ realATR, whaleVolatility, currentStep, candlesPerStep }: ATRComparisonProps) {
    const visibleEnd = Math.min((currentStep + 1) * candlesPerStep, realATR.length)

    const data = Array.from({ length: visibleEnd }, (_, i) => ({
        index: i,
        realATR: realATR[i] ?? 0,
        whaleVol: whaleVolatility[i] ?? 0,
    }))

    if (data.length === 0) return null

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                ATR vs Whale Volatility
            </h3>
            <p className="text-[10px] text-neutral-600">
                Gray = Real ATR (not given to AI) | Orange = Volatility from whale manipulation
            </p>
            <div className="w-full h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="atrGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#737373" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#737373" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="whaleGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                        <XAxis dataKey="index" stroke="#525252" fontSize={10} tickLine={false} interval={14} />
                        <YAxis stroke="#525252" fontSize={10} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', fontSize: 11 }}
                            formatter={(value, name) => [
                                (Number(value) ?? 0).toFixed(4),
                                name === 'realATR' ? 'Real ATR' : 'Whale Vol',
                            ]}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: 10, color: '#737373' }}
                            formatter={(value) => value === 'realATR' ? 'Real ATR' : 'Whale Volatility'}
                        />
                        <Area type="monotone" dataKey="realATR" stroke="#737373" fill="url(#atrGrad)" strokeWidth={1} />
                        <Area type="monotone" dataKey="whaleVol" stroke="#f59e0b" fill="url(#whaleGrad)" strokeWidth={1.5} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
