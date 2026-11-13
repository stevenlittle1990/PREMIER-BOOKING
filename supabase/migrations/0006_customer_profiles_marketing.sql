-- Customer profiles: contact details and opt-in for deals by email and text, with when they agreed.
alter table public.profiles
  add column home_city text,
  add column marketing_email boolean not null default false,
  add column marketing_sms boolean not null default false,
  add column marketing_email_at timestamptz,
  add column marketing_sms_at timestamptz,
  add column last_booking_at timestamptz;

create or replace function public.stamp_marketing_consent() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.marketing_email is distinct from coalesce(old.marketing_email, false) then new.marketing_email_at = now(); end if;
  if new.marketing_sms is distinct from coalesce(old.marketing_sms, false) then new.marketing_sms_at = now(); end if;
  return new;
end $$;
create trigger profiles_stamp_consent before insert or update on public.profiles
  for each row execute function public.stamp_marketing_consent();
revoke execute on function public.stamp_marketing_consent() from public, anon, authenticated;

create or replace function public.touch_last_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set last_booking_at = now() where id = new.guest_id;
  return new;
end $$;
create trigger bookings_touch_profile after insert on public.bookings
  for each row execute function public.touch_last_booking();
revoke execute on function public.touch_last_booking() from public, anon, authenticated;
