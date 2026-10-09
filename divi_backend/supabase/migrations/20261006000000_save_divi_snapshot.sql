-- Persist one complete Divi snapshot atomically.
-- The function intentionally rebuilds the child rows for the Divi so removed
-- claims, items, participants, and allocations cannot remain behind.
create or replace function public.save_divi_snapshot(p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_requested_id uuid;
  v_divi_id uuid;
  v_creator_id uuid;
  v_receipt_id uuid;
  v_participant_id uuid;
  v_item_id uuid;
  v_claimant_key text;
  v_participant_map jsonb := '{}'::jsonb;
  v_kept_participants uuid[] := '{}'::uuid[];
  v_participant jsonb;
  v_item jsonb;
  v_adjustment jsonb;
  v_allocation jsonb;
  v_kind text;
  v_sort_order integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to save a Divi';
  end if;

  if coalesce(trim(p_snapshot ->> 'title'), '') = '' then
    raise exception 'A Divi title is required';
  end if;

  if p_snapshot ? 'id'
     and p_snapshot ->> 'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_requested_id := (p_snapshot ->> 'id')::uuid;
    select creator_id into v_creator_id
    from public.divis
    where id = v_requested_id;

    if not found or v_creator_id <> v_user_id then
      raise exception 'Divi not found or not owned by the current user';
    end if;

    v_divi_id := v_requested_id;
  else
    v_divi_id := gen_random_uuid();
  end if;

  if v_requested_id is null then
    insert into public.divis (
      id, creator_id, payer_id, title, receipt_date, state, currency_code
    ) values (
      v_divi_id,
      v_user_id,
      v_user_id,
      p_snapshot ->> 'title',
      left(nullif(p_snapshot ->> 'date', ''), 10)::date,
      coalesce(p_snapshot ->> 'state', 'draft'),
      coalesce(p_snapshot -> 'enteredTotal' ->> 'currencyCode', 'USD')
    );
  else
    update public.divis
    set payer_id = v_user_id,
        title = p_snapshot ->> 'title',
        receipt_date = left(nullif(p_snapshot ->> 'date', ''), 10)::date,
        state = coalesce(p_snapshot ->> 'state', 'draft'),
        currency_code = coalesce(p_snapshot -> 'enteredTotal' ->> 'currencyCode', 'USD'),
        updated_at = now()
    where id = v_divi_id;
  end if;

  delete from public.divi_allocations where divi_id = v_divi_id;
  delete from public.item_claims where divi_id = v_divi_id;
  delete from public.receipt_items where divi_id = v_divi_id;
  delete from public.receipt_adjustments where divi_id = v_divi_id;
  delete from public.receipts where divi_id = v_divi_id;

  for v_participant in
    select value from jsonb_array_elements(coalesce(p_snapshot -> 'participants', '[]'::jsonb))
  loop
    if v_participant ->> 'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       and exists (
         select 1 from public.divi_participants
         where id = (v_participant ->> 'id')::uuid and divi_id = v_divi_id
       ) then
      v_participant_id := (v_participant ->> 'id')::uuid;
    else
      v_participant_id := gen_random_uuid();
    end if;

    v_kept_participants := array_append(v_kept_participants, v_participant_id);
    v_participant_map := jsonb_set(
      v_participant_map,
      array[coalesce(v_participant ->> 'id', v_participant_id::text)],
      to_jsonb(v_participant_id),
      true
    );

    insert into public.divi_participants (
      id, divi_id, user_id, display_name, phone_number, venmo_username
    ) values (
      v_participant_id,
      v_divi_id,
      case
        when coalesce((v_participant ->> 'isCurrentUser')::boolean, false)
          or v_participant ->> 'id' = v_user_id::text
        then v_user_id
        else null
      end,
      coalesce(v_participant ->> 'name', 'Participant'),
      nullif(v_participant ->> 'phoneNumber', ''),
      nullif(v_participant ->> 'venmoUsername', '')
    )
    on conflict (id) do update set
      user_id = excluded.user_id,
      display_name = excluded.display_name,
      phone_number = excluded.phone_number,
      venmo_username = excluded.venmo_username;
  end loop;

  delete from public.divi_participants
  where divi_id = v_divi_id
    and not (id = any(v_kept_participants));

  insert into public.receipts (
    divi_id, image_uri, receipt_date, tax_minor_units,
    tip_minor_units, entered_total_minor_units
  ) values (
    v_divi_id,
    nullif(p_snapshot ->> 'receiptImageUri', ''),
    left(nullif(p_snapshot ->> 'date', ''), 10)::date,
    coalesce((p_snapshot -> 'tax' ->> 'minorUnits')::bigint, 0),
    coalesce((p_snapshot -> 'tip' ->> 'minorUnits')::bigint, 0),
    coalesce((p_snapshot -> 'enteredTotal' ->> 'minorUnits')::bigint, 0)
  ) returning id into v_receipt_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_snapshot -> 'items', '[]'::jsonb))
  loop
    v_item_id := gen_random_uuid();
    insert into public.receipt_items (
      id, divi_id, receipt_id, sort_order, name, quantity, amount_minor_units
    ) values (
      v_item_id,
      v_divi_id,
      v_receipt_id,
      v_sort_order,
      coalesce(v_item ->> 'name', 'Item'),
      coalesce((v_item ->> 'quantity')::numeric, 1),
      coalesce((v_item -> 'amount' ->> 'minorUnits')::bigint, 0)
    );

    for v_claimant_key in
      select jsonb_array_elements_text(coalesce(v_item -> 'claimantIds', '[]'::jsonb))
    loop
      if v_participant_map ? v_claimant_key then
        insert into public.item_claims (item_id, divi_id, participant_id)
        values (
          v_item_id,
          v_divi_id,
          (v_participant_map ->> v_claimant_key)::uuid
        );
      end if;
    end loop;
  end loop;

  foreach v_kind in array array['fee', 'discount']
  loop
    for v_adjustment in
      select value
      from jsonb_array_elements(
        coalesce(p_snapshot -> case when v_kind = 'fee' then 'fees' else 'discounts' end, '[]'::jsonb)
      )
    loop
      insert into public.receipt_adjustments (
        divi_id, receipt_id, kind, name, amount_minor_units
      ) values (
        v_divi_id,
        v_receipt_id,
        v_kind,
        coalesce(v_adjustment ->> 'name', v_kind),
        coalesce((v_adjustment -> 'amount' ->> 'minorUnits')::bigint, 0)
      );
    end loop;

    v_sort_order := v_sort_order + 1;
  end loop;

  for v_allocation in
    select value from jsonb_array_elements(coalesce(p_snapshot -> 'allocations', '[]'::jsonb))
  loop
    if v_participant_map ? (v_allocation ->> 'participantId') then
      insert into public.divi_allocations (
        divi_id, participant_id, items_minor_units, tax_minor_units,
        tip_minor_units, fees_minor_units, discounts_minor_units,
        total_minor_units, paid_minor_units, request_initiated
      ) values (
        v_divi_id,
        (v_participant_map ->> (v_allocation ->> 'participantId'))::uuid,
        coalesce((v_allocation -> 'items' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'tax' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'tip' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'fees' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'discounts' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'total' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation -> 'paid' ->> 'minorUnits')::bigint, 0),
        coalesce((v_allocation ->> 'requestInitiated')::boolean, false)
      );
    end if;
  end loop;

  return v_divi_id;
end;
$$;

grant execute on function public.save_divi_snapshot(jsonb) to authenticated;
