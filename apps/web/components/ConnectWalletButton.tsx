'use client';

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
