export interface CyclePhase {
    cycleName: string
    currentPhase: string
    phaseDescription: string
    startedApprox: string          // "2024 Q1"
    expectedDuration: string       // "2024-2026"
    historicalBias: "bullish_usd" | "bearish_usd" | "volatile" | "neutral"
    forexImplications: string[]
    confidence: "high" | "moderate" | "low"  // how reliable this cycle is
    caveat: string                 // always present — the "rhythm not schedule" warning
}

export interface SeasonalPattern {
    month: number
    monthName: string
    historicalBias: string
    typicalBehavior: string
    forexNotes: string
    keyEvents: string[]  // recurring events: "NFP first Friday", "ECB meeting", etc.
}

export interface CycleSnapshot {
    currentDate: Date
    cycles: CyclePhase[]
    currentMonth: SeasonalPattern
    nextMonth: SeasonalPattern
    overallBias: string     // combined reading from all cycles
    summary: string         // compact string for the daily cycle summary (~100 tokens)
}

export function getTenYearCycle(currentDate: Date): CyclePhase {
    const year = currentDate.getFullYear();

    const cycleConfig = {
        lastBust: 2020,
        phases: [
            { name: "Recovery", yearOffset: [0, 1], bias: "bullish_usd" as const },
            { name: "Expansion", yearOffset: [2, 5], bias: "neutral" as const },
            { name: "Late Expansion", yearOffset: [6, 8], bias: "volatile" as const },
            { name: "Contraction Risk", yearOffset: [9, 11], bias: "bearish_usd" as const }
        ]
    };

    const yearsSinceBust = year - cycleConfig.lastBust;
    const phase = cycleConfig.phases.find(p =>
        yearsSinceBust >= p.yearOffset[0] && yearsSinceBust <= p.yearOffset[1]
    ) || cycleConfig.phases[cycleConfig.phases.length - 1];

    return {
        cycleName: "10-Year Economic Cycle",
        currentPhase: phase.name,
        phaseDescription: getPhaseDescription(phase.name),
        startedApprox: `${cycleConfig.lastBust + phase.yearOffset[0]}`,
        expectedDuration: `${cycleConfig.lastBust + phase.yearOffset[0]}-${cycleConfig.lastBust + phase.yearOffset[1]}`,
        historicalBias: phase.bias,
        forexImplications: getTenYearImplications(phase.name),
        confidence: "moderate",
        caveat: "The 10-year cycle averages 7-11 years. External shocks (COVID, wars) can accelerate or delay phases. Use as background context, not trade timing."
    };
}

function getPhaseDescription(phase: string): string {
    const descriptions: Record<string, string> = {
        "Recovery": "Economy rebuilding after downturn. Central banks keep rates low. Risk assets begin recovering. USD may weaken as stimulus flows outward.",
        "Expansion": "Healthy growth phase. Employment rising, businesses investing. Forex markets tend to trend well. Good environment for carry trades.",
        "Late Expansion": "Growth slowing but still positive. Central banks tightening policy (raising rates). Watch for yield curve inversion as recession warning. USD often strengthens as rates rise.",
        "Contraction Risk": "Elevated risk of recession. Markets become more volatile. Safe havens (USD, JPY, CHF) outperform. Risk currencies (AUD, NZD) vulnerable to sharp selloffs."
    };
    return descriptions[phase] || "Unknown phase";
}

function getTenYearImplications(phase: string): string[] {
    const implications: Record<string, string[]> = {
        "Recovery": [
            "Risk-on currencies (AUD, NZD) tend to outperform as confidence returns",
            "USD may weaken as Fed keeps rates low and stimulus flows globally",
            "Emerging market currencies benefit from cheap dollar funding",
            "Good time for trend-following strategies — moves tend to be directional"
        ],
        "Expansion": [
            "Forex trends tend to be cleaner and longer-lasting",
            "Carry trades work well — borrow low-yield (JPY) buy high-yield (AUD)",
            "USD direction depends on whether US growth leads or lags other economies",
            "Volatility is moderate — good environment for swing trading"
        ],
        "Late Expansion": [
            "USD often strengthens as Fed raises rates ahead of other central banks",
            "Yield differentials become the dominant forex driver",
            "Watch for central bank policy divergence — creates strong trends",
            "Volatility begins increasing — tighten risk management"
        ],
        "Contraction Risk": [
            "Safe havens dominate: JPY, CHF, and USD strengthen",
            "Risk currencies (AUD, NZD, CAD) vulnerable to sharp drops",
            "Correlations between pairs increase — diversification becomes harder",
            "Reduce position sizes and trade frequency — preservation over profit"
        ]
    };
    return implications[phase] || [];
}

