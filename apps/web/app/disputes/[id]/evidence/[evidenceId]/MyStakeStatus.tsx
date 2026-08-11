'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { formatGen } from '../../../../../lib/format-gen';

export function MyStakeStatus({ evidenceContractId }: { evidenceContractId: string }): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  const [stake, setStake] = useState<{ amountWei: string; claimed: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setStake(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const client = new VeritineReadClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    });
    client
      .getEvidenceStake(Number(evidenceContractId), address)
      .then((result) => {
        if (cancelled) return;
        setStake({ amountWei: String(result.amount_wei), claimed: result.claimed });
      })
      .catch(() => {
        if (!cancelled) setStake(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, evidenceContractId]);

  if (!isConnected || !address) {
    return <p className="text-text-muted text-body-sm">Connect a wallet to see your stake on this evidence.</p>;
  }

  if (loading) {
    return <p className="text-text-muted text-body-sm">Checking your stake...</p>;
  }

  if (!stake || BigInt(stake.amountWei) === BigInt(0)) {
    return <p className="text-text-muted text-body-sm">You have no stake on this evidence.</p>;
  }

  return (
    <div className="flex justify-between items-center text-body-sm">
      <span className="text-on-surface-variant">Your stake</span>
      <span className="font-code-sm text-on-surface">
        {formatGen(stake.amountWei)} GEN &middot;{' '}
        <span className={stake.claimed ? 'text-verified' : 'text-pending'}>
          {stake.claimed ? 'Claimed' : 'Unclaimed'}
        </span>
      </span>
    </div>
  );
}
