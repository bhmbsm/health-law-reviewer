-- Read-only cross-user access, based on the protected existing admin profile flag.
-- Keep existing ownership policies for ordinary users and all write operations.
drop policy if exists "admins read all attempts" on public.attempts;
create policy "admins read all attempts" on public.attempts
for select to authenticated using ((select public.is_admin()));
grant select on public.attempts to authenticated;
