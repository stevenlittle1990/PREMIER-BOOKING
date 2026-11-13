-- Team (guides, house owners, staff), W-9s, booking assignments, in-app notifications and waivers.

-- Contact details of guides and owners are no longer public; customers see the safe fields through public_team().
alter policy "hosts are public" on public.profiles using (false);

-- Team details on profiles -------------------------------------------------------
alter table public.profiles
  add column team_type text check (team_type in ('guide', 'house_owner', 'staff')),
  add column worker_type text check (worker_type in ('employee', 'subcontractor')),
  add column bio text,
  add column photo_url text,
  add column guide_license text,
  add column captain_license text,
  add column boat text,
  add column emergency_contact text,
  add column onboarded_at timestamptz;

-- Admin adds someone before they have a login; their details apply when they first sign in.
alter table public.preset_roles
  add column full_name text,
  add column phone text,
  add column team_type text check (team_type in ('guide', 'house_owner', 'staff')),
  add column worker_type text check (worker_type in ('employee', 'subcontractor')),
  add column created_at timestamptz not null default now();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare p preset_roles;
begin
  select * into p from preset_roles where lower(email) = lower(new.email);
  insert into profiles (id, email, full_name, phone, role, team_type, worker_type)
  values (new.id, new.email,
          coalesce(nullif(p.full_name, ''), new.raw_user_meta_data->>'full_name', ''),
          coalesce(p.phone, new.raw_user_meta_data->>'phone'),
          coalesce(p.role, 'guest'), p.team_type, p.worker_type)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Admin: add a guide, house owner or staff member by email (works whether or not they have an account yet).
create or replace function public.add_team_member(p_email text, p_name text, p_phone text, p_team_type text, p_worker_type text, p_role text default 'partner')
returns boolean language plpgsql security definer set search_path = public as $$
declare existing int;
begin
  if not is_admin() then raise exception 'Only an admin can add team members'; end if;
  if p_role not in ('partner', 'admin') then raise exception 'Bad role'; end if;
  insert into preset_roles (email, role, full_name, phone, team_type, worker_type)
  values (lower(trim(p_email)), p_role, p_name, nullif(trim(p_phone), ''), p_team_type, p_worker_type)
  on conflict (email) do update set role = excluded.role, full_name = excluded.full_name, phone = excluded.phone,
    team_type = excluded.team_type, worker_type = excluded.worker_type;
  update profiles set role = case when role = 'admin' then 'admin' else p_role end,
    full_name = coalesce(nullif(p_name, ''), full_name), phone = coalesce(nullif(trim(p_phone), ''), phone),
    team_type = p_team_type, worker_type = p_worker_type
  where lower(email) = lower(trim(p_email));
  get diagnostics existing = row_count;
  return existing > 0;
end $$;
revoke execute on function public.add_team_member(text, text, text, text, text, text) from public, anon;
grant execute on function public.add_team_member(text, text, text, text, text, text) to authenticated;

-- W-9 (tax info for 1099s). The tax ID is encrypted by the w9 edge function before it is stored;
-- only the last 4 digits are readable here. Clients cannot write this table directly.
create table public.tax_forms (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text not null,
  business_name text,
  tax_class text not null,
  address text not null,
  city_state_zip text not null,
  tin_type text not null check (tin_type in ('ssn', 'ein')),
  tin_last4 text not null,
  tin_cipher text not null,
  signature_name text not null,
  signed_at timestamptz not null default now()
);
alter table public.tax_forms enable row level security;
create policy "own or admin reads w9" on public.tax_forms for select using (profile_id = auth.uid() or is_admin());
revoke all on public.tax_forms from anon, authenticated;
grant select (profile_id, legal_name, business_name, tax_class, address, city_state_zip, tin_type, tin_last4, signature_name, signed_at)
  on public.tax_forms to authenticated;

