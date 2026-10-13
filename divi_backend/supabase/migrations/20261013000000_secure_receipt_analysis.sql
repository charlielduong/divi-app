-- Restrict receipt-analysis creation to a validated, rate-limited RPC.
revoke all on public.receipt_parse_attempts from anon, authenticated;
grant select on public.receipt_parse_attempts to authenticated;

drop policy if exists "users can create their receipt parse attempts"
  on public.receipt_parse_attempts;

create or replace function public.begin_receipt_parse_attempt(
  p_divi_id uuid default null
)
returns table (
  attempt_id uuid,
  source_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attempt_id uuid := gen_random_uuid();
  v_source_key text;
  v_recent_attempts integer;
  v_daily_attempts integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to analyze a receipt'
      using errcode = '42501';
  end if;

  -- Serialize quota checks per user so parallel requests cannot race the limits.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if p_divi_id is not null and not public.can_manage_divi(p_divi_id) then
    raise exception 'Divi not found or not owned by the current user'
      using errcode = '42501';
  end if;

  select
    count(*) filter (where created_at >= now() - interval '10 minutes'),
    count(*) filter (where created_at >= now() - interval '24 hours')
  into v_recent_attempts, v_daily_attempts
  from public.receipt_parse_attempts
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';

  if v_recent_attempts >= 10 or v_daily_attempts >= 50 then
    raise exception 'Receipt analysis rate limit exceeded. Please try again later.'
      using errcode = 'P0001';
  end if;

  v_source_key := format(
    'incoming/%s/%s/receipt.jpg',
    v_user_id,
    v_attempt_id
  );

  insert into public.receipt_parse_attempts (
    id,
    user_id,
    divi_id,
    status,
    source_key,
    source_file_name,
    source_content_type
  ) values (
    v_attempt_id,
    v_user_id,
    p_divi_id,
    'uploading',
    v_source_key,
    'receipt.jpg',
    'image/jpeg'
  );

  return query select v_attempt_id, v_source_key;
end;
$$;

revoke all on function public.begin_receipt_parse_attempt(uuid)
  from public, anon;
grant execute on function public.begin_receipt_parse_attempt(uuid)
  to authenticated;
