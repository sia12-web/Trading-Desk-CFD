export interface PivotPointLevels {
    pp: number     // Pivot Point (central)
    r1: number     // Resistance 1
    r2: number     // Resistance 2
    r3: number     // Resistance 3
    s1: number     // Support 1
    s2: number     // Support 2
    s3: number     // Support 3

    // Midpoints
    m1: number     // Midpoint between S1 and PP
    m2: number     // Midpoint between PP and R1
    m3: number     // Midpoint between R1 and R2
    m4: number     // Midpoint between S1 and S2
}

export interface CalculatedIndicators {
    ema: Record<number, number[]>  // period → values
    sma: Record<number, number[]>
    rsi: number[]
    macd: { line: number[], signal: number[], histogram: number[] }
    stochastic: { k: number[], d: number[] }
    bollingerBands: { upper: number[], middle: number[], lower: number[] }
    bbWidth: number[]  // (upper - lower) / middle * 100 — measures Bollinger Band squeeze
    atr: number[]
    pivotPoints: PivotPointLevels
    parabolicSar: { sar: number[], direction: string[] }
    adx: number[]
    volume: number[]
    volumeSma: number[]
}
