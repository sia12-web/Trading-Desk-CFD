import crypto from 'crypto'
import type { OandaPrice } from '@/lib/types/oanda'

const KRAKEN_BASE_URL = 'https://api.kraken.com'

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication — HMAC-SHA512
// ═══════════════════════════════════════════════════════════════════════════════

function getKrakenConfig() {
    const apiKey = process.env.KRAKEN_API_KEY
    const apiSecret = process.env.KRAKEN_API_SECRET

    if (!apiKey || !apiSecret) {
        throw new Error('Kraken API credentials not configured (KRAKEN_API_KEY / KRAKEN_API_SECRET)')
    }

    return { apiKey, apiSecret }
}

function getKrakenSignature(path: string, postData: string, nonce: string, secret: string): string {
    const message = nonce + postData
    const secretBuffer = Buffer.from(secret, 'base64')

    const hash = crypto.createHash('sha256').update(message).digest('binary')
    const hmac = crypto.createHmac('sha512', secretBuffer)
    return hmac.update(path + hash, 'binary').digest('base64')
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════════════════════════

async function krakenPublicRequest<T>(
    endpoint: string,
    params?: Record<string, string>,
): Promise<{ data?: T; error?: string }> {
    try {
        const qs = params ? '?' + new URLSearchParams(params).toString() : ''
        const url = `${KRAKEN_BASE_URL}/0/public/${endpoint}${qs}`

        const res = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(15000),
        })

        const json = await res.json()

        if (json.error && json.error.length > 0) {
            console.error(`[Kraken] Public ${endpoint} error:`, json.error)
            return { error: json.error.join(', ') }
        }

        return { data: json.result as T }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Kraken] Public ${endpoint} exception:`, msg)
        return { error: msg }
    }
}

async function krakenPrivateRequest<T>(
    endpoint: string,
    params: Record<string, string> = {},
): Promise<{ data?: T; error?: string }> {
    try {
        const { apiKey, apiSecret } = getKrakenConfig()
        const path = `/0/private/${endpoint}`
        const nonce = Date.now().toString()

        const postParams = { nonce, ...params }
        const postData = new URLSearchParams(postParams).toString()
        const signature = getKrakenSignature(path, postData, nonce, apiSecret)

        const res = await fetch(`${KRAKEN_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'API-Key': apiKey,
                'API-Sign': signature,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: postData,
            signal: AbortSignal.timeout(15000),
        })

        const json = await res.json()

        if (json.error && json.error.length > 0) {
            console.error(`[Kraken] Private ${endpoint} error:`, json.error)
            return { error: json.error.join(', ') }
        }

        return { data: json.result as T }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Kraken] Private ${endpoint} exception:`, msg)
        return { error: msg }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pair Format Conversion
// ═══════════════════════════════════════════════════════════════════════════════

/** Map our internal instrument name to Kraken pair name */
const KRAKEN_PAIR_MAP: Record<string, string> = {
    'CRYPTO_BTC_USD': 'XXBTZUSD',
    'CRYPTO_ETH_USD': 'XETHZUSD',
    'CRYPTO_SOL_USD': 'SOLUSD',
    'CRYPTO_XRP_USD': 'XXRPZUSD',
    'CRYPTO_DOGE_USD': 'XDGUSD',
    'CRYPTO_ADA_USD': 'ADAUSD',
    'CRYPTO_BNB_USD': 'BNBUSD',
    'CRYPTO_AVAX_USD': 'AVAXUSD',
    'CRYPTO_DOT_USD': 'DOTUSD',
    'CRYPTO_MATIC_USD': 'MATICUSD',
}

const KRAKEN_PAIR_REVERSE: Record<string, string> = Object.fromEntries(
    Object.entries(KRAKEN_PAIR_MAP).map(([k, v]) => [v, k])
)

/** CRYPTO_BTC_USD → XXBTZUSD */
export function toKrakenPair(instrument: string): string {
    return KRAKEN_PAIR_MAP[instrument] || instrument.replace('CRYPTO_', '').replace('_', '')
}

/** XXBTZUSD → CRYPTO_BTC_USD */
export function fromKrakenPair(krakenPair: string): string {
    return KRAKEN_PAIR_REVERSE[krakenPair] || krakenPair
}

// ═══════════════════════════════════════════════════════════════════════════════
// Prices (Public — no auth required)
// ═══════════════════════════════════════════════════════════════════════════════

interface KrakenTickerInfo {
    a: [string, string, string]   // ask: [price, wholeLotVolume, lotVolume]
    b: [string, string, string]   // bid: [price, wholeLotVolume, lotVolume]
    c: [string, string]           // last trade: [price, lotVolume]
    v: [string, string]           // volume: [today, last24h]
    p: [string, string]           // vwap: [today, last24h]
    t: [number, number]           // trades: [today, last24h]
    l: [string, string]           // low: [today, last24h]
    h: [string, string]           // high: [today, last24h]
    o: string                     // opening price today
}

/**
 * Fetch best bid/ask for crypto pairs from Kraken.
 * Returns OandaPrice-compatible format so the UI doesn't need changes.
 */
export async function getKrakenPrices(instruments: string[]): Promise<OandaPrice[]> {
    const krakenPairs = instruments.map(toKrakenPair)
    const pairParam = krakenPairs.join(',')

    const { data, error } = await krakenPublicRequest<Record<string, KrakenTickerInfo>>('Ticker', { pair: pairParam })

    if (error || !data) {
        console.error('[Kraken] Failed to fetch prices:', error)
        return []
    }

    return Object.entries(data).map(([krakenPair, ticker]) => {
        const instrument = fromKrakenPair(krakenPair)
        return {
            instrument,
            bids: [{ price: ticker.b[0], liquidity: Math.round(parseFloat(ticker.b[1]) * 1000) }],
            asks: [{ price: ticker.a[0], liquidity: Math.round(parseFloat(ticker.a[1]) * 1000) }],
            tradeable: true,
            time: new Date().toISOString(),
            status: 'tradeable',
        }
    })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orders (Private — requires auth)
// ═══════════════════════════════════════════════════════════════════════════════

interface KrakenAddOrderResult {
    descr: { order: string; close?: string }
    txid: string[]
}

export interface KrakenMarketOrderParams {
    pair: string       // Internal instrument name (CRYPTO_BTC_USD)
    side: 'buy' | 'sell'
    volume: string     // Amount of crypto (e.g., "0.001" BTC)
}

export interface KrakenLimitOrderParams {
    pair: string
    side: 'buy' | 'sell'
    volume: string
    price: string
}

export async function createKrakenMarketOrder(
    params: KrakenMarketOrderParams,
): Promise<{ data?: { order_id: string }; error?: string }> {
    const krakenPair = toKrakenPair(params.pair)

    const { data, error } = await krakenPrivateRequest<KrakenAddOrderResult>('AddOrder', {
        pair: krakenPair,
        type: params.side,
        ordertype: 'market',
        volume: params.volume,
    })

    if (error) return { error }

    if (!data?.txid || data.txid.length === 0) {
        return { error: 'No transaction ID returned from Kraken' }
    }

    return { data: { order_id: data.txid[0] } }
}

export async function createKrakenLimitOrder(
    params: KrakenLimitOrderParams,
): Promise<{ data?: { order_id: string }; error?: string }> {
    const krakenPair = toKrakenPair(params.pair)

    const { data, error } = await krakenPrivateRequest<KrakenAddOrderResult>('AddOrder', {
        pair: krakenPair,
        type: params.side,
        ordertype: 'limit',
        volume: params.volume,
        price: params.price,
    })

    if (error) return { error }

    if (!data?.txid || data.txid.length === 0) {
        return { error: 'No transaction ID returned from Kraken' }
    }

    return { data: { order_id: data.txid[0] } }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Account (Private)
// ═══════════════════════════════════════════════════════════════════════════════

export interface KrakenBalance {
    [currency: string]: string   // e.g. { ZUSD: "1234.56", XXBT: "0.012" }
}

export async function getKrakenBalance(): Promise<{ data?: KrakenBalance; error?: string }> {
    return await krakenPrivateRequest<KrakenBalance>('Balance')
}
