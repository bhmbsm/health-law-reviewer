begin;
insert into auth.users(id) values ('aaaa1111-0000-4000-8000-000000000001'),('aaaa1111-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaa1111-0000-4000-8000-000000000001',true);
insert into public.review_additions(user_id,case_id,added_at) values (auth.uid(),'manual-review-test','2026-10-25 12:00:00+00');
insert into public.review_additions(user_id,case_id,added_at) values (auth.uid(),'manual-review-test','2026-10-25 12:01:00+00') on conflict(user_id,case_id) do update set added_at=excluded.added_at;
do $$ begin
 if not exists(select 1 from public.review_additions where case_id='manual-review-test' and added_at='2026-10-25 12:01:00+00') then raise exception 'Owner upsert failed'; end if;
 begin
 insert into public.review_additions(user_id,case_id) values ('aaaa1111-0000-4000-8000-000000000002','foreign-review-test');
 raise exception 'Cross-user insert allowed';
 exception when insufficient_privilege then null; end;
 begin
 update public.review_additions set user_id='aaaa1111-0000-4000-8000-000000000002' where case_id='manual-review-test';
 raise exception 'Owner can transfer entry to another user';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','aaaa1111-0000-4000-8000-000000000002',true);
do $$ declare changed integer; begin
 if exists(select 1 from public.review_additions where case_id='manual-review-test') then raise exception 'Cross-user read allowed'; end if;
 update public.review_additions set added_at=now() where case_id='manual-review-test';
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Cross-user update allowed'; end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
 perform 1 from public.review_additions;
 raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.review_additions(user_id,case_id) values ('aaaa1111-0000-4000-8000-000000000001','anonymous-test');
 raise exception 'Anonymous insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'passed: owner upsert, cross-user select/insert/update denied, ownership transfer denied, anonymous access denied; test data rolled back' as verification;
