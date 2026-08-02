'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';
import { formatGen } from '../../lib/format-gen';
import { parseGen } from '../../lib/parse-gen';
import { useVeritineWrite } from '../../hooks/useVeritineWrite';

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
