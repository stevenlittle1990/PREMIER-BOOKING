-- Customer messages: "we got your request", confirmation with the trip note, a reminder a week out,
-- and specials sent by the admin. All of them go out through the notify edge function (email by Resend,
-- text by Twilio) once those accounts are set up; until then they wait in the notifications table.

-- 1. Notifications can go straight to an email and phone (guest checkout has no account).
alter table public.notifications alter column user_id drop not null;
alter table public.notifications
  add column if not exists to_email text,
  add column if not exists to_phone text,
  add column if not exists email boolean not null default true,   -- send by email at all
  add column if not exists sms_body text,                         -- shorter wording for the text message
  add column if not exists kind text not null default 'update';   -- 'update' (about a booking) or 'promo'
alter table public.bookings add column if not exists reminder_sent_at timestamptz;

-- 2. Guests who checked out without an account, and whether they said yes to specials.
create table if not exists public.guest_contacts (
  email text primary key,
  name text,
  phone text,
  marketing_email boolean not null default false,
  marketing_sms boolean not null default false,
  consent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.guest_contacts enable row level security;
drop policy if exists "admin manages guest contacts" on public.guest_contacts;
create policy "admin manages guest contacts" on public.guest_contacts for all using (public.is_admin()) with check (public.is_admin());

-- 3. Editable wording (Settings tab). The trip note is Jason's message to guests who booked a guide.
insert into public.app_settings (key, value) values
('trip_confirmation_text', $t$Thank you for choosing Port O'Connor Premier Lodge for your guiding and/or lodging needs. We appreciate your business.

If you booked a guide, here is what to expect and what to bring. All trips are 4 to 5 hours long. Your guide will touch base with you on the time and where to meet.

1. Your guide supplies all the gear for fishing.
2. Your guide supplies all the ice, with an ice chest on board. Please don't bring your own ice chest. A small over-the-shoulder carry-on is OK, but large chests are not allowed on the boat.
3. Bring any food and drinks you like. Adult beverages are fine, but no glass bottles please, and no bananas.
4. No black-soled shoes please. Sunscreen, sunglasses and a hat are recommended.
5. At the end of the trip, all fish are cleaned and bagged for you to take on your way.

Thank you again for booking. We look forward to having you aboard.$t$)
on conflict (key) do nothing;

-- 4. One helper that messages whoever made a booking, with or without an account.
create or replace function public.message_customer(b public.bookings, p_title text, p_body text, p_link text, p_sms boolean, p_sms_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if b.guest_id is not null then
    insert into notifications (user_id, title, body, link, booking_id, sms, sms_body)
    values (b.guest_id, p_title, p_body, p_link, b.id, p_sms, p_sms_body);
  elsif coalesce(b.guest_email, '') <> '' or coalesce(b.guest_phone, '') <> '' then
    insert into notifications (user_id, to_email, to_phone, title, body, link, booking_id, sms, sms_body)
    values (null, nullif(b.guest_email, ''), nullif(b.guest_phone, ''), p_title, p_body, p_link, b.id, p_sms, p_sms_body);
  end if;
end $$;
revoke all on function public.message_customer(public.bookings, text, text, text, boolean, text) from public, anon, authenticated;

-- Where a customer should look: their trips if they have an account, otherwise the listing page.
create or replace function public.customer_link(b public.bookings) returns text language sql stable security definer set search_path = public as $$
  select case when b.guest_id is not null then '/account'
    else coalesce((select case when kind = 'stay' then '/stays/' else '/trips/' end || slug from listings where id = b.listing_id), '/') end;
$$;

-- Everything booked together, as one line ("POC Premier Lodge, Dec 3 to Dec 6; Inshore Bay Fishing, Dec 4 at 6:30 AM").
create or replace function public.group_label(b public.bookings, p_status text default null) returns text language sql stable security definer set search_path = public as $$
  select coalesce(string_agg(booking_label(x), '; ' order by x.start_date, x.start_time), booking_label(b))
  from bookings x where (x.id = b.id or (b.group_id is not null and x.group_id = b.group_id)) and (p_status is null or x.status = p_status);
$$;

-- 5. Booking changes: tell the admin and owner, and now the customer too.
create or replace function public.on_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; owner uuid; is_trip boolean; note text;
begin
  select owner_id, kind = 'trip' into owner, is_trip from listings where id = new.listing_id;
  if tg_op = 'INSERT' then
    for r in select id from profiles where role = 'admin' or id = owner loop
      perform notify_user(r.id, 'New booking request', new.guest_name || ' · ' || booking_label(new) || ' · ' || new.guests || ' guests', '/host', new.id, true);
    end loop;
    -- One "we got it" per request, even when a stay and trips were sent together.
    if new.group_id is null or not exists (select 1 from bookings x where x.group_id = new.group_id and x.id::text < new.id::text) then
      perform message_customer(new, 'We got your request',
        'Thanks, ' || split_part(new.guest_name, ' ', 1) || '! We got your request for ' || group_label(new) ||
        '. We''ll check the dates and get back to you with a quote, usually within a day. Questions? Call 361-210-8494.',
        customer_link(new), true,
        'POC Premier Lodge: we got your request for ' || group_label(new) || '. We''ll confirm and send a quote soon. Questions? 361-210-8494');
    end if;
  elsif new.status is distinct from old.status and new.status = 'accepted' then
    select value into note from app_settings where key = 'trip_confirmation_text';
    perform message_customer(new, 'Your booking is confirmed',
      booking_label(new) || ' is confirmed.' || coalesce(' Note from us: ' || new.host_note, '') ||
      case when is_trip and note is not null then E'\n\n' || note else '' end,
      customer_link(new), true,
      'POC Premier Lodge: you''re confirmed for ' || booking_label(new) || '.' ||
      case when is_trip then ' Your guide will touch base on the time and where to meet. What to bring:' else ' Details:' end);
  elsif new.status is distinct from old.status and new.status = 'declined' then
    perform message_customer(new, 'About your booking request',
      'We''re sorry, we can''t do ' || booking_label(new) || '.' || coalesce(' ' || new.host_note, '') || ' Call 361-210-8494 and we''ll help find another date.',
      customer_link(new), true);
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    for r in select id from profiles where role = 'admin' or id = owner
             union select assignee_id from booking_assignments where booking_id = new.id loop
      perform notify_user(r.id, 'Booking cancelled', new.guest_name || ' · ' || booking_label(new), '/host', new.id, true);
    end loop;
  end if;
  return new;
end $$;

-- 6. A text (and email) about a week before each confirmed trip. Runs every morning.
create or replace function public.send_trip_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare b record; n int := 0; today date := (now() at time zone 'America/Chicago')::date; is_trip boolean;
begin
  for b in
    select distinct on (coalesce(x.group_id, x.id)) x.*
    from bookings x
    where x.status = 'accepted' and x.reminder_sent_at is null
      and x.start_date > today and x.start_date <= today + 7
      and (x.decided_at is null or x.decided_at < now() - interval '12 hours')  -- just confirmed? they already heard from us
    order by coalesce(x.group_id, x.id), x.start_date
  loop
    select exists (select 1 from bookings y join listings l on l.id = y.listing_id
                   where (y.id = b.id or (b.group_id is not null and y.group_id = b.group_id)) and y.status = 'accepted' and l.kind = 'trip') into is_trip;
    perform message_customer(b::bookings, 'Your trip is coming up',
      'See you soon! ' || group_label(b::bookings, 'accepted') || '.' ||
      case when is_trip then ' Your guide will touch base with you on the time and where to meet. Remember: no black-soled shoes, no glass, no bananas, and no large ice chests.' else '' end ||
      ' Questions? Call 361-210-8494.',
      customer_link(b::bookings), true,
      'POC Premier Lodge: see you soon! ' || group_label(b::bookings, 'accepted') || '.' ||
      case when is_trip then ' Your guide will text you the time and where to meet. No glass, no bananas, no black-soled shoes.' else '' end);
    update bookings set reminder_sent_at = now()
      where status = 'accepted' and (id = b.id or (b.group_id is not null and group_id = b.group_id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.send_trip_reminders() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'trip-reminders';
    perform cron.schedule('trip-reminders', '0 15 * * *', 'select public.send_trip_reminders()'); -- 9 or 10 AM in Texas
  end if;
end $$;

-- 7. Opt-in for specials: from the sign-up form, and at guest checkout.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare p preset_roles;
begin
  select * into p from preset_roles where lower(email) = lower(new.email);
  insert into profiles (id, email, full_name, phone, role, team_type, worker_type, marketing_email, marketing_sms)
  values (new.id, new.email,
          coalesce(nullif(p.full_name, ''), new.raw_user_meta_data->>'full_name', ''),
          coalesce(p.phone, new.raw_user_meta_data->>'phone'),
          coalesce(p.role, 'guest'), p.team_type, p.worker_type,
          coalesce((new.raw_user_meta_data->>'marketing_email')::boolean, false),
          coalesce((new.raw_user_meta_data->>'marketing_sms')::boolean, false))
  on conflict (id) do nothing;
  return new;
end $$;

drop function if exists public.guest_inquiry(jsonb, text, text, text);
create or replace function public.guest_inquiry(p_items jsonb, p_name text, p_email text, p_phone text,
  p_marketing_email boolean default false, p_marketing_sms boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare
  it jsonb; grp uuid := null; n int := 0;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  s date; e date; g int; lid uuid;
begin
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Add your name.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'Add a valid email so we can send your quote.'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 10 or length(v_phone) > 40 then raise exception 'Add a phone number with area code.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 8 then raise exception 'Nothing to send.'; end if;
  if (select count(*) from bookings where guest_id is null and lower(guest_email) = v_email and created_at > now() - interval '1 hour') >= 16
     or (select count(*) from bookings where guest_id is null and created_at > now() - interval '10 minutes') >= 80 then
    raise exception 'Too many requests right now. Please call 361-210-8494.';
  end if;

  -- Remember the guest, and their yes or no to specials (a later "no" turns it off; a missing answer keeps it).
  insert into guest_contacts (email, name, phone, marketing_email, marketing_sms, consent_at)
  values (v_email, v_name, v_phone, coalesce(p_marketing_email, false), coalesce(p_marketing_sms, false),
          case when p_marketing_email or p_marketing_sms then now() end)
  on conflict (email) do update set name = excluded.name, phone = excluded.phone,
    marketing_email = excluded.marketing_email, marketing_sms = excluded.marketing_sms,
    consent_at = coalesce(excluded.consent_at, guest_contacts.consent_at), updated_at = now();

  if jsonb_array_length(p_items) > 1 then grp := gen_random_uuid(); end if;
  for it in select * from jsonb_array_elements(p_items) loop
    lid := (it->>'listing_id')::uuid;
    s := (it->>'start_date')::date;
    e := coalesce((it->>'end_date')::date, s);
    g := coalesce((it->>'guests')::int, 1);
    if not exists (select 1 from listings where id = lid and published) then raise exception 'That listing is not available.'; end if;
    if s < current_date or s > current_date + 730 or e < s or e > s + 60 then raise exception 'Check your dates.'; end if;
    if g < 1 or g > 60 then raise exception 'Check the number of guests.'; end if;
    insert into bookings (listing_id, guest_id, guest_name, guest_email, guest_phone, start_date, end_date, start_time, guests, total_cents, status, notes, group_id)
    values (lid, null, v_name, v_email, v_phone, s, e, left(it->>'start_time', 40), g, 0, 'requested',
            left('Guest checkout (no account). ' || coalesce(it->>'notes', ''), 2000), grp);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.guest_inquiry(jsonb, text, text, text, boolean, boolean) from public;
grant execute on function public.guest_inquiry(jsonb, text, text, text, boolean, boolean) to anon, authenticated;

-- 8. Specials and check-ins from the admin. Everyone with an account sees it in the app;
--    only people who said yes get it by text or email.
create or replace function public.announcement_audience() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_admin() then null else jsonb_build_object(
    'app', (select count(*) from profiles where role = 'guest'),
    'text', (select count(*) from profiles where role = 'guest' and marketing_sms and coalesce(phone, '') <> '')
          + (select count(*) from guest_contacts where marketing_sms and coalesce(phone, '') <> ''),
    'email', (select count(*) from profiles where role = 'guest' and marketing_email)
           + (select count(*) from guest_contacts where marketing_email)) end;
$$;

create or replace function public.send_announcement(p_title text, p_body text, p_link text default '/', p_text boolean default true, p_email boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare n int; m int;
begin
  if not is_admin() then raise exception 'Only the admin can send messages to customers.'; end if;
  if length(btrim(coalesce(p_title, ''))) < 2 or length(p_title) > 120 then raise exception 'Add a short title.'; end if;
  if length(btrim(coalesce(p_body, ''))) < 2 or length(p_body) > 1200 then raise exception 'Add the message (up to 1,200 characters).'; end if;
  insert into notifications (user_id, title, body, link, sms, email, kind)
    select id, btrim(p_title), btrim(p_body), coalesce(nullif(p_link, ''), '/'), p_text and marketing_sms, p_email and marketing_email, 'promo'
    from profiles where role = 'guest';
  get diagnostics n = row_count;
  insert into notifications (user_id, to_email, to_phone, title, body, link, sms, email, kind)
    select null, email, phone, btrim(p_title), btrim(p_body), coalesce(nullif(p_link, ''), '/'), p_text and marketing_sms, p_email and marketing_email, 'promo'
    from guest_contacts where (p_text and marketing_sms) or (p_email and marketing_email);
  get diagnostics m = row_count;
  return n + m;
end $$;
revoke all on function public.send_announcement(text, text, text, boolean, boolean) from public, anon;
grant execute on function public.send_announcement(text, text, text, boolean, boolean) to authenticated;
revoke all on function public.announcement_audience() from public, anon;
grant execute on function public.announcement_audience() to authenticated;