-- Who is working each booking --------------------------------------------------------
create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  job text not null default 'Guide',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  note text,
  assigned_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, assignee_id)
);
-- Helpers used by policies (security definer so policies on bookings and assignments don't loop).
create or replace function public.is_assigned(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from booking_assignments where booking_id = p_booking and assignee_id = auth.uid());
$$;
create or replace function public.hosts_booking(p_booking uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings b join listings l on l.id = b.listing_id where b.id = p_booking and l.owner_id = auth.uid());
$$;
create index booking_assignments_assignee_idx on public.booking_assignments (assignee_id, status);
alter table public.booking_assignments enable row level security;
create policy "admin assigns" on public.booking_assignments for all using (is_admin()) with check (is_admin());
create policy "see own assignments" on public.booking_assignments for select using (
  assignee_id = auth.uid() or hosts_booking(booking_id));

-- Assigned guides can see the booking they are working.
create policy "assigned see booking" on public.bookings for select using (is_assigned(bookings.id));

-- Guides answer their own assignment.
create or replace function public.respond_assignment(p_id uuid, p_accept boolean, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare a booking_assignments;
begin
  select * into a from booking_assignments where id = p_id for update;
  if not found or a.assignee_id is distinct from auth.uid() then raise exception 'That job is not assigned to you'; end if;
  update booking_assignments set status = case when p_accept then 'accepted' else 'declined' end,
    note = coalesce(p_note, note), responded_at = now() where id = p_id;
  return case when p_accept then 'accepted' else 'declined' end;
end $$;
revoke execute on function public.respond_assignment(uuid, boolean, text) from public, anon;
grant execute on function public.respond_assignment(uuid, boolean, text) to authenticated;

-- In-app notifications (also emailed/texted by the notify edge function once a sender is set up) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  booking_id uuid references public.bookings(id) on delete cascade,
  sms boolean not null default false,
  read_at timestamptz,
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  send_error text,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text, p_booking uuid, p_sms boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, link, booking_id, sms) values (p_user, p_title, p_body, p_link, p_booking, p_sms);
$$;
revoke execute on function public.notify_user(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;

create or replace function public.booking_label(b bookings) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select title from listings where id = b.listing_id), 'Booking') || ', ' ||
    to_char(b.start_date, 'Mon FMDD') ||
    case when b.end_date > b.start_date then ' to ' || to_char(b.end_date, 'Mon FMDD') else '' end ||
    coalesce(' at ' || b.start_time, '');
$$;
revoke execute on function public.booking_label(bookings) from public, anon, authenticated;

create or replace function public.on_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; owner uuid;
begin
  select owner_id into owner from listings where id = new.listing_id;
  if tg_op = 'INSERT' then
    for r in select id from profiles where role = 'admin' or id = owner loop
      perform notify_user(r.id, 'New booking request', new.guest_name || ' · ' || booking_label(new) || ' · ' || new.guests || ' guests', '/host', new.id, true);
    end loop;
  elsif new.status is distinct from old.status and new.guest_id is not null and new.status in ('accepted', 'declined') then
    perform notify_user(new.guest_id,
      case when new.status = 'accepted' then 'Your booking is confirmed' else 'Your booking request was declined' end,
      booking_label(new) || coalesce(' · ' || new.host_note, ''), '/account', new.id, true);
  elsif new.status is distinct from old.status and new.status = 'cancelled' then
    for r in select id from profiles where role = 'admin' or id = owner
             union select assignee_id from booking_assignments where booking_id = new.id loop
      perform notify_user(r.id, 'Booking cancelled', new.guest_name || ' · ' || booking_label(new), '/host', new.id, true);
    end loop;
  end if;
  return new;
end $$;
revoke execute on function public.on_booking_change() from public, anon, authenticated;
create trigger bookings_notify after insert or update of status on public.bookings
  for each row execute function public.on_booking_change();

create or replace function public.on_assignment_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare b bookings; r record; who text;
begin
  select * into b from bookings where id = new.booking_id;
  if tg_op = 'INSERT' then
    perform notify_user(new.assignee_id, 'New job: ' || new.job, booking_label(b) || ' · ' || b.guests || ' guests · tap to accept', '/guide', b.id, true);
  elsif new.status is distinct from old.status then
    select coalesce(nullif(full_name, ''), email) into who from profiles where id = new.assignee_id;
    for r in select id from profiles where role = 'admin' and id <> new.assignee_id loop
      perform notify_user(r.id, who || ' ' || new.status || ' a job', booking_label(b) || coalesce(' · ' || new.note, ''), '/host', b.id, false);
    end loop;
  end if;
  return new;
