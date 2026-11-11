import {describe, expect, it} from 'vitest';

import {formatNumber, formatOneDecimal} from './format';

describe('number formatting', () => {
  it('formats numbers with a Greek decimal comma and no grouping', () => {
    expect(formatNumber(151.5)).toBe('151,5');
    expect(formatNumber(62.5)).toBe('62,5');
    expect(formatNumber(2279)).toBe('2279');
  });

  it('always shows one decimal when asked', () => {
    expect(formatOneDecimal(2)).toBe('2,0');
    expect(formatOneDecimal(2.036)).toBe('2,0');
    expect(formatOneDecimal(2.545)).toBe('2,5');
    expect(formatOneDecimal(0.9)).toBe('0,9');
  });
});
