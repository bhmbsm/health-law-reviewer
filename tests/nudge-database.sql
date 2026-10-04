begin;
do $test$
declare
  ids uuid[]; result jsonb; dash jsonb; inbox bigint; i integer;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select array_agg(gen_random_uuid()) into ids from generate_series(1,18);
  for i in 1..18 loop
    insert into auth.users(id) values(ids[i]);
    insert into public.profiles(id,nickname,group_code) values(ids[i],'QA'||left(ids[i]::text,12),case when i=3 then 'NUDGE-QA-OTHER' else 'NUDGE-QA-'||ids[1]::text end);
  end loop;
  insert into public.attempts(id,user_id,case_id,mode,chapter,choice,correct,hint,duration,created)
    select gen_random_uuid(),u,'nudge-qa','free',0,true,true,false,1,now()
    from unnest(array[ids[1],ids[4],ids[5],ids[6],ids[7],ids[8],ids[9]]) u cross join generate_series(1,5);
  -- Previous day's attempts do not unlock sending today.
  insert into public.attempts(id,user_id,case_id,mode,chapter,choice,correct,hint,duration,created)
    select gen_random_uuid(),ids[2],'nudge-qa','free',0,true,true,false,1,(today::timestamp at time zone 'Asia/Seoul')-interval '1 second' from generate_series(1,5);
  if not (public.send_friend_nudge(ids[1],ids[1]) ? 'error') then raise exception 'self-send accepted'; end if;
  if not (public.send_friend_nudge(ids[1],ids[3]) ? 'error') then raise exception 'cross-group accepted'; end if;
  if not (public.send_friend_nudge(ids[2],ids[1]) ? 'error') then raise exception 'unfinished sender accepted'; end if;
  if not (public.send_friend_nudge(ids[1],ids[4]) ? 'error') then raise exception 'completed recipient accepted'; end if;
  result := public.send_friend_nudge(ids[1],ids[2]);
  if result ? 'error' then raise exception 'valid send rejected: %',result; end if;
  if not (public.send_friend_nudge(ids[1],ids[2]) ? 'error') then raise exception 'duplicate accepted'; end if;
  if (select count(*) from public.in_app_notifications where user_id=ids[2])<>1 then raise exception 'duplicate inbox'; end if;
  dash:=public.nudge_dashboard(ids[2]);
  if jsonb_array_length(dash->'received')<>1 or (dash->>'completedToday')::boolean then raise exception 'recipient dashboard incorrect'; end if;
  dash:=public.nudge_dashboard(ids[1]);
  if not (dash->>'completedToday')::boolean or not (dash->'sentToday' @> to_jsonb(array[ids[2]])) then raise exception 'sender dashboard incorrect'; end if;
  if exists(select 1 from jsonb_array_elements(dash->'friends') f where f->>'id'=ids[3]::text or f->>'id'=ids[1]::text) then raise exception 'friend scope leaked'; end if;
  -- Four more senders fill the recipient's daily cap.
  for i in 5..8 loop
    result:=public.send_friend_nudge(ids[i],ids[2]);
    if result ? 'error' then raise exception 'recipient cap too early'; end if;
  end loop;
  if not (public.send_friend_nudge(ids[9],ids[2]) ? 'error') then raise exception 'recipient daily cap failed'; end if;
  -- Original sender: one previous send plus nine = ten.
  for i in 10..18 loop
    result:=public.send_friend_nudge(ids[1],ids[i]);
    if result ? 'error' then raise exception 'sender cap too early'; end if;
  end loop;
  delete from public.attempts where user_id=ids[9];
  if not (public.send_friend_nudge(ids[1],ids[9]) ? 'error') then raise exception 'sender cap failed'; end if;
  if has_function_privilege('authenticated','public.send_friend_nudge(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.nudge_dashboard(uuid)','EXECUTE')
     or has_table_privilege('authenticated','public.friend_nudges','INSERT') then raise exception 'client privileges leaked'; end if;
end $test$;
rollback;
select 'PASS: valid send/inbox/dashboard, self/group/completion/day/duplicate checks, daily caps, client access restrictions. Fixtures rolled back.' as result;
