-- Apply after deploying the authenticated question-bank API.
-- Question payloads and all learning history remain unchanged.
begin;
drop policy if exists "anyone reads shared cases" on public.shared_cases;
drop policy if exists "registered users read shared cases" on public.shared_cases;
create policy "registered users read shared cases" on public.shared_cases
for select to authenticated
using (auth.uid() is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
revoke all on public.shared_cases from anon;
revoke all on public.shared_cases from public;
grant select on public.shared_cases to authenticated;
commit;
