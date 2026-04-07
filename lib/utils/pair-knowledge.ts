export interface PairKnowledge {
    pair: string;
    displayName: string;
    baseCurrency: string;
    quoteCurrency: string;
    nickname: string | null;

    // Session data
    bestSessions: string[];
    worstSessions: string[];
    avgDailyRange: number; // pips
    avgRangeBySession: Record<string, number>;

    // What drives this pair
    drivers: string[];

    // Correlations with other pairs
    correlations: { pair: string; type: "positive" | "negative"; strength: "strong" | "moderate"; explanation: string }[];

    // Common mistakes
    warnings: string[];

    // Quick tips
    tips: string[];

    // Intelligence summary (consolidated from session-pairs)
    intelligenceSummary: string;

    // Relative strength note
    strengthNote?: string;
}

export function getSessionAdvice(pair: string, currentSession: any): string {
    const knowledge = PAIR_KNOWLEDGE[pair.replace('_', '/')];
    if (!knowledge) return "General market conditions apply to this pair.";

    const { displaySession, marketPhase } = currentSession;

    if (marketPhase === 'weekend') {
        return "⚠️ Market is closed for the weekend. Expect spread gaps on Sunday open.";
    }

    const isIdeal = knowledge.bestSessions.some(s =>
        s.toLowerCase().includes(displaySession.toLowerCase()) ||
        displaySession.toLowerCase().includes(s.toLowerCase())
    );

    const isWorst = knowledge.worstSessions.some(s =>
        s.toLowerCase().includes(displaySession.toLowerCase()) ||
        displaySession.toLowerCase().includes(s.toLowerCase())
    );

    if (isIdeal) {
        return `✅ Ideal session for ${knowledge.pair}. Current: ${displaySession}. Spreads are usually tightest and liquidity highest.`;
    }

    if (isWorst) {
        return `⚠️ Suboptimal session. ${knowledge.pair} moves best during ${knowledge.bestSessions.join(' or ')}. Currently in ${displaySession} (${knowledge.worstSessions[0]} is usually choppy).`;
    }

    return `📍 ${displaySession} session active. ${knowledge.pair} performs best in ${knowledge.bestSessions.join(', ')}.`;
}

