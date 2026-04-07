import { importPKCS8, SignJWT } from 'jose'
import crypto from 'crypto'
import type { OandaPrice } from '@/lib/types/oanda'

const COINBASE_BASE_URL = 'https://api.coinbase.com'

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication — JWT with ES256
// ═══════════════════════════════════════════════════════════════════════════════

function getCoinbaseConfig() {
    const keyName = process.env.COINBASE_API_KEY_NAME
    const privateKey = process.env.COINBASE_API_KEY_PRIVATE

    if (!keyName || !privateKey) {
        throw new Error('Coinbase API credentials not configured (COINBASE_API_KEY_NAME / COINBASE_API_KEY_PRIVATE)')
    }

    // Handle escaped newlines from .env
    const cleanKey = privateKey.replace(/\\n/g, '\n')

    return { keyName, privateKey: cleanKey }
}

async function generateJwt(method: string, path: string): Promise<string> {
    const { keyName, privateKey } = getCoinbaseConfig()
    const now = Math.floor(Date.now() / 1000)
    const nonce = crypto.randomBytes(16).toString('hex')

    const ecKey = await importPKCS8(privateKey, 'ES256')

    return await new SignJWT({
        sub: keyName,
        iss: 'cdp',
        aud: ['cdp_service'],
        uris: [`${method} api.coinbase.com${path}`],
    })
        .setProtectedHeader({
            alg: 'ES256',
            kid: keyName,
            typ: 'JWT',
            nonce,
        })
        .setIssuedAt(now)
        .setNotBefore(now)
        .setExpirationTime(now + 120)
        .sign(ecKey)
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════════════════════════

async function coinbaseRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
): Promise<{ data?: T; error?: string }> {
    try {
        const jwt = await generateJwt(method, path)

        const res = await fetch(`${COINBASE_BASE_URL}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
            const text = await res.text()
            console.error(`[Coinbase] ${method} ${path} failed (${res.status}):`, text)
            return { error: `Coinbase API error ${res.status}: ${text}` }
        }

        const data = await res.json()
        return { data }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Coinbase] ${method} ${path} exception:`, msg)
        return { error: msg }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pair Format Conversion
// ═══════════════════════════════════════════════════════════════════════════════

/** CRYPTO_BTC_USD → BTC-USD */
export function toProductId(instrument: string): string {
    return instrument.replace('CRYPTO_', '').replace('_', '-')
}

/** BTC-USD → CRYPTO_BTC_USD */
export function fromProductId(productId: string): string {
    return `CRYPTO_${productId.replace('-', '_')}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prices
// ═══════════════════════════════════════════════════════════════════════════════

interface CoinbasePricebook {
    product_id: string
    bids: Array<{ price: string; size: string }>
    asks: Array<{ price: string; size: string }>
    time: string
}

/**
 * Fetch best bid/ask for crypto pairs.
 * Returns OandaPrice-compatible format so the UI doesn't need changes.
 */
export async function getCoinbasePrices(instruments: string[]): Promise<OandaPrice[]> {
    const productIds = instruments.map(toProductId)
    const params = productIds.map(id => `product_ids=${id}`).join('&')
    const path = `/api/v3/brokerage/best_bid_ask?${params}`

    const { data, error } = await coinbaseRequest<{ pricebooks: CoinbasePricebook[] }>('GET', path)

    if (error || !data?.pricebooks) {
        console.error('[Coinbase] Failed to fetch prices:', error)
        return []
    }

    return data.pricebooks.map(pb => ({
        instrument: fromProductId(pb.product_id),
        bids: pb.bids.map(b => ({ price: b.price, liquidity: Math.round(parseFloat(b.size) * 1000) })),
        asks: pb.asks.map(a => ({ price: a.price, liquidity: Math.round(parseFloat(a.size) * 1000) })),
        tradeable: true,
        time: pb.time || new Date().toISOString(),
        status: 'tradeable',
    }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════════

interface CoinbaseOrderResponse {
    success: boolean
    success_response?: {
        order_id: string
        product_id: string
        side: string
        client_order_id: string
    }
    error_response?: {
        error: string
        message: string
        error_details: string
    }
}

export interface CoinbaseMarketOrderParams {
    productId: string
    side: 'BUY' | 'SELL'
    baseSize: string   // Amount of crypto (e.g., "0.001" BTC)
}

export interface CoinbaseLimitOrderParams {
    productId: string
    side: 'BUY' | 'SELL'
    baseSize: string
    limitPrice: string
}

export async function createCoinbaseMarketOrder(
    params: CoinbaseMarketOrderParams,
): Promise<{ data?: { order_id: string }; error?: string }> {
    const clientOrderId = crypto.randomUUID()

    const { data, error } = await coinbaseRequest<CoinbaseOrderResponse>('POST', '/api/v3/brokerage/orders', {
        client_order_id: clientOrderId,
        product_id: params.productId,
        side: params.side,
        order_configuration: {
            market_market_ioc: {
                base_size: params.baseSize,
            },
        },
    })

    if (error) return { error }

    if (!data?.success) {
        const errMsg = data?.error_response?.message || data?.error_response?.error || 'Unknown Coinbase order error'
        return { error: errMsg }
    }

    return { data: { order_id: data.success_response!.order_id } }
}

export async function createCoinbaseLimitOrder(
    params: CoinbaseLimitOrderParams,
): Promise<{ data?: { order_id: string }; error?: string }> {
    const clientOrderId = crypto.randomUUID()

    const { data, error } = await coinbaseRequest<CoinbaseOrderResponse>('POST', '/api/v3/brokerage/orders', {
        client_order_id: clientOrderId,
        product_id: params.productId,
        side: params.side,
        order_configuration: {
            limit_limit_gtc: {
                base_size: params.baseSize,
                limit_price: params.limitPrice,
                post_only: false,
            },
        },
    })

    if (error) return { error }

    if (!data?.success) {
        const errMsg = data?.error_response?.message || data?.error_response?.error || 'Unknown Coinbase order error'
        return { error: errMsg }
    }

    return { data: { order_id: data.success_response!.order_id } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Account
// ═══════════════════════════════════════════════════════════════════════════════

interface CoinbaseAccount {
    uuid: string
    name: string
    currency: string
    available_balance: { value: string; currency: string }
    hold: { value: string; currency: string }
    type: string
    active: boolean
}

export async function getCoinbaseAccounts(): Promise<{ data?: CoinbaseAccount[]; error?: string }> {
    const { data, error } = await coinbaseRequest<{ accounts: CoinbaseAccount[] }>('GET', '/api/v3/brokerage/accounts?limit=100')

    if (error) return { error }
    return { data: data?.accounts || [] }
}
