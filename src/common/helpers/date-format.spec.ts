import { formatInvoiceDate } from './date-format';

describe('formatInvoiceDate', () => {
  it('formats with the day-ordinal suffix', () => {
    expect(formatInvoiceDate('2025-09-22')).toBe('22nd Sep 2025');
    expect(formatInvoiceDate('2025-01-01')).toBe('1st Jan 2025');
    expect(formatInvoiceDate('2025-03-03')).toBe('3rd Mar 2025');
    expect(formatInvoiceDate('2025-04-04')).toBe('4th Apr 2025');
    expect(formatInvoiceDate('2025-04-11')).toBe('11th Apr 2025');
    expect(formatInvoiceDate('2025-04-21')).toBe('21st Apr 2025');
  });
});
