'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';

interface Position {
  contractPositionId: string;
  label: string;
  totalStakeWei: string;
}

export function StakePositionForm({
  disputeContractId,
  positions,
}: {
  disputeContractId: string;
  positions: Position[];
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [positionIndex, setPositionIndex] = useState(0);
  const [amount, setAmount] = useState('');

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
    return <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to stake on a position.</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '360px' }}>
      <select
        value={positionIndex}
        onChange={(e) => setPositionIndex(Number(e.target.value))}
        style={{ padding: '0.5rem', background: 'var(--surface-container-lowest)', color: 'inherit', border: '1px solid var(--border-subtle)' }}
      >
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Amount in GEN"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: '0.5rem', background: 'var(--surface-container-lowest)', color: 'inherit', border: '1px solid var(--border-subtle)' }}
      />
      <button
        type="submit"
        disabled={status === 'pending' || status === 'confirming'}
        style={{ padding: '0.5rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
      >
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Stake on Position'}
      </button>
      {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
      {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
    </form>
  );
}

export function SubmitEvidenceForm({
  disputeContractId,
  positions,
}: {
  disputeContractId: string;
  positions: Position[];
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
    return <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to submit evidence.</p>;
  }

  const inputStyle = {
    padding: '0.5rem',
    background: 'var(--surface-container-lowest)',
    color: 'inherit',
    border: '1px solid var(--border-subtle)',
  } as const;

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '480px' }}>
      <select value={positionIndex} onChange={(e) => setPositionIndex(Number(e.target.value))} style={inputStyle}>
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            Supports: {p.label}
          </option>
        ))}
      </select>
      <input type="url" placeholder="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={inputStyle} required />
      <input type="text" placeholder="Source title" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} style={inputStyle} required />
      <input type="text" placeholder="Publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} style={inputStyle} required />
      <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={inputStyle}>
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
        style={{ ...inputStyle, minHeight: '80px' }}
        required
      />
      <input type="text" placeholder="Stake amount in GEN" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} required />
      <button
        type="submit"
        disabled={status === 'pending' || status === 'confirming'}
        style={{ padding: '0.5rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
      >
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Submit Evidence'}
      </button>
      {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
      {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
    </form>
  );
}
