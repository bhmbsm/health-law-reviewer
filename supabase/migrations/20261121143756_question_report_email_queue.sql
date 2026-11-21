-- Durable outbox for the connected Gmail dispatcher. Report submission never waits for email.
create table public.question_report_email_notifications (
 report_id uuid primary key references public.question_reports(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','sending','sent')),
 gmail_message_id text,
 sent_at timestamptz,
 claimed_at timestamptz,
 claim_token uuid,
 attempts integer not null default 0 check(attempts>=0),
 last_error text,
 created_at timestamptz not null default now(),
 constraint report_email_sent_receipt check(status<>'sent' or (sent_at is not null and gmail_message_id is not null))
);
create index question_report_email_pending_idx on public.question_report_email_notifications(status,created_at);
alter table public.question_report_email_notifications enable row level security;
revoke all on public.question_report_email_notifications from public,anon,authenticated;
grant select on public.question_report_email_notifications to authenticated;
create policy "admins read report email status" on public.question_report_email_notifications for select to authenticated
 using ((select app_private.is_confirmed_member()) and (select public.is_admin()));

create or replace function app_private.enqueue_question_report_email()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if (select auth.uid()) is distinct from new.reporter_id then
  raise exception 'Only the authenticated reporter may enqueue a notification' using errcode='42501';
 end if;
 insert into public.question_report_email_notifications(report_id) values(new.id);
 return new;
end;
$$;
revoke all on function app_private.enqueue_question_report_email() from public,anon,authenticated;
create trigger queue_question_report_email after insert on public.question_reports
 for each row execute function app_private.enqueue_question_report_email();

-- Existing reports receive one notification too; the primary key prevents duplicate queue rows.
insert into public.question_report_email_notifications(report_id)
 select id from public.question_reports on conflict(report_id) do nothing;
notify pgrst,'reload schema';
