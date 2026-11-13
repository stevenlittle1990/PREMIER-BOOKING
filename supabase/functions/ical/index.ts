// Public calendar feed for one listing: /functions/v1/ical?listing=<slug>
// Paste it into Hostfully / Airbnb / VRBO so bookings made in Premier Booking block those sites too.
// Only shows that dates are taken; no guest details. Deploy with verify_jwt = false.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stamp = (d: string) => d.replaceAll('-', '');
const addDay = (d: string, n: number) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  const slug = (new URL(req.url).searchParams.get('listing') ?? '').replace(/\.ics$/, '');
  const { data: listing } = await db.from('listings').select('id, slug, title').eq('slug', slug).maybeSingle();
  if (!listing) return new Response('Unknown listing', { status: 404 });
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    db.from('bookings').select('id, start_date, end_date').eq('listing_id', listing.id).eq('status', 'accepted').gte('end_date', today),
    // Synced days came from the other calendars, so they are not sent back (avoids loops).
    db.from('blocked_dates').select('day').eq('listing_id', listing.id).eq('source', 'host').gte('day', today).order('day'),
  ]);

  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const events: string[] = [];
  for (const b of bookings ?? []) {
    const end = b.end_date > b.start_date ? b.end_date : addDay(b.start_date, 1);
    events.push(['BEGIN:VEVENT', `UID:booking-${b.id}@premier-booking`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${stamp(b.start_date)}`,
      `DTEND;VALUE=DATE:${stamp(end)}`, 'SUMMARY:Reserved (Premier Booking)', 'END:VEVENT'].join('\r\n'));
  }
  // Merge back-to-back blocked days into one event.
  const days = (blocks ?? []).map((r: { day: string }) => r.day);
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === addDay(days[j], 1)) j++;
    events.push(['BEGIN:VEVENT', `UID:block-${listing.id}-${days[i]}@premier-booking`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${stamp(days[i])}`,
      `DTEND;VALUE=DATE:${stamp(addDay(days[j], 1))}`, 'SUMMARY:Not available', 'END:VEVENT'].join('\r\n'));
    i = j + 1;
  }

  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Premier Booking//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${listing.title}`, ...events, 'END:VCALENDAR', ''].join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'max-age=300' } });
});
