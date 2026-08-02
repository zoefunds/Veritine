'use client';

import { useCallback, useState } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import { VeritineWriteClient } from '@veritine/contract-client';

type WriteStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

/**
 * Provides a VeritineWriteClient bound to the connected wallet, plus
 * lifecycle state (pending/confirming/success/error) for the calling
 * component to render. Every write goes through the real deployed
 * contract - there is no mocked transaction path.
 */
export function useVeritineWrite() {
  const { address, isConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const [status, setStatus] = useState<WriteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const getClient = useCallback((): VeritineWriteClient => {
    if (!isConnected || !address) {
      throw new Error('Connect a wallet first');
    }
    const provider = (connectorClient as unknown as { transport?: unknown })?.transport;
    return new VeritineWriteClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
      account: address,
      provider: (typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum : provider) as unknown,
    });
  }, [address, isConnected, connectorClient]);

  const run = useCallback(
    async <T extends { hash: string; waitForFinality: () => Promise<{ succeeded: boolean }> }>(
      action: (client: VeritineWriteClient) => Promise<T>,
    ): Promise<T | null> => {
      setError(null);
      setTxHash(null);
      try {
        setStatus('pending');
        const client = getClient();
        const submitted = await action(client);
        setTxHash(submitted.hash);
        setStatus('confirming');
        const result = await submitted.waitForFinality();
        setStatus(result.succeeded ? 'success' : 'error');
        if (!result.succeeded) {
          setError('Transaction finalized but execution failed on-chain');
        }
        return submitted;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Transaction failed');
        return null;
      }
    },
    [getClient],
  );

  return { run, status, error, txHash };
}
