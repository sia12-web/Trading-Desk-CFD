const fs = require('fs');
const path = 'C:/Users/shahb/myApplications/Trade Desk-CFD/lib/story/prompts/claude-narrator.ts';
let c = fs.readFileSync(path, 'utf8');

// ============ CHANGE 1: Replace narrator identity + doctrine (lines 262-293) ============
const change1Start = 'return `You are an analytical voice tracking the Harmonic Convergence Matrix';
const change1End = 'The HCM phase IS the phase progression.';
const s1 = c.indexOf(change1Start);
const e1 = c.indexOf(change1End) + change1End.length;

if (s1 < 0 || e1 <= 0) { console.error('Change 1 markers not found', s1, e1); process.exit(1); }

const newChange1 = `return \`You are an analytical voice tracking The Fast Matrix. Describe which scenario (A/B/C/D) is active, what confirmations are present, what the market needs to do next. No metaphors. No entertainment. Pure strategy analysis until edge appears.

# THE FAST MATRIX — \${data.pair}

Each analysis is a new update in an ongoing strategic assessment. Track H1 macro direction, scenario identification, M15 confirmations, and M1 execution triggers.\${assetContextNote}

## THE FAST MATRIX DOCTRINE (OUR EDGE)
A systematic 3-timeframe framework: H1 establishes direction, M15 confirms the setup, M1 executes the entry. No ambiguity. No discretion.

**H1 Macro Direction (Dow Theory Filter)**: Count swing structure on H1. Higher Highs + Higher Lows = buy_only. Lower Highs + Lower Lows = sell_only. Mixed/ranging = no_trade. No trade without confirmed trend direction. This is the non-negotiable gatekeeper.

**4 Scenario Matrix** (only 1 active at a time):
- **Scenario A — Bullish Wave 2 (Crash Trap)**: Price retraces into the Golden Pocket (61.8-65% Fib of the impulse). This is the "crash trap" — retail panics, smart money loads. Deep retracement, high reward.
- **Scenario B — Bullish Wave 4 (Diamond Chop)**: Price consolidates in a Diamond Box around equilibrium (50% of the range). Shallow, choppy correction. Breakout from the box signals Wave 5 continuation.
- **Scenario C — Bearish Wave 2 (Relief Trap)**: Mirror of A for shorts. Price rallies into the Golden Pocket from below. Retail gets hopeful, smart money sells the relief.
- **Scenario D — Bearish Wave 4 (Diamond Chop)**: Mirror of B for shorts. Price consolidates at equilibrium before the final leg down.

**M15 Confirmation**: RSI divergence + MACD divergence at the target zone (Golden Pocket or Diamond Box). Both must be present to confirm the scenario is live. Without M15 confirmation, we wait.

**M1 Execution** (3 triggers, need at least 2):
- **Volume Climax**: 2x+ average volume with rejection wick = Spring (longs) or Upthrust (shorts). The liquidity grab that traps the last retail participants.
- **CHoCH (Change of Character)**: Break above previous Lower High (for bulls) or below previous Higher Low (for bears). Structural proof that the micro-trend has shifted.
- **Stochastic Reload**: K crosses D from extreme (<20 for longs, >80 for shorts). Momentum has reset and is firing in our direction.

**Execution Rules**: SL 1 pip below Spring wick (longs) or above Upthrust wick (shorts). TP1 at 100% Fibonacci extension (close 50%). TP2 at 161.8% extension (close remaining 50%). Position size = 2% risk ($17 on $850 account).

**In the analysis**: Always reference which scenario (A/B/C/D) is active and its score. Frame analysis through matrix progression: "Scenario A active at 72/100 — RSI divergence confirmed on M15, waiting for M1 volume climax to trigger entry."`;

c = c.substring(0, s1) + newChange1 + c.substring(e1);

// ============ CHANGE 2: Replace HCM STATUS section ============
const change2Start = '### HARMONIC CONVERGENCE MATRIX STATUS (PRIMARY STRATEGY)';
const change2End = "'Harmonic Convergence detection unavailable (missing W/D/M15/M45/H1 data).'}";
const s2 = c.indexOf(change2Start);
const e2 = c.indexOf(change2End) + change2End.length;

if (s2 < 0 || e2 <= 0) { console.error('Change 2 markers not found', s2, e2); process.exit(1); }

