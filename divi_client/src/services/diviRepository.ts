import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import {
  Allocation,
  Divi,
  money,
  Participant,
  ReceiptAdjustment,
  ReceiptItem,
} from '../domain/models';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Row = Record<string, any>;

const isUuid = (value: string) => uuidPattern.test(value);

const displayNameForUser = (user: User) =>
  String(
    user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split('@')[0] ??
      'Divi user',
  );

const getData = async (
  request: PromiseLike<{ data: any; error: { message: string } | null }>,
): Promise<any> => {
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data;
};

const participantIsCurrentUser = (participant: Participant, user: User) =>
  participant.isCurrentUser || participant.id === user.id;

async function loadDivi(diviId: string, userId: string): Promise<Divi> {
  const row = (await getData(
    supabase.from('divis').select('*').eq('id', diviId).single(),
  )) as Row | null;
  if (!row) throw new Error('Divi not found.');

  const [participants, receipt, allocations] = await Promise.all([
    getData(
      supabase.from('divi_participants').select('*').eq('divi_id', diviId).order('joined_at'),
    ),
    getData(supabase.from('receipts').select('*').eq('divi_id', diviId).maybeSingle()),
    getData(supabase.from('divi_allocations').select('*').eq('divi_id', diviId)),
  ]);

  const [items, adjustments, claims] = receipt
    ? await Promise.all([
        getData(
          supabase.from('receipt_items').select('*').eq('divi_id', diviId).order('sort_order'),
        ),
        getData(
          supabase
            .from('receipt_adjustments')
            .select('*')
            .eq('divi_id', diviId)
            .order('created_at'),
        ),
        getData(supabase.from('item_claims').select('*').eq('divi_id', diviId)),
      ])
    : [[], [], []];

  const claimsByItem = new Map<string, string[]>();
  for (const claim of (claims ?? []) as Row[]) {
    const current = claimsByItem.get(claim.item_id) ?? [];
    current.push(claim.participant_id);
    claimsByItem.set(claim.item_id, current);
  }

  const itemRows = (items ?? []) as Row[];
  const adjustmentRows = (adjustments ?? []) as Row[];
  const participantRows = (participants ?? []) as Row[];
  const allocationRows = (allocations ?? []) as Row[];
  const currencyCode = row.currency_code ?? 'USD';
  const feeRows = adjustmentRows.filter((adjustment) => adjustment.kind === 'fee');
  const discountRows = adjustmentRows.filter((adjustment) => adjustment.kind === 'discount');

  return {
    id: row.id,
    title: row.title,
    date: row.receipt_date ?? row.created_at,
    state: row.state,
    creatorId: row.creator_id,
    payerId: row.payer_id ?? row.creator_id,
    participants: participantRows.map((participant) => ({
      id: participant.id,
      name: participant.display_name,
      phoneNumber: participant.phone_number ?? undefined,
      venmoUsername: participant.venmo_username ?? undefined,
      isCurrentUser: participant.user_id === userId,
    })),
    items: itemRows.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      amount: money(item.amount_minor_units, currencyCode),
      claimantIds: claimsByItem.get(item.id) ?? [],
    })),
    tax: money(receipt?.tax_minor_units ?? 0, currencyCode),
    tip: money(receipt?.tip_minor_units ?? 0, currencyCode),
    fees: feeRows.map((adjustment) => ({
      id: adjustment.id,
      name: adjustment.name,
      amount: money(adjustment.amount_minor_units, currencyCode),
    })),
    discounts: discountRows.map((adjustment) => ({
      id: adjustment.id,
      name: adjustment.name,
      amount: money(adjustment.amount_minor_units, currencyCode),
    })),
    enteredTotal: money(receipt?.entered_total_minor_units ?? 0, currencyCode),
    allocations: allocationRows.map((allocation) => ({
      participantId: allocation.participant_id,
      items: money(allocation.items_minor_units, currencyCode),
      tax: money(allocation.tax_minor_units, currencyCode),
      tip: money(allocation.tip_minor_units, currencyCode),
      fees: money(allocation.fees_minor_units, currencyCode),
      discounts: money(allocation.discounts_minor_units, currencyCode),
      total: money(allocation.total_minor_units, currencyCode),
      paid: money(allocation.paid_minor_units, currencyCode),
      requestInitiated: allocation.request_initiated,
    })),
    receiptImageUri: receipt?.image_uri ?? undefined,
  };
}

export async function loadUserDivis(userId: string): Promise<Divi[]> {
  const rows = await getData(
    supabase.from('divis').select('id').order('created_at', { ascending: false }),
  );
  return Promise.all(((rows ?? []) as Row[]).map((row) => loadDivi(row.id, userId)));
}

export async function saveDivi(user: User, divi: Divi): Promise<Divi> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Your sign-in session is no longer valid. Please sign in again.');
  }

  const { data: savedDiviId, error: saveError } = await supabase.rpc('save_divi_snapshot', {
    p_snapshot: divi,
  });
  if (saveError) throw new Error(saveError.message);
  if (typeof savedDiviId !== 'string') {
    throw new Error('The saved Divi did not return a valid ID.');
  }

  return loadDivi(savedDiviId, authData.user.id);
}

