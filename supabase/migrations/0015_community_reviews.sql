-- Community photo posts, trip reviews, and the "how was your trip?" request.
-- Works whether or not 0014 (customer messages) has been applied yet.

-- Photos for posts and reviews. Public to read; uploads limited to images up to 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Shown name on posts and reviews: first name and last initial ("Jason R.").
create or replace function public.short_name(full_name text) returns text language sql immutable as $$
  with w as (select regexp_split_to_array(btrim(coalesce(full_name, '')), '\s+') as a)
  select case
    when btrim(coalesce(full_name, '')) = '' then 'Guest'
    when array_length(a, 1) = 1 then a[1]
    else a[1] || ' ' || upper(left(a[array_length(a, 1)], 1)) || '.'
  end from w $$;

-- Admin switch: when 'true', new posts and reviews wait for an admin to show them.
insert into public.app_settings (key, value) values ('community_needs_approval', 'false') on conflict (key) do nothing;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  author_badge text,
  body text not null default '' check (length(body) <= 2000),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  listing_id uuid references public.listings(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (length(btrim(body)) > 0 or cardinality(photos) > 0)
);
create index if not exists posts_created_idx on public.posts (created_at desc);
alter table public.posts enable row level security;
create policy "read posts" on public.posts for select using (not hidden or author_id = auth.uid() or is_admin());
create policy "signed in can post" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "admin moderates posts" on public.posts for update using (is_admin()) with check (is_admin());
create policy "delete own posts" on public.posts for delete using (author_id = auth.uid() or is_admin());

-- Fill in the name and badge from the profile, and hold for approval when that switch is on.
create or replace function public.posts_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select full_name, role, team_type into p from profiles where id = new.author_id;
  new.author_name := short_name(p.full_name);
  new.author_badge := case when p.role = 'admin' then 'POC Premier Lodge' when p.role = 'partner' then (case when p.team_type = 'house_owner' then 'Host' else 'Guide' end) else null end;
  new.hidden := coalesce((select value from app_settings where key = 'community_needs_approval'), 'false') = 'true' and coalesce(p.role, '') <> 'admin';
  new.created_at := now();
  return new;
end $$;
create trigger posts_before_insert before insert on public.posts for each row execute function public.posts_before_insert();

-- Each booking gets a private review link (/review/<token>) that works with or without an account.
alter table public.bookings add column if not exists review_token uuid not null default gen_random_uuid();
alter table public.bookings add column if not exists review_asked_at timestamptz;
create unique index if not exists bookings_review_token_idx on public.bookings (review_token);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  stars int not null check (stars between 1 and 5),
  body text not null default '' check (length(body) <= 3000),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reviews_listing_idx on public.reviews (listing_id, created_at desc);
alter table public.reviews enable row level security;
create policy "read reviews" on public.reviews for select using (not hidden or is_admin());
create policy "admin moderates reviews" on public.reviews for update using (is_admin()) with check (is_admin());
create policy "admin deletes reviews" on public.reviews for delete using (is_admin());
-- Reviews are only written through submit_review below.

-- A trip can be reviewed once it's confirmed and its day has come.
create or replace function public.review_token_ok(p_token text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bookings where review_token::text = p_token and status = 'accepted' and start_date <= current_date)
$$;

create or replace function public.review_info(p_token uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'listing_title', l.title, 'listing_slug', l.slug, 'listing_kind', l.kind, 'start_date', b.start_date, 'end_date', b.end_date,
    'name', b.guest_name, 'ready', b.status = 'accepted' and b.start_date <= current_date, 'status', b.status,
    'review', (select to_jsonb(r) - 'booking_id' - 'author_id' from reviews r where r.booking_id = b.id))
  from bookings b join listings l on l.id = b.listing_id where b.review_token = p_token
$$;

