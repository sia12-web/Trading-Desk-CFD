import type { OandaCandle } from '@/lib/types/oanda'

/**
 * Construct M45 candles from M15 candles by merging every 3 consecutive candles.
 * OANDA does not offer 45-minute granularity natively.
 *
 * Aggregation: Open = first, High = max, Low = min, Close = last, Volume = sum
 * Partial groups (<3 candles at end) are discarded.
 */
export function constructM45Candles(m15Candles: OandaCandle[]): OandaCandle[] {
    const result: OandaCandle[] = []
    const groupSize = 3

    for (let i = 0; i + groupSize <= m15Candles.length; i += groupSize) {
        const group = m15Candles.slice(i, i + groupSize)
        const first = group[0]
        const last = group[group.length - 1]

        const highs = group.map(c => parseFloat(c.mid.h))
        const lows = group.map(c => parseFloat(c.mid.l))

        result.push({
            time: first.time,
            mid: {
                o: first.mid.o,
                h: Math.max(...highs).toString(),
                l: Math.min(...lows).toString(),
                c: last.mid.c,
            },
            volume: group.reduce((sum, c) => sum + c.volume, 0),
            complete: group.every(c => c.complete),
        })
    }

    return result
}
