import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, createClient } from '@/lib/supabase/server'
import { explainPattern } from '@/lib/correlation/ai-explainer'

/**
 * POST /api/correlation/explain/[id]
 *
 * Generate AI explanation for a specific correlation pattern.
 * Uses Gemini for fundamental analysis + Claude for narrative synthesis.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: scenarioId } = await params
  const client = await createClient()

  // Fetch scenario
  const { data: scenario, error: fetchError } = await client
    .from('correlation_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !scenario) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  // Check if explanation already exists
  if (scenario.pattern_explanation) {
    return NextResponse.json({
      cached: true,
      explanation: scenario.pattern_explanation
    })
  }

  try {
    // Generate explanation using AI
    const explanation = await explainPattern(scenario)

    // Store in database
    const { error: updateError } = await client
      .from('correlation_scenarios')
      .update({
        pattern_explanation: explanation,
        updated_at: new Date().toISOString()
      })
      .eq('id', scenarioId)

    if (updateError) {
      console.error('[ExplainAPI] Failed to store explanation:', updateError)
    }

    return NextResponse.json({
      cached: false,
      explanation
    })
  } catch (error) {
    console.error('[ExplainAPI] Error generating explanation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Explanation failed' },
      { status: 500 }
    )
  }
}
