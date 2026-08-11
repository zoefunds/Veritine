'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { useVeritineWrite } from '../../hooks/useVeritineWrite';
import { formatGen } from '../../lib/format-gen';
import { parseGen } from '../../lib/parse-gen';

interface Config {
  owner: string;
  treasury_address: string;
  paused: boolean;
  protocol_fee_bps: number;
  slash_winner_share_bps: number;
  slash_treasury_share_bps: number;
  min_position_stake_wei: number;
  min_evidence_stake_wei: number;
}

interface Stats {
  accrued_treasury_wei: number;
}

const inputClass =
  'bg-surface-container-lowest border-subtle border border-border-subtle text-body-sm px-3 py-2 rounded focus:outline-none focus:border-primary-container w-full';

const buttonClass =
  'py-stack-sm px-stack-md bg-primary-container text-on-primary-container font-label-caps text-label-caps rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

function readClient(): VeritineReadClient {
  return new VeritineReadClient({
    contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
    network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
  });
}

function TxStatus({ status, error, txHash }: { status: string; error: string | null; txHash: string | null }): React.ReactElement | null {
  if (status === 'success' && txHash) {
    return <p className="text-verified text-body-sm">Confirmed: {txHash.slice(0, 10)}...{txHash.slice(-8)}</p>;
  }
  if (error) {
    return <p className="text-slashed text-body-sm">{error}</p>;
  }
  return null;
}

export function AdminClient(): React.ReactElement {
  const { address, isConnected } = useAccount();
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const client = readClient();
      const [cfg, platformStats] = await Promise.all([client.getConfig(), client.getPlatformStats()]);
      setConfig(cfg as unknown as Config);
      setStats(platformStats as unknown as Stats);
    } catch {
      setConfig(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Every non-owner state below (not connected, still checking, wrong
  // wallet, contract unreachable) renders the same neutral "not found"
  // copy - it must never reveal that this route is admin-gated, what
  // controls exist behind it, or the owner/treasury addresses, to a
  // visitor who is not the owner.
  const notFound = <p className="text-text-muted text-body-sm text-center mt-stack-lg">This page doesn&apos;t exist.</p>;

  if (!isConnected || !address || loading || !config || !stats) {
    return notFound;
  }

  const isOwner = address.toLowerCase() === config.owner.toLowerCase();

  if (!isOwner) {
    return notFound;
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <section className="mb-stack-sm">
        <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight mb-2">
          Contract Administration
        </h1>
        <p className="text-text-muted font-body-sm text-body-sm">
          Owner-gated controls, enforced on the contract itself &mdash; this page just surfaces them.
        </p>
      </section>
      <TreasurySweep accruedWei={stats.accrued_treasury_wei} onDone={refresh} />
      <PauseToggle paused={config.paused} onDone={refresh} />
      <FeesForm
        protocolFeeBps={config.protocol_fee_bps}
        slashWinnerShareBps={config.slash_winner_share_bps}
        onDone={refresh}
      />
      <MinimumsForm
        minPositionStakeWei={config.min_position_stake_wei}
        minEvidenceStakeWei={config.min_evidence_stake_wei}
        onDone={refresh}
      />
      <TreasuryAddressForm currentAddress={config.treasury_address} onDone={refresh} />
    </div>
  );
}

function TreasurySweep({ accruedWei, onDone }: { accruedWei: number; onDone: () => void }): React.ReactElement {
  const { run, status, error, txHash } = useVeritineWrite();

  const submit = async () => {
    const submitted = await run((client) => client.sweepTreasury());
    if (submitted) onDone();
  };

  return (
    <section className="bg-surface ghost-border p-stack-md rounded-lg border-t-4 border-primary">
      <h2 className="font-label-caps text-label-caps text-primary mb-stack-sm">Sweep Treasury</h2>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Protocol fees and the treasury&apos;s share of slashed evidence stakes accrue here rather than being sent
        anywhere automatically. Sweeping moves the accrued amount into the treasury address&apos;s withdrawable
        balance (permissionless &mdash; anyone can call this, not just the owner); from there the treasury address
        calls the normal <code>withdraw</code> to move it to its wallet.
      </p>
      <p className="text-body-md font-bold text-on-surface mb-stack-md">
        Accrued: <span className="text-primary">{formatGen(accruedWei)} GEN</span>
      </p>
      <button type="button" onClick={submit} disabled={status === 'pending' || status === 'confirming' || accruedWei === 0} className={buttonClass}>
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Sweeping...'}
        {(status === 'idle' || status === 'success' || status === 'error') && (accruedWei === 0 ? 'Nothing to sweep' : 'Sweep Treasury')}
      </button>
      <div className="mt-stack-sm">
        <TxStatus status={status} error={error} txHash={txHash} />
      </div>
    </section>
  );
}

function PauseToggle({ paused, onDone }: { paused: boolean; onDone: () => void }): React.ReactElement {
  const { run, status, error, txHash } = useVeritineWrite();

  const submit = async () => {
    const submitted = await run((client) => (paused ? client.unpause() : client.pause()));
    if (submitted) onDone();
  };

  return (
    <section className="bg-surface ghost-border p-stack-md rounded-lg">
      <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-sm">Platform Status</h2>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Pausing blocks new dispute creation and new stakes; it does not affect claims, withdrawals, or in-flight
        adjudication.
      </p>
      <p className="text-body-md font-bold mb-stack-md">
        Currently <span className={paused ? 'text-slashed' : 'text-verified'}>{paused ? 'PAUSED' : 'ACTIVE'}</span>
      </p>
      <button type="button" onClick={submit} disabled={status === 'pending' || status === 'confirming'} className={buttonClass}>
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && (paused ? 'Unpause Platform' : 'Pause Platform')}
      </button>
      <div className="mt-stack-sm">
        <TxStatus status={status} error={error} txHash={txHash} />
      </div>
    </section>
  );
}

function FeesForm({
  protocolFeeBps,
  slashWinnerShareBps,
  onDone,
}: {
  protocolFeeBps: number;
  slashWinnerShareBps: number;
  onDone: () => void;
}): React.ReactElement {
  const { run, status, error, txHash } = useVeritineWrite();
  const [fee, setFee] = useState(String(protocolFeeBps));
  const [winnerShare, setWinnerShare] = useState(String(slashWinnerShareBps));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitted = await run((client) => client.setFees(Number(fee), Number(winnerShare)));
    if (submitted) onDone();
  };

  return (
    <section className="bg-surface ghost-border p-stack-md rounded-lg">
      <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-sm">Fees</h2>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Protocol fee capped at 1,000 bps (10%) by the contract. Slash-pool treasury share is always
        10,000 &minus; winner share.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-sm">
        <label className="text-[11px] text-text-muted">Protocol fee (bps, max 1000)</label>
        <input type="number" min={0} max={1000} value={fee} onChange={(e) => setFee(e.target.value)} className={inputClass} required />
        <label className="text-[11px] text-text-muted">Slash-pool winner share (bps, 0-10000)</label>
        <input type="number" min={0} max={10000} value={winnerShare} onChange={(e) => setWinnerShare(e.target.value)} className={inputClass} required />
        <button type="submit" disabled={status === 'pending' || status === 'confirming'} className={buttonClass}>
          {status === 'pending' && 'Submitting...'}
          {status === 'confirming' && 'Waiting for finality...'}
          {(status === 'idle' || status === 'success' || status === 'error') && 'Update Fees'}
        </button>
        <TxStatus status={status} error={error} txHash={txHash} />
      </form>
    </section>
  );
}

