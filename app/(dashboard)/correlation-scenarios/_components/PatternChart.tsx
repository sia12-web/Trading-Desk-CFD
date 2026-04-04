'use client'

import { useState, useEffect } from 'react'
import type { CorrelationOccurrenceRow } from '@/lib/correlation/types'

interface PatternChartProps {
  scenarioId: string
}

/**
 * Interactive candlestick chart showing pattern occurrences
 * Note: This is a simplified version - for production, use a charting library like TradingView Lightweight Charts
 */
export function PatternChart({ scenarioId }: PatternChartProps) {
  const [occurrences, setOccurrences] = useState<CorrelationOccurrenceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOccurrences()
  }, [scenarioId])

  const loadOccurrences = async () => {
    // Placeholder - would fetch from API
    setLoading(false)
  }

  if (loading) {
    return <div className="text-neutral-500 text-sm">Loading chart...</div>
  }

  return (
    <div className="bg-neutral-950 rounded-lg p-4 border border-neutral-800">
      <div className="text-sm text-neutral-400 mb-4">
        Pattern Occurrences Timeline
      </div>

      {/* Simplified visualization - replace with TradingView Lightweight Charts */}
      <div className="space-y-2">
        {occurrences.slice(0, 10).map((occ, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2 rounded ${
              occ.outcome_success ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}
          >
            <span className="text-xs text-neutral-400">
              {new Date(occ.occurrence_date).toLocaleDateString()}
            </span>
            <span className="text-xs font-mono">
              {occ.outcome_success ? (
                <span className="text-green-400">+{occ.outcome_pips?.toFixed(1)} pips</span>
              ) : (
                <span className="text-red-400">{occ.outcome_pips?.toFixed(1)} pips</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        💡 Tip: For full candlestick charts, integrate TradingView Lightweight Charts library
      </div>
    </div>
  )
}
