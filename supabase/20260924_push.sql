create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_test_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.in_app_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists in_app_notifications_user_idx on public.in_app_notifications(user_id,created_at desc);
alter table public.in_app_notifications enable row level security;
create policy "own notifications" on public.in_app_notifications for select to authenticated using (auth.uid()=user_id);
create policy "mark own notifications read" on public.in_app_notifications for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select on public.in_app_notifications to authenticated;
grant update (read_at) on public.in_app_notifications to authenticated;

create table if not exists public.notification_deliveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  study_day date not null,
  kind text not null check (kind in ('daily','test')),
  created_at timestamptz not null default now(),
  primary key (user_id,study_day,kind)
);
alter table public.notification_deliveries enable row level security;
