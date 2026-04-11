'use client'

import React, { useState, useEffect } from 'react'
import { Wallet, TrendingUp, Shield, RefreshCw, AlertCircle, BarChart3, Coins } from 'lucide-react'

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

    const { tradeBalance } = data || {}
    const equity = parseFloat(tradeBalance?.e || '0')
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
                {/* Main Balance */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-neutral-500 mb-0.5">
                        <Wallet size={12} className="text-purple-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Equity Value</span>
                    </div>
                    <p className="text-3xl font-black tracking-tighter text-white">
                        ${equity.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        <span className="text-xs ml-1 text-neutral-600 font-bold">USD equiv</span>
                    </p>
                </div>

                {/* Sub-metrics Grid */}
                <div className="grid grid-cols-2 gap-2 shrink-0">
                    <div className="bg-neutral-950/40 rounded-2xl p-4 border border-neutral-800/50 hover:border-neutral-700/50 transition-colors group/stat">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1.5 px-0.5">
                            <TrendingUp size={10} className={isPositive ? 'text-emerald-500' : 'text-rose-500'} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Unrealized</span>
                        </div>
                        <p className={`text-sm font-black tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-500 underline decoration-rose-500/20 underline-offset-4'}`}>
                            {isPositive ? '+' : ''}
                            {unrealizedPnL.toFixed(2)}
                        </p>
                    </div>

                    <div className="bg-neutral-950/40 rounded-2xl p-4 border border-neutral-800/50 hover:border-neutral-700/50 transition-colors group/stat">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1.5 px-0.5">
                            <Shield size={10} className="text-purple-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Available</span>
                        </div>
                        <p className="text-sm font-black tracking-tight text-white/90">
                            ${(freeMargin / 1000).toFixed(1)}k
                        </p>
                    </div>
                </div>
            </div>

            {/* Account Status Footer */}
            <div className="mt-4 flex items-center justify-between shrink-0 relative z-10 px-1">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse" />
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Kraken Connected</span>
                </div>
                <button
                    onClick={fetchAccount}
                    className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-white transition-all shadow-inner"
                    title="Refresh Data"
                >
                    <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                </button>
            </div>

            {/* Background Accent */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/10 blur-[60px] pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700" />
        </div>
    )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ')
}
