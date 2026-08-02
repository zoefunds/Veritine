'use client';

import { useAccount } from 'wagmi';
import { useWalletAuth } from '../hooks/useWalletAuth';

interface ConnectWalletButtonProps {
  /** Compact horizontal layout for the navbar; default is a stacked, more detailed layout. */
  compact?: boolean;
}

export function ConnectWalletButton({ compact = false }: ConnectWalletButtonProps): React.ReactElement {
  const { isConnected } = useAccount();
  const { status, error, user, signIn, signOut } = useWalletAuth();

  if (compact) {
    return (
      <div className="flex items-center gap-stack-sm">
        {status === 'signed-in' && user ? (
          <button
            onClick={signOut}
            className="bg-primary-container text-on-primary-container px-stack-md py-base font-label-caps text-label-caps rounded-lg hover:scale-95 transition-transform active:scale-90"
          >
            {user.primaryWalletAddress.slice(0, 6)}...{user.primaryWalletAddress.slice(-4)}
          </button>
        ) : (
          <>
            <appkit-button />
            {isConnected && (
              <button
                onClick={signIn}
                disabled={status === 'requesting-nonce' || status === 'awaiting-signature' || status === 'verifying'}
                className="bg-primary-container text-on-primary-container px-stack-md py-base font-label-caps text-label-caps rounded-lg hover:scale-95 transition-transform active:scale-90"
              >
                {status === 'idle' || status === 'error' ? 'Sign in' : 'Signing in...'}
              </button>
            )}
          </>
        )}
        {error && <p className="text-slashed text-body-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-stack-sm">
      <appkit-button />

      {isConnected && status !== 'signed-in' && (
        <button
          onClick={signIn}
          disabled={status === 'requesting-nonce' || status === 'awaiting-signature' || status === 'verifying'}
          className="px-stack-lg py-stack-sm rounded-lg bg-primary-container text-on-primary-container border-none cursor-pointer"
        >
          {status === 'idle' || status === 'error' ? 'Sign in with wallet' : 'Signing in...'}
        </button>
      )}

      {status === 'signed-in' && user && (
        <div className="text-center">
          <p className="text-text-muted text-body-sm">
            Signed in as {user.primaryWalletAddress.slice(0, 6)}...{user.primaryWalletAddress.slice(-4)}
          </p>
          <button onClick={signOut} className="bg-transparent border-none text-primary cursor-pointer">
            Sign out
          </button>
        </div>
      )}

      {error && <p className="text-slashed text-body-sm">{error}</p>}
    </div>
  );
}
