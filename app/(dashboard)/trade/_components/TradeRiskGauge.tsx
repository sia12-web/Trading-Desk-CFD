'use client'

import React, { useEffect, useState } from 'react'

interface TradeRiskGaugeProps {
    riskPercent: number
    rrRatio: number
    passedValidation: boolean
}

export function TradeRiskGauge({ riskPercent, rrRatio, passedValidation }: TradeRiskGaugeProps) {
    const [animatedScore, setAnimatedScore] = useState(0)

    useEffect(() => {
        let score = (riskPercent / 2) * 60 
        if (rrRatio < 1 && rrRatio > 0) score += 20
        if (rrRatio >= 2) score -= 10
        if (!passedValidation) score += 30
        
        const finalScore = Math.min(100, Math.max(0, Math.round(score)))
        
        // Slight delay to trigger animation after mount
        const timer = setTimeout(() => {
            setAnimatedScore(finalScore)
        }, 50)
        return () => clearTimeout(timer)
    }, [riskPercent, rrRatio, passedValidation])

    // Configuration
    const size = 360
    const center = size / 2
    const radius = 120
    const startAngle = -135
    const endAngle = 135
    const range = endAngle - startAngle
    const currentAngle = startAngle + (animatedScore / 100) * range

    const getScoreColor = (s: number) => {
        if (s < 33) return '#10b981' // emerald
        if (s < 66) return '#eab308' // yellow
        return '#ef4444' // red
    }
    
    const color = getScoreColor(animatedScore)

    // Helper functions
    const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
        const rad = ((angle - 90) * Math.PI) / 180.0
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad)
        }
    }

    const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
        // Prevent SVG errors if start and end are exactly the same
        if (start === end) end += 0.001
        
        const startPoint = polarToCartesian(x, y, r, end)
        const endPoint = polarToCartesian(x, y, r, start)
        const largeArcFlag = end - start <= 180 ? '0' : '1'
        return [
            'M', startPoint.x, startPoint.y,
            'A', r, r, 0, largeArcFlag, 0, endPoint.x, endPoint.y
        ].join(' ')
    }

    // Tick generation
    const ticks = Array.from({ length: 41 }).map((_, i) => {
        const tickAngle = startAngle + (i / 40) * range
        const isMajor = i % 10 === 0
        const isPassed = tickAngle <= currentAngle
        const tickRadius = isMajor ? radius + 15 : radius + 8
        const innerRadius = radius + 2
        
        const p1 = polarToCartesian(center, center, innerRadius, tickAngle)
        const p2 = polarToCartesian(center, center, tickRadius, tickAngle)
        
        return {
            x1: p1.x, y1: p1.y,
            x2: p2.x, y2: p2.y,
            isMajor,
            isPassed,
            tickAngle,
            color: isPassed ? color : '#333333'
        }
    })

    const thumbPos = polarToCartesian(center, center, radius, currentAngle)

    return (
        <div className="flex flex-col items-center justify-center p-4 md:p-8 bg-neutral-900/50 border border-neutral-800/80 rounded-[2.5rem] relative overflow-hidden group shadow-2xl">
            {/* Elegant Background Glow */}
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 opacity-20 blur-[100px] pointer-events-none transition-colors duration-1000 ease-out rounded-full"
                style={{ backgroundColor: color }}
            />
            
            <div className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 z-20">
                <div className="w-2 h-2 rounded-full animate-pulse transition-colors duration-1000" style={{ backgroundColor: color }} />
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Risk Analysis</h4>
            </div>

            <div className="relative z-10 w-full flex justify-center py-4">
                <svg viewBox={`0 0 ${size} ${size * 0.85}`} className="w-full max-w-[360px] drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <defs>
                        <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#ef4444" />
                        </linearGradient>
                        <filter id="glow-heavy" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                        <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Faint Background Track */}
                    <path
                        d={describeArc(center, center, radius, startAngle, endAngle)}
                        fill="none"
                        stroke="#1a1a1a"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />

                    {/* Multi-colored Gradient Progress */}
                    {animatedScore > 0 && (
                        <path
                            d={describeArc(center, center, radius, startAngle, currentAngle)}
                            fill="none"
                            stroke="url(#trackGradient)"
                            strokeWidth="12"
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                            filter="url(#glow-light)"
                        />
                    )}

                    {/* Ticks */}
                    {ticks.map((t, idx) => (
                        <line
                            key={idx}
                            x1={t.x1} y1={t.y1}
                            x2={t.x2} y2={t.y2}
                            stroke={t.color}
                            strokeWidth={t.isMajor ? 2.5 : 1}
                            strokeLinecap="round"
                            className="transition-colors duration-700 delay-100"
                        />
                    ))}

                    {/* Thumb Indicator */}
                    <circle
                        cx={thumbPos.x}
                        cy={thumbPos.y}
                        r="8"
                        fill="white"
                        stroke={color}
                        strokeWidth="3"
                        className="transition-all duration-1000 ease-out"
                        filter="url(#glow-heavy)"
                    />
                    
                    <g className="transition-all duration-1000 ease-out" transform={`translate(${thumbPos.x}, ${thumbPos.y})`}>
                       <circle r="14" fill={color} opacity="0.3" className="animate-ping" style={{ transformOrigin: 'center' }} />
                    </g>
                    
                    {/* Scale Labels */}
                    <text x={polarToCartesian(center, center, radius + 35, startAngle).x} y={polarToCartesian(center, center, radius + 35, startAngle).y + 4} fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest opacity-80">Safe</text>
                    <text x={polarToCartesian(center, center, radius + 35, endAngle).x} y={polarToCartesian(center, center, radius + 35, endAngle).y + 4} fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle" className="uppercase tracking-widest opacity-80">Max</text>

                </svg>

                {/* Score Summary Display */}
                <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-500 mb-1">Score</span>
                    <div 
                        className="text-7xl font-black tracking-tighter transition-colors duration-1000 slashed-zero tabular-nums"
                        style={{ 
                            color: '#ffffff',
                            textShadow: `0 0 40px ${color}`
                        }}
                    >
                        {animatedScore}
                    </div>
                </div>
            </div>

            {/* Bottom Metrics Bar */}
            <div className="w-full max-w-sm mt-0 grid grid-cols-3 gap-2 bg-neutral-950/40 p-1.5 rounded-2xl border border-neutral-800/50 relative z-20">
                <div className="bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-800/30 transition-colors duration-500 hover:bg-neutral-800/50 group/item">
                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1 group-hover/item:text-neutral-400">Exposure</p>
                    <p className={`text-sm font-black ${riskPercent > 2 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-neutral-200'}`}>{riskPercent.toFixed(2)}%</p>
                </div>
                <div className="bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-800/30 transition-colors duration-500 hover:bg-neutral-800/50 group/item">
                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1 group-hover/item:text-neutral-400">Target R:R</p>
                    <p className={`text-sm font-black ${rrRatio < 1 ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}>{rrRatio > 0 ? `1:${rrRatio}` : '---'}</p>
                </div>
                <div className="bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-800/30 transition-colors duration-500 hover:bg-neutral-800/50 group/item">
                    <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest mb-1 group-hover/item:text-neutral-400">Status</p>
                    <p className={`text-sm font-black ${passedValidation ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}>{passedValidation ? 'PASS' : 'WARN'}</p>
                </div>
            </div>
        </div>
    )
}

