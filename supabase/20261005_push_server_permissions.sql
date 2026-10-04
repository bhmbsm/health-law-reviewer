-- Notification tables are accessed by trusted server routes using service_role.
-- Keep push subscriptions and delivery claims unavailable to ordinary clients.
grant usage on schema public to service_role;
grant all privileges on public.push_subscriptions,
  public.in_app_notifications, public.notification_deliveries to service_role;
grant usage, select on sequence public.in_app_notifications_id_seq to service_role;
