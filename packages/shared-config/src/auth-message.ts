// The exact text a wallet signs to authenticate with Veritine. Lives in
// a shared package so the frontend (which asks the wallet to sign it)
// and the backend (which verifies the recovered signer against it)
// can never drift apart.

export const SIGN_IN_DOMAIN = 'veritine.app';

export interface SignInMessageParams {
  address: string;
  nonce: string;
  issuedAt: string; // ISO timestamp
}

/**
 * Builds the human-readable message a wallet signs to authenticate. This
 * intentionally mirrors the readability goals of SIWE (EIP-4361) without
 * taking on the full library as a dependency - the fields that matter for
 * replay protection (nonce, issuedAt, address, domain) are all present
 * and are exactly what the backend re-derives and checks.
 */
export function buildSignInMessage({ address, nonce, issuedAt }: SignInMessageParams): string {
  return [
    `${SIGN_IN_DOMAIN} wants you to sign in with your wallet.`,
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    '',
    'This request will not trigger a blockchain transaction or cost any gas fees.',
  ].join('\n');
}
