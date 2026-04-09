'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
    Shield,
    Zap,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Lock,
    Unlock,
    Target,
    Activity,
    TrendingUp,
    BarChart3,
    Crosshair,
    XOctagon,
    Flame,
    Radio,
} from 'lucide-react'

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const INSTRUMENTS = [
    'XAU/USD (Gold)',
    'EUR/USD',
    'GBP/USD',
    'USD/JPY',
    'AUD/USD',
    'USD/CAD',
    'NZD/USD',
    'USD/CHF',
    'GBP/JPY',
    'EUR/JPY',
    'EUR/GBP',
    'US30 (Dow)',
    'NAS100',
    'SPX500',
    'BTC/USD',
]

const PROOF_OPTIONS = [
    { id: 'volume', label: 'Volume Climax / Expansion' },
    { id: 'structure', label: 'Break of Previous Structure' },
    { id: 'oscillator', label: 'Momentum Oscillator Cross' },
    { id: 'internal', label: 'Clear 5-Wave Internal Structure' },
]

const WAVE_OPTIONS = ['1', '2', '3', '4', '5']

/* ────────────────────── ANIMATED STEP INDICATOR ────────────────── */

function StepIndicator({
    step,
    currentStep,
    label,
    icon: Icon,
    locked,
}: {
    step: number
    currentStep: number
    label: string
    icon: React.ElementType
    locked: boolean
}) {
    const isActive = currentStep === step
    const isCompleted = currentStep > step

    return (
        <div className="flex items-center gap-3 group">
            <div
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-500 border shrink-0 ${
                    isCompleted
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                        : isActive
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/20 animate-pulse'
                        : 'bg-neutral-900 border-neutral-700/50 text-neutral-600'
                }`}
            >
                {isCompleted ? (
                    <CheckCircle2 size={18} />
                ) : locked ? (
                    <Lock size={14} />
                ) : (
                    <Icon size={16} />
                )}
            </div>
            <div className="hidden md:block">
                <p
                    className={`text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
                        isActive ? 'text-cyan-400' : isCompleted ? 'text-emerald-400' : 'text-neutral-600'
                    }`}
                >
                    Step {step}
                </p>
                <p
                    className={`text-xs font-semibold transition-colors ${
                        isActive ? 'text-white' : isCompleted ? 'text-neutral-400' : 'text-neutral-600'
                    }`}
                >
                    {label}
                </p>
            </div>
            {step < 5 && (
                <ChevronRight
                    size={14}
                    className={`hidden md:block transition-colors ${
                        isCompleted ? 'text-emerald-500/40' : 'text-neutral-800'
                    }`}
                />
            )}
        </div>
    )
}

/* ─────────────────────── PROOF CHECKBOX GROUP ─────────────────── */

function ProofCheckboxGroup({
    selected,
    onChange,
    minRequired,
}: {
    selected: string[]
    onChange: (ids: string[]) => void
    minRequired: number
}) {
    const passCount = selected.length
    const passed = passCount >= minRequired

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                    Proof of Wave
                </label>
                <span
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${
                        passed
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    }`}
                >
                    {passCount}/4 — {passed ? 'CONSENSUS PASSED' : `Need ${minRequired - passCount} more`}
                </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROOF_OPTIONS.map((opt) => {
                    const checked = selected.includes(opt.id)
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                                onChange(
                                    checked ? selected.filter((s) => s !== opt.id) : [...selected, opt.id]
                                )
                            }
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                                checked
                                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                    : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
                            }`}
                        >
                            <div
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                    checked ? 'bg-cyan-500 border-cyan-500' : 'border-neutral-700'
                                }`}
                            >
                                {checked && (
                                    <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                                        <path
                                            d="M2 6l3 3 5-5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </div>
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/* ──────────────────────── MAIN COMPONENT ──────────────────────── */

export function MatrixAlignmentProtocol() {
    // ── State ──
    const [instrument, setInstrument] = useState('')
    const [marketStructure, setMarketStructure] = useState<'impulsive' | 'complex' | ''>('')
    const [booted, setBooted] = useState(false)

    // step 2
    const [wave1h, setWave1h] = useState('')
    const [proof1h, setProof1h] = useState<string[]>([])

    // step 3
    const [waveEndPrice, setWaveEndPrice] = useState('')
    const [fibZone, setFibZone] = useState(false)
    const [rsiExhaustion, setRsiExhaustion] = useState(false)

    // step 4
    const [wave15m, setWave15m] = useState('')
    const [proof15m, setProof15m] = useState<string[]>([])
    const [subWave2Shape, setSubWave2Shape] = useState<'sharp' | 'slow' | ''>('')
    const [subWave3Longer, setSubWave3Longer] = useState(false)
    const [rsiDivergence, setRsiDivergence] = useState(false)

    // ── Derived states ──
    const step1Complete = instrument !== '' && marketStructure === 'impulsive'
    const step2Complete = wave1h !== '' && proof1h.length >= 3
    const step3Complete = waveEndPrice !== '' && fibZone
    const step4Complete =
        wave15m !== '' &&
        proof15m.length >= 3 &&
        subWave2Shape !== '' &&
        (wave15m !== '5' || (subWave3Longer && rsiDivergence))

    const currentStep = useMemo(() => {
        if (!step1Complete) return 1
        if (!step2Complete) return 2
        if (!step3Complete) return 3
        if (!step4Complete) return 4
        return 5
    }, [step1Complete, step2Complete, step3Complete, step4Complete])

    // Handle complex correction boot
    useEffect(() => {
        if (marketStructure === 'complex') {
            setBooted(true)
        }
    }, [marketStructure])

    // ── Reset ──
    function handleReset() {
        setInstrument('')
        setMarketStructure('')
        setBooted(false)
        setWave1h('')
        setProof1h([])
        setWaveEndPrice('')
        setFibZone(false)
        setRsiExhaustion(false)
        setWave15m('')
        setProof15m([])
        setSubWave2Shape('')
        setSubWave3Longer(false)
        setRsiDivergence(false)
    }

    return (
        <div className="space-y-5">
            {/* ── Step Progress Bar ── */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 md:p-5">
                <div className="flex items-center gap-2 md:gap-0 md:justify-between overflow-x-auto scrollbar-none">
                    <StepIndicator step={1} currentStep={currentStep} label="Macro Filter" icon={Shield} locked={false} />
                    <StepIndicator step={2} currentStep={currentStep} label="1H Wave ID" icon={Activity} locked={!step1Complete} />
                    <StepIndicator step={3} currentStep={currentStep} label="Exhaustion" icon={Target} locked={!step2Complete} />
                    <StepIndicator step={4} currentStep={currentStep} label="15M Alignment" icon={Crosshair} locked={!step3Complete} />
                    <StepIndicator step={5} currentStep={currentStep} label="Killzone" icon={Zap} locked={!step4Complete} />
                </div>
            </div>

            {/* ═══════════════  STEP 1 : MACRO FILTER  ═══════════════ */}
            <StepCard
                step={1}
                title="The Macro Filter"
                subtitle="Identify market structure on the highest timeframe"
                icon={Shield}
                active={currentStep === 1}
                completed={step1Complete}
                locked={false}
            >
                <div className="space-y-6">
                    {/* Instrument selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                            Instrument
                        </label>
                        <select
                            id="matrix-instrument-select"
                            value={instrument}
                            onChange={(e) => {
                                setInstrument(e.target.value)
                                setMarketStructure('')
                                setBooted(false)
                            }}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select instrument…</option>
                            {INSTRUMENTS.map((i) => (
                                <option key={i} value={i}>
                                    {i}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Market Structure Radio */}
                    {instrument && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                                Market Structure
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMarketStructure('impulsive')
                                        setBooted(false)
                                    }}
                                    className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-center transition-all cursor-pointer group ${
                                        marketStructure === 'impulsive'
                                            ? 'border-emerald-500/60 bg-emerald-500/5 shadow-xl shadow-emerald-500/10'
                                            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                                    }`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                            marketStructure === 'impulsive'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-neutral-800 text-neutral-500 group-hover:text-neutral-400'
                                        }`}
                                    >
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${marketStructure === 'impulsive' ? 'text-emerald-300' : 'text-neutral-300'}`}>
                                            Impulsive Move
                                        </p>
                                        <p className="text-[11px] text-neutral-500 mt-0.5">5-wave trend structure</p>
                                    </div>
                                    {marketStructure === 'impulsive' && (
                                        <div className="absolute top-3 right-3">
                                            <CheckCircle2 size={18} className="text-emerald-400" />
                                        </div>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setMarketStructure('complex')}
                                    className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-center transition-all cursor-pointer group ${
                                        marketStructure === 'complex'
                                            ? 'border-red-500/60 bg-red-500/5 shadow-xl shadow-red-500/10'
                                            : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                                    }`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                            marketStructure === 'complex'
                                                ? 'bg-red-500/20 text-red-400'
                                                : 'bg-neutral-800 text-neutral-500 group-hover:text-neutral-400'
                                        }`}
                                    >
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-bold ${marketStructure === 'complex' ? 'text-red-300' : 'text-neutral-300'}`}>
                                            Complex Correction
                                        </p>
                                        <p className="text-[11px] text-neutral-500 mt-0.5">ABC / WXY / Range</p>
                                    </div>
                                    {marketStructure === 'complex' && (
                                        <div className="absolute top-3 right-3">
                                            <XOctagon size={18} className="text-red-400" />
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Boot alert */}
                    {booted && (
                        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 rounded-2xl border-2 border-red-500/40 bg-red-950/30 p-5 md:p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                                    <XOctagon size={24} className="text-red-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-black text-red-400 tracking-tight">
                                        ASSET BOOTED FROM MATRIX
                                    </h3>
                                    <p className="text-sm text-red-300/80 leading-relaxed">
                                        Do not trade complex ranges. This instrument shows corrective, non-impulsive price action.
                                        Wait for a clear 5-wave impulsive structure to develop before re-entering the protocol.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        className="mt-3 px-5 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all cursor-pointer"
                                    >
                                        Reset Protocol
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </StepCard>

            {/* ═══════════════  STEP 2 : 1H WAVE ID  ═══════════════ */}
            <StepCard
                step={2}
                title="1-Hour Wave Identification & Proof"
                subtitle="Identify the current wave and provide structural evidence"
                icon={Activity}
                active={currentStep === 2}
                completed={step2Complete}
                locked={!step1Complete}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                            Current 1-Hour Wave
                        </label>
                        <select
                            id="matrix-1h-wave-select"
                            value={wave1h}
                            onChange={(e) => setWave1h(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select wave…</option>
                            {WAVE_OPTIONS.map((w) => (
                                <option key={w} value={w}>
                                    Wave {w}
                                </option>
                            ))}
                        </select>
                    </div>

                    {wave1h && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <ProofCheckboxGroup selected={proof1h} onChange={setProof1h} minRequired={3} />
                        </div>
                    )}

                    {step2Complete && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-in fade-in duration-300">
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            <p className="text-xs font-semibold text-emerald-300">
                                Wave {wave1h} confirmed on 1H with {proof1h.length}/4 consensus. Proceeding to exhaustion scan.
                            </p>
                        </div>
                    )}
                </div>
            </StepCard>

            {/* ═══════════════  STEP 3 : EXHAUSTION TARGETING  ═══════════════ */}
            <StepCard
                step={3}
                title="1-Hour Exhaustion Targeting"
                subtitle="Validate wave termination and Fibonacci alignment"
                icon={Target}
                active={currentStep === 3}
                completed={step3Complete}
                locked={!step2Complete}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                            Estimated Wave End Price
                        </label>
                        <input
                            id="matrix-wave-end-price"
                            type="number"
                            step="any"
                            value={waveEndPrice}
                            onChange={(e) => setWaveEndPrice(e.target.value)}
                            placeholder="e.g. 2340.50"
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                            Exhaustion Confirmation
                        </label>
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setFibZone(!fibZone)}
                                className={`flex items-center gap-3 w-full p-3.5 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                                    fibZone
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                        fibZone ? 'bg-cyan-500 border-cyan-500' : 'border-neutral-700'
                                    }`}
                                >
                                    {fibZone && (
                                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                Price is entering Golden Fib Zone (61.8% — 78.6%) or Extension Zone
                            </button>

                            <button
                                type="button"
                                onClick={() => setRsiExhaustion(!rsiExhaustion)}
                                className={`flex items-center gap-3 w-full p-3.5 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                                    rsiExhaustion
                                        ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                }`}
                            >
                                <div
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                        rsiExhaustion ? 'bg-cyan-500 border-cyan-500' : 'border-neutral-700'
                                    }`}
                                >
                                    {rsiExhaustion && (
                                        <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                                RSI shows Overbought / Oversold exhaustion
                            </button>
                        </div>
                    </div>

                    {fibZone && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-in fade-in duration-300">
                            <Unlock size={16} className="text-emerald-400 shrink-0" />
                            <p className="text-xs font-semibold text-emerald-300">
                                1-Hour Macro aligned. Unlocking 15-Minute Micro Matrix.
                            </p>
                        </div>
                    )}
                </div>
            </StepCard>

            {/* ═══════════════  STEP 4 : 15M ALIGNMENT  ═══════════════ */}
            <StepCard
                step={4}
                title="15-Minute Sub-Wave Alignment"
                subtitle="Drill into the micro structure for precision entry timing"
                icon={Crosshair}
                active={currentStep === 4}
                completed={step4Complete}
                locked={!step3Complete}
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.15em] text-neutral-400">
                            Current 15-Minute Sub-Wave
                        </label>
                        <select
                            id="matrix-15m-wave-select"
                            value={wave15m}
                            onChange={(e) => setWave15m(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                        >
                            <option value="">Select sub-wave…</option>
                            {WAVE_OPTIONS.map((w) => (
                                <option key={w} value={w}>
                                    Sub-Wave {w}
                                </option>
                            ))}
                        </select>
                    </div>

                    {wave15m && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <ProofCheckboxGroup selected={proof15m} onChange={setProof15m} minRequired={3} />

                            {/* Rule of Alternation */}
                            <div className="space-y-3 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Radio size={14} className="text-amber-400" />
                                    <label className="text-xs font-black uppercase tracking-[0.15em] text-amber-400">
                                        Rule of Alternation
                                    </label>
                                </div>
                                <p className="text-[11px] text-neutral-500">
                                    What was the shape of Sub-Wave 2?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSubWave2Shape('sharp')}
                                        className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all cursor-pointer ${
                                            subWave2Shape === 'sharp'
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                        }`}
                                    >
                                        Sharp / Deep
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSubWave2Shape('slow')}
                                        className={`p-3 rounded-xl border text-sm font-semibold text-center transition-all cursor-pointer ${
                                            subWave2Shape === 'slow'
                                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                        }`}
                                    >
                                        Slow / Flat
                                    </button>
                                </div>
                                {subWave2Shape === 'sharp' && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in duration-300">
                                        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                                        <p className="text-xs font-semibold text-amber-300">
                                            Expect Sub-Wave 4 to be a slow time-trap.
                                        </p>
                                    </div>
                                )}
                                {subWave2Shape === 'slow' && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 animate-in fade-in duration-300">
                                        <Flame size={14} className="text-violet-400 shrink-0" />
                                        <p className="text-xs font-semibold text-violet-300">
                                            Expect Sub-Wave 4 to be a sharp, rapid pullback.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Wave Extension Check — only for Sub-Wave 5 */}
                            {wave15m === '5' && (
                                <div className="space-y-3 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-2">
                                        <Flame size={14} className="text-rose-400" />
                                        <label className="text-xs font-black uppercase tracking-[0.15em] text-rose-400">
                                            Wave Extension Check
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-neutral-500">
                                        Required for Sub-Wave 5 validation.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => setSubWave3Longer(!subWave3Longer)}
                                        className={`flex items-center gap-3 w-full p-3 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                                            subWave3Longer
                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                                : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                                subWave3Longer ? 'bg-rose-500 border-rose-500' : 'border-neutral-700'
                                            }`}
                                        >
                                            {subWave3Longer && (
                                                <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                        Is Sub-Wave 3 longer than Sub-Wave 1?
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRsiDivergence(!rsiDivergence)}
                                        className={`flex items-center gap-3 w-full p-3 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer ${
                                            rsiDivergence
                                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                                : 'bg-neutral-900/70 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                                rsiDivergence ? 'bg-rose-500 border-rose-500' : 'border-neutral-700'
                                            }`}
                                        >
                                            {rsiDivergence && (
                                                <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none">
                                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                        Is there RSI Divergence between Wave 3 and Wave 5?
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step4Complete && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 animate-in fade-in duration-300">
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            <p className="text-xs font-semibold text-emerald-300">
                                15-Minute micro matrix validated. All confluence checks passed.
                            </p>
                        </div>
                    )}
                </div>
            </StepCard>

            {/* ═══════════════  STEP 5 : KILLZONE EXECUTION  ═══════════════ */}
            <StepCard
                step={5}
                title="The Killzone Execution"
                subtitle="Full macro-micro confluence achieved"
                icon={Zap}
                active={currentStep === 5}
                completed={currentStep === 5}
                locked={!step4Complete}
                isGreenLight
            >
                <div className="space-y-5">
                    {/* Confluence Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <SummaryChip label="Instrument" value={instrument} />
                        <SummaryChip label="1H Wave" value={`Wave ${wave1h}`} />
                        <SummaryChip label="Target Price" value={waveEndPrice} />
                        <SummaryChip label="15M Sub-Wave" value={`Sub-Wave ${wave15m}`} />
                    </div>

                    {/* Green Light Card */}
                    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-emerald-950/20 to-neutral-950 p-6 md:p-8">
                        {/* Glow effect */}
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />

                        <div className="relative space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                    <Zap size={28} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-emerald-400 tracking-tight">
                                        CONFLUENCE ACHIEVED
                                    </h3>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/60">
                                        Green Light Protocol Active
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-emerald-200/80 leading-relaxed max-w-xl">
                                Macro and Micro matrices are aligned. Drop to the <span className="font-black text-emerald-300">1-Minute chart</span> immediately.
                                Wait for the final <span className="font-black text-emerald-300">Volume Climax</span> and execute your rigid <span className="font-black text-emerald-300">Stop-Loss protocol</span>.
                            </p>

                            <div className="flex flex-wrap gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="px-6 py-2.5 bg-neutral-800/60 border border-neutral-700 text-neutral-300 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-neutral-700/60 transition-all cursor-pointer"
                                >
                                    Reset Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </StepCard>
        </div>
    )
}

/* ─────────────────────── STEP CARD WRAPPER ─────────────────────── */

function StepCard({
    step,
    title,
    subtitle,
    icon: Icon,
    active,
    completed,
    locked,
    isGreenLight,
    children,
}: {
    step: number
    title: string
    subtitle: string
    icon: React.ElementType
    active: boolean
    completed: boolean
    locked: boolean
    isGreenLight?: boolean
    children: React.ReactNode
}) {
    if (locked) {
        return (
            <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/20 p-5 md:p-6 opacity-40 select-none">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                        <Lock size={14} className="text-neutral-700" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-700">
                            Step {step}
                        </p>
                        <p className="text-sm font-semibold text-neutral-700">{title}</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`rounded-2xl border p-5 md:p-6 transition-all duration-500 ${
                isGreenLight && active
                    ? 'border-emerald-500/30 bg-neutral-900/60 shadow-2xl shadow-emerald-500/5'
                    : active
                    ? 'border-cyan-500/30 bg-neutral-900/60 shadow-xl shadow-cyan-500/5'
                    : completed
                    ? 'border-emerald-500/20 bg-neutral-900/40'
                    : 'border-neutral-800 bg-neutral-900/40'
            }`}
        >
            <div className="flex items-center gap-3 mb-5">
                <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                        isGreenLight && active
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : active
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                            : completed
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                    }`}
                >
                    {completed && !active ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <div>
                    <p
                        className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                            isGreenLight && active
                                ? 'text-emerald-500'
                                : active
                                ? 'text-cyan-500'
                                : completed
                                ? 'text-emerald-500'
                                : 'text-neutral-600'
                        }`}
                    >
                        Step {step}
                    </p>
                    <p className={`text-sm font-bold ${active ? 'text-white' : 'text-neutral-300'}`}>{title}</p>
                </div>
                {completed && !active && (
                    <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        Passed
                    </span>
                )}
            </div>
            {(active || completed) && <div>{children}</div>}
        </div>
    )
}

/* ────────────────────── SUMMARY CHIP ──────────────────────── */

function SummaryChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600 mb-1">{label}</p>
            <p className="text-sm font-bold text-white truncate">{value}</p>
        </div>
    )
}
