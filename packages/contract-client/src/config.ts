// Centralized contract configuration - the ONLY place the deployed
// address and chain should be read from. Never hardcode the address in
// frontend components or backend services; import getContractConfig()
// instead so a redeploy only ever requires updating environment
// variables in one place.

import { studionet } from 'genlayer-js/chains';
import type { GenLayerChain } from 'genlayer-js/types';

export interface ContractConfig {
  address: `0x${string}`;
  chain: GenLayerChain;
}

function resolveChain(network: string | undefined): GenLayerChain {
  // Only StudioNet is wired up today (see docs/architecture - the project
  // deploys to GenLayer Studio / StudioNet per the deployment requirements).
  // Extend this switch if/when testnet or mainnet support is added.
  switch (network) {
    case 'studionet':
    case undefined:
      return studionet;
    default:
      throw new Error(`Unsupported GenLayer network: ${network}`);
  }
}

export function getContractConfig(env: {
  contractAddress: string | undefined;
  network: string | undefined;
}): ContractConfig {
  if (!env.contractAddress) {
    throw new Error(
      'GenLayer contract address is not configured. Set GENLAYER_CONTRACT_ADDRESS ' +
        '(backend) / NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS (frontend).',
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(env.contractAddress)) {
    throw new Error(`GenLayer contract address is not a valid address: ${env.contractAddress}`);
  }
  return {
    address: env.contractAddress as `0x${string}`,
    chain: resolveChain(env.network),
  };
}
