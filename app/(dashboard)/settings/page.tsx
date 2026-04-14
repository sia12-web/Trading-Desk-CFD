'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Globe, RefreshCw, Key, CreditCard, CheckCircle2, XCircle, Monitor, Wallet, Trash2, AlertTriangle, Send, Clock, Bell, Zap, TrendingUp, Brain, Sparkles, Cpu, Timer, Target, Ghost } from 'lucide-react'

interface ConnectionResult {
    connected: boolean
    accountId?: string
    mode?: string
    error?: string
    config?: {
        demo: { configured: boolean; accountId?: string }
        live: { configured: boolean; accountId?: string }
    }
}

interface ModelTest {
    name: string
    model: string
    role: string
    connected: boolean
    responseTime?: number
    error?: string
    version?: string
}

interface AIConnectionResult {
    connected: boolean
    models: ModelTest[]
    config: {
        claude: { configured: boolean; model: string }
        gemini: { configured: boolean; model: string }
        deepseek: { configured: boolean; model: string }
    }
}

export default function SettingsPage() {
    const [connection, setConnection] = useState<ConnectionResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeMode, setActiveMode] = useState<'demo' | 'live'>('demo')
    const [manuallyTested, setManuallyTested] = useState(false)

    // Telegram Mentor settings
    const [telegramChatId, setTelegramChatId] = useState('')
    const [telegramEnabled, setTelegramEnabled] = useState(false)
    const [correlationAlertsEnabled, setCorrelationAlertsEnabled] = useState(false)
    const [killzoneAlertsEnabled, setKillzoneAlertsEnabled] = useState(true)
    const [wakeUpTime, setWakeUpTime] = useState('06:00')
    const [tradingStartTime, setTradingStartTime] = useState('07:00')
    const [tradingEndTime, setTradingEndTime] = useState('21:00')
    const [enableHourlyCheckins, setEnableHourlyCheckins] = useState(true)
    const [enableBreakReminders, setEnableBreakReminders] = useState(true)
    const [savingPrefs, setSavingPrefs] = useState(false)

    // Auto-Execution settings
    const [autoExecEnabled, setAutoExecEnabled] = useState(false)
    const [autoExecDryRun, setAutoExecDryRun] = useState(true)
    const [autoExecMaxTrades, setAutoExecMaxTrades] = useState(3)
    const [autoExecRiskAmount, setAutoExecRiskAmount] = useState(17)
    const [autoExecMinConfidence, setAutoExecMinConfidence] = useState(60)

    // Regime Engine Settings
    const [regimeEngineEnabled, setRegimeEngineEnabled] = useState(false)
    const [regimeEngineDryRun, setRegimeEngineDryRun] = useState(true)
    const [regimeEngineMaxTrades, setRegimeEngineMaxTrades] = useState(5)
    const [regimeEngineRiskAmount, setRegimeEngineRiskAmount] = useState(10)
    const [regimeEngineMinConfidence, setRegimeEngineMinConfidence] = useState(0.7)
    const [regimeEngineCooldown, setRegimeEngineCooldown] = useState(60)
    const [regimeEngineTrapEnabled, setRegimeEngineTrapEnabled] = useState(true)
    const [regimeEngineKillzoneEnabled, setRegimeEngineKillzoneEnabled] = useState(true)
    const [regimeEngineMomentumEnabled, setRegimeEngineMomentumEnabled] = useState(true)
    const [regimeEngineGhostEnabled, setRegimeEngineGhostEnabled] = useState(true)

    // Telegram testing state
    const [testingTelegram, setTestingTelegram] = useState(false)

    // AI Connections state
    const [aiConnection, setAiConnection] = useState<AIConnectionResult | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiManuallyTested, setAiManuallyTested] = useState(false)

    // Cron Jobs state
    const [cronResults, setCronResults] = useState<any>(null)
    const [cronLoading, setCronLoading] = useState(false)



    // Kraken Connection state
    const [krakenConnection, setKrakenConnection] = useState<any>(null)
    const [krakenLoading, setKrakenLoading] = useState(false)
    const [krakenManuallyTested, setKrakenManuallyTested] = useState(false)




    const checkConnection = async (isManual = false) => {
        setLoading(true)
        if (isManual) setManuallyTested(true)
        try {
            const res = await fetch('/api/oanda/connection', { cache: 'no-store' })
            const result = await res.json()
            setConnection(result)
        } catch (err) {
            setConnection({ connected: false, error: 'Failed to reach API' })
        } finally {
            setLoading(false)
        }
    }

    const checkAIConnections = async (isManual = false) => {
        setAiLoading(true)
        if (isManual) setAiManuallyTested(true)
        try {
            const res = await fetch('/api/ai-connections', { cache: 'no-store' })
            const result = await res.json()
            setAiConnection(result)
        } catch (err) {
            setAiConnection({
                connected: false,
                models: [],
                config: {
                    claude: { configured: false, model: '' },
                    gemini: { configured: false, model: '' },
                    deepseek: { configured: false, model: '' },
                },
            })
        } finally {
            setAiLoading(false)
        }
    }

    const checkKrakenConnection = async (isManual = false) => {
        setKrakenLoading(true)
        if (isManual) setKrakenManuallyTested(true)
        try {
            const res = await fetch('/api/kraken/connection', { cache: 'no-store' })
            const result = await res.json()
            setKrakenConnection(result)
        } catch (err) {
            setKrakenConnection({ connected: false, configured: false, error: 'Failed to reach API' })
        } finally {
            setKrakenLoading(false)
        }
    }

    const testCronJobs = async () => {
        setCronLoading(true)
        try {
            const res = await fetch('/api/cron/test', { cache: 'no-store' })
            const data = await res.json()
            setCronResults(data)
        } catch {
            setCronResults({ allPassed: false, jobs: [] })
        } finally {
            setCronLoading(false)
        }
    }

    useEffect(() => {
        checkConnection(false)
        checkAIConnections(false)
        checkKrakenConnection(false)
        loadPreferences()
        // Read current mode from cookie
        const cookies = document.cookie.split(';').reduce((acc, c) => {
            const [key, val] = c.trim().split('=')
            acc[key] = val
            return acc
        }, {} as Record<string, string>)
        setActiveMode((cookies['oanda-mode'] as 'demo' | 'live') || 'demo')
    }, [])

    const loadPreferences = async () => {
        try {
            const res = await fetch('/api/notifications/preferences')
            const data = await res.json()
            const prefs = data.preferences
            if (prefs) {
                setTelegramChatId(prefs.telegram_chat_id || '')
                setTelegramEnabled(prefs.telegram_enabled || false)
                setCorrelationAlertsEnabled(prefs.correlation_alerts_enabled || false)
                setKillzoneAlertsEnabled(prefs.killzone_alerts_enabled ?? true)
                setWakeUpTime(prefs.wake_up_time || '06:00')
                setTradingStartTime(prefs.trading_start_time || '07:00')
                setTradingEndTime(prefs.trading_end_time || '21:00')
                setEnableHourlyCheckins(prefs.enable_hourly_checkins ?? true)
                setEnableBreakReminders(prefs.enable_break_reminders ?? true)
                setAutoExecEnabled(prefs.auto_execution_enabled ?? false)
                setAutoExecDryRun(prefs.auto_execution_dry_run ?? true)
                setAutoExecMaxTrades(prefs.auto_execution_max_trades_per_day ?? 3)
                setAutoExecRiskAmount(prefs.auto_execution_risk_amount ?? 17)
                setAutoExecMinConfidence(prefs.auto_execution_min_confidence ?? 60)
                setRegimeEngineEnabled(prefs.regime_engine_enabled ?? false)
                setRegimeEngineDryRun(prefs.regime_engine_dry_run ?? true)
                setRegimeEngineMaxTrades(prefs.regime_engine_max_trades_per_day ?? 5)
                setRegimeEngineRiskAmount(prefs.regime_engine_risk_amount ?? 10)
                setRegimeEngineMinConfidence(prefs.regime_engine_min_confidence ?? 0.7)
                setRegimeEngineCooldown(prefs.regime_engine_cooldown_minutes ?? 60)
                setRegimeEngineTrapEnabled(prefs.regime_engine_trap_enabled ?? true)
                setRegimeEngineKillzoneEnabled(prefs.regime_engine_killzone_enabled ?? true)
                setRegimeEngineMomentumEnabled(prefs.regime_engine_momentum_enabled ?? true)
                setRegimeEngineGhostEnabled(prefs.regime_engine_ghost_enabled ?? true)
            }
        } catch (err) {
            console.error('Failed to load preferences:', err)
        }
    }

    const savePreferences = async () => {
        setSavingPrefs(true)
        try {
            const res = await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telegram_chat_id: telegramChatId || null,
                    telegram_enabled: telegramEnabled,
                    correlation_alerts_enabled: correlationAlertsEnabled,
                    killzone_alerts_enabled: killzoneAlertsEnabled,
                    wake_up_time: wakeUpTime,
                    trading_start_time: tradingStartTime,
                    trading_end_time: tradingEndTime,
                    enable_hourly_checkins: enableHourlyCheckins,
                    enable_break_reminders: enableBreakReminders,
                    auto_execution_enabled: autoExecEnabled,
                    auto_execution_dry_run: autoExecDryRun,
                    auto_execution_max_trades_per_day: autoExecMaxTrades,
                    auto_execution_risk_amount: autoExecRiskAmount,
                    auto_execution_min_confidence: autoExecMinConfidence,
                    regime_engine_enabled: regimeEngineEnabled,
                    regime_engine_dry_run: regimeEngineDryRun,
                    regime_engine_max_trades_per_day: regimeEngineMaxTrades,
                    regime_engine_risk_amount: regimeEngineRiskAmount,
                    regime_engine_min_confidence: regimeEngineMinConfidence,
                    regime_engine_cooldown_minutes: regimeEngineCooldown,
                    regime_engine_trap_enabled: regimeEngineTrapEnabled,
                    regime_engine_killzone_enabled: regimeEngineKillzoneEnabled,
                    regime_engine_momentum_enabled: regimeEngineMomentumEnabled,
                    regime_engine_ghost_enabled: regimeEngineGhostEnabled,
                })
            })

            if (res.ok) {
                alert('✅ Notification settings saved!')
            } else {
                alert('❌ Failed to save settings')
            }
        } catch (err) {
            alert('❌ Error saving settings')
        } finally {
            setSavingPrefs(false)
        }
    }

    const sendTestTelegram = async () => {
        if (!telegramChatId) {
            alert('⚠️ Please enter a Telegram Chat ID first.')
            return
        }

        setTestingTelegram(true)
        try {
            // Save the chat ID first so it persists
            await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegram_chat_id: telegramChatId })
            })

            const res = await fetch('/api/notifications/telegram/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: telegramChatId })
            })
            const data = await res.json()
            if (res.ok) {
                alert('🎯 Test message sent! Check your Telegram.')
            } else {
                alert(`❌ ${data.error || 'Failed to send test message'}`)
            }
        } catch (err) {
            alert('❌ Local error sending test message')
        } finally {
            setTestingTelegram(false)
        }
    }



    const isDemo = activeMode === 'demo'



    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-20">
            <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Settings</h1>
                <p className="text-neutral-500 mt-2 text-lg">Manage your account connections and preferences.</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Active Account Mode */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${isDemo ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                                {isDemo ? <Monitor size={32} /> : <Wallet size={32} />}
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Active Account</h3>
                                <p className="text-neutral-500 text-sm mt-1">Currently trading on the {isDemo ? 'demo (practice)' : 'live (real money)'} account.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${isDemo ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                            {isDemo ? <Monitor size={16} /> : <Wallet size={16} />}
                            {isDemo ? 'Demo Mode' : 'Live Mode'}
                        </div>
                    </div>

                    <div className="p-10">
                        <p className="text-sm text-neutral-500">
                            Switch between demo and live accounts using the toggle in the top header bar. All data (trades, PnL, account history) is completely isolated between accounts.
                        </p>
                    </div>
                </section>

                {/* OANDA Connection Card */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600/10 text-blue-500 flex items-center justify-center">
                                <Globe size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">OANDA v20 REST API</h3>
                                <p className="text-neutral-500 text-sm mt-1">External brokerage connection for real-time syncing.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${connection?.connected ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {connection?.connected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {connection?.connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>

                    <div className="p-10 space-y-10">
                        {/* Demo Account */}
                        <div className={`p-6 rounded-2xl border ${isDemo ? 'bg-amber-500/5 border-amber-500/20' : 'bg-neutral-800/30 border-neutral-700/50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Monitor size={18} className={isDemo ? 'text-amber-500' : 'text-neutral-500'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${isDemo ? 'text-amber-500' : 'text-neutral-500'}`}>Demo Account</span>
                                {isDemo && <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">Active</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <CreditCard size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Account ID</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm flex items-center justify-between">
                                        <span>
                                            {connection?.config?.demo?.configured 
                                                ? `••••-${connection.config.demo.accountId?.slice(-4)}` 
                                                : !isDemo && !connection?.config?.demo?.configured ? 'Not configured' : 'Loading...'}
                                        </span>
                                        <Shield size={14} className="text-neutral-600" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Environment</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        fxPractice (Demo)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Live Account */}
                        <div className={`p-6 rounded-2xl border ${!isDemo ? 'bg-green-500/5 border-green-500/20' : 'bg-neutral-800/30 border-neutral-700/50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Wallet size={18} className={!isDemo ? 'text-green-500' : 'text-neutral-500'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${!isDemo ? 'text-green-500' : 'text-neutral-500'}`}>Live Account</span>
                                {!isDemo && <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">Active</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <CreditCard size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Account ID</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm flex items-center justify-between">
                                        <span>
                                            {connection?.config?.live?.configured 
                                                ? `••••-${connection.config.live.accountId?.slice(-4)}` 
                                                : isDemo && !connection?.config?.live?.configured ? 'Not configured' : 'Loading...'}
                                        </span>
                                        <Shield size={14} className="text-neutral-600" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Environment</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        fxTrade (Live)
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-sm text-neutral-500 max-w-md">
                                    Connection keys are managed via environment variables for security. To update your keys, modify your <code className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">.env.local</code> file.
                                </p>
                                {manuallyTested && connection && (
                                    <div className={`flex items-center gap-1.5 mt-1 font-bold text-xs ${connection.connected ? 'text-green-400' : 'text-red-400'}`}>
                                        {connection.connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {connection.connected ? 'Connected Successfully!' : `Failed: ${connection.error || 'Check details'}`}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => checkConnection(true)}
                                disabled={loading}
                                className="flex items-center gap-2 px-10 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-neutral-700/50 hover:border-neutral-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                                {loading ? 'Checking...' : 'Test Connection'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Kraken Crypto Exchange Connection */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-purple-600/10 text-purple-500 flex items-center justify-center">
                                <Globe size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Kraken REST API</h3>
                                <p className="text-neutral-500 text-sm mt-1">Cryptocurrency exchange for Bitcoin, Ethereum, and altcoins.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${krakenConnection?.connected ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {krakenConnection?.connected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {krakenConnection?.connected ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>

                    <div className="p-10 space-y-6">
                        <div className="p-6 rounded-2xl border bg-purple-500/5 border-purple-500/20">
                            <div className="flex items-center gap-3 mb-4">
                                <Wallet size={18} className="text-purple-500" />
                                <span className="text-sm font-bold uppercase tracking-widest text-purple-500">Kraken Account</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <CreditCard size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Status</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {krakenConnection?.configured ? 'Configured' : 'Not configured'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Environment</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        Production (api.kraken.com)
                                    </div>
                                </div>
                            </div>
                            {krakenConnection?.connected && krakenConnection.balance && (
                                <div className="mt-4 p-3 bg-neutral-800 rounded-xl border border-neutral-700">
                                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-2">Account Balance</p>
                                    <div className="text-sm font-mono text-neutral-300 space-y-1">
                                        {Object.entries(krakenConnection.balance).slice(0, 5).map(([currency, amount]: [string, any]) => (
                                            <div key={currency} className="flex justify-between">
                                                <span className="text-neutral-500">{currency}:</span>
                                                <span>{parseFloat(amount).toFixed(4)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2">
                                <p className="text-sm text-neutral-500 max-w-md">
                                    Connection keys are managed via environment variables. Update your <code className="text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">.env.local</code> with KRAKEN_API_KEY and KRAKEN_API_SECRET.
                                </p>
                                {krakenManuallyTested && krakenConnection && (
                                    <div className={`flex items-center gap-1.5 mt-1 font-bold text-xs ${krakenConnection.connected ? 'text-green-400' : 'text-red-400'}`}>
                                        {krakenConnection.connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {krakenConnection.connected ? 'Connected Successfully!' : `Failed: ${krakenConnection.error || 'Check details'}`}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => checkKrakenConnection(true)}
                                disabled={krakenLoading}
                                className="flex items-center gap-2 px-10 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-neutral-700/50 hover:border-neutral-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw size={14} className={krakenLoading ? 'animate-spin' : ''} />
                                {krakenLoading ? 'Checking...' : 'Test Connection'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Tri-Model AI Connection */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-violet-600/10 text-violet-500 flex items-center justify-center">
                                <Brain size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Tri-Model AI Pipeline</h3>
                                <p className="text-neutral-500 text-sm mt-1">Multi-agent intelligence system powering all analysis.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${aiConnection?.connected ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {aiConnection?.connected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {aiConnection?.connected ? 'All Online' : 'Offline'}
                        </div>
                    </div>

                    <div className="p-10 space-y-6">
                        {/* Claude - Decision Architect */}
                        <div className={`p-6 rounded-2xl border ${aiConnection?.models.find(m => m.name === 'Claude')?.connected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-neutral-800/30 border-neutral-700/50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles size={18} className={aiConnection?.models.find(m => m.name === 'Claude')?.connected ? 'text-blue-500' : 'text-neutral-500'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${aiConnection?.models.find(m => m.name === 'Claude')?.connected ? 'text-blue-500' : 'text-neutral-500'}`}>Claude — Decision Architect</span>
                                {aiConnection?.models.find(m => m.name === 'Claude')?.connected && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">Online</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Model</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {aiConnection?.config.claude.model || 'claude-opus-4-6'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Cpu size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Version</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        {aiConnection?.models.find(m => m.name === 'Claude')?.version || 'Opus 4.6'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Clock size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Response Time</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {aiConnection?.models.find(m => m.name === 'Claude')?.responseTime
                                            ? `${aiConnection.models.find(m => m.name === 'Claude')!.responseTime}ms`
                                            : '—'}
                                    </div>
                                </div>
                            </div>
                            {aiConnection?.models.find(m => m.name === 'Claude')?.error && (
                                <div className="mt-3 text-xs text-red-400 font-medium bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                                    ⚠️ {aiConnection.models.find(m => m.name === 'Claude')!.error}
                                </div>
                            )}
                        </div>

                        {/* Gemini - Pattern Archaeologist */}
                        <div className={`p-6 rounded-2xl border ${aiConnection?.models.find(m => m.name === 'Gemini')?.connected ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-neutral-800/30 border-neutral-700/50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles size={18} className={aiConnection?.models.find(m => m.name === 'Gemini')?.connected ? 'text-emerald-500' : 'text-neutral-500'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${aiConnection?.models.find(m => m.name === 'Gemini')?.connected ? 'text-emerald-500' : 'text-neutral-500'}`}>Gemini — Pattern Archaeologist</span>
                                {aiConnection?.models.find(m => m.name === 'Gemini')?.connected && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">Online</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Model</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm text-[11px]">
                                        {aiConnection?.config.gemini.model || 'gemini-2.5-flash'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Cpu size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Version</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        {aiConnection?.models.find(m => m.name === 'Gemini')?.version || '2.5 Flash'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Clock size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Response Time</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {aiConnection?.models.find(m => m.name === 'Gemini')?.responseTime
                                            ? `${aiConnection.models.find(m => m.name === 'Gemini')!.responseTime}ms`
                                            : '—'}
                                    </div>
                                </div>
                            </div>
                            {aiConnection?.models.find(m => m.name === 'Gemini')?.error && (
                                <div className="mt-3 text-xs text-red-400 font-medium bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                                    ⚠️ {aiConnection.models.find(m => m.name === 'Gemini')!.error}
                                </div>
                            )}
                        </div>

                        {/* DeepSeek - Quantitative Engine */}
                        <div className={`p-6 rounded-2xl border ${aiConnection?.models.find(m => m.name === 'DeepSeek')?.connected ? 'bg-violet-500/5 border-violet-500/20' : 'bg-neutral-800/30 border-neutral-700/50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles size={18} className={aiConnection?.models.find(m => m.name === 'DeepSeek')?.connected ? 'text-violet-500' : 'text-neutral-500'} />
                                <span className={`text-sm font-bold uppercase tracking-widest ${aiConnection?.models.find(m => m.name === 'DeepSeek')?.connected ? 'text-violet-500' : 'text-neutral-500'}`}>DeepSeek — Quantitative Engine</span>
                                {aiConnection?.models.find(m => m.name === 'DeepSeek')?.connected && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20">Online</span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Model</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {aiConnection?.config.deepseek.model || 'deepseek-chat'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Cpu size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Version</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-bold text-sm">
                                        {aiConnection?.models.find(m => m.name === 'DeepSeek')?.version || 'V3'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-neutral-500">
                                        <Clock size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Response Time</span>
                                    </div>
                                    <div className="p-3 bg-neutral-800 rounded-xl border border-neutral-700 font-mono text-sm">
                                        {aiConnection?.models.find(m => m.name === 'DeepSeek')?.responseTime
                                            ? `${aiConnection.models.find(m => m.name === 'DeepSeek')!.responseTime}ms`
                                            : '—'}
                                    </div>
                                </div>
                            </div>
                            {aiConnection?.models.find(m => m.name === 'DeepSeek')?.error && (
                                <div className="mt-3 text-xs text-red-400 font-medium bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                                    ⚠️ {aiConnection.models.find(m => m.name === 'DeepSeek')!.error}
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2 flex-1">
                                <p className="text-sm text-neutral-500 max-w-md">
                                    API keys are managed via environment variables. Update <code className="text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded">.env.local</code> with your ANTHROPIC_API_KEY, GEMINI_API_KEY, and DEEPSEEK_API_KEY.
                                </p>
                                {aiManuallyTested && aiConnection && (
                                    <div className={`flex items-center gap-1.5 mt-1 font-bold text-xs ${aiConnection.connected ? 'text-green-400' : 'text-red-400'}`}>
                                        {aiConnection.connected ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                        {aiConnection.connected
                                            ? `All 3 models connected successfully!`
                                            : `${aiConnection.models.filter(m => !m.connected).length} model(s) failed`
                                        }
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => checkAIConnections(true)}
                                disabled={aiLoading}
                                className="flex items-center gap-2 px-10 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-neutral-700/50 hover:border-neutral-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw size={14} className={aiLoading ? 'animate-spin' : ''} />
                                {aiLoading ? 'Testing...' : 'Test All Models'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Telegram Notifications */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600/10 text-blue-500 flex items-center justify-center">
                                <Send size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Telegram Notifications</h3>
                                <p className="text-neutral-500 text-sm mt-1">Receive automated AI briefings, story updates, and scenario alerts.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${telegramEnabled ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}>
                            {telegramEnabled ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {telegramEnabled ? 'Connected' : 'Disconnected'}
                        </div>
                    </div>

                    <div className="p-10 space-y-10">
                        <div className="space-y-6">
                            <div className="relative group">
                                <label className="block text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
                                    Telegram Chat ID
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="password"
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                        placeholder="Enter your Chat ID"
                                        autoComplete="off"
                                        className="flex-1 px-5 py-4 bg-neutral-800 border border-neutral-700 rounded-2xl text-white font-mono text-sm focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={sendTestTelegram}
                                        disabled={testingTelegram || !telegramChatId}
                                        className="px-8 py-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-30 disabled:grayscale shadow-sm"
                                    >
                                        {testingTelegram ? (
                                            <RefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <Send size={14} />
                                        )}
                                        {testingTelegram ? 'Testing...' : 'Test Connection'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                                    <Shield size={10} className="text-neutral-600" />
                                    Your numeric Telegram ID (Get it via @userinfobot)
                                </p>
                            </div>

                            {/* Main Toggle */}
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setTelegramEnabled(!telegramEnabled)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${telegramEnabled ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                                        <Bell size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Enable Telegram Alerts</p>
                                        <p className="text-xs text-neutral-500 mt-1">Receive briefings and alerts directly on your device</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${telegramEnabled ? 'bg-blue-600 shadow-[0_0_15px_-5px_rgba(37,99,235,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${telegramEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Correlation Pattern Alerts */}
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setCorrelationAlertsEnabled(!correlationAlertsEnabled)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${correlationAlertsEnabled ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                                        <TrendingUp size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Correlation Pattern Alerts</p>
                                        <p className="text-xs text-neutral-500 mt-1">Real-time alerts when correlation patterns trigger (≥75% conditions met)</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${correlationAlertsEnabled ? 'bg-purple-600 shadow-[0_0_15px_-5px_rgba(168,85,247,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${correlationAlertsEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Killzone Wave Completion Alerts */}
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setKillzoneAlertsEnabled(!killzoneAlertsEnabled)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${killzoneAlertsEnabled ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                                        <Target size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-green-400 transition-colors">Killzone Wave Completion Alerts</p>
                                        <p className="text-xs text-neutral-500 mt-1">Get notified when Wave 2/4 corrections finish (Wave 3/5 setup ready)</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${killzoneAlertsEnabled ? 'bg-green-600 shadow-[0_0_15px_-5px_rgba(34,197,94,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${killzoneAlertsEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Auto-Execution Settings */}
                        <div className="space-y-4 pt-4 border-t border-neutral-800">
                            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Auto-Execution (Three-Tier Protocol)</h4>

                            {/* Enable Auto-Execution */}
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setAutoExecEnabled(!autoExecEnabled)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${autoExecEnabled ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">Enable Auto-Execution</p>
                                        <p className="text-xs text-neutral-500 mt-1">Automatically execute trades when all 3 tiers confirm (Tier 1 + 2 + 3)</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${autoExecEnabled ? 'bg-red-600 shadow-[0_0_15px_-5px_rgba(239,68,68,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${autoExecEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {autoExecEnabled && (
                                <>
                                    {/* Dry Run Mode */}
                                    <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-yellow-700/30 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setAutoExecDryRun(!autoExecDryRun)}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl border ${autoExecDryRun ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                                <AlertTriangle size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">Dry Run Mode</p>
                                                <p className="text-xs text-neutral-500 mt-1">
                                                    {autoExecDryRun
                                                        ? 'SAFE: Log trades without executing — no real money at risk'
                                                        : 'LIVE: Real orders will be placed on your broker account'}
                                                </p>
                                                {!autoExecDryRun && (
                                                    <p className="text-xs text-red-400 mt-1 font-bold">WARNING: Real money trades will be executed!</p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${autoExecDryRun ? 'bg-yellow-600' : 'bg-red-600 shadow-[0_0_15px_-5px_rgba(239,68,68,0.5)]'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${autoExecDryRun ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* Risk Amount + Max Trades + Min Confidence */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                            <label className="text-xs text-neutral-400 block mb-2">Risk Amount ($)</label>
                                            <input
                                                type="number"
                                                value={autoExecRiskAmount}
                                                onChange={e => setAutoExecRiskAmount(Number(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
                                                min={1}
                                                max={100}
                                            />
                                            <p className="text-[10px] text-neutral-600 mt-1">2% of $850 = $17</p>
                                        </div>
                                        <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                            <label className="text-xs text-neutral-400 block mb-2">Max Trades/Day</label>
                                            <input
                                                type="number"
                                                value={autoExecMaxTrades}
                                                onChange={e => setAutoExecMaxTrades(Number(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
                                                min={1}
                                                max={10}
                                            />
                                        </div>
                                        <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                            <label className="text-xs text-neutral-400 block mb-2">Min Confidence (%)</label>
                                            <input
                                                type="number"
                                                value={autoExecMinConfidence}
                                                onChange={e => setAutoExecMinConfidence(Number(e.target.value))}
                                                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm"
                                                min={30}
                                                max={100}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="pt-6 border-t border-neutral-800 flex justify-end">
                            <button
                                onClick={savePreferences}
                                disabled={savingPrefs}
                                className="flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-blue-500/30 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-900/10 hover:shadow-xl"
                            >
                                {savingPrefs ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        Save Notification Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Regime-Switching Engine */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-blue-900/10 to-transparent">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-amber-600/10 text-amber-500 flex items-center justify-center">
                                <Cpu size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Regime-Switching Engine</h3>
                                <p className="text-neutral-500 text-sm mt-1">Multi-bot "Weapon Swapping" autonomous system.</p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${regimeEngineEnabled ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}>
                            {regimeEngineEnabled ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {regimeEngineEnabled ? 'System Active' : 'Offline'}
                        </div>
                    </div>

                    <div className="p-10 space-y-8">
                        {/* Main Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setRegimeEngineEnabled(!regimeEngineEnabled)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${regimeEngineEnabled ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Enable Engine</p>
                                        <p className="text-xs text-neutral-500 mt-1">Autonomous scanning & execution</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${regimeEngineEnabled ? 'bg-blue-600 shadow-[0_0_15px_-5px_rgba(37,99,235,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${regimeEngineEnabled ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                 </button>
                             </div>
 
                            <div className="flex items-center justify-between p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50 hover:bg-neutral-800/50 transition-all cursor-pointer group" onClick={() => setRegimeEngineDryRun(!regimeEngineDryRun)}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl border ${regimeEngineDryRun ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">Dry Run Mode</p>
                                        <p className="text-xs text-neutral-500 mt-1">Don't place real orders</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${regimeEngineDryRun ? 'bg-amber-600 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]' : 'bg-neutral-700'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${regimeEngineDryRun ? 'translate-x-6 scale-110' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        {/* Bot Configuration */}
                        <div className="p-6 bg-neutral-800/20 rounded-2xl border border-neutral-800">
                            <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-4">Weapon Selection (Bot Toggles)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${regimeEngineTrapEnabled ? 'bg-blue-500/5 border-blue-500/20 text-blue-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}`} onClick={() => setRegimeEngineTrapEnabled(!regimeEngineTrapEnabled)}>
                                    <div className="flex items-center gap-3">
                                        <Target size={18} />
                                        <span className="text-sm font-bold">Trap Bot</span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${regimeEngineTrapEnabled ? 'bg-blue-500' : 'bg-neutral-600'}`} />
                                </div>
                                <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${regimeEngineKillzoneEnabled ? 'bg-purple-500/5 border-purple-500/20 text-purple-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}`} onClick={() => setRegimeEngineKillzoneEnabled(!regimeEngineKillzoneEnabled)}>
                                    <div className="flex items-center gap-3">
                                        <Sparkles size={18} />
                                        <span className="text-sm font-bold">Killzone Bot</span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${regimeEngineKillzoneEnabled ? 'bg-purple-500' : 'bg-neutral-600'}`} />
                                </div>
                                <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${regimeEngineMomentumEnabled ? 'bg-orange-500/5 border-orange-500/20 text-orange-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}`} onClick={() => setRegimeEngineMomentumEnabled(!regimeEngineMomentumEnabled)}>
                                    <div className="flex items-center gap-3">
                                        <TrendingUp size={18} />
                                        <span className="text-sm font-bold">Momentum Bot</span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${regimeEngineMomentumEnabled ? 'bg-orange-500' : 'bg-neutral-600'}`} />
                                </div>
                                <div className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${regimeEngineGhostEnabled ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-neutral-900 border-neutral-800 text-neutral-500'}`} onClick={() => setRegimeEngineGhostEnabled(!regimeEngineGhostEnabled)}>
                                    <div className="flex items-center gap-3">
                                        <Ghost size={18} />
                                        <span className="text-sm font-bold">Ghost Bot</span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${regimeEngineGhostEnabled ? 'bg-red-500' : 'bg-neutral-600'}`} />
                                </div>
                            </div>
                        </div>

                        {/* Strategy Parameters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Risk per Trade ($)</label>
                                <input
                                    type="number"
                                    value={regimeEngineRiskAmount}
                                    onChange={e => setRegimeEngineRiskAmount(Number(e.target.value))}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                            <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Confidence Gate</label>
                                <input
                                    type="number"
                                    value={regimeEngineMinConfidence}
                                    onChange={e => setRegimeEngineMinConfidence(Number(e.target.value))}
                                    step="0.1"
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                            <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Max Daily Trades</label>
                                <input
                                    type="number"
                                    value={regimeEngineMaxTrades}
                                    onChange={e => setRegimeEngineMaxTrades(Number(e.target.value))}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                            <div className="p-4 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                                <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest block mb-2">Cooldown (Mins)</label>
                                <input
                                    type="number"
                                    value={regimeEngineCooldown}
                                    onChange={e => setRegimeEngineCooldown(Number(e.target.value))}
                                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cron Jobs */}
                <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden">
                    <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[1.5rem] bg-orange-600/10 text-orange-500 flex items-center justify-center">
                                <Timer size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">Scheduled Jobs (Cron)</h3>
                                <p className="text-neutral-500 text-sm mt-1">Automated AI pipelines running via Supabase pg_cron.</p>
                            </div>
                        </div>
                        {cronResults && (
                            <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${cronResults.allPassed ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {cronResults.allPassed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                {cronResults.allPassed ? 'All Healthy' : 'Issues Found'}
                            </div>
                        )}
                    </div>

                    <div className="p-10 space-y-4">
                        {(cronResults?.jobs || [
                            { name: 'Scenario Analysis', schedule: 'Monday 3:30 AM UTC', description: 'Weekly institutional scenario report per pair', status: 'pending' },
                            { name: 'Story Agents', schedule: 'Mon-Fri 4:00 AM UTC', description: 'Daily intelligence agents (Optimizer, News, Cross-Market)', status: 'pending' },
                            { name: 'Story Generation', schedule: 'Mon-Fri 5:00 AM UTC', description: 'Daily episode generation for subscribed pairs', status: 'pending' },
                            { name: 'Scenario Monitor', schedule: 'Every 15 minutes', description: 'Auto-resolve scenarios vs OANDA prices', status: 'pending' },
                            { name: 'Generate Daily Predictions', schedule: 'Daily 5:30 AM UTC', description: 'Auto-generate correlation predictions using complete market close data', status: 'pending' },
                            { name: 'Correlation Pattern Alerts', schedule: 'Every 15 minutes', description: 'Monitor correlation patterns, send Telegram alerts when ≥75% conditions met', status: 'pending' },
                        ]).map((job: any) => (
                            <div key={job.name} className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
                                job.status === 'success' ? 'bg-green-500/5 border-green-500/20' :
                                job.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                                'bg-neutral-800/30 border-neutral-700/50'
                            }`}>
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        job.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                        job.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                                        'bg-neutral-600'
                                    }`} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-neutral-200">{job.name}</span>
                                            <span className="text-[10px] text-neutral-500 font-mono bg-neutral-800 px-2 py-0.5 rounded">{job.schedule}</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{job.description}</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    {job.status === 'success' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-neutral-500 font-mono">{job.responseTime}ms</span>
                                            <CheckCircle2 size={16} className="text-green-500" />
                                        </div>
                                    )}
                                    {job.status === 'error' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-red-400 max-w-[150px] truncate">{job.error}</span>
                                            <XCircle size={16} className="text-red-500" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="pt-6 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6">
                            <p className="text-sm text-neutral-500 max-w-md">
                                Tests each endpoint with your <code className="text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded">CRON_SECRET</code>. Safe to run — jobs skip if no subscriptions exist.
                            </p>
                            <button
                                onClick={testCronJobs}
                                disabled={cronLoading}
                                className="flex items-center gap-2 px-10 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-neutral-700/50 hover:border-neutral-600 transition-all active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw size={14} className={cronLoading ? 'animate-spin' : ''} />
                                {cronLoading ? 'Testing Jobs...' : 'Test All Jobs'}
                            </button>
                        </div>
                    </div>
                </section>





            </div>






        </div>
    )
}
