-- Preserve profile access while preventing ordinary accounts from changing admin status.
revoke insert, update on public.profiles from authenticated;
grant insert (id, nickname, group_code) on public.profiles to authenticated;
grant update (nickname, group_code) on public.profiles to authenticated;
