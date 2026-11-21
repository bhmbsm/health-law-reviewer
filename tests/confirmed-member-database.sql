-- Run after the authenticated API and confirmed_member_questions migration are deployed.
begin;
do $test$
declare member_id uuid; n integer; denied boolean;
begin
 if has_column_privilege('anon','public.shared_cases','payload','SELECT') then
  raise exception 'Guest retains question payload access';
 end if;
 select id into member_id from auth.users where email_confirmed_at is not null and not is_anonymous limit 1;
 if member_id is null then raise exception 'Need a verified member';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 select count(*) into n from public.shared_cases;
 if n=0 then raise exception 'Verified member cannot read existing banks';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',true)::text,true);
 set local role authenticated;
 select count(*) into n from public.shared_cases;
 if n<>0 then raise exception 'Anonymous identity can read banks';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000000','role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 select count(*) into n from public.shared_cases;
 if n<>0 then raise exception 'Unverified identity can read banks';end if;
 reset role;
 set local role anon;
 denied:=false;
 begin perform payload from public.shared_cases;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Guest can query banks';end if;
 reset role;
end $test$;
rollback;
select 'Verified member access preserved; guests, anonymous and unverified identities blocked' as verification;
