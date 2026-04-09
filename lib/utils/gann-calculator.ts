/**
 * W.D. Gann Calculator - Time & Price Analysis
 *
 * Implements W.D. Gann's methodology:
 * 1. Time Fractions (Master Calculator) - Daylight division for reversal windows
 * 2. Price-to-Degree (Solar Fire method) - Modulo 360 for harmonic analysis
 * 3. Ascendant Clock - Real-time Earth rotation tracking
 */

export interface GannTimeFraction {
    label: string
    fraction: number
    time: string  // HH:MM format
    minutesFromSunrise: number
}

export interface GannPriceAnalysis {
    originalPrice: number
    integer: number  // Price with decimal removed (e.g., 4810.50 → 481050)
    degree: number   // Integer % 360
    zodiacSign?: string
    cardinalCross?: boolean  // 0°, 90°, 180°, 270°
}

export interface GannAscendantData {
    ascendant: number  // 0-360 degrees
    midheaven: number  // 0-360 degrees
    localSiderealTime: string  // HH:MM:SS format
    cardinalAlignment: boolean  // true if Ascendant at 0°, 90°, 180°, or 270°
    nextCardinalDegree: number  // Next major reversal degree
    minutesToNextCardinal: number
}

export interface GannMatrixData {
    // Time Analysis (Master Calculator)
    timeFractions: GannTimeFraction[]
    daylightDuration: {
        totalMinutes: number
        hours: number
        minutes: number
    }

    // Price Analysis (Degree Conversion)
    high: GannPriceAnalysis
    low: GannPriceAnalysis
    current: GannPriceAnalysis

    // Range Analysis
    priceRange: {
        absolute: number
        integerRange: number
        degreeRange: number  // Distance in degrees between high and low
    }

    // Ascendant Clock (Solar Fire equivalent)
    ascendant?: GannAscendantData

    // Key Levels
    harmonicLevels: number[]  // Prices at 0°, 90°, 180°, 270° degrees

    calculatedAt: string
}

/**
 * Calculate Gann time fractions between sunrise and sunset
 */
export function calculateGannTimeFractions(
    sunrise: string,  // "HH:MM" format
    sunset: string    // "HH:MM" format
): { fractions: GannTimeFraction[], duration: { totalMinutes: number, hours: number, minutes: number } } {
    const sunriseMinutes = timeToMinutes(sunrise)
    const sunsetMinutes = timeToMinutes(sunset)

    let totalMinutes = sunsetMinutes - sunriseMinutes
    if (totalMinutes < 0) totalMinutes += 24 * 60  // Handle sunset next day

    const fractions: GannTimeFraction[] = [
        { label: '1/4 Point (Wave 3 Start)', fraction: 0.25, time: '', minutesFromSunrise: 0 },
        { label: '1/3 Point (First Harmonic)', fraction: 0.333333, time: '', minutesFromSunrise: 0 },
        { label: '1/2 Point (Midday Pivot)', fraction: 0.5, time: '', minutesFromSunrise: 0 },
        { label: '2/3 Point (Second Harmonic)', fraction: 0.666667, time: '', minutesFromSunrise: 0 },
        { label: '3/4 Point (Wave 5 Exhaustion)', fraction: 0.75, time: '', minutesFromSunrise: 0 }
    ]

    fractions.forEach(frac => {
        const offsetMinutes = Math.round(totalMinutes * frac.fraction)
        frac.minutesFromSunrise = offsetMinutes
        frac.time = minutesToTime(sunriseMinutes + offsetMinutes)
    })

    return {
        fractions,
        duration: {
            totalMinutes,
            hours: Math.floor(totalMinutes / 60),
            minutes: totalMinutes % 60
        }
    }
}

/**
 * Convert price to Gann degree (modulo 360)
 */
export function priceToGannDegree(price: number): GannPriceAnalysis {
    const integer = Math.floor(price * 100)  // Strip decimal: 4810.50 → 481050
    const degree = integer % 360

    // Determine zodiac sign (optional enhancement)
    const zodiacSigns = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ]
    const signIndex = Math.floor(degree / 30)
    const zodiacSign = zodiacSigns[signIndex]

    // Check if at cardinal cross (major reversal points)
    const cardinalCross = degree % 90 === 0 || Math.abs(degree % 90) < 2  // Within 2° of cardinal

    return {
        originalPrice: price,
        integer,
        degree,
        zodiacSign,
        cardinalCross
    }
}

/**
 * Calculate harmonic price levels based on degree system
 */
export function calculateHarmonicLevels(low: number, high: number): number[] {
    const range = high - low
    const cardinalFractions = [0, 0.25, 0.5, 0.75, 1.0]  // 0°, 90°, 180°, 270°, 360°

    return cardinalFractions.map(frac => low + (range * frac))
}

/**
 * Calculate real-time Ascendant position (Solar Fire equivalent)
 */
