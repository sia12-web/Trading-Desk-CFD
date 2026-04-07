'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
    TrendingUp,
    TrendingDown,
    Target,
    ShieldCheck,
    AlertCircle,
    ChevronRight,
    CheckCircle2,
    XCircle,
    Briefcase,
    Zap,
    Loader2,
    ShieldAlert,
    Edit3,
    Activity,
    ChevronDown as ChevronDownIcon,
    Bookmark,
    ExternalLink
} from 'lucide-react'
import { OandaInstrument, OandaPrice } from '@/lib/types/oanda'
import { RiskValidationResult } from '@/lib/risk/validator'
import { TradeRiskGauge } from './TradeRiskGauge'
import Link from 'next/link'
import { MarketSentiment } from '@/lib/utils/sentiment'
import { getMarketSessions } from '@/lib/utils/market-sessions'
import type { DeskMeeting, TradeReviewOutput } from '@/lib/desk/types'
import { getAssetConfig } from '@/lib/story/asset-config'

interface TradeFormProps {
    instruments: OandaInstrument[]
    accountInfo: any
}

export function TradeOrderForm({ instruments, accountInfo }: TradeFormProps) {
    const isCryptoInstrument = (instrument: string) => instrument.startsWith('CRYPTO_')

    const getUnitsPerLot = (instrument: string) => {
        if (isCryptoInstrument(instrument)) return 1 // 1 unit = 1 coin
        if (instrument.includes('XAU')) return 100
        if (['SPX500_USD', 'NAS100_USD', 'US30_USD', 'DE30_EUR'].includes(instrument.replace('/', '_'))) return 1
        return 100000
    }

    const searchParams = useSearchParams()
    const router = useRouter()

    const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET')
    const [selectedInstrument, setSelectedInstrument] = useState<string>('EUR_USD')
    const [direction, setDirection] = useState<'long' | 'short'>('long')
    const [units, setUnits] = useState<number>(1000)
    const [sizeMode, setSizeMode] = useState<'units' | 'margin'>('units')
    const [entryPrice, setEntryPrice] = useState<number>(0)
    const [limitPrice, setLimitPrice] = useState<number>(0)
    const [stopLoss, setStopLoss] = useState<number>(0)
    const [takeProfit, setTakeProfit] = useState<number>(0)
    const [currentPrice, setCurrentPrice] = useState<OandaPrice | null>(null)
    const [hasSetInitialPrice, setHasSetInitialPrice] = useState(false)

    const [validation, setValidation] = useState<RiskValidationResult | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [isExecuting, setIsExecuting] = useState(false)

    const [showConfirm, setShowConfirm] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const [executionResult, setExecutionResult] = useState<any>(null)

    const [marketSentiment, setMarketSentiment] = useState<MarketSentiment | null>(null)
    const [name, setName] = useState('')
    const [strategyExplanation, setStrategyExplanation] = useState('')
    const [isPlanning, setIsPlanning] = useState(false)
    const [planResult, setPlanResult] = useState<{ tradeId: string } | null>(null)

    const [deskReview, setDeskReview] = useState<DeskMeeting | null>(null)
    const [isReviewing, setIsReviewing] = useState(false)
    const [storyPositionId, setStoryPositionId] = useState<string | null>(null)
    const [conversionRate, setConversionRate] = useState<number>(1)
    const [baseConversionRate, setBaseConversionRate] = useState<number>(1)

    // Load persisted state or params on mount
    useEffect(() => {
        if (typeof window === 'undefined') return

        const paramInstrument = searchParams.get('instrument')
        const paramDirection = searchParams.get('direction') as 'long' | 'short' | null
        const paramEntry = searchParams.get('entry')
        const paramSL = searchParams.get('sl')
        const paramTP = searchParams.get('tp')
        const paramLots = searchParams.get('lots')
        const paramDescription = searchParams.get('description')
        const paramStoryPosId = searchParams.get('storyPositionId')

        if (paramInstrument) {
            setSelectedInstrument(paramInstrument)
            if (paramDirection) setDirection(paramDirection)
            if (paramEntry) {
                const ep = parseFloat(paramEntry)
                setEntryPrice(ep)
                setLimitPrice(ep)
                setOrderType('LIMIT')
            }
            if (paramSL) setStopLoss(parseFloat(paramSL))
            if (paramTP) setTakeProfit(parseFloat(paramTP))
            if (paramLots) {
                const multi = getUnitsPerLot(paramInstrument)
                setUnits(Math.round(parseFloat(paramLots) * multi))
            }
            if (paramDescription) setStrategyExplanation(paramDescription)
            if (paramStoryPosId) setStoryPositionId(paramStoryPosId)
            return 
        }

        try {
            const saved = localStorage.getItem('tradeFormState')
            if (saved) {
                const state = JSON.parse(saved)
                if (state.selectedInstrument) setSelectedInstrument(state.selectedInstrument)
                if (state.direction) setDirection(state.direction)
                if (state.units) setUnits(state.units)
                if (state.stopLoss) setStopLoss(state.stopLoss)
                if (state.takeProfit) setTakeProfit(state.takeProfit)
                if (state.orderType) setOrderType(state.orderType)
            }
        } catch (err) {
            console.error('Failed to restore trade form state:', err)
        }
    }, [searchParams])

    // Persist state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const state = {
                    selectedInstrument,
                    direction,
                    units,
                    stopLoss,
                    takeProfit,
                    orderType,
                    timestamp: Date.now()
                }
                localStorage.setItem('tradeFormState', JSON.stringify(state))
            } catch (err) {
                console.error('Failed to save trade form state:', err)
            }
        }
    }, [selectedInstrument, direction, units, stopLoss, takeProfit, orderType])

    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const res = await fetch('/api/sentiment')
                if (res.ok) {
                    const data = await res.json()
                    setMarketSentiment(data)
                }
            } catch (err) {
                console.error('Failed to fetch sentiment:', err)
            }
        }
        fetchSentiment()
    }, [])

    // Reset price flag when instrument changes to fetch new initial price
    useEffect(() => {
        setHasSetInitialPrice(false)
    }, [selectedInstrument])

    const instrumentDetails = instruments.find(i => i.name === selectedInstrument)
    const pipLocation = instrumentDetails?.pipLocation || -4

    const fetchPrice = async () => {
        try {
            const isCryptoSel = isCryptoInstrument(selectedInstrument)
            const baseCurrency = isCryptoSel ? selectedInstrument.replace('CRYPTO_', '').split('_')[0] : selectedInstrument.split('_')[0]
            const quoteCurrency = isCryptoSel ? 'USD' : selectedInstrument.split('_')[1]
            const accountCurrency = accountInfo?.account?.currency || accountInfo?.currency || 'USD'

            const instrumentsToFetch = [selectedInstrument]
            let quoteConversionPair: string | null = null
            let quoteInverseConversionPair: string | null = null
            let baseConversionPair: string | null = null
            let baseInverseConversionPair: string | null = null

            // Crypto pairs are USD-denominated — no conversion pairs needed
            if (!isCryptoSel) {
                // Fetch quote→account conversion if needed
                if (quoteCurrency !== accountCurrency) {
                    quoteConversionPair = `${quoteCurrency}_${accountCurrency}`
                    quoteInverseConversionPair = `${accountCurrency}_${quoteCurrency}`
                    instrumentsToFetch.push(quoteConversionPair, quoteInverseConversionPair)
                }

                // Fetch base→account conversion if needed (for margin calculation)
                if (baseCurrency !== accountCurrency) {
                    baseConversionPair = `${baseCurrency}_${accountCurrency}`
                    baseInverseConversionPair = `${accountCurrency}_${baseCurrency}`
                    instrumentsToFetch.push(baseConversionPair, baseInverseConversionPair)
                }
            }

            const res = await fetch(`/api/oanda/prices?instruments=${instrumentsToFetch.join(',')}`)
            const data = await res.json()

            const prices = data.prices || []
            const price = prices.find((p: any) => p.instrument === selectedInstrument)
            
            if (price) {
                setCurrentPrice(price)
                const marketPrice = direction === 'long' ? parseFloat(price.asks[0].price) : parseFloat(price.bids[0].price)

                // Only set initial price once, then only update if MARKET order
                if (!hasSetInitialPrice || (orderType === 'MARKET' && entryPrice !== 0)) {
                    setEntryPrice(marketPrice)
                    if (limitPrice === 0) setLimitPrice(marketPrice)
                    setHasSetInitialPrice(true)
                }
            }

            // Set quote→account conversion rate (for P&L calculation)
            if (quoteCurrency === accountCurrency) {
                setConversionRate(1)
            } else {
                const convPrice = prices.find((p: any) => p.instrument === quoteConversionPair)
                if (convPrice) {
                    const mid = (parseFloat(convPrice.asks[0].price) + parseFloat(convPrice.bids[0].price)) / 2
                    setConversionRate(mid)
                } else {
                    const invConvPrice = prices.find((p: any) => p.instrument === quoteInverseConversionPair)
                    if (invConvPrice) {
                        const mid = (parseFloat(invConvPrice.asks[0].price) + parseFloat(invConvPrice.bids[0].price)) / 2
                        setConversionRate(1 / mid)
                    } else {
                        setConversionRate(1)
                    }
                }
            }

            // Set base→account conversion rate (for margin calculation)
            if (baseCurrency === accountCurrency) {
                setBaseConversionRate(1)
            } else {
                const baseConvPrice = prices.find((p: any) => p.instrument === baseConversionPair)
                if (baseConvPrice) {
                    const mid = (parseFloat(baseConvPrice.asks[0].price) + parseFloat(baseConvPrice.bids[0].price)) / 2
                    setBaseConversionRate(mid)
                } else {
                    const baseInvConvPrice = prices.find((p: any) => p.instrument === baseInverseConversionPair)
                    if (baseInvConvPrice) {
                        const mid = (parseFloat(baseInvConvPrice.asks[0].price) + parseFloat(baseInvConvPrice.bids[0].price)) / 2
                        setBaseConversionRate(1 / mid)
                    } else {
                        // Fallback: estimate from entry price if it's a cross pair
                        // For GBP/JPY: GBP→USD ≈ entry_price * (JPY→USD)
                        if (quoteCurrency !== accountCurrency && price) {
                            const quoteMid = conversionRate // Already calculated above
                            const entryMid = (parseFloat(price.asks[0].price) + parseFloat(price.bids[0].price)) / 2
                            setBaseConversionRate(entryMid * quoteMid)
                        } else {
                            setBaseConversionRate(1)
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchPrice()
        const interval = setInterval(fetchPrice, 5000)
        return () => clearInterval(interval)
    }, [selectedInstrument, direction, orderType, accountInfo])

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!stopLoss || stopLoss === 0) {
                setValidation(null)
                return
            }
            setIsValidating(true)
            try {
                const res = await fetch('/api/risk/validate', {
                    method: 'POST',
                    body: JSON.stringify({
                        instrument: selectedInstrument,
                        direction,
                        units,
                        entryPrice: orderType === 'LIMIT' ? limitPrice : entryPrice,
                        stopLoss,
                        takeProfit: takeProfit || undefined,
                        orderType
                    }),
                    headers: { 'Content-Type': 'application/json' }
                })
                const data = await res.json()
                setValidation(data)
            } catch (err) {
                console.error(err)
            } finally {
                setIsValidating(false)
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [selectedInstrument, direction, units, entryPrice, limitPrice, stopLoss, takeProfit, orderType])

    const handleExecute = async () => {
        if (confirmText !== 'CONFIRM') return
        setIsExecuting(true)
        try {
            const res = await fetch('/api/trade/execute', {
                method: 'POST',
                body: JSON.stringify({
                    instrument: selectedInstrument,
                    direction,
                    units,
                    entryPrice,
                    limitPrice,
                    stopLoss,
                    takeProfit,
                    orderType,
                    name: name || null,
                    strategy_explanation: strategyExplanation || null
                }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Execution failed' }))
                alert(errorData.error || 'Execution failed')
                setIsExecuting(false)
                return
            }

            const data = await res.json()
            setExecutionResult(data)
            setShowConfirm(false)

            if (storyPositionId) {
                await fetch(`/api/story/positions/${storyPositionId}/activate`, {
                    method: 'POST',
                    body: JSON.stringify({ entry_price: entryPrice }),
                    headers: { 'Content-Type': 'application/json' },
                }).catch(console.error)
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem('tradeFormState')
            }
        } catch (err) {
            alert('Network error')
        } finally {
            setIsExecuting(false)
        }
    }

    const handlePlanTrade = async () => {
        if (!stopLoss) return
        setIsPlanning(true)
        try {
            const res = await fetch('/api/trade/plan', {
                method: 'POST',
                body: JSON.stringify({
                    instrument: selectedInstrument,
                    direction,
                    units,
                    entryPrice,
                    limitPrice,
                    stopLoss,
                    takeProfit,
                    orderType,
                    name: name || null,
                    strategy_explanation: strategyExplanation || null
                }),
                headers: { 'Content-Type': 'application/json' }
            })

            if (res.ok) {
                const data = await res.json()
                setPlanResult(data)
                if (typeof window !== 'undefined') localStorage.removeItem('tradeFormState')
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsPlanning(false)
        }
    }

    const handleDeskReview = async () => {
        if (!stopLoss || !takeProfit) return
        setIsReviewing(true)
        setDeskReview(null)
        try {
            const res = await fetch('/api/desk/review', {
                method: 'POST',
                body: JSON.stringify({
                    pair: selectedInstrument,
                    direction,
                    entry_price: orderType === 'LIMIT' ? limitPrice : entryPrice,
                    stop_loss: stopLoss,
                    take_profit: takeProfit,
                    lot_size: units / getUnitsPerLot(selectedInstrument),
                    reasoning: strategyExplanation || undefined,
                }),
                headers: { 'Content-Type': 'application/json' },
            })

            if (res.ok) {
                const data = await res.json()
                setDeskReview(data.meeting)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsReviewing(false)
        }
    }

    const assetCfg = getAssetConfig(selectedInstrument)
    const activeEntryPrice = orderType === 'LIMIT' ? limitPrice : entryPrice
    const accountCurrency = accountInfo?.account?.currency || accountInfo?.currency || 'USD'

    // Risk calculations — price_diff * units = PnL in quote currency, then convert to account
    const riskPips = Math.abs(activeEntryPrice - stopLoss) * assetCfg.pointMultiplier
    const riskAmount = Math.abs(activeEntryPrice - stopLoss) * units * conversionRate
    const rewardPips = takeProfit ? Math.abs(takeProfit - activeEntryPrice) * assetCfg.pointMultiplier : 0
    const rewardAmount = takeProfit ? Math.abs(takeProfit - activeEntryPrice) * units * conversionRate : 0
    const rrRatio = riskPips > 0 ? (rewardPips / riskPips).toFixed(2) : '0'
    const accountBalance = parseFloat(accountInfo?.account?.balance || accountInfo?.balance || '1')
    const riskPercent = (riskAmount / accountBalance) * 100

    const marketSnapshot = getMarketSessions(new Date())
    const bidPrice = currentPrice ? parseFloat(currentPrice.bids[0].price) : 0
    const askPrice = currentPrice ? parseFloat(currentPrice.asks[0].price) : 0
    const liveSpread = (askPrice - bidPrice) * assetCfg.pointMultiplier
    const label = assetCfg.pointLabel

    // Margin calculation
    const isCrypto = isCryptoInstrument(selectedInstrument)
    const marginRate = instrumentDetails?.marginRate ? parseFloat(instrumentDetails.marginRate) : 0.05
    const baseCurrency = isCrypto ? selectedInstrument.replace('CRYPTO_', '').split('_')[0] : selectedInstrument.split('_')[0]
    const quoteCurrency = isCrypto ? 'USD' : selectedInstrument.split('_')[1]
    let marginRequired: number

    if (isCrypto) {
        // Crypto spot: no leverage — margin = full position value (units * price)
        marginRequired = units * activeEntryPrice
    } else if (baseCurrency === accountCurrency) {
        // USD/JPY on USD account: base IS account currency → margin = units * marginRate
        marginRequired = units * marginRate
    } else if (quoteCurrency === accountCurrency) {
        // EUR/USD on USD account: entry price IS base→account rate → margin = units * marginRate * price
        marginRequired = units * marginRate * activeEntryPrice
    } else {
        // GBP/JPY on USD account: need base→account conversion rate
        // Margin = units * marginRate * baseConversionRate
        marginRequired = units * marginRate * baseConversionRate
    }

    if (executionResult) {
        return (
            <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-12 text-center space-y-8">
                <div className="w-24 h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-premium-white">Order Executed</h2>
                    <p className="text-neutral-500 mt-2">Trade has been logged in your journal.</p>
                </div>
                <button onClick={() => setExecutionResult(null)} className="text-neutral-500 hover:text-white font-bold text-sm">Return to Terminal</button>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-8 p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form Section */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-2 flex gap-2">
                            <button onClick={() => setOrderType('MARKET')} className={`flex-1 py-3 rounded-2xl font-bold transition-all ${orderType === 'MARKET' ? 'bg-neutral-800 text-white shadow-inner' : 'text-neutral-500'}`}>Market</button>
                            <button onClick={() => setOrderType('LIMIT')} className={`flex-1 py-3 rounded-2xl font-bold transition-all ${orderType === 'LIMIT' ? 'bg-neutral-800 text-white shadow-inner' : 'text-neutral-500'}`}>Limit</button>
                        </div>

                        <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-4 md:p-10 space-y-6 md:space-y-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                                <div className="md:col-span-2 space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Trade Name</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bullish Breakout" className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-bold outline-none" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Instrument</label>
                                    <select value={selectedInstrument} onChange={(e) => setSelectedInstrument(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-bold outline-none">
                                        {instruments.map(i => <option key={i.name} value={i.name}>{i.displayName}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Direction</label>
                                    <div className="flex bg-neutral-800 p-1.5 rounded-2xl border border-neutral-700">
                                        <button onClick={() => setDirection('long')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${direction === 'long' ? 'bg-green-600 text-white' : 'text-neutral-500'}`}>Long</button>
                                        <button onClick={() => setDirection('short')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${direction === 'short' ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>Short</button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Position Size</label>
                                        <div className="flex gap-1 bg-neutral-800/50 p-1 rounded-lg">
                                            <button
                                                onClick={() => setSizeMode('units')}
                                                className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${sizeMode === 'units' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                                            >
                                                Units
                                            </button>
                                            <button
                                                onClick={() => setSizeMode('margin')}
                                                className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${sizeMode === 'margin' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                                            >
                                                {isCrypto ? 'USD' : 'Margin'}
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="number"
                                        step={isCrypto ? '0.00001' : '1'}
                                        value={sizeMode === 'margin'
                                            ? (marginRequired || '')
                                            : (units || '')}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0
                                            if (sizeMode === 'margin') {
                                                if (isCrypto) {
                                                    // Crypto: units = USD amount / price
                                                    const calculatedUnits = activeEntryPrice > 0 ? val / activeEntryPrice : 0
                                                    setUnits(calculatedUnits > 0 ? parseFloat(calculatedUnits.toFixed(8)) : 0.00001)
                                                } else {
                                                    // Forex: units = margin / (marginRate * baseConversionRate)
                                                    const calculatedUnits = Math.round(val / (marginRate * baseConversionRate))
                                                    setUnits(calculatedUnits > 0 ? calculatedUnits : 1)
                                                }
                                            } else {
                                                setUnits(isCrypto ? parseFloat(val.toFixed(8)) || 0 : Math.round(val))
                                            }
                                        }}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-mono font-bold outline-none"
                                    />
                                    <p className="text-[10px] text-neutral-500 font-mono">
                                        {sizeMode === 'margin'
                                            ? (isCrypto ? `≈ ${units} ${baseCurrency}` : `≈ ${units.toLocaleString()} units`)
                                            : (isCrypto ? `≈ $${marginRequired.toFixed(2)} position value` : `≈ ${marginRequired.toFixed(2)} ${accountCurrency} margin`)}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Entry Price</label>
                                    <input type="number" step="0.00001" value={orderType === 'MARKET' ? entryPrice : limitPrice} disabled={orderType === 'MARKET'} onChange={(e) => setLimitPrice(parseFloat(e.target.value))} className="w-full bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-mono font-bold outline-none" />
                                    {currentPrice && (
                                        <div className="flex justify-between text-[10px] font-mono">
                                            <span className="text-red-400">BID: {bidPrice.toFixed(instrumentDetails?.displayPrecision || 5)}</span>
                                            <span className="text-green-400">ASK: {askPrice.toFixed(instrumentDetails?.displayPrecision || 5)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Stop Loss</label>
                                    <input type="number" step="0.00001" value={stopLoss || ''} onChange={(e) => setStopLoss(parseFloat(e.target.value))} className="w-full bg-neutral-800 border border-red-500/30 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-mono font-bold outline-none" />
                                    {stopLoss > 0 && <p className="text-[10px] text-red-400 font-mono">Risk: {riskAmount.toFixed(2)} {accountCurrency}</p>}
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Take Profit</label>
                                    <input type="number" step="0.00001" value={takeProfit || ''} onChange={(e) => setTakeProfit(parseFloat(e.target.value))} className="w-full bg-neutral-800 border border-green-500/30 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white font-mono font-bold outline-none" />
                                    {takeProfit > 0 && <p className="text-[10px] text-green-400 font-mono">Reward: {rewardAmount.toFixed(2)} {accountCurrency}</p>}
                                </div>
                            </div>

                             <div className="space-y-4 pt-4 border-t border-neutral-800">
                                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Strategy Execution Context</label>
                                <textarea value={strategyExplanation} onChange={(e) => setStrategyExplanation(e.target.value)} placeholder="Reasoning..." className="w-full h-32 bg-neutral-800 border border-neutral-700 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-white text-sm outline-none resize-none" />
                            </div>
                        </div>

                        {/* Market Snapshot Indicator */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full animate-pulse ${currentPrice ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                <div>
                                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">OANDA STREAM</p>
                                    <p className="text-xs font-bold text-white tracking-tight">LIVE POLLING {currentPrice ? '@ ' + askPrice.toFixed(instrumentDetails?.displayPrecision || 5) : 'PENDING...'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {marketSnapshot.activeSessions.map(s => (
                                    <span key={s} className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-[9px] font-bold text-premium-white uppercase tracking-wider">{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* Visual Risk Gauge */}
                        <TradeRiskGauge
                            riskPercent={riskPercent}
                            rrRatio={parseFloat(rrRatio)}
                            passedValidation={validation?.passed || false}
                        />

                        {/* Risk Metrics */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-4 md:p-8 space-y-6">
                            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={14} className="text-blue-400" />
                                Trade Metrics
                            </h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">Opening Spread</span>
                                    <span className="text-blue-400 font-mono font-bold">{liveSpread.toFixed(1)} {label}</span>
                                </div>
                                {instrumentDetails?.financing && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-neutral-500">Overnight Cost</span>
                                        <span className="text-amber-400 font-mono font-bold">
                                            {(direction === 'long'
                                                ? parseFloat(instrumentDetails.financing.longRate)
                                                : parseFloat(instrumentDetails.financing.shortRate)).toFixed(4)}%
                                        </span>
                                    </div>
                                )}
                                <div className="h-[1px] bg-neutral-800/50 my-2" />
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">Distance to SL</span>
                                    <span className="text-red-400 font-mono font-bold">{riskPips.toFixed(1)} {label}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">Distance to TP</span>
                                    <span className="text-green-400 font-mono font-bold">{rewardPips.toFixed(1)} {label}</span>
                                </div>
                                <div className="h-[1px] bg-neutral-800/50 my-2" />
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">Risk Amount</span>
                                    <span className="text-red-400 font-bold">{riskAmount.toFixed(2)} {accountCurrency}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">Reward Amount</span>
                                    <span className="text-green-400 font-bold">{rewardAmount.toFixed(2)} {accountCurrency}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-neutral-500">R:R Ratio</span>
                                    <span className="text-blue-400 font-bold">1:{rrRatio}</span>
                                </div>
                                <div className="h-[1px] bg-neutral-800/50 my-2" />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-neutral-600">Margin Required</span>
                                    <span className="text-neutral-400 font-mono italic">~{marginRequired.toFixed(2)} {accountCurrency}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-700 uppercase tracking-tighter">Est. Account Power</span>
                                    <span className="text-neutral-500 font-bold">{accountCurrency} {accountBalance.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={handlePlanTrade} disabled={!stopLoss || isPlanning} className="flex-1 py-4 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-2xl font-bold flex items-center justify-center gap-2">
                                    {isPlanning ? <Loader2 size={16} className="animate-spin" /> : <Bookmark size={16} />}
                                    Plan
                                </button>
                                <button onClick={handleDeskReview} disabled={!stopLoss || !takeProfit || isReviewing} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                                    {isReviewing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                    Review
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {planResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
                    <div className="bg-neutral-900 p-8 rounded-[2rem] border border-amber-500/30 max-w-sm w-full text-center space-y-6">
                        <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto"><Bookmark className="text-amber-400" /></div>
                        <h3 className="text-xl font-bold text-white">Trade Planned</h3>
                        <p className="text-sm text-neutral-400">Successfully saved to your journal.</p>
                        <button onClick={() => setPlanResult(null)} className="w-full py-4 bg-neutral-800 text-white rounded-xl font-bold">Dismiss</button>
                    </div>
                </div>
            )}

            {deskReview && !showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60 overflow-y-auto">
                    <div className="bg-neutral-900 p-8 rounded-[2rem] border border-neutral-800 max-w-2xl w-full my-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Desk Review</h3>
                            <button onClick={() => setDeskReview(null)} className="text-neutral-500 hover:text-white"><XCircle /></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Ray */}
                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-2">
                                <p className="text-[10px] font-bold text-blue-400 uppercase">Ray Analysis</p>
                                <p className="text-xs text-neutral-300 italic">"{deskReview.ray_analysis?.message}"</p>
                            </div>
                            {/* Sarah */}
                            <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-2">
                                <p className="text-[10px] font-bold text-rose-400 uppercase">Sarah Report</p>
                                <p className="text-xs text-neutral-300 italic">"{deskReview.sarah_report?.message}"</p>
                            </div>
                        </div>
                        {/* Alex */}
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-2">
                            <p className="text-[10px] font-bold text-emerald-400 uppercase">Alex Brief</p>
                            <p className="text-xs text-neutral-300 italic">"{deskReview.alex_brief?.message}"</p>
                        </div>
                        {/* Marcus */}
                        <div className="p-6 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white">M</div>
                                <p className="text-sm font-bold text-white">Marcus Verdict</p>
                            </div>
                            <p className="text-sm text-neutral-300">{deskReview.marcus_directive?.message}</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setDeskReview(null)} className="flex-1 py-4 bg-neutral-800 text-white rounded-xl font-bold">Adjust</button>
                            {deskReview.marcus_directive?.desk_verdict !== 'blocked' && (
                                <button onClick={() => { setDeskReview(null); setShowConfirm(true) }} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold">Proceed</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
                    <div className="bg-neutral-900 p-10 rounded-[3rem] border border-neutral-800 max-w-lg w-full space-y-8">
                        <h3 className="text-2xl font-bold text-white">Confirm Order</h3>
                        <div className="bg-neutral-800 p-6 rounded-2xl space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-neutral-500">Instrument</span><span className="font-bold">{selectedInstrument}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-neutral-500">Size</span><span className="font-bold">{isCryptoInstrument(selectedInstrument) ? `${units} ${selectedInstrument.replace('CRYPTO_', '').split('_')[0]}` : `${(units / getUnitsPerLot(selectedInstrument)).toFixed(2)} lots (${units} units)`}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-neutral-400">Risk</span><span className="font-bold text-red-400">{riskAmount.toFixed(2)} {accountCurrency}</span></div>
                        </div>
                        <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="TYPE 'CONFIRM'" className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 text-center font-bold text-white outline-none" />
                        <div className="flex gap-4">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-4 bg-neutral-800 text-white rounded-xl font-bold">Cancel</button>
                            <button onClick={handleExecute} disabled={confirmText !== 'CONFIRM' || isExecuting} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold">{isExecuting ? 'Executing...' : 'Execute'}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
