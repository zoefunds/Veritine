'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';

const CATEGORIES = ['CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER'];

export default function CreateDisputePage(): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [positionA, setPositionA] = useState('Yes');
  const [positionB, setPositionB] = useState('No');
  const [participationDays, setParticipationDays] = useState('7');
  const [evidenceDays, setEvidenceDays] = useState('14');
  const [minPositionStake, setMinPositionStake] = useState('0');
  const [minEvidenceStake, setMinEvidenceStake] = useState('0');

  const inputStyle = {
    padding: '0.5rem',
    background: 'var(--surface-container-lowest)',
    color: 'inherit',
    border: '1px solid var(--border-subtle)',
  } as const;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Math.floor(Date.now() / 1000);
    const participationDeadlineTs = now + Number(participationDays) * 86400;
    const evidenceDeadlineTs = now + Number(evidenceDays) * 86400;

    let minPositionWei: bigint;
    let minEvidenceWei: bigint;
    try {
      minPositionWei = parseGen(minPositionStake || '0');
      minEvidenceWei = parseGen(minEvidenceStake || '0');
    } catch {
      return;
    }

    await run((client) =>
      client.createDispute({
        question,
        description,
        category,
        positionLabelsJson: JSON.stringify([positionA, positionB]),
        participationDeadlineTs,
        evidenceDeadlineTs,
        minPositionStakeWei: minPositionWei.toString(),
        minEvidenceStakeWei: minEvidenceWei.toString(),
      }),
    );
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Create a Dispute</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        The question must be factually adjudicable - specific enough to evaluate against evidence. Unsupported
        opinions or ambiguous claims will produce inconclusive results.
      </p>

      {!isConnected ? (
        <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to create a dispute.</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            placeholder="Dispute question (e.g. 'Did Company X reduce emissions by 40%?')"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ ...inputStyle, minHeight: '60px' }}
            required
          />
          <textarea
            placeholder="Additional context"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: '80px' }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input placeholder="Position A label" value={positionA} onChange={(e) => setPositionA(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
            <input placeholder="Position B label" value={positionB} onChange={(e) => setPositionB(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Participation window (days)
              <input type="number" min="1" value={participationDays} onChange={(e) => setParticipationDays(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Evidence window (days)
              <input type="number" min="1" value={evidenceDays} onChange={(e) => setEvidenceDays(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Min position stake (GEN)
              <input value={minPositionStake} onChange={(e) => setMinPositionStake(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Min evidence stake (GEN)
              <input value={minEvidenceStake} onChange={(e) => setMinEvidenceStake(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
          </div>
          <button
            type="submit"
            disabled={status === 'pending' || status === 'confirming'}
            style={{ padding: '0.75rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
          >
            {status === 'pending' && 'Submitting...'}
            {status === 'confirming' && 'Waiting for finality...'}
            {(status === 'idle' || status === 'success' || status === 'error') && 'Create Dispute'}
          </button>
          {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
          {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
