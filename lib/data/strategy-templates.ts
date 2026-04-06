'use server'

import { createClient } from '@/lib/supabase/server'
import { StrategyTemplate, ChecklistItem } from '@/lib/types/database'
import { cache } from 'react'

export const getTemplates = cache(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
            console.error('CRITICAL: The strategy_templates table does not exist in your Supabase database. Please apply the migration manually from supabase/migrations/004_strategy_templates.sql.')
            return []
        }
        throw error
    }
    return data as StrategyTemplate[]
})

export const getTemplate = cache(async (id: string) => {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('strategy_templates')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data as StrategyTemplate
})

export async function createTemplate(data: Partial<StrategyTemplate>) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: template, error } = await supabase
        .from('strategy_templates')
        .insert([{ ...data, user_id: user.id }])
        .select()
        .single()

    if (error) throw error
    return template as StrategyTemplate
}

export async function updateTemplate(id: string, data: Partial<StrategyTemplate>) {
    const supabase = await createClient()
    const { data: template, error } = await supabase
        .from('strategy_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return template as StrategyTemplate
}

export async function deleteTemplate(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('strategy_templates')
        .delete()
        .eq('id', id)

    if (error) throw error
}

export async function incrementUsage(id: string) {
    const supabase = await createClient()
    const { data: current } = await supabase
        .from('strategy_templates')
        .select('usage_count')
        .eq('id', id)
        .single()

    const currentCount = current?.usage_count || 0

    const { error } = await supabase
        .from('strategy_templates')
        .update({ usage_count: currentCount + 1 })
        .eq('id', id)

    if (error) throw error
}

export async function seedTrueFractalTemplate() {
    const { TRUE_FRACTAL_STRATEGY } = await import('./default-strategies')
    return createTemplate(TRUE_FRACTAL_STRATEGY)
}
