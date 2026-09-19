-- 관리자 전용 문항 관리 기능 추가
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists group_code text;

create table if not exists public.shared_cases (
  id text primary key check (id like 'custom-%'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_cases enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "anyone reads shared cases" on public.shared_cases;
drop policy if exists "admins add shared cases" on public.shared_cases;
drop policy if exists "admins update shared cases" on public.shared_cases;
drop policy if exists "admins delete shared cases" on public.shared_cases;

create policy "anyone reads shared cases" on public.shared_cases
for select to anon, authenticated using (true);
create policy "admins add shared cases" on public.shared_cases
for insert to authenticated with check (public.is_admin());
create policy "admins update shared cases" on public.shared_cases
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete shared cases" on public.shared_cases
for delete to authenticated using (public.is_admin());

grant select on public.shared_cases to anon, authenticated;
grant insert, update, delete on public.shared_cases to authenticated;
grant execute on function public.is_admin() to authenticated;

create or replace function public.friend_leaderboard()
returns table(nickname text, solved bigint, correct bigint, accuracy numeric)
language sql
security definer
set search_path = public
as $$
  select p.nickname,
    count(a.id) as solved,
    count(a.id) filter (where a.correct) as correct,
    round(100.0 * count(a.id) filter (where a.correct) / nullif(count(a.id), 0), 1) as accuracy
  from public.profiles p
  join public.attempts a on a.user_id = p.id
  where p.group_code is not null
    and p.group_code = (select group_code from public.profiles where id = auth.uid())
  group by p.id, p.nickname
  order by correct desc, accuracy desc, solved desc
  limit 50;
$$;

grant execute on function public.friend_leaderboard() to authenticated;
