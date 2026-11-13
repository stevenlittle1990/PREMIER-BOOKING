-- Calendar sync: import iCal feeds (Hostfully, Airbnb, VRBO) into blocked days, on a schedule.
-- Edge functions: supabase/functions/ical-sync (import) and supabase/functions/ical (public export feed).
alter table public.listings add column ical_import_urls text[] not null default '{}';
alter table public.listings add column ical_synced_at timestamptz;
alter table public.listings add column ical_sync_error text;
alter table public.blocked_dates add column source text not null default 'host'; -- 'host' or 'sync'

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Every 30 minutes. Replace <ANON_KEY> with the project's anon (public) key when applying to a new project.
select cron.schedule('ical-sync', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://yghmjkeqsnfbntbobvfx.supabase.co/functions/v1/ical-sync',
    headers := jsonb_build_object('Authorization', 'Bearer <ANON_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$$);
