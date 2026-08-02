import { defineChain } from 'viem';

/**
 * GenLayer StudioNet as a viem/wagmi chain definition. GENLAYER_CHAIN_ID
 * is intentionally left unset here and resolved from environment
 * configuration at runtime (see wallet-config.ts) - the exact chain id
 * is only known once the contract is deployed to StudioNet and the
 * network details are confirmed, per the project's deployment process.
 */
export function buildGenLayerChain(chainIdDecimal: number, rpcUrl: string) {
  return defineChain({
    id: chainIdDecimal,
    name: 'GenLayer StudioNet',
    nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
    testnet: true,
  });
}
