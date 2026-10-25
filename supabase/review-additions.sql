-- Manual review entries do not create or modify attempts.
create table if not exists public.review_additions (
 user_id uuid not null references auth.users(id) on delete cascade,
 case_id text not null,
 added_at timestamptz not null default now(),
 primary key(user_id,case_id)
);
alter table public.review_additions enable row level security;
create policy "users read own review additions" on public.review_additions for select to authenticated using ((select auth.uid())=user_id);
create policy "users add own review additions" on public.review_additions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "users update own review additions" on public.review_additions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.review_additions from anon;
grant select,insert,update on public.review_additions to authenticated;
