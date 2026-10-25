-- Email stays in auth.users. Only the existing protected admin role may read it.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.admin_study_profiles()
returns table(id uuid,nickname text,group_code text,email text)
language plpgsql stable security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.is_admin() then
  raise exception '관리자만 사용자 이메일을 조회할 수 있습니다.' using errcode='42501';
 end if;
 return query
  select p.id,p.nickname,p.group_code,u.email::text
  from public.profiles p left join auth.users u on u.id=p.id;
end;
$$;
revoke all on function private.admin_study_profiles() from public,anon,authenticated;
grant execute on function private.admin_study_profiles() to authenticated;
create or replace function public.admin_study_profiles()
returns table(id uuid,nickname text,group_code text,email text)
language sql stable security invoker set search_path=''
as $$select * from private.admin_study_profiles();$$;
revoke all on function public.admin_study_profiles() from public,anon,authenticated;
grant execute on function public.admin_study_profiles() to authenticated;
notify pgrst,'reload schema';