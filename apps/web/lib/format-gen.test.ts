import { describe, expect, it } from 'vitest';
import { formatGen } from './format-gen';

describe('formatGen', () => {
  it('formats a whole-GEN wei amount with no decimal point', () => {
    expect(formatGen('1000000000000000000')).toBe('1');
    expect(formatGen('0')).toBe('0');
  });

  it('formats a fractional GEN amount, trimming trailing zeros', () => {
    expect(formatGen('1500000000000000000')).toBe('1.5');
    expect(formatGen('1050000000000000000')).toBe('1.05');
  });

  it('truncates to maxDecimals rather than rounding', () => {
    // 1.23456 GEN, capped to 4 decimals -> 1.2345 (truncated, not rounded to 1.2346)
    expect(formatGen('1234560000000000000', 4)).toBe('1.2345');
  });

  it('accepts bigint input directly', () => {
    expect(formatGen(BigInt('2000000000000000000'))).toBe('2');
  });

  it('accepts number input', () => {
    expect(formatGen(0)).toBe('0');
  });

  it('handles large amounts without precision loss', () => {
    // 1,234,567 GEN exactly - a value well beyond JS float safe-integer
    // precision if this used Number arithmetic instead of BigInt.
    expect(formatGen('1234567000000000000000000')).toBe('1234567');
  });
});
