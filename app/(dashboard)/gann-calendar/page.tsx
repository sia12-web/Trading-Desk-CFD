'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Moon, Star, Globe, ChevronLeft, ChevronRight, 
    AlertTriangle, Info, Calendar as CalendarIcon,
    TrendingUp, Zap, Wind, Navigation
} from 'lucide-react'
import {
    format, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
    isSameDay, isSameMonth, startOfMonth, endOfMonth, isToday,
    startOfDay, endOfDay
} from 'date-fns'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AstroEvent {
    id: string
    title: string
    description: string
    start_time: string
    event_type: 'astrological'
    category: 'moon' | 'retrograde' | 'eclipse' | 'transit' | 'aspect'
    priority: 'low' | 'normal' | 'high'
}

interface MoonPhaseData {
    date: string
    fraction: number
    phase: number
    angle: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    moon:        { bg: 'bg-slate-500/10',    border: 'border-slate-500/20',     text: 'text-slate-300',    glow: 'shadow-slate-500/20' },
    retrograde:  { bg: 'bg-amber-500/10',    border: 'border-amber-500/30',     text: 'text-amber-400',    glow: 'shadow-amber-500/30' },
    eclipse:     { bg: 'bg-rose-500/10',     border: 'border-rose-500/30',      text: 'text-rose-400',     glow: 'shadow-rose-500/30' },
    transit:     { bg: 'bg-indigo-500/10',   border: 'border-indigo-500/20',    text: 'text-indigo-400',   glow: 'shadow-indigo-500/20' },
    aspect:      { bg: 'bg-cyan-500/10',     border: 'border-cyan-500/20',      text: 'text-cyan-400',     glow: 'shadow-cyan-500/20' },
}

// ─── Components ─────────────────────────────────────────────────────────────

function MoonIcon({ phase, size = 16 }: { phase: number; size?: number }) {
    return (
        <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <div className={`rounded-full border border-neutral-700/50 flex items-center justify-center overflow-hidden bg-neutral-900`} style={{ width: size, height: size }}>
                <div 
                    className="absolute inset-0 bg-amber-100/10" 
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        borderRadius: '50%',
                        opacity: phase > 0.4 && phase < 0.6 ? 0.8 : 0.2
                    }} 
                />
                <div 
                    className="absolute bg-neutral-950"
                    style={{
                        width: size,
                        height: size,
                        left: phase > 0.5 ? '0' : '50%',
                        opacity: phase === 0.5 ? 0 : 0.8,
                        transform: `scaleX(${Math.abs(Math.cos(phase * Math.PI * 2))})`
                    }}
                />
            </div>
            {(phase > 0.48 && phase < 0.52) && (
                <div className="absolute inset-0 bg-blue-400/20 blur-sm rounded-full animate-pulse" />
            )}
        </div>
    )
}

