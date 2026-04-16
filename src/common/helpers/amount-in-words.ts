import { toWords } from 'number-to-words';

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function stripCommas(s: string): string { return s.replace(/,/g, ''); }

export function amountInWords(value: string, currencyLabel: string): string {
  const n = Number(value);
  const whole = Math.floor(n);
  const cents = Math.round((n - whole) * 100);
  const wholeWords = cap(stripCommas(toWords(whole)));
  if (cents === 0) {
    return `${wholeWords} ${currencyLabel} only.`;
  }
  return `${wholeWords} ${currencyLabel} and ${toWords(cents)} paisa only.`;
}
