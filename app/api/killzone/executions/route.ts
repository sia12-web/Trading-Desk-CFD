import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const client = await createClient()

        const { data: executions, error } = await client
            .from('killzone_auto_executions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (error) {
            return NextResponse.json({ executions: [], error: error.message }, { status: 500 })
        }

        return NextResponse.json({ executions: executions || [] })
    } catch (error) {
        return NextResponse.json({
            executions: [],
            error: error instanceof Error ? error.message : String(error),
        }, { status: 500 })
    }
}
