import { describe, expect, it } from 'vitest';
import { money, Participant } from '../src/domain/models';
import { createVenmoRequest } from '../src/services/venmo';

describe('createVenmoRequest', () => {
  it('builds a charge handoff with an exact amount and Divi note', () => {
    const recipient: Participant = { id: 'alex', name: 'Alex', venmoUsername: 'alex' };
    const handoff = createVenmoRequest(recipient, money(4218), 'Dinner at Barcelona');

    expect(handoff.url).toContain('venmo://paycharge?');
    expect(handoff.url).toContain('txn=charge');
    expect(handoff.url).toContain('amount=42.18');
    expect(handoff.url).toContain('recipients=alex');
    expect(handoff.amount).toBe('$42.18');
  });

  it('returns copyable fallback details without assuming an identity', () => {
    const recipient: Participant = { id: 'sam', name: 'Sam' };
    const handoff = createVenmoRequest(recipient, money(1200), 'Lunch');

    expect(handoff.url).toBeUndefined();
    expect(handoff.recipient).toBeUndefined();
    expect(handoff).toMatchObject({ amount: '$12.00', note: 'Lunch' });
  });
});
