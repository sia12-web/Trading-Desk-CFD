import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/killzone/monitor-results
 *
 * Fetch latest Killzone monitor scan results for all pairs
 */
export async function GET() {
    try {
        const client = await createClient()

        const { data: results, error } = await client
            .from('killzone_monitor_results')
            .select('*')
            .order('pair', { ascending: true })

        if (error) {
            console.error('[Killzone Monitor Results API] Error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch results' },
                { status: 500 }
            )
        }

        const lastScan = results && results.length > 0
            ? results[0].scanned_at
            : null

        return NextResponse.json({
            results: results || [],
            last_scan: lastScan,
        })
    } catch (error) {
        console.error('[Killzone Monitor Results API] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
