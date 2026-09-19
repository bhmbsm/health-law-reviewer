-- 관리자 전용 문항 관리 기능 추가
alter table public.profiles add column if not exists is_admin boolean not null default false;

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
