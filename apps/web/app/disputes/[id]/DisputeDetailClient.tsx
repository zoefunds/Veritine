'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';
import { formatGen } from '../../../lib/format-gen';
import { apiFetch } from '../../../lib/api-client';

/**
 * After a write finalizes, the indexer needs to re-read the chain before
 * the change shows up anywhere (dispute totals, the position/evidence
 * lists, the dashboard's My Activity). Syncing just this one dispute is
 * cheap (bounded RPC calls - see IndexerController.syncOne) and safe to
 * call from the client without an admin key. router.refresh() then
 * re-runs this page's server-side data fetch so the newly-synced state
 * is visible without a manual reload.
 */
async function syncAndRefresh(disputeContractId: string, router: ReturnType<typeof useRouter>): Promise<void> {
  await apiFetch(`/indexer/sync/${disputeContractId}`, { method: 'POST' }).catch(() => null);
  router.refresh();
}

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
  const router = useRouter();
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
    // Always sync, even when the write is reported as failed - the
    // dispute id is already known here (never guessed from a success
    // assumption), so this is a safe, harmless refresh either way. A
    // write can be misreported as failed (see waitForFinality's
    // docstring) while having actually succeeded on-chain; gating this
    // sync behind `submitted` left the UI stuck showing stale state
    // for up to the next 5-minute cron tick in that case.
    await syncAndRefresh(disputeContractId, router);
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
  const router = useRouter();
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
    // Always sync, even when the write is reported as failed - the
    // dispute id is already known here (never guessed from a success
    // assumption), so this is a safe, harmless refresh either way. A
    // write can be misreported as failed (see waitForFinality's
    // docstring) while having actually succeeded on-chain; gating this
    // sync behind `submitted` left the UI stuck showing stale state
    // for up to the next 5-minute cron tick in that case.
    await syncAndRefresh(disputeContractId, router);
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

const ADJUDICABLE_STATUSES = new Set(['ACTIVE', 'EVIDENCE_CLOSED']);

/**
 * request_adjudication is permissionless on the contract - anyone can
 * call it once the evidence deadline has passed - but nothing in the UI
 * ever called it, so there was no way for a user to actually trigger
 * settlement short of a manual RPC call. This surfaces it as a real
 * button once the deadline has passed and the dispute hasn't already
 * been settled.
 */
export function RequestAdjudicationButton({
  disputeContractId,
  evidenceDeadline,
  status,
}: {
  disputeContractId: string;
  evidenceDeadline: string;
  status: string;
}): React.ReactElement | null {
  const router = useRouter();
  const { run, status: writeStatus, error, txHash } = useVeritineWrite();
  const deadlinePassed = Date.now() > new Date(evidenceDeadline).getTime();

  if (!deadlinePassed || !ADJUDICABLE_STATUSES.has(status)) {
    return null;
  }

  const submit = async () => {
    await run((client) => client.requestAdjudication(Number(disputeContractId)));
    // Always sync, even when the write is reported as failed - the
    // dispute id is already known here (never guessed from a success
    // assumption), so this is a safe, harmless refresh either way. A
    // write can be misreported as failed (see waitForFinality's
    // docstring) while having actually succeeded on-chain; gating this
    // sync behind `submitted` left the UI stuck showing stale state
    // for up to the next 5-minute cron tick in that case.
    await syncAndRefresh(disputeContractId, router);
  };

  return (
    <div className="bg-surface ghost-border p-stack-md rounded-lg border-t-4 border-tertiary">
      <h3 className="font-label-caps text-label-caps text-tertiary mb-stack-sm">Evidence Window Closed</h3>
      <p className="text-text-muted text-body-sm mb-stack-md">
        This dispute&apos;s evidence deadline has passed and it hasn&apos;t been settled yet.
        Adjudication is permissionless &mdash; anyone can trigger it, including you.
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={writeStatus === 'pending' || writeStatus === 'confirming'}
        className={buttonClass}
      >
        {writeStatus === 'pending' && 'Submitting...'}
        {writeStatus === 'confirming' && 'Running adjudication...'}
        {(writeStatus === 'idle' || writeStatus === 'success' || writeStatus === 'error') && 'Request Adjudication'}
      </button>
      <div className="mt-stack-sm">
        <TxStatus status={writeStatus} error={error} txHash={txHash} />
      </div>
    </div>
  );
}

const SETTLED_STATUSES = new Set(['ADJUDICATED', 'CANCELLED', 'INVALID']);

/**
 * claim_position exists on the contract (full refund, or principal plus a
 * share of the losing pool for a winning position) but nothing in the UI
 * ever called it - stakers had no way to actually receive their payout
 * short of a manual RPC call. Shows the connected wallet's stake per
 * position once the dispute is settled, with a claim button per
 * unclaimed, non-zero stake.
 */
