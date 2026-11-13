// Pulls each listing's iCal feeds (Hostfully, Airbnb, VRBO...) and blocks those nights in Premier Booking.
// Runs every 30 minutes from pg_cron, or on demand from the host dashboard.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function toDate(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function addDay(d: string, n: number) {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// Nights taken by each event: DTSTART up to (not including) DTEND.
function busyNights(ics: string): Set<string> {
  const out = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDay(today, 730);
  for (const block of unfold(ics).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0];
    if (/^STATUS:CANCELLED/m.test(body)) continue;
    const s = body.match(/^DTSTART[^:]*:(.+)$/m);
    const e = body.match(/^DTEND[^:]*:(.+)$/m);
    const start = s && toDate(s[1]);
    if (!start) continue;
    let end = (e && toDate(e[1])) || addDay(start, 1);
    if (end <= start) end = addDay(start, 1);
    for (let d = start < today ? today : start; d < end && d < horizon; d = addDay(d, 1)) out.add(d);
  }
  return out;
}

Deno.serve(async (req) => {
  const only = new URL(req.url).searchParams.get('listing');
  let q = db.from('listings').select('id, slug, ical_import_urls').neq('ical_import_urls', '{}');
  if (only) q = q.eq('id', only);
  const { data: listings, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Record<string, unknown> = {};
  for (const l of listings ?? []) {
    try {
      const nights = new Set<string>();
      for (const url of l.ical_import_urls as string[]) {
        const res = await fetch(url, { headers: { 'User-Agent': 'PremierBooking-CalendarSync/1.0' } });
        if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
        for (const d of busyNights(await res.text())) nights.add(d);
      }
      // Replace this listing's synced days; days a host blocked by hand are left alone.
      await db.from('blocked_dates').delete().eq('listing_id', l.id).eq('source', 'sync');
      const { data: manual } = await db.from('blocked_dates').select('day').eq('listing_id', l.id);
      const taken = new Set((manual ?? []).map((r: { day: string }) => r.day));
      const rows = [...nights].filter((d) => !taken.has(d)).map((day) => ({ listing_id: l.id, day, source: 'sync', reason: 'Booked elsewhere' }));
      if (rows.length) {
        const { error: e } = await db.from('blocked_dates').insert(rows);
        if (e) throw new Error(e.message);
      }
      await db.from('listings').update({ ical_synced_at: new Date().toISOString(), ical_sync_error: null }).eq('id', l.id);
      results[l.slug] = { nights: rows.length };
    } catch (e) {
      await db.from('listings').update({ ical_sync_error: (e as Error).message }).eq('id', l.id);
      results[l.slug] = { error: (e as Error).message };
    }
  }
  return Response.json({ synced: results });
});
