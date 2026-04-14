import { createClient } from '@/lib/supabase/server'

export interface PushSubscription {
    id: string
    user_id: string
    endpoint: string
    p256dh_key: string
    auth_key: string
    user_agent: string | null
    device_label: string | null
    is_active: boolean
    last_used_at: string
    created_at: string
}

export interface NotificationPreferences {
    id: string
    user_id: string
    timezone: string
    session_transitions: boolean
    market_alerts: boolean
    morning_time: string
    quiet_start: string
    quiet_end: string
    telegram_chat_id: string | null
    telegram_enabled: boolean
    wake_up_time: string
    trading_start_time: string
    trading_end_time: string

    // Regime Engine
    regime_engine_enabled: boolean
    regime_engine_dry_run: boolean
    regime_engine_max_trades_per_day: number
    regime_engine_risk_amount: number
    regime_engine_min_confidence: number
    regime_engine_cooldown_minutes: number
    regime_engine_trap_enabled: boolean
    regime_engine_killzone_enabled: boolean
    regime_engine_momentum_enabled: boolean
    regime_engine_ghost_enabled: boolean
}

export async function saveSubscription(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
): Promise<PushSubscription | null> {
    const supabase = await createClient()

    const deviceLabel = userAgent
        ? (userAgent.includes('Mobile') ? 'Mobile' : 'Desktop')
        : null

    const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh_key: subscription.keys.p256dh,
            auth_key: subscription.keys.auth,
            user_agent: userAgent || null,
            device_label: deviceLabel,
            is_active: true,
            last_used_at: new Date().toISOString()
        }, { onConflict: 'user_id,endpoint' })
        .select()
        .single()

    if (error) {
        console.error('Error saving push subscription:', error)
        return null
    }

    return data
}

export async function getActiveSubscriptions(userId: string): Promise<PushSubscription[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

    if (error) {
        console.error('Error fetching push subscriptions:', error)
        return []
    }

    return data || []
}

export async function deactivateSubscription(userId: string, endpoint: string): Promise<void> {
    const supabase = await createClient()

    await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

    if (error) return null
    return data
}

export async function upsertNotificationPreferences(
    userId: string,
    prefs: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at'>>
): Promise<NotificationPreferences | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({
            user_id: userId,
            ...prefs,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single()

    if (error) {
        console.error('Error saving notification preferences:', error)
        return null
    }

    return data
}
