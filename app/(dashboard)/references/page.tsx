'use client'

import React, { useState, useMemo } from 'react'
import { BookMarked, CandlestickChart, LineChart, Search, Waves, Target, Activity, Zap, Landmark, Building2, Calendar, AlertTriangle, TrendingUp, TrendingDown, Brain, ArrowRight, CheckCircle, AlertCircle, Cpu, Eye, Calculator, GitMerge, ChevronRight, Clock, Bell, Play, CheckSquare, BarChart3, CheckCircle2, RefreshCw, Gauge } from 'lucide-react'
import { CANDLESTICK_PATTERNS } from '@/lib/utils/candlestick-patterns'
import { CHART_PATTERNS } from '@/lib/references/chart-patterns'
import { CandlestickPatternCard } from './_components/CandlestickPatternCard'
import { ChartPatternCard } from './_components/ChartPatternCard'

type Tab = 'patterns' | 'fibonacci' | 'volume' | 'oscillators' | 'smc' | 'elliot-waves'

export default function ReferencesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('patterns')
  const [searchQuery, setSearchQuery] = useState('')
  const [patternType, setPatternType] = useState<'candlestick' | 'chart'>('candlestick')

  // Strategy Lab Monitor
  const [monitorStatus, setMonitorStatus] = useState<any>(null)
  const [triggeringMonitor, setTriggeringMonitor] = useState(false)

  const triggerStrategyMonitor = async () => {
    setTriggeringMonitor(true)
    try {
      const res = await fetch('/api/strategy-lab/trigger-monitor', {
        method: 'POST',
      })
      const result = await res.json()
      setMonitorStatus(result)
    } catch (err) {
      setMonitorStatus({ error: 'Failed to trigger monitor' })
    } finally {
      setTriggeringMonitor(false)
    }
  }

  const filteredCandlestickPatterns = useMemo(() => {
    if (patternType !== 'candlestick') return []
    if (!searchQuery.trim()) return CANDLESTICK_PATTERNS
    const q = searchQuery.toLowerCase()
    return CANDLESTICK_PATTERNS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.signal.toLowerCase().includes(q)
    )
  }, [searchQuery, patternType])

  const filteredChartPatterns = useMemo(() => {
    if (patternType !== 'chart') return []
    if (!searchQuery.trim()) return CHART_PATTERNS
    const q = searchQuery.toLowerCase()
    return CHART_PATTERNS.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.signal.toLowerCase().includes(q)
    )
  }, [searchQuery, patternType])

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3.5 bg-blue-600/10 rounded-2xl border border-blue-600/20">
          <BookMarked className="text-blue-500" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Technical Analysis Reference</h1>
          <p className="text-neutral-500 font-medium text-sm mt-0.5">
            Complete guide to technical analysis — patterns, indicators, and institutional concepts
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton
          active={activeTab === 'patterns'}
          onClick={() => setActiveTab('patterns')}
          icon={CandlestickChart}
          label="Patterns"
        />
        <TabButton
          active={activeTab === 'fibonacci'}
          onClick={() => setActiveTab('fibonacci')}
          icon={Target}
          label="Fibonacci"
        />
        <TabButton
          active={activeTab === 'volume'}
          onClick={() => setActiveTab('volume')}
          icon={Activity}
          label="Volume"
        />
        <TabButton
          active={activeTab === 'oscillators'}
          onClick={() => setActiveTab('oscillators')}
          icon={Gauge}
          label="Oscillators"
        />
        <TabButton
          active={activeTab === 'smc'}
          onClick={() => setActiveTab('smc')}
          icon={Landmark}
          label="Smart Money Concepts"
        />
        <TabButton
          active={activeTab === 'elliot-waves'}
          onClick={() => setActiveTab('elliot-waves')}
          icon={Waves}
          label="Elliot Waves"
        />
      </div>

      {/* Content */}
      {activeTab === 'patterns' && (
        <PatternsSection
          patternType={patternType}
          setPatternType={setPatternType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredCandlestickPatterns={filteredCandlestickPatterns}
          filteredChartPatterns={filteredChartPatterns}
        />
      )}

      {activeTab === 'fibonacci' && <FibonacciSection />}
      {activeTab === 'volume' && <VolumeSection />}
      {activeTab === 'oscillators' && <OscillatorsSection />}
      {activeTab === 'smc' && <SmartMoneySection />}
      {activeTab === 'elliot-waves' && <ElliotWavesSection />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${active
        ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
        }`}
    >
      <Icon size={18} />
      {label}
    </button>
  )
}

function PatternsSection({ patternType, setPatternType, searchQuery, setSearchQuery, filteredCandlestickPatterns, filteredChartPatterns }: any) {
  return (
    <div className="space-y-6">
      {/* Pattern Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPatternType('candlestick')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${patternType === 'candlestick'
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/50'
            }`}
        >
          <CandlestickChart size={16} />
          Candlestick ({CANDLESTICK_PATTERNS.length})
        </button>
        <button
          onClick={() => setPatternType('chart')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${patternType === 'chart'
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/50'
            }`}
        >
          <LineChart size={16} />
          Chart Patterns ({CHART_PATTERNS.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          placeholder="Search patterns..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700"
        />
      </div>

      {/* Candlestick Patterns */}
      {patternType === 'candlestick' && (
        <>
          {/* Context & Confirmation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem]">
              <h4 className="text-base font-bold text-amber-400 mb-3">Context Is Everything</h4>
              <ul className="text-sm text-amber-200/80 space-y-2">
                <li>A hammer at major support after a downtrend = high-probability reversal signal</li>
                <li>A hammer in the middle of a range = noise, ignore it</li>
                <li>Always ask: WHERE is this pattern forming? That determines its significance.</li>
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[2rem]">
              <h4 className="text-base font-bold text-amber-400 mb-3">Confirmation Rules</h4>
              <ul className="text-sm text-amber-200/80 space-y-2">
                <li>Always wait for the NEXT candle to confirm the pattern</li>
                <li>Higher timeframes (daily, weekly) are more reliable than lower (1H, 4H)</li>
                <li>Volume increasing on the confirmation candle strengthens the signal</li>
                <li>One pattern alone is never enough — combine with other analysis tools</li>
              </ul>
            </div>
          </div>

          {/* Pattern Groups */}
          <div className="space-y-8">
            {['bullish_reversal', 'bearish_reversal', 'continuation', 'indecision'].map(signal => {
              const patterns = filteredCandlestickPatterns.filter((p: any) => p.signal === signal)
              if (patterns.length === 0) return null

              const titles: Record<string, string> = {
                bullish_reversal: 'Bullish Reversal Patterns',
                bearish_reversal: 'Bearish Reversal Patterns',
                continuation: 'Continuation Patterns',
                indecision: 'Indecision Patterns'
              }

              const colors: Record<string, string> = {
                bullish_reversal: 'green',
                bearish_reversal: 'red',
                continuation: 'blue',
                indecision: 'yellow'
              }

              return (
                <div key={signal}>
                  <h4 className={`text-lg font-bold text-${colors[signal]}-400 mb-4`}>{titles[signal]}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {patterns.map((p: any) => (
                      <CandlestickPatternCard key={p.name} pattern={p} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Timeframe Weight */}
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
            <h4 className="text-base font-bold text-amber-400 mb-3">Timeframe Weight</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-800/30">
                <span className="text-neutral-300">Monthly</span>
                <span className="text-green-400 font-bold text-xs">Very significant — adjust trading bias</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-800/30">
                <span className="text-neutral-300">Weekly</span>
                <span className="text-green-400 font-bold text-xs">Significant — good for swing context</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-800/30">
                <span className="text-neutral-300">Daily</span>
                <span className="text-blue-400 font-bold text-xs">Moderate — useful for entry timing</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-800/30">
                <span className="text-neutral-300">4H</span>
                <span className="text-yellow-400 font-bold text-xs">Lower — intraday entries only</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-neutral-800/30">
                <span className="text-neutral-300">Below 4H</span>
                <span className="text-red-400 font-bold text-xs">Too much noise — patterns unreliable</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Chart Patterns */}
      {patternType === 'chart' && (
        <div className="space-y-8">
          {['reversal', 'continuation'].map(category => {
            const patterns = filteredChartPatterns.filter((p: any) => p.category === category)
            if (patterns.length === 0) return null

            return (
              <div key={category}>
                <h4 className="text-lg font-bold text-blue-400 mb-4 capitalize">{category} Patterns</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patterns.map((p: any) => (
                    <ChartPatternCard key={p.name} pattern={p} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function FibonacciSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold flex items-center gap-3">
          <Target className="text-purple-500" size={28} />
          Fibonacci — The Ruler
        </h3>
        <p className="text-neutral-400 mt-2">Fibonacci retracements and extensions pinpoint where wave pullbacks are likely to end and where wave targets are likely to be reached. The ruler for measuring Elliott Wave structure.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-purple-400 mb-3">What are Fibonacci Levels?</h4>
          <p className="text-sm text-neutral-300 leading-relaxed mb-4">
            Markets naturally retrace (pull back) in predictable ratios: 38.2%, 50%, 61.8%. These aren't random—they're derived from the Fibonacci sequence and appear consistently across all markets and timeframes.
          </p>
          <p className="text-sm text-neutral-400 leading-relaxed">
            <strong className="text-neutral-300">The Sweet Spot:</strong> The 61.8% retracement (also called the "Golden Ratio") is where Wave 2 most commonly ends. This is your highest-probability entry zone for riding Wave 3.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-purple-400 mb-3">Key Fibonacci Levels</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-neutral-300 font-semibold">Retracements (pullbacks):</p>
              <ul className="text-neutral-400 text-xs mt-2 space-y-1 ml-4">
                <li>• 38.2% - Shallow correction</li>
                <li>• 50% - Moderate correction</li>
                <li>• 61.8% - Deep correction (sweet spot for Wave 2)</li>
              </ul>
            </div>
            <div>
              <p className="text-neutral-300 font-semibold">Extensions (targets):</p>
              <ul className="text-neutral-400 text-xs mt-2 space-y-1 ml-4">
                <li>• 1.618x - Minimum Wave 3 target</li>
                <li>• 2.0x - Common Wave 3 extension</li>
                <li>• 2.618x - Strong Wave 3 extension</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-purple-400 mb-3">How to Draw Fibonacci in TradingView</h4>
          <ol className="text-sm text-neutral-300 space-y-2 list-decimal list-inside">
            <li>Select the <strong>Fibonacci Retracement</strong> tool from the left sidebar</li>
            <li>For Wave 2 pullback: Click on <strong>Wave 1 low</strong>, drag to <strong>Wave 1 high</strong></li>
            <li>TradingView will automatically display the 38.2%, 50%, and 61.8% levels</li>
            <li>Watch where price reacts to these levels during the Wave 2 pullback</li>
            <li>For Wave 3 target: Use Fibonacci <strong>Extension</strong> tool from Wave 1 low → Wave 1 high → Wave 2 low</li>
          </ol>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-purple-400 mb-3">The Wave 3 Entry Setup</h4>
          <p className="text-sm text-neutral-300 leading-relaxed mb-3">
            This is the highest-probability Elliott Wave trade:
          </p>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">Wave 1 completes:</span>
              <span className="text-green-400">Sharp move up, volume increasing</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Wave 2 pulls back to:</span>
              <span className="text-purple-400">61.8% Fibonacci level</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Volume during pullback:</span>
              <span className="text-blue-400">Declining (selling drying up)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Entry:</span>
              <span className="text-green-400">At 61.8% zone when volume low</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Stop loss:</span>
              <span className="text-red-400">Below Wave 1 start</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Target:</span>
              <span className="text-blue-400">1.618x extension of Wave 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VolumeSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold flex items-center gap-3">
          <Activity className="text-green-500" size={28} />
          Volume — The Fuel Gauge
        </h3>
        <p className="text-neutral-400 mt-2">Volume confirms whether your wave count is correct. It's the fuel gauge that tells you if the trend has legs or is running out of steam.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-green-400 mb-3">Expected Volume Pattern</h4>
          <div className="space-y-3">
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400">Wave 1: Increasing Volume ✓</p>
              <p className="text-xs text-neutral-400 mt-1">Smart money starting the trend. Volume should be building.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-blue-400">Wave 2: Declining Volume ✓</p>
              <p className="text-xs text-neutral-400 mt-1">Selling pressure drying up. Low volume = healthy correction.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400">Wave 3: HIGHEST Volume ✓</p>
              <p className="text-xs text-neutral-400 mt-1">The crowd joins in. Strongest participation of all waves.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-blue-400">Wave 4: Declining Volume ✓</p>
              <p className="text-xs text-neutral-400 mt-1">Similar to Wave 2. Profit-taking with low volume.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-yellow-400">Wave 5: Lower Than Wave 3 ⚠️</p>
              <p className="text-xs text-neutral-400 mt-1">Exhaustion signal. Trend running out of fuel. Tighten stops.</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-green-400 mb-3">How to Use Volume</h4>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-neutral-300 font-semibold mb-2">Volume Confirms Your Count:</p>
              <p className="text-neutral-400 text-xs leading-relaxed">
                If Wave 2 shows HIGH volume instead of declining volume, it might not be a healthy correction—it could be the start of a reversal. Volume contradicts your labels = don't trade yet.
              </p>
            </div>
            <div>
              <p className="text-neutral-300 font-semibold mb-2">Volume Warns of Exhaustion:</p>
              <p className="text-neutral-400 text-xs leading-relaxed">
                If you're in Wave 5 and volume is clearly declining compared to Wave 3, the trend is running out of steam. This is your signal to tighten stops and prepare for the ABC correction that follows.
              </p>
            </div>
            <div>
              <p className="text-neutral-300 font-semibold mb-2">Add Volume in TradingView:</p>
              <ol className="text-neutral-400 text-xs space-y-1 list-decimal list-inside mt-2">
                <li>Click "Indicators" at the top of the chart</li>
                <li>Search for "Volume"</li>
                <li>Select the built-in "Volume" indicator</li>
                <li>Volume bars appear below your chart</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem] lg:col-span-2">
          <h4 className="text-base font-bold text-green-400 mb-3">Red Flags: When Volume Contradicts the Count</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-300 font-semibold mb-2">🚨 High Volume on Wave 2</p>
              <p className="text-red-200/80 text-xs">
                Wave 2 should have LOW volume (selling drying up). If volume spikes during Wave 2, it's likely NOT a healthy correction—could be a trend reversal.
              </p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-red-300 font-semibold mb-2">🚨 Low Volume on Wave 3</p>
              <p className="text-red-200/80 text-xs">
                Wave 3 should be the STRONGEST wave with highest volume. If Wave 3 has weak volume, your count is likely wrong—this might be Wave C of a correction, not Wave 3 of an impulse.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* The Combined Trade */}
      <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/5 border border-blue-500/20 rounded-[2.5rem] p-8">
        <h4 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
          <Zap className="text-yellow-500" size={24} />
          The Combined Trade: Elliott + Fibonacci + Volume
        </h4>
        <div className="space-y-6">
          {[
            { num: 1, title: "Identify Wave 1 Complete", desc: "Sharp move in one direction. Volume increasing. This is smart money starting the climb.", color: "green" },
            { num: 2, title: "Wait for Wave 2 Pullback", desc: "Price retraces. Draw Fibonacci from Wave 1 low to Wave 1 high. Watch the 61.8% level—this is your entry zone.", color: "blue" },
            { num: 3, title: "Confirm with Volume", desc: "Volume should be DECLINING during Wave 2. Low volume = selling pressure drying up. This confirms the pullback is healthy.", color: "purple" },
            { num: 4, title: "Enter at 61.8% with Low Volume", desc: "Price touches or approaches the 61.8% Fibonacci zone AND volume is dry. This is your entry. Stop loss just below Wave 1 start.", color: "green" },
            { num: 5, title: "Ride Wave 3 to 1.618x Target", desc: "Calculate: Wave 2 low + (Wave 1 length × 1.618). This is your minimum target. Volume should surge during Wave 3—this is the crowd joining in.", color: "yellow" },
            { num: 6, title: "Exit Warning: Wave 5 Low Volume", desc: "If Wave 5 shows declining volume compared to Wave 3, the trend is exhausting. Tighten stops. Don't add to position. Prepare for ABC correction.", color: "red" }
          ].map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-${step.color}-500/20 border border-${step.color}-500/30 flex items-center justify-center text-${step.color}-400 font-bold`}>
                {step.num}
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-200 mb-1">{step.title}</p>
                <p className="text-sm text-neutral-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function OscillatorsSection() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <Gauge className="text-cyan-500" size={28} />
              Oscillators & Momentum Indicators
            </h3>
            <p className="text-neutral-400 mt-2">Oscillators measure the speed and strength of price movements. They oscillate between fixed boundaries, helping identify overbought/oversold conditions, divergences, and momentum shifts before price confirms.</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 rounded-xl text-sm font-bold whitespace-nowrap">
            <Gauge size={16} />
            Confirmation Tools
          </div>
        </div>
      </div>

      {/* RSI */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">RSI</div>
          <div>
            <h4 className="text-lg font-bold text-blue-400">Relative Strength Index (RSI)</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Period: 14 (default) | Range: 0–100</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          RSI measures the magnitude of recent price changes to evaluate overbought or oversold conditions. Developed by J. Welles Wilder, it compares the average gain to the average loss over a lookback period.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">Key Levels</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-300">Above 70</span>
                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">Overbought</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-300">Below 30</span>
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold">Oversold</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-300">50 Line</span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">Trend Filter</span>
              </div>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-purple-400">Trading Signals</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-green-400">Bullish Divergence:</strong> Price makes lower low, RSI makes higher low — reversal signal</p>
              <p><strong className="text-red-400">Bearish Divergence:</strong> Price makes higher high, RSI makes lower high — exhaustion signal</p>
              <p><strong className="text-blue-400">Failure Swing:</strong> RSI breaks its own S/R without price confirming — early momentum shift</p>
              <p><strong className="text-yellow-400">Hidden Divergence:</strong> Trend continuation signal — price higher low + RSI lower low (bullish)</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <p className="text-xs text-blue-300"><strong>Pro Tip:</strong> In strong trends, RSI can stay overbought/oversold for extended periods. Use the 50 line as a trend filter instead — RSI above 50 = bullish momentum, below 50 = bearish. Don&apos;t fade trends just because RSI is &quot;overbought.&quot;</p>
        </div>
      </div>

      {/* MACD */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs">MACD</div>
          <div>
            <h4 className="text-lg font-bold text-purple-400">Moving Average Convergence Divergence (MACD)</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Default: 12, 26, 9 | Range: Unbounded</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          MACD shows the relationship between two EMAs. It consists of the MACD line (12 EMA – 26 EMA), the signal line (9 EMA of MACD), and the histogram (difference between MACD and signal). It reveals momentum direction, strength, and potential reversals.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-purple-400 mb-2">MACD Line</p>
            <p className="text-xs text-neutral-400">The fast line (12 EMA – 26 EMA). Crossing above signal = bullish. Crossing below = bearish. Distance from zero line shows momentum strength.</p>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-orange-400 mb-2">Signal Line</p>
            <p className="text-xs text-neutral-400">9-period EMA of MACD. Acts as a trigger for buy/sell signals. Crossovers with MACD line are the primary trading signal.</p>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
            <p className="text-sm font-semibold text-cyan-400 mb-2">Histogram</p>
            <p className="text-xs text-neutral-400">Visual representation of momentum. Growing bars = momentum increasing. Shrinking bars = momentum fading. Zero cross = trend change.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-400 mb-2">Bullish Signals</p>
            <div className="space-y-1.5 text-xs text-neutral-400">
              <p>MACD crosses above signal line</p>
              <p>MACD crosses above zero line (strong)</p>
              <p>Histogram turns from negative to positive</p>
              <p>Bullish divergence: price lower low, MACD higher low</p>
            </div>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-400 mb-2">Bearish Signals</p>
            <div className="space-y-1.5 text-xs text-neutral-400">
              <p>MACD crosses below signal line</p>
              <p>MACD crosses below zero line (strong)</p>
              <p>Histogram turns from positive to negative</p>
              <p>Bearish divergence: price higher high, MACD lower high</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stochastic Oscillator */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">%K</div>
          <div>
            <h4 className="text-lg font-bold text-amber-400">Stochastic Oscillator</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Default: 14, 3, 3 | Range: 0–100</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          The Stochastic compares a closing price to its price range over a given period. It shows where the current close sits relative to the high-low range. The %K line is the fast line and %D is a smoothed average of %K.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-400">Key Levels & Signals</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <div className="flex justify-between items-center">
                <span>Above 80</span>
                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-bold">Overbought</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Below 20</span>
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold">Oversold</span>
              </div>
              <p className="pt-2"><strong className="text-amber-400">%K crosses above %D</strong> in oversold zone = buy signal</p>
              <p><strong className="text-amber-400">%K crosses below %D</strong> in overbought zone = sell signal</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-400">Slow vs Fast Stochastic</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-blue-400">Fast Stochastic:</strong> Raw %K with %D smoothing. Very sensitive, produces many signals. Better for scalping.</p>
              <p><strong className="text-green-400">Slow Stochastic:</strong> Uses smoothed %K as the main line. Filters noise, fewer false signals. Preferred for swing trading and position analysis.</p>
              <p><strong className="text-yellow-400">Best Practice:</strong> Use slow stochastic (14, 3, 3) on H4/D charts for cleaner signals aligned with your 5-TF analysis.</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs text-amber-300"><strong>Pro Tip:</strong> Stochastic divergences are powerful on higher timeframes. A bullish divergence on the Weekly stochastic while price tests support is a high-probability reversal setup. Combine with Fibonacci confluence for best results.</p>
        </div>
      </div>

      {/* Momentum */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400">
            <TrendingUp size={20} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-green-400">Momentum Indicator</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Period: 10 (default) | Range: Unbounded, centers on 0 or 100</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Momentum measures the rate of change of price over a specified period. It&apos;s the simplest oscillator — just the difference between today&apos;s close and the close N periods ago. Positive values indicate upward momentum, negative values indicate downward momentum.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">How to Read</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-green-400">Above zero line:</strong> Current price is higher than N periods ago — bullish momentum</p>
              <p><strong className="text-red-400">Below zero line:</strong> Current price is lower than N periods ago — bearish momentum</p>
              <p><strong className="text-blue-400">Rising momentum:</strong> Acceleration — trend is strengthening</p>
              <p><strong className="text-yellow-400">Falling momentum:</strong> Deceleration — trend is weakening, even if still positive</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">Trading Applications</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-blue-400">Zero-line crossover:</strong> Cross above = bullish signal, cross below = bearish signal</p>
              <p><strong className="text-purple-400">Divergences:</strong> Price making new highs but momentum declining = exhaustion warning</p>
              <p><strong className="text-cyan-400">Trend confirmation:</strong> Use momentum direction to confirm Elliott Wave counts — Wave 3 should show strongest momentum</p>
            </div>
          </div>
        </div>
      </div>

      {/* Parabolic SAR */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold text-xs">SAR</div>
          <div>
            <h4 className="text-lg font-bold text-pink-400">Parabolic SAR (Stop and Reverse)</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">AF: 0.02 start, 0.02 step, 0.2 max</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Parabolic SAR places dots above or below price to indicate trend direction and potential reversal points. Dots below price = uptrend, dots above price = downtrend. The dots accelerate toward price as the trend extends, creating a trailing stop mechanism.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-pink-400">How It Works</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-green-400">Dots below price:</strong> Uptrend confirmed. Each dot is a trailing stop level — if price closes below, trend reverses.</p>
              <p><strong className="text-red-400">Dots above price:</strong> Downtrend confirmed. Dots act as resistance. Close above = reversal signal.</p>
              <p><strong className="text-blue-400">Acceleration Factor (AF):</strong> Starts at 0.02, increases by 0.02 each new extreme, max 0.20. Dots move faster as trend matures.</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-pink-400">Best Uses</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-green-400">Trailing Stops:</strong> Use SAR dots as dynamic stop-loss levels in trending markets</p>
              <p><strong className="text-yellow-400">Trend Direction:</strong> Quick visual confirmation of current trend on any timeframe</p>
              <p><strong className="text-red-400">Exit Signals:</strong> When dots flip from below to above price, it&apos;s time to exit longs (and vice versa)</p>
            </div>
          </div>
        </div>
        <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-4">
          <p className="text-xs text-pink-300"><strong>Limitation:</strong> SAR performs poorly in ranging/choppy markets, generating frequent false reversals. Best used on D and H4 timeframes in clearly trending conditions. Combine with ADX (from DMI) to filter — only trust SAR signals when ADX &gt; 25.</p>
        </div>
      </div>

      {/* ATR */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-xs">ATR</div>
          <div>
            <h4 className="text-lg font-bold text-orange-400">Average True Range (ATR)</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Period: 14 (default) | Range: 0 to ∞ (in price units)</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          ATR measures market volatility by calculating the average of true ranges over a period. It doesn&apos;t indicate direction — only how much price is moving. Higher ATR = more volatile market, lower ATR = quieter market.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-400">True Range Calculation</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>True Range is the <strong>greatest</strong> of:</p>
              <p className="pl-2">1. Current High – Current Low</p>
              <p className="pl-2">2. |Current High – Previous Close|</p>
              <p className="pl-2">3. |Current Low – Previous Close|</p>
              <p className="text-neutral-500">ATR = 14-period average of True Range</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-400">Stop Loss Placement</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-green-400">Conservative:</strong> 2× ATR from entry</p>
              <p><strong className="text-blue-400">Standard:</strong> 1.5× ATR from entry</p>
              <p><strong className="text-yellow-400">Aggressive:</strong> 1× ATR from entry</p>
              <p className="text-neutral-500">ATR-based stops adapt to current volatility automatically</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-400">Volatility Analysis</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p><strong className="text-red-400">Rising ATR:</strong> Volatility expanding — breakouts are more reliable, widen stops</p>
              <p><strong className="text-green-400">Falling ATR:</strong> Volatility contracting — expect breakout soon, tighten ranges</p>
              <p><strong className="text-purple-400">ATR Squeeze:</strong> ATR at multi-period low = big move imminent (direction unknown)</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
          <p className="text-xs text-orange-300"><strong>Key Use in This System:</strong> ATR is used by the Volatility Scanner to rank currency pairs by tradability. Higher ATR relative to the spread = better risk-reward potential. The scanner combines ATR-based volatility (55%) with liquidity metrics (45%) for the composite tradability score.</p>
        </div>
      </div>

      {/* DMI / ADX */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-xs">DMI</div>
          <div>
            <h4 className="text-lg font-bold text-teal-400">Directional Movement Index (DMI / ADX)</h4>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Period: 14 (default) | Range: 0–100</p>
          </div>
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed">
          DMI consists of three lines: +DI (bullish directional indicator), -DI (bearish directional indicator), and ADX (Average Directional Index — measures trend strength regardless of direction). Together they tell you both the direction and strength of a trend.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-green-400">+DI (Bullish)</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>Measures upward movement strength</p>
              <p><strong>+DI above -DI</strong> = buyers are stronger</p>
              <p>Rising +DI = increasing buying pressure</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-red-400">-DI (Bearish)</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>Measures downward movement strength</p>
              <p><strong>-DI above +DI</strong> = sellers are stronger</p>
              <p>Rising -DI = increasing selling pressure</p>
            </div>
          </div>
          <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-teal-400">ADX (Trend Strength)</p>
            <div className="space-y-2 text-xs text-neutral-400">
              <div className="flex justify-between">
                <span>0–20</span>
                <span className="text-neutral-500 font-bold">Weak / No Trend</span>
              </div>
              <div className="flex justify-between">
                <span>20–25</span>
                <span className="text-yellow-400 font-bold">Emerging Trend</span>
              </div>
              <div className="flex justify-between">
                <span>25–50</span>
                <span className="text-green-400 font-bold">Strong Trend</span>
              </div>
              <div className="flex justify-between">
                <span>50–75</span>
                <span className="text-blue-400 font-bold">Very Strong</span>
              </div>
              <div className="flex justify-between">
                <span>75–100</span>
                <span className="text-purple-400 font-bold">Extremely Strong</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-green-400 mb-2">Bullish Setup</p>
            <div className="space-y-1.5 text-xs text-neutral-400">
              <p>1. +DI crosses above -DI</p>
              <p>2. ADX rises above 25 (confirms trend strength)</p>
              <p>3. ADX is rising (trend accelerating)</p>
              <p className="text-green-400 font-semibold pt-1">= Strong bullish trend confirmed</p>
            </div>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-400 mb-2">Bearish Setup</p>
            <div className="space-y-1.5 text-xs text-neutral-400">
              <p>1. -DI crosses above +DI</p>
              <p>2. ADX rises above 25 (confirms trend strength)</p>
              <p>3. ADX is rising (trend accelerating)</p>
              <p className="text-red-400 font-semibold pt-1">= Strong bearish trend confirmed</p>
            </div>
          </div>
        </div>
        <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
          <p className="text-xs text-teal-300"><strong>Pro Tip:</strong> When ADX is below 20, the market is ranging — avoid trend-following strategies and use oscillators (RSI, Stochastic) for mean-reversion setups instead. When ADX turns up from below 20, a new trend is forming — watch for +DI/-DI crossover to determine direction.</p>
        </div>
      </div>

      {/* Combining Oscillators */}
      <div className="bg-gradient-to-br from-cyan-600/10 to-purple-600/5 border border-cyan-500/20 rounded-[2.5rem] p-8 space-y-6">
        <h4 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
          <Zap className="text-yellow-500" size={24} />
          Combining Oscillators for High-Probability Setups
        </h4>
        <div className="space-y-6">
          {[
            { num: 1, title: "Check ADX First (Trend or Range?)", desc: "ADX > 25 = trending market, use MACD + SAR for trend-following. ADX < 20 = ranging, use RSI + Stochastic for overbought/oversold reversals.", color: "teal" },
            { num: 2, title: "Confirm Direction with MACD", desc: "MACD above zero + histogram growing = strong bullish momentum. Use signal line crossovers for entry timing on the H4/D timeframe.", color: "purple" },
            { num: 3, title: "Time Entry with RSI or Stochastic", desc: "In an uptrend, wait for RSI to pull back to 40-50 zone (not oversold) before entering. In a range, buy at RSI 30 / Stochastic 20 oversold readings.", color: "blue" },
            { num: 4, title: "Set Stops with ATR", desc: "Place stop-loss at 1.5× ATR below entry for longs. This adapts to current volatility — tight stops in quiet markets, wider stops in volatile markets.", color: "orange" },
            { num: 5, title: "Trail with Parabolic SAR", desc: "Once in profit, use SAR dots as a trailing stop. When dots flip above price, exit the trade. This locks in profits while letting winners run in trending conditions.", color: "pink" },
          ].map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-${step.color}-500/20 border border-${step.color}-500/30 flex items-center justify-center text-${step.color}-400 font-bold`}>
                {step.num}
              </div>
              <div>
                <p className="text-base font-semibold text-neutral-200 mb-1">{step.title}</p>
                <p className="text-sm text-neutral-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Reference Table */}
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] space-y-4">
        <h4 className="text-lg font-bold text-white">Quick Reference</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-3 px-3 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Indicator</th>
                <th className="text-left py-3 px-3 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Type</th>
                <th className="text-left py-3 px-3 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Best For</th>
                <th className="text-left py-3 px-3 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Timeframes</th>
                <th className="text-left py-3 px-3 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Combine With</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              <tr>
                <td className="py-3 px-3 font-semibold text-blue-400">RSI</td>
                <td className="py-3 px-3 text-neutral-400">Momentum</td>
                <td className="py-3 px-3 text-neutral-400">OB/OS, Divergences</td>
                <td className="py-3 px-3 text-neutral-400">All (D, H4 best)</td>
                <td className="py-3 px-3 text-neutral-400">Fibonacci, S/R</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-purple-400">MACD</td>
                <td className="py-3 px-3 text-neutral-400">Trend + Momentum</td>
                <td className="py-3 px-3 text-neutral-400">Crossovers, Divergences</td>
                <td className="py-3 px-3 text-neutral-400">D, H4</td>
                <td className="py-3 px-3 text-neutral-400">RSI, ADX</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-amber-400">Stochastic</td>
                <td className="py-3 px-3 text-neutral-400">Momentum</td>
                <td className="py-3 px-3 text-neutral-400">OB/OS, Crossovers</td>
                <td className="py-3 px-3 text-neutral-400">W, D, H4</td>
                <td className="py-3 px-3 text-neutral-400">Elliott Wave, Fib</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-green-400">Momentum</td>
                <td className="py-3 px-3 text-neutral-400">Rate of Change</td>
                <td className="py-3 px-3 text-neutral-400">Trend Strength</td>
                <td className="py-3 px-3 text-neutral-400">D, H4</td>
                <td className="py-3 px-3 text-neutral-400">Volume, MACD</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-pink-400">Parabolic SAR</td>
                <td className="py-3 px-3 text-neutral-400">Trend + Trailing</td>
                <td className="py-3 px-3 text-neutral-400">Stops, Direction</td>
                <td className="py-3 px-3 text-neutral-400">D, H4</td>
                <td className="py-3 px-3 text-neutral-400">ADX (filter)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-orange-400">ATR</td>
                <td className="py-3 px-3 text-neutral-400">Volatility</td>
                <td className="py-3 px-3 text-neutral-400">Stop Sizing, Vol.</td>
                <td className="py-3 px-3 text-neutral-400">All</td>
                <td className="py-3 px-3 text-neutral-400">All indicators</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-teal-400">DMI / ADX</td>
                <td className="py-3 px-3 text-neutral-400">Trend Strength</td>
                <td className="py-3 px-3 text-neutral-400">Trend vs Range</td>
                <td className="py-3 px-3 text-neutral-400">D, H4, H1</td>
                <td className="py-3 px-3 text-neutral-400">SAR, MACD</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SmartMoneySection() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">Smart Money Concepts (SMC)</h3>
          <p className="text-neutral-400 mt-2">The playbook of institutional desks. Understanding these patterns helps you trade WITH the $500M orders, not against them.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl text-sm font-bold">
          <Landmark size={16} />
          Institutional Playbook
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: "Liquidity Clusters",
            desc: "Areas where retail stop losses cluster (Equal Highs/Lows). Institutions target these for exit liquidity.",
            tip: "Don't place your stop where everyone else does. Wait for the stop-run."
          },
          {
            title: "Order Blocks",
            desc: "The specific 'footprint' of institutional buying or selling before a major move.",
            tip: "Look for the last bearish candle before a massive bullish breakout (or vice-versa)."
          },
          {
            title: "Fair Value Gaps",
            desc: "Price imbalances left when the market moves too fast for orders to be fully filled.",
            tip: "Price almost always returns to fill at least 50% of the gap (the 'Consequent Encroachment')."
          },
          {
            title: "AMD (The Power of 3)",
            desc: "Accumulation (ranging), Manipulation (fake move), Distribution (real trend).",
            tip: "Avoid the first breakout. It's often the 'Manipulation' phase designed to trap traders."
          },
          {
            title: "Premium vs Discount",
            desc: "Using Fib levels (0, 0.5, 1) to determine if price is 'expensive' or 'cheap' for current range.",
            tip: "Only buy in the Discount zone (below 50%) and only sell in the Premium zone (above 50%)."
          },
          {
            title: "The Judas Swing",
            desc: "A deceptive price movement at session open designed to induce retail traders into the wrong side.",
            tip: "Watch for a fake move early in London or NY session that sweeps old highs/lows."
          },
          {
            title: "Inducement",
            desc: "Slight moves that encourage retail traders to enter early, creating liquidity for the real move.",
            tip: "If a setup looks too easy and 'obvious', it's likely institutional inducement."
          },
          {
            title: "Kill Zones",
            desc: "Specific times (London Open, NY Open, London Close) when institutions inject massive liquidity.",
            tip: "High-probability setups usually form within the first 2 hours of a session open."
          }
        ].map((concept, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem] hover:border-blue-500/30 transition-all group">
            <h4 className="font-bold text-white mb-3 group-hover:text-blue-400 transition-colors uppercase tracking-wider text-sm">{concept.title}</h4>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4">{concept.desc}</p>
            <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
              <p className="text-[10px] text-blue-300 font-medium">
                <span className="font-bold text-blue-500 mr-1">Pro Tip:</span>
                {concept.tip}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ElliotWavesSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold flex items-center gap-3">
          <Waves className="text-indigo-500" size={28} />
          Elliot Waves
        </h3>
        <p className="text-neutral-400 mt-2">The market moves in repetitive structures driven by human psychology. The core pattern consists of 5 Impulsive Waves in the direction of the trend, followed by 3 Corrective Waves against the trend.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-indigo-400 mb-3">Impulsive Waves (1, 2, 3, 4, 5)</h4>
          <div className="space-y-3">
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400 flex items-center gap-2">Wave 1 <span className="text-xs text-neutral-400 font-normal ml-auto">The Start</span></p>
              <p className="text-xs text-neutral-400 mt-1">Smart money enters slowly. Trend change isn't obvious yet to the masses.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-400 flex items-center gap-2">Wave 2 <span className="text-xs text-neutral-400 font-normal ml-auto">The Deep Pullback</span></p>
              <p className="text-xs text-neutral-400 mt-1">First major correction. Can retrace up to 99% of Wave 1, but <strong className="text-neutral-200">never breaks below the start of Wave 1</strong>.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400 flex items-center gap-2">Wave 3 <span className="text-xs text-neutral-400 font-normal ml-auto">The Power Move</span></p>
              <p className="text-xs text-neutral-400 mt-1">Retail money joins in. Always the strongest and longest. <strong className="text-neutral-200">Cannot be the shortest motive wave</strong>.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-400 flex items-center gap-2">Wave 4 <span className="text-xs text-neutral-400 font-normal ml-auto">The Profit Taking</span></p>
              <p className="text-xs text-neutral-400 mt-1">A sideways consolidation. <strong className="text-neutral-200">Never overlaps into the price territory of Wave 1</strong>.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400 flex items-center gap-2">Wave 5 <span className="text-xs text-neutral-400 font-normal ml-auto">The Exhaustion</span></p>
              <p className="text-xs text-neutral-400 mt-1">Final push on lower momentum. Retail FOMO is at its highest, but smart money is exiting.</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem]">
          <h4 className="text-base font-bold text-pink-400 mb-3">Corrective Waves (A, B, C)</h4>
          <div className="space-y-3">
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-400">Wave A</p>
              <p className="text-xs text-neutral-400 mt-1">Initial drop ending the uptrend. Often seen as another minor pullback by late buyers.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400">Wave B</p>
              <p className="text-xs text-neutral-400 mt-1">The bull trap. "Buy the dip" crowd steps in, forming a lower high on weak volume.</p>
            </div>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-400">Wave C</p>
              <p className="text-xs text-neutral-400 mt-1">The capitulation. Price violently drops, breaking Wave A's low and destroying late buyers' hopes.</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl mt-4">
              <p className="text-sm font-bold text-indigo-400 mb-2">3 Golden Rules of Elliot Waves</p>
              <ul className="text-xs text-neutral-300 space-y-1.5 list-disc list-inside">
                <li>Wave 2 never retraces more than 100% of Wave 1.</li>
                <li>Wave 3 is never the shortest wave out of 1, 3, and 5.</li>
                <li>Wave 4 does not enter the price territory of Wave 1.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem] lg:col-span-2">
          <h4 className="text-base font-bold text-indigo-400 mb-3 flex items-center gap-2">
            <Target size={20} className="text-purple-500" />
            Fibonacci Levels for Elliot Waves
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-200">Wave 2 Retracement</p>
              <p className="text-xs text-neutral-400 mt-1 mb-3">Pullback of Wave 1</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Common:</span>
                  <span className="text-purple-400 font-bold">50% - 61.8%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Deep:</span>
                  <span className="text-purple-400 font-bold">78.6%</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-200">Wave 3 Target</p>
              <p className="text-xs text-neutral-400 mt-1 mb-3">Extension of W1 from W2</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Standard:</span>
                  <span className="text-green-400 font-bold">161.8%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Extended:</span>
                  <span className="text-green-400 font-bold">261.8% - 361.8%</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-200">Wave 4 Retracement</p>
              <p className="text-xs text-neutral-400 mt-1 mb-3">Pullback of Wave 3</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Standard:</span>
                  <span className="text-blue-400 font-bold">38.2%</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Maximum:</span>
                  <span className="text-blue-400 font-bold">50%</span>
                </div>
              </div>
            </div>

            <div className="bg-neutral-800/40 border border-neutral-700/50 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-200">Wave C Target</p>
              <p className="text-xs text-neutral-400 mt-1 mb-3">Extension of A from B</p>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Equality:</span>
                  <span className="text-red-400 font-bold">100% (A = C)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400">Extended:</span>
                  <span className="text-red-400 font-bold">123.6% - 161.8%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
