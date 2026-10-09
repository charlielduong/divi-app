import { Money, Participant } from '../domain/models';

export type VenmoHandoff = { url?: string; recipient?: string; amount: string; note: string };

export const createVenmoRequest = (
  recipient: Participant,
  amount: Money,
  note: string,
): VenmoHandoff => {
  const username = recipient.venmoUsername?.trim();
  const exactAmount = (amount.minorUnits / 100).toFixed(2);
  const params = new URLSearchParams({ txn: 'charge', amount: exactAmount, note });
  if (username) params.set('recipients', username);
  return {
    url: username ? `venmo://paycharge?${params.toString()}` : undefined,
    recipient: username,
    amount: `$${exactAmount}`,
    note,
  };
};
