# How to Use the Whale Simulator Indicator in TradingView

## What It Does

The **Whale Simulator Indicator** brings the same AI Trio whale detection logic to your live TradingView charts. It shows you:

- 🔵 **Accumulation zones** — Where whales are quietly buying
- 🟠 **Manipulation events** — Stop hunts and fake breakouts
- 🔴 **Distribution zones** — Where whales are selling into retail FOMO
- **Donchian Channel** — Retail stop loss zones
- **Volume POC** (VWAP) — Institutional support/resistance
- **CVD Divergence** — When price and order flow disagree

## Installation Steps

### Step 1: Copy the Code

1. Open the file: `docs/WHALE_SIMULATOR_INDICATOR.pine`
2. Copy **all the code** (Ctrl+A, Ctrl+C)

### Step 2: Add to TradingView

1. Go to [TradingView](https://www.tradingview.com)
2. Open any chart
3. Click **Pine Editor** at the bottom of the screen
4. Click **"+ New"** → **"New blank indicator"**
5. **Delete** all the default code
6. **Paste** the Whale Simulator code
7. Click **"Add to Chart"** (or Ctrl+S to save first, then click the chart icon)

### Step 3: Configure Settings

Click the **gear icon** on the indicator name in the chart legend to adjust settings:

#### Indicators Section
- ✅ **Show Donchian Channel** — Blue dashed lines showing retail stop zones
- **Donchian Period**: 20 (default) — Adjust for faster/slower detection
- ✅ **Show Volume POC** — Orange crosses showing institutional levels
- **POC Lookback**: 30 (default)
- ✅ **Show CVD Divergence** — Detects order flow divergence
- **CVD Period**: 50 (default)

#### Whale Signals Section
- ✅ **Show Whale Zones** — Background coloring (blue = accumulation, red = distribution)
- ✅ **Accumulation Markers** — Blue circles when whale is buying
- ✅ **Manipulation Markers** — Orange triangles when stop hunts detected
- ✅ **Distribution Markers** — Red circles when whale is selling

## How to Read the Signals

### 🔵 Accumulation (BUY)

**What it means:**
- Price is near Donchian Low (retail stops below)
- CVD is rising (institutional buying pressure)
- Whale is quietly accumulating

**What to do:**
- Consider entering LONG positions
- Place SL below Donchian Low
- Target: Donchian High or Volume POC

### 🟠 Manipulation (HUNT)

**What it means:**
- Price breaks Donchian Channel
- Volume spike (2x+ average)
- CVD divergence (price up, CVD down OR price down, CVD up)
- Stop hunt in progress — retail getting liquidated

**What to do:**
- **DO NOT chase the breakout!** This is a trap.
- Wait for price to reverse back inside the channel
- Enter in the OPPOSITE direction of the fake breakout
- This is the whale triggering stops before the real move

**Example:**
- Price spikes UP above Donchian High + HUNT marker appears
- → Fake bullish breakout (stop hunt)
- → Wait for price to fall back below Donchian High
- → Enter SHORT (whale is distributing into the spike)

### 🔴 Distribution (SELL)

**What it means:**
- Price is near Donchian High (retail stops above)
- CVD is falling (institutional selling pressure)
- Whale is offloading position into retail greed

**What to do:**
- Consider entering SHORT positions
- Place SL above Donchian High
- Target: Donchian Low or Volume POC

## Info Table (Top Right)

The table shows real-time status:

| Field | Meaning |
|-------|---------|
| **Phase** | Accumulation / Distribution / Neutral |
| **CVD** | Bullish (rising) / Bearish (falling) |
| **Donchian** | Above Mid (bullish) / Below Mid (bearish) |
| **Volume** | Spike (2x+) / Normal |
| **Signal** | BUY / HUNT / SELL / HOLD |

## Setting Up Alerts

1. Right-click on the chart → **"Add Alert"**
2. **Condition**: Select "Whale Simulator"
3. Choose alert type:
   - **Whale Accumulation** — Notifies when BUY signal appears
   - **Whale Manipulation** — Notifies when HUNT appears
   - **Whale Distribution** — Notifies when SELL signal appears
4. Set alert options (email, push notification, sound)
5. Click **"Create"**

Now you'll get notified in real-time when the whale makes a move!

## Strategy Examples

### Strategy 1: Accumulation → Manipulation → Distribution Cycle

1. **Accumulation Phase** (Blue zone, BUY signals)
   - Enter LONG when BUY appears
   - SL: Below Donchian Low
   - Hold through manipulation phase

2. **Manipulation Phase** (HUNT signals)
   - Ignore fake breakouts
   - Keep position if already long
   - Add to position on stop hunts DOWN (whale shaking out weak hands)

3. **Distribution Phase** (Red zone, SELL signals)
   - Exit longs on first SELL signal
   - OR enter SHORT for the reversal

### Strategy 2: Counter-Manipulation (Advanced)

1. Wait for **HUNT** signal (stop hunt in progress)
2. Identify direction:
   - HUNT above Donchian High → Fake bullish breakout
   - HUNT below Donchian Low → Fake bearish breakout
3. Wait for price to reverse back inside the channel (confirmation)
4. Enter in the **opposite direction** of the fake breakout
5. Target: Opposite side of Donchian Channel

**Example:**
- EUR/JPY breaks above Donchian High
- HUNT marker appears (stop hunt)
- Volume spike, but CVD is falling (divergence)
- Price reverses back below Donchian High
- → Enter SHORT (whale is selling into the fake rally)
- TP: Donchian Low

### Strategy 3: POC Bounces

1. Use Volume POC (orange crosses) as support/resistance
2. When price approaches POC + Accumulation zone → Likely bounce up
3. When price approaches POC + Distribution zone → Likely rejection down
4. Combine with whale signals for confirmation

## Differences from the Web Simulator

| Feature | Web Simulator | TradingView Indicator |
|---------|---------------|----------------------|
| **Data Source** | Historical M1 OHLC | Live/historical any timeframe |
| **AI Decisions** | Actual Gemini + DeepSeek + Claude | Algorithmic approximation |
| **Signals** | 12 steps (educational replay) | Real-time continuous |
| **Use Case** | Learn whale behavior | Trade live markets |
| **ATR** | Intentionally excluded | Not used (detects manipulation instead) |

The TradingView indicator uses **algorithmic rules** to approximate what the AI Trio would decide, but it's not calling the actual AI models (that would be too slow for real-time charting).

## Best Pairs to Use

The indicator works best on:
- **EUR/JPY** (what the simulator was trained on)
- **GBP/JPY** (high volatility, frequent stop hunts)
- **XAU/USD** (Gold — institutional manipulation common)
- **EUR/USD** (high liquidity)
- **Indices** (NAS100, US30 — stop hunts before major moves)

**Avoid:**
- Low liquidity pairs (signals will be noisy)
- Crypto on 1-minute charts (too erratic)

## Recommended Timeframes

- **M15** (15-minute) — Best balance of signal quality and frequency
- **M5** (5-minute) — More signals, more noise
- **H1** (1-hour) — Fewer signals, higher quality
- **M1** (1-minute) — Only for advanced scalpers (very noisy)

## Combining with Other Indicators

Works well with:
- **RSI** — Confirm overbought/oversold
- **MACD** — Confirm trend direction
- **Fibonacci** — Identify retracement levels for accumulation/distribution
- **Volume Profile** (native TradingView) — More accurate POC
- **Order Flow** — If you have access to real order flow data

## Troubleshooting

### No Signals Appearing

**Cause:** Market is ranging without clear whale activity.
**Solution:** Try a different pair or timeframe.

### Too Many Signals (Noisy)

**Cause:** Timeframe too low or volatile pair.
**Solution:**
- Increase Donchian Period (e.g., 30 instead of 20)
- Increase CVD Period (e.g., 100 instead of 50)
- Switch to higher timeframe (M5 → M15 → H1)

### Signals Not Matching Web Simulator

**Expected!** The web simulator uses actual AI decisions on historical M1 data. The TradingView indicator uses algorithmic approximations on live data.

They should show similar **patterns**, but not identical signals.

## Backtesting the Indicator

1. Open TradingView → Strategy Tester
2. Change indicator to a strategy by:
   - Replace `//@version=5` with `//@version=5`
   - Replace `indicator(...)` with `strategy(...)`
   - Add entry/exit logic:
     ```pine
     if accumulate
         strategy.entry("Long", strategy.long)
     if distribute
         strategy.close("Long")
     ```
3. Run backtest on historical data
4. Analyze performance metrics

## Support

If you have questions or want to improve the indicator:
1. Read `docs/WHALE_SIMULATOR.md` for the full theory
2. Check Railway logs if the web simulator signals differ significantly
3. Experiment with parameter adjustments for your preferred pairs

---

**Disclaimer:** This indicator is for educational purposes. Past performance does not guarantee future results. Always use proper risk management.
