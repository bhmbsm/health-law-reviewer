-- The trigger and notification outbox are verified without keeping test reports.
begin;
do $test$
declare admin_id uuid;member_id uuid;test_report_id uuid:=gen_random_uuid();n integer;denied boolean;
begin
 select p.id into admin_id from public.profiles p join auth.users u on u.id=p.id where p.is_admin and u.email_confirmed_at is not null limit 1;
 select p.id into member_id from public.profiles p join auth.users u on u.id=p.id where not p.is_admin and u.email_confirmed_at is not null limit 1;
 if admin_id is null or member_id is null then raise exception 'Need a verified administrator and member';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',member_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 insert into public.question_reports(id,reporter_id,case_id,message,case_snapshot) values(test_report_id,member_id,'email-test','Temporary outbox verification','{}');
 select count(*) into n from public.question_report_email_notifications where question_report_email_notifications.report_id=test_report_id;
 if n<>0 then raise exception 'Member can read private email queue';end if;
 denied:=false;
 begin update public.question_report_email_notifications set status='sent';exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Member can forge delivery status';end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 set local role authenticated;
 select count(*) into n from public.question_report_email_notifications q where q.report_id=test_report_id and q.status='pending';
 if n<>1 then raise exception 'New report did not enqueue exactly one email';end if;
 reset role;
 update public.question_report_email_notifications q set status='sending',claim_token=gen_random_uuid(),claimed_at=now(),attempts=1 where q.report_id=test_report_id;
 update public.question_report_email_notifications q set status='sent',sent_at=now(),gmail_message_id='test-receipt' where q.report_id=test_report_id;
 select count(*) into n from public.question_report_email_notifications q where q.report_id=test_report_id and (q.status='pending' or(q.status='sending' and q.claimed_at<now()-interval '2 hours'));
 if n<>0 then raise exception 'Sent report can be claimed again';end if;
end $test$;
rollback;
select 'Outbox verified: one email per report, private status, sent reports excluded; test data rolled back' as verification;
