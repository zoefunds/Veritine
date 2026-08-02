'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';
import { formatGen } from '../../../lib/format-gen';

interface Position {
  contractPositionId: string;
  label: string;
  totalStakeWei: string;
}

const inputClass =
  'bg-surface-container-lowest border-subtle border border-border-subtle text-body-sm px-3 py-2 rounded focus:outline-none focus:border-primary-container w-full';

const buttonClass =
  'w-full py-stack-sm bg-primary-container text-on-primary-container font-label-caps text-label-caps rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

function TxStatus({ status, error, txHash }: { status: string; error: string | null; txHash: string | null }): React.ReactElement | null {
  if (status === 'success' && txHash) {
    return <p className="text-verified text-body-sm">Confirmed: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>;
  }
  if (error) {
    return <p className="text-slashed text-body-sm">{error}</p>;
  }
  return null;
}

export function StakePositionForm({
  disputeContractId,
  positions,
  minStakeWei,
}: {
  disputeContractId: string;
  positions: Position[];
  minStakeWei: string;
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [positionIndex, setPositionIndex] = useState(0);
  const [amount, setAmount] = useState('');
  const minStakeGen = formatGen(minStakeWei);
  const belowMinimum = amount.trim() !== '' && (() => {
    try {
      return parseGen(amount) < BigInt(minStakeWei);
    } catch {
      return false;
    }
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(amount);
    } catch {
      return;
    }
    await run((client) => client.stakePosition(Number(disputeContractId), positionIndex, weiAmount));
  };

  if (!isConnected) {
    return <p className="text-text-muted text-body-sm">Connect a wallet to stake on a position.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-sm">
      <select value={positionIndex} onChange={(e) => setPositionIndex(Number(e.target.value))} className={inputClass}>
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            {p.label}
          </option>
        ))}
      </select>
      <div>
        <input
          type="text"
          placeholder="Amount in GEN"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
          required
        />
        <p className={`text-[11px] mt-1 ${belowMinimum ? 'text-slashed' : 'text-text-muted'}`}>
          Minimum stake for this dispute: {minStakeGen} GEN
        </p>
      </div>
      <button type="submit" disabled={status === 'pending' || status === 'confirming' || belowMinimum} className={buttonClass}>
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Stake on Position'}
      </button>
      <TxStatus status={status} error={error} txHash={txHash} />
    </form>
  );
}

export function SubmitEvidenceForm({
  disputeContractId,
  positions,
  minStakeWei,
}: {
  disputeContractId: string;
  positions: Position[];
  minStakeWei: string;
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [positionIndex, setPositionIndex] = useState(0);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [publisher, setPublisher] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceType, setSourceType] = useState('REPUTABLE_JOURNALISM');
  const [amount, setAmount] = useState('');
  const minStakeGen = formatGen(minStakeWei);
  const belowMinimum = amount.trim() !== '' && (() => {
    try {
      return parseGen(amount) < BigInt(minStakeWei);
    } catch {
      return false;
    }
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(amount);
    } catch {
      return;
    }
    await run((client) =>
      client.submitEvidence({
        disputeId: Number(disputeContractId),
        positionIndex,
        sourceUrl,
        sourceTitle,
        publisher,
        publicationDate: '',
        summary,
        sourceType,
        valueWei: weiAmount,
      }),
    );
  };

  if (!isConnected) {
    return <p className="text-text-muted text-body-sm">Connect a wallet to submit evidence.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-md">
      <select value={positionIndex} onChange={(e) => setPositionIndex(Number(e.target.value))} className={inputClass}>
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            Supports: {p.label}
          </option>
        ))}
      </select>
      <input type="url" placeholder="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={inputClass} required />
      <input type="text" placeholder="Source title" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} className={inputClass} required />
      <input type="text" placeholder="Publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} className={inputClass} required />
      <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
        {[
          'PRIMARY_SOURCE',
          'OFFICIAL_REPORT',
          'REGULATORY_FILING',
          'GOVERNMENT_RECORD',
          'PEER_REVIEWED_RESEARCH',
          'INDEPENDENT_INVESTIGATION',
          'REPUTABLE_JOURNALISM',
          'ORGANIZATIONAL_PUBLICATION',
          'COMMUNITY_GENERATED',
          'SOCIAL_MEDIA',
          'ARCHIVED_SOURCE',
          'ANONYMOUS_SOURCE',
        ].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <textarea
        placeholder="How does this evidence support the position? (min 20 chars)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className={`${inputClass} min-h-[80px]`}
        required
      />
      <div>
        <input type="text" placeholder="Stake amount in GEN" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
        <p className={`text-[11px] mt-1 ${belowMinimum ? 'text-slashed' : 'text-text-muted'}`}>
          Minimum stake for this dispute: {minStakeGen} GEN
        </p>
      </div>
      <button type="submit" disabled={status === 'pending' || status === 'confirming' || belowMinimum} className={buttonClass}>
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Submit Evidence'}
      </button>
      <TxStatus status={status} error={error} txHash={txHash} />
    </form>
  );
}
