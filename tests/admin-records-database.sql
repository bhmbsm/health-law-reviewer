begin;
drop policy if exists "admins read all attempts" on public.attempts;
create policy "admins read all attempts" on public.attempts for select to authenticated using ((select public.is_admin()));
insert into auth.users(id) values ('aaaa0000-0000-4000-8000-000000000001');
insert into public.profiles(id,nickname) values ('aaaa0000-0000-4000-8000-000000000001','관리자기록검증임시');
insert into public.attempts(id,user_id,case_id,mode,chapter,choice,correct,hint,duration) values ('aaaa0000-0000-4000-8000-000000000002','aaaa0000-0000-4000-8000-000000000001','admin-access-test','free',0,true,true,false,10);
set local role authenticated;
select set_config('request.jwt.claim.sub','12ef806e-e3ea-4e2f-8159-a04c4f87f500',true);
do $$ begin
if not public.is_admin() then raise exception 'Admin check failed'; end if;
if not exists(select 1 from public.attempts where user_id='aaaa0000-0000-4000-8000-000000000001') then raise exception 'Admin cannot read another user'; end if;
end $$;
select set_config('request.jwt.claim.sub','aaaa0000-0000-4000-8000-000000000001',true);
do $$ begin
if public.is_admin() then raise exception 'Ordinary user considered admin'; end if;
if (select count(*) from public.attempts)<>1 then raise exception 'Ordinary user sees other records'; end if;
begin update public.profiles set is_admin=true where id=auth.uid(); raise exception 'Admin escalation possible'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
begin if exists(select 1 from public.attempts) then raise exception 'Anonymous record exposure'; end if; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'passed: admin cross-user read, owner isolation, anonymous denial, admin flag protection; fixtures rolled back' as verification;
