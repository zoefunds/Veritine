'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { formatGen } from '../../lib/format-gen';
import { parseGen } from '../../lib/parse-gen';
import { useVeritineWrite } from '../../hooks/useVeritineWrite';
import { apiFetch } from '../../lib/api-client';

export function WalletCard(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const [balanceWei, setBalanceWei] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const { run, status, error, txHash } = useVeritineWrite();

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setLoadingBalance(true);
    try {
      const client = new VeritineReadClient({
        contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
        network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
      });
      const balance = await client.getBalanceOf(address);
      setBalanceWei(String(balance));
    } catch {
      setBalanceWei(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const submitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(withdrawAmount);
    } catch {
      return;
    }
    await run((client) => client.withdraw(weiAmount.toString()));
    await refreshBalance();
  };

  if (!isConnected || !address) {
    return (
      <div className="bg-surface-container-high p-stack-md ghost-border rounded-lg">
        <p className="text-text-muted text-body-sm">Connect a wallet to see your Veritine balance.</p>
      </div>
    );
  }

  return (
    <section className="bg-surface-container-high p-stack-md ghost-border rounded-lg">
      <h2 className="font-label-caps text-label-caps text-text-muted mb-stack-md">Wallet &amp; Balance</h2>
      <div className="p-stack-sm bg-surface-container-lowest rounded-lg border border-border-subtle mb-stack-md">
        <label className="block font-label-caps text-[10px] text-text-muted uppercase mb-base">
          Current Address
        </label>
        <span className="font-code-sm text-code-sm text-primary break-all">{address}</span>
      </div>

      <div className="p-stack-sm bg-surface-container-lowest rounded-lg border border-border-subtle mb-stack-md">
        <label className="block font-label-caps text-[10px] text-text-muted uppercase mb-base">
          Claimable Balance (in-contract, not yet withdrawn)
        </label>
        <span className="font-display-lg text-2xl text-verified">
          {loadingBalance ? '...' : balanceWei !== null ? `${formatGen(balanceWei)} GEN` : 'Unavailable'}
        </span>
      </div>

      <form onSubmit={submitWithdraw} className="flex flex-col gap-stack-sm">
        <input
          type="text"
          placeholder="Amount to withdraw (GEN)"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          className="bg-surface-container-lowest border border-border-subtle text-body-sm px-3 py-2 rounded w-full"
        />
        <button
          type="submit"
          disabled={status === 'pending' || status === 'confirming'}
          className="w-full py-stack-sm bg-surface-container-highest hover:bg-surface-bright border border-border-subtle rounded-lg font-label-caps text-label-caps text-on-surface transition-colors disabled:opacity-50"
        >
          {status === 'pending' && 'Submitting...'}
          {status === 'confirming' && 'Waiting for finality...'}
          {(status === 'idle' || status === 'success' || status === 'error') && 'Withdraw to Wallet'}
        </button>
        {status === 'success' && <p className="text-verified text-body-sm">Confirmed: {txHash}</p>}
        {error && <p className="text-slashed text-body-sm">{error}</p>}
      </form>
    </section>
  );
}

interface MyPosition {
  id: string;
  disputeId: string | null;
  disputeQuestion: string;
  disputeStatus: string;
  positionLabel: string;
  amountWei: string;
  status: string;
  createdAt: string;
}

interface MyEvidence {
  id: string;
  disputeId: string | null;
  disputeQuestion: string;
  disputeStatus: string;
  positionLabel: string;
  sourceUrl: string;
  sourceTitle: string;
  submitterStakeWei: string;
  outcome: string | null;
  verificationStatus: string;
  submittedAt: string;
}

/**
 * Everything the connected wallet has staked on or submitted as evidence,
 * across every dispute - there was previously no way for a user to find
 * their own past activity except by remembering which disputes they'd
 * visited and re-checking each one by hand.
 */
