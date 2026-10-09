import { adjustmentTotal, Allocation, Divi, money, ReceiptItem } from './models';

export type AllocationError = 'NO_PARTICIPANTS' | 'UNCLAIMED_ITEMS' | 'UNRECONCILED_TOTAL';

export type AllocationItemShare = { item: ReceiptItem; amount: ReturnType<typeof money> };

const distribute = (amount: number, weights: Record<string, number>, ids: string[]) => {
  const denominator = Math.max(
    1,
    Object.values(weights).reduce((sum, value) => sum + value, 0),
  );
  const result: Record<string, number> = {};
  let assigned = 0;
  ids.forEach((id) => {
    result[id] = Math.trunc((amount * (weights[id] ?? 0)) / denominator);
    assigned += result[id];
  });
  let remainder = amount - assigned;
  let index = 0;
  while (remainder !== 0) {
    const id = ids[index % ids.length];
    const step = remainder > 0 ? 1 : -1;
    result[id] += step;
    remainder -= step;
    index += 1;
  }
  return result;
};

export const allocationItemBreakdown = (divi: Divi, participantId: string): AllocationItemShare[] =>
  divi.items.flatMap((item) => {
    if (!item.claimantIds.includes(participantId)) return [];
    const claimants = [...item.claimantIds].sort();
    const claimantIndex = claimants.indexOf(participantId);
    const base = Math.trunc(item.amount.minorUnits / claimants.length);
    const remainder = item.amount.minorUnits % claimants.length;
    return [
      {
        item,
        amount: money(base + (claimantIndex < remainder ? 1 : 0), item.amount.currencyCode),
      },
    ];
  });

export const finalizeAllocations = (divi: Divi): Allocation[] => {
  if (!divi.participants.length) throw new Error('NO_PARTICIPANTS' satisfies AllocationError);
  if (divi.items.some((item) => item.claimantIds.length === 0))
    throw new Error('UNCLAIMED_ITEMS' satisfies AllocationError);
  const calculated =
    divi.items.reduce((sum, item) => sum + item.amount.minorUnits, 0) +
    divi.tax.minorUnits +
    divi.tip.minorUnits +
    adjustmentTotal(divi.fees) -
    adjustmentTotal(divi.discounts);
  if (calculated !== divi.enteredTotal.minorUnits)
    throw new Error('UNRECONCILED_TOTAL' satisfies AllocationError);

  const ids = divi.participants.map((participant) => participant.id).sort();
  const items: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  divi.items.forEach((item) => {
    const claimants = [...item.claimantIds].sort();
    const base = Math.trunc(item.amount.minorUnits / claimants.length);
    const remainder = item.amount.minorUnits % claimants.length;
    claimants.forEach((id, index) => {
      items[id] += base + (index < remainder ? 1 : 0);
    });
  });

  const tax = distribute(divi.tax.minorUnits, items, ids);
  const tip = distribute(divi.tip.minorUnits, items, ids);
  const fees = distribute(adjustmentTotal(divi.fees), items, ids);
  const discounts = distribute(adjustmentTotal(divi.discounts), items, ids);
  return ids.map((participantId) => {
    const total =
      items[participantId] +
      tax[participantId] +
      tip[participantId] +
      fees[participantId] -
      discounts[participantId];
    return {
      participantId,
      items: money(items[participantId]),
      tax: money(tax[participantId]),
      tip: money(tip[participantId]),
      fees: money(fees[participantId]),
      discounts: money(discounts[participantId]),
      total: money(total),
      paid: money(0),
      requestInitiated: false,
    };
  });
};