create or replace function public.submit_review(p_token uuid, p_stars int, p_body text, p_photos text[], p_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare b record; rid uuid; prefix text := '%/storage/v1/object/public/community/reviews/' || p_token::text || '/%'; ph text;
  v_name text;
begin
  select * into b from bookings where review_token = p_token;
  if not found then raise exception 'This review link is not valid.'; end if;
  if b.status <> 'accepted' or b.start_date > current_date then raise exception 'You can review this trip once it has happened.'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'Pick 1 to 5 stars.'; end if;
  if length(coalesce(p_body, '')) > 3000 then raise exception 'Keep the review under 3,000 characters.'; end if;
  if cardinality(coalesce(p_photos, '{}')) > 6 then raise exception 'Up to 6 photos.'; end if;
  foreach ph in array coalesce(p_photos, '{}') loop
    if ph not like prefix then raise exception 'Photo upload problem. Try adding the photo again.'; end if;
  end loop;
  v_name := short_name(coalesce(nullif(btrim(coalesce(p_name, '')), ''), (select full_name from profiles where id = b.guest_id), b.guest_name));
  insert into reviews (booking_id, listing_id, author_id, author_name, stars, body, photos, hidden)
  values (b.id, b.listing_id, b.guest_id, v_name, p_stars, btrim(coalesce(p_body, '')), coalesce(p_photos, '{}'),
          coalesce((select value from app_settings where key = 'community_needs_approval'), 'false') = 'true')
  on conflict (booking_id) do update set stars = excluded.stars, body = excluded.body, photos = excluded.photos,
    author_name = excluded.author_name, updated_at = now()
  returning id into rid;
  return rid;
end $$;

revoke all on function public.review_info(uuid) from public;
revoke all on function public.submit_review(uuid, int, text, text[], text) from public;
revoke all on function public.review_token_ok(text) from public;
grant execute on function public.review_info(uuid) to anon, authenticated;
grant execute on function public.submit_review(uuid, int, text, text[], text) to anon, authenticated;
grant execute on function public.review_token_ok(text) to anon, authenticated;

-- Uploads: signed-in people into posts/<their id>/, anyone holding a valid review link into reviews/<token>/.
create policy "community post photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = 'posts' and (storage.foldername(name))[2] = auth.uid()::text);
create policy "community review photos" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'community' and (storage.foldername(name))[1] = 'reviews' and public.review_token_ok((storage.foldername(name))[2]));

-- The day after a confirmed trip (or checkout), ask for a review. Account holders get an in-app notice (texted once Twilio
-- is set up); guests without an account are messaged at their email and phone once 0014 is in.
create or replace function public.ask_for_reviews() returns int language plpgsql security definer set search_path = public as $$
declare b record; n int := 0; guest_cols boolean;
  v_title text := 'How was your trip?';
begin
  guest_cols := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'notifications' and column_name = 'to_email');
  for b in
    select bk.*, l.title as listing_title from bookings bk join listings l on l.id = bk.listing_id
    where bk.status = 'accepted' and bk.review_asked_at is null
      and bk.end_date < current_date and bk.end_date >= current_date - 14
      and not exists (select 1 from reviews r where r.booking_id = bk.id)
  loop
    if b.guest_id is not null then
      insert into notifications (user_id, title, body, link, booking_id, sms)
      values (b.guest_id, v_title, format('Thanks for coming out with us! Tell us how %s went: give it stars, write a few words and add your photos.', b.listing_title),
              '/review/' || b.review_token, b.id, true);
    elsif guest_cols then
      execute 'insert into notifications (user_id, to_email, to_phone, title, body, link, booking_id, sms) values (null, $1, $2, $3, $4, $5, $6, $7)'
        using b.guest_email, b.guest_phone, v_title,
              format('Thanks for coming out with us! Tell us how %s went: give it stars, write a few words and add your photos.', b.listing_title),
              '/review/' || b.review_token, b.id, b.guest_phone is not null;
    else
      continue;
    end if;
    update bookings set review_asked_at = now() where id = b.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.ask_for_reviews() from public;

-- Every day at 6 PM Texas time (23:00 UTC).
select cron.schedule('review-requests', '0 23 * * *', 'select public.ask_for_reviews()');