export function MyActivity(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<MyPosition[]>([]);
  const [evidence, setEvidence] = useState<MyEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'positions' | 'evidence'>('positions');

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setEvidence([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ positions: MyPosition[]; evidence: MyEvidence[] }>(`/users/by-wallet/${address}/activity`)
      .then((body) => {
        if (cancelled) return;
        setPositions(body.positions);
        setEvidence(body.evidence);
      })
      .catch(() => {
        if (!cancelled) {
          setPositions([]);
          setEvidence([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!isConnected || !address) {
    return (
      <section className="bg-surface p-stack-md ghost-border rounded-lg">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile flex items-center gap-base mb-stack-md">
          <span className="material-symbols-outlined text-primary">history</span>
          My Activity
        </h2>
        <p className="text-text-muted text-body-sm">Connect a wallet to see what you&apos;ve staked or submitted.</p>
      </section>
    );
  }

  return (
    <section className="bg-surface p-stack-md ghost-border rounded-lg">
      <div className="flex items-center justify-between mb-stack-md">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile flex items-center gap-base">
          <span className="material-symbols-outlined text-primary">history</span>
          My Activity
        </h2>
        <div className="flex gap-1 bg-surface-container-lowest rounded p-1">
          <button
            type="button"
            onClick={() => setTab('positions')}
            className={`px-3 py-1 rounded font-label-caps text-[10px] transition-colors ${
              tab === 'positions' ? 'bg-primary-container text-on-primary-container' : 'text-text-muted'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('evidence')}
            className={`px-3 py-1 rounded font-label-caps text-[10px] transition-colors ${
              tab === 'evidence' ? 'bg-primary-container text-on-primary-container' : 'text-text-muted'
            }`}
          >
            Evidence ({evidence.length})
          </button>
        </div>
      </div>

      {loading && <p className="text-text-muted text-body-sm">Loading...</p>}

      {!loading && tab === 'positions' && (
        <div className="space-y-stack-sm">
          {positions.length === 0 && (
            <p className="text-text-muted text-body-sm">You haven&apos;t staked on any positions yet.</p>
          )}
          {positions.map((p) => (
            <Link
              key={p.id}
              href={p.disputeId ? `/disputes/${p.disputeId}` : '/disputes'}
              className="block p-stack-sm bg-surface-container-low ghost-border rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <div className="flex justify-between items-start gap-stack-sm">
                <div className="min-w-0">
                  <p className="font-body-md text-text-primary font-bold truncate">{p.disputeQuestion}</p>
                  <p className="text-text-muted text-body-sm">
                    Backed &ldquo;{p.positionLabel}&rdquo; &middot; {formatGen(p.amountWei)} GEN
                  </p>
                </div>
                <span className="shrink-0 bg-pending/10 text-pending font-label-caps text-[10px] px-2 py-0.5 rounded border border-pending/20">
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && tab === 'evidence' && (
        <div className="space-y-stack-sm">
          {evidence.length === 0 && (
            <p className="text-text-muted text-body-sm">You haven&apos;t submitted any evidence yet.</p>
          )}
          {evidence.map((e) => (
            <Link
              key={e.id}
              href={e.disputeId ? `/disputes/${e.disputeId}` : '/disputes'}
              className="block p-stack-sm bg-surface-container-low ghost-border rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <div className="flex justify-between items-start gap-stack-sm">
                <div className="min-w-0">
                  <p className="font-body-md text-text-primary font-bold truncate">{e.sourceTitle}</p>
                  <p className="text-text-muted text-body-sm truncate">
                    On &ldquo;{e.disputeQuestion}&rdquo; &middot; supports &ldquo;{e.positionLabel}&rdquo; &middot;{' '}
                    {formatGen(e.submitterStakeWei)} GEN
                  </p>
                </div>
                <span className="shrink-0 font-label-caps text-[10px] px-2 py-0.5 rounded border border-border-subtle text-text-muted">
                  {e.outcome ? e.outcome.replace(/_/g, ' ') : e.verificationStatus}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