export function calculateAscendant(
    latitude: number,
    longitude: number,
    date: Date = new Date()
): GannAscendantData {
    // Calculate Local Sidereal Time (LST)
    const lst = calculateLocalSiderealTime(date, longitude)

    // Calculate Ascendant (simplified Placidus approximation)
    const ascendant = calculateAscendantDegree(lst, latitude)

    // Calculate Midheaven (MC) - LST in degrees
    const midheaven = (lst * 15) % 360

    // Check if at cardinal alignment (0°, 90°, 180°, 270°)
    const cardinalPoints = [0, 90, 180, 270]
    const tolerance = 5  // Within 5° of cardinal
    const cardinalAlignment = cardinalPoints.some(point =>
        Math.abs(ascendant - point) < tolerance ||
        Math.abs(ascendant - point - 360) < tolerance
    )

    // Find next cardinal degree
    let nextCardinalDegree = cardinalPoints.find(p => p > ascendant) || 360
    let degreesToNext = nextCardinalDegree - ascendant
    if (degreesToNext < 0) degreesToNext += 360

    // Ascendant moves ~1° every 4 minutes
    const minutesToNextCardinal = Math.round(degreesToNext * 4)

    return {
        ascendant,
        midheaven,
        localSiderealTime: formatSiderealTime(lst),
        cardinalAlignment,
        nextCardinalDegree,
        minutesToNextCardinal
    }
}

/**
 * Complete Gann Matrix calculation
 */
export function calculateGannMatrix(
    currentPrice: number,
    highPrice: number,
    lowPrice: number,
    sunrise: string,
    sunset: string,
    latitude?: number,
    longitude?: number
): GannMatrixData {
    // Time fractions
    const { fractions, duration } = calculateGannTimeFractions(sunrise, sunset)

    // Price analysis
    const high = priceToGannDegree(highPrice)
    const low = priceToGannDegree(lowPrice)
    const current = priceToGannDegree(currentPrice)

    // Range analysis
    const priceRange = {
        absolute: highPrice - lowPrice,
        integerRange: high.integer - low.integer,
        degreeRange: calculateDegreeDistance(low.degree, high.degree)
    }

    // Harmonic levels
    const harmonicLevels = calculateHarmonicLevels(lowPrice, highPrice)

    // Ascendant (if coordinates provided)
    let ascendant: GannAscendantData | undefined
    if (latitude !== undefined && longitude !== undefined) {
        ascendant = calculateAscendant(latitude, longitude)
    }

    return {
        timeFractions: fractions,
        daylightDuration: duration,
        high,
        low,
        current,
        priceRange,
        ascendant,
        harmonicLevels,
        calculatedAt: new Date().toISOString()
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

function minutesToTime(totalMinutes: number): string {
    totalMinutes = totalMinutes % (24 * 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function calculateLocalSiderealTime(date: Date, longitude: number): number {
    // Julian Date calculation
    const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0)
    const jd = (date.getTime() - j2000) / 86400000 + 2451545.0
    const t = (jd - 2451545.0) / 36525

    // GMST at 0h UT
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000

    // Add current UTC hour angle
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
    gmst += hours * 15

    // Add longitude
    let lst = gmst + longitude

    // Normalize to 0-360
    lst = lst % 360
    if (lst < 0) lst += 360

    // Convert to hours (0-24)
    return lst / 15
}

function calculateAscendantDegree(lst: number, lat: number): number {
    // Simplified ascendant calculation (Placidus approximation)
    const lstDeg = (lst * 15) % 360
    const latRad = lat * Math.PI / 180

    // Basic approximation (demonstrates concept - real Solar Fire uses more complex calculations)
    let asc = lstDeg + (lat * 0.5)
    asc = asc % 360
    if (asc < 0) asc += 360

    return asc
}

function formatSiderealTime(hours: number): string {
    const h = Math.floor(hours)
    const m = Math.floor((hours - h) * 60)
    const s = Math.floor(((hours - h) * 60 - m) * 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function calculateDegreeDistance(deg1: number, deg2: number): number {
    // Calculate shortest distance between two degrees on a circle
    let distance = Math.abs(deg2 - deg1)
    if (distance > 180) distance = 360 - distance
    return distance
}

/**
 * Get sunrise/sunset times for a location (simplified - uses average day length)
 * In production, use a proper astronomy library or API
 */
export function estimateSunriseSunset(date: Date, latitude: number): { sunrise: string, sunset: string } {
    // Simplified estimation - assumes 12 hours daylight at equator, varies by latitude
    // For production, use a proper sunrise/sunset API or library

    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
    const latitudeEffect = Math.sin(latitude * Math.PI / 180) * Math.sin((dayOfYear - 80) * 2 * Math.PI / 365)

    const daylightHours = 12 + latitudeEffect * 4  // Rough approximation
    const sunriseHour = 12 - daylightHours / 2
    const sunsetHour = 12 + daylightHours / 2

    const sunrise = `${Math.floor(sunriseHour).toString().padStart(2, '0')}:${Math.round((sunriseHour % 1) * 60).toString().padStart(2, '0')}`
    const sunset = `${Math.floor(sunsetHour).toString().padStart(2, '0')}:${Math.round((sunsetHour % 1) * 60).toString().padStart(2, '0')}`

    return { sunrise, sunset }
}
