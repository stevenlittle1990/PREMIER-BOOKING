// Sends one in-app notification out by email (Resend) and text (Twilio) when those accounts are set up.
// Called by a database trigger with {id}. Deploy with verify_jwt = false: it only acts on a stored notification
// and returns nothing about it, so knowing an id gains nothing.
// Secrets (Supabase > Edge Functions > Secrets): RESEND_API_KEY, NOTIFY_FROM (e.g. "POC Premier Lodge <bookings@pocpremierlodge.com>"),
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+1361...), APP_URL (https://... the app's address).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const env = (k: string) => Deno.env.get(k) ?? '';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function e164(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

Deno.serve(async (req) => {
  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return new Response('ok');
  const { data: n } = await db.from('notifications').select('*').eq('id', id).maybeSingle();
  if (!n || n.email_sent_at || n.sms_sent_at) return new Response('ok');
  const { data: p } = await db.from('profiles').select('email, phone, full_name').eq('id', n.user_id).maybeSingle();
  const link = `${env('APP_URL') || 'https://premier-booking.netlify.app'}${n.link ?? ''}`;
  const problems: string[] = [];
  const patch: Record<string, string> = {};

  if (env('RESEND_API_KEY') && p?.email) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('NOTIFY_FROM') || 'POC Premier Lodge <onboarding@resend.dev>',
        to: [p.email],
        subject: n.title,
        html: `<div style="font-family:Arial,sans-serif;color:#10222f"><h2 style="font-family:Georgia,serif">${esc(n.title)}</h2>
          <p>${esc(n.body)}</p><p><a href="${link}" style="background:#10222f;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none">Open Premier Booking</a></p>
          <p style="color:#7b7468;font-size:12px">POC Premier Lodge · 110 East Monroe Ave., Port O'Connor, TX · 361-210-8494</p></div>`,
        text: `${n.title}\n\n${n.body}\n\n${link}`,
      }),
    });
    if (res.ok) patch.email_sent_at = new Date().toISOString();
    else problems.push(`email ${res.status}: ${(await res.text()).slice(0, 200)}`);
  } else problems.push('no email sender set up');

  const to = n.sms && p?.phone ? e164(p.phone) : null;
  if (to && env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM')) {
    const sid = env('TWILIO_ACCOUNT_SID');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${sid}:${env('TWILIO_AUTH_TOKEN')}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: env('TWILIO_FROM'), Body: `POC Premier Lodge: ${n.title}. ${n.body} ${link}`.slice(0, 600) }),
    });
    if (res.ok) patch.sms_sent_at = new Date().toISOString();
    else problems.push(`text ${res.status}`);
  } else if (n.sms) problems.push(to ? 'no text sender set up' : 'no mobile number');

  await db.from('notifications').update({ ...patch, send_error: problems.join('; ') || null }).eq('id', id);
  return new Response('ok');
});
