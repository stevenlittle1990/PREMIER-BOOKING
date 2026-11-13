-- Policy helper functions only make sense for signed-in users.
revoke execute on function public.hosts_booking(uuid) from public, anon;
revoke execute on function public.is_assigned(uuid) from public, anon;
grant execute on function public.hosts_booking(uuid) to authenticated;
grant execute on function public.is_assigned(uuid) to authenticated;
