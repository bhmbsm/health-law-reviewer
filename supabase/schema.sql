create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 2 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  mode text not null check (mode in ('story','free','review','audit')),
  chapter integer not null check (chapter between 0 and 4),
  choice boolean not null,
  correct boolean not null,
  hint boolean not null default false,
  duration integer not null check (duration between 0 and 86400),
  created timestamptz not null default now()
);

create table if not exists public.custom_cases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.custom_cases enable row level security;

create policy "profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users read own attempts" on public.attempts for select to authenticated using (auth.uid() = user_id);
create policy "users add own attempts" on public.attempts for insert to authenticated with check (auth.uid() = user_id);
create policy "users read own custom cases" on public.custom_cases for select to authenticated using (auth.uid() = user_id);
create policy "users add own custom cases" on public.custom_cases for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own custom cases" on public.custom_cases for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.leaderboard()
returns table(nickname text, solved bigint, correct bigint, accuracy numeric)
language sql security definer set search_path = public
as $$
  select p.nickname, count(a.id), count(a.id) filter (where a.correct),
    round(100.0 * count(a.id) filter (where a.correct) / nullif(count(a.id), 0), 1)
  from public.profiles p join public.attempts a on a.user_id = p.id
  group by p.id, p.nickname
  order by
    count(a.id) filter (where a.correct) desc,
    round(100.0 * count(a.id) filter (where a.correct) / nullif(count(a.id), 0), 1) desc,
    count(a.id) desc
  limit 50;
$$;
grant execute on function public.leaderboard() to authenticated;