function AstroEventCard({ event }: { event: AstroEvent }) {
    const colors = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.transit
    
    return (
        <div className={`p-2.5 rounded-xl border ${colors.bg} ${colors.border} transition-all hover:scale-[1.02] hover:brightness-110 cursor-help group shadow-sm ${colors.glow}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-tighter ${colors.text}`}>{event.category}</span>
                        {event.priority === 'high' && <Zap size={10} className="text-amber-400 animate-pulse" />}
                    </div>
                    <h4 className="text-xs font-bold text-neutral-100 truncate mt-0.5 leading-tight">{event.title}</h4>
                </div>
                <div className="text-[10px] font-mono text-neutral-500 mt-0.5 shrink-0">
                    {format(new Date(event.start_time), 'HH:mm')}
                </div>
            </div>
            {event.description && (
                <p className="text-[9px] text-neutral-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
                    {event.description}
                </p>
            )}
        </div>
    )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function GannCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [events, setEvents] = useState<AstroEvent[]>([])
    const [moonPhases, setMoonPhases] = useState<MoonPhaseData[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'month' | 'week'>('month')

    useEffect(() => {
        loadAstroData()
    }, [currentDate, view])

    const loadAstroData = async () => {
        setLoading(true)
        try {
            let start: Date, end: Date
            if (view === 'month') {
                const ms = startOfMonth(currentDate)
                const me = endOfMonth(currentDate)
                start = startOfWeek(ms, { weekStartsOn: 1 })
                end = endOfWeek(me, { weekStartsOn: 1 })
            } else {
                start = startOfWeek(currentDate, { weekStartsOn: 1 })
                end = endOfWeek(currentDate, { weekStartsOn: 1 })
            }

            const res = await fetch(`/api/calendar/astro?start=${start.toISOString()}&end=${end.toISOString()}`)
            const data = await res.json()
            setEvents(data.events || [])
            setMoonPhases(data.moonPhases || [])
        } catch (err) {
            console.error('Failed to load astro data:', err)
        } finally {
            setLoading(false)
        }
    }

    const monthGrid = useMemo(() => {
        const ms = startOfMonth(currentDate)
        const me = endOfMonth(currentDate)
        const gs = startOfWeek(ms, { weekStartsOn: 1 })
        const ge = endOfWeek(me, { weekStartsOn: 1 })
        const days: Date[] = []
        let d = gs
        while (d <= ge) { days.push(d); d = addDays(d, 1) }
        return days
    }, [currentDate])

    const getEventsForDay = (day: Date) => events.filter(e => isSameDay(new Date(e.start_time), day))
    const getMoonPhaseForDay = (day: Date) => moonPhases.find(m => m.date === format(day, 'yyyy-MM-dd'))

    const navigate = (dir: 1 | -1) => {
        setCurrentDate(view === 'month' ? addMonths(currentDate, dir) : addDays(currentDate, dir * 7))
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 p-4 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 rounded-3xl border border-neutral-800/50">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                            <Navigation size={24} className="text-indigo-400 rotate-45" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Celestial Desk</h1>
                            <p className="text-neutral-500 text-xs font-bold uppercase tracking-[0.2em]">Institutional Astrological Alignment</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-1.5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-neutral-800 rounded-xl transition-all"><ChevronLeft size={18} className="text-neutral-400" /></button>
                    <div className="px-6 py-2 min-w-[200px] text-center border-x border-neutral-800">
                        <span className="text-lg font-black text-white italic">{format(currentDate, 'MMMM yyyy')}</span>
                    </div>
                    <button onClick={() => navigate(1)} className="p-2 hover:bg-neutral-800 rounded-xl transition-all"><ChevronRight size={18} className="text-neutral-400" /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Today</button>
                    <div className="h-8 w-px bg-neutral-800" />
                    <div className="flex p-0.5 bg-neutral-950 rounded-xl">
                        {(['month', 'week'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="relative group">
                <div className="bg-neutral-900/40 backdrop-blur-md border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="grid grid-cols-7 border-b border-neutral-800/50 bg-neutral-900/80">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="py-4 text-center">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600">{day}</span>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {monthGrid.map((day) => {
                            const dayEvents = getEventsForDay(day)
                            const moon = getMoonPhaseForDay(day)
                            const inMonth = isSameMonth(day, currentDate)
                            const today = isToday(day)
                            
                            return (
                                <div 
                                    key={day.toISOString()}
                                    className={`relative min-h-[160px] p-4 border-b border-r border-neutral-800/30 transition-all duration-300 hover:bg-indigo-500/5 group/day ${
                                        !inMonth ? 'bg-neutral-950/20 opacity-30 grayscale' : ''
                                    } ${today ? 'bg-indigo-500/5 shadow-inner' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`text-xl font-black italic tracking-tighter ${
                                            today ? 'text-indigo-400' : inMonth ? 'text-neutral-400 group-hover/day:text-neutral-200' : 'text-neutral-700'
                                        }`}>
                                            {format(day, 'd')}
                                        </div>
                                        {moon && (
                                            <div className="group/moon relative">
                                                <MoonIcon phase={moon.phase} size={20} />
                                                <div className="absolute bottom-full right-0 mb-2 whitespace-nowrap hidden group-hover/moon:block px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-[9px] font-mono text-neutral-400 z-50">
                                                    Phase: {(moon.fraction * 100).toFixed(1)}%
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        {dayEvents.map(event => (
                                            <AstroEventCard key={event.id} event={event} />
                                        ))}
                                    </div>
                                    
                                    {dayEvents.some(e => e.priority === 'high') && !today && (
                                        <div className="absolute top-1 left-1 w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col justify-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-550 mb-3 ml-1">Alignment Key</h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(CATEGORY_COLORS).map(([cat, colors]) => (
                            <div key={cat} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${colors.bg} ${colors.border}`}>
                                <div className={`w-1 h-1 rounded-full ${colors.text.replace('text', 'bg')}`} />
                                <span className={`text-[9px] font-black uppercase tracking-tighter ${colors.text}`}>{cat}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="md:col-span-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                        <Star size={16} className="text-amber-500/40 rotate-12" />
                        <div>
                            <p className="text-[10px] font-black text-white italic tracking-wide">MERCURY RETROGRADE WARNING</p>
                            <p className="text-[9px] text-neutral-500 font-medium">Expect high volatility and technical invalidations during retrograde windows.</p>
                        </div>
                   </div>
                   <div className="text-right">
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">System Status</p>
                        <p className="text-xs text-green-500 font-black animate-pulse">ALIGNED</p>
                   </div>
                </div>
            </div>
        </div>
    )
}
