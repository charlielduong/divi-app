import { describe, expect, it } from 'vitest';
import { finalizeAllocations } from '../src/domain/allocation';
import { alex, currentUser, money, sampleDinner } from '../src/domain/models';

describe('finalizeAllocations', () => {
  it('preserves every cent while splitting shared items and proportional extras', () => {
    const divi = sampleDinner();
    divi.items[2].claimantIds = [currentUser.id, alex.id];
    const allocations = finalizeAllocations(divi);

    expect(allocations.reduce((sum, allocation) => sum + allocation.total.minorUnits, 0)).toBe(
      8692,
    );
    expect(allocations.filter((allocation) => allocation.total.minorUnits > 0)).toHaveLength(3);
    expect(allocations.map((allocation) => allocation.participantId)).toEqual([
      'alex',
      'charlie',
      'jordan',
      'morgan',
      'sam',
      'taylor',
    ]);
  });

  it('blocks finalization while an item is unclaimed', () => {
    expect(() => finalizeAllocations(sampleDinner())).toThrow('UNCLAIMED_ITEMS');
  });

  it('blocks a receipt whose entered total does not reconcile', () => {
    const divi = sampleDinner();
    divi.items[2].claimantIds = [currentUser.id];
    divi.enteredTotal = money(9999);
    expect(() => finalizeAllocations(divi)).toThrow('UNRECONCILED_TOTAL');
  });

  it('includes fees and discounts while preserving the reconciled total', () => {
    const divi = sampleDinner();
    divi.items[2].claimantIds = [currentUser.id];
    divi.fees = [
      { id: 'service-fee', name: 'Service fee', amount: money(200) },
      { id: 'card-fee', name: 'Credit card fee', amount: money(100) },
    ];
    divi.discounts = [{ id: 'employee-discount', name: 'Employee discount', amount: money(200) }];
    divi.enteredTotal = money(8792);

    const allocations = finalizeAllocations(divi);

    expect(allocations.reduce((sum, allocation) => sum + allocation.total.minorUnits, 0)).toBe(
      8792,
    );
    expect(allocations.reduce((sum, allocation) => sum + allocation.fees.minorUnits, 0)).toBe(300);
    expect(allocations.reduce((sum, allocation) => sum + allocation.discounts.minorUnits, 0)).toBe(
      200,
    );
  });
});
