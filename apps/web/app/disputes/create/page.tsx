'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';
import { getVeritineReadClient } from '../../../lib/veritine-read-client';
import { apiFetch } from '../../../lib/api-client';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';

const CATEGORIES = ['CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER'];

const inputClass =
  'bg-surface-container-lowest border-subtle border border-border-subtle text-body-sm px-3 py-2 rounded focus:outline-none focus:border-primary-container w-full';

export default function CreateDisputePage(): React.ReactElement {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [redirecting, setRedirecting] = useState(false);

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

    const submitted = await run((client) =>
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

    if (!submitted) {
      // `run()` reports failure whenever waitForFinality's self-reported
      // `succeeded` flag reads false - which can be wrong (see its
      // docstring) while the dispute was actually created on-chain. We
      // can't safely assume success and navigate here the way the
      // success path below does (dispute_count - 1 would point at the
      // wrong dispute, or an unrelated existing one, if this really did
      // fail), so we stay on the form with the error shown - but still
      // fire a background sync of whatever the latest dispute id
      // currently is, best-effort, so that IF this was a misreport, the
      // explorer has already caught up by the time the user checks it
      // instead of waiting up to 5 minutes for the next cron tick.
      // Harmless no-op if the write genuinely failed (re-syncs an
      // already-current dispute).
      void (async () => {
        try {
          const readClient = getVeritineReadClient();
          const count = await readClient.getDisputeCount();
          if (count > 0) await apiFetch(`/indexer/sync/${count - 1}`, { method: 'POST' }).catch(() => null);
        } catch {
          // best-effort only
        }
      })();
      return;
    }

    // The chain write succeeded, but the dispute won't be visible in the
    // explorer until it's indexed into Postgres - the cron sync runs
    // every 5 minutes, far too slow right after a user's own action. New
    // dispute ids are sequential, so the just-created one is always
    // dispute_count - 1; sync that single id (cheap, bounded, no admin
    // key needed - see IndexerController.syncOne) before navigating so
    // it's already there when the user lands on the page.
    setRedirecting(true);
    try {
      const readClient = getVeritineReadClient();
      const count = await readClient.getDisputeCount();
      const newDisputeId = count - 1;
      await apiFetch(`/indexer/sync/${newDisputeId}`, { method: 'POST' }).catch(() => null);
      router.push(`/disputes/${newDisputeId}`);
    } catch {
      router.push('/disputes');
    }
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
                <span className="block normal-case text-text-muted/70 font-normal mt-0.5">
                  Floor required from others who stake a position later &mdash; not paid by you now.
                </span>
                <input value={minPositionStake} onChange={(e) => setMinPositionStake(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className="flex-1 text-label-caps text-text-muted">
                Min evidence stake (GEN)
                <span className="block normal-case text-text-muted/70 font-normal mt-0.5">
                  Floor required from others who submit evidence later &mdash; not paid by you now.
                </span>
                <input value={minEvidenceStake} onChange={(e) => setMinEvidenceStake(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <button
              type="submit"
              disabled={status === 'pending' || status === 'confirming' || redirecting}
              className="py-stack-sm bg-primary-container text-on-primary-container font-bold rounded hover:brightness-110 transition-all disabled:opacity-50"
            >
              {status === 'pending' && 'Submitting...'}
              {status === 'confirming' && 'Waiting for finality...'}
              {status === 'success' && redirecting && 'Opening your dispute...'}
              {(status === 'idle' || status === 'error' || (status === 'success' && !redirecting)) && 'Create Dispute'}
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
