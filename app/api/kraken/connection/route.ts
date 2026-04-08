import { NextResponse } from 'next/server'
import { testConnection } from '@/lib/kraken/client'

/**
 * Test Kraken API connection
 * GET /api/kraken/connection
 */
export async function GET() {
    try {
        const apiKey = process.env.KRAKEN_API_KEY
        const apiSecret = process.env.KRAKEN_API_SECRET

        // Check if credentials are configured
        const configured = !!(apiKey && apiSecret)

        if (!configured) {
            return NextResponse.json({
                connected: false,
                configured: false,
                error: 'Kraken API credentials not configured in environment variables'
            })
        }

        // Test the connection
        const result = await testConnection()

        if (!result.connected) {
            return NextResponse.json({
                connected: false,
                configured: true,
                error: result.error
            })
        }

        // Success
        return NextResponse.json({
            connected: true,
            configured: true,
            balance: result.balance,
            tradeBalance: result.tradeBalance,
            timestamp: result.timestamp
        })
    } catch (error: any) {
        console.error('[Kraken Connection Test] Error:', error)
        return NextResponse.json({
            connected: false,
            configured: true,
            error: error.message || 'Unknown error testing Kraken connection'
        }, { status: 500 })
    }
}