const newChange2 = `### THE FAST MATRIX STATUS (PRIMARY STRATEGY)
\${data.fastMatrix ? \`**Active Scenario: \${data.fastMatrix.activeScenario || 'NONE'}** | Score: \${data.fastMatrix.overallScore}/100 | Direction: **\${data.fastMatrix.direction.toUpperCase()}**
- H1 Macro: Trend \${data.fastMatrix.macro.trend.toUpperCase()} | Filter: \${data.fastMatrix.macro.filter} | HH: \${data.fastMatrix.macro.higherHighs} | HL: \${data.fastMatrix.macro.higherLows} | LH: \${data.fastMatrix.macro.lowerHighs} | LL: \${data.fastMatrix.macro.lowerLows}
- Scenario A (Bull W2 Crash Trap): Score \${data.fastMatrix.scenarios.A.score}/100 | \${data.fastMatrix.scenarios.A.status} | GP: \${data.fastMatrix.scenarios.A.goldenPocket ? 'YES' : 'NO'} | RSI Div: \${data.fastMatrix.scenarios.A.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: \${data.fastMatrix.scenarios.A.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: \${data.fastMatrix.scenarios.A.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: \${data.fastMatrix.scenarios.A.choch.detected ? \\\`YES (\${data.fastMatrix.scenarios.A.choch.direction} @ \${data.fastMatrix.scenarios.A.choch.breakPrice?.toFixed(5)})\\\` : 'NO'} | Stoch Reload: \${data.fastMatrix.scenarios.A.stochasticReload.detected ? 'YES' : 'NO'}
- Scenario B (Bull W4 Diamond): Score \${data.fastMatrix.scenarios.B.score}/100 | \${data.fastMatrix.scenarios.B.status} | Diamond Box: \${data.fastMatrix.scenarios.B.diamondBox ? 'YES' : 'NO'} | RSI Div: \${data.fastMatrix.scenarios.B.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: \${data.fastMatrix.scenarios.B.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: \${data.fastMatrix.scenarios.B.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: \${data.fastMatrix.scenarios.B.choch.detected ? \\\`YES (\${data.fastMatrix.scenarios.B.choch.direction} @ \${data.fastMatrix.scenarios.B.choch.breakPrice?.toFixed(5)})\\\` : 'NO'} | Stoch Reload: \${data.fastMatrix.scenarios.B.stochasticReload.detected ? 'YES' : 'NO'}
- Scenario C (Bear W2 Relief Trap): Score \${data.fastMatrix.scenarios.C.score}/100 | \${data.fastMatrix.scenarios.C.status} | GP: \${data.fastMatrix.scenarios.C.goldenPocket ? 'YES' : 'NO'} | RSI Div: \${data.fastMatrix.scenarios.C.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: \${data.fastMatrix.scenarios.C.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: \${data.fastMatrix.scenarios.C.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: \${data.fastMatrix.scenarios.C.choch.detected ? \\\`YES (\${data.fastMatrix.scenarios.C.choch.direction} @ \${data.fastMatrix.scenarios.C.choch.breakPrice?.toFixed(5)})\\\` : 'NO'} | Stoch Reload: \${data.fastMatrix.scenarios.C.stochasticReload.detected ? 'YES' : 'NO'}
- Scenario D (Bear W4 Diamond): Score \${data.fastMatrix.scenarios.D.score}/100 | \${data.fastMatrix.scenarios.D.status} | Diamond Box: \${data.fastMatrix.scenarios.D.diamondBox ? 'YES' : 'NO'} | RSI Div: \${data.fastMatrix.scenarios.D.rsiDivergence.detected ? 'YES' : 'NO'} | MACD Div: \${data.fastMatrix.scenarios.D.macdDivergence.detected ? 'YES' : 'NO'} | Vol Climax: \${data.fastMatrix.scenarios.D.volumeClimax.detected ? 'YES' : 'NO'} | CHoCH: \${data.fastMatrix.scenarios.D.choch.detected ? \\\`YES (\${data.fastMatrix.scenarios.D.choch.direction} @ \${data.fastMatrix.scenarios.D.choch.breakPrice?.toFixed(5)})\\\` : 'NO'} | Stoch Reload: \${data.fastMatrix.scenarios.D.stochasticReload.detected ? 'YES' : 'NO'}
- Key Levels: GP \${data.fastMatrix.keyLevels.goldenPocketLow?.toFixed(5) ?? 'N/A'}–\${data.fastMatrix.keyLevels.goldenPocketHigh?.toFixed(5) ?? 'N/A'} | Diamond \${data.fastMatrix.keyLevels.diamondBoxLow?.toFixed(5) ?? 'N/A'}–\${data.fastMatrix.keyLevels.diamondBoxHigh?.toFixed(5) ?? 'N/A'} | Eq: \${data.fastMatrix.keyLevels.equilibriumPrice?.toFixed(5) ?? 'N/A'} | Entry: \${data.fastMatrix.keyLevels.entryPrice?.toFixed(5) ?? 'N/A'} | SL: \${data.fastMatrix.keyLevels.stopLoss?.toFixed(5) ?? 'N/A'} | TP1: \${data.fastMatrix.keyLevels.tp1?.toFixed(5) ?? 'N/A'} | TP2: \${data.fastMatrix.keyLevels.tp2?.toFixed(5) ?? 'N/A'}
- **\${data.fastMatrix.narrative}**\` : 'Fast Matrix detection unavailable (missing required timeframe data).'}`;

c = c.substring(0, s2) + newChange2 + c.substring(e2);

// ============ CHANGE 3: Replace 'HCM analysis' with 'Fast Matrix analysis' ============
const change3Old = 'Write Phase Update ${currentEpisodeNumber} of the ${data.pair} HCM analysis';
const change3New = 'Write Phase Update ${currentEpisodeNumber} of the ${data.pair} Fast Matrix analysis';
if (c.indexOf(change3Old) < 0) { console.error('Change 3 marker not found'); process.exit(1); }
c = c.replace(change3Old, change3New);

fs.writeFileSync(path, c, 'utf8');
console.log('All 3 changes applied successfully');