export function getPresidentialCycle(currentDate: Date): CyclePhase {
    const year = currentDate.getFullYear();
    const lastElection = Math.floor(year / 4) * 4;
    const yearInCycle = year - lastElection; // 0=election, 1=year1, 2=year2, 3=year3

    const phases: Record<number, { name: string, bias: string, description: string, implications: string[] }> = {
        0: {
            name: "Election Year",
            bias: "volatile",
            description: "Maximum uncertainty. Markets hate not knowing who will control policy. Expect choppy, range-bound price action with sudden spikes around debate and election dates.",
            implications: [
                "USD can swing wildly on polls and election results",
                "Avoid large positions around election week (early November)",
                "Policy uncertainty often strengthens safe havens temporarily",
                "Post-election (Nov-Dec), strong trends often emerge as uncertainty resolves"
            ]
        },
        1: {
            name: "Post-Election Year 1",
            bias: "bearish_usd",
            description: "New administration implements tough policies — spending cuts, regulation changes, trade policy shifts. Markets adjust to new reality. Historically one of the weaker years.",
            implications: [
                "New trade policies can create sharp moves in affected currency pairs",
                "USD may weaken as new spending priorities shift capital flows",
                "Increased government borrowing can pressure bond markets and USD",
                "Be cautious with longer-term positions — policy direction still unclear"
            ]
        },
        2: {
            name: "Mid-Term Year",
            bias: "neutral",
            description: "Midterm elections add some uncertainty but less than presidential. Economy typically stabilizing under new policies. Markets begin pricing in the next phase.",
            implications: [
                "Moderate volatility — midterms matter less for forex than presidential",
                "Watch for fiscal policy shifts if Congress changes party control",
                "Often a transition year — old trends end, new ones begin",
                "Good time to review and adjust long-term strategy bias"
            ]
        },
        3: {
            name: "Pre-Election Year",
            bias: "bullish_usd",
            description: "Historically the STRONGEST year. Politicians stimulate the economy to win votes — tax cuts, spending increases, easy monetary policy. Markets tend to rally.",
            implications: [
                "US equities historically strongest — risk-on sentiment lifts AUD, NZD",
                "USD can go either way: strong economy supports it, but stimulus weakens it",
                "Trend-following strategies tend to perform well",
                "Best year for bigger position sizes if your system confirms the trends"
            ]
        }
    };

    const phase = phases[yearInCycle] || phases[0];

    return {
        cycleName: "4-Year Presidential Cycle",
        currentPhase: phase.name,
        phaseDescription: phase.description,
        startedApprox: `${lastElection + yearInCycle} Jan`,
        expectedDuration: `${lastElection + yearInCycle}`,
        historicalBias: phase.bias as any,
        forexImplications: phase.implications,
        confidence: "moderate",
        caveat: "The presidential cycle is a statistical tendency, not a guarantee. Global events, Fed policy, and geopolitics can easily override domestic political cycles."
    };
}

