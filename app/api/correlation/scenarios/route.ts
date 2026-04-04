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
