-- Import links from Hostfully/Airbnb are private, so they live outside the public listings table.
create table public.listing_calendars (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  import_urls text[] not null default '{}',
  synced_at timestamptz,
  sync_error text
);
insert into public.listing_calendars (listing_id, import_urls, synced_at, sync_error)
  select id, ical_import_urls, ical_synced_at, ical_sync_error from public.listings where ical_import_urls <> '{}';
alter table public.listings drop column ical_import_urls, drop column ical_synced_at, drop column ical_sync_error;

alter table public.listing_calendars enable row level security;
create policy "owners manage calendar links" on public.listing_calendars for all
  using (is_admin() or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (is_admin() or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));
