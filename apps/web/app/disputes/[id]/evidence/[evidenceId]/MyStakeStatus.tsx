'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { useVeritineWrite } from '../../../../../hooks/useVeritineWrite';
import { formatGen } from '../../../../../lib/format-gen';

const buttonClass =
  'py-stack-sm px-stack-md bg-primary-container text-on-primary-container font-label-caps text-label-caps rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

function TxStatus({ status, error, txHash }: { status: string; error: string | null; txHash: string | null }): React.ReactElement | null {
  if (status === 'success' && txHash) {
    return <p className="text-verified text-body-sm">Confirmed: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>;
  }
  if (error) {
    return <p className="text-slashed text-body-sm">{error}</p>;
  }
  return null;
}

export function MyStakeStatus({ evidenceContractId }: { evidenceContractId: string }): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  const [stake, setStake] = useState<{ amountWei: string; claimed: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const { run, status, error, txHash } = useVeritineWrite();

  const refresh = useCallback(async () => {
    if (!address) {
      setStake(null);
      return;
    }
    setLoading(true);
    try {
      const client = new VeritineReadClient({
        contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
        network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
      });
      const result = await client.getEvidenceStake(Number(evidenceContractId), address);
      setStake({ amountWei: String(result.amount_wei), claimed: result.claimed });
    } catch {
      setStake(null);
    } finally {
      setLoading(false);
    }
  }, [address, evidenceContractId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claim = async () => {
    await run((client) => client.claimEvidence(Number(evidenceContractId)));
    await refresh();
  };

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
    <div className="flex flex-col gap-stack-sm">
      <div className="flex justify-between items-center text-body-sm">
        <span className="text-on-surface-variant">Your stake</span>
        <span className="font-code-sm text-on-surface">
          {formatGen(stake.amountWei)} GEN &middot;{' '}
          <span className={stake.claimed ? 'text-verified' : 'text-pending'}>
            {stake.claimed ? 'Claimed' : 'Unclaimed'}
          </span>
        </span>
      </div>
      {!stake.claimed && (
        <div>
          <button type="button" onClick={claim} disabled={status === 'pending' || status === 'confirming'} className={buttonClass}>
            {status === 'pending' && 'Submitting...'}
            {status === 'confirming' && 'Claiming...'}
            {(status === 'idle' || status === 'success' || status === 'error') && 'Claim'}
          </button>
          <p className="text-[11px] text-text-muted mt-1">
            Moves your payout (reward, refund, or slashed remainder) into your contract balance, withdrawable from{' '}
            the Dashboard. Only claimable once this dispute has been adjudicated.
          </p>
          <div className="mt-1">
            <TxStatus status={status} error={error} txHash={txHash} />
          </div>
        </div>
      )}
    </div>
  );
}
