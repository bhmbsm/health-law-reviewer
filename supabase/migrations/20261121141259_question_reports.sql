-- Trusted verification is read from Auth, never from editable user_metadata.
create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;
create or replace function app_private.is_confirmed_member()
returns boolean language sql stable security definer set search_path = ''
as $$
 select (select auth.uid()) is not null
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false)=false
  and exists(select 1 from auth.users u where u.id=(select auth.uid())
   and u.email_confirmed_at is not null and coalesce(u.is_anonymous,false)=false);
$$;
revoke all on function app_private.is_confirmed_member() from public, anon;
grant execute on function app_private.is_confirmed_member() to authenticated;

create table public.question_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 case_id text not null check (char_length(case_id) between 1 and 300),
 message text not null check (char_length(btrim(message)) between 1 and 2000),
 case_snapshot jsonb not null check (jsonb_typeof(case_snapshot)='object' and octet_length(case_snapshot::text)<=131072),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
create index question_reports_status_created_idx on public.question_reports(status,created_at desc,id);
create index question_reports_created_idx on public.question_reports(created_at desc,id);
create index question_reports_reporter_idx on public.question_reports(reporter_id);
alter table public.question_reports enable row level security;
revoke all on public.question_reports from public,anon,authenticated;
grant insert(id,reporter_id,case_id,message,case_snapshot), select on public.question_reports to authenticated;
grant update(status) on public.question_reports to authenticated;
create policy "confirmed members submit own reports" on public.question_reports for insert to authenticated
 with check ((select app_private.is_confirmed_member()) and reporter_id=(select auth.uid()));
-- Reporters cannot read even their own submitted message; only the administrator can.
create policy "admins read question reports" on public.question_reports for select to authenticated
 using ((select app_private.is_confirmed_member()) and (select public.is_admin()));
create policy "admins resolve question reports" on public.question_reports for update to authenticated
 using ((select app_private.is_confirmed_member()) and (select public.is_admin()))
 with check ((select app_private.is_confirmed_member()) and (select public.is_admin()));

-- Preserve the existing protection against assigning oneself administrator status.
revoke insert,update on public.profiles from authenticated;
grant insert(id,nickname,group_code),update(nickname,group_code) on public.profiles to authenticated;
