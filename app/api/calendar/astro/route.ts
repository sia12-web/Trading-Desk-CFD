import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MOON_PHASES_ICAL = 'https://calendar.google.com/calendar/ical/ht3jplcn7224ndjkdov93c9m9m%40group.calendar.google.com/public/basic.ics'
const ASTRO_CAL_ICAL = 'https://cantonbecker.com/astronomy-calendar/astrocal.ics'

/**
 * Helper to extract value from node-ical ParameterValue type.
 */
function getVal(prop: any): string {
    if (!prop) return ''
    if (typeof prop === 'string') return prop
    if (prop.val && typeof prop.val === 'string') return prop.val
    return String(prop)
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!startStr || !endStr) {
        return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 })
    }

    const startDate = new Date(startStr)
    const endDate = new Date(endStr)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    try {
        console.log(`[AstroAPI] Fetching transits from ${startDate.toISOString()} to ${endDate.toISOString()}`)

        const ical = require('node-ical')
        const SunCalc = require('suncalc')

        const [moonData, astroData] = await Promise.all([
            ical.async.fromURL(MOON_PHASES_ICAL).catch((err: any) => {
                console.warn('[AstroAPI] Moon Phases fetch failed:', err.message)
                return {}
            }),
            ical.async.fromURL(ASTRO_CAL_ICAL).catch((err: any) => {
                console.warn('[AstroAPI] Astro Events fetch failed:', err.message)
                return {}
            })
        ])

        const events: any[] = []

        const processCalendar = (data: any, prefix: string) => {
            Object.values(data).forEach((event: any) => {
                if (event.type === 'VEVENT') {
                    // Check if it's a recurring event
                    if (event.rrule) {
                        const instances = ical.expandRecurringEvent(event, {
                            from: startDate,
                            to: endDate
                        })
                        instances.forEach((instance: any) => {
                            addEvent(instance.event, instance.start, prefix)
                        })
                    } else {
                        addEvent(event, new Date(event.start), prefix)
                    }
                }
            })
        }

        const addEvent = (event: any, eventStart: Date, prefix: string) => {
            if (eventStart >= startDate && eventStart <= endDate) {
                const rawTitle = getVal(event.summary)
                const title = rawTitle.toLowerCase()
                
                let priority = 'low'
                let category: any = prefix === 'moon' ? 'moon' : 'transit'

                if (title.includes('retrograde')) {
                    priority = 'high'
                    category = 'retrograde'
                } else if (title.includes('eclipse')) {
                    priority = 'high'
                    category = 'eclipse'
                } else if (title.includes('conjunction') || title.includes('opposition')) {
                    priority = 'normal'
                    category = 'aspect'
                }

                events.push({
                    id: `${prefix}-${event.uid || Math.random()}-${eventStart.getTime()}`,
                    title: rawTitle,
                    description: getVal(event.description),
                    start_time: eventStart.toISOString(),
                    event_type: 'astrological',
                    category,
                    priority
                })
            }
        }

        processCalendar(moonData, 'moon')
        processCalendar(astroData, 'astro')

        // Generate Moon Phase info for UI
        const moonPhases = []
        let current = new Date(startDate)
        current.setHours(12, 0, 0, 0) 
        
        while (current <= endDate) {
            const illumination = SunCalc.getMoonIllumination(current)
            moonPhases.push({
                date: current.toISOString().split('T')[0],
                fraction: illumination.fraction,
                phase: illumination.phase,
                angle: illumination.angle
            })
            current.setDate(current.getDate() + 1)
        }

        return NextResponse.json({ events, moonPhases })
    } catch (err: any) {
        console.error('[AstroAPI] Internal Error:', err)
        return NextResponse.json({ 
            events: [], 
            moonPhases: [], 
            error: 'Failed to process astronomical data',
            details: err.message 
        }, { status: 500 })
    }
}
