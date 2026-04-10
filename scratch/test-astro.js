const SunCalc = require('suncalc');
const ical = require('node-ical');

async function test() {
    console.log("Testing SunCalc...");
    const date = new Date();
    const illumination = SunCalc.getMoonIllumination(date);
    console.log("Moon Illumination:", illumination);

    console.log("\nTesting ical fetch (Google Moon)...");
    const URL = 'https://calendar.google.com/calendar/ical/ht3jplcn7224ndjkdov93c9m9m%40group.calendar.google.com/public/basic.ics';
    try {
        const data = await ical.async.fromURL(URL);
        const events = Object.values(data).filter(e => e.type === 'VEVENT');
        console.log("Fetched", events.length, "moon events.");
        if (events.length > 0) {
            console.log("Sample event:", events[0].summary, events[0].start);
        }
    } catch (e) {
        console.error("Failed to fetch Google Moon:", e.message);
    }
}

test();
