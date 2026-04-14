import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getNotificationPreferences, upsertNotificationPreferences } from '@/lib/data/push-subscriptions'

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prefs = await getNotificationPreferences(user.id)
    return NextResponse.json({
        preferences: prefs || {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            session_transitions: true,
            market_alerts: true,
            morning_time: '07:00',
            quiet_start: '22:00',
            quiet_end: '06:00',
            telegram_chat_id: null,
            telegram_enabled: false,
            wake_up_time: '06:00',
            trading_start_time: '07:00',
            trading_end_time: '21:00',
            regime_engine_enabled: false,
            regime_engine_dry_run: true,
            regime_engine_max_trades_per_day: 5,
            regime_engine_risk_amount: 10,
            regime_engine_min_confidence: 0.7,
            regime_engine_cooldown_minutes: 60,
            regime_engine_trap_enabled: true,
            regime_engine_killzone_enabled: true,
            regime_engine_momentum_enabled: true,
            regime_engine_ghost_enabled: true
        }
    })
}

export async function PUT(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()

        const saved = await upsertNotificationPreferences(user.id, {
            timezone: body.timezone,
            session_transitions: body.session_transitions,
            market_alerts: body.market_alerts,
            morning_time: body.morning_time,
            quiet_start: body.quiet_start,
            quiet_end: body.quiet_end,
            telegram_chat_id: body.telegram_chat_id,
            telegram_enabled: body.telegram_enabled,
            wake_up_time: body.wake_up_time,
            trading_start_time: body.trading_start_time,
            trading_end_time: body.trading_end_time,
            regime_engine_enabled: body.regime_engine_enabled,
            regime_engine_dry_run: body.regime_engine_dry_run,
            regime_engine_max_trades_per_day: body.regime_engine_max_trades_per_day,
            regime_engine_risk_amount: body.regime_engine_risk_amount,
            regime_engine_min_confidence: body.regime_engine_min_confidence,
            regime_engine_cooldown_minutes: body.regime_engine_cooldown_minutes,
            regime_engine_trap_enabled: body.regime_engine_trap_enabled,
            regime_engine_killzone_enabled: body.regime_engine_killzone_enabled,
            regime_engine_momentum_enabled: body.regime_engine_momentum_enabled,
            regime_engine_ghost_enabled: body.regime_engine_ghost_enabled
        })

        if (!saved) {
            return NextResponse.json(
                { error: 'Failed to save preferences' },
                { status: 500 }
            )
        }

        return NextResponse.json({ preferences: saved })
    } catch (error: any) {
        console.error('Error saving notification preferences:', error)
        return NextResponse.json(
            { error: 'Failed to save preferences' },
            { status: 500 }
        )
    }
}