export function MyPositionStakes({
  disputeContractId,
  positions,
  status,
}: {
  disputeContractId: string;
  positions: Position[];
  status: string;
}): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [stakes, setStakes] = useState<Array<{ amountWei: string; claimed: boolean } | null>>([]);
  const [loading, setLoading] = useState(false);
  const { run, status: writeStatus, error, txHash } = useVeritineWrite();
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!address) {
      setStakes([]);
      return;
    }
    setLoading(true);
    try {
      const client = new VeritineReadClient({
        contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
        network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
      });
      const results = await Promise.all(
        positions.map((_, i) =>
          client
            .getPositionStake(Number(disputeContractId), i, address)
            .then((r) => ({ amountWei: String(r.amount_wei), claimed: r.claimed }))
            .catch(() => null),
        ),
      );
      setStakes(results);
    } finally {
      setLoading(false);
    }
  }, [address, disputeContractId, positions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!SETTLED_STATUSES.has(status) || !isConnected || !address || loading) {
    return null;
  }

  const claimable = stakes
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s && BigInt(s.amountWei) > BigInt(0));

  if (claimable.length === 0) {
    return null;
  }

  const claim = async (positionIndex: number) => {
    setClaimingIndex(positionIndex);
    await run((client) => client.claimPosition(Number(disputeContractId), positionIndex));
    await refresh();
    await syncAndRefresh(disputeContractId, router);
    setClaimingIndex(null);
  };

  return (
    <div className="bg-surface ghost-border p-stack-md rounded">
      <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md">Your Position Stakes</h3>
      <div className="flex flex-col gap-stack-sm">
        {claimable.map(({ s, i }) => (
          <div key={i} className="flex items-center justify-between text-body-sm">
            <span className="text-on-surface-variant">
              {positions[i].label}: <span className="font-code-sm text-on-surface">{formatGen(s!.amountWei)} GEN</span>
            </span>
            {s!.claimed ? (
              <span className="text-verified text-[11px] font-label-caps">Claimed</span>
            ) : (
              <button
                type="button"
                onClick={() => claim(i)}
                disabled={writeStatus === 'pending' || writeStatus === 'confirming'}
                className="py-1 px-3 bg-primary-container text-on-primary-container font-label-caps text-[11px] rounded hover:brightness-110 transition-all disabled:opacity-50"
              >
                {claimingIndex === i && (writeStatus === 'pending' || writeStatus === 'confirming') ? 'Claiming...' : 'Claim'}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-stack-sm">
        <TxStatus status={writeStatus} error={error} txHash={txHash} />
      </div>
    </div>
  );
}

/**
 * cancel_dispute exists on the contract - creator-only before any other
 * participation, or owner as an emergency override - but had no UI
 * caller. Shown only to the connected creator (owner override is handled
 * from /admin, not surfaced here, to avoid implying every owner action
 * belongs scattered across every dispute page).
 */
export function CancelDisputeButton({
  disputeContractId,
  creator,
  status,
}: {
  disputeContractId: string;
  creator: string;
  status: string;
}): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { run, status: writeStatus, error, txHash } = useVeritineWrite();

  const isCreator = isConnected && address && address.toLowerCase() === creator.toLowerCase();
  if (!isCreator || !ADJUDICABLE_STATUSES.has(status)) {
    return null;
  }

  const submit = async () => {
    await run((client) => client.cancelDispute(Number(disputeContractId)));
    await syncAndRefresh(disputeContractId, router);
  };

  return (
    <div className="bg-surface ghost-border p-stack-md rounded-lg border-t-4 border-slashed">
      <h3 className="font-label-caps text-label-caps text-slashed mb-stack-sm">Cancel Dispute</h3>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Only available before anyone else has staked or submitted evidence. Cancelling makes every existing stake
        (including your own) fully refundable &mdash; no fees, no slashing.
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={writeStatus === 'pending' || writeStatus === 'confirming'}
        className="py-stack-sm px-stack-md bg-surface-container-highest hover:bg-surface-bright border border-border-subtle rounded font-label-caps text-label-caps text-on-surface transition-colors disabled:opacity-50"
      >
        {writeStatus === 'pending' && 'Submitting...'}
        {writeStatus === 'confirming' && 'Cancelling...'}
        {(writeStatus === 'idle' || writeStatus === 'success' || writeStatus === 'error') && 'Cancel Dispute'}
      </button>
      <div className="mt-stack-sm">
        <TxStatus status={writeStatus} error={error} txHash={txHash} />
      </div>
    </div>
  );
}
