import { amountInWords } from './amount-in-words';

describe('amountInWords', () => {
  it('handles a typical invoice total', () => {
    expect(amountInWords('46782.00', 'rupees'))
      .toBe('Forty-six thousand seven hundred eighty-two rupees only.');
  });

  it('handles zero', () => {
    expect(amountInWords('0.00', 'rupees')).toBe('Zero rupees only.');
  });

  it('handles decimals (paisa)', () => {
    expect(amountInWords('100.50', 'rupees'))
      .toBe('One hundred rupees and fifty paisa only.');
  });

  it('uses the configured currency label', () => {
    expect(amountInWords('5.00', 'dollars')).toBe('Five dollars only.');
  });
});
