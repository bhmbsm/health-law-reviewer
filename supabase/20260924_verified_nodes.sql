-- Apply after schema.sql and admin-migration.sql.
-- Only administrator-reviewed nodes are served to learners.
create table if not exists public.verified_nodes (
  id text primary key,
  law text not null,
  article text not null,
  point text not null,
  criterion_type text not null check (criterion_type in ('주체','기간','수량','조건','예외','절차')),
  passing_rule text not null,
  case_template text not null check (position('{{value}}' in case_template) > 0),
  fixed_details jsonb not null default '[]'::jsonb,
  variants jsonb not null,
  source text not null,
  importance text not null check (importance in ('핵심','일반','심화')),
  chapter integer not null check (chapter between 1 and 12),
  sender text not null,
  review_status text not null default 'needs_review' check (review_status in ('verified','needs_review')),
  reviewer text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.verified_nodes enable row level security;
create policy "read verified nodes" on public.verified_nodes
  for select to anon, authenticated using (review_status = 'verified');
create policy "admins add nodes" on public.verified_nodes
  for insert to authenticated with check (public.is_admin());
create policy "admins update nodes" on public.verified_nodes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.verified_nodes to anon, authenticated;
grant insert, update on public.verified_nodes to authenticated;
