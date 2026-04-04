'use client'

interface DayDistributionChartProps {
  distribution: Record<string, number>
}

export function DayDistributionChart({ distribution }: DayDistributionChartProps) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  const counts = days.map(day => distribution[day] || 0)
  const max = Math.max(...counts, 1) // Avoid division by zero

  return (
    <div className="flex gap-2 items-end h-20">
      {days.map((day, index) => {
        const count = counts[index]
        const height = (count / max) * 100
        const isMax = count === max && max > 0

        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-neutral-500 font-bold">{count}</div>
            <div
              className={`w-full rounded-t transition-all ${
                isMax ? 'bg-purple-500' : 'bg-blue-500'
              }`}
              style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
              title={`${day}: ${count} occurrences`}
            />
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
              {day.slice(0, 3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
