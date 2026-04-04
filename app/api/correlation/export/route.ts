import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'

/**
 * GET /api/correlation/export?format=csv|json
 *
 * Export correlation patterns to CSV or JSON format.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'
  const minAccuracy = parseInt(searchParams.get('minAccuracy') || '55')

  const client = await createClient()

  const { data: scenarios, error } = await client
    .from('correlation_scenarios')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .gte('accuracy_percentage', minAccuracy)
    .order('accuracy_percentage', { ascending: false })

  if (error || !scenarios) {
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }

  if (format === 'csv') {
    const csv = convertToCSV(scenarios)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="correlation-patterns-${Date.now()}.csv"`
      }
    })
  } else {
    // JSON format
    return new Response(JSON.stringify(scenarios, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="correlation-patterns-${Date.now()}.json"`
      }
    })
  }
}

function convertToCSV(scenarios: any[]): string {
  const headers = [
    'Pattern Description',
    'Type',
    'Accuracy %',
    'Total Occurrences',
    'Wins',
    'Losses',
    'Avg Pips',
    'Best Day',
    'First Seen',
    'Last Seen'
  ]

  const rows = scenarios.map(s => [
    `"${s.pattern_description.replace(/"/g, '""')}"`,
    s.pattern_type,
    s.accuracy_percentage.toFixed(2),
    s.total_occurrences,
    s.successful_outcomes,
    s.failed_outcomes,
    s.avg_outcome_pips?.toFixed(1) || 'N/A',
    s.best_day || 'N/A',
    s.first_occurrence_date,
    s.last_occurrence_date
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
}
