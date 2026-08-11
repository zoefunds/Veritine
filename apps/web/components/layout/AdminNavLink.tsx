'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { VeritineReadClient } from '@veritine/contract-client';

/**
 * Shows an "Admin" nav link only once the connected wallet is confirmed,
 * on-chain, to be the contract owner - checked dynamically against
 * get_config().owner rather than a hardcoded address, so it stays correct
 * if ownership is ever rotated via set_owner. Renders nothing for every
 * other wallet (or no wallet connected), matching the same "reveal
 * nothing to non-owners" rule /admin itself enforces.
 */
export function AdminNavLink(): React.ReactElement | null {
  const { address, isConnected } = useAccount();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    const client = new VeritineReadClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    });
    client
      .getConfig()
      .then((config) => {
        if (cancelled) return;
        const owner = (config as unknown as { owner: string }).owner;
        setIsOwner(typeof owner === 'string' && owner.toLowerCase() === address.toLowerCase());
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  if (!isOwner) {
    return null;
  }

  return (
    <Link href="/admin" className="text-on-surface-variant font-body-md text-body-sm hover:text-primary transition-colors">
      Admin
    </Link>
  );
}
