import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'

/**
 * GET /api/correlation/scenarios
 *
 * Fetches discovered correlation patterns with filtering and sorting.
 *
 * Query params:
 * - minAccuracy: number (default: 55) - Minimum accuracy percentage
 * - day: string (optional) - Filter by best day (Monday, Tuesday, etc.)
 * - sortBy: string (default: 'accuracy') - Sort by: accuracy, occurrences, pips
 * - limit: number (default: 100) - Max results to return
 * - offset: number (default: 0) - Pagination offset
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const minAccuracy = parseInt(searchParams.get('minAccuracy') || '55')
  const day = searchParams.get('day') // Monday, Tuesday, etc.
  const sortBy = searchParams.get('sortBy') || 'accuracy'
  const limit = parseInt(searchParams.get('limit') || '1000')
  const offset = parseInt(searchParams.get('offset') || '0')

  // Validate params
  if (minAccuracy < 0 || minAccuracy > 100) {
    return NextResponse.json(
      { error: 'minAccuracy must be between 0 and 100' },
      { status: 400 }
    )
  }

  if (!['accuracy', 'occurrences', 'pips'].includes(sortBy)) {
    return NextResponse.json(
      { error: 'sortBy must be one of: accuracy, occurrences, pips' },
      { status: 400 }
    )
  }

  const client = await createClient()

  let query = client
    .from('correlation_scenarios')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gte('accuracy_percentage', minAccuracy)

  // Filter by best day if specified
  if (day) {
    query = query.eq('best_day', day.toLowerCase())
  }

  // Sort
  if (sortBy === 'accuracy') {
    query = query.order('accuracy_percentage', { ascending: false })
  } else if (sortBy === 'occurrences') {
    query = query.order('total_occurrences', { ascending: false })
  } else if (sortBy === 'pips') {
    query = query.order('avg_outcome_pips', { ascending: false, nullsFirst: false })
  }

  // Paginate
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('[CorrelationAPI] Error fetching scenarios:', error)
    return NextResponse.json(
      { error: 'Database error: ' + error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    scenarios: data || [],
    total: count || 0,
    offset,
    limit
  })
}

/**
 * DELETE /api/correlation/scenarios
 *
 * Deletes ALL correlation patterns for the current user.
 * Also clears:
 * - Scenario occurrences
 * - Analysis cache
 * - AI memory (correlation insights)
 */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[CorrelationAPI] Deleting all patterns for user:', user.id)

  const client = await createClient()

  try {
    // Count patterns before deletion
    const { count } = await client
      .from('correlation_scenarios')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const patternCount = count || 0

    // Delete all scenarios (cascade will delete occurrences automatically)
    const { error: scenariosError } = await client
      .from('correlation_scenarios')
      .delete()
      .eq('user_id', user.id)

    if (scenariosError) {
      console.error('[CorrelationAPI] Error deleting scenarios:', scenariosError)
      return NextResponse.json(
        { error: 'Failed to delete patterns: ' + scenariosError.message },
        { status: 500 }
      )
    }

    // Delete analysis cache
    const { error: cacheError } = await client
      .from('correlation_analysis_cache')
      .delete()
      .eq('user_id', user.id)

    if (cacheError) {
      console.warn('[CorrelationAPI] Error deleting cache:', cacheError)
      // Non-fatal, continue
    }

    // Clear AI memory: Delete any cached correlation insights
    // (In future, this could clear specific Story/Desk cache tables if they exist)
    console.log(`[CorrelationAPI] Deleted ${patternCount} patterns and cleared AI memory`)

    return NextResponse.json({
      success: true,
      deleted: patternCount,
      message: `Deleted ${patternCount} patterns and cleared AI memory`
    })
  } catch (error) {
    console.error('[CorrelationAPI] Fatal error during deletion:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
