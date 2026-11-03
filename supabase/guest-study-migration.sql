-- Re-enable guest learning. Only the educational payload column is public.
-- Account records, profiles, review state, administrator access and writes are unchanged.
begin;
drop policy if exists "guests read question payloads" on public.shared_cases;
create policy "guests read question payloads" on public.shared_cases
for select to anon using (true);
grant select(payload) on public.shared_cases to anon;
commit;