export const PAIR_KNOWLEDGE: Record<string, PairKnowledge> = {
    "EUR/USD": {
        pair: "EUR/USD",
        displayName: "Euro / US Dollar",
        baseCurrency: "EUR",
        quoteCurrency: "USD",
        nickname: "Fiber",
        bestSessions: ["London", "London-New York overlap"],
        worstSessions: ["Tokyo"],
        avgDailyRange: 80,
        avgRangeBySession: { "Tokyo": 30, "London": 80, "New York": 70, "London-NY overlap": 100 },
        intelligenceSummary: "Most liquid pair. Tightest spreads during London-NY overlap. Avoid trading during Tokyo — low volatility, choppy.",
        drivers: [
            "ECB interest rate decisions and press conferences",
            "US Federal Reserve policy and FOMC statements",
            "Eurozone and US employment data (NFP)",
            "Inflation reports (CPI) from both regions",
            "Risk sentiment — EUR weakens in risk-off environments"
        ],
        correlations: [
            { pair: "GBP/USD", type: "positive", strength: "strong", explanation: "Both move against USD. When dollar weakens, both tend to rise." },
            { pair: "USD/CHF", type: "negative", strength: "strong", explanation: "Almost mirror image. EUR/USD up usually means USD/CHF down." },
            { pair: "USD/JPY", type: "negative", strength: "moderate", explanation: "Generally inverse, but JPY has its own dynamics during risk events." }
        ],
        warnings: [
            "Extremely choppy during Tokyo — avoid unless you have a specific catalyst",
            "Spreads widen significantly during low-liquidity hours (22:00-00:00 UTC)",
            "NFP Friday (first Friday of month, 13:30 UTC) creates massive spikes — either avoid or trade with wider SL"
        ],
        tips: [
            "The London open (07:00 UTC) often sets the day's direction for EUR/USD",
            "Watch the 1.x000 round numbers — they act as psychological support/resistance",
            "If trading during London-NY overlap, this pair has the tightest spreads in the market"
        ]
    },
    "GBP/USD": {
        pair: "GBP/USD",
        displayName: "British Pound / US Dollar",
        baseCurrency: "GBP",
        quoteCurrency: "USD",
        nickname: "Cable",
        bestSessions: ["London", "London-New York overlap"],
        worstSessions: ["Tokyo"],
        avgDailyRange: 100,
        avgRangeBySession: { "Tokyo": 35, "London": 100, "New York": 80, "London-NY overlap": 120 },
        intelligenceSummary: "Volatile during London open. Often sees sharp moves in first hour of London. Be cautious of UK news at 07:00-09:30 UTC.",
        drivers: [
            "Bank of England rate decisions",
            "UK employment, GDP, and inflation data",
            "US Federal Reserve policy",
            "Brexit-related political developments",
            "Risk sentiment — GBP is moderately risk-sensitive"
        ],
        correlations: [
            { pair: "EUR/USD", type: "positive", strength: "strong", explanation: "Both are anti-dollar. They often move together but GBP is more volatile." },
            { pair: "EUR/GBP", type: "negative", strength: "strong", explanation: "When GBP/USD rises but EUR/USD doesn't keep up, EUR/GBP falls." },
            { pair: "GBP/JPY", type: "positive", strength: "strong", explanation: "Both reflect GBP strength. GBP/JPY amplifies GBP moves." }
        ],
        warnings: [
            "GBP is more volatile than EUR — moves can be sharp and sudden during London",
            "UK data releases (07:00-09:30 UTC) can cause 50+ pip spikes",
            "GBP/USD tends to 'fake out' at session opens — wait 15-30 min for direction to establish"
        ],
        tips: [
            "The first hour of London often produces the day's biggest GBP move",
            "Cable respects round numbers (1.x000, 1.x500) as key psychological levels",
            "If you're already long EUR/USD, going long GBP/USD doubles your USD exposure — check correlated exposure rule"
        ]
    },
    "USD/JPY": {
        pair: "USD/JPY",
        displayName: "US Dollar / Japanese Yen",
        baseCurrency: "USD",
        quoteCurrency: "JPY",
        nickname: "Gopher",
        bestSessions: ["Tokyo", "New York", "London-New York overlap"],
        worstSessions: ["Late New York (after London close)"],
        avgDailyRange: 70,
        avgRangeBySession: { "Tokyo": 40, "London": 50, "New York": 60, "London-NY overlap": 70 },
        intelligenceSummary: "Active during Tokyo — driven by Japanese economic data and BoJ. Second wave of activity during NY session.",
        drivers: [
            "Bank of Japan policy (yield curve control, rate decisions)",
            "US Treasury yields — strong positive correlation",
            "Risk sentiment — JPY strengthens in risk-off (market fear)",
            "Japanese trade balance and capital flows",
            "US economic data (especially employment and inflation)"
        ],
        correlations: [
            { pair: "EUR/JPY", type: "positive", strength: "strong", explanation: "Both reflect JPY weakness/strength. When JPY weakens, both rise." },
            { pair: "GBP/JPY", type: "positive", strength: "strong", explanation: "Same JPY dynamic but amplified by GBP volatility." },
            { pair: "EUR/USD", type: "negative", strength: "moderate", explanation: "Generally inverse when USD is the driver, but diverges when JPY safe-haven flows dominate." }
        ],
        warnings: [
            "Bank of Japan interventions can cause 200-500 pip moves with zero warning",
            "JPY pairs use 2 decimal pips (not 4) — your system handles this automatically",
            "USD/JPY often gaps on Sunday open due to Asian market reactions to weekend events"
        ],
        tips: [
            "Watch US 10-year Treasury yield — USD/JPY tracks it closely",
            "Tokyo session (00:00-09:00 UTC) is when Japanese institutions set JPY direction",
            "Round numbers on JPY (150.000, 155.000) are heavily defended by BoJ — expect resistance"
        ]
    },
    "EUR/GBP": {
        pair: "EUR/GBP",
        displayName: "Euro / British Pound",
        baseCurrency: "EUR",
        quoteCurrency: "GBP",
        nickname: null,
        bestSessions: ["London"],
        worstSessions: ["Tokyo", "New York (after London close)"],
        avgDailyRange: 45,
        avgRangeBySession: { "Tokyo": 15, "London": 45, "New York": 25, "London-NY overlap": 35 },
        intelligenceSummary: "European cross — almost exclusively a London session pair. Very low volatility outside London hours.",
        drivers: [
            "ECB vs Bank of England policy divergence",
            "Relative economic performance UK vs Eurozone",
            "Political developments in either region"
        ],
        correlations: [
            { pair: "EUR/USD", type: "positive", strength: "moderate", explanation: "When EUR is strong overall, EUR/GBP tends to rise." },
            { pair: "GBP/USD", type: "negative", strength: "strong", explanation: "When GBP strengthens, EUR/GBP falls." }
        ],
        warnings: [
            "This pair barely moves outside London hours — don't expect your TP to hit during Tokyo or late NY",
            "Small daily range means position sizing needs adjustment — your 30 pip SL might be half the daily range",
            "Spreads are wider than the majors — factor this into your risk calculation"
        ],
        tips: [
            "Best traded when UK and Eurozone data releases conflict (one bullish, one bearish)",
            "This is a mean-reverting pair — it tends to range rather than trend strongly",
            "If you're trading both EUR/USD and GBP/USD, EUR/GBP is already an implicit position"
        ]
    },
    "AUD/USD": {
        pair: "AUD/USD",
        displayName: "Australian Dollar / US Dollar",
        baseCurrency: "AUD",
        quoteCurrency: "USD",
        nickname: "Aussie",
        bestSessions: ["Tokyo", "London-New York overlap"],
        worstSessions: ["Late New York"],
        avgDailyRange: 60,
        avgRangeBySession: { "Tokyo": 45, "London": 50, "New York": 55, "London-NY overlap": 65 },
        intelligenceSummary: "Most active during Tokyo due to Australian economic releases. Commodity-linked — watch gold and iron ore.",
        drivers: [
            "Reserve Bank of Australia rate decisions",
            "Chinese economic data (Australia's largest trade partner)",
            "Iron ore and gold prices — AUD is commodity-linked",
            "Risk sentiment — AUD is a risk-on currency",
            "Australian employment and GDP data"
        ],
        correlations: [
            { pair: "NZD/USD", type: "positive", strength: "strong", explanation: "Very similar economies and drivers. Often move in tandem." },
            { pair: "Gold (XAU/USD)", type: "positive", strength: "moderate", explanation: "Australia is a major gold exporter. Gold up → AUD tends to strengthen." },
            { pair: "USD/JPY", type: "positive", strength: "moderate", explanation: "Both are risk-sentiment pairs — rise in risk-on, fall in risk-off." }
        ],
        warnings: [
            "Chinese PMI data releases can spike AUD/USD unexpectedly",
            "As a risk currency, AUD can sell off hard during global uncertainty — wider SL needed",
            "RBA decisions come at 03:30 UTC — middle of Tokyo session, can catch you off guard"
        ],
        tips: [
            "If you're bullish on commodities or China's economy, AUD/USD is a good proxy trade",
            "Tokyo session is prime time — Australian data drops between 00:30-02:30 UTC",
            "AUD/NZD is less volatile if you want commodity exposure without full USD risk"
        ]
    },
    "USD/CAD": {
        pair: "USD/CAD",
        displayName: "US Dollar / Canadian Dollar",
        baseCurrency: "USD",
        quoteCurrency: "CAD",
        nickname: "Loonie",
        bestSessions: ["New York", "London-New York overlap"],
        worstSessions: ["Tokyo"],
        avgDailyRange: 65,
        avgRangeBySession: { "Tokyo": 25, "London": 40, "New York": 65, "London-NY overlap": 70 },
        intelligenceSummary: "Driven by US and Canadian data. Watch oil prices — CAD is heavily correlated with crude. Most active during NY.",
        drivers: [
            "Oil prices (WTI crude) — Canada is a major oil exporter",
            "Bank of Canada rate decisions",
            "US and Canadian employment data (both release same day monthly)",
            "Trade balance between US and Canada",
            "US Federal Reserve policy"
        ],
        correlations: [
            { pair: "Oil (WTI)", type: "negative", strength: "strong", explanation: "Oil up → CAD strengthens → USD/CAD falls. This is the key driver." },
            { pair: "EUR/USD", type: "negative", strength: "moderate", explanation: "Both have USD — when USD weakens, EUR/USD rises but USD/CAD falls." }
        ],
        warnings: [
            "Almost dead during Tokyo session — don't expect meaningful moves",
            "Oil price spikes can override all technical analysis on this pair",
            "US and Canadian employment data release simultaneously (13:30 UTC first Friday) — double volatility"
        ],
        tips: [
            "Always check WTI crude oil before trading USD/CAD — it's the hidden driver",
            "Best traded during NY session when both US and Canadian markets are active",
            "This pair trends well — good for swing trades with wider TPs"
        ]
    },
    "NZD/USD": {
        pair: "NZD/USD",
        displayName: "New Zealand Dollar / US Dollar",
        baseCurrency: "NZD",
        quoteCurrency: "USD",
        nickname: "Kiwi",
        bestSessions: ["Tokyo"],
        worstSessions: ["New York (after London close)"],
        avgDailyRange: 55,
        avgRangeBySession: { "Tokyo": 40, "London": 35, "New York": 40, "London-NY overlap": 50 },
        intelligenceSummary: "Similar to AUD/USD but less liquid. Best during early Asian session when NZ data releases.",
        drivers: [
            "Reserve Bank of New Zealand rate decisions",
            "Dairy prices (New Zealand's key export)",
            "Chinese economic data",
            "Risk sentiment — similar to AUD but less liquid"
        ],
        correlations: [
            { pair: "AUD/USD", type: "positive", strength: "strong", explanation: "Very similar drivers. Often move together." },
            { pair: "AUD/NZD", type: "negative", strength: "moderate", explanation: "When NZD strengthens relative to AUD, AUD/NZD falls." }
        ],
        warnings: [
            "Less liquid than AUD/USD — spreads can be wider",
            "RBNZ decisions come at 01:00 UTC — early Tokyo session",
            "Dairy auction results (GDT) can move this pair — released every 2 weeks"
        ],
        tips: [
            "Best during early Asian session when NZ data releases",
            "If choosing between AUD and NZD trades, check AUD/NZD to see which is relatively stronger",
            "Kiwi tends to overreact to data — mean reversion setups work well after spikes"
        ]
    },
    "EUR/JPY": {
        pair: "EUR/JPY",
        displayName: "Euro / Japanese Yen",
        baseCurrency: "EUR",
        quoteCurrency: "JPY",
        nickname: "Yuppy",
        bestSessions: ["Tokyo-London overlap", "London"],
        worstSessions: ["Late New York"],
        avgDailyRange: 90,
        avgRangeBySession: { "Tokyo": 45, "London": 80, "New York": 55, "London-NY overlap": 75 },
        intelligenceSummary: "Cross pair with wider spreads. Most volatile during Tokyo-London overlap when both regions are active.",
        drivers: [
            "ECB and BoJ policy divergence",
            "Risk sentiment — falls in risk-off as JPY strengthens",
            "Eurozone economic data",
            "Japanese institutional capital flows"
        ],
        correlations: [
            { pair: "EUR/USD", type: "positive", strength: "moderate", explanation: "EUR strength lifts both, but EUR/JPY adds JPY dynamics." },
            { pair: "USD/JPY", type: "positive", strength: "strong", explanation: "Both reflect JPY weakness. When JPY sells off, both rise." }
        ],
        warnings: [
            "Cross pair — wider spreads than EUR/USD or USD/JPY individually",
            "Can be very volatile during risk events — combines EUR and JPY volatility",
            "BoJ interventions affect all JPY pairs simultaneously"
        ],
        tips: [
            "Tokyo-London overlap (07:00-09:00 UTC) is the sweet spot — both regions active",
            "If you're bullish EUR and bearish JPY, this pair gives you both in one trade",
            "Watch this pair as a risk sentiment indicator — sharp drops signal risk-off"
        ]
    },
    "USD/CHF": {
        pair: "USD/CHF",
        displayName: "US Dollar / Swiss Franc",
        baseCurrency: "USD",
        quoteCurrency: "CHF",
        nickname: "Swissy",
        bestSessions: ["London", "London-New York overlap"],
        worstSessions: ["Tokyo"],
        avgDailyRange: 60,
        avgRangeBySession: { "Tokyo": 25, "London": 55, "New York": 50, "London-NY overlap": 65 },
        intelligenceSummary: "Safe haven pair. Inversely correlated with EUR/USD. Watch during risk-off events.",
        drivers: [
            "Swiss National Bank policy",
            "US Federal Reserve policy",
            "Risk sentiment — CHF is a safe haven like JPY",
            "Gold prices (Switzerland's gold reserves)"
        ],
        correlations: [
            { pair: "EUR/USD", type: "negative", strength: "strong", explanation: "Nearly perfect inverse. Trading both is essentially doubling your position." },
            { pair: "EUR/CHF", type: "positive", strength: "moderate", explanation: "SNB often manages EUR/CHF, which affects USD/CHF indirectly." }
        ],
        warnings: [
            "Almost perfectly inverse to EUR/USD — don't trade both in the same direction",
            "SNB is known for surprise interventions (remember Jan 2015 flash crash)",
            "Lower liquidity than EUR/USD — spreads can be wider"
        ],
        tips: [
            "If your EUR/USD analysis says short, you could also go long USD/CHF — same thesis, different pair",
            "Use as a confirmation: if EUR/USD is rising AND USD/CHF is falling, the move is likely genuine",
            "Safe haven flows during crises push CHF stronger (USD/CHF down)"
        ]
    },
    "GBP/JPY": {
        pair: "GBP/JPY",
        displayName: "British Pound / Japanese Yen",
        baseCurrency: "GBP",
        quoteCurrency: "JPY",
        nickname: "The Beast / Dragon",
        bestSessions: ["London", "Tokyo-London overlap"],
        worstSessions: ["Late New York"],
        avgDailyRange: 130,
        avgRangeBySession: { "Tokyo": 50, "London": 120, "New York": 80, "London-NY overlap": 110 },
        intelligenceSummary: "Known as 'The Beast' — extremely volatile. Wide pip ranges but also wide spreads. Best during London session.",
        drivers: [
            "BoE and BoJ policy divergence",
            "Risk sentiment — extreme risk-on/risk-off pair",
            "UK economic data",
            "Japanese institutional flows"
        ],
        correlations: [
            { pair: "GBP/USD", type: "positive", strength: "strong", explanation: "GBP strength drives both up." },
            { pair: "USD/JPY", type: "positive", strength: "strong", explanation: "JPY weakness drives both up." },
            { pair: "EUR/JPY", type: "positive", strength: "strong", explanation: "Both reflect JPY dynamics." }
        ],
        warnings: [
            "Called 'The Beast' for a reason — daily range 130+ pips, can move 50 pips in minutes",
            "NOT recommended for new traders — the volatility can blow through stop losses",
            "Spreads are significantly wider than major pairs — factor 3-5 pips spread cost",
            "Your risk per trade should be LOWER on this pair due to extreme volatility"
        ],
        tips: [
            "If you trade this, use wider stop losses and smaller position sizes",
            "London session is when this pair comes alive — Tokyo is relatively calm",
            "Great for catching big moves but requires strict discipline — set SL and don't touch it"
        ]
    },
    "GBP/AUD": {
        pair: "GBP/AUD",
        displayName: "British Pound / Australian Dollar",
        baseCurrency: "GBP",
        quoteCurrency: "AUD",
        nickname: "The Geordie",
        bestSessions: ["London", "Tokyo-London overlap"],
        worstSessions: ["Late New York"],
        avgDailyRange: 150,
        avgRangeBySession: { "Tokyo": 70, "London": 140, "New York": 90, "London-NY overlap": 130 },
        intelligenceSummary: "Very high volatility. Combines GBP session-open volatility with AUD commodity sensitivity. Best during London open.",
        drivers: [
            "BoE vs RBA policy divergence",
            "Commodity prices (Iron ore, gold)",
            "UK vs Australian economic data",
            "Chinese economic data"
        ],
        correlations: [
            { pair: "GBP/USD", type: "positive", strength: "strong", explanation: "GBP strength lifts both." },
            { pair: "AUD/USD", type: "negative", strength: "strong", explanation: "AUD strength causes GBP/AUD to fall." }
        ],
        warnings: [
            "Extremely high daily range (150+ pips) — use smaller position sizes",
            "Wide spreads — usually 3-7 pips depending on liquidity",
            "AUD data drops (01:30 UTC) can cause massive moves during Tokyo"
        ],
        tips: [
            "Strong commodity + risk-driven flows make this a favorite for swing traders",
            "London open is the peak window for GBP/AUD",
            "Watch this during Chinese PMI releases — it drives the AUD side hard"
        ]
    },
    "EUR/AUD": {
        pair: "EUR/AUD",
        displayName: "Euro / Australian Dollar",
        baseCurrency: "EUR",
        quoteCurrency: "AUD",
        nickname: null,
        bestSessions: ["London", "Tokyo-London overlap"],
        worstSessions: ["New York (after London close)"],
        avgDailyRange: 120,
        avgRangeBySession: { "Tokyo": 50, "London": 110, "New York": 70, "London-NY overlap": 100 },
        intelligenceSummary: "Risk proxy cross. Driven by ECB macro and AUD commodity sensitivity. Moves well during London.",
        drivers: [
            "ECB vs RBA policy",
            "Chinese economic data",
            "Commodity prices",
            "Eurozone macro sentiment"
        ],
        correlations: [
            { pair: "EUR/USD", type: "positive", strength: "strong", explanation: "EUR strength lifts both." },
            { pair: "AUD/USD", type: "negative", strength: "strong", explanation: "AUD strength causes EUR/AUD to fall." }
        ],
        warnings: [
            "High volatility for a cross — can move 100+ pips without much effort",
            "Spreads widen significantly outside peak London hours",
            "Sensitive to Chinese data surprises"
        ],
        tips: [
            "Great alternative for EUR/USD traders wanting more volatility",
            "London open sets the tone for the day",
            "Relies heavily on risk sentiment — falls when market is 'risk-on'"
        ]
    },
    "AUD/JPY": {
        pair: "AUD/JPY",
        displayName: "Australian Dollar / Japanese Yen",
        baseCurrency: "AUD",
        quoteCurrency: "JPY",
        nickname: null,
        bestSessions: ["Tokyo", "London-New York overlap"],
        worstSessions: ["Late New York"],
        avgDailyRange: 95,
        avgRangeBySession: { "Tokyo": 60, "London": 70, "New York": 65, "London-NY overlap": 85 },
        intelligenceSummary: "The 'Risk Barometer'. Strong correlation with equities. Rises when S&P 500 rises.",
        drivers: [
            "Global risk sentiment (equities/commodities)",
            "RBA vs BoJ policy",
            "Metals and energy prices",
            "Chinese economic growth"
        ],
        correlations: [
            { pair: "USD/JPY", type: "positive", strength: "strong", explanation: "Both reflect JPY moves." },
            { pair: "S&P 500", type: "positive", strength: "strong", explanation: "Highly correlated with US stock market." }
        ],
        warnings: [
            "Sudden stock market selloffs will gap this pair lower instantly",
            "JPY interventions by BoJ will affect AUD/JPY hard",
            "Carry trade dynamics mean interest rate changes have oversized effects"
        ],
        tips: [
            "Use as a confirmation of risk sentiment before trading majors",
            "Excellent for catching 'risk-on' rallies",
            "Tokyo session is very active for this pair"
        ]
    },
    "NZD/JPY": {
        pair: "NZD/JPY",
        displayName: "New Zealand Dollar / Japanese Yen",
        baseCurrency: "NZD",
        quoteCurrency: "JPY",
        nickname: null,
        bestSessions: ["Tokyo", "London-New York overlap"],
        worstSessions: ["Late New York"],
        avgDailyRange: 105,
        avgRangeBySession: { "Tokyo": 70, "London": 75, "New York": 70, "London-NY overlap": 90 },
        intelligenceSummary: "High-flying risk cross. Even more 'jumpy' than AUD/JPY due to lower liquidity. Great for risk-sentiment catching.",
        drivers: [
            "Global risk appetite",
            "RBNZ vs BoJ policy",
            "New Zealand dairy export prices",
            "Interest rate differentials"
        ],
        correlations: [
            { pair: "AUD/JPY", type: "positive", strength: "strong", explanation: "Move almost identically but NZD/JPY is often more aggressive." },
            { pair: "S&P 500", type: "positive", strength: "strong", explanation: "Risk-sensitive proxy." }
        ],
        warnings: [
            "Low liquidity can lead to sharp slippage during data releases",
            "Very 'jumpy' and prone to wicks — requires looser stop losses",
            "Spreads can be high during the Tokyo open"
        ],
        tips: [
            "If AUD/JPY looks bullish, NZD/JPY often provides the faster percentage gain",
            "Watch dairy auctions (GDT) for NZD-specific drivers",
            "Best traded during early Tokyo session"
        ]
    },
    "USD/TRY": {
        pair: "USD/TRY",
        displayName: "US Dollar / Turkish Lira",
        baseCurrency: "USD",
        quoteCurrency: "TRY",
        nickname: null,
        bestSessions: ["London", "New York"],
        worstSessions: ["Tokyo"],
        avgDailyRange: 400,
        avgRangeBySession: { "Tokyo": 50, "London": 300, "New York": 250, "London-NY overlap": 350 },
        intelligenceSummary: "Exotic pair with extreme volatility. Driven by Turkish inflation and geopolitical news. High spreads and swap costs.",
        drivers: [
            "Central Bank of Turkey (CBRT) policy",
            "Turkish inflation (CPI)",
            "Geopolitical relations and political stability",
            "US Dollar strength"
        ],
        correlations: [
            { pair: "Emerging Market Index", type: "positive", strength: "strong", explanation: "Reflects overall EM sentiment." },
            { pair: "USD/MXN", type: "positive", strength: "moderate", explanation: "Both are high-yield EM currencies." }
        ],
        warnings: [
            "Extreme spreads (can be 50+ pips) — not suitable for scalping",
            "Highly political — one news headline can move it 1000 pips",
            "Very high overnight swap costs (triple swap on Wednesdays)",
            "Limit your exposure — price can stay flat then move 5% in a day"
        ],
        tips: [
            "Only for experienced traders who monitor geopolitical news 24/7",
            "Avoid holding long-term unless you understand the swap costs",
            "Treat more like a stock than a forex major"
        ]
    },

    // ── Cryptocurrencies ──

    "BTC/USD": {
        pair: "BTC/USD",
        displayName: "Bitcoin / US Dollar",
        baseCurrency: "BTC",
        quoteCurrency: "USD",
        nickname: "Digital Gold",
        bestSessions: ["US market hours (14:00-21:00 UTC)", "24/7 — highest volume during US/EU overlap"],
        worstSessions: ["Weekend low-liquidity (Saturday 00:00-Sunday 12:00 UTC)"],
        avgDailyRange: 2500,
        avgRangeBySession: { "asia": 800, "london": 1200, "newyork": 1800, "overlap": 2500 },
        drivers: [
            "Halving cycles (4-year supply shock)",
            "Institutional adoption and ETF flows",
            "Federal Reserve policy (risk appetite proxy)",
            "On-chain metrics: exchange flows, whale wallets, miner behavior",
            "Regulatory headlines (SEC, global frameworks)",
            "Store of value narrative vs risk asset correlation"
        ],
        correlations: [
            { pair: "ETH/USD", type: "positive", strength: "strong", explanation: "ETH follows BTC in macro moves." },
            { pair: "SPX500/USD", type: "positive", strength: "moderate", explanation: "BTC increasingly correlated with risk assets." },
            { pair: "Gold (XAU/USD)", type: "positive", strength: "moderate", explanation: "Both compete as inflation hedges." }
        ],
        warnings: [
            "Volatility is 3-5x forex majors — size accordingly",
            "Weekend gaps and flash crashes are common in low liquidity",
            "Funding rates on futures can erode positions silently",
            "Regulatory announcements can cause 10%+ moves in hours"
        ],
        tips: [
            "BTC dominance rising = altcoins underperform, focus on BTC only",
            "Fear & Greed Index extremes (<20 or >80) are contrarian signals",
            "Halving cycles provide 4-year macro structure for wave analysis"
        ],
        intelligenceSummary: "Bitcoin is the anchor of the crypto market. Its price action drives the entire ecosystem. BTC dominance rising means capital flows FROM alts TO BTC. The 4-year halving cycle provides macro wave structure ideal for Elliott Wave analysis.",
        strengthNote: "BTC is the crypto market's risk barometer — all altcoins follow its lead."
    },
    "ETH/USD": {
        pair: "ETH/USD",
        displayName: "Ethereum / US Dollar",
        baseCurrency: "ETH",
        quoteCurrency: "USD",
        nickname: "World Computer",
        bestSessions: ["US market hours (14:00-21:00 UTC)", "DeFi activity peaks during EU/US overlap"],
        worstSessions: ["Weekend low-liquidity"],
        avgDailyRange: 150,
        avgRangeBySession: { "asia": 50, "london": 80, "newyork": 120, "overlap": 150 },
        drivers: [
            "DeFi total value locked (TVL) and protocol revenue",
            "Gas fees and network congestion (demand proxy)",
            "Staking yield and validator economics",
            "L2 adoption (Arbitrum, Optimism, Base)",
            "Protocol upgrades (EIPs, hard forks)",
            "BTC price action (ETH/BTC ratio)"
        ],
        correlations: [
            { pair: "BTC/USD", type: "positive", strength: "strong", explanation: "ETH follows BTC macro direction." },
            { pair: "SOL/USD", type: "positive", strength: "moderate", explanation: "Competing L1s move together in risk-on." }
        ],
        warnings: [
            "ETH/BTC ratio matters — ETH can drop even if BTC is flat",
            "Gas fee spikes during congestion can signal tops",
            "Protocol upgrades can cause volatility in both directions"
        ],
        tips: [
            "Watch ETH/BTC ratio for relative strength — rising = alt season signal",
            "DeFi TVL trends are a leading indicator for ETH demand",
            "Staking yield creates a floor narrative but doesn't prevent drawdowns"
        ],
        intelligenceSummary: "Ethereum is the backbone of DeFi and smart contracts. Its price reflects both crypto market sentiment and specific ecosystem health. The ETH/BTC ratio is the key metric for altcoin rotation.",
        strengthNote: "ETH leads the altcoin market — when ETH/BTC is rising, altseason is building."
    },
    "SOL/USD": {
        pair: "SOL/USD",
        displayName: "Solana / US Dollar",
        baseCurrency: "SOL",
        quoteCurrency: "USD",
        nickname: "Speed Chain",
        bestSessions: ["24/7 — highest volume during US hours"],
        worstSessions: ["Weekend low-liquidity"],
        avgDailyRange: 8,
        avgRangeBySession: { "asia": 3, "london": 5, "newyork": 7, "overlap": 8 },
        drivers: [
            "DeFi/NFT ecosystem growth on Solana",
            "VC backing and institutional interest",
            "Network reliability (outage history impacts sentiment)",
            "Meme coin activity on Solana (demand driver)",
            "BTC correlation (high beta to BTC moves)"
        ],
        correlations: [
            { pair: "BTC/USD", type: "positive", strength: "strong", explanation: "SOL is high-beta BTC — amplifies moves." },
            { pair: "ETH/USD", type: "positive", strength: "moderate", explanation: "Competing L1 — both move with risk appetite." }
        ],
        warnings: [
            "High beta — SOL can move 2-3x BTC percentage moves",
            "Network outages have caused 20%+ drops historically",
            "Meme coin frenzy can cause unsustainable pumps"
        ],
        tips: [
            "SOL is a beta play on BTC — use it when BTC trend is confirmed",
            "Network health metrics (TPS, uptime) are leading sentiment indicators",
            "Watch Solana DeFi TVL for ecosystem health"
        ],
        intelligenceSummary: "Solana is a high-performance L1 competing with Ethereum. It's a high-beta play — when crypto is bullish, SOL outperforms; when bearish, it drops harder. Network reliability is the key risk.",
        strengthNote: "SOL amplifies crypto market moves — use as a high-conviction trend vehicle."
    },
    "XRP/USD": {
        pair: "XRP/USD",
        displayName: "Ripple / US Dollar",
        baseCurrency: "XRP",
        quoteCurrency: "USD",
        nickname: "Banker's Coin",
        bestSessions: ["24/7 — spikes on regulatory news (any time)"],
        worstSessions: ["Weekend low-liquidity"],
        avgDailyRange: 0.03,
        avgRangeBySession: { "asia": 0.01, "london": 0.015, "newyork": 0.025, "overlap": 0.03 },
        drivers: [
            "Regulatory clarity (SEC case outcome, global frameworks)",
            "Institutional partnerships (banks, payment providers)",
            "Cross-border remittance adoption (RippleNet)",
            "BTC correlation (follows macro crypto trend)",
            "Tokenomics (Ripple's XRP holdings and release schedule)"
        ],
        correlations: [
            { pair: "BTC/USD", type: "positive", strength: "moderate", explanation: "Follows BTC in macro moves but can decouple on regulatory news." }
        ],
        warnings: [
            "Extremely news-driven — one regulatory headline can move it 30%+",
            "Ripple controls large XRP supply — periodic selling pressure",
            "Can be illiquid during off-hours — wider spreads"
        ],
        tips: [
            "Monitor SEC and global regulatory news as primary catalyst",
            "XRP often lags BTC rallies then catches up violently",
            "Regulatory clarity is THE binary catalyst — position accordingly"
        ],
        intelligenceSummary: "XRP is a payment-focused cryptocurrency driven primarily by regulatory outcomes. The SEC case resolution provides binary risk. When regulatory clarity arrives, XRP tends to make explosive moves.",
        strengthNote: "XRP is a regulatory play — clarity = explosion, uncertainty = stagnation."
    },
    "DOGE/USD": {
        pair: "DOGE/USD",
        displayName: "Dogecoin / US Dollar",
        baseCurrency: "DOGE",
        quoteCurrency: "USD",
        nickname: "The People's Crypto",
        bestSessions: ["24/7 — spikes on social media events (unpredictable)"],
        worstSessions: ["Weekend low-liquidity"],
        avgDailyRange: 0.008,
        avgRangeBySession: { "asia": 0.003, "london": 0.005, "newyork": 0.007, "overlap": 0.008 },
        drivers: [
            "Social media sentiment (Twitter/X, Reddit)",
            "Celebrity endorsements (Elon Musk influence)",
            "Retail trading waves and meme momentum",
            "BTC correlation (follows macro crypto trend)",
            "Community events and integration announcements"
        ],
        correlations: [
            { pair: "BTC/USD", type: "positive", strength: "moderate", explanation: "Follows BTC in macro direction, decouples on social media events." }
        ],
        warnings: [
            "Extremely sentiment-driven — fundamentals are minimal",
            "Pump-and-dump dynamics are common — be cautious of FOMO entries",
            "Infinite supply (no cap) — long-term inflation pressure",
            "Social media-driven spikes often retrace 50-80%"
        ],
        tips: [
            "DOGE is a momentum/sentiment trade — True Fractal still applies to structure",
            "Social media volume is a leading indicator — monitor Twitter trends",
            "Use tight stops — DOGE reversals are violent and fast"
        ],
        intelligenceSummary: "Dogecoin is a meme cryptocurrency driven by social media sentiment and retail enthusiasm. It has minimal fundamental value but strong community momentum. Technical analysis works on the structure, but catalysts are unpredictable.",
        strengthNote: "DOGE is pure sentiment — trade the structure, not the story."
    }
};
