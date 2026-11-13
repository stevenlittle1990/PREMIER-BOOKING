-- Role changes from the app need an admin; changes from the Supabase dashboard/SQL editor (no signed-in user) are allowed.
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;

-- Emails that get a role the moment they first sign in (used for the main administrator).
create table public.preset_roles (
  email text primary key,
  role text not null check (role in ('admin', 'partner'))
);
alter table public.preset_roles enable row level security;
create policy "admin preset roles" on public.preset_roles for all using (is_admin()) with check (is_admin());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce((select role from preset_roles where lower(email) = lower(new.email)), 'guest'))
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.preset_roles (email, role) values ('pocpremierlodge@gmail.com', 'admin');
update public.profiles set role = 'admin' where lower(email) = 'pocpremierlodge@gmail.com';
