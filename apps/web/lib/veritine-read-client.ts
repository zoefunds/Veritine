import { VeritineReadClient } from '@veritine/contract-client';

/**
 * A single shared read client for server components / server actions.
 * Reads go straight to the deployed contract - never mocked.
 */
export function getVeritineReadClient(): VeritineReadClient {
  return new VeritineReadClient({
    contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
    network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
  });
}
