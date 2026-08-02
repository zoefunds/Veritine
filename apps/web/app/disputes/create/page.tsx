'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';

const CATEGORIES = ['CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER'];

const inputClass =
  'bg-surface-container-lowest border-subtle border border-border-subtle text-body-sm px-3 py-2 rounded focus:outline-none focus:border-primary-container w-full';

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
        minPositionStakeWei: minPositionWei,
        minEvidenceStakeWei: minEvidenceWei,
      }),
    );
  };

  return (
    <>
      <Navbar />
      <main className="mt-24 max-w-[640px] mx-auto px-gutter-mobile pb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">Create a Dispute</h1>
        <p className="text-text-muted mb-stack-lg text-body-sm">
          The question must be factually adjudicable &mdash; specific enough to evaluate against evidence.
          Unsupported opinions or ambiguous claims will produce inconclusive results, not a decisive answer.
        </p>

        {!isConnected ? (
          <p className="text-text-muted">Connect a wallet to create a dispute.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-stack-sm bg-surface ghost-border rounded-lg p-stack-md">
            <textarea
              placeholder="Dispute question (e.g. 'Did Company X reduce emissions by 40%?')"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={`${inputClass} min-h-[60px]`}
              required
            />
            <textarea
              placeholder="Additional context"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-h-[80px]`}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex gap-stack-sm">
              <input
                placeholder="Position A label"
                value={positionA}
                onChange={(e) => setPositionA(e.target.value)}
                className={inputClass}
                required
              />
              <input
                placeholder="Position B label"
                value={positionB}
                onChange={(e) => setPositionB(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="flex gap-stack-sm">
              <label className="flex-1 text-label-caps text-text-muted">
                Participation window (days)
                <input
                  type="number"
                  min="1"
                  value={participationDays}
                  onChange={(e) => setParticipationDays(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="flex-1 text-label-caps text-text-muted">
                Evidence window (days)
                <input
                  type="number"
                  min="1"
                  value={evidenceDays}
                  onChange={(e) => setEvidenceDays(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </label>
            </div>
            <div className="flex gap-stack-sm">
              <label className="flex-1 text-label-caps text-text-muted">
                Min position stake (GEN)
                <input value={minPositionStake} onChange={(e) => setMinPositionStake(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className="flex-1 text-label-caps text-text-muted">
                Min evidence stake (GEN)
                <input value={minEvidenceStake} onChange={(e) => setMinEvidenceStake(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <button
              type="submit"
              disabled={status === 'pending' || status === 'confirming'}
              className="py-stack-sm bg-primary-container text-on-primary-container font-bold rounded hover:brightness-110 transition-all disabled:opacity-50"
            >
              {status === 'pending' && 'Submitting...'}
              {status === 'confirming' && 'Waiting for finality...'}
              {(status === 'idle' || status === 'success' || status === 'error') && 'Create Dispute'}
            </button>
            {status === 'success' && <p className="text-verified text-body-sm">Confirmed: {txHash}</p>}
            {error && <p className="text-slashed text-body-sm">{error}</p>}
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
