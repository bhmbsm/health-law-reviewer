-- Apply in Supabase SQL Editor before enabling the campaign progress UI.
-- RLS restricts rows; column grants prevent users from setting is_admin.
revoke insert, update on public.profiles from authenticated;
grant insert (id, nickname, group_code) on public.profiles to authenticated;
grant update (nickname, group_code) on public.profiles to authenticated;

create table if not exists public.campaign_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_chapter integer not null default 1 check (current_chapter between 1 and 12),
  chapter_progress jsonb not null default '{}'::jsonb,
  chapter_correct jsonb not null default '{}'::jsonb,
  experience integer not null default 0 check (experience >= 0),
  judgment integer not null default 0 check (judgment >= 0),
  trust integer not null default 0 check (trust >= 0),
  rank text not null default '수습 심사관',
  unlocked_chapters integer[] not null default array[1],
  wrong_nodes text[] not null default '{}',
  last_study_date date,
  updated_at timestamptz not null default now()
);
alter table public.campaign_progress enable row level security;
drop policy if exists "read own campaign progress" on public.campaign_progress;
drop policy if exists "insert own campaign progress" on public.campaign_progress;
drop policy if exists "update own campaign progress" on public.campaign_progress;
create policy "read own campaign progress" on public.campaign_progress for select to authenticated using (auth.uid() = user_id);
create policy "insert own campaign progress" on public.campaign_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "update own campaign progress" on public.campaign_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.campaign_progress to authenticated;
