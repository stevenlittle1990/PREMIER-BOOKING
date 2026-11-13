-- Vacation-rental details on listings, bookings grouped so a stay and its trips go in together,
-- POC Premier Lodge details from its Airbnb listing and pocpremierlodge.com, and the Carey Street house (hidden).
-- Applied to project yghmjkeqsnfbntbobvfx on 2026-11-13; see the Supabase migration history for the full statement.
alter table public.listings
  add column highlights text[] not null default '{}',
  add column rooms jsonb not null default '[]',
  add column house_rules text[] not null default '{}',
  add column check_in_time text,
  add column check_out_time text,
  add column cleaning_fee_cents int not null default 0,
  add column cancellation_policy text not null default '';
alter table public.bookings add column group_id uuid;
create index bookings_group_idx on public.bookings (group_id);
-- (data updates for poc-premier-lodge photos/rooms/highlights, trip photos, and the carey-street-house insert follow in the applied version)