export function getSeasonalPattern(month: number): SeasonalPattern {
    const patterns: Record<number, SeasonalPattern> = {
        1: {
            month: 1, monthName: "January",
            historicalBias: "Trend-setting",
            typicalBehavior: "New year capital allocation. Institutional traders establish new positions. January often sets the tone for Q1.",
            forexNotes: "The 'January Effect' — direction established in Jan often continues through March. Watch for new trends emerging.",
            keyEvents: ["Central bank meetings resume", "Year-end flows unwinding"]
        },
        2: {
            month: 2, monthName: "February",
            historicalBias: "Continuation",
            typicalBehavior: "Trends from January tend to continue. Lower volatility than January as positions are established.",
            forexNotes: "Good month for trend-following. Carry trades often perform well.",
            keyEvents: ["G20 meetings often in Feb", "Chinese New Year can reduce Asian session liquidity"]
        },
        3: {
            month: 3, monthName: "March",
            historicalBias: "Quarter-end volatility",
            typicalBehavior: "End of Q1. Institutional rebalancing creates volatility in final week. Japanese fiscal year ends March 31 — massive JPY flows.",
            forexNotes: "Watch JPY pairs closely in late March — Japanese fund repatriation can move USD/JPY 200+ pips. Quarter-end rebalancing can reverse trends temporarily.",
            keyEvents: ["Q1 ends — portfolio rebalancing", "Japanese fiscal year end (March 31)", "BOJ policy meetings"]
        },
        4: {
            month: 4, monthName: "April",
            historicalBias: "Fresh trends",
            typicalBehavior: "New quarter, new capital deployment. Japanese new fiscal year begins — fresh institutional flows. Often sees strong trend starts.",
            forexNotes: "Japanese new fiscal year starts April 1 — watch for new JPY trends. New Q2 positioning can establish trends that last months.",
            keyEvents: ["Japanese new fiscal year", "Q2 begins", "Spring IMF meetings"]
        },
        5: {
            month: 5, monthName: "May",
            historicalBias: "Transition",
            typicalBehavior: "'Sell in May and go away' — trading volume begins declining as summer approaches. Existing trends may lose momentum.",
            forexNotes: "Consider tightening take profits on existing positions. New trend entries become less reliable as liquidity drops.",
            keyEvents: ["Start of summer slowdown", "Major economic conferences"]
        },
        6: {
            month: 6, monthName: "June",
            historicalBias: "Low volatility",
            typicalBehavior: "Q2 ends. Summer holiday season starting for London and NY traders. Reduced liquidity can cause choppy, range-bound markets.",
            forexNotes: "Range-trading strategies may outperform trend-following. Be cautious with breakout trades — many are fakeouts in low liquidity.",
            keyEvents: ["Q2 ends — some rebalancing", "FOMC June meeting often significant", "Start of summer holidays"]
        },
        7: {
            month: 7, monthName: "July",
            historicalBias: "Summer doldrums",
            typicalBehavior: "Peak vacation season. Thinnest liquidity of the year in many pairs. Markets can be deceptively quiet then suddenly spike on thin volume.",
            forexNotes: "Reduce position sizes. Thin liquidity means stops can get blown by random spikes. Spreads may widen. Good time to review and plan rather than trade aggressively.",
            keyEvents: ["Peak summer — lowest liquidity", "Unexpected moves on thin volume"]
        },
        8: {
            month: 8, monthName: "August",
            historicalBias: "Late summer / volatility returning",
            typicalBehavior: "Second half of August sees traders returning. Some of the biggest historical crashes happened in August (1998 LTCM, 2015 China).",
            forexNotes: "Late August can surprise with sharp moves as traders return and react to what they missed. Be prepared for increased volatility from the third week onward.",
            keyEvents: ["Jackson Hole Symposium (late Aug) — Fed signals", "Traders returning from holidays"]
        },
        9: {
            month: 9, monthName: "September",
            historicalBias: "High volatility — trend reversals",
            typicalBehavior: "Everyone is back. Full liquidity returns. Historically the most dangerous month for markets. Major trends often reverse or accelerate.",
            forexNotes: "September-October is where big money is made or lost. Trends from H1 may reverse. New multi-month trends often start here. Increase watchfulness, ensure risk rules are tight.",
            keyEvents: ["Full liquidity returns", "Q3 approaching end", "Historically crash-prone month"]
        },
        10: {
            month: 10, monthName: "October",
            historicalBias: "Continuation of September moves",
            typicalBehavior: "Trends that started in September tend to accelerate. October is historically famous for crashes (1987, 2008) but also for strong rallies.",
            forexNotes: "Follow September's direction. If a new trend started in September, October usually confirms and extends it. Good month for trend-following.",
            keyEvents: ["Q3 ends — rebalancing", "US earnings season impacts risk sentiment", "Historically volatile"]
        },
        11: {
            month: 11, monthName: "November",
            historicalBias: "Year-end positioning begins",
            typicalBehavior: "Institutional traders begin locking in year-end profits. Presidential elections in Year 4. Thanksgiving week (US) sees reduced liquidity.",
            forexNotes: "Watch for trend exhaustion as funds take profits. Thanksgiving week (4th Thursday) is very low liquidity — avoid. Election years: November is maximum uncertainty then maximum clarity.",
            keyEvents: ["US elections (every 4 years)", "Thanksgiving — low liquidity week", "Year-end profit-taking begins"]
        },
        12: {
            month: 12, monthName: "December",
            historicalBias: "Low liquidity / window dressing",
            typicalBehavior: "Holiday season. Very thin markets after mid-December. Institutional 'window dressing' — funds buy winners and sell losers to make annual reports look good.",
            forexNotes: "First two weeks may see normal trading. After December 15, liquidity drops dramatically. Avoid large positions in the last two weeks. Random spikes on thin volume are common.",
            keyEvents: ["Christmas and New Year holidays", "Window dressing by institutions", "Extremely low liquidity Dec 24-Jan 2"]
        }
    };

    return patterns[month] || patterns[1];
}

export function getCycleSnapshot(currentDate: Date): CycleSnapshot {
    const tenYear = getTenYearCycle(currentDate);
    const presidential = getPresidentialCycle(currentDate);
    const currentMonth = getSeasonalPattern(currentDate.getMonth() + 1);
    const nextMonth = getSeasonalPattern((currentDate.getMonth() + 1) % 12 + 1);

    // Generate compact summary for the cycle snapshot (~100 tokens)
    const summary = `CYCLES: 10yr=${tenYear.currentPhase} (${tenYear.historicalBias}). Presidential=${presidential.currentPhase} (${presidential.historicalBias}). Season=${currentMonth.monthName}: ${currentMonth.historicalBias}. ${currentMonth.forexNotes.split('.')[0]}.`;

    return {
        currentDate,
        cycles: [tenYear, presidential],
        currentMonth,
        nextMonth,
        overallBias: deriveOverallBias(tenYear, presidential, currentMonth),
        summary
    };
}

function deriveOverallBias(tenYear: CyclePhase, presidential: CyclePhase, season: SeasonalPattern): string {
    // Combine the three cycle readings into a simple narrative
    // This is qualitative, not quantitative — it's educational context
    return `${tenYear.currentPhase} in the economic cycle, ${presidential.currentPhase} in the political cycle. Seasonal tendency for ${season.monthName}: ${season.historicalBias}. Overall: trade with extra awareness of macro conditions.`;
}
