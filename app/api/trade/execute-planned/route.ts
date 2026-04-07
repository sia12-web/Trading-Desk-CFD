import { createClient } from '@/lib/supabase/server'
import { validateTrade } from '@/lib/risk/validator'
import { createMarketOrder } from '@/lib/oanda/client'
import { createCoinbaseMarketOrder, toProductId } from '@/lib/coinbase/client'
import { logExecution } from '@/lib/data/execution-logs'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tradeId } = await req.json()

    if (!tradeId) {
        return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 })
    }

    // 1. Fetch the planned trade
    const { data: trade, error: fetchError } = await supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', user.id)
        .single()

    if (fetchError || !trade) {
        return NextResponse.json({ error: 'Trade not found' }, { status: 404 })
    }

    if (trade.status !== 'planned') {
        return NextResponse.json({ error: 'Trade is not in planned status' }, { status: 400 })
    }

    if (trade.oanda_trade_id) {
        return NextResponse.json({ error: 'Trade already has a broker order' }, { status: 400 })
    }

    // Determine broker from pair format
    const isCrypto = trade.pair.includes('BTC') || trade.pair.includes('ETH') ||
        trade.pair.includes('SOL') || trade.pair.includes('XRP') ||
        trade.pair.includes('DOGE') || trade.pair.includes('ADA') ||
        trade.pair.includes('BNB') || trade.pair.includes('AVAX') ||
        trade.pair.includes('DOT') || trade.pair.includes('MATIC') ||
        trade.pair.includes('POL')

    // 2. Run risk validation
    const instrument = isCrypto
        ? `CRYPTO_${trade.pair.replace('/', '_')}`
        : trade.pair.replace('/', '_')
    const units = isCrypto ? trade.lot_size : Math.round(trade.lot_size * 100000)
    const riskParams = {
        instrument,
        direction: trade.direction,
        units,
        entryPrice: trade.entry_price,
        stopLoss: trade.stop_loss,
        takeProfit: trade.take_profit
    }

    const riskResult = await validateTrade(riskParams, user.id)

    if (!riskResult.passed) {
        await logExecution({
            user_id: user.id,
            action: 'place_order',
            trade_id: tradeId,
            request_payload: { tradeId, instrument },
            risk_validation: riskResult,
            status: 'blocked',
            error_message: 'Risk validation failed'
        })
        return NextResponse.json(riskResult, { status: 403 })
    }

    // 3. Execute on correct broker
    try {
        let brokerTradeId: string | undefined
        let fillPrice: number = trade.entry_price
        let brokerResponseData: any

        if (isCrypto) {
            // ═══ COINBASE EXECUTION ═══
            const productId = toProductId(instrument)
            const side = trade.direction === 'long' ? 'BUY' as const : 'SELL' as const

            const result = await createCoinbaseMarketOrder({
                productId,
                side,
                baseSize: units.toString(),
            })

            if (result.error) {
                await logExecution({
                    user_id: user.id,
                    action: 'place_order',
                    trade_id: tradeId,
                    request_payload: { tradeId, instrument },
                    response_payload: result.error,
                    risk_validation: riskResult,
                    status: 'failed',
                    error_message: result.error
                })
                return NextResponse.json({ error: result.error }, { status: 500 })
            }

            brokerTradeId = result.data!.order_id
            brokerResponseData = { broker: 'coinbase', order_id: brokerTradeId }

        } else {
            // ═══ OANDA EXECUTION ═══
            const signedUnits = trade.direction === 'long' ? units : -units

            const oandaResponse = await createMarketOrder({
                instrument,
                units: signedUnits,
                stopLossOnFill: { price: trade.stop_loss.toString() },
                takeProfitOnFill: trade.take_profit ? { price: trade.take_profit.toString() } : undefined,
            })

            if (oandaResponse.error) {
                await logExecution({
                    user_id: user.id,
                    action: 'place_order',
                    trade_id: tradeId,
                    request_payload: { tradeId, instrument },
                    response_payload: oandaResponse.error,
                    risk_validation: riskResult,
                    status: 'failed',
                    error_message: oandaResponse.error.errorMessage || 'OANDA API Error'
                })
                return NextResponse.json({ error: oandaResponse.error.errorMessage || 'Order execution failed' }, { status: 500 })
            }

            brokerTradeId = oandaResponse.data?.orderFillTransaction?.tradeOpened?.tradeID
            fillPrice = parseFloat(oandaResponse.data?.orderFillTransaction?.price || trade.entry_price.toString())
            brokerResponseData = oandaResponse.data
        }

        // 4. Update the planned trade to open
        await supabase.from('trades').update({
            status: 'open',
            oanda_trade_id: brokerTradeId,
            entry_price: fillPrice,
            opened_at: new Date().toISOString(),
        }).eq('id', tradeId)

        await logExecution({
            user_id: user.id,
            action: 'place_order',
            trade_id: tradeId,
            oanda_trade_id: brokerTradeId,
            request_payload: { tradeId, instrument },
            response_payload: brokerResponseData,
            risk_validation: riskResult,
            status: 'success'
        })

        return NextResponse.json({
            success: true,
            oandaResponse: brokerResponseData,
            fillPrice,
            oandaTradeId: brokerTradeId,
            broker: isCrypto ? 'coinbase' : 'oanda',
        })
    } catch (error: any) {
        console.error('Execute planned trade error:', error)
        return NextResponse.json({ error: 'Trade execution failed' }, { status: 500 })
    }
}
