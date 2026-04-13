'use client'

import React, { useState, useEffect } from 'react'
import { Wallet, TrendingUp, Shield, RefreshCw, AlertCircle, BarChart3, Coins, Zap, ArrowUpRight, ArrowDownRight, Repeat } from 'lucide-react'
import Link from 'next/link'

export function KrakenAccountWidget() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastSynced, setLastSynced] = useState<Date | null>(null)

    const fetchAccount = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/kraken/account', { cache: 'no-store' })
            const result = await res.json()

            if (res.ok) {
                setData(result)
                setLastSynced(new Date())
                setError(null)
            } else {
                setError(result.error || 'Failed to fetch Kraken data')
            }
        } catch {
            setError('Connection error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccount()
        const interval = setInterval(fetchAccount, 60000) // Refresh every minute
        return () => clearInterval(interval)
    }, [])

    if (error) {
        return (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-5 flex items-center justify-between group h-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">Kraken Error</h3>
                        <p className="text-[10px] text-rose-400 font-bold leading-tight">{error}</p>
                    </div>
                </div>
                <button
                    onClick={fetchAccount}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl text-rose-500 transition-colors"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
        )
    }

    if (loading && !data) {
        return (
            <div className="bg-neutral-900 border-none rounded-3xl p-5 animate-pulse h-full space-y-4">
                <div className="h-4 w-32 bg-neutral-800 rounded grow" />
                <div className="h-12 w-48 bg-neutral-800 rounded grow" />
            </div>
        )
    }

    const { tradeBalance, heldAssets } = data || {}
    const tradeEquity = parseFloat(tradeBalance?.e || '0')
    const calculatedPortfolioValue = heldAssets?.reduce((sum: number, asset: any) => sum + (asset.usdValue || 0), 0) || 0
    
    // Use the higher of the two (Kraken's trade equity or our calculated asset total)
    const displayEquity = Math.max(tradeEquity, calculatedPortfolioValue)
    
    const unrealizedPnL = parseFloat(tradeBalance?.n || '0')
    const freeMargin = parseFloat(tradeBalance?.mf || '0')
    const isPositive = unrealizedPnL >= 0

    return (
        <div className="bg-neutral-900 border-none rounded-3xl p-5 relative overflow-hidden group h-full flex flex-col justify-between">
            {/* Header - Compact */}
            <div className="flex items-center justify-between mb-2 shrink-0 relative z-10">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Coins className="text-purple-500" size={14} />
                    Kraken Exchange
                </h3>
                {lastSynced && (
                    <span className="text-[9px] text-neutral-700 font-mono tracking-tighter">
                        SYNC {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            <div className="flex flex-col gap-5 py-2 relative z-10 grow">
                {/* Main Balance Container */}
                <div className="flex items-end justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-neutral-500 mb-0.5">
                            <Wallet size={12} className="text-purple-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Total Equity</span>
                        </div>
                        <p className="text-3xl font-black tracking-tighter text-white">
                            ${displayEquity.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            <span className="text-xs ml-1 text-neutral-600 font-bold">USD</span>
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Available</span>
                        <p className="text-sm font-black text-white/90">${(freeMargin / 1).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                </div>

                {/* Held Assets - Liquidation & Swap Center */}
                {data?.heldAssets && data.heldAssets.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1 flex justify-between items-center">
                            Portfolio Holdings
                            <Link href="/trade" className="text-purple-500 hover:text-purple-400 normal-case tracking-normal font-bold">Manage all →</Link>
                        </h4>
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-none pr-1">
                            {data.heldAssets.map((asset: any) => (
                                <div key={asset.asset} className="bg-neutral-950/60 rounded-xl p-3 border border-neutral-800/50 flex items-center justify-between group/asset hover:border-purple-500/30 hover:bg-neutral-900/40 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-black text-[10px] text-purple-400 group-hover/asset:border-purple-500/20 transition-colors">
                                            {asset.symbol}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-[11px] font-black text-white">{asset.balance.toFixed(asset.symbol === 'BTC' ? 4 : 2)} {asset.symbol}</p>
                                                {asset.usdValue > 100 && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse" />
                                                )}
                                            </div>
                                            <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter">${asset.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD</p>
                                        </div>
                                    </div>
                                    
                                    {asset.symbol !== 'USD' && (
                                        <div className="flex gap-1">
                                            {/* Sell Max (Liquidate to Cash) */}
                                            <Link 
                                                href={`/trade?instrument=CRYPTO_${asset.symbol}_USD&direction=short&lots=${asset.balance}&description=Liquidating ${asset.symbol} holdings for cash`}
                                                className="p-2 bg-rose-500/5 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all border border-rose-500/10 hover:border-rose-500/40"
                                                title="Sell Max (Cash Out)"
                                            >
                                                <ArrowDownRight size={14} />
                                            </Link>
                                            
                                            {/* Buy More */}
                                            <Link 
                                                href={`/trade?instrument=CRYPTO_${asset.symbol}_USD&direction=long&description=Increasing ${asset.symbol} exposure`}
                                                className="p-2 bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-all border border-emerald-500/10 hover:border-emerald-500/40"
                                                title="Buy More"
                                            >
                                                <ArrowUpRight size={14} />
                                            </Link>

                                            {/* Swap (Select new target) */}
                                            <Link 
                                                href={`/trade?instrument=CRYPTO_${asset.symbol}_USD&direction=short&lots=${asset.balance}&description=Swapping ${asset.symbol} for another asset`}
                                                className="p-2 bg-purple-500/5 hover:bg-purple-500/20 text-purple-600 rounded-lg transition-all border border-purple-500/10 hover:border-purple-500/40"
                                                title="Swap (Sell then Buy Other)"
                                            >
                                                <Repeat size={14} />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Market Quick Links (Buy Again / New Opportunities) */}
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black text-neutral-600 uppercase tracking-widest px-1">Market Watch</h4>
                    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                        {['BTC', 'ETH', 'SOL', 'XRP'].map(sym => (
                            <Link 
                                key={sym}
                                href={`/trade?instrument=CRYPTO_${sym}_USD&direction=long`}
                                className="flex-none px-3 py-1.5 bg-neutral-950/40 border border-neutral-800 rounded-lg text-[10px] font-bold text-neutral-400 hover:text-white hover:border-neutral-700 transition-all"
                            >
                                {sym} +
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Account Status Footer */}
            <div className="mt-4 flex items-center justify-between shrink-0 relative z-10 border-t border-neutral-800/50 pt-4 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse" />
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Kraken Execution Live</span>
                </div>
                <div className="flex items-center gap-3">
                    <Link 
                        href="/trade"
                        className="text-[9px] font-black text-purple-400 hover:text-purple-300 uppercase tracking-[0.1em] flex items-center gap-1.5 bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20 transition-all shadow-lg shadow-purple-900/20"
                    >
                        <Zap size={11} className="fill-purple-400" />
                        Quick Buy BTC
                    </Link>
                    <button
                        onClick={fetchAccount}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-400 hover:text-white transition-all shadow-inner"
                        title="Force Refresh Data"
                    >
                        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Background Accent */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 blur-[60px] pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700" />
        </div>
    )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ')
}
