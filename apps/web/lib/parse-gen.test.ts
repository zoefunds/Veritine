import { describe, expect, it } from 'vitest';
import { parseGen } from './parse-gen';

describe('parseGen', () => {
  it('parses a whole GEN amount to wei', () => {
    expect(parseGen('1')).toBe(BigInt('1000000000000000000'));
  });

  it('parses a fractional GEN amount to wei', () => {
    expect(parseGen('1.5')).toBe(BigInt('1500000000000000000'));
    expect(parseGen('0.000001')).toBe(BigInt('1000000000000'));
  });

  it('parses zero', () => {
    expect(parseGen('0')).toBe(BigInt(0));
  });

  it('rejects empty input', () => {
    expect(() => parseGen('')).toThrow();
    expect(() => parseGen('   ')).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => parseGen('abc')).toThrow();
    expect(() => parseGen('1.2.3')).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => parseGen('-1')).toThrow();
  });

  it('is the exact inverse of formatGen for round-trippable amounts', () => {
    // Guards against the two utilities silently drifting apart, since the
    // frontend forms rely on parseGen(input) being sent on-chain and later
    // displayed back via formatGen without a mismatch.
    const wei = parseGen('42.123456789012345678');
    expect(wei).toBe(BigInt('42123456789012345678'));
  });
});