function MinimumsForm({
  minPositionStakeWei,
  minEvidenceStakeWei,
  onDone,
}: {
  minPositionStakeWei: number;
  minEvidenceStakeWei: number;
  onDone: () => void;
}): React.ReactElement {
  const { run, status, error, txHash } = useVeritineWrite();
  const [minPosition, setMinPosition] = useState(formatGen(minPositionStakeWei));
  const [minEvidence, setMinEvidence] = useState(formatGen(minEvidenceStakeWei));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let positionWei: bigint;
    let evidenceWei: bigint;
    try {
      positionWei = parseGen(minPosition);
      evidenceWei = parseGen(minEvidence);
    } catch {
      return;
    }
    const submitted = await run((client) => client.setMinimums(positionWei, evidenceWei));
    if (submitted) onDone();
  };

  return (
    <section className="bg-surface ghost-border p-stack-md rounded-lg">
      <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-sm">Minimum Stakes</h2>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Applies to disputes created after this change &mdash; existing disputes keep the minimums they were created
        with.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-sm">
        <label className="text-[11px] text-text-muted">Min position stake (GEN)</label>
        <input type="text" value={minPosition} onChange={(e) => setMinPosition(e.target.value)} className={inputClass} required />
        <label className="text-[11px] text-text-muted">Min evidence stake (GEN)</label>
        <input type="text" value={minEvidence} onChange={(e) => setMinEvidence(e.target.value)} className={inputClass} required />
        <button type="submit" disabled={status === 'pending' || status === 'confirming'} className={buttonClass}>
          {status === 'pending' && 'Submitting...'}
          {status === 'confirming' && 'Waiting for finality...'}
          {(status === 'idle' || status === 'success' || status === 'error') && 'Update Minimums'}
        </button>
        <TxStatus status={status} error={error} txHash={txHash} />
      </form>
    </section>
  );
}

function TreasuryAddressForm({ currentAddress, onDone }: { currentAddress: string; onDone: () => void }): React.ReactElement {
  const { run, status, error, txHash } = useVeritineWrite();
  const [address, setAddress] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitted = await run((client) => client.setTreasuryAddress(address));
    if (submitted) {
      setAddress('');
      onDone();
    }
  };

  return (
    <section className="bg-surface ghost-border p-stack-md rounded-lg border-t-4 border-slashed">
      <h2 className="font-label-caps text-label-caps text-slashed mb-stack-sm">Treasury Address</h2>
      <p className="text-text-muted text-body-sm mb-stack-md">
        Where swept treasury funds are credited. Current: <span className="font-code-sm text-on-surface">{currentAddress}</span>
      </p>
      <form onSubmit={submit} className="flex flex-col gap-stack-sm max-w-sm">
        <input type="text" placeholder="New treasury address (0x...)" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} required />
        <button type="submit" disabled={status === 'pending' || status === 'confirming'} className={buttonClass}>
          {status === 'pending' && 'Submitting...'}
          {status === 'confirming' && 'Waiting for finality...'}
          {(status === 'idle' || status === 'success' || status === 'error') && 'Update Treasury Address'}
        </button>
        <TxStatus status={status} error={error} txHash={txHash} />
      </form>
    </section>
  );
}
