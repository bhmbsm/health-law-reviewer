create table public.friend_nudges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  study_day date not null,
  sender_name text not null,
  notification_id bigint not null references public.in_app_notifications(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friend_nudges_not_self check (sender_id <> recipient_id),
  constraint friend_nudges_daily_unique unique (sender_id, recipient_id, study_day)
);
create index friend_nudges_recipient_day on public.friend_nudges(recipient_id,study_day);
create index friend_nudges_sender_day on public.friend_nudges(sender_id,study_day);
create index if not exists attempts_user_created_nudge on public.attempts(user_id,created);
alter table public.friend_nudges enable row level security;
revoke all on public.friend_nudges from public,anon,authenticated;
grant all on public.friend_nudges to service_role;

-- Invoked only by server routes AFTER auth.getUser validates the caller.
-- SECURITY INVOKER preserves normal role privileges; no client may call these RPCs.
create function public.nudge_dashboard(p_user_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  day_start timestamptz := today::timestamp at time zone 'Asia/Seoul';
  day_end timestamptz := (today+1)::timestamp at time zone 'Asia/Seoul';
  code text;
begin
  select p.group_code into code from public.profiles p where p.id=p_user_id;
  return jsonb_build_object(
    'groupCode',coalesce(code,''),
    'completedToday',(select count(*)>=5 from public.attempts a where a.user_id=p_user_id and a.created>=day_start and a.created<day_end),
    'friends',coalesce((
      select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,
        'solvedToday',(select count(*) from public.attempts a where a.user_id=p.id and a.created>=day_start and a.created<day_end)) order by p.nickname)
      from public.profiles p where p.id<>p_user_id and p.group_code=code and coalesce(btrim(code),'')<>''
    ),'[]'::jsonb),
    'sentToday',coalesce((select jsonb_agg(n.recipient_id) from public.friend_nudges n where n.sender_id=p_user_id and n.study_day=today),'[]'::jsonb),
    'received',coalesce((
      select jsonb_agg(jsonb_build_object('id',n.id,'senderName',n.sender_name,'message',i.body,'createdAt',n.created_at) order by n.created_at desc)
      from public.friend_nudges n join public.in_app_notifications i on i.id=n.notification_id
      where n.recipient_id=p_user_id and n.study_day=today
    ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.nudge_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.nudge_dashboard(uuid) to service_role;

create function public.send_friend_nudge(p_sender uuid,p_recipient uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  day_start timestamptz := today::timestamp at time zone 'Asia/Seoul';
  day_end timestamptz := (today+1)::timestamp at time zone 'Asia/Seoul';
  sender_code text; recipient_code text; nickname text; inbox_id bigint;
  title text; body text := '오늘 학습 5건, 같이 마무리해요! 😊';
begin
  if p_sender is null or p_recipient is null or p_sender=p_recipient then
    return jsonb_build_object('error','자신에게는 찌르기를 보낼 수 없습니다.');
  end if;
  -- Serialize sends involving either user, including simultaneous requests.
  perform p.id from public.profiles p where p.id in (p_sender,p_recipient) order by p.id for update;
  select p.group_code,p.nickname into sender_code,nickname from public.profiles p where p.id=p_sender;
  select p.group_code into recipient_code from public.profiles p where p.id=p_recipient;
  if coalesce(btrim(sender_code),'')='' or sender_code is distinct from recipient_code then
    return jsonb_build_object('error','같은 그룹의 친구에게만 보낼 수 있습니다.');
  end if;
  if (select count(*) from public.attempts a where a.user_id=p_sender and a.created>=day_start and a.created<day_end)<5 then
    return jsonb_build_object('error','오늘 학습 5건을 먼저 완료해 주세요.');
  end if;
  if (select count(*) from public.attempts a where a.user_id=p_recipient and a.created>=day_start and a.created<day_end)>=5 then
    return jsonb_build_object('error','친구가 이미 오늘 학습을 완료했습니다.');
  end if;
  if exists(select 1 from public.friend_nudges n where n.sender_id=p_sender and n.recipient_id=p_recipient and n.study_day=today) then
    return jsonb_build_object('error','이 친구에게는 오늘 이미 보냈습니다.');
  end if;
  if (select count(*) from public.friend_nudges n where n.sender_id=p_sender and n.study_day=today)>=10 then
    return jsonb_build_object('error','오늘은 찌르기를 10번 모두 보냈습니다.');
  end if;
  if (select count(*) from public.friend_nudges n where n.recipient_id=p_recipient and n.study_day=today)>=5 then
    return jsonb_build_object('error','이 친구가 오늘 받을 수 있는 응원을 모두 받았습니다.');
  end if;
  title := '😊 '||nickname||'님이 콕 찔렀어요!';
  insert into public.in_app_notifications(user_id,title,body,url)
    values(p_recipient,title,body,'/?screen=today') returning id into inbox_id;
  insert into public.friend_nudges(sender_id,recipient_id,study_day,sender_name,notification_id)
    values(p_sender,p_recipient,today,nickname,inbox_id);
  return jsonb_build_object('title',title,'body',body);
end;
$$;
revoke all on function public.send_friend_nudge(uuid,uuid) from public,anon,authenticated;
grant execute on function public.send_friend_nudge(uuid,uuid) to service_role;
