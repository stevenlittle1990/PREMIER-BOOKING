-- Guest checkout: someone can send an inquiry with just name, email and phone, no account.
-- Bookings go in with no guest_id; the admin sees them like any other request (the insert trigger notifies).
-- Checks keep it from being used to flood the inbox: published listings only, sane dates and sizes, and a rate limit.
create or replace function public.guest_inquiry(p_items jsonb, p_name text, p_email text, p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb;
  grp uuid := null;
  n int := 0;
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

revoke all on function public.guest_inquiry(jsonb, text, text, text) from public;
grant execute on function public.guest_inquiry(jsonb, text, text, text) to anon, authenticated;