async function saveDiviLegacy(user: User, divi: Divi): Promise<Divi> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Your sign-in session is no longer valid. Please sign in again.');
  }
  const activeUser = authData.user;
  const currencyCode = divi.enteredTotal.currencyCode || 'USD';
  let diviId = isUuid(divi.id) ? divi.id : null;

  if (diviId) {
    await getData(
      supabase
        .from('divis')
        .update({
          title: divi.title,
          payer_id: activeUser.id,
          receipt_date: divi.date.slice(0, 10),
          state: divi.state,
          currency_code: currencyCode,
        })
        .eq('id', diviId),
    );
  } else {
    const { data: sessionData } = await supabase.auth.getSession();
    const insertPayload = {
      creator_id: activeUser.id,
      payer_id: activeUser.id,
      title: divi.title,
      receipt_date: divi.date.slice(0, 10),
      state: divi.state,
      currency_code: currencyCode,
    };
    const inserted = await getData(
      supabase.from('divis').insert(insertPayload).select('id').single(),
    );
    if (!inserted) throw new Error('The Divi could not be created.');
    diviId = inserted.id;
  }
  if (!diviId) throw new Error('The Divi could not be identified.');

  const participantIds = new Map<string, string>();
  for (const participant of divi.participants) {
    const isCurrentUser = participantIsCurrentUser(participant, activeUser);
    const payload = {
      divi_id: diviId,
      user_id: isCurrentUser ? activeUser.id : null,
      display_name: isCurrentUser ? displayNameForUser(activeUser) : participant.name,
      phone_number: participant.phoneNumber ?? null,
      venmo_username: participant.venmoUsername ?? null,
    };

    if (isUuid(participant.id)) {
      const saved = await getData(
        supabase
          .from('divi_participants')
          .update(payload)
          .eq('id', participant.id)
          .select('id')
          .single(),
      );
      participantIds.set(participant.id, saved?.id ?? participant.id);
    } else {
      const saved = await getData(
        supabase.from('divi_participants').insert(payload).select('id').single(),
      );
      if (saved) participantIds.set(participant.id, saved.id);
    }
  }

  const existingReceipt = await getData(
    supabase.from('receipts').select('id').eq('divi_id', diviId).maybeSingle(),
  );
  const receiptPayload = {
    divi_id: diviId,
    image_uri: divi.receiptImageUri ?? null,
    receipt_date: divi.date.slice(0, 10),
    tax_minor_units: divi.tax.minorUnits,
    tip_minor_units: divi.tip.minorUnits,
    entered_total_minor_units: divi.enteredTotal.minorUnits,
  };
  const receipt = existingReceipt
    ? await getData(
        supabase
          .from('receipts')
          .update(receiptPayload)
          .eq('id', existingReceipt.id)
          .select('id')
          .single(),
      )
    : await getData(supabase.from('receipts').insert(receiptPayload).select('id').single());
  if (!receipt) throw new Error('The receipt could not be saved.');

  await getData(supabase.from('item_claims').delete().eq('divi_id', diviId));
  await getData(supabase.from('receipt_items').delete().eq('divi_id', diviId));
  await getData(supabase.from('receipt_adjustments').delete().eq('divi_id', diviId));
  await getData(supabase.from('divi_allocations').delete().eq('divi_id', diviId));

  const itemIds = new Map<string, string>();
  for (const [sortOrder, item] of divi.items.entries()) {
    const saved = await getData(
      supabase
        .from('receipt_items')
        .insert({
          divi_id: diviId,
          receipt_id: receipt.id,
          sort_order: sortOrder,
          name: item.name,
          quantity: item.quantity,
          amount_minor_units: item.amount.minorUnits,
        })
        .select('id')
        .single(),
    );
    if (!saved) continue;
    itemIds.set(item.id, saved.id);
    const claims = item.claimantIds
      .map((participantId) => participantIds.get(participantId))
      .filter((participantId): participantId is string => Boolean(participantId))
      .map((participantId) => ({
        item_id: saved.id,
        divi_id: diviId,
        participant_id: participantId,
      }));
    if (claims.length) await getData(supabase.from('item_claims').insert(claims));
  }

  const adjustments: Array<Record<string, string | number>> = [
    ...divi.fees.map((adjustment) => ({
      divi_id: diviId as string,
      receipt_id: receipt.id,
      kind: 'fee',
      name: adjustment.name,
      amount_minor_units: adjustment.amount.minorUnits,
    })),
    ...divi.discounts.map((adjustment) => ({
      divi_id: diviId as string,
      receipt_id: receipt.id,
      kind: 'discount',
      name: adjustment.name,
      amount_minor_units: adjustment.amount.minorUnits,
    })),
  ];
  if (adjustments.length) await getData(supabase.from('receipt_adjustments').insert(adjustments));

  if (divi.allocations.length) {
    const allocations = divi.allocations
      .map((allocation) => {
        const participantId = participantIds.get(allocation.participantId);
        if (!participantId) return null;
        return {
          divi_id: diviId,
          participant_id: participantId,
          items_minor_units: allocation.items.minorUnits,
          tax_minor_units: allocation.tax.minorUnits,
          tip_minor_units: allocation.tip.minorUnits,
          fees_minor_units: allocation.fees.minorUnits,
          discounts_minor_units: allocation.discounts.minorUnits,
          total_minor_units: allocation.total.minorUnits,
          paid_minor_units: allocation.paid.minorUnits,
          request_initiated: allocation.requestInitiated,
        };
      })
      .filter((allocation): allocation is NonNullable<typeof allocation> => Boolean(allocation));
    if (allocations.length) await getData(supabase.from('divi_allocations').insert(allocations));
  }

  return loadDivi(diviId, activeUser.id);
}

export async function deleteDivi(userId: string, diviId: string) {
  await getData(supabase.from('divis').delete().eq('id', diviId).eq('creator_id', userId));
}
