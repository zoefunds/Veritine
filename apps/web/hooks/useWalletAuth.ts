'use client';

import { useCallback, useEffect, useState } from 'react';
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

  /**
   * The backend already issues a long-lived httpOnly session cookie on
   * /auth/verify, but this hook's `user` state resets to null on every
   * mount - without this, the UI showed "Sign in" after every page
   * reload even though the session cookie was still valid server-side.
   * Restore the session from the cookie via /auth/me on mount, but only
   * treat it as signed-in if it matches the wallet wagmi currently has
   * connected - a stale session cookie for a previously connected
   * address should not be presented as signed-in for a different one.
   */
  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    apiFetch<AuthedUser>('/auth/me')
      .then((existing) => {
        if (cancelled) return;
        if (existing.primaryWalletAddress.toLowerCase() === address.toLowerCase()) {
          setUser(existing);
          setStatus('signed-in');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isConnected, address]);

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
