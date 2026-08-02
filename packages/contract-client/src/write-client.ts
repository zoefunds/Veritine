import { createClient } from 'genlayer-js';
import { TransactionStatus, type Hash } from 'genlayer-js/types';
import { getContractConfig } from './config.js';

export interface WriteClientOptions {
  contractAddress: string | undefined;
  network: string | undefined;
  account: `0x${string}`;
  /** EIP-1193 provider, e.g. window.ethereum in the browser. */
  provider: unknown;
}

/** A write-capable client bound to a connected wallet account/provider. */
export function createWriteClient(options: WriteClientOptions) {
  const config = getContractConfig(options);
  const client = createClient({
    chain: config.chain,
    account: options.account,
    provider: options.provider as never,
  });
  return { client, config };
}

export type WriteClient = ReturnType<typeof createWriteClient>;

export interface SubmittedTransaction {
  hash: `0x${string}`;
}

/** Submits a write transaction. Does not wait for finality - see waitForFinality. */
export async function writeVeritine(
  write: WriteClient,
  functionName: string,
  args: unknown[] = [],
  valueWei: bigint = BigInt(0),
): Promise<SubmittedTransaction> {
  const hash = await write.client.writeContract({
    address: write.config.address,
    functionName,
    // See readVeritine for why this cast is safe.
    args: args as never[],
    value: valueWei,
  });
  return { hash: hash as unknown as `0x${string}` };
}

/**
 * Waits for a submitted transaction to reach a decided consensus state
 * (ACCEPTED, UNDETERMINED, CANCELED, or a timeout) and reports whether
 * execution actually succeeded - a transaction can be accepted by
 * consensus while still having failed execution, so callers must check
 * this before treating the write as successful. Never assume success just
 * because a hash was returned.
 *
 * We intentionally poll for ACCEPTED rather than FINALIZED: the execution
 * result (and thus success/failure) is already known once consensus
 * accepts the transaction, but full FINALIZED status only lands after
 * studionet's separate finality window closes, which is unrelated to
 * whether the call itself succeeded and would otherwise make every write
 * feel like it hung or failed in the UI.
 */
export async function waitForFinality(
  read: { client: ReturnType<typeof createClient> },
  hash: `0x${string}`,
): Promise<{ finalized: boolean; succeeded: boolean; raw: unknown }> {
  const receipt = await read.client.waitForTransactionReceipt({
    hash: hash as unknown as Hash,
    status: TransactionStatus.ACCEPTED,
    retries: 40,
    interval: 3000,
  });
  const executionResultName = (receipt as { txExecutionResultName?: string }).txExecutionResultName;
  return {
    finalized: true,
    succeeded: executionResultName === 'FINISHED_WITH_RETURN',
    raw: receipt,
  };
}
