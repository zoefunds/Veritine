/** Parses a user-entered GEN amount (e.g. "1.5") into a wei bigint. */
export function parseGen(genAmount: string): bigint {
  const trimmed = genAmount.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) < 0) {
    throw new Error('Enter a valid, non-negative GEN amount');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = (fraction + '0'.repeat(18)).slice(0, 18);
  const wholePart = BigInt(whole || '0') * BigInt(10) ** BigInt(18);
  const fractionPart = BigInt(paddedFraction || '0');
  return wholePart + fractionPart;
}
