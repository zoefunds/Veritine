#!/usr/bin/env python3
"""
Veritine - Stage 05b: Wallet-connect frontend wiring.

Wires up Reown AppKit + wagmi in apps/web so users can actually connect
MetaMask/Rainbow/Zerion/WalletConnect-compatible wallets in the browser,
plus a hook implementing the nonce -> sign -> verify flow against the
backend auth endpoints built in Stage 05.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_05b_wallet_frontend.py

Safe to rerun: yes, overwrites the files it manages.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "apps/web/lib",
    "apps/web/hooks",
    "apps/web/components",
]

FILES = {}

FILES["apps/web/lib/genlayer-chain.ts"] = """import { defineChain } from 'viem';

/**
 * GenLayer StudioNet as a viem/wagmi chain definition. GENLAYER_CHAIN_ID
 * is intentionally left unset here and resolved from environment
 * configuration at runtime (see wallet-config.ts) - the exact chain id
 * is only known once the contract is deployed to StudioNet and the
 * network details are confirmed, per the project's deployment process.
 */
export function buildGenLayerChain(chainIdDecimal: number, rpcUrl: string) {
  return defineChain({
    id: chainIdDecimal,
    name: 'GenLayer StudioNet',
    nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
    testnet: true,
  });
}
"""

FILES["apps/web/lib/wallet-config.ts"] = """'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { buildGenLayerChain } from './genlayer-chain';

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
if (!projectId) {
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is required to initialize wallet connect');
}

// Falls back to a placeholder chain id (0) until NEXT_PUBLIC_GENLAYER_CHAIN_ID
// is set post-deployment - the app still renders, but write transactions
// should be gated on a real chain id being configured.
const chainIdDecimal = process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID
  ? Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID)
  : 0;
const rpcUrl = process.env.NEXT_PUBLIC_API_URL ? '' : ''; // placeholder, real RPC comes from GENLAYER_RPC_URL server-side
const genLayerStudioNet = buildGenLayerChain(chainIdDecimal || 61999, 'https://studio.genlayer.com/api');

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: [genLayerStudioNet],
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [genLayerStudioNet],
  projectId,
  metadata: {
    name: 'Veritine',
    description: 'A Staked Knowledge War - evidence-staking disputes adjudicated by GenLayer.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://veritine.app',
    icons: ['/logo.svg'],
  },
  features: {
    analytics: false,
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
"""

FILES["apps/web/app/providers.tsx"] = """'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '../lib/wallet-config';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
"""

FILES["apps/web/lib/api-client.ts"] = """const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Thin fetch wrapper that always sends the session cookie and parses JSON. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? String(body.message) : res.statusText;
    throw new Error(message);
  }

  return body as T;
}
"""

FILES["apps/web/hooks/useWalletAuth.ts"] = """'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { buildSignInMessage } from '@veritine/shared-config';
import { apiFetch } from '../lib/api-client';

interface AuthedUser {
  id: string;
  primaryWalletAddress: string;
  displayName: string | null;
}

type AuthStatus = 'idle' | 'requesting-nonce' | 'awaiting-signature' | 'verifying' | 'signed-in' | 'error';

/**
 * Implements the full nonce -> sign -> verify flow against the backend
 * auth endpoints. The message signed here is built with the exact same
 * buildSignInMessage the backend re-derives and checks - see
 * packages/shared-config/src/auth-message.ts.
 */
export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthedUser | null>(null);

  const signIn = useCallback(async () => {
    if (!isConnected || !address) {
      setError('Connect a wallet first');
      setStatus('error');
      return;
    }
    setError(null);
    try {
      setStatus('requesting-nonce');
      const { nonce, issuedAt } = await apiFetch<{ nonce: string; issuedAt: string }>('/auth/nonce', {
        method: 'POST',
        body: JSON.stringify({ address }),
      });

      const message = buildSignInMessage({ address, nonce, issuedAt });

      setStatus('awaiting-signature');
      const signature = await signMessageAsync({ message });

      setStatus('verifying');
      const verified = await apiFetch<AuthedUser>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ address, signature, nonce, issuedAt }),
      });

      setUser(verified);
      setStatus('signed-in');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setStatus('error');
    }
  }, [address, isConnected, signMessageAsync]);

  const signOut = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    setStatus('idle');
  }, []);

  return { status, error, user, signIn, signOut };
}
"""

FILES["apps/web/components/ConnectWalletButton.tsx"] = """'use client';

import { useAccount } from 'wagmi';
import { useWalletAuth } from '../hooks/useWalletAuth';

export function ConnectWalletButton(): React.ReactElement {
  const { isConnected } = useAccount();
  const { status, error, user, signIn, signOut } = useWalletAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <appkit-button />

      {isConnected && status !== 'signed-in' && (
        <button
          onClick={signIn}
          disabled={status === 'requesting-nonce' || status === 'awaiting-signature' || status === 'verifying'}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {status === 'idle' || status === 'error' ? 'Sign in with wallet' : 'Signing in...'}
        </button>
      )}

      {status === 'signed-in' && user && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Signed in as {user.primaryWalletAddress.slice(0, 6)}...{user.primaryWalletAddress.slice(-4)}
          </p>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      )}

      {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
    </div>
  );
}
"""


def main():
    for d in DIRS:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)

    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
