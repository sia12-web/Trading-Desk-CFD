import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'

/**
 * GET /api/correlation/cache
 *
 * Checks if analysis cache is valid for the current user.
 * Returns cache status and metadata if cached.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await createClient()

  const { data: cache, error } = await client
    .from('correlation_analysis_cache')
    .select('*')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected if no cache)
    console.error('[CorrelationAPI] Error fetching cache:', error)
    return NextResponse.json(
      { error: 'Database error: ' + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    cached: !!cache,
    cache: cache || null
  })
}

/**
 * DELETE /api/correlation/cache
 *
 * Clears the analysis cache for the current user, forcing re-analysis on next run.
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = await createClient()

  const { error } = await client
    .from('correlation_analysis_cache')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    console.error('[CorrelationAPI] Error clearing cache:', error)
    return NextResponse.json(
      { error: 'Database error: ' + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