end $$;
revoke execute on function public.on_assignment_change() from public, anon, authenticated;
create trigger assignments_notify after insert or update of status on public.booking_assignments
  for each row execute function public.on_assignment_change();

-- Waivers ---------------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "read settings" on public.app_settings for select using (true);
create policy "admin settings" on public.app_settings for all using (is_admin()) with check (is_admin());

create table public.waivers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  signer_id uuid references public.profiles(id),
  signer_name text not null,
  signer_email text,
  minors text,
  waiver_text text not null,
  signed_at timestamptz not null default now()
);
create index waivers_booking_idx on public.waivers (booking_id);
alter table public.waivers enable row level security;
create policy "guest signs own booking" on public.waivers for insert with check (
  signer_id = auth.uid() and exists (select 1 from bookings b where b.id = booking_id and b.guest_id = auth.uid()));
create policy "see waivers" on public.waivers for select using (
  signer_id = auth.uid() or is_admin() or hosts_booking(booking_id) or is_assigned(booking_id));

insert into public.app_settings (key, value) values ('waiver_text',
'RELEASE OF LIABILITY, ASSUMPTION OF RISK AND INDEMNITY AGREEMENT (DRAFT: have your attorney review before use)

I am taking part in a guided fishing trip, boat ride, tour or related activity (the "Activity") arranged by POC Premier Lodge and its owners, guides, captains, employees and subcontractors (together, "POC Premier Lodge") in and around Port O''Connor, Texas.

1. Risks. I understand the Activity has risks, including but not limited to: rough water, weather and lightning; slips and falls on wet decks, docks, jetty rocks and in the water; wading hazards such as holes, currents, stingrays, oyster shell and other marine life; hooks, knives, gaffs and fish spines and teeth; sun and heat; boat wakes, collisions, mechanical failure and running aground; and being far from medical help. I accept these risks.

2. My responsibilities. I will follow the guide''s and captain''s instructions, wear a life jacket when told to, tell the guide about any medical conditions, and not take part while impaired by alcohol or drugs. I confirm I am physically able to take part.

3. Release. To the fullest extent allowed by Texas law, I release POC Premier Lodge from claims for injury, illness, death or property loss arising from the Activity, except where caused by gross negligence or willful misconduct.

4. Indemnity. I will cover POC Premier Lodge for claims brought by me or anyone in my party for whom I sign.

5. Minors. If I list minors below, I am their parent or legal guardian, or have their guardian''s permission, and I agree to these terms on their behalf.

6. Photos. POC Premier Lodge may use trip photos that include me unless I tell the guide otherwise.

7. Fishing license. Anyone required by Texas Parks and Wildlife to hold a fishing license will have a valid license with a saltwater endorsement.

I have read this agreement, understand it, and sign it of my own free will.')
on conflict (key) do nothing;

-- Admin sees who has and hasn't signed.
create or replace view public.booking_waiver_status with (security_invoker = true) as
  select b.id as booking_id, count(w.id) as signed_count, max(w.signed_at) as last_signed_at
  from bookings b left join waivers w on w.booking_id = b.id group by b.id;

-- Guides customers can see (no contact details).
create or replace function public.public_team() returns table (id uuid, full_name text, bio text, photo_url text, team_type text)
language sql stable security definer set search_path = public as $$
  select id, full_name, bio, photo_url, team_type from profiles
  where role in ('admin', 'partner') and team_type = 'guide' order by full_name;
$$;
grant execute on function public.public_team() to anon, authenticated;

-- Send each new notification by email/text through the notify edge function (it skips when no sender is set up).
create or replace function public.push_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(url := 'https://yghmjkeqsnfbntbobvfx.supabase.co/functions/v1/notify',
    body := jsonb_build_object('id', new.id), headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 20000);
  return new;
end $$;
revoke execute on function public.push_notification() from public, anon, authenticated;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_notification();
