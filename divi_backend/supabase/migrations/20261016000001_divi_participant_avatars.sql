create or replace function public.get_divi_participant_avatars(p_divi_id uuid)
returns table (participant_id uuid, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select dp.id, p.avatar_url
  from public.divi_participants dp
  left join public.profiles p on p.id = dp.user_id
  where dp.divi_id = p_divi_id
    and public.can_access_divi(p_divi_id);
$$;

revoke all on function public.get_divi_participant_avatars(uuid) from public;
grant execute on function public.get_divi_participant_avatars(uuid) to authenticated;
