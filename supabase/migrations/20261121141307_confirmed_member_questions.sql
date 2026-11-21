-- Deploy the bearer-authenticated API first; no question data or attempts are removed.
drop policy if exists "anyone reads shared cases" on public.shared_cases;
drop policy if exists "guests read question payloads" on public.shared_cases;
drop policy if exists "registered users read shared cases" on public.shared_cases;
create policy "registered users read shared cases" on public.shared_cases for select to authenticated
 using ((select app_private.is_confirmed_member()));
-- Revoke both table and column grants: guest access previously used select(payload).
revoke all on public.shared_cases from public,anon;
revoke select(payload) on public.shared_cases from public,anon;
grant select on public.shared_cases to authenticated;
