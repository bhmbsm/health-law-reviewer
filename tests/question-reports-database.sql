-- Run against the connected project. All temporary reports are rolled back.
begin;
do $test$
declare admin_id uuid; member_id uuid; report_id uuid:=gen_random_uuid(); n integer; denied boolean;
begin
 select p.id into admin_id from public.profiles p join auth.users u on u.id=p.id
  where p.is_admin and u.email_confirmed_at is not null limit 1;
 select p.id into member_id from public.profiles p join auth.users u on u.id=p.id
  where not p.is_admin and u.email_confirmed_at is not null and not u.is_anonymous limit 1;
 if admin_id is null or member_id is null then raise exception 'Need an existing verified administrator and member to verify access';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 insert into public.question_reports(id,reporter_id,case_id,message,case_snapshot)
  values(report_id,member_id,'rls-test','Temporary access verification','{"body":"test"}');
 select count(*) into n from public.question_reports where id=report_id;
 if n<>0 then raise exception 'Member could read a report';end if;
 update public.question_reports set status='resolved' where id=report_id;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Member could resolve a report';end if;
 denied:=false;
 begin
  insert into public.question_reports(reporter_id,case_id,message,case_snapshot) values(admin_id,'rls-test','spoof','{}');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Member could impersonate a reporter';end if;
 denied:=false;
 begin
  update public.question_reports set message='changed' where id=report_id;
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Report message could be modified';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 select count(*) into n from public.question_reports where id=report_id and status='open';
 if n<>1 then raise exception 'Administrator could not read the report';end if;
 update public.question_reports set status='resolved' where id=report_id;
 get diagnostics n=row_count;
 if n<>1 then raise exception 'Administrator could not resolve the report';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',true)::text,true);
 set local role authenticated;
 denied:=false;
 begin
  insert into public.question_reports(reporter_id,case_id,message,case_snapshot) values(member_id,'rls-test','anonymous','{}');
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous identity could submit a report';end if;
 reset role;
 set local role anon;
 denied:=false;
 begin perform 1 from public.question_reports;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Guest could read reports';end if;
 reset role;
end $test$;
rollback;
select 'Report access verified: member submits, administrator reads/resolves, anonymous blocked; test data rolled back' as verification;
