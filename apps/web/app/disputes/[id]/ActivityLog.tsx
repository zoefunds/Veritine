'use client';

import { useEffect, useState } from 'react';
import { VeritineReadClient } from '@veritine/contract-client';
import { formatGen } from '../../../lib/format-gen';

interface ActivityEvent {
  kind: string;
  actor: string;
  amount_wei: number;
  ts: number;
  note: string;
}

const KIND_LABEL: Record<string, string> = {
  STAKE_POSITION: 'Staked on a position',
  SUBMIT_EVIDENCE: 'Submitted evidence',
  STAKE_EVIDENCE: 'Backed evidence',
  CLAIM_POSITION: 'Claimed a position payout',
  CLAIM_EVIDENCE: 'Claimed an evidence payout',
  CANCEL: 'Dispute cancelled',
  TIMEOUT: 'Adjudication timed out',
};

/**
 * get_activity exists on the contract - a per-dispute, append-only log of
 * every stake/claim/cancel event - but nothing in the UI ever read it.
 * Shows the raw on-chain activity feed for transparency, independent of
 * whatever the backend's indexed mirror shows.
 */
export function ActivityLog({ disputeContractId }: { disputeContractId: string }): React.ReactElement | null {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = new VeritineReadClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    });
    client
      .getActivity(Number(disputeContractId), 0, 25)
      .then((result) => {
        if (!cancelled) setEvents(result as unknown as ActivityEvent[]);
      })
      .catch(() => {
        if (!cancelled) setEvents(null);
      });
    return () => {
      cancelled = true;
    };
  }, [disputeContractId]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface ghost-border p-stack-md">
      <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
        ON-CHAIN ACTIVITY
      </h3>
      <div className="space-y-stack-sm max-h-[320px] overflow-y-auto">
        {events.map((e, i) => (
          <div key={i} className="flex justify-between items-start text-body-sm gap-stack-sm">
            <div className="min-w-0">
              <p className="text-on-surface">{KIND_LABEL[e.kind] ?? e.kind}</p>
              <p className="text-[11px] text-text-muted font-code-sm truncate">
                {e.actor.slice(0, 6)}...{e.actor.slice(-4)} &middot; {new Date(e.ts * 1000).toLocaleString()}
              </p>
            </div>
            {e.amount_wei > 0 && (
              <span className="font-code-sm text-primary shrink-0">{formatGen(e.amount_wei)} GEN</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
