'use client'

import React, { useState } from 'react'
import { Calculator, ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'

export function WaveCalculator() {
  const [direction, setDirection] = useState<'bearish' | 'bullish'>('bearish')
  const [p1, setP1] = useState<string>('1.1000') // Start of Wave 1
  const [p2, setP2] = useState<string>('1.0500') // End of Wave 1
  const [p3, setP3] = useState<string>('1.0800') // End of Wave 2

  const n1 = parseFloat(p1) || 0
  const n2 = parseFloat(p2) || 0
  const n3 = parseFloat(p3) || 0

  const wave1Length = Math.abs(n1 - n2)
  const mult = direction === 'bearish' ? -1 : 1
  
  const target100 = n3 + (wave1Length * 1.0 * mult)
  const target1618 = n3 + (wave1Length * 1.618 * mult)
  const target2618 = n3 + (wave1Length * 2.618 * mult)

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem] mt-8 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Calculator size={20} />
        </div>
        <div>
          <h4 className="text-lg font-bold text-white">Interactive Wave 3 Target Calculator</h4>
          <p className="text-[11px] text-neutral-400 uppercase tracking-widest font-bold mt-0.5">Trend-Based Fibonacci Projection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="flex gap-2 p-1 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
            <button
              onClick={() => setDirection('bearish')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                direction === 'bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <TrendingDown size={16} />
              Bearish Projection
            </button>
            <button
              onClick={() => setDirection('bullish')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                direction === 'bullish' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <TrendingUp size={16} />
              Bullish Projection
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 ml-1">Point 1: Origin (Start of Wave 1)</label>
              <input
                type="number"
                value={p1}
                onChange={e => setP1(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                placeholder={direction === 'bearish' ? 'Absolute Top' : 'Absolute Bottom'}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 ml-1">Point 2: End of Wave 1</label>
              <input
                type="number"
                value={p2}
                onChange={e => setP2(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                placeholder={direction === 'bearish' ? 'Initial Drop Bottom' : 'Initial Surge Top'}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 ml-1">Point 3: End of Wave 2</label>
              <input
                type="number"
                value={p3}
                onChange={e => setP3(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                placeholder={direction === 'bearish' ? 'Corrective Bounce Peak' : 'Corrective Pullback Low'}
              />
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             {direction === 'bearish' ? <TrendingDown size={120} /> : <TrendingUp size={120} />}
          </div>
          
          <h5 className="text-sm font-bold text-neutral-300 mb-5 flex items-center gap-2">
            Projected Wave 3 Targets
          </h5>

          <div className="space-y-4">
            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Symmetry Level (1.0)</p>
                <p className="text-xs text-neutral-400 leading-tight">Wave 3 = Wave 1. If it stops here, trend might be weak.</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-lg font-black text-white">{target100.toFixed(4)}</p>
              </div>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl flex items-center justify-between relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  The Golden Target (1.618)
                </p>
                <p className="text-xs text-indigo-200/70 leading-tight">Most common. Violently slices through support/resistance.</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-xl font-black text-indigo-400 drop-shadow-sm">{target1618.toFixed(4)}</p>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">Extended Target (2.618)</p>
                <p className="text-xs text-neutral-400 leading-tight">Phase of pure capitulation or extreme euphoria.</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-lg font-black text-white">{target2618.toFixed(4)}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-5 pt-5 border-t border-neutral-800">
            <div className="flex justify-between items-center">
              <span className="text-xs text-neutral-500">Wave 1 Generated Length:</span>
              <span className="text-xs font-bold text-neutral-300">{wave1Length.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
