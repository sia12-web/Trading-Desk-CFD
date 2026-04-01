import { createClient } from '@/lib/supabase/server'
import { validateTrade } from '@/lib/risk/validator'
import { createMarketOrder, createLimitOrder, getCurrentPrices } from '@/lib/oanda/client'
import { logExecution } from '@/lib/data/execution-logs'
import { createTrade } from '@/lib/data/trades'
import { getActiveRiskRules } from '@/lib/data/risk-rules'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
        instrument,
        direction,
        units,
        entryPrice,
        stopLoss,
        takeProfit,
        trailingStopDistance,
        orderType,
        limitPrice,
        strategy_template_id,
        voice_transcript,
        parsed_strategy,
        name,
        strategy_explanation
    } = body

    // 1. Run server-side risk validation
    const riskParams = {
        instrument,
        direction,
        units,
        entryPrice: orderType === 'LIMIT' ? parseFloat(limitPrice) : entryPrice,
        stopLoss,
        takeProfit
    }

    const riskResult = await validateTrade(riskParams, user.id)

    if (!riskResult.passed) {
        await logExecution({
            user_id: user.id,
            action: 'place_order',
            request_payload: body,
            risk_validation: riskResult,
            status: 'blocked',
            error_message: 'Risk validation failed'
        })
        return NextResponse.json(riskResult, { status: 403 })
    }

    // 2. Slippage & R:R Guardrail (MARKET orders only)
    if (orderType !== 'LIMIT' && entryPrice && stopLoss) {
        try {
            const { data: livePrices } = await getCurrentPrices([instrument])
            const livePrice = livePrices?.find((p: any) => p.instrument === instrument)

            if (livePrice) {
                const currentAsk = parseFloat(livePrice.asks?.[0]?.price || '0')
                const currentBid = parseFloat(livePrice.bids?.[0]?.price || '0')
                const liveExecution = direction === 'long' ? currentAsk : currentBid

                if (liveExecution > 0 && entryPrice > 0) {
                    const isJPY = instrument.includes('JPY')
                    const pipMultiplier = isJPY ? 100 : 10000
                    const maxSlippagePips = isJPY ? 10 : 5  // 10 pips JPY, 5 pips others

                    const slippagePips = Math.abs(liveExecution - entryPrice) * pipMultiplier
                    const slippageExceeded = slippagePips > maxSlippagePips

                    // Recalculate R:R with live price
                    let rrDegraded = false
                    let liveRR = 0
                    let originalRR = 0
                    let minRR = 1  // default fallback

                    // Get min R:R from risk rules
                    const rules = await getActiveRiskRules(user.id)
                    const rrRule = rules.find(r => r.rule_type === 'min_reward_risk')
                    if (rrRule) {
                        minRR = (rrRule.value as any)?.ratio || 1
                    }

                    if (takeProfit && stopLoss) {
                        const originalRisk = Math.abs(entryPrice - stopLoss)
                        const originalReward = Math.abs(takeProfit - entryPrice)
                        originalRR = originalRisk > 0 ? originalReward / originalRisk : 0

                        const liveRisk = Math.abs(liveExecution - stopLoss)
                        const liveReward = Math.abs(takeProfit - liveExecution)
                        liveRR = liveRisk > 0 ? liveReward / liveRisk : 0

                        // R:R degraded if it dropped below minimum OR dropped by more than 30%
                        rrDegraded = (originalRR >= minRR && liveRR < minRR) ||
                            (originalRR > 0 && liveRR / originalRR < 0.7)
                    }

                    if (slippageExceeded || rrDegraded) {
                        const reason = []
                        if (slippageExceeded) {
                            reason.push(`Price slipped ${slippagePips.toFixed(1)} pips (AI entry: ${entryPrice}, live: ${liveExecution.toFixed(isJPY ? 3 : 5)}, max: ${maxSlippagePips} pips)`)
                        }
                        if (rrDegraded) {
                            reason.push(`R:R degraded from ${originalRR.toFixed(2)}:1 to ${liveRR.toFixed(2)}:1 (minimum: ${minRR}:1)`)
                        }

                        const slippageCheck = {
                            passed: false,
                            checks: [{
                                ruleName: 'Slippage & R:R Guardrail',
                                ruleType: 'slippage_guardrail',
                                passed: false,
                                isWarning: false,
                                message: `⚠️ Trade blocked — price moved since AI analysis. ${reason.join('. ')}.`,
                                currentValue: slippagePips,
                                limitValue: maxSlippagePips
                            }],
                            blockers: [{
                                ruleName: 'Slippage & R:R Guardrail',
                                ruleType: 'slippage_guardrail',
                                passed: false,
                                isWarning: false,
                                message: `⚠️ Trade blocked — price moved since AI analysis. ${reason.join('. ')}.`,
                                currentValue: slippagePips,
                                limitValue: maxSlippagePips
                            }],
                            warnings: [],
                            livePrice: liveExecution,
                            aiEntryPrice: entryPrice,
                            slippagePips: slippagePips.toFixed(1),
                            originalRR: originalRR.toFixed(2),
                            liveRR: liveRR.toFixed(2)
                        }

                        await logExecution({
                            user_id: user.id,
                            action: 'place_order',
                            request_payload: body,
                            risk_validation: slippageCheck,
                            status: 'blocked',
                            error_message: `Slippage guardrail: ${reason.join('. ')}`
                        })

                        return NextResponse.json(slippageCheck, { status: 403 })
                    }
                }
            }
        } catch (e) {
            // Non-fatal — if we can't fetch live price, proceed with execution
            console.error('Slippage check failed (non-fatal):', e)
        }
    }

    // 3. Call OANDA
    let oandaResponse: any
    const signedUnits = direction === 'long' ? units : -units

    try {
        if (orderType === 'LIMIT') {
            oandaResponse = await createLimitOrder({
                instrument,
                units: signedUnits,
                price: limitPrice.toString(),
                stopLossOnFill: { price: stopLoss.toString() },
                takeProfitOnFill: takeProfit ? { price: takeProfit.toString() } : undefined,
                trailingStopLossOnFill: trailingStopDistance ? { distance: trailingStopDistance.toString() } : undefined
            })
        } else {
            oandaResponse = await createMarketOrder({
                instrument,
                units: signedUnits,
                stopLossOnFill: { price: stopLoss.toString() },
                takeProfitOnFill: takeProfit ? { price: takeProfit.toString() } : undefined,
                trailingStopLossOnFill: trailingStopDistance ? { distance: trailingStopDistance.toString() } : undefined
            })
        }

        if (oandaResponse.error) {
            await logExecution({
                user_id: user.id,
                action: 'place_order',
                request_payload: body,
                response_payload: oandaResponse.error,
                risk_validation: riskResult,
                status: 'failed',
                error_message: oandaResponse.error.errorMessage || 'OANDA API Error'
            })
            return NextResponse.json({ error: oandaResponse.error.errorMessage || 'Order execution failed' }, { status: 500 })
        }

        // 3. Success - Create local record
        const oandaTradeId = oandaResponse.data?.orderFillTransaction?.tradeOpened?.tradeID ||
            oandaResponse.data?.orderCreateTransaction?.id // For limit orders, it's the order ID for now

        const localTrade = await createTrade({
            pair: instrument.replace('_', '/'),
            direction,
            entry_price: orderType === 'LIMIT' ? parseFloat(limitPrice) : parseFloat(oandaResponse.data?.orderFillTransaction?.price || entryPrice.toString()),
            stop_loss: stopLoss,
            take_profit: takeProfit || null,
            lot_size: units / 100000,
            status: orderType === 'LIMIT' ? 'planned' : 'open',
            name: name || null,
            strategy_explanation: strategy_explanation || null
        }, [], [])

        // Update oanda_trade_id after creation since createTrade doesn't include it in the basic data type
        await supabase.from('trades').update({
            oanda_trade_id: oandaTradeId,
            strategy_template_id: strategy_template_id || null,
            voice_transcript: voice_transcript || null,
            parsed_strategy: parsed_strategy || null
        }).eq('id', localTrade.id)

        if (strategy_template_id) {
            const { incrementUsage } = await import('@/lib/data/strategy-templates')
            await incrementUsage(strategy_template_id)
        }

        // 4. Synchronization — Link to Story Position if active
        try {
            const { getActivePosition, updatePosition, addAdjustment } = await import('@/lib/data/story-positions')
            const storyPos = await getActivePosition(user.id, instrument.replace('_', '/'))
            
            if (storyPos && !storyPos.oanda_trade_id && storyPos.status !== 'closed') {
                await updatePosition(storyPos.id, { 
                    oanda_trade_id: oandaTradeId,
                    status: 'active',
                    entry_price: parseFloat(oandaResponse.data?.orderFillTransaction?.price || entryPrice.toString())
                })
                
                await addAdjustment({
                    position_id: storyPos.id,
                    episode_id: storyPos.entry_episode_id || '',
                    episode_number: storyPos.entry_episode_number || 0,
                    action: 'open',
                    details: { manual_execution: true, oanda_trade_id: oandaTradeId },
                    ai_reasoning: "ADOPTED: Execution detected via Trade terminal. Linking OANDA trade to existing narrative position."
                })
            }
        } catch (syncError) {
            console.error('Story sync failed during execution:', syncError)
        }

        await logExecution({
            user_id: user.id,
            action: 'place_order',
            trade_id: localTrade.id,
            oanda_trade_id: oandaTradeId,
            request_payload: body,
            response_payload: oandaResponse.data,
            risk_validation: riskResult,
            status: 'success'
        })

        return NextResponse.json({
            success: true,
            oandaResponse: oandaResponse.data,
            localTradeId: localTrade.id,
            riskChecks: riskResult.checks
        })

    } catch (error: any) {
        console.error('Execution Exception:', error)
        return NextResponse.json({ error: 'Trade execution failed' }, { status: 500 })
    }
}
