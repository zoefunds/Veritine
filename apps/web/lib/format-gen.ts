/**
 * Formats a wei-denominated amount (as returned by the contract) as GEN
 * for display. GEN uses 18 decimals, same as ETH. Never show raw wei to
 * users - it's the contract's internal accounting unit, not a
 * human-meaningful amount.
 */
export function formatGen(weiAmount: string | number | bigint, maxDecimals = 4): string {
  const wei = typeof weiAmount === 'bigint' ? weiAmount : BigInt(Math.trunc(Number(weiAmount)));
  const divisor = BigInt(10) ** BigInt(18);
  const whole = wei / divisor;
  const remainder = wei % divisor;

  if (remainder === BigInt(0)) {
    return whole.toString();
  }

  const fractionStr = remainder.toString().padStart(18, '0').slice(0, maxDecimals).replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}
