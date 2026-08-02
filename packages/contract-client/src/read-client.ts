import { createClient } from 'genlayer-js';
import { getContractConfig } from './config.js';

/** A read-only client - no wallet/account required, talks directly to the RPC. */
export function createReadClient(env: { contractAddress: string | undefined; network: string | undefined }) {
  const config = getContractConfig(env);
  const client = createClient({ chain: config.chain });
  return { client, config };
}

export type ReadClient = ReturnType<typeof createReadClient>;

/** Generic typed view-method call against the deployed Veritine contract. */
export async function readVeritine<T>(
  read: ReadClient,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  return read.client.readContract({
    address: read.config.address,
    functionName,
    // The SDK's CalldataEncodable type only accepts specific primitives;
    // our args are always plain JSON-safe values (string/number/bool/array),
    // which are all valid at runtime even though TS can't narrow `unknown[]`.
    args: args as never[],
  }) as Promise<T>;
}
