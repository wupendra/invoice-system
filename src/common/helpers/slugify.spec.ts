import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Kaju Art Rugs Pvt. Ltd.')).toBe('kaju-art-rugs-pvt-ltd');
  });

  it('strips punctuation and extra whitespace', () => {
    expect(slugify('  Foo &  Bar!!!  ')).toBe('foo-bar');
  });

  it('collapses multiple spaces/hyphens into one', () => {
    expect(slugify('A  B   -  C')).toBe('a-b-c');
  });

  it('returns a safe fallback for empty/whitespace input', () => {
    expect(slugify('')).toBe('invoice');
    expect(slugify('   ')).toBe('invoice');
    expect(slugify('!!!')).toBe('invoice');
  });
});
