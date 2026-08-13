'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../../../hooks/useVeritineWrite';
import { parseGen } from '../../../../../lib/parse-gen';
import { formatGen } from '../../../../../lib/format-gen';

const inputClass =
  'bg-surface-container-lowest border-subtle border border-border-subtle text-body-sm px-3 py-2 rounded focus:outline-none focus:border-primary-container w-full';

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

/**
 * stake_evidence exists on the contract - back someone ELSE's
 * already-submitted evidence with additional GEN, sharing that item's
 * economic outcome without resubmitting the source/metadata - but
 * nothing in the UI ever called it.
 */
export function BackEvidenceForm({
  evidenceContractId,
  minStakeWei,
}: {
  evidenceContractId: string;
  minStakeWei: string;
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const minStakeGen = formatGen(minStakeWei);
  const belowMinimum = amount.trim() !== '' && (() => {
    try {
      return parseGen(amount) < BigInt(minStakeWei);
    } catch {
      return false;
    }
  })();

  if (!isConnected) {
    return <p className="text-text-muted text-body-sm">Connect a wallet to back this evidence with additional stake.</p>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(amount);
    } catch {
      return;
    }
    await run((client) => client.stakeEvidence(Number(evidenceContractId), weiAmount));
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-sm">
      <p className="text-text-muted text-body-sm">
        Back this evidence with your own stake &mdash; you&apos;ll share its economic outcome (reward or slash)
        proportionally, without submitting a separate source.
      </p>
      <input
        type="text"
        placeholder="Amount in GEN"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={inputClass}
        required
      />
      <p className={`text-[11px] ${belowMinimum ? 'text-slashed' : 'text-text-muted'}`}>
        Minimum stake for this dispute: {minStakeGen} GEN
      </p>
      <button type="submit" disabled={status === 'pending' || status === 'confirming' || belowMinimum} className={buttonClass}>
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Back This Evidence'}
      </button>
      <TxStatus status={status} error={error} txHash={txHash} />
    </form>
  );
}
