import crypto from 'crypto'

/**
 * Kraken REST API Client
 * Docs: https://docs.kraken.com/rest/
 */

const KRAKEN_API_URL = 'https://api.kraken.com'

interface KrakenConfig {
    apiKey: string
    apiSecret: string
}

function getConfig(): KrakenConfig {
    const apiKey = process.env.KRAKEN_API_KEY
    const apiSecret = process.env.KRAKEN_API_SECRET

    if (!apiKey || !apiSecret) {
        throw new Error('KRAKEN_API_KEY and KRAKEN_API_SECRET must be set in environment variables')
    }

    return { apiKey, apiSecret }
}

/**
 * Generate Kraken API signature (HMAC-SHA512)
 */
function generateSignature(path: string, nonce: string, postData: string, apiSecret: string): string {
    const message = path + crypto.createHash('sha256').update(nonce + postData).digest()
    const signature = crypto
        .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
        .update(message)
        .digest('base64')
    return signature
}

/**
 * Make authenticated Kraken API request
 */
async function privateRequest(endpoint: string, params: Record<string, any> = {}) {
    const config = getConfig()
    const path = `/0/private/${endpoint}`
    const nonce = Date.now().toString()

    const postData = new URLSearchParams({
        nonce,
        ...params
    }).toString()

    const signature = generateSignature(path, nonce, postData, config.apiSecret)

    const response = await fetch(`${KRAKEN_API_URL}${path}`, {
        method: 'POST',
        headers: {
            'API-Key': config.apiKey,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData
    })

    const data = await response.json()

    if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API Error: ${data.error.join(', ')}`)
    }

    return data.result
}

/**
 * Make public Kraken API request (no auth required)
 */
async function publicRequest(endpoint: string, params: Record<string, any> = {}) {
    const queryString = new URLSearchParams(params).toString()
    const url = `${KRAKEN_API_URL}/0/public/${endpoint}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.error && data.error.length > 0) {
        throw new Error(`Kraken API Error: ${data.error.join(', ')}`)
    }

    return data.result
}

/**
 * Get account balance
 */
export async function getAccountBalance() {
    return await privateRequest('Balance')
}

/**
 * Get account trade balance (including margin)
 */
export async function getTradeBalance() {
    return await privateRequest('TradeBalance')
}

/**
 * Get open positions
 */
export async function getOpenPositions() {
    return await privateRequest('OpenPositions')
}

/**
 * Get open orders
 */
export async function getOpenOrders() {
    return await privateRequest('OpenOrders')
}

/**
 * Get closed orders
 */
export async function getClosedOrders(params?: { trades?: boolean; start?: number; end?: number }) {
    return await privateRequest('ClosedOrders', params || {})
}

/**
 * Get trade history
 */
export async function getTradeHistory(params?: { type?: 'all' | 'any position' | 'closed position' | 'closing position' | 'no position'; trades?: boolean; start?: number; end?: number }) {
    return await privateRequest('TradesHistory', params || {})
}

/**
 * Get ticker information (public endpoint)
 */
export async function getTicker(pairs: string[]) {
    return await publicRequest('Ticker', { pair: pairs.join(',') })
}

/**
 * Get OHLC candles (public endpoint)
 */
export async function getOHLC(pair: string, interval: number = 60, since?: number) {
    return await publicRequest('OHLC', { pair, interval, ...(since && { since }) })
}

/**
 * Test connection - verify API keys are valid
 */
export async function testConnection() {
    try {
        const balance = await getAccountBalance()
        const tradeBalance = await getTradeBalance()

        return {
            connected: true,
            balance,
            tradeBalance,
            timestamp: new Date().toISOString()
        }
    } catch (error: any) {
        return {
            connected: false,
            error: error.message || 'Unknown error'
        }
    }
}

/**
 * Get current prices for Kraken pairs (stub - not implemented yet)
 */
export async function getKrakenPrices(pairs: string[]): Promise<any[]> {
    // Return empty array - Kraken price fetching not implemented yet
    // Use OANDA for forex or Coinbase for crypto
    return []
}

/**
 * Create market order on Kraken (stub - not implemented yet)
 */
export async function createKrakenMarketOrder(params: any): Promise<{ data: { order_id: string } | null; error: string }> {
    return {
        data: null,
        error: 'Kraken order execution not implemented yet. Use OANDA for forex or Coinbase for crypto.'
    }
}

/**
 * Create limit order on Kraken (stub - not implemented yet)
 */
export async function createKrakenLimitOrder(params: any): Promise<{ data: { order_id: string } | null; error: string }> {
    return {
        data: null,
        error: 'Kraken order execution not implemented yet. Use OANDA for forex or Coinbase for crypto.'
    }
}
