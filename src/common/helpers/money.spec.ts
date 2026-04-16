import { computeLineTotal, computeTotals, money } from './money';

describe('money helpers', () => {
  it('rounds money to 2dp half-up', () => {
    expect(money(1.005)).toBe('1.01');
    expect(money(1.004)).toBe('1.00');
    expect(money(0)).toBe('0.00');
  });

  it('computes line total = unit_cost * quantity', () => {
    expect(computeLineTotal('1600.00', '24')).toBe('38400.00');
    expect(computeLineTotal('1000.00', '3')).toBe('3000.00');
    expect(computeLineTotal('99.99', '3')).toBe('299.97');
  });

  it('computes subtotal/vat/grand total for a multi-line invoice', () => {
    const totals = computeTotals(
      [
        { unitCost: '1600.00', quantity: '24' }, // 38,400.00
        { unitCost: '1000.00', quantity: '3' },  // 3,000.00
      ],
      '13.00',
    );
    expect(totals.subtotal).toBe('41400.00');
    expect(totals.vatAmount).toBe('5382.00');
    expect(totals.grandTotal).toBe('46782.00');
  });
});
