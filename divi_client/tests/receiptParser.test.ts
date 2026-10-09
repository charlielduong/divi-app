import { describe, expect, it } from 'vitest';
import { parseReceiptText, receiptDraftFromParsed } from '../src/services/receiptParser';

describe('receipt OCR parsing', () => {
  it('extracts item labels, line totals, adjustments, and receipt total', () => {
    const parsed = parseReceiptText(`
      CORNER CAFE
      2 x Latte 4.50 9.00
      Blueberry Muffin $3.75
      SUBTOTAL 12.75
      SALES TAX 1.02
      Service Fee 0.64
      TOTAL $14.41
      VISA 14.41
    `);

    expect(parsed.title).toBe('Corner Cafe');
    expect(parsed.items).toEqual([
      { name: 'Latte 4.50', quantity: 2, amountMinorUnits: 900 },
      { name: 'Blueberry Muffin', quantity: 1, amountMinorUnits: 375 },
    ]);
    expect(parsed.taxMinorUnits).toBe(102);
    expect(parsed.fees).toEqual([{ name: 'Service Fee', amountMinorUnits: 64 }]);
    expect(parsed.totalMinorUnits).toBe(1441);
  });

  it('joins a product name with a following price-only OCR line', () => {
    const parsed = parseReceiptText(`
      GREEN MARKET
      Organic Bananas
      2.49
      Milk 4.25
      Coupon -1.00
      Total 5.74
    `);

    expect(parsed.items).toEqual([
      { name: 'Organic Bananas', quantity: 1, amountMinorUnits: 249 },
      { name: 'Milk', quantity: 1, amountMinorUnits: 425 },
    ]);
    expect(parsed.discounts).toEqual([{ name: 'Coupon', amountMinorUnits: 100 }]);
  });

  it('recombines receipt columns returned as separate OCR lines', () => {
    const parsed = parseReceiptText(`
      CORNER CAFE
      2 x Latte 4.50
      9.00
      Blueberry Muffin
      3.75
      SUBTOTAL
      12.75
      SALES TAX
      1.02
      SERVICE FEE
      0.64
      TOTAL
      14.41
    `);

    expect(parsed.items).toEqual([
      { name: 'Latte 4.50', quantity: 2, amountMinorUnits: 900 },
      { name: 'Blueberry Muffin', quantity: 1, amountMinorUnits: 375 },
    ]);
    expect(parsed.taxMinorUnits).toBe(102);
    expect(parsed.fees).toEqual([{ name: 'Service Fee', amountMinorUnits: 64 }]);
    expect(parsed.totalMinorUnits).toBe(1441);
  });

  it('keeps the scanned total independent so discrepancies can be reviewed', () => {
    const draft = receiptDraftFromParsed(
      parseReceiptText(`BISTRO\nSoup 8.00\nTax 0.64\nTotal 10.00`),
      'file:///receipt.jpg',
    );

    expect(draft.items[0].claimantIds).toEqual([]);
    expect(draft.enteredTotal.minorUnits).toBe(1000);
    expect(draft.receiptImageUri).toBe('file:///receipt.jpg');
  });
});
