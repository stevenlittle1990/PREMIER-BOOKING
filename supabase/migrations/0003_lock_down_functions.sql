-- Trigger functions are never called directly; invites need a signed-in user.
-- is_admin/is_host stay callable because row-level security policies use them; listing_busy_days is public on purpose.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_role() from public, anon, authenticated;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;
